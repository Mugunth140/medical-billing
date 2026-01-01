// =====================================================
// Bill History Page
// View and manage past bills
// =====================================================

import { Calendar, Eye, Printer, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { query } from '../services/database';
import { formatCurrency } from '../services/gst.service';
import type { Bill, BillItem } from '../types';
import { formatDate } from '../utils';

interface BillWithItems extends Bill {
    items?: BillItem[];
}

export function BillHistory() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedBill, setSelectedBill] = useState<BillWithItems | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBills();
    }, []);

    const loadBills = async () => {
        setLoading(true);
        try {
            let sql = `
                SELECT b.*, u.full_name as user_name, c.name as customer_display_name
                FROM bills b
                LEFT JOIN users u ON b.user_id = u.id
                LEFT JOIN customers c ON b.customer_id = c.id
                WHERE 1=1
            `;
            const params: (string | number)[] = [];

            if (searchQuery) {
                sql += ` AND (b.bill_number LIKE ? OR b.customer_name LIKE ? OR c.name LIKE ?)`;
                params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
            }
            if (dateFrom) {
                sql += ` AND DATE(b.bill_date) >= ?`;
                params.push(dateFrom);
            }
            if (dateTo) {
                sql += ` AND DATE(b.bill_date) <= ?`;
                params.push(dateTo);
            }

            sql += ` ORDER BY b.bill_date DESC LIMIT 100`;

            const result = await query<Bill>(sql, params);
            setBills(result);
        } catch (err) {
            console.error('Failed to load bills:', err);
        }
        setLoading(false);
    };

    const handleViewBill = async (bill: Bill) => {
        try {
            const items = await query<BillItem>(
                `SELECT * FROM bill_items WHERE bill_id = ?`,
                [bill.id]
            );
            setSelectedBill({ ...bill, items });
        } catch (err) {
            console.error('Failed to load bill items:', err);
        }
    };

    const handleSearch = () => {
        loadBills();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Bill History</h1>
                <div className="page-actions">
                    <span className="text-sm text-secondary">
                        Showing last 100 bills
                    </span>
                </div>
            </header>

            <div className="page-body">
                <style>{`
                    .history-filters {
                        display: flex;
                        gap: 12px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                    }
                    
                    .history-search {
                        flex: 1;
                        min-width: 200px;
                        position: relative;
                    }
                    
                    .history-search input {
                        width: 100%;
                        padding: 10px 12px 10px 40px;
                        border: 1px solid var(--border-light);
                        border-radius: 8px;
                    }
                    
                    .history-search-icon {
                        position: absolute;
                        left: 12px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: var(--text-tertiary);
                    }
                    
                    .history-date {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .history-date input {
                        padding: 10px 12px;
                        border: 1px solid var(--border-light);
                        border-radius: 8px;
                    }
                    
                    .bills-table {
                        background: var(--bg-secondary);
                        border-radius: 12px;
                        border: 1px solid var(--border-light);
                        overflow: hidden;
                    }
                    
                    .bills-header {
                        display: grid;
                        grid-template-columns: 140px 2fr 100px 100px 80px 60px;
                        gap: 12px;
                        padding: 12px 16px;
                        background: var(--bg-tertiary);
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: var(--text-secondary);
                    }
                    
                    .bill-row {
                        display: grid;
                        grid-template-columns: 140px 2fr 100px 100px 80px 60px;
                        gap: 12px;
                        padding: 12px 16px;
                        border-bottom: 1px solid var(--border-light);
                        align-items: center;
                        font-size: 13px;
                    }
                    
                    .bill-row:hover {
                        background: var(--bg-tertiary);
                    }
                    
                    .bill-number {
                        font-weight: 600;
                        font-family: var(--font-mono);
                        color: var(--color-primary-600);
                    }
                    
                    .bill-date {
                        font-size: 11px;
                        color: var(--text-tertiary);
                    }
                    
                    .view-btn {
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid var(--border-light);
                        border-radius: 6px;
                        background: var(--bg-secondary);
                        cursor: pointer;
                        color: var(--text-secondary);
                        transition: all 0.15s;
                    }
                    
                    .view-btn:hover {
                        background: var(--color-primary-50);
                        color: var(--color-primary-600);
                        border-color: var(--color-primary-300);
                    }
                    
                    .bill-modal-body {
                        max-height: 60vh;
                        overflow-y: auto;
                    }
                    
                    .bill-detail-header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--border-light);
                    }
                    
                    .bill-detail-number {
                        font-size: 20px;
                        font-weight: 700;
                        font-family: var(--font-mono);
                        color: var(--color-primary-600);
                    }
                    
                    .bill-items-list {
                        margin-bottom: 20px;
                    }
                    
                    .bill-item-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        border-bottom: 1px solid var(--border-light);
                        font-size: 13px;
                    }
                    
                    .bill-summary {
                        background: var(--bg-tertiary);
                        padding: 16px;
                        border-radius: 8px;
                    }
                    
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 0;
                        font-size: 13px;
                    }
                    
                    .summary-row.total {
                        font-size: 16px;
                        font-weight: 700;
                        border-top: 1px solid var(--border-medium);
                        padding-top: 12px;
                        margin-top: 8px;
                    }
                    
                    .empty-history {
                        text-align: center;
                        padding: 60px 20px;
                        color: var(--text-tertiary);
                    }
                `}</style>

                {/* Filters */}
                <div className="history-filters">
                    <div className="history-search">
                        <Search className="history-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by bill number or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div className="history-date">
                        <Calendar size={18} style={{ color: 'var(--text-tertiary)' }} />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSearch}>
                        <Search size={16} /> Search
                    </button>
                </div>

                {/* Bills Table */}
                <div className="bills-table">
                    <div className="bills-header">
                        <span>Bill No.</span>
                        <span>Customer</span>
                        <span style={{ textAlign: 'right' }}>Amount</span>
                        <span style={{ textAlign: 'center' }}>Payment</span>
                        <span style={{ textAlign: 'center' }}>Items</span>
                        <span></span>
                    </div>

                    {loading ? (
                        <div className="empty-history">Loading...</div>
                    ) : bills.length === 0 ? (
                        <div className="empty-history">No bills found</div>
                    ) : (
                        bills.map(bill => (
                            <div key={bill.id} className="bill-row">
                                <div>
                                    <div className="bill-number">{bill.bill_number}</div>
                                    <div className="bill-date">{formatDate(bill.bill_date)}</div>
                                </div>
                                <div>{bill.customer_name || 'Walk-in Customer'}</div>
                                <div style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                    {formatCurrency(bill.grand_total)}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <span className={`badge badge-${bill.payment_mode === 'CREDIT' ? 'warning' : 'success'}`}>
                                        {bill.payment_mode}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'center' }}>{bill.total_items}</div>
                                <button className="view-btn" onClick={() => handleViewBill(bill)}>
                                    <Eye size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Bill Detail Modal */}
            {selectedBill && (
                <div className="modal-overlay" onClick={() => setSelectedBill(null)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Bill Details</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBill(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body bill-modal-body">
                            <div className="bill-detail-header">
                                <div>
                                    <div className="bill-detail-number">{selectedBill.bill_number}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {formatDate(selectedBill.bill_date)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {selectedBill.customer_name || 'Walk-in Customer'}
                                    </div>
                                    <div>
                                        <span className={`badge badge-${selectedBill.payment_mode === 'CREDIT' ? 'warning' : 'success'}`}>
                                            {selectedBill.payment_mode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bill-items-list">
                                <div style={{ fontWeight: 600, marginBottom: 10 }}>Items</div>
                                {selectedBill.items?.map((item, idx) => (
                                    <div key={idx} className="bill-item-row">
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{item.medicine_name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                {item.batch_number} • {item.quantity_strips || 0}S + {item.quantity_pieces || 0}pcs
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                            {formatCurrency(item.total_amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bill-summary">
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(selectedBill.subtotal)}</span>
                                </div>
                                {selectedBill.discount_amount > 0 && (
                                    <div className="summary-row" style={{ color: 'var(--color-success-600)' }}>
                                        <span>Discount</span>
                                        <span>-{formatCurrency(selectedBill.discount_amount)}</span>
                                    </div>
                                )}
                                <div className="summary-row">
                                    <span>GST ({selectedBill.cgst_amount > 0 ? 'CGST + SGST' : 'Included'})</span>
                                    <span>{formatCurrency(selectedBill.cgst_amount + selectedBill.sgst_amount)}</span>
                                </div>
                                <div className="summary-row total">
                                    <span>Total</span>
                                    <span>{formatCurrency(selectedBill.grand_total)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={handlePrint}>
                                <Printer size={16} /> Print
                            </button>
                            <button className="btn btn-primary" onClick={() => setSelectedBill(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
