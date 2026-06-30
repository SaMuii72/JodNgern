import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

async function ensureSchema(database: Database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      picture TEXT,
      token TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      user_id TEXT NOT NULL DEFAULT 'default-user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await database.all('PRAGMA table_info(transactions)');
  const hasUserId = columns.some((column: any) => column.name === 'user_id');
  if (!hasUserId) {
    await database.exec(`ALTER TABLE transactions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default-user'`);
  }

  await database.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`);
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, '..', 'database.sqlite'),
    driver: sqlite3.Database,
  });

  await ensureSchema(db);
  return db;
}
