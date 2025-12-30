// =====================================================
// MedBill - Reports Page
// Business Reports and Analytics
// =====================================================

import {
    Calendar,
    Download,
    Filter,
    IndianRupee,
    Package,
    Printer,
    TrendingUp,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { getBills, getPaymentModeBreakdown, getSalesTrend, getTopSellingMedicines } from '../services/billing.service';
import { query } from '../services/database';
import { getExpiringItems, getStockValue } from '../services/inventory.service';
import { formatCurrency, formatDate, toISODate } from '../utils';

type ReportType = 'sales' | 'gst' | 'inventory' | 'expiry' | 'credit';

interface ReportData {
    sales: any;
    gst: any;
    inventory: any;
    expiry: any;
    credit: any;
}

export function Reports() {
    const [activeReport, setActiveReport] = useState<ReportType>('sales');
    const [dateRange, setDateRange] = useState({
        start: toISODate(new Date(new Date().setDate(1))), // First of month
        end: toISODate(new Date())
    });
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<Partial<ReportData>>({});

    const loadReport = async () => {
        setIsLoading(true);
        try {
            switch (activeReport) {
                case 'sales': {
                    const [bills, trend, topMeds, payments] = await Promise.all([
                        getBills({ startDate: dateRange.start, endDate: dateRange.end }),
                        getSalesTrend(30),
                        getTopSellingMedicines(10, 30),
                        getPaymentModeBreakdown(dateRange.start, dateRange.end)
                    ]);

                    const totalSales = bills.reduce((sum, b) => sum + b.grand_total, 0);
                    const totalGst = bills.reduce((sum, b) => sum + b.total_gst, 0);

                    setReportData({
                        ...reportData,
                        sales: {
                            bills,
                            trend,
                            topMeds,
                            payments,
                            summary: {
                                totalBills: bills.length,
                                totalSales,
                                totalGst,
                                avgBillValue: bills.length > 0 ? totalSales / bills.length : 0
                            }
                        }
                    });
                    break;
                }
                case 'gst': {
                    const gstData = await query<any>(
                        `SELECT 
              bi.gst_rate,
              SUM(bi.taxable_value) as taxable_value,
              SUM(bi.cgst) as cgst,
              SUM(bi.sgst) as sgst,
              SUM(bi.total_gst) as total_gst
            FROM bill_items bi
            JOIN bills b ON bi.bill_id = b.id
            WHERE date(b.bill_date) BETWEEN ? AND ?
              AND b.status = 'COMPLETED'
            GROUP BY bi.gst_rate
            ORDER BY bi.gst_rate`,
                        [dateRange.start, dateRange.end]
                    );

                    setReportData({
                        ...reportData,
                        gst: {
                            breakdown: gstData,
                            total: gstData.reduce((sum: number, g: any) => sum + g.total_gst, 0)
                        }
                    });
                    break;
                }
                case 'inventory': {
                    const stockValue = await getStockValue();
                    setReportData({
                        ...reportData,
                        inventory: stockValue
                    });
                    break;
                }
                case 'expiry': {
                    const expiring = await getExpiringItems(30);
                    const expired = expiring.filter(i => i.days_to_expiry <= 0);
                    const expiringSoon = expiring.filter(i => i.days_to_expiry > 0);

                    setReportData({
                        ...reportData,
                        expiry: {
                            expired,
                            expiringSoon,
                            totalValue: expiring.reduce((sum, i) => sum + i.selling_price * i.quantity, 0)
                        }
                    });
                    break;
                }
                case 'credit': {
                    const credits = await query<any>(
                        `SELECT 
              c.id,
              c.name,
              c.phone,
              c.current_balance,
              c.credit_limit,
              (SELECT MAX(created_at) FROM credits WHERE customer_id = c.id) as last_transaction
            FROM customers c
            WHERE c.current_balance > 0
            ORDER BY c.current_balance DESC`,
                        []
                    );

                    setReportData({
                        ...reportData,
                        credit: {
                            customers: credits,
                            total: credits.reduce((sum: number, c: any) => sum + c.current_balance, 0)
                        }
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Failed to load report:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadReport();
    }, [activeReport, dateRange]);

    const handlePrint = () => {
        window.print();
    };

    const reportTabs = [
        { id: 'sales', label: 'Sales Report', icon: TrendingUp },
        { id: 'gst', label: 'GST Report', icon: IndianRupee },
        { id: 'inventory', label: 'Stock Value', icon: Package },
        { id: 'expiry', label: 'Expiry Report', icon: Calendar },
        { id: 'credit', label: 'Credit Report', icon: Users },
    ] as const;

    return (
        <>
            <header className="page-header no-print">
                <h1 className="page-title">Reports</h1>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={handlePrint}>
                        <Printer size={18} />
                        Print
                    </button>
                    <button className="btn btn-primary">
                        <Download size={18} />
                        Export PDF
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .reports-layout {
            display: grid;
            grid-template-columns: 240px 1fr;
            gap: var(--space-6);
          }
          
          .reports-sidebar {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
          }
          
          .report-tabs {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            margin-bottom: var(--space-5);
          }
          
          .report-tab {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
            font-weight: var(--font-medium);
          }
          
          .report-tab:hover {
            background: var(--bg-tertiary);
          }
          
          .report-tab.active {
            background: var(--color-primary-600);
            color: var(--text-inverse);
          }
          
          .date-filters {
            border-top: 1px solid var(--border-light);
            padding-top: var(--space-4);
          }
          
          .date-filters-title {
            font-size: var(--text-sm);
            font-weight: var(--font-semibold);
            color: var(--text-secondary);
            margin-bottom: var(--space-3);
          }
          
          .report-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-6);
          }
          
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--space-6);
            padding-bottom: var(--space-4);
            border-bottom: 1px solid var(--border-light);
          }
          
          .report-title {
            font-size: var(--text-xl);
            font-weight: var(--font-semibold);
          }
          
          .report-period {
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
          
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          }
          
          .summary-card {
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            text-align: center;
          }
          
          .summary-value {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            color: var(--color-primary-600);
          }
          
          .summary-label {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            margin-top: var(--space-1);
          }
          
          .report-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .report-table th,
          .report-table td {
            padding: var(--space-3) var(--space-4);
            text-align: left;
            border-bottom: 1px solid var(--border-light);
          }
          
          .report-table th {
            font-weight: var(--font-semibold);
            background: var(--bg-tertiary);
            color: var(--text-secondary);
          }
          
          .report-table .numeric {
            text-align: right;
            font-family: var(--font-mono);
          }
          
          .chart-container {
            height: 300px;
            margin-bottom: var(--space-6);
          }
          
          @media print {
            .reports-sidebar {
              display: none;
            }
            
            .reports-layout {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

                <div className="reports-layout">
                    {/* Sidebar */}
                    <div className="reports-sidebar no-print">
                        <div className="report-tabs">
                            {reportTabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <div
                                        key={tab.id}
                                        className={`report-tab ${activeReport === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveReport(tab.id)}
                                    >
                                        <Icon size={18} />
                                        {tab.label}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="date-filters">
                            <div className="date-filters-title">
                                <Filter size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                Date Range
                            </div>
                            <div className="form-group">
                                <label className="form-label">From</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">To</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="report-content">
                        {isLoading ? (
                            <div className="empty-state">
                                <div className="loading-spinner" />
                            </div>
                        ) : (
                            <>
                                {/* Sales Report */}
                                {activeReport === 'sales' && reportData.sales && (
                                    <>
                                        <div className="report-header">
                                            <div>
                                                <h2 className="report-title">Sales Report</h2>
                                                <p className="report-period">
                                                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="summary-cards">
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.sales.summary.totalBills}</div>
                                                <div className="summary-label">Total Bills</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.totalSales)}</div>
                                                <div className="summary-label">Total Sales</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.totalGst)}</div>
                                                <div className="summary-label">Total GST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.sales.summary.avgBillValue)}</div>
                                                <div className="summary-label">Avg Bill Value</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">Sales Trend</h3>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={reportData.sales.trend}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" tickFormatter={(val) => formatDate(val, 'dd/MM')} />
                                                    <YAxis tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}K`} />
                                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                                    <Bar dataKey="amount" fill="#1e8eb4" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <h3 className="font-semibold mb-4">Top Selling Medicines</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Medicine</th>
                                                    <th className="numeric">Qty Sold</th>
                                                    <th className="numeric">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.sales.topMeds.map((med: any, i: number) => (
                                                    <tr key={med.medicine_id}>
                                                        <td>{i + 1}</td>
                                                        <td>{med.medicine_name}</td>
                                                        <td className="numeric">{med.quantity_sold}</td>
                                                        <td className="numeric">{formatCurrency(med.total_revenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {/* GST Report */}
                                {activeReport === 'gst' && reportData.gst && (
                                    <>
                                        <div className="report-header">
                                            <div>
                                                <h2 className="report-title">GST Report</h2>
                                                <p className="report-period">
                                                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total / 2)}</div>
                                                <div className="summary-label">Total CGST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total / 2)}</div>
                                                <div className="summary-label">Total SGST</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.gst.total)}</div>
                                                <div className="summary-label">Total GST</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">GST Breakup by Rate</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>GST Rate</th>
                                                    <th className="numeric">Taxable Value</th>
                                                    <th className="numeric">CGST</th>
                                                    <th className="numeric">SGST</th>
                                                    <th className="numeric">Total GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.gst.breakdown.map((g: any) => (
                                                    <tr key={g.gst_rate}>
                                                        <td>{g.gst_rate}%</td>
                                                        <td className="numeric">{formatCurrency(g.taxable_value)}</td>
                                                        <td className="numeric">{formatCurrency(g.cgst)}</td>
                                                        <td className="numeric">{formatCurrency(g.sgst)}</td>
                                                        <td className="numeric">{formatCurrency(g.total_gst)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ fontWeight: 'bold', background: 'var(--bg-tertiary)' }}>
                                                    <td>Total</td>
                                                    <td className="numeric">
                                                        {formatCurrency(reportData.gst.breakdown.reduce((s: number, g: any) => s + g.taxable_value, 0))}
                                                    </td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total / 2)}</td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total / 2)}</td>
                                                    <td className="numeric">{formatCurrency(reportData.gst.total)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                )}

                                {/* Inventory Report */}
                                {activeReport === 'inventory' && reportData.inventory && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Stock Valuation Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.inventory.totalItems}</div>
                                                <div className="summary-label">Total Items</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.inventory.totalPurchaseValue)}</div>
                                                <div className="summary-label">Purchase Value</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.inventory.totalSaleValue)}</div>
                                                <div className="summary-label">Sale Value</div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Expiry Report */}
                                {activeReport === 'expiry' && reportData.expiry && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Expiry Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value text-danger">{reportData.expiry.expired.length}</div>
                                                <div className="summary-label">Expired Items</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value text-warning">{reportData.expiry.expiringSoon.length}</div>
                                                <div className="summary-label">Expiring in 30 Days</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value">{formatCurrency(reportData.expiry.totalValue)}</div>
                                                <div className="summary-label">Total Value at Risk</div>
                                            </div>
                                        </div>

                                        {reportData.expiry.expired.length > 0 && (
                                            <>
                                                <h3 className="font-semibold mb-4 text-danger">Expired Items</h3>
                                                <table className="report-table mb-6">
                                                    <thead>
                                                        <tr>
                                                            <th>Medicine</th>
                                                            <th>Batch</th>
                                                            <th>Expiry</th>
                                                            <th className="numeric">Qty</th>
                                                            <th className="numeric">Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {reportData.expiry.expired.map((item: any) => (
                                                            <tr key={item.batch_id}>
                                                                <td>{item.medicine_name}</td>
                                                                <td>{item.batch_number}</td>
                                                                <td className="text-danger">{formatDate(item.expiry_date)}</td>
                                                                <td className="numeric">{item.quantity}</td>
                                                                <td className="numeric">{formatCurrency(item.selling_price * item.quantity)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Credit Report */}
                                {activeReport === 'credit' && reportData.credit && (
                                    <>
                                        <div className="report-header">
                                            <h2 className="report-title">Credit (Udhar) Report</h2>
                                        </div>

                                        <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                            <div className="summary-card">
                                                <div className="summary-value">{reportData.credit.customers.length}</div>
                                                <div className="summary-label">Customers with Credit</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-value text-danger">{formatCurrency(reportData.credit.total)}</div>
                                                <div className="summary-label">Total Outstanding</div>
                                            </div>
                                        </div>

                                        <h3 className="font-semibold mb-4">Outstanding Credits</h3>
                                        <table className="report-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th>Phone</th>
                                                    <th className="numeric">Credit Limit</th>
                                                    <th className="numeric">Outstanding</th>
                                                    <th>Last Transaction</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.credit.customers.map((c: any) => (
                                                    <tr key={c.id}>
                                                        <td>{c.name}</td>
                                                        <td>{c.phone || '-'}</td>
                                                        <td className="numeric">{formatCurrency(c.credit_limit)}</td>
                                                        <td className="numeric text-danger font-semibold">{formatCurrency(c.current_balance)}</td>
                                                        <td>{c.last_transaction ? formatDate(c.last_transaction) : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ fontWeight: 'bold', background: 'var(--bg-tertiary)' }}>
                                                    <td colSpan={3}>Total</td>
                                                    <td className="numeric text-danger">{formatCurrency(reportData.credit.total)}</td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
