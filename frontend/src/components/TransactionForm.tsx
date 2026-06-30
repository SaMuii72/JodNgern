import React, { useState, useEffect } from 'react';
import { 
  Utensils, Car, ShoppingBag, Lightbulb, Film, HeartPulse, 
  Briefcase, Store, Coins, HelpCircle, Calendar, FileText, Plus, Check 
} from 'lucide-react';
import type { Transaction, TransactionInput } from '../types';

interface TransactionFormProps {
  onSubmit: (data: TransactionInput) => void;
  editTransaction?: Transaction | null;
  onCancelEdit?: () => void;
}

// โครงสร้างหมวดหมู่พร้อมไอคอน
export const CATEGORIES = {
  expense: [
    { name: 'อาหาร/เครื่องดื่ม', icon: Utensils, color: '#f97316', bg: '#fff7ed', id: 'Food' },
    { name: 'เดินทาง/ค่ารถ', icon: Car, color: '#3b82f6', bg: '#eff6ff', id: 'Transport' },
    { name: 'ช้อปปิ้ง', icon: ShoppingBag, color: '#ec4899', bg: '#fdf2f8', id: 'Shopping' },
    { name: 'ค่าน้ำ/ไฟ/บ้าน', icon: Lightbulb, color: '#eab308', bg: '#fefbeb', id: 'Utilities' },
    { name: 'บันเทิง/ท่องเที่ยว', icon: Film, color: '#a855f7', bg: '#faf5ff', id: 'Entertainment' },
    { name: 'สุขภาพ/การแพทย์', icon: HeartPulse, color: '#ef4444', bg: '#fef2f2', id: 'Medical' },
    { name: 'อื่น ๆ', icon: HelpCircle, color: '#64748b', bg: '#f8fafc', id: 'Others' }
  ],
  income: [
    { name: 'เงินเดือน', icon: Briefcase, color: '#10b981', bg: '#ecfdf5', id: 'Salary' },
    { name: 'ธุรกิจ/ขายของ', icon: Store, color: '#06b6d4', bg: '#ecfeff', id: 'Business' },
    { name: 'การลงทุน', icon: Coins, color: '#f59e0b', bg: '#fefbeb', id: 'Investment' },
    { name: 'อื่น ๆ', icon: HelpCircle, color: '#64748b', bg: '#f8fafc', id: 'Others' }
  ]
};

export const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onSubmit, 
  editTransaction, 
  onCancelEdit 
}) => {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');

  // โหลดข้อมูลเก่าเข้ามาเมื่อต้องการแก้ไข
  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setAmount(editTransaction.amount.toString());
      setCategory(editTransaction.category);
      setDate(editTransaction.date);
      setNote(editTransaction.note || '');
    } else {
      // รีเซ็ตฟอร์มกลับเป็นค่าเริ่มต้น
      setAmount('');
      setCategory('');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
    }
  }, [editTransaction]);

  // ตั้งค่าหมวดหมู่อัตโนมัติเมื่อประเภท รายรับ/รายจ่าย เปลี่ยนแปลง
  useEffect(() => {
    if (!editTransaction) {
      setCategory(''); // เคลียร์หมวดหมู่เดิมเมื่อผู้ใช้กดสลับระหว่าง รายรับ/รายจ่าย
    }
  }, [type, editTransaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || Number(amount) <= 0) {
      alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    
    if (!category) {
      alert('กรุณาเลือกหมวดหมู่');
      return;
    }

    onSubmit({
      amount: parseFloat(amount),
      type,
      category,
      date,
      note
    });

    // รีเซ็ตฟอร์ม
    if (!editTransaction) {
      setAmount('');
      setCategory('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  };

  const activeCategories = type === 'expense' ? CATEGORIES.expense : CATEGORIES.income;

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      {/* 1. สลับระหว่าง รายรับ กับ รายจ่าย */}
      <div className="type-toggle-group">
        <button
          type="button"
          className={`type-toggle-btn ${type === 'expense' ? 'active expense' : ''}`}
          onClick={() => setType('expense')}
        >
          รายจ่าย
        </button>
        <button
          type="button"
          className={`type-toggle-btn ${type === 'income' ? 'active income' : ''}`}
          onClick={() => setType('income')}
        >
          รายรับ
        </button>
      </div>

      {/* 2. กรอกจำนวนเงิน */}
      <div className="form-group">
        <label className="form-label">จำนวนเงิน (บาท)</label>
        <input
          type="number"
          step="any"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-field"
          required
        />
      </div>

      {/* 3. เลือกหมวดหมู่ */}
      <div className="form-group">
        <label className="form-label">เลือกหมวดหมู่</label>
        <div className="category-grid">
          {activeCategories.map((cat) => {
            const IconComponent = cat.icon;
            const isSelected = category === cat.name;
            return (
              <div
                key={cat.id}
                className={`category-item ${isSelected ? 'selected' : ''}`}
                onClick={() => setCategory(cat.name)}
                style={{
                  color: isSelected ? cat.color : '',
                  borderColor: isSelected ? cat.color : ''
                }}
              >
                <div 
                  className="category-icon-wrapper"
                  style={{ 
                    backgroundColor: isSelected ? cat.bg : '',
                    color: cat.color
                  }}
                >
                  <IconComponent size={20} />
                </div>
                <span className="category-name">{cat.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. วันที่ */}
      <div className="form-group">
        <label className="form-label">
          <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          วันที่
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-field"
          required
        />
      </div>

      {/* 5. บันทึกเพิ่มเติม */}
      <div className="form-group">
        <label className="form-label">
          <FileText size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          บันทึกย่อ (ระบุหรือไม่ก็ได้)
        </label>
        <input
          type="text"
          placeholder="คำอธิบายเพิ่มเติม..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input-field"
        />
      </div>

      {/* ปุ่มกดส่งข้อมูล */}
      <button type="submit" className="btn-primary">
        {editTransaction ? (
          <>
            <Check size={18} />
            <span>บันทึกการแก้ไข</span>
          </>
        ) : (
          <>
            <Plus size={18} />
            <span>บันทึกรายการ</span>
          </>
        )}
      </button>

      {editTransaction && onCancelEdit && (
        <button 
          type="button" 
          onClick={onCancelEdit} 
          className="btn-secondary" 
          style={{ width: '100%', marginTop: '10px' }}
        >
          ยกเลิกการแก้ไข
        </button>
      )}
    </form>
  );
};
export default TransactionForm;
