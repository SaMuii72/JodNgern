import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ws = require('ws');

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

let supabaseClient: SupabaseClient | null = null;
let sqliteDb: Database | null = null;
let useSQLiteMode = false;
let isInitializing = false;

export async function initDb(): Promise<void> {
  if (sqliteDb || supabaseClient) return;

  const rawUrl = process.env.SUPABASE_URL || '';
  const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Try Supabase if URL is set and not known invalid domain
  if (cleanUrl && key && !cleanUrl.includes('ilekmcpjzdrqrtzcxpmd.supabase.co')) {
    try {
      const client = createClient(cleanUrl, key, { auth: { persistSession: false } });
      const { error } = await client.from('profiles').select('id').limit(1);
      if (!error) {
        supabaseClient = client;
        console.log('Connected to Supabase database successfully!');
        return;
      }
    } catch (err) {
      console.warn('Supabase connection check failed, using local SQLite:', err);
    }
  }

  // Fallback to SQLite
  useSQLiteMode = true;
  sqliteDb = await open({
    filename: './money.db',
    driver: sqlite3.Database,
  });

  await sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      google_id TEXT,
      email TEXT UNIQUE,
      name TEXT,
      picture TEXT,
      token TEXT
    );
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      type TEXT,
      initial_balance REAL DEFAULT 0,
      color TEXT DEFAULT '#4f46e5',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      target_amount REAL,
      current_amount REAL DEFAULT 0,
      deadline TEXT,
      wallet_id TEXT,
      tracking_type TEXT DEFAULT 'manual',
      color TEXT DEFAULT '#4f46e5',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL,
      type TEXT,
      category TEXT,
      date TEXT,
      note TEXT,
      user_id TEXT,
      wallet_id TEXT
    );
  `);

  try {
    await sqliteDb.exec(`ALTER TABLE transactions ADD COLUMN wallet_id TEXT;`);
  } catch {
    // Column already exists
  }

  console.log('Initialized local SQLite database (money.db)');
}

class SqliteQueryBuilder {
  private tableName: string;
  private selectFields: string = '*';
  private eqConditions: Record<string, any> = {};
  private neqConditions: Record<string, any> = {};
  private orderFields: { field: string; ascending: boolean }[] = [];
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field: string, value: any) {
    this.eqConditions[field] = value;
    return this;
  }

  neq(field: string, value: any) {
    this.neqConditions[field] = value;
    return this;
  }

  order(field: string, { ascending }: { ascending: boolean } = { ascending: true }) {
    this.orderFields.push({ field, ascending });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: (value: { data: any; error: any }) => void, reject?: (reason: any) => void) {
    try {
      if (!sqliteDb) await initDb();
      let sql = `SELECT ${this.selectFields} FROM ${this.tableName}`;
      const params: any[] = [];
      const whereClauses: string[] = [];

      for (const [k, v] of Object.entries(this.eqConditions)) {
        whereClauses.push(`${k} = ?`);
        params.push(v);
      }
      for (const [k, v] of Object.entries(this.neqConditions)) {
        whereClauses.push(`${k} != ?`);
        params.push(v);
      }

      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      if (this.orderFields.length > 0) {
        const orderStr = this.orderFields
          .map(o => `${o.field} ${o.ascending ? 'ASC' : 'DESC'}`)
          .join(', ');
        sql += ` ORDER BY ${orderStr}`;
      }

      if (this.isSingle) {
        sql += ' LIMIT 1';
        const row = await sqliteDb!.get(sql, params);
        resolve({ data: row || null, error: null });
      } else {
        const rows = await sqliteDb!.all(sql, params);
        resolve({ data: rows, error: null });
      }
    } catch (err: any) {
      resolve({ data: null, error: err });
    }
  }

  async insert(data: any | any[]) {
    try {
      if (!sqliteDb) await initDb();
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const keys = Object.keys(item);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => item[k]);
        const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
        await sqliteDb!.run(sql, values);
      }
      return { data: items, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async update(data: Record<string, any>) {
    try {
      if (!sqliteDb) await initDb();
      const setKeys = Object.keys(data);
      const setClause = setKeys.map(k => `${k} = ?`).join(', ');
      const setValues = setKeys.map(k => data[k]);

      const whereClauses: string[] = [];
      const whereValues: any[] = [];
      for (const [k, v] of Object.entries(this.eqConditions)) {
        whereClauses.push(`${k} = ?`);
        whereValues.push(v);
      }

      let sql = `UPDATE ${this.tableName} SET ${setClause}`;
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      await sqliteDb!.run(sql, [...setValues, ...whereValues]);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async delete() {
    try {
      if (!sqliteDb) await initDb();
      const whereClauses: string[] = [];
      const whereValues: any[] = [];

      for (const [k, v] of Object.entries(this.eqConditions)) {
        whereClauses.push(`${k} = ?`);
        whereValues.push(v);
      }
      for (const [k, v] of Object.entries(this.neqConditions)) {
        whereClauses.push(`${k} != ?`);
        whereValues.push(v);
      }

      let sql = `DELETE FROM ${this.tableName}`;
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      await sqliteDb!.run(sql, whereValues);
      return { data: null, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

export function getDb(): any {
  if (useSQLiteMode) {
    return {
      from: (table: string) => new SqliteQueryBuilder(table),
    };
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  // If not initialized yet, force SQLite mode initialization sync-wrapper
  if (!useSQLiteMode && !supabaseClient) {
    initDb().catch(console.error);
    useSQLiteMode = true;
    return {
      from: (table: string) => new SqliteQueryBuilder(table),
    };
  }
}
