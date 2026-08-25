import React, { useState } from 'react';
import {
  Plus, Edit2, Trash2, X, Check,
  Banknote, PiggyBank, Lock, TrendingUp, Wallet,
} from 'lucide-react';
import type { Wallet as WalletType, WalletInput, WalletType as WalletKind, Transaction } from '../types';

// ======================== CONSTANTS ========================

export const WALLET_TYPES: { id: WalletKind; label: string; icon: typeof Wallet; defaultColor: string }[] = [
  { id: 'cash',          label: 'เงินสด',      icon: Banknote,    defaultColor: '#4f46e5' },
  { id: 'savings',       label: 'ออมทรัพย์',    icon: PiggyBank,   defaultColor: '#10b981' },
  { id: 'fixed_deposit', label: 'ฝากประจำ',    icon: Lock,        defaultColor: '#f59e0b' },
  { id: 'investment',    label: 'ลงทุน',        icon: TrendingUp,  defaultColor: '#8b5cf6' },
  { id: 'other',         label: 'อื่นๆ',        icon: Wallet,      defaultColor: '#64748b' },
];

const PRESET_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#64748b',
  '#f97316', '#84cc16', '#0ea5e9', '#d946ef',
];

// ======================== HELPERS ========================

export function computeWalletBalance(wallet: WalletType, transactions: Transaction[]): number {
  const linked = transactions.filter(t => t.wallet_id === wallet.id);
  const income  = linked.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = linked.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return wallet.initial_balance + income - expense;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n);
}

// ======================== WALLET FORM MODAL ========================

interface WalletFormProps {
  initial?: WalletType | null;
  onSave: (input: WalletInput) => Promise<void>;
  onClose: () => void;
}

const WalletForm: React.FC<WalletFormProps> = ({ initial, onSave, onClose }) => {
  const [name,            setName]           = useState(initial?.name ?? '');
  const [type,            setType]           = useState<WalletKind>(initial?.type ?? 'cash');
  const [initialBalance,  setInitialBalance] = useState(initial?.initial_balance?.toString() ?? '0');
  const [color,           setColor]          = useState(initial?.color ?? '#4f46e5');
  const [saving,          setSaving]         = useState(false);

  const handleTypeChange = (t: WalletKind) => {
    setType(t);
    if (!initial) {
      const def = WALLET_TYPES.find(w => w.id === t)?.defaultColor;
      if (def) setColor(def);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type, initial_balance: parseFloat(initialBalance) || 0, color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{initial ? '✏️ แก้ไขกระเป๋าเงิน' : '➕ เพิ่มกระเป๋าเงิน'}</h3>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="transaction-form">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">ชื่อกระเป๋าเงิน</label>
            <input
              className="input-field"
              placeholder="เช่น เงินสดในมือ, บัญชี KBank"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="form-group">
            <label className="form-label">ประเภท</label>
            <div className="wallet-type-selector">
              {WALLET_TYPES.map(wt => {
                const Icon = wt.icon;
                return (
                  <button
                    key={wt.id}
                    type="button"
                    className={`wallet-type-btn ${type === wt.id ? 'active' : ''}`}
                    style={type === wt.id ? { borderColor: color, color } : {}}
                    onClick={() => handleTypeChange(wt.id)}
                  >
                    <Icon size={18} />
                    <span>{wt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Initial Balance */}
          <div className="form-group">
            <label className="form-label">ยอดเงินเริ่มต้น (บาท)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="input-field"
              placeholder="0"
              value={initialBalance}
              onChange={e => setInitialBalance(e.target.value)}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              ยอดเงินที่มีอยู่ก่อนเริ่มบันทึกในแอป
            </p>
          </div>

          {/* Color */}
          <div className="form-group">
            <label className="form-label">สี</label>
            <div className="color-swatches">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`สี ${c}`}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            <Check size={18} />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ======================== MAIN COMPONENT ========================

interface WalletManagerProps {
  wallets: WalletType[];
  transactions: Transaction[];
  onAdd:    (input: WalletInput) => Promise<void>;
  onEdit:   (id: string, input: WalletInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const WalletManager: React.FC<WalletManagerProps> = ({
  wallets, transactions, onAdd, onEdit, onDelete,
}) => {
  const [showForm,    setShowForm]    = useState(false);
  const [editTarget,  setEditTarget]  = useState<WalletType | null>(null);

  const handleSave = async (input: WalletInput) => {
    if (editTarget) {
      await onEdit(editTarget.id, input);
    } else {
      await onAdd(input);
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleOpenEdit = (w: WalletType) => {
    setEditTarget(w);
    setShowForm(true);
  };

  const handleOpenAdd = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  return (
    <div className="wallets-page">
      {/* Header */}
      <div className="page-section-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>💼 กระเป๋าเงินของฉัน</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            จัดการเงินสด บัญชีออมทรัพย์ และแหล่งเงินต่างๆ
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>เพิ่มกระเป๋า</span>
        </button>
      </div>

      {/* Wallet Grid */}
      {wallets.length === 0 ? (
        <div className="card empty-state" style={{ marginTop: '16px' }}>
          <Wallet size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h4 style={{ fontWeight: 600, margin: '0 0 6px' }}>ยังไม่มีกระเป๋าเงิน</h4>
          <p>เพิ่มกระเป๋าแรกของคุณเพื่อเริ่มต้น</p>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px', marginTop: '16px' }}
            onClick={handleOpenAdd}
          >
            <Plus size={16} />
            <span>เพิ่มกระเป๋าเงิน</span>
          </button>
        </div>
      ) : (
        <div className="wallet-grid">
          {wallets.map(wallet => {
            const meta    = WALLET_TYPES.find(w => w.id === wallet.type) ?? WALLET_TYPES[4];
            const Icon    = meta.icon;
            const balance = computeWalletBalance(wallet, transactions);
            const txCount = transactions.filter(t => t.wallet_id === wallet.id).length;

            return (
              <div key={wallet.id} className="wallet-card">
                {/* Colored top strip */}
                <div className="wallet-card-top" style={{ background: wallet.color }}>
                  <div className="wallet-card-icon">
                    <Icon size={24} color="#fff" />
                  </div>
                  <div className="wallet-card-actions-top">
                    <button
                      className="wallet-action-btn"
                      onClick={() => handleOpenEdit(wallet)}
                      title="แก้ไข"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="wallet-action-btn danger"
                      onClick={() => onDelete(wallet.id)}
                      title="ลบ"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="wallet-card-body">
                  <div className="wallet-type-badge" style={{ color: wallet.color, background: `${wallet.color}18` }}>
                    {meta.label}
                  </div>
                  <div className="wallet-name">{wallet.name}</div>
                  <div className="wallet-balance" style={{ color: balance >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
                    {fmt(balance)}
                  </div>
                  <div className="wallet-meta-row">
                    <span className="wallet-initial-label">เริ่มต้น {fmt(wallet.initial_balance)}</span>
                    <span className="wallet-tx-count">{txCount} รายการ</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <WalletForm
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
};

export default WalletManager;
