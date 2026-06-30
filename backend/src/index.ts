import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { getDb } from './database.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const PORT = process.env.PORT || 5001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins }));
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

app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true,
    supabase_url: process.env.SUPABASE_URL || 'NOT SET',
    has_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google client ID is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
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
        console.error('Supabase URL:', process.env.SUPABASE_URL);
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

    const { amount, type, category, date, note } = req.body;

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
    });

    if (error) throw error;
    res.status(201).json({ id, amount: Number(amount), type, category, date, note: note || '' });
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
    const { amount, type, category, date, note } = req.body;

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
      .update({ amount: Number(amount), type, category, date, note: note || '' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ id, amount: Number(amount), type, category, date, note: note || '' });
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
