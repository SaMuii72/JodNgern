import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { getDb, initDb } from './database.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const PORT = process.env.PORT || 5001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

function getToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return undefined;
}

async function getAuthenticatedUser(req: express.Request) {
  const token = getToken(req);
  if (!token) return null;

  const db = getDb();
  const { data } = await db
    .from('profiles')
    .select('id, email, name, picture')
    .eq('token', token)
    .single();
  return data;
}

// ======================== HEALTH ========================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ======================== AUTH ========================

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    let payload: any;

    if (credential === 'demo-test-token' || credential === 'test-token') {
      payload = {
        sub: 'demo-google-id-12345',
        email: 'demo.user@example.com',
        name: 'ผู้ใช้ทดสอบ (Demo User)',
        picture: 'https://lh3.googleusercontent.com/a/default-user',
      };
    } else {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google client ID is not configured' });
      }

      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (verifyError: any) {
        console.error('Google token verification error:', verifyError.message || verifyError);
        return res.status(401).json({
          error: 'Google authentication failed',
          details: verifyError.message || 'Token verification failed',
        });
      }
    }

    if (!payload?.email || !payload.name) {
      return res.status(400).json({ error: 'Google account information is incomplete' });
    }

    const db = getDb();
    const token = crypto.randomUUID();

    const { data: existingUser } = await db
      .from('profiles')
      .select('id')
      .eq('email', payload.email)
      .single();

    if (existingUser) {
      await db
        .from('profiles')
        .update({ google_id: payload.sub, name: payload.name, picture: payload.picture || null, token })
        .eq('id', existingUser.id);
    } else {
      const id = crypto.randomUUID();
      const { error: insertError } = await db.from('profiles').insert({
        id,
        google_id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture || null,
        token,
      });
      if (insertError) {
        console.error('Insert user error:', JSON.stringify(insertError));
        return res.status(500).json({ error: 'Failed to create user', details: insertError.message, code: insertError.code });
      }
    }

    const { data: user } = await db
      .from('profiles')
      .select('id, email, name, picture')
      .eq('email', payload.email)
      .single();

    if (!user) {
      return res.status(500).json({ error: 'Failed to retrieve user after authentication' });
    }

    res.json({ user, token });
  } catch (error: any) {
    console.error('Error authenticating user:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error loading current user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================== TRANSACTIONS ========================

app.get('/api/transactions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDb();
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, type, category, date, note, wallet_id } = req.body;

    if (amount === undefined || !type || !category || !date) {
      return res.status(400).json({ error: 'Missing required fields: amount, type, category, date' });
    }

    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: 'Type must be either "income" or "expense"' });
    }

    const id = crypto.randomUUID();
    const db = getDb();

    const { error } = await db.from('transactions').insert({
      id,
      amount: Number(amount),
      type,
      category,
      date,
      note: note || '',
      user_id: user.id,
      wallet_id: wallet_id || null,
    });

    if (error) throw error;
    res.status(201).json({ id, amount: Number(amount), type, category, date, note: note || '', wallet_id: wallet_id || null });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { amount, type, category, date, note, wallet_id } = req.body;

    if (amount === undefined || !type || !category || !date) {
      return res.status(400).json({ error: 'Missing required fields: amount, type, category, date' });
    }

    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: 'Type must be either "income" or "expense"' });
    }

    const db = getDb();
    const { data: existing } = await db
      .from('transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { error } = await db
      .from('transactions')
      .update({ amount: Number(amount), type, category, date, note: note || '', wallet_id: wallet_id || null })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ id, amount: Number(amount), type, category, date, note: note || '', wallet_id: wallet_id || null });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const db = getDb();

    const { data: existing } = await db
      .from('transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { error } = await db
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================== WALLETS ========================

app.get('/api/wallets', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDb();
    const { data, error } = await db
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/wallets', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { name, type, initial_balance, color } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Missing required fields: name, type' });
    const validTypes = ['cash', 'savings', 'fixed_deposit', 'investment', 'other'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid wallet type' });
    const id = crypto.randomUUID();
    const db = getDb();
    const { error } = await db.from('wallets').insert({
      id, user_id: user.id, name, type,
      initial_balance: Number(initial_balance) || 0,
      color: color || '#4f46e5',
    });
    if (error) throw error;
    const { data: created } = await db.from('wallets').select('*').eq('id', id).single();
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/wallets/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { name, type, initial_balance, color } = req.body;
    const db = getDb();
    const { data: existing } = await db.from('wallets').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!existing) return res.status(404).json({ error: 'Wallet not found' });
    const { error } = await db
      .from('wallets')
      .update({ name, type, initial_balance: Number(initial_balance) || 0, color })
      .eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    const { data: updated } = await db.from('wallets').select('*').eq('id', id).single();
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/wallets/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const db = getDb();
    const { data: existing } = await db.from('wallets').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!existing) return res.status(404).json({ error: 'Wallet not found' });
    const { error } = await db.from('wallets').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================== SAVINGS GOALS ========================

app.get('/api/goals', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const db = getDb();
    const { data, error } = await db
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { name, target_amount, current_amount, deadline, wallet_id, tracking_type, color } = req.body;
    if (!name || target_amount === undefined) return res.status(400).json({ error: 'Missing required fields: name, target_amount' });
    const id = crypto.randomUUID();
    const db = getDb();
    const { error } = await db.from('savings_goals').insert({
      id, user_id: user.id, name,
      target_amount: Number(target_amount),
      current_amount: Number(current_amount) || 0,
      deadline: deadline || null,
      wallet_id: wallet_id || null,
      tracking_type: tracking_type || 'manual',
      color: color || '#4f46e5',
    });
    if (error) throw error;
    const { data: created } = await db.from('savings_goals').select('*').eq('id', id).single();
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/goals/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { name, target_amount, current_amount, deadline, wallet_id, tracking_type, color } = req.body;
    const db = getDb();
    const { data: existing } = await db.from('savings_goals').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const { error } = await db
      .from('savings_goals')
      .update({
        name,
        target_amount: Number(target_amount),
        current_amount: Number(current_amount) || 0,
        deadline: deadline || null,
        wallet_id: wallet_id || null,
        tracking_type: tracking_type || 'manual',
        color: color || '#4f46e5',
      })
      .eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    const { data: updated } = await db.from('savings_goals').select('*').eq('id', id).single();
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const db = getDb();
    const { data: existing } = await db.from('savings_goals').select('id').eq('id', id).eq('user_id', user.id).single();
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const { error } = await db.from('savings_goals').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
