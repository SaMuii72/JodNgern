import express from 'express';
import cors from 'cors';
import { getDb } from './database.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const PORT = process.env.PORT || 5001;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
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

  const db = await getDb();
  return db.get('SELECT id, email, name, picture FROM users WHERE token = ?', [token]);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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

    const db = await getDb();
    const token = crypto.randomUUID();
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [payload.email]);

    if (existingUser) {
      await db.run(
        'UPDATE users SET google_id = ?, name = ?, picture = ?, token = ? WHERE id = ?',
        [payload.sub, payload.name, payload.picture || null, token, existingUser.id]
      );
    } else {
      const id = crypto.randomUUID();
      await db.run(
        'INSERT INTO users (id, google_id, email, name, picture, token) VALUES (?, ?, ?, ?, ?, ?)',
        [id, payload.sub, payload.email, payload.name, payload.picture || null, token]
      );
    }

    const user = await db.get('SELECT id, email, name, picture FROM users WHERE email = ?', [payload.email]);
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

    const db = await getDb();
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
      [user.id]
    );
    res.json(transactions);
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
    const db = await getDb();

    await db.run(
      'INSERT INTO transactions (id, amount, type, category, date, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, Number(amount), type, category, date, note || '', user.id]
    );

    const newTransaction = { id, amount: Number(amount), type, category, date, note: note || '' };
    res.status(201).json(newTransaction);
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

    const db = await getDb();
    const existing = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, user.id]);

    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.run(
      'UPDATE transactions SET amount = ?, type = ?, category = ?, date = ?, note = ? WHERE id = ? AND user_id = ?',
      [Number(amount), type, category, date, note || '', id, user.id]
    );

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
    const db = await getDb();

    const existing = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, user.id]);
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
