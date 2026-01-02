// =====================================================
// Bill History Page
// View and manage past bills
// =====================================================

import { Calendar, Eye, Printer, Search, X, Pill } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { query } from '../services/database';
import { formatCurrency } from '../services/gst.service';
import { printBill } from '../services/print.service';
import type { Bill, BillItem, ScheduledMedicineRecord } from '../types';
import { formatDate } from '../utils';

interface BillWithItems extends Bill {
    items?: BillItem[];
}

type ViewMode = 'all' | 'schedule';

export function BillHistory() {
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [bills, setBills] = useState<Bill[]>([]);
    const [scheduleRecords, setScheduleRecords] = useState<ScheduledMedicineRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedBill, setSelectedBill] = useState<BillWithItems | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<ScheduledMedicineRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Pagination constants
    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        if (viewMode === 'all') {
            loadBills();
        } else {
            loadScheduleRecords();
        }
    }, [viewMode]);

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

            sql += ` ORDER BY b.bill_date DESC`;

            const result = await query<Bill>(sql, params);
            setBills(result);
            setCurrentPage(1); // Reset to first page on new search
        } catch (err) {
            console.error('Failed to load bills:', err);
        }
        setLoading(false);
    };

    const loadScheduleRecords = async () => {
        setLoading(true);
        try {
            let sql = `
                SELECT 
                    smr.*,
                    m.name as medicine_name,
                    b.batch_number,
                    bills.bill_number,
                    bills.bill_date,
                    bills.customer_name,
                    bills.grand_total
                FROM scheduled_medicine_records smr
                JOIN medicines m ON smr.medicine_id = m.id
                JOIN batches b ON smr.batch_id = b.id
                JOIN bills ON smr.bill_id = bills.id
                WHERE 1=1
            `;
            const params: (string | number)[] = [];

            if (searchQuery) {
                sql += ` AND (bills.bill_number LIKE ? OR smr.patient_name LIKE ? OR smr.doctor_name LIKE ? OR m.name LIKE ?)`;
                params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
            }
            if (dateFrom) {
                sql += ` AND DATE(smr.created_at) >= ?`;
                params.push(dateFrom);
            }
            if (dateTo) {
                sql += ` AND DATE(smr.created_at) <= ?`;
                params.push(dateTo);
            }

            sql += ` ORDER BY smr.created_at DESC`;

            const result = await query<ScheduledMedicineRecord>(sql, params);
            setScheduleRecords(result);
            setCurrentPage(1); // Reset to first page on new search
        } catch (err) {
            console.error('Failed to load schedule records:', err);
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
        if (viewMode === 'all') {
            loadBills();
        } else {
            loadScheduleRecords();
        }
    };

    const handleViewRecord = async (record: ScheduledMedicineRecord) => {
        try {
            const bill = await query<Bill>(
                `SELECT * FROM bills WHERE id = ?`,
                [record.bill_id]
            );
            if (bill.length > 0) {
                const items = await query<BillItem>(
                    `SELECT * FROM bill_items WHERE bill_id = ?`,
                    [record.bill_id]
                );
                setSelectedBill({ ...bill[0], items });
            }
            setSelectedRecord(record);
        } catch (err) {
            console.error('Failed to load record details:', err);
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Bill History</h1>
                <div className="page-actions">
                    <span className="text-sm text-secondary">
                        {viewMode === 'all' ? `${bills.length} bills found` : `${scheduleRecords.length} records found`}
                    </span>
                </div>
            </header>

            <div className="page-body">
                <style>{`
                    .history-tabs {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 20px;
                        border-bottom: 2px solid var(--border-light);
                    }
                    
                    .history-tab {
                        padding: 12px 24px;
                        background: transparent;
                        border: none;
                        border-bottom: 2px solid transparent;
                        cursor: pointer;
                        font-weight: 500;
                        color: var(--text-secondary);
                        transition: all 0.2s;
                        margin-bottom: -2px;
                    }
                    
                    .history-tab:hover {
                        color: var(--color-primary-600);
                    }
                    
                    .history-tab.active {
                        color: var(--color-primary-600);
                        border-bottom-color: var(--color-primary-600);
                    }
                    
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

                {/* Tabs */}
                <div className="history-tabs">
                    <button
                        className={`history-tab ${viewMode === 'all' ? 'active' : ''}`}
                        onClick={() => setViewMode('all')}
                    >
                        <Eye size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        All Bills
                    </button>
                    <button
                        className={`history-tab ${viewMode === 'schedule' ? 'active' : ''}`}
                        onClick={() => setViewMode('schedule')}
                    >
                        <Pill size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Schedule Drug Bills
                    </button>
                </div>

                {/* Filters */}
                <div className="history-filters">
                    <div className="history-search">
                        <Search className="history-search-icon" size={18} />
                        <input
                            type="text"
                            placeholder={viewMode === 'all' ? "Search by bill number or customer..." : "Search by bill number, patient, doctor, or medicine..."}
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

                {/* Bills Table or Schedule Records Table */}
                {viewMode === 'all' ? (
                    <>
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
                                bills.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(bill => (
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

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalItems={bills.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                        />
                    </>
                ) : (
                    <>
                        <div className="bills-table">
                            <div className="bills-header" style={{ gridTemplateColumns: '120px 2fr 120px 100px 80px 100px 100px 100px 60px' }}>
                                <span>Bill No.</span>
                                <span>Medicine</span>
                                <span>Patient</span>
                                <span>Age/Gender</span>
                                <span>Phone</span>
                                <span>Doctor</span>
                                <span>Reg. No.</span>
                                <span>Qty</span>
                                <span></span>
                            </div>

                            {loading ? (
                                <div className="empty-history">Loading...</div>
                            ) : scheduleRecords.length === 0 ? (
                                <div className="empty-history">No schedule drug records found</div>
                            ) : (
                                scheduleRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(record => (
                                    <div key={record.id} className="bill-row" style={{ gridTemplateColumns: '120px 2fr 120px 100px 80px 100px 100px 100px 60px' }}>
                                        <div>
                                            <div className="bill-number" style={{ fontSize: 12 }}>{record.bill_number}</div>
                                            <div className="bill-date">{formatDate(record.bill_date || record.created_at)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{record.medicine_name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{record.batch_number}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{record.patient_name}</div>
                                            {record.patient_address && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{record.patient_address}</div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12 }}>
                                            {record.patient_age !== undefined ? `${record.patient_age}Y` : '-'} / {record.patient_gender || '-'}
                                        </div>
                                        <div style={{ fontSize: 12 }}>{record.patient_phone || '-'}</div>
                                        <div>
                                            <div style={{ fontSize: 12 }}>{record.doctor_name || '-'}</div>
                                            {record.clinic_hospital_name && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{record.clinic_hospital_name}</div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11 }}>{record.doctor_registration_number || '-'}</div>
                                        <div style={{ textAlign: 'center', fontWeight: 600 }}>{record.quantity}</div>
                                        <button className="view-btn" onClick={() => handleViewRecord(record)}>
                                            <Eye size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalItems={scheduleRecords.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}
            </div>

            {/* Bill Detail Modal */}
            {selectedBill && !selectedRecord && (
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
                                    {selectedBill.doctor_name && (
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                            Dr. {selectedBill.doctor_name}
                                        </div>
                                    )}
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
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    if (selectedBill?.items) {
                                        printBill(selectedBill, selectedBill.items, { paperSize: 'thermal' });
                                    }
                                }}
                            >
                                <Printer size={16} /> Print Receipt
                            </button>
                            <button className="btn btn-primary" onClick={() => {
                                setSelectedBill(null);
                            }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Drug Record Detail Modal */}
            {selectedRecord && (
                <div className="modal-overlay" onClick={() => { setSelectedRecord(null); setSelectedBill(null); }}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Schedule Drug Record Details</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedRecord(null); setSelectedBill(null); }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body bill-modal-body">
                            <div className="bill-detail-header">
                                <div>
                                    <div className="bill-detail-number">{selectedRecord.bill_number}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {formatDate(selectedRecord.bill_date || selectedRecord.created_at)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className="badge badge-warning">Schedule H/H1</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: 'var(--color-primary-600)' }}>Medicine Information</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Medicine Name</div>
                                        <div style={{ fontWeight: 500 }}>{selectedRecord.medicine_name}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Batch Number</div>
                                        <div style={{ fontFamily: 'var(--font-mono)' }}>{selectedRecord.batch_number}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Quantity</div>
                                        <div style={{ fontWeight: 600 }}>{selectedRecord.quantity} units</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: 'var(--color-primary-600)' }}>Patient Information</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Patient Name</div>
                                        <div style={{ fontWeight: 500 }}>{selectedRecord.patient_name}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Age</div>
                                        <div>{selectedRecord.patient_age !== undefined ? `${selectedRecord.patient_age} years` : '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Gender</div>
                                        <div>{selectedRecord.patient_gender || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Phone</div>
                                        <div>{selectedRecord.patient_phone || '-'}</div>
                                    </div>
                                    {selectedRecord.patient_address && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Address</div>
                                            <div>{selectedRecord.patient_address}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: 'var(--color-primary-600)' }}>Doctor Information</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Doctor Name</div>
                                        <div style={{ fontWeight: 500 }}>{selectedRecord.doctor_name || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Registration Number</div>
                                        <div>{selectedRecord.doctor_registration_number || '-'}</div>
                                    </div>
                                    {selectedRecord.clinic_hospital_name && (
                                        <div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Clinic/Hospital</div>
                                            <div>{selectedRecord.clinic_hospital_name}</div>
                                        </div>
                                    )}
                                    {selectedRecord.prescription_number && (
                                        <div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Prescription Number</div>
                                            <div style={{ fontFamily: 'var(--font-mono)' }}>{selectedRecord.prescription_number}</div>
                                        </div>
                                    )}
                                    {selectedRecord.prescription_date && (
                                        <div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>Prescription Date</div>
                                            <div>{formatDate(selectedRecord.prescription_date)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedRecord.doctor_prescription && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: 'var(--color-primary-600)' }}>Doctor's Prescription</div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                        {selectedRecord.doctor_prescription}
                                    </div>
                                </div>
                            )}

                            {selectedBill && (
                                <div className="bill-summary" style={{ marginTop: 24 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: 'var(--color-primary-600)' }}>Bill Summary</div>
                                    <div className="summary-row">
                                        <span>Bill Total</span>
                                        <span>{formatCurrency(selectedBill.grand_total)}</span>
                                    </div>
                                    <div className="summary-row">
                                        <span>Payment Mode</span>
                                        <span>{selectedBill.payment_mode}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {selectedBill && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        if (selectedBill?.items) {
                                            printBill(selectedBill, selectedBill.items, { paperSize: 'thermal' });
                                        }
                                    }}
                                >
                                    <Printer size={16} /> Print Bill
                                </button>
                            )}
                            <button className="btn btn-primary" onClick={() => { setSelectedRecord(null); setSelectedBill(null); }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
