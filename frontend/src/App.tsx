import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import {
  Plus, X, Loader2, RefreshCw,
  BookOpen, BarChart2, Wallet, LogOut, ShieldCheck,
} from 'lucide-react';
import type { Transaction, TransactionInput, UserProfile } from './types';
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  loginWithGoogle,
  fetchCurrentUser,
  logout,
  getStoredSession,
} from './api';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import AnalyticsCharts from './components/AnalyticsCharts';

type PageType = 'record' | 'analytics';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<PageType>('record');
  const [loginLoading, setLoginLoading] = useState(false);

  const loadData = async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่ารัน Backend เรียบร้อยแล้ว');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const session = getStoredSession();
      if (!session) {
        setAuthLoading(false);
        setUser(null);
        return;
      }

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

  const handleSubmitTransaction = async (input: TransactionInput) => {
    try {
      if (editTransaction) {
        const updated = await updateTransaction(editTransaction.id, input);
        setTransactions(prev => prev.map(t => t.id === editTransaction.id ? updated : t));
        setEditTransaction(null);
      } else {
        const newTrans = await createTransaction(input);
        setTransactions(prev => [newTrans, ...prev]);
      }
      setIsModalOpen(false);
    } catch {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      try {
        await deleteTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
      } catch {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
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

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setAuthError('ไม่รับข้อมูลจาก Google ได้');
      return;
    }

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

  const handleGoogleError = () => {
    setAuthError('การเข้าสู่ระบบด้วย Google ล้มเหลว');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setTransactions([]);
    setError(null);
    setAuthError(null);
  };

  const navItems: { id: PageType; label: string; icon: typeof BookOpen }[] = [
    { id: 'record', label: 'บันทึก', icon: BookOpen },
    { id: 'analytics', label: 'รายงาน', icon: BarChart2 },
  ];

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

  return (
    <div className="shell">
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

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <Wallet size={20} className="brand-icon mobile-only" />
            <div>
              <h1 className="topbar-title">
                {currentPage === 'record' ? 'บันทึกรายการ' : 'รายงานสรุป'}
              </h1>
              <p className="topbar-sub">
                {currentPage === 'record' ? 'เพิ่ม / ดูรายการรายรับ-รายจ่าย' : 'วิเคราะห์ข้อมูลทางการเงิน'}
              </p>
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

        <div className="page-body">
          {loading && transactions.length === 0 ? (
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

      <nav className="bottom-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`bottom-nav-btn ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          className="bottom-nav-fab"
          onClick={() => { setEditTransaction(null); setIsModalOpen(true); }}
          title="เพิ่มรายการ"
        >
          <Plus size={26} />
        </button>
      </nav>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCancelEdit(); }}>
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
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
