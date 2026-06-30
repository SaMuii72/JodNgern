export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
}

export interface GoogleLoginPayload {
  credential: string;
  email?: string;
  name?: string;
  picture?: string | null;
  googleId?: string;
}

export type TransactionInput = Omit<Transaction, 'id'>;
