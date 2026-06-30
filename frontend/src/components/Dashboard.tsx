import React from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import type { Transaction } from '../types';

interface DashboardProps {
  transactions: Transaction[];
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const { income, expense, balance } = transactions.reduce(
    (acc, transaction) => {
      const amount = Number(transaction.amount);
      if (transaction.type === 'income') {
        acc.income += amount;
        acc.balance += amount;
      } else {
        acc.expense += amount;
        acc.balance -= amount;
      }
      return acc;
    },
    { income: 0, expense: 0, balance: 0 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="dashboard-grid">
      {/* ยอดเงินคงเหลือรวม */}
      <div className="card balance-card total">
        <div className="card-title">
          <Wallet size={18} />
          <span>ยอดคงเหลือรวม</span>
        </div>
        <div className="card-amount">{formatCurrency(balance)}</div>
        <div className="card-subtitle" style={{ color: 'rgba(255,255,255,0.7)' }}>
          จากรายการทั้งหมดที่เลือก
        </div>
      </div>

      {/* รายรับรวม */}
      <div className="card balance-card">
        <div className="card-title">
          <TrendingUp size={18} className="text-income" />
          <span>รายรับทั้งหมด</span>
        </div>
        <div className="card-amount text-income">{formatCurrency(income)}</div>
        <div className="card-subtitle">
          เงินไหลเข้าทั้งหมด
        </div>
      </div>

      {/* รายจ่ายรวม */}
      <div className="card balance-card">
        <div className="card-title">
          <TrendingDown size={18} className="text-expense" />
          <span>รายจ่ายทั้งหมด</span>
        </div>
        <div className="card-amount text-expense">{formatCurrency(expense)}</div>
        <div className="card-subtitle">
          เงินไหลออกทั้งหมด
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
