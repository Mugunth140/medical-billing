// =====================================================
// MedBill - Dashboard Page
// Business analytics and alerts overview
// =====================================================

import {
    AlertTriangle,
    ArrowRight,
    Clock,
    CreditCard,
    IndianRupee,
    Package,
    RefreshCw,
    TrendingUp,
    Users,
    Wallet
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    getMonthlySalesSummary,
    getNewCustomersCount,
    getPaymentModeBreakdown,
    getProfitSummary,
    getSalesTrend,
    getTodaysSalesSummary,
    getTopSellingMedicines
} from '../services/billing.service';
import { query } from '../services/database';
import { getExpiringItems, getLowStockItems, getNonMovingItems } from '../services/inventory.service';
import { useAuthStore, useDashboardStore } from '../stores';
import type { StockItem } from '../types';
import { formatCurrency, formatDate } from '../utils';

const CHART_COLORS = ['#1e8eb4', '#f58700', '#10b981', '#ef4444'];

export function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';
    const { stats, isLoading, setStats, setLoading } = useDashboardStore();
    const [salesTrend, setSalesTrend] = useState<Array<{ date: string; amount: number; bills: number }>>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<Array<{ name: string; value: number }>>([]);
    const [expiringItems, setExpiringItems] = useState<StockItem[]>([]);
    const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);

    // New Analytics State
    const [profitStats, setProfitStats] = useState<{ revenue: number; profit: number; margin: number } | null>(null);
    const [newCustomers, setNewCustomers] = useState(0);
    const [topSelling, setTopSelling] = useState<Array<{ medicine_name: string; quantity_sold: number; total_revenue: number }>>([]);

    const loadDashboardData = useCallback(async () => {
        if (isLoading) return; // Prevent concurrent loads
        
        setLoading(true);
        
        try {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            // Base promises
            const promises: Promise<unknown>[] = [
                getTodaysSalesSummary(),
                getMonthlySalesSummary(today.getFullYear(), today.getMonth() + 1),
                getExpiringItems(30),
                getLowStockItems(),
                getNonMovingItems(30),
                query<{ total: number }>('SELECT COALESCE(SUM(current_balance), 0) as total FROM customers WHERE current_balance > 0', [])
            ];

            // Admin only promises
            if (isAdmin) {
                promises.push(
                    getSalesTrend(14),
                    getPaymentModeBreakdown(),
                    getProfitSummary(startOfMonth, endOfMonth),
                    getNewCustomersCount(startOfMonth, endOfMonth),
                    getTopSellingMedicines(5, 30)
                );
            }

            const results = await Promise.all(promises);

            const [
                todaySales,
                monthlySales,
                expiring,
                lowStock,
                nonMoving,
                credits
            ] = results as [
                Awaited<ReturnType<typeof getTodaysSalesSummary>>,
                Awaited<ReturnType<typeof getMonthlySalesSummary>>,
                StockItem[],
                StockItem[],
                StockItem[],
                { total: number }[]
            ];

            setStats({
                todaySales: {
                    total_bills: todaySales.totalBills,
                    total_amount: todaySales.totalAmount,
                    cash_amount: todaySales.cashAmount,
                    online_amount: todaySales.onlineAmount,
                    credit_amount: todaySales.creditAmount,
                    total_gst: todaySales.totalGst
                },
                monthlySales: monthlySales.totalAmount,
                pendingCredits: credits[0]?.total ?? 0,
                expiringMedicines: expiring.length,
                nonMovingItems: nonMoving.length,
                lowStockItems: lowStock.length
            });

            setExpiringItems(expiring.slice(0, 5));
            setLowStockItems(lowStock.slice(0, 5));

            if (isAdmin && results.length > 6) {
                const trend = results[6] as Array<{ date: string; amount: number; bills: number }>;
                const payments = results[7] as Array<{ mode: string; amount: number }>;
                const profit = results[8] as { revenue: number; profit: number; margin: number };
                const newCust = results[9] as number;
                const top = results[10] as Array<{ medicine_name: string; quantity_sold: number; total_revenue: number }>;

                setSalesTrend(trend ?? []);
                setPaymentBreakdown(
                    (payments ?? []).map((p) => ({
                        name: p.mode,
                        value: p.amount
                    }))
                );
                setProfitStats(profit ?? null);
                setNewCustomers(newCust ?? 0);
                setTopSelling(top ?? []);
            }

        } catch (error) {
            console.error('Failed to load dashboard:', error);
            // Error is logged but we continue to show partial data
        }
        setLoading(false);
    }, [isAdmin, isLoading, setLoading, setStats]);

    useEffect(() => {
        loadDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]); // Only reload when admin status changes

    const today = new Date();
    const formattedDate = formatDate(today, 'EEEE, dd MMMM yyyy');

    return (
        <>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="text-secondary text-sm">{formattedDate}</p>
                </div>
                <div className="page-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={loadDashboardData}
                        disabled={isLoading}
                    >
                        <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/billing')}
                    >
                        New Bill
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: var(--space-5);
            margin-bottom: var(--space-6);
          }
          
          .stat-card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            border: 1px solid var(--border-light);
            transition: all var(--transition-fast);
          }
          
          .stat-card:hover {
            box-shadow: var(--shadow-md);
          }
          
          .stat-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: var(--space-3);
          }
          
          .stat-icon {
            width: 44px;
            height: 44px;
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .stat-icon.blue { background: var(--color-primary-100); color: var(--color-primary-600); }
          .stat-icon.green { background: var(--color-success-100); color: var(--color-success-600); }
          .stat-icon.orange { background: var(--color-warning-100); color: var(--color-warning-600); }
          .stat-icon.red { background: var(--color-danger-100); color: var(--color-danger-600); }
          .stat-icon.purple { background: #f3e8ff; color: #9333ea; }
          .stat-icon.teal { background: #ccfbf1; color: #0d9488; }
          
          .stat-value {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            color: var(--text-primary);
            margin-bottom: var(--space-1);
          }
          
          .stat-label {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 4px;
          }
          
          .charts-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: var(--space-6);
            margin-bottom: var(--space-6);
          }
          
          .chart-card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            border: 1px solid var(--border-light);
            padding: var(--space-5);
        }
          
          .chart-title {
            font-size: var(--text-lg);
            font-weight: var(--font-semibold);
            margin-bottom: var(--space-4);
          }
          
          .alerts-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-6);
          }
          
          .alert-card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            border: 1px solid var(--border-light);
            display: flex;
            flex-direction: column;
          }
          
          .alert-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-4) var(--space-5);
            border-bottom: 1px solid var(--border-light);
          }
          
          .alert-card-title {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-weight: var(--font-semibold);
          }
          
          .alert-list {
            max-height: 280px;
            overflow-y: auto;
            flex: 1;
          }
          
          .alert-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-3) var(--space-5);
            border-bottom: 1px solid var(--border-light);
          }
          
          .alert-item:last-child {
            border-bottom: none;
          }
          
          .alert-item-name {
            font-weight: var(--font-medium);
            margin-bottom: 2px;
          }
          
          .alert-item-meta {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }
          
          .view-all-btn {
            display: flex;
            align-items: center;
            gap: var(--space-1);
            font-size: var(--text-sm);
            color: var(--color-primary-600);
            cursor: pointer;
          }
          
          .view-all-btn:hover {
            text-decoration: underline;
          }
          
          .spinning {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .empty-chart {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--text-tertiary);
          }

          .top-selling-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .top-selling-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--border-light);
          }

          .top-selling-item:last-child {
            border-bottom: none;
          }

          .progress-bar-bg {
            width: 100px;
            height: 6px;
            background: var(--bg-tertiary);
            border-radius: 3px;
            overflow: hidden;
          }

          .progress-bar-fill {
            height: 100%;
            background: var(--color-primary-500);
            border-radius: 3px;
          }
          
          @media (max-width: 1200px) {
            .charts-grid {
              grid-template-columns: 1fr;
            }
            .alerts-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

                {/* Stats Grid */}
                <div className="dashboard-grid">
                    {isAdmin && (
                        <>
                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon blue">
                                        <IndianRupee size={22} />
                                    </div>
                                </div>
                                <div className="stat-value">{formatCurrency(stats?.todaySales?.total_amount ?? 0)}</div>
                                <div className="stat-label">Today's Sales ({stats?.todaySales?.total_bills ?? 0} bills)</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon green">
                                        <TrendingUp size={22} />
                                    </div>
                                </div>
                                <div className="stat-value">{formatCurrency(stats?.monthlySales ?? 0)}</div>
                                <div className="stat-label">This Month's Sales</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon purple">
                                        <Wallet size={22} />
                                    </div>
                                </div>
                                <div className="stat-value">{formatCurrency(profitStats?.profit ?? 0)}</div>
                                <div className="stat-label">
                                    Monthly Profit
                                    <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 10 }}>
                                        {profitStats?.margin.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon teal">
                                        <Users size={22} />
                                    </div>
                                </div>
                                <div className="stat-value">{newCustomers}</div>
                                <div className="stat-label">New Customers (This Month)</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon orange">
                                        <CreditCard size={22} />
                                    </div>
                                </div>
                                <div className="stat-value">{formatCurrency(stats?.pendingCredits ?? 0)}</div>
                                <div className="stat-label">Pending Credits</div>
                            </div>
                        </>
                    )}

                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-icon red">
                                <AlertTriangle size={22} />
                            </div>
                        </div>
                        <div className="stat-value">{stats?.expiringMedicines ?? 0}</div>
                        <div className="stat-label">Expiring in 30 Days</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-icon orange">
                                <Package size={22} />
                            </div>
                        </div>
                        <div className="stat-value">{stats?.lowStockItems ?? 0}</div>
                        <div className="stat-label">Low Stock Items</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-icon blue">
                                <Clock size={22} />
                            </div>
                        </div>
                        <div className="stat-value">{stats?.nonMovingItems ?? 0}</div>
                        <div className="stat-label">Non-Moving (30 days)</div>
                    </div>
                </div>

                {/* Charts - Admin Only */}
                {isAdmin && (
                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3 className="chart-title">Sales Trend (Last 14 Days)</h3>
                            {salesTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={salesTrend}>
                                        <defs>
                                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#1e8eb4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#1e8eb4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => formatDate(val, 'dd/MM')}
                                            stroke="#94a3b8"
                                            fontSize={12}
                                        />
                                        <YAxis
                                            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`}
                                            stroke="#94a3b8"
                                            fontSize={12}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => [formatCurrency(value), 'Sales']}
                                            labelFormatter={(label) => formatDate(label, 'dd MMM yyyy')}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="amount"
                                            stroke="#1e8eb4"
                                            strokeWidth={2}
                                            fill="url(#colorAmount)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-chart">No sales data available</div>
                            )}
                        </div>

                        <div className="chart-card">
                            <h3 className="chart-title">Payment Mode Split</h3>
                            {paymentBreakdown.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={paymentBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {paymentBreakdown.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-chart">No payment data available</div>
                            )}
                            <div className="flex justify-center gap-4 mt-2">
                                {paymentBreakdown.map((item, index) => (
                                    <div key={item.name} className="flex items-center gap-2 text-sm">
                                        <div
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                background: CHART_COLORS[index % CHART_COLORS.length]
                                            }}
                                        />
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Alerts & Top Selling */}
                <div className="alerts-grid">
                    {isAdmin && (
                        <div className="alert-card">
                            <div className="alert-card-header">
                                <div className="alert-card-title" style={{ color: 'var(--color-primary-600)' }}>
                                    <TrendingUp size={18} />
                                    Top Selling Medicines
                                </div>
                                <span className="view-all-btn">
                                    Last 30 Days
                                </span>
                            </div>
                            <div className="alert-list">
                                {topSelling.length > 0 ? (
                                    topSelling.map((item, index) => (
                                        <div key={item.medicine_name} className="alert-item">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                                <div style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    background: 'var(--bg-tertiary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 12,
                                                    fontWeight: 'bold',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="alert-item-name">{item.medicine_name}</div>
                                                    <div className="alert-item-meta">
                                                        {item.quantity_sold} units sold
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                    {formatCurrency(item.total_revenue)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                        <p className="text-tertiary">No sales data</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="alert-card">
                        <div className="alert-card-header">
                            <div className="alert-card-title" style={{ color: 'var(--color-danger-600)' }}>
                                <AlertTriangle size={18} />
                                Expiring Soon
                            </div>
                            <span
                                className="view-all-btn"
                                onClick={() => navigate('/inventory?filter=expiring')}
                            >
                                View All <ArrowRight size={14} />
                            </span>
                        </div>
                        <div className="alert-list">
                            {expiringItems.length > 0 ? (
                                expiringItems.map((item) => (
                                    <div key={item.batch_id} className="alert-item">
                                        <div>
                                            <div className="alert-item-name">{item.medicine_name}</div>
                                            <div className="alert-item-meta">
                                                Batch: {item.batch_number} | Qty: {item.quantity}
                                            </div>
                                        </div>
                                        <div className="badge badge-danger">
                                            {item.days_to_expiry <= 0
                                                ? 'Expired'
                                                : `${Math.ceil(item.days_to_expiry)} days`}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <p className="text-tertiary">No expiring items</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="alert-card">
                        <div className="alert-card-header">
                            <div className="alert-card-title" style={{ color: 'var(--color-warning-600)' }}>
                                <Package size={18} />
                                Low Stock
                            </div>
                            <span
                                className="view-all-btn"
                                onClick={() => navigate('/inventory?filter=low-stock')}
                            >
                                View All <ArrowRight size={14} />
                            </span>
                        </div>
                        <div className="alert-list">
                            {lowStockItems.length > 0 ? (
                                lowStockItems.map((item) => (
                                    <div key={item.batch_id} className="alert-item">
                                        <div>
                                            <div className="alert-item-name">{item.medicine_name}</div>
                                            <div className="alert-item-meta">
                                                Batch: {item.batch_number}
                                            </div>
                                        </div>
                                        <div className="badge badge-warning">
                                            {item.quantity} {item.unit}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                    <p className="text-tertiary">All items in stock</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
