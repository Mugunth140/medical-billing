// =====================================================
// Running Bills Page
// Create actual bills for non-stocked medicines with stock reconciliation
// =====================================================

import {
    AlertCircle,
    Check,
    Clock,
    Package,
    Plus,
    Printer,
    Search,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import { execute, query, queryOne } from '../services/database';
import { useAuthStore, useSettingsStore } from '../stores';
import type { Bill, RunningBill, StockItem } from '../types';
import { formatCurrency, formatDate } from '../utils';

// GST calculation helper
function calculateGstBreakdown(amount: number, gstRate: number, priceType: 'INCLUSIVE' | 'EXCLUSIVE' = 'INCLUSIVE') {
    let taxableAmount: number;
    let totalGst: number;

    if (priceType === 'INCLUSIVE') {
        // Price already includes GST
        taxableAmount = amount / (1 + gstRate / 100);
        totalGst = amount - taxableAmount;
    } else {
        // Price is exclusive of GST
        taxableAmount = amount;
        totalGst = amount * (gstRate / 100);
    }

    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    return {
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100,
        grandTotal: Math.round((taxableAmount + totalGst) * 100) / 100
    };
}

export function RunningBills() {
    const { showToast } = useToast();
    const { user } = useAuthStore();
    const { settings } = useSettingsStore();
    const [runningBills, setRunningBills] = useState<RunningBill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState<RunningBill | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Pagination constants
    const ITEMS_PER_PAGE = 50;

    // Form state for new running bill - can have multiple items
    const [billItems, setBillItems] = useState<Array<{
        medicine_name: string;
        quantity: number;
        unit_price: number;
        gst_rate: number;
        hsn_code: string;
        notes: string;
    }>>([{
        medicine_name: '',
        quantity: 1,
        unit_price: 0,
        gst_rate: 12,
        hsn_code: '3004',
        notes: ''
    }]);

    const [customerInfo, setCustomerInfo] = useState({
        customer_name: '',
        customer_phone: ''
    });

    // Stock linking state
    const [stockSearch, setStockSearch] = useState('');
    const [stockResults, setStockResults] = useState<StockItem[]>([]);
    const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
    const [deductFromStock, setDeductFromStock] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const bills = await query<RunningBill>(
                    `SELECT rb.*, 
                        b.bill_number, b.bill_date, b.customer_name,
                        u.full_name as user_name, 
                        su.full_name as stocked_by_name
                     FROM running_bills rb
                     JOIN bills b ON rb.bill_id = b.id
                     LEFT JOIN users u ON rb.user_id = u.id
                     LEFT JOIN users su ON rb.stocked_by = su.id
                     WHERE rb.status = 'PENDING'
                     ORDER BY b.bill_date DESC`,
                    []
                );
                setRunningBills(bills);
            } catch (error) {
                console.error('Failed to load running bills:', error);
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const loadRunningBills = async () => {
        setIsLoading(true);
        try {
            const bills = await query<RunningBill>(
                `SELECT rb.*, 
                    b.bill_number, b.bill_date, b.customer_name,
                    u.full_name as user_name, 
                    su.full_name as stocked_by_name
                 FROM running_bills rb
                 JOIN bills b ON rb.bill_id = b.id
                 LEFT JOIN users u ON rb.user_id = u.id
                 LEFT JOIN users su ON rb.stocked_by = su.id
                 WHERE rb.status = 'PENDING'
                 ORDER BY b.bill_date DESC`,
                []
            );
            setRunningBills(bills);
        } catch (error) {
            console.error('Failed to load running bills:', error);
            showToast('error', 'Failed to load running bills');
        }
        setIsLoading(false);
    };

    // Search for matching stock when linking
    const searchStock = async (searchTerm: string) => {
        if (searchTerm.length < 2) {
            setStockResults([]);
            return;
        }
        try {
            const results = await query<StockItem>(
                `SELECT 
                    m.id as medicine_id,
                    m.name as medicine_name,
                    m.generic_name,
                    m.manufacturer,
                    m.hsn_code,
                    m.gst_rate,
                    m.is_schedule,
                    b.id as batch_id,
                    b.batch_number,
                    b.expiry_date,
                    b.purchase_price,
                    b.mrp,
                    b.selling_price,
                    b.price_type,
                    b.quantity,
                    b.rack,
                    b.box,
                    b.tablets_per_strip
                 FROM medicines m
                 JOIN batches b ON m.id = b.medicine_id
                 WHERE m.is_active = 1 
                   AND b.is_active = 1
                   AND b.quantity > 0
                   AND (m.name LIKE ? OR m.generic_name LIKE ?)
                 ORDER BY m.name, b.expiry_date
                 LIMIT 20`,
                [`%${searchTerm}%`, `%${searchTerm}%`]
            );
            setStockResults(results);
        } catch (error) {
            console.error('Failed to search stock:', error);
        }
    };

    // Get next bill number
    const getNextBillNumber = async (): Promise<string> => {
        const seq = await queryOne<{
            prefix: string;
            current_number: number;
            financial_year: string;
        }>('SELECT prefix, current_number, financial_year FROM bill_sequence WHERE id = 1', []);

        if (!seq) {
            throw new Error('Bill sequence not initialized');
        }

        const nextNumber = seq.current_number + 1;
        await execute(
            'UPDATE bill_sequence SET current_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            [nextNumber]
        );

        const yearParts = seq.financial_year.split('-');
        const yearCode = yearParts.length === 2
            ? yearParts[0].slice(-2) + yearParts[1].slice(-2)
            : new Date().getFullYear().toString().slice(-2) + (new Date().getFullYear() + 1).toString().slice(-2);
        const paddedNumber = nextNumber.toString().padStart(5, '0');
        return `${seq.prefix}-${yearCode}${paddedNumber}`;
    };

    // Add new item to bill
    const addBillItem = () => {
        setBillItems([...billItems, {
            medicine_name: '',
            quantity: 1,
            unit_price: 0,
            gst_rate: 12,
            hsn_code: '3004',
            notes: ''
        }]);
    };

    // Remove item from bill
    const removeBillItem = (index: number) => {
        if (billItems.length > 1) {
            setBillItems(billItems.filter((_, i) => i !== index));
        }
    };

    // Update item in bill
    const updateBillItem = (index: number, field: string, value: string | number) => {
        const updated = [...billItems];
        updated[index] = { ...updated[index], [field]: value };
        setBillItems(updated);
    };

    // Calculate bill totals
    const calculateTotals = () => {
        let subtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalGst = 0;

        billItems.forEach(item => {
            const itemTotal = item.quantity * item.unit_price;
            const gstBreakdown = calculateGstBreakdown(itemTotal, item.gst_rate);
            subtotal += gstBreakdown.taxableAmount;
            totalCgst += gstBreakdown.cgst;
            totalSgst += gstBreakdown.sgst;
            totalGst += gstBreakdown.totalGst;
        });

        const grandTotal = subtotal + totalGst;
        const roundOff = Math.round(grandTotal) - grandTotal;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            totalCgst: Math.round(totalCgst * 100) / 100,
            totalSgst: Math.round(totalSgst * 100) / 100,
            totalGst: Math.round(totalGst * 100) / 100,
            roundOff: Math.round(roundOff * 100) / 100,
            grandTotal: Math.round(grandTotal + roundOff)
        };
    };

    // Create running bill with actual bill
    const handleCreateRunningBill = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate items
        const validItems = billItems.filter(item =>
            item.medicine_name.trim() && item.quantity > 0 && item.unit_price > 0
        );

        if (validItems.length === 0) {
            showToast('error', 'Please add at least one valid item');
            return;
        }

        try {
            const billNumber = await getNextBillNumber();
            const totals = calculateTotals();

            // 1. Create actual bill in bills table
            const billResult = await execute(
                `INSERT INTO bills (
                    bill_number, customer_name, user_id,
                    subtotal, discount_amount, discount_percent,
                    taxable_amount, cgst_amount, sgst_amount, total_gst,
                    grand_total, round_off, payment_mode,
                    cash_amount, online_amount, credit_amount, notes, total_items
                ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'CASH', ?, 0, 0, ?, ?)`,
                [
                    billNumber,
                    customerInfo.customer_name || null,
                    user?.id || 1,
                    totals.subtotal,
                    totals.subtotal,
                    totals.totalCgst,
                    totals.totalSgst,
                    totals.totalGst,
                    totals.grandTotal,
                    totals.roundOff,
                    totals.grandTotal,
                    'Running Bill - Stock pending',
                    validItems.length
                ]
            );

            const billId = billResult.lastInsertId;

            // 2. Create running bill entries for each item (no bill_items yet - will be created when stocked)
            for (const item of validItems) {
                const itemTotal = item.quantity * item.unit_price;
                const gstBreakdown = calculateGstBreakdown(itemTotal, item.gst_rate);

                // Create running bill entry to track pending stock
                await execute(
                    `INSERT INTO running_bills (
                        bill_id, medicine_name, quantity, unit_price, total_amount,
                        gst_rate, hsn_code, notes, user_id, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                    [
                        billId,
                        item.medicine_name,
                        item.quantity,
                        item.unit_price,
                        gstBreakdown.grandTotal,
                        item.gst_rate,
                        item.hsn_code,
                        item.notes || null,
                        user?.id || 1
                    ]
                );
            }

            showToast('success', `Bill ${billNumber} created successfully`);
            setShowAddModal(false);
            resetForm();
            loadRunningBills();

            // Optionally trigger print
            if (confirm(`Bill ${billNumber} created. Would you like to print it?`)) {
                handlePrintBill(billId, billNumber);
            }
        } catch (error) {
            console.error('Failed to create running bill:', error);
            showToast('error', 'Failed to create bill: ' + (error as Error).message);
        }
    };

    const resetForm = () => {
        setBillItems([{
            medicine_name: '',
            quantity: 1,
            unit_price: 0,
            gst_rate: 12,
            hsn_code: '3004',
            notes: ''
        }]);
        setCustomerInfo({ customer_name: '', customer_phone: '' });
    };

    // Print bill
    const handlePrintBill = async (billId: number, billNumber: string) => {
        try {
            // Get the bill details
            const bill = await queryOne<Bill>(
                `SELECT b.*, u.full_name as user_name 
                 FROM bills b 
                 LEFT JOIN users u ON b.user_id = u.id 
                 WHERE b.id = ?`,
                [billId]
            );

            if (!bill) {
                showToast('error', 'Bill not found');
                return;
            }

            // Get running bill items for this bill
            const runningItems = await query<RunningBill>(
                `SELECT * FROM running_bills WHERE bill_id = ? ORDER BY id`,
                [billId]
            );

            // Convert running bill items to bill item format for printing
            const items = runningItems.map(rb => ({
                medicine_name: rb.medicine_name,
                batch_number: 'PENDING',
                hsn_code: rb.hsn_code || '3004',
                expiry_date: null,
                quantity: rb.quantity,
                tablets_per_strip: 1,
                unit_price: rb.unit_price,
                selling_price: rb.unit_price,
                gst_rate: rb.gst_rate,
                discount_amount: 0,
                taxable_amount: rb.total_amount / (1 + (rb.gst_rate / 100)),
                taxable_value: rb.total_amount / (1 + (rb.gst_rate / 100)),
                cgst_amount: (rb.total_amount - rb.total_amount / (1 + (rb.gst_rate / 100))) / 2,
                cgst: (rb.total_amount - rb.total_amount / (1 + (rb.gst_rate / 100))) / 2,
                sgst_amount: (rb.total_amount - rb.total_amount / (1 + (rb.gst_rate / 100))) / 2,
                sgst: (rb.total_amount - rb.total_amount / (1 + (rb.gst_rate / 100))) / 2,
                total: rb.total_amount,
                total_amount: rb.total_amount
            }));

            // Dynamic import to avoid circular dependencies
            const { printBill } = await import('../services/print.service');
            const printerType = (settings.printer_type as 'thermal' | 'dotmatrix' | 'a4' | 'legal') || 'thermal';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await printBill(bill, items as any, { paperSize: printerType });
            showToast('success', `Opening print preview for ${billNumber}`);
        } catch (error) {
            console.error('Print failed:', error);
            showToast('warning', 'Could not open print dialog');
        }
    };

    // Open stock linking modal
    const handleOpenStockModal = (bill: RunningBill) => {
        setSelectedBill(bill);
        setStockSearch(bill.medicine_name);
        setSelectedStock(null);
        setDeductFromStock(true);
        setShowStockModal(true);
        searchStock(bill.medicine_name);
    };

    // Link running bill to stock and mark as stocked
    const handleLinkStock = async () => {
        if (!selectedBill) return;

        if (!selectedStock && deductFromStock) {
            showToast('error', 'Please select a stock item to deduct from');
            return;
        }

        try {
            let billItemId: number | null = null;

            // If deducting from stock, update batch quantity and create bill_item
            if (deductFromStock && selectedStock) {
                if (selectedStock.quantity < selectedBill.quantity) {
                    showToast('error', `Insufficient stock. Available: ${selectedStock.quantity}, Required: ${selectedBill.quantity}`);
                    return;
                }

                // Deduct from stock
                await execute(
                    `UPDATE batches SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [selectedBill.quantity, selectedStock.batch_id]
                );

                // Create the bill_item now that we have the stock
                const gstBreakdown = calculateGstBreakdown(selectedBill.total_amount, selectedBill.gst_rate);
                const billItemResult = await execute(
                    `INSERT INTO bill_items (
                        bill_id, batch_id, medicine_id, medicine_name, hsn_code,
                        batch_number, quantity, quantity_strips, quantity_pieces, tablets_per_strip,
                        unit, mrp, selling_price,
                        discount_percent, discount_amount, taxable_amount,
                        gst_rate, cgst_amount, sgst_amount, total_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'PCS', ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
                    [
                        selectedBill.bill_id,
                        selectedStock.batch_id,
                        selectedStock.medicine_id,
                        selectedBill.medicine_name,
                        selectedBill.hsn_code || '3004',
                        selectedStock.batch_number,
                        selectedBill.quantity,
                        selectedBill.quantity,
                        selectedStock.tablets_per_strip || 1,
                        selectedStock.mrp || selectedBill.unit_price,
                        selectedBill.unit_price,
                        gstBreakdown.taxableAmount,
                        selectedBill.gst_rate,
                        gstBreakdown.cgst,
                        gstBreakdown.sgst,
                        selectedBill.total_amount
                    ]
                );
                billItemId = billItemResult.lastInsertId;
            }

            // Update running bill status
            await execute(
                `UPDATE running_bills SET 
                    status = 'STOCKED',
                    bill_item_id = ?,
                    linked_batch_id = ?,
                    linked_medicine_id = ?,
                    stocked_at = CURRENT_TIMESTAMP,
                    stocked_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    billItemId,
                    selectedStock?.batch_id || null,
                    selectedStock?.medicine_id || null,
                    user?.id || 1,
                    selectedBill.id
                ]
            );

            showToast('success', `Item marked as stocked${deductFromStock ? ' and deducted from inventory' : ''}`);
            setShowStockModal(false);
            setSelectedBill(null);
            setSelectedStock(null);
            loadRunningBills();
        } catch (error) {
            console.error('Failed to link stock:', error);
            showToast('error', 'Failed to update: ' + (error as Error).message);
        }
    };

    // Cancel running bill entry (mark item as cancelled but keep the bill)
    const handleCancelEntry = async (bill: RunningBill) => {
        if (!confirm(`Cancel this running bill entry for "${bill.medicine_name}"? The bill will remain but this item won't require stock reconciliation.`)) {
            return;
        }

        try {
            await execute(
                `UPDATE running_bills SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [bill.id]
            );
            showToast('success', 'Entry cancelled');
            loadRunningBills();
        } catch (error) {
            console.error('Failed to cancel entry:', error);
            showToast('error', 'Failed to cancel entry');
        }
    };

    const totals = calculateTotals();

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Running Bills</h1>
                <p className="page-subtitle">Bills for medicines not in stock - pending stock reconciliation</p>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} />
                        New Running Bill
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
                    .running-bills-grid {
                        display: grid;
                        gap: var(--space-4);
                    }
                    
                    .running-bill-card {
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-light);
                        border-radius: var(--radius-lg);
                        padding: var(--space-4);
                        display: grid;
                        grid-template-columns: 1fr auto auto;
                        gap: var(--space-4);
                        align-items: center;
                    }
                    
                    .running-bill-card:hover {
                        border-color: var(--color-primary-300);
                        box-shadow: var(--shadow-sm);
                    }
                    
                    .rb-info {
                        min-width: 0;
                    }
                    
                    .rb-bill-number {
                        font-weight: 700;
                        font-size: var(--text-lg);
                        color: var(--color-primary-600);
                        margin-bottom: var(--space-1);
                    }
                    
                    .rb-medicine {
                        font-weight: 600;
                        margin-bottom: var(--space-1);
                    }
                    
                    .rb-meta {
                        display: flex;
                        flex-wrap: wrap;
                        gap: var(--space-3);
                        font-size: var(--text-sm);
                        color: var(--text-secondary);
                    }
                    
                    .rb-amount {
                        text-align: right;
                    }
                    
                    .rb-total {
                        font-size: var(--text-xl);
                        font-weight: 700;
                        font-family: var(--font-mono);
                        color: var(--color-primary-600);
                    }
                    
                    .rb-qty {
                        font-size: var(--text-sm);
                        color: var(--text-secondary);
                    }
                    
                    .rb-actions {
                        display: flex;
                        gap: var(--space-2);
                    }
                    
                    .stock-search-results {
                        max-height: 200px;
                        overflow-y: auto;
                        border: 1px solid var(--border-light);
                        border-radius: var(--radius-md);
                        margin-top: var(--space-2);
                    }
                    
                    .stock-item {
                        padding: var(--space-3);
                        border-bottom: 1px solid var(--border-light);
                        cursor: pointer;
                        transition: background var(--transition-fast);
                    }
                    
                    .stock-item:last-child {
                        border-bottom: none;
                    }
                    
                    .stock-item:hover {
                        background: var(--bg-tertiary);
                    }
                    
                    .stock-item.selected {
                        background: var(--color-primary-50);
                        border-left: 3px solid var(--color-primary-500);
                    }
                    
                    .stock-item-name {
                        font-weight: 500;
                    }
                    
                    .stock-item-details {
                        font-size: var(--text-sm);
                        color: var(--text-secondary);
                        display: flex;
                        gap: var(--space-3);
                        margin-top: var(--space-1);
                    }
                    
                    .bill-item-row {
                        display: grid;
                        grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
                        gap: var(--space-3);
                        align-items: end;
                        padding: var(--space-3);
                        background: var(--bg-tertiary);
                        border-radius: var(--radius-md);
                        margin-bottom: var(--space-3);
                    }
                    
                    .bill-item-row .form-group {
                        margin-bottom: 0;
                    }
                    
                    .bill-totals {
                        background: var(--bg-tertiary);
                        border-radius: var(--radius-md);
                        padding: var(--space-4);
                        margin-top: var(--space-4);
                    }
                    
                    .bill-totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: var(--space-2) 0;
                        border-bottom: 1px solid var(--border-light);
                    }
                    
                    .bill-totals-row:last-child {
                        border-bottom: none;
                        font-weight: 700;
                        font-size: var(--text-lg);
                        padding-top: var(--space-3);
                    }
                `}</style>

                {isLoading ? (
                    <div className="empty-state">
                        <div className="loading-spinner" />
                    </div>
                ) : runningBills.length > 0 ? (
                    <div className="running-bills-grid">
                        {runningBills.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((bill) => (
                            <div key={bill.id} className="running-bill-card">
                                <div className="rb-info">
                                    <div className="rb-bill-number">#{bill.bill_number}</div>
                                    <div className="rb-medicine">{bill.medicine_name}</div>
                                    <div className="rb-meta">
                                        <span><Clock size={14} /> {formatDate(bill.bill_date || bill.created_at)}</span>
                                        {bill.customer_name && <span>Customer: {bill.customer_name}</span>}
                                        <span>By: {bill.user_name}</span>
                                        <span className="badge badge-warning">Pending Stock</span>
                                    </div>
                                    {bill.notes && (
                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                                            Note: {bill.notes}
                                        </div>
                                    )}
                                </div>
                                <div className="rb-amount">
                                    <div className="rb-total">{formatCurrency(bill.total_amount)}</div>
                                    <div className="rb-qty">{bill.quantity} pcs × {formatCurrency(bill.unit_price)}</div>
                                </div>
                                <div className="rb-actions">
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handlePrintBill(bill.bill_id, bill.bill_number || '')}
                                        title="Print Receipt"
                                    >
                                        <Printer size={16} />
                                    </button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleOpenStockModal(bill)}
                                        title="Mark as Stocked"
                                    >
                                        <Check size={16} /> Stock
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleCancelEntry(bill)}
                                        title="Cancel Entry"
                                        style={{ color: 'var(--color-danger-600)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Package size={48} strokeWidth={1} />
                        <h3 className="mt-4">No pending running bills</h3>
                        <p className="text-secondary">Running bills will appear here for medicines sold without stock</p>
                    </div>
                )}

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalItems={runningBills.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Add Running Bill Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create Running Bill</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRunningBill}>
                            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
                                    <AlertCircle size={18} />
                                    <div>
                                        <strong>Running Bill:</strong> Creates an actual bill for the customer.
                                        The items will appear in this list until you mark them as "Stocked" when inventory arrives.
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Customer Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={customerInfo.customer_name}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, customer_name: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Customer Phone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            value={customerInfo.customer_phone}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, customer_phone: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                {/* Bill Items */}
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                        <label className="form-label" style={{ marginBottom: 0 }}>Bill Items</label>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={addBillItem}>
                                            <Plus size={14} /> Add Item
                                        </button>
                                    </div>

                                    {billItems.map((item, index) => (
                                        <div key={index} className="bill-item-row">
                                            <div className="form-group">
                                                <label className="form-label">Medicine Name *</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={item.medicine_name}
                                                    onChange={(e) => updateBillItem(index, 'medicine_name', e.target.value)}
                                                    placeholder="Enter medicine name"
                                                    required
                                                    autoFocus={index === 0}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Qty (pcs) *</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={item.quantity}
                                                    onChange={(e) => updateBillItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                    min={1}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">MRP/pc *</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={item.unit_price || ''}
                                                    onChange={(e) => updateBillItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    step={0.01}
                                                    min={0}
                                                    required
                                                    placeholder="incl. GST"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">GST %</label>
                                                <select
                                                    className="form-select"
                                                    value={item.gst_rate}
                                                    onChange={(e) => updateBillItem(index, 'gst_rate', parseFloat(e.target.value))}
                                                >
                                                    <option value={0}>0%</option>
                                                    <option value={5}>5%</option>
                                                    <option value={12}>12%</option>
                                                    <option value={18}>18%</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Total</label>
                                                <div style={{
                                                    padding: 'var(--space-2)',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontWeight: 600
                                                }}>
                                                    {formatCurrency(item.quantity * item.unit_price)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => removeBillItem(index)}
                                                disabled={billItems.length === 1}
                                                style={{ color: 'var(--color-danger-600)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals */}
                                <div className="bill-totals">
                                    <div className="bill-totals-row">
                                        <span>Taxable Amount</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(totals.subtotal)}</span>
                                    </div>
                                    <div className="bill-totals-row">
                                        <span>CGST</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(totals.totalCgst)}</span>
                                    </div>
                                    <div className="bill-totals-row">
                                        <span>SGST</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(totals.totalSgst)}</span>
                                    </div>
                                    <div className="bill-totals-row">
                                        <span>Round Off</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{totals.roundOff >= 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
                                    </div>
                                    <div className="bill-totals-row">
                                        <span>Grand Total</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>{formatCurrency(totals.grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Plus size={18} /> Create Bill
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Linking Modal */}
            {showStockModal && selectedBill && (
                <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Mark as Stocked</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowStockModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>Bill #{selectedBill.bill_number}</div>
                                <strong>{selectedBill.medicine_name}</strong>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                    Quantity: {selectedBill.quantity} pcs | Total: {formatCurrency(selectedBill.total_amount)}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <input
                                        type="checkbox"
                                        checked={deductFromStock}
                                        onChange={(e) => setDeductFromStock(e.target.checked)}
                                    />
                                    Deduct from stock
                                </label>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                                    If checked, the quantity will be deducted from the selected batch. Uncheck if stock was already given from existing inventory.
                                </p>
                            </div>

                            {deductFromStock && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Search Stock</label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ paddingLeft: 40 }}
                                                placeholder="Search medicine..."
                                                value={stockSearch}
                                                onChange={(e) => {
                                                    setStockSearch(e.target.value);
                                                    searchStock(e.target.value);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {stockResults.length > 0 && (
                                        <div className="stock-search-results">
                                            {stockResults.map((item) => (
                                                <div
                                                    key={item.batch_id}
                                                    className={`stock-item ${selectedStock?.batch_id === item.batch_id ? 'selected' : ''}`}
                                                    onClick={() => setSelectedStock(item)}
                                                >
                                                    <div className="stock-item-name">{item.medicine_name}</div>
                                                    <div className="stock-item-details">
                                                        <span>Batch: {item.batch_number}</span>
                                                        <span>Exp: {formatDate(item.expiry_date)}</span>
                                                        <span className="badge badge-success">Stock: {item.quantity}</span>
                                                        <span>{formatCurrency(item.selling_price)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {stockResults.length === 0 && stockSearch.length >= 2 && (
                                        <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No stock found for "{stockSearch}"
                                        </div>
                                    )}

                                    {selectedStock && (
                                        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-success-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success-200)' }}>
                                            <strong>Selected:</strong> {selectedStock.medicine_name} - {selectedStock.batch_number}
                                            <br />
                                            <span style={{ fontSize: 'var(--text-sm)' }}>
                                                Available: {selectedStock.quantity} | Will deduct: {selectedBill.quantity}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleLinkStock}
                                disabled={deductFromStock && !selectedStock}
                            >
                                <Check size={18} /> Confirm & Mark Stocked
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
