import React, { useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import type { Transaction } from '../types';
import { CATEGORIES } from './TransactionForm';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsChartsProps {
  transactions: Transaction[];
}

type PeriodType = 'week' | 'month' | 'year';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ transactions }) => {
  const [period, setPeriod] = useState<PeriodType>('month');

  const now = new Date();

  const getFilteredTransactions = () =>
    transactions.filter((t) => {
      const tDate = new Date(t.date + 'T00:00:00');
      if (period === 'week') {
        const start = new Date();
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return tDate >= start && tDate <= now;
      } else if (period === 'month') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      } else {
        return tDate.getFullYear() === now.getFullYear();
      }
    });

  const activeTransactions = getFilteredTransactions();

  // ─── Doughnut ────────────────────────────────────────────────────────────
  const expenseTransactions = activeTransactions.filter((t) => t.type === 'expense');
  const categoryTotals: Record<string, number> = {};
  expenseTransactions.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
  });

  const getCategoryColor = (name: string) => {
    const found = CATEGORIES.expense.find((c) => c.name === name);
    return found ? found.color : '#64748b';
  };

  const categoryNames = Object.keys(categoryTotals);
  const categoryValues = Object.values(categoryTotals);
  const doughnutColors = categoryNames.map(getCategoryColor);
  const totalExpense = categoryValues.reduce((s, v) => s + v, 0);

  const doughnutData = {
    labels: categoryNames,
    datasets: [{
      data: categoryValues,
      backgroundColor: doughnutColors.length > 0 ? doughnutColors : ['#e2e8f0'],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, // ← hidden, we render our own legend
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    cutout: '65%',
  };

  // ─── Bar ─────────────────────────────────────────────────────────────────
  let barLabels: string[] = [];
  let incomeData: number[] = [];
  let expenseDataArr: number[] = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      barLabels.push(d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }));
      const dayTrans = activeTransactions.filter((t) => t.date === dStr);
      incomeData.push(dayTrans.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0));
      expenseDataArr.push(dayTrans.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0));
    }
  } else if (period === 'month') {
    barLabels = ['สัปดาห์ 1', 'สัปดาห์ 2', 'สัปดาห์ 3', 'สัปดาห์ 4', 'สัปดาห์ 5'];
    incomeData = [0, 0, 0, 0, 0];
    expenseDataArr = [0, 0, 0, 0, 0];
    activeTransactions.forEach((t) => {
      const day = new Date(t.date + 'T00:00:00').getDate();
      const idx = Math.min(Math.floor((day - 1) / 7), 4);
      if (t.type === 'income') incomeData[idx] += Number(t.amount);
      else expenseDataArr[idx] += Number(t.amount);
    });
  } else {
    barLabels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    incomeData = Array(12).fill(0);
    expenseDataArr = Array(12).fill(0);
    activeTransactions.forEach((t) => {
      const idx = new Date(t.date + 'T00:00:00').getMonth();
      if (t.type === 'income') incomeData[idx] += Number(t.amount);
      else expenseDataArr[idx] += Number(t.amount);
    });
  }

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'รายรับ',
        data: incomeData,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'รายจ่าย',
        data: expenseDataArr,
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 10, boxHeight: 10, font: { size: 12 }, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          callback: (value: any) => value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value,
        },
      },
    },
  };

  return (
    <div className="card charts-section">
      {/* Header row */}
      <div className="charts-header">
        <h3 style={{ fontSize: '17px', fontWeight: 700 }}>กราฟวิเคราะห์ข้อมูล</h3>
        <div className="tab-group">
          {(['week', 'month', 'year'] as PeriodType[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`tab-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? '7 วัน' : p === 'month' ? 'เดือนนี้' : 'ปีนี้'}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column chart layout */}
      <div className="charts-wrapper">
        {/* ── Bar chart ── */}
        <div className="chart-pane">
          <p className="chart-pane-label">แนวโน้ม รายรับ - รายจ่าย</p>
          <div className="chart-container bar-chart">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>

        {/* ── Doughnut chart + custom legend ── */}
        <div className="chart-pane doughnut-wrapper">
          <p className="chart-pane-label">สัดส่วนค่าใช้จ่ายตามหมวดหมู่</p>

          {expenseTransactions.length === 0 ? (
            <div className="chart-container donut-chart">
              <div className="empty-chart">ไม่มีข้อมูลรายจ่ายในช่วงเวลานี้</div>
            </div>
          ) : (
            <>
              <div className="chart-container donut-chart">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>

              {/* Custom legend — rendered as HTML, always fits */}
              <div className="donut-legend">
                {categoryNames.map((name, i) => {
                  const pct = totalExpense > 0 ? ((categoryValues[i] / totalExpense) * 100).toFixed(0) : 0;
                  return (
                    <div key={name} className="donut-legend-item">
                      <div className="donut-legend-left">
                        <div className="donut-legend-dot" style={{ backgroundColor: doughnutColors[i] }} />
                        <span className="donut-legend-name">{name}</span>
                      </div>
                      <span className="donut-legend-amount">
                        {formatCurrency(categoryValues[i])}
                        <span className="donut-legend-pct">{pct}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
