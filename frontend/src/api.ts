import type {
  GoogleLoginPayload,
  Transaction, TransactionInput,
  UserProfile,
  Wallet, WalletInput,
  SavingsGoal, SavingsGoalInput,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
const TOKEN_KEY = 'money-token';
const USER_KEY = 'money-user';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredSession(token: string, user: UserProfile) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getStoredSession(): { token: string; user: UserProfile } | null {
  const token = getStoredToken();
  const storedUser = localStorage.getItem(USER_KEY);
  if (!token || !storedUser) return null;

  try {
    return { token, user: JSON.parse(storedUser) as UserProfile };
  } catch {
    clearStoredSession();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredToken());
}

export function logout(): void {
  clearStoredSession();
}

// ======================== AUTH ========================

export async function loginWithGoogle(payload: GoogleLoginPayload): Promise<{ user: UserProfile; token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend (พอร์ต 5001) ได้');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.details || data.error || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ในขณะนี้');
  }
  setStoredSession(data.token, data.user);
  return data;
}

export async function loginWithEmail(payload: { email: string; name: string }): Promise<{ user: UserProfile; token: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend (พอร์ต 5001) ได้');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'ไม่สามารถเข้าสู่ระบบได้');
  }
  setStoredSession(data.token, data.user);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Session expired');
  return response.json();
}

// ======================== TRANSACTIONS ========================

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/transactions`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create transaction');
  return response.json();
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update transaction');
  return response.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete transaction');
}

// ======================== WALLETS ========================

export async function fetchWallets(): Promise<Wallet[]> {
  const response = await fetch(`${API_BASE_URL}/wallets`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch wallets');
  return response.json();
}

export async function createWallet(input: WalletInput): Promise<Wallet> {
  const response = await fetch(`${API_BASE_URL}/wallets`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create wallet');
  return response.json();
}

export async function updateWallet(id: string, input: WalletInput): Promise<Wallet> {
  const response = await fetch(`${API_BASE_URL}/wallets/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update wallet');
  return response.json();
}

export async function deleteWallet(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/wallets/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete wallet');
}

// ======================== SAVINGS GOALS ========================

export async function fetchGoals(): Promise<SavingsGoal[]> {
  const response = await fetch(`${API_BASE_URL}/goals`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Failed to fetch goals');
  return response.json();
}

export async function createGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  const response = await fetch(`${API_BASE_URL}/goals`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create goal');
  return response.json();
}

export async function updateGoal(id: string, input: SavingsGoalInput): Promise<SavingsGoal> {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update goal');
  return response.json();
}

export async function deleteGoal(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete goal');
}
