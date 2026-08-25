import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import {
  Plus, X, Loader2, RefreshCw,
  BookOpen, BarChart2, Wallet, LogOut, ShieldCheck, Target,
} from 'lucide-react';
import type { Transaction, TransactionInput, UserProfile, Wallet as WalletType, WalletInput, SavingsGoal, SavingsGoalInput } from './types';
import {
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  fetchWallets, createWallet, updateWallet, deleteWallet,
  fetchGoals, createGoal, updateGoal, deleteGoal,
  loginWithGoogle, fetchCurrentUser, logout, getStoredSession,
} from './api';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import AnalyticsCharts from './components/AnalyticsCharts';
import WalletManager from './components/WalletManager';
import GoalManager from './components/GoalManager';
import ToastContainer, { useToast } from './components/Toast';

type PageType = 'record' | 'analytics' | 'wallets' | 'goals';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets,      setWallets]      = useState<WalletType[]>([]);
  const [goals,        setGoals]        = useState<SavingsGoal[]>([]);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [authLoading,  setAuthLoading]  = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [authError,    setAuthError]    = useState<string | null>(null);
  const [user,         setUser]         = useState<UserProfile | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isModalOpen,  setIsModalOpen]  = useState<boolean>(false);
  const [currentPage,  setCurrentPage]  = useState<PageType>('record');
  const [loginLoading, setLoginLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // ======================== DATA LOADING ========================

  const loadData = async () => {
    if (!user) { setTransactions([]); setWallets([]); setGoals([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [txData, walletData, goalData] = await Promise.all([
        fetchTransactions(),
        fetchWallets(),
        fetchGoals(),
      ]);
      setTransactions(txData);
      setWallets(walletData);
      setGoals(goalData);
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่ารัน Backend เรียบร้อยแล้ว');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const session = getStoredSession();
      if (!session) { setAuthLoading(false); setUser(null); return; }
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch {
        logout();
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user]);

  // ======================== TRANSACTIONS ========================

  const handleSubmitTransaction = async (input: TransactionInput) => {
    try {
      if (editTransaction) {
        const updated = await updateTransaction(editTransaction.id, input);
        setTransactions(prev => prev.map(t => t.id === editTransaction.id ? updated : t));
        setEditTransaction(null);
        addToast('✏️ แก้ไขรายการเรียบร้อยแล้ว', 'success');
      } else {
        const newTrans = await createTransaction(input);
        setTransactions(prev => [newTrans, ...prev]);
        addToast(
          `${input.type === 'income' ? '💰 บันทึกรายรับ' : '💸 บันทึกรายจ่าย'}เรียบร้อยแล้ว`,
          'success'
        );
      }
      setIsModalOpen(false);
    } catch {
      addToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      try {
        await deleteTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
        addToast('🗑️ ลบรายการเรียบร้อยแล้ว', 'info');
      } catch {
        addToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
      }
    }
  };

  const handleSelectEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditTransaction(null);
    setIsModalOpen(false);
  };

  // ======================== WALLETS ========================

  const handleAddWallet = async (input: WalletInput) => {
    const created = await createWallet(input);
    setWallets(prev => [...prev, created]);
    addToast('💼 เพิ่มกระเป๋าเงินเรียบร้อยแล้ว', 'success');
  };

  const handleEditWallet = async (id: string, input: WalletInput) => {
    const updated = await updateWallet(id, input);
    setWallets(prev => prev.map(w => w.id === id ? updated : w));
    addToast('✏️ แก้ไขกระเป๋าเงินเรียบร้อยแล้ว', 'success');
  };

  const handleDeleteWallet = async (id: string) => {
    if (!window.confirm('ลบกระเป๋าเงินนี้? (รายการที่ผูกกับกระเป๋านี้จะไม่ถูกลบ)')) return;
    await deleteWallet(id);
    setWallets(prev => prev.filter(w => w.id !== id));
    addToast('🗑️ ลบกระเป๋าเงินเรียบร้อยแล้ว', 'info');
  };

  // ======================== GOALS ========================

  const handleAddGoal = async (input: SavingsGoalInput) => {
    const created = await createGoal(input);
    setGoals(prev => [...prev, created]);
    addToast('🎯 เพิ่มเป้าหมายเรียบร้อยแล้ว', 'success');
  };

  const handleEditGoal = async (id: string, input: SavingsGoalInput) => {
    const updated = await updateGoal(id, input);
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
    addToast('✏️ แก้ไขเป้าหมายเรียบร้อยแล้ว', 'success');
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('ลบเป้าหมายการออมนี้?')) return;
    await deleteGoal(id);
    setGoals(prev => prev.filter(g => g.id !== id));
    addToast('🗑️ ลบเป้าหมายเรียบร้อยแล้ว', 'info');
  };

  const handleUpdateGoalAmount = async (id: string, amount: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const updated = await updateGoal(id, { ...goal, current_amount: amount });
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
    addToast('💰 อัปเดตยอดออมเรียบร้อยแล้ว', 'success');
  };

  // ======================== AUTH ========================

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) { setAuthError('ไม่รับข้อมูลจาก Google ได้'); return; }
    setLoginLoading(true);
    setAuthError(null);
    try {
      const result = await loginWithGoogle({ credential: response.credential });
      setUser(result.user);
    } catch {
      setAuthError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ในขณะนี้');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleError = () => { setAuthError('การเข้าสู่ระบบด้วย Google ล้มเหลว'); };

  const handleLogout = () => {
    logout();
    setUser(null);
    setTransactions([]); setWallets([]); setGoals([]);
    setError(null); setAuthError(null);
  };

  // ======================== NAV ITEMS ========================

  const navItems: { id: PageType; label: string; icon: typeof BookOpen }[] = [
    { id: 'record',    label: 'บันทึก',    icon: BookOpen  },
    { id: 'wallets',   label: 'กระเป๋า',   icon: Wallet   },
    { id: 'goals',     label: 'เป้าหมาย',  icon: Target   },
    { id: 'analytics', label: 'รายงาน',    icon: BarChart2 },
  ];

  const pageTitle: Record<PageType, string> = {
    record:    'บันทึกรายการ',
    wallets:   'กระเป๋าเงิน',
    goals:     'เป้าหมายการออม',
    analytics: 'รายงานสรุป',
  };

  const pageSub: Record<PageType, string> = {
    record:    'เพิ่ม / ดูรายการรายรับ-รายจ่าย',
    wallets:   'จัดการกระเป๋าเงินและบัญชีต่างๆ',
    goals:     'ติดตามความคืบหน้าการออมเงิน',
    analytics: 'วิเคราะห์ข้อมูลทางการเงิน',
  };

  // ======================== LOADING / AUTH SCREENS ========================

  if (authLoading) {
    return (
      <div className="shell auth-shell">
        <div className="full-center">
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>กำลังตรวจสอบบัญชีของคุณ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card">
          <div className="auth-badge">
            <ShieldCheck size={16} />
            <span>เข้าสู่ระบบด้วยบัญชี Google</span>
          </div>
          <div className="auth-header">
            <Wallet size={28} className="brand-icon" />
            <h1>MoneyBook</h1>
            <p>บันทึกรายรับ-รายจ่ายของคุณและเก็บข้อมูลแยกตามผู้ใช้แบบปลอดภัย</p>
          </div>

          <div className="auth-form">
            {authError && <div className="auth-error">{authError}</div>}
            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                size="large"
                text="continue_with"
                shape="pill"
              />
            ) : (
              <div className="auth-error">
                ตั้งค่า VITE_GOOGLE_CLIENT_ID ในไฟล์ .env ของ frontend ก่อนใช้งาน Google Sign-In
              </div>
            )}
            {loginLoading && (
              <div className="auth-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>กำลังยืนยันบัญชี Google...</span>
              </div>
            )}
          </div>

          <div className="auth-note">
            ระบบจะยืนยันบัญชี Google ของคุณและเก็บรายการแยกตามผู้ใช้งาน เพื่อให้คุณกลับมาใช้งานต่อได้ทุกที่
          </div>
        </div>
      </div>
    );
  }

  // ======================== MAIN APP ========================

  return (
    <div className="shell">
      {/* ── SIDEBAR (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wallet size={22} className="brand-icon" />
          <div>
            <div className="brand-title">MoneyBook</div>
            <div className="brand-sub">ติดตามการเงิน</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-btn ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <Wallet size={20} className="brand-icon mobile-only" />
            <div>
              <h1 className="topbar-title">{pageTitle[currentPage]}</h1>
              <p className="topbar-sub">{pageSub[currentPage]}</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="user-chip">
              <div className="avatar-badge">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-meta">
                <span>{user.name}</span>
                <small>{user.email}</small>
              </div>
            </div>
            <button onClick={handleLogout} className="icon-btn" title="ออกจากระบบ">
              <LogOut size={16} />
            </button>
            <button onClick={() => void loadData()} className="icon-btn" title="รีเฟรชข้อมูล">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Page Body */}
        <div className="page-body">
          {loading && transactions.length === 0 && wallets.length === 0 ? (
            <div className="full-center">
              <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="error-card">
              <p>{error}</p>
              <button onClick={() => void loadData()} className="btn-primary" style={{ marginTop: '16px', width: 'auto', padding: '10px 24px' }}>
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              {/* RECORD PAGE */}
              {currentPage === 'record' && (
                <div className="page-record">
                  <Dashboard transactions={transactions} />
                  <div className="record-layout">
                    <div className="card form-card desktop-only">
                      <h2 className="section-title">
                        {editTransaction ? '✏️ แก้ไขรายการ' : '➕ เพิ่มรายการใหม่'}
                      </h2>
                      <TransactionForm
                        onSubmit={handleSubmitTransaction}
                        editTransaction={editTransaction}
                        onCancelEdit={handleCancelEdit}
                        wallets={wallets}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="card">
                        <TransactionList
                          transactions={transactions}
                          onDelete={handleDeleteTransaction}
                          onEdit={handleSelectEdit}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* WALLETS PAGE */}
              {currentPage === 'wallets' && (
                <WalletManager
                  wallets={wallets}
                  transactions={transactions}
                  onAdd={handleAddWallet}
                  onEdit={handleEditWallet}
                  onDelete={handleDeleteWallet}
                />
              )}

              {/* GOALS PAGE */}
              {currentPage === 'goals' && (
                <GoalManager
                  goals={goals}
                  wallets={wallets}
                  transactions={transactions}
                  onAdd={handleAddGoal}
                  onEdit={handleEditGoal}
                  onDelete={handleDeleteGoal}
                  onUpdateAmount={handleUpdateGoalAmount}
                />
              )}

              {/* ANALYTICS PAGE */}
              {currentPage === 'analytics' && (
                <div className="page-analytics">
                  <Dashboard transactions={transactions} />
                  <AnalyticsCharts transactions={transactions} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className="bottom-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`bottom-nav-btn ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── FAB: เพิ่มรายการ (mobile only, on record page) ── */}
      {currentPage === 'record' && (
        <button
          className="page-fab"
          onClick={() => { setEditTransaction(null); setIsModalOpen(true); }}
          title="เพิ่มรายการ"
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── MODAL (mobile form) ── */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleCancelEdit(); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {editTransaction ? '✏️ แก้ไขรายการ' : '➕ บันทึกรายการใหม่'}
              </h3>
              <button onClick={handleCancelEdit} className="icon-btn">
                <X size={18} />
              </button>
            </div>
            <TransactionForm
              onSubmit={handleSubmitTransaction}
              editTransaction={editTransaction}
              onCancelEdit={handleCancelEdit}
              wallets={wallets}
            />
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
