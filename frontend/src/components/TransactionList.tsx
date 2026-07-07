import React, { useState } from 'react';
import { Trash2, Edit2, Search, AlertCircle, HelpCircle } from 'lucide-react';
import type { Transaction } from '../types';
import { CATEGORIES } from './TransactionForm';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  // ฟังก์ชันช่วยหาไอคอนและสีตามชื่อหมวดหมู่
  const getCategoryMeta = (categoryName: string, type: 'income' | 'expense') => {
    const list = type === 'expense' ? CATEGORIES.expense : CATEGORIES.income;
    const found = list.find((c) => c.name === categoryName);
    if (found) return found;
    return { icon: HelpCircle, color: '#64748b', bg: '#f8fafc' };
  };

  // จัดรูปแบบส่วนหัววันที่
  const formatDateHeader = (dateStr: string) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (dateStr === todayStr) return 'วันนี้';
      if (dateStr === yesterdayStr) return 'เมื่อวานนี้';

      // ใช้ T00:00:00 เพื่อไม่ให้เขตเวลาขยับ
      const dateObj = new Date(dateStr + 'T00:00:00');
      return dateObj.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number, type: 'income' | 'expense') => {
    const formatted = new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
    return type === 'income' ? `+${formatted}` : `-${formatted}`;
  };

  // คัดกรองรายการ (Filtering)
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.note.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || t.category === categoryFilter;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  // รวบรวมทุกหมวดหมู่ที่มีในธุรกรรมปัจจุบันมาเป็นตัวเลือกการฟิลเตอร์
  const uniqueCategories = Array.from(new Set(transactions.map((t) => t.category)));

  // จัดกลุ่มข้อมูลตามวันที่
  const groupedTransactions: { [key: string]: Transaction[] } = {};
  filteredTransactions.forEach((t) => {
    if (!groupedTransactions[t.date]) {
      groupedTransactions[t.date] = [];
    }
    groupedTransactions[t.date].push(t);
  });

  // เรียงลำดับวันที่จากอนาคตลงไปอดีต
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <div className="transaction-history">
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>ประวัติการเงิน</h3>

      {/* เครื่องมือค้นหาและฟิลเตอร์ */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '10px', 
          marginBottom: '16px' 
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="ค้นหารายการ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '13px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="input-field"
            style={{ height: '40px', fontSize: '13px', padding: '0 10px' }}
          >
            <option value="all">ประเภท: ทั้งหมด</option>
            <option value="income">ประเภท: รายรับ</option>
            <option value="expense">ประเภท: รายจ่าย</option>
          </select>
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field"
            style={{ height: '40px', fontSize: '13px', padding: '0 10px' }}
          >
            <option value="">หมวดหมู่: ทั้งหมด</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* รายการธุรกรรม */}
      {sortedDates.length === 0 ? (
        <div className="card empty-state">
          <AlertCircle size={36} />
          <h4 style={{ fontWeight: 600, margin: '8px 0 4px 0' }}>ไม่พบรายการธุรกรรม</h4>
          <p>ทดลองสร้างรายการใหม่ หรือยกเลิกการกรองข้อมูล</p>
        </div>
      ) : (
        <div className="transaction-list-container">
          {sortedDates.map((dateStr) => {
            const dayItems = groupedTransactions[dateStr];

            // คำนวณยอดรวมรายวัน
            const dayIncome = dayItems
              .filter((t) => t.type === 'income')
              .reduce((sum, t) => sum + t.amount, 0);
            const dayExpense = dayItems
              .filter((t) => t.type === 'expense')
              .reduce((sum, t) => sum + t.amount, 0);
            const dayNet = dayIncome - dayExpense;

            const fmt = (n: number) =>
              new Intl.NumberFormat('th-TH', {
                style: 'currency',
                currency: 'THB',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(n);

            return (
              <div key={dateStr}>
                {/* ── วันที่ + ยอดรวมรายวัน ── */}
                <div className="date-divider">
                  <span>{formatDateHeader(dateStr)}</span>

                  <div className="daily-summary">
                    {dayIncome > 0 && (
                      <span className="daily-badge income">+{fmt(dayIncome)}</span>
                    )}
                    {dayExpense > 0 && (
                      <span className="daily-badge expense">-{fmt(dayExpense)}</span>
                    )}
                    {dayIncome > 0 && dayExpense > 0 && (
                      <span className={`daily-badge ${dayNet >= 0 ? 'net-positive' : 'net-negative'}`}>
                        สุทธิ {dayNet >= 0 ? '+' : ''}{fmt(dayNet)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dayItems.map((item) => {
                    const meta = getCategoryMeta(item.category, item.type);
                    const Icon = meta.icon;
                    return (
                      <div key={item.id} className="transaction-item">
                        <div className="transaction-left">
                          <div
                            className={`transaction-icon-box ${item.type}`}
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="transaction-info">
                            <div className="transaction-category">{item.category}</div>
                            {item.note && (
                              <div className="transaction-note" title={item.note}>
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="transaction-right">
                          <div className={`transaction-amount ${item.type === 'income' ? 'text-income' : 'text-expense'}`}>
                            {formatCurrency(item.amount, item.type)}
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => onEdit(item)}
                              className="action-btn"
                              title="แก้ไขรายการ"
                            >
                              <Edit2 size={14} style={{ color: '#64748b' }} />
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="action-btn"
                              title="ลบรายการ"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default TransactionList;
