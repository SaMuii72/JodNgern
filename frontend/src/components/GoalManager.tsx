import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Target, CalendarDays, Pencil } from 'lucide-react';
import type { SavingsGoal, SavingsGoalInput, GoalTrackingType, Wallet, Transaction } from '../types';
import { computeWalletBalance } from './WalletManager';

// ======================== CONSTANTS ========================

const PRESET_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#64748b',
  '#f97316', '#84cc16', '#0ea5e9', '#d946ef',
];

// ======================== HELPERS ========================

function fmt(n: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function daysLeft(deadlineStr: string | null): number | null {
  if (!deadlineStr) return null;
  const now      = new Date();
  const deadline = new Date(deadlineStr + 'T00:00:00');
  const diff     = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ======================== GOAL FORM MODAL ========================

interface GoalFormProps {
  initial?:   SavingsGoal | null;
  wallets:    Wallet[];
  onSave:     (input: SavingsGoalInput) => Promise<void>;
  onClose:    () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ initial, wallets, onSave, onClose }) => {
  const [name,           setName]          = useState(initial?.name ?? '');
  const [targetAmount,   setTargetAmount]  = useState(initial?.target_amount?.toString() ?? '');
  const [currentAmount,  setCurrentAmount] = useState(initial?.current_amount?.toString() ?? '0');
  const [trackingType,   setTrackingType]  = useState<GoalTrackingType>(initial?.tracking_type ?? 'manual');
  const [walletId,       setWalletId]      = useState<string>(initial?.wallet_id ?? '');
  const [deadlineMode,   setDeadlineMode]  = useState<'none' | 'year' | 'custom'>(
    initial?.deadline ? (initial.deadline.endsWith('-12-31') ? 'year' : 'custom') : 'none'
  );
  const [deadlineYear,   setDeadlineYear]  = useState(() => {
    if (initial?.deadline?.endsWith('-12-31')) return initial.deadline.slice(0, 4);
    return String(new Date().getFullYear() + 1);
  });
  const [customDeadline, setCustomDeadline] = useState(
    initial?.deadline && !initial.deadline.endsWith('-12-31') ? initial.deadline : ''
  );
  const [color,   setColor]   = useState(initial?.color ?? '#4f46e5');
  const [saving,  setSaving]  = useState(false);

  const computedDeadline = (): string | null => {
    if (deadlineMode === 'year')   return `${deadlineYear}-12-31`;
    if (deadlineMode === 'custom') return customDeadline || null;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        target_amount:  parseFloat(targetAmount) || 0,
        current_amount: trackingType === 'manual' ? (parseFloat(currentAmount) || 0) : 0,
        tracking_type:  trackingType,
        wallet_id:      trackingType === 'wallet' ? (walletId || null) : null,
        deadline:       computedDeadline(),
        color,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{initial ? '✏️ แก้ไขเป้าหมาย' : '🎯 ตั้งเป้าหมายการออม'}</h3>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="transaction-form">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">ชื่อเป้าหมาย</label>
            <input
              className="input-field"
              placeholder="เช่น ซื้อรถ, เที่ยวญี่ปุ่น, เงินฉุกเฉิน"
              value={name}
              onChange={e => setName(e.target.value)}
              required autoFocus
            />
          </div>

          {/* Target Amount */}
          <div className="form-group">
            <label className="form-label">เป้าหมาย (บาท)</label>
            <input
              type="number" step="any" min="1"
              className="input-field"
              placeholder="0"
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              required
            />
          </div>

          {/* Tracking Type */}
          <div className="form-group">
            <label className="form-label">วิธีติดตามยอดออม</label>
            <div className="type-toggle-group">
              <button
                type="button"
                className={`type-toggle-btn ${trackingType === 'manual' ? 'active income' : ''}`}
                onClick={() => setTrackingType('manual')}
              >
                กรอกเองด้วยมือ
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${trackingType === 'wallet' ? 'active income' : ''}`}
                onClick={() => setTrackingType('wallet')}
                disabled={wallets.length === 0}
                title={wallets.length === 0 ? 'ต้องมีกระเป๋าเงินก่อน' : undefined}
              >
                ดึงจากกระเป๋าเงิน
              </button>
            </div>
          </div>

          {/* Wallet selector */}
          {trackingType === 'wallet' && (
            <div className="form-group">
              <label className="form-label">เลือกกระเป๋าเงิน</label>
              <select
                className="input-field"
                value={walletId}
                onChange={e => setWalletId(e.target.value)}
                required
              >
                <option value="">-- เลือกกระเป๋า --</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Manual current amount */}
          {trackingType === 'manual' && (
            <div className="form-group">
              <label className="form-label">ยอดที่ออมได้แล้ว (บาท)</label>
              <input
                type="number" step="any" min="0"
                className="input-field"
                placeholder="0"
                value={currentAmount}
                onChange={e => setCurrentAmount(e.target.value)}
              />
            </div>
          )}

          {/* Deadline */}
          <div className="form-group">
            <label className="form-label">
              <CalendarDays size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              กำหนดเส้นตาย (ไม่บังคับ)
            </label>
            <div className="type-toggle-group" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              {(['none', 'year', 'custom'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={`type-toggle-btn ${deadlineMode === mode ? 'active income' : ''}`}
                  onClick={() => setDeadlineMode(mode)}
                >
                  {mode === 'none' ? 'ไม่มี' : mode === 'year' ? 'สิ้นปี' : 'กำหนดเอง'}
                </button>
              ))}
            </div>

            {deadlineMode === 'year' && (
              <select
                className="input-field"
                style={{ marginTop: '10px' }}
                value={deadlineYear}
                onChange={e => setDeadlineYear(e.target.value)}
              >
                {yearOptions.map(y => (
                  <option key={y} value={String(y)}>สิ้นปี {y + 543} (ปลาย ธ.ค. {y})</option>
                ))}
              </select>
            )}

            {deadlineMode === 'custom' && (
              <input
                type="date"
                className="input-field"
                style={{ marginTop: '10px' }}
                value={customDeadline}
                onChange={e => setCustomDeadline(e.target.value)}
                required
              />
            )}
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

// ======================== QUICK UPDATE MODAL ========================

interface QuickUpdateProps {
  goal:    SavingsGoal;
  onSave:  (amount: number) => Promise<void>;
  onClose: () => void;
}

const QuickUpdateModal: React.FC<QuickUpdateProps> = ({ goal, onSave, onClose }) => {
  const [amount, setAmount] = useState(goal.current_amount.toString());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(parseFloat(amount) || 0);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: '360px', margin: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title">💰 อัปเดตยอดออม</h3>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {goal.name}
        </p>
        <form onSubmit={handleSubmit} className="transaction-form">
          <div className="form-group">
            <label className="form-label">ยอดที่ออมได้แล้ว (บาท)</label>
            <input
              type="number" step="any" min="0"
              className="input-field"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Check size={18} />
            <span>{saving ? 'กำลังบันทึก...' : 'อัปเดต'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

// ======================== MAIN COMPONENT ========================

interface GoalManagerProps {
  goals:        SavingsGoal[];
  wallets:      Wallet[];
  transactions: Transaction[];
  onAdd:              (input: SavingsGoalInput) => Promise<void>;
  onEdit:             (id: string, input: SavingsGoalInput) => Promise<void>;
  onDelete:           (id: string) => Promise<void>;
  onUpdateAmount:     (id: string, amount: number) => Promise<void>;
}

export const GoalManager: React.FC<GoalManagerProps> = ({
  goals, wallets, transactions, onAdd, onEdit, onDelete, onUpdateAmount,
}) => {
  const [showForm,       setShowForm]       = useState(false);
  const [editTarget,     setEditTarget]     = useState<SavingsGoal | null>(null);
  const [quickUpdateFor, setQuickUpdateFor] = useState<SavingsGoal | null>(null);

  const getGoalCurrentAmount = (goal: SavingsGoal): number => {
    if (goal.tracking_type === 'wallet' && goal.wallet_id) {
      const wallet = wallets.find(w => w.id === goal.wallet_id);
      if (wallet) return computeWalletBalance(wallet, transactions);
    }
    return goal.current_amount;
  };

  const handleSave = async (input: SavingsGoalInput) => {
    if (editTarget) {
      await onEdit(editTarget.id, input);
    } else {
      await onAdd(input);
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleQuickUpdate = async (amount: number) => {
    if (!quickUpdateFor) return;
    await onUpdateAmount(quickUpdateFor.id, amount);
    setQuickUpdateFor(null);
  };

  return (
    <div className="goals-page">
      {/* Header */}
      <div className="page-section-header">
        <div>
          <h2 className="section-title" style={{ marginBottom: 0 }}>🎯 เป้าหมายการออม</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            ตั้งเป้าหมายและติดตามความคืบหน้าการออมของคุณ
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '10px 18px' }}
          onClick={() => { setEditTarget(null); setShowForm(true); }}
        >
          <Plus size={16} />
          <span>เพิ่มเป้าหมาย</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card empty-state" style={{ marginTop: '16px' }}>
          <Target size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h4 style={{ fontWeight: 600, margin: '0 0 6px' }}>ยังไม่มีเป้าหมาย</h4>
          <p>ตั้งเป้าหมายแรกของคุณเพื่อเริ่มต้น</p>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px', marginTop: '16px' }}
            onClick={() => { setEditTarget(null); setShowForm(true); }}
          >
            <Plus size={16} />
            <span>เพิ่มเป้าหมาย</span>
          </button>
        </div>
      ) : (
        <div className="goal-list">
          {goals.map(goal => {
            const current   = getGoalCurrentAmount(goal);
            const pct       = goal.target_amount > 0
              ? clamp((current / goal.target_amount) * 100, 0, 100)
              : 0;
            const remaining = Math.max(goal.target_amount - current, 0);
            const days      = daysLeft(goal.deadline);
            const done      = current >= goal.target_amount;
            const linkedWallet = goal.tracking_type === 'wallet'
              ? wallets.find(w => w.id === goal.wallet_id)
              : null;

            return (
              <div key={goal.id} className="goal-card" style={{ borderLeftColor: goal.color }}>
                {/* Card top row */}
                <div className="goal-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div className="goal-color-dot" style={{ background: goal.color }} />
                    <span className="goal-name">{goal.name}</span>
                    {done && <span className="goal-done-badge">✅ สำเร็จ!</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {goal.tracking_type === 'manual' && !done && (
                      <button
                        className="action-btn"
                        title="อัปเดตยอด"
                        onClick={() => setQuickUpdateFor(goal)}
                      >
                        <Pencil size={13} style={{ color: goal.color }} />
                      </button>
                    )}
                    <button className="action-btn" title="แก้ไข"
                      onClick={() => { setEditTarget(goal); setShowForm(true); }}>
                      <Edit2 size={13} style={{ color: '#64748b' }} />
                    </button>
                    <button className="action-btn" title="ลบ"
                      onClick={() => onDelete(goal.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="goal-progress-track">
                  <div
                    className="goal-progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: done
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : `linear-gradient(90deg, ${goal.color}cc, ${goal.color})`,
                    }}
                  />
                </div>

                {/* Amounts */}
                <div className="goal-amounts-row">
                  <span className="goal-current" style={{ color: goal.color }}>
                    {fmt(current)}
                  </span>
                  <span className="goal-pct" style={{ color: done ? '#10b981' : 'var(--text-muted)' }}>
                    {pct.toFixed(1)}%
                  </span>
                  <span className="goal-target">{fmt(goal.target_amount)}</span>
                </div>

                {/* Meta row */}
                <div className="goal-meta-row">
                  {linkedWallet && (
                    <span className="goal-wallet-tag" style={{ color: linkedWallet.color, background: `${linkedWallet.color}18` }}>
                      💼 {linkedWallet.name}
                    </span>
                  )}
                  {!done && remaining > 0 && (
                    <span className="goal-remaining">เหลืออีก {fmt(remaining)}</span>
                  )}
                  {goal.deadline && (
                    <span className="goal-deadline-tag">
                      <CalendarDays size={11} />
                      {fmtDate(goal.deadline)}
                      {days !== null && (
                        <span
                          className="goal-days-left"
                          style={{ color: days < 30 ? 'var(--color-danger)' : days < 90 ? 'var(--color-warning)' : 'var(--text-muted)' }}
                        >
                          {days > 0 ? `อีก ${days} วัน` : days === 0 ? 'วันนี้!' : `เลยกำหนด ${Math.abs(days)} วัน`}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <GoalForm
          initial={editTarget}
          wallets={wallets}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* Quick Update Modal */}
      {quickUpdateFor && (
        <QuickUpdateModal
          goal={quickUpdateFor}
          onSave={handleQuickUpdate}
          onClose={() => setQuickUpdateFor(null)}
        />
      )}
    </div>
  );
};

export default GoalManager;
