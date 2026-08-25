export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string; // YYYY-MM-DD
  note: string;
  wallet_id?: string | null;
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

// ======================== WALLETS ========================
export type WalletType = 'cash' | 'savings' | 'fixed_deposit' | 'investment' | 'other';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  initial_balance: number;
  color: string;
  created_at: string;
}

export type WalletInput = Omit<Wallet, 'id' | 'created_at'>;

// ======================== SAVINGS GOALS ========================
export type GoalTrackingType = 'wallet' | 'manual';

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number; // used for manual tracking
  deadline: string | null;  // YYYY-MM-DD or null
  wallet_id: string | null; // linked wallet (for wallet tracking)
  tracking_type: GoalTrackingType;
  color: string;
  created_at: string;
}

export type SavingsGoalInput = Omit<SavingsGoal, 'id' | 'created_at'>;
