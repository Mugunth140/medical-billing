// =====================================================
// Returns Management Page
// Sales Returns (Customer → Pharmacy) and Supplier Returns (Pharmacy → Supplier)
// =====================================================

import {
    ArrowLeftRight,
    Building2,
    Calendar,
    FileText,
    Plus,
    RotateCcw,
    Search,
    User,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import { useAuthStore } from '../stores';
import type { Bill, BillItem, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils';

type TabType = 'sales' | 'supplier';

// Sales return types
interface SalesReturnRecord {
    id: number;
    return_number: string;
    return_date: string;
    bill_id: number;
    bill_number: string;
    customer_name?: string;
    reason?: string;
    refund_mode?: string;
    total_amount: number;
    total_gst: number;
    status: string;
    notes?: string;
    user_name?: string;
}

// Supplier return types
interface SupplierReturnRecord {
    id: number;
    return_number: string;
    return_date: string;
    purchase_id?: number;
    supplier_id: number;
    supplier_name: string;
    reason?: string;
    total_amount: number;
    total_gst: number;
    status: string;
    notes?: string;
    user_name?: string;
}

// Batch with medicine info for returns
interface ReturnableBatch {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    tablets_per_strip: number;
    mrp: number;
    selling_price: number;
    medicine_id: number;
    medicine_name: string;
    gst_rate: number;
}

export function Returns() {
    const { showToast } = useToast();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>(
        (searchParams.get('tab') as TabType) || 'sales'
    );
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Update URL when tab changes
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams({ tab });
        setCurrentPage(1);
    };

    // Sync with URL params
    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabType;
        if (tabParam && (tabParam === 'sales' || tabParam === 'supplier')) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Sales returns state
    const [salesReturns, setSalesReturns] = useState<SalesReturnRecord[]>([]);
    const [showSalesReturnModal, setShowSalesReturnModal] = useState(false);
    const [billSearch, setBillSearch] = useState('');
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
    const [billItems, setBillItems] = useState<BillItem[]>([]);
    const [returnItems, setReturnItems] = useState<{ item: BillItem; quantity: number }[]>([]);
    const [salesReturnReason, setSalesReturnReason] = useState('');
    const [salesRefundMode, setSalesRefundMode] = useState<'CASH' | 'CREDIT_NOTE' | 'ADJUSTMENT'>('CASH');

    // Supplier returns state
    const [supplierReturns, setSupplierReturns] = useState<SupplierReturnRecord[]>([]);
    const [showSupplierReturnModal, setShowSupplierReturnModal] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [supplierBatches, setSupplierBatches] = useState<ReturnableBatch[]>([]);
    const [supplierReturnItems, setSupplierReturnItems] = useState<{ batch: ReturnableBatch; quantity: number }[]>([]);
    const [supplierReturnReason, setSupplierReturnReason] = useState<'EXPIRY' | 'DAMAGE' | 'OVERSTOCK' | 'OTHER'>('EXPIRY');
    const [supplierReturnNotes, setSupplierReturnNotes] = useState('');

    // Pagination
    const ITEMS_PER_PAGE = 50;

    const loadSalesReturns = async () => {
        try {
            const data = await query<SalesReturnRecord>(
                `SELECT sr.*, b.bill_number, b.customer_name, u.full_name as user_name
                 FROM sales_returns sr
                 LEFT JOIN bills b ON sr.bill_id = b.id
                 LEFT JOIN users u ON sr.user_id = u.id
                 ORDER BY sr.return_date DESC`,
                []
            );
            setSalesReturns(data);
        } catch (error) {
            console.error('Failed to load sales returns:', error);
            setSalesReturns([]);
        }
    };

    const loadSupplierReturns = async () => {
        try {
            const data = await query<SupplierReturnRecord>(
                `SELECT pr.*, s.name as supplier_name, u.full_name as user_name
                 FROM purchase_returns pr
                 LEFT JOIN suppliers s ON pr.supplier_id = s.id
                 LEFT JOIN users u ON pr.user_id = u.id
                 ORDER BY pr.return_date DESC`,
                []
            );
            setSupplierReturns(data);
        } catch (error) {
            console.error('Failed to load supplier returns:', error);
            setSupplierReturns([]);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await query<Supplier>(
                'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name',
                []
            );
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to load suppliers:', error);
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        await Promise.all([
            loadSalesReturns(),
            loadSupplierReturns(),
            loadSuppliers()
        ]);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Search bill by number for sales return
    const searchBill = async () => {
        if (!billSearch.trim()) return;

        try {
            const bills = await query<Bill>(
                `SELECT * FROM bills WHERE bill_number LIKE ? AND is_cancelled = 0 ORDER BY bill_date DESC LIMIT 1`,
                [`%${billSearch}%`]
            );

            if (bills.length === 0) {
                showToast('error', 'Bill not found');
                return;
            }

            setSelectedBill(bills[0]);

            // Load bill items
            const items = await query<BillItem>(
                `SELECT * FROM bill_items WHERE bill_id = ?`,
                [bills[0].id]
            );
            setBillItems(items);
            setReturnItems([]);
        } catch (error) {
            console.error('Failed to search bill:', error);
            showToast('error', 'Failed to search bill');
        }
    };

    // Load batches for selected supplier
    const loadSupplierBatches = async (supplierId: number) => {
        try {
            const batches = await query<ReturnableBatch>(
                `SELECT 
                    b.id as batch_id,
                    b.batch_number,
                    b.expiry_date,
                    b.quantity,
                    b.tablets_per_strip,
                    b.mrp,
                    b.selling_price,
                    m.id as medicine_id,
                    m.name as medicine_name,
                    m.gst_rate
                FROM batches b
                JOIN medicines m ON b.medicine_id = m.id
                LEFT JOIN purchases p ON b.purchase_id = p.id
                WHERE b.is_active = 1 
                AND b.quantity > 0
                AND (b.supplier_id = ? OR p.supplier_id = ?)
                ORDER BY m.name, b.batch_number`,
                [supplierId, supplierId]
            );
            setSupplierBatches(batches);
        } catch (error) {
            console.error('Failed to load supplier batches:', error);
            setSupplierBatches([]);
        }
    };

    useEffect(() => {
        if (selectedSupplier) {
            loadSupplierBatches(selectedSupplier.id);
            setSupplierReturnItems([]);
        }
    }, [selectedSupplier]);

    // Add item to sales return
    const addReturnItem = (item: BillItem) => {
        if (returnItems.find(ri => ri.item.id === item.id)) {
            showToast('warning', 'Item already added');
            return;
        }
        setReturnItems([...returnItems, { item, quantity: item.quantity }]);
    };

    // Remove item from sales return
    const removeReturnItem = (itemId: number) => {
        setReturnItems(returnItems.filter(ri => ri.item.id !== itemId));
    };

    // Update return quantity
    const updateReturnQuantity = (itemId: number, quantity: number) => {
        setReturnItems(returnItems.map(ri =>
            ri.item.id === itemId ? { ...ri, quantity: Math.min(quantity, ri.item.quantity) } : ri
        ));
    };

    // Add batch to supplier return
    const addSupplierReturnItem = (batch: ReturnableBatch) => {
        if (supplierReturnItems.find(sri => sri.batch.batch_id === batch.batch_id)) {
            showToast('warning', 'Batch already added');
            return;
        }
        setSupplierReturnItems([...supplierReturnItems, { batch, quantity: batch.quantity }]);
    };

    // Remove batch from supplier return
    const removeSupplierReturnItem = (batchId: number) => {
        setSupplierReturnItems(supplierReturnItems.filter(sri => sri.batch.batch_id !== batchId));
    };

    // Update supplier return quantity
    const updateSupplierReturnQuantity = (batchId: number, quantity: number) => {
        setSupplierReturnItems(supplierReturnItems.map(sri =>
            sri.batch.batch_id === batchId ? { ...sri, quantity: Math.min(quantity, sri.batch.quantity) } : sri
        ));
    };

    // Generate return number
    const generateReturnNumber = (prefix: string) => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}${year}${month}${random}`;
    };

    // Process sales return
    const processSalesReturn = async () => {
        if (!selectedBill || returnItems.length === 0) {
            showToast('error', 'Please select items to return');
            return;
        }

        try {
            // Calculate totals
            let totalAmount = 0;
            let totalGst = 0;

            for (const ri of returnItems) {
                // Calculate refund: selling_price is per strip, quantity is in tablets
                const tabletsPerStrip = ri.item.tablets_per_strip || 10;
                const stripPrice = ri.item.selling_price ?? ri.item.mrp ?? 0;
                const pricePerTablet = stripPrice / tabletsPerStrip;
                const gstRate = ri.item.gst_rate ?? 0;

                // Amount = price per tablet × number of tablets returned
                const amount = pricePerTablet * ri.quantity;
                const gst = gstRate > 0 ? (amount * gstRate) / (100 + gstRate) : 0;
                totalAmount += amount;
                totalGst += gst;
            }

            const returnNumber = generateReturnNumber('SR');

            // Insert sales return
            const result = await execute(
                `INSERT INTO sales_returns (return_number, bill_id, customer_id, reason, refund_mode, total_amount, total_gst, status, notes, user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
                [
                    returnNumber,
                    selectedBill.id,
                    selectedBill.customer_id || null,
                    salesReturnReason || null,
                    salesRefundMode,
                    totalAmount,
                    totalGst,
                    null,
                    user?.id || 1
                ]
            );

            const returnId = result.lastInsertId;

            // Insert return items and restore stock
            for (const ri of returnItems) {
                // Calculate refund: selling_price is per strip, quantity is in tablets
                const tabletsPerStrip = ri.item.tablets_per_strip || 10;
                const stripPrice = ri.item.selling_price ?? ri.item.mrp ?? 0;
                const pricePerTablet = stripPrice / tabletsPerStrip;
                const gstRate = ri.item.gst_rate ?? 0;

                // Amount = price per tablet × number of tablets returned
                const amount = pricePerTablet * ri.quantity;
                const gst = gstRate > 0 ? (amount * gstRate) / (100 + gstRate) : 0;
                const cgst = gst / 2;
                const sgst = gst / 2;

                // Insert return item (store price per tablet for consistency)
                await execute(
                    `INSERT INTO sales_return_items (return_id, bill_item_id, batch_id, quantity, unit_price, gst_rate, cgst, sgst, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [returnId, ri.item.id, ri.item.batch_id, ri.quantity, pricePerTablet, gstRate, cgst, sgst, amount]
                );

                // Restore stock to batch
                await execute(
                    `UPDATE batches SET quantity = quantity + ? WHERE id = ?`,
                    [ri.quantity, ri.item.batch_id]
                );
            }

            showToast('success', `Sales return ${returnNumber} processed successfully`);
            setShowSalesReturnModal(false);
            resetSalesReturnForm();
            loadSalesReturns();
        } catch (error) {
            console.error('Failed to process sales return:', error);
            showToast('error', 'Failed to process return');
        }
    };

    // Process supplier return
    const processSupplierReturn = async () => {
        if (!selectedSupplier || supplierReturnItems.length === 0) {
            showToast('error', 'Please select batches to return');
            return;
        }

        try {
            // Calculate totals
            let totalAmount = 0;
            let totalGst = 0;

            for (const sri of supplierReturnItems) {
                const unitPrice = sri.batch.mrp;
                const gstRate = sri.batch.gst_rate;
                const amount = unitPrice * sri.quantity;
                const gst = (amount * gstRate) / (100 + gstRate);
                totalAmount += amount;
                totalGst += gst;
            }

            const returnNumber = generateReturnNumber('PR');

            // Insert supplier return
            const result = await execute(
                `INSERT INTO purchase_returns (return_number, supplier_id, reason, total_amount, total_gst, status, notes, user_id)
                 VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
                [
                    returnNumber,
                    selectedSupplier.id,
                    supplierReturnReason,
                    totalAmount,
                    totalGst,
                    supplierReturnNotes || null,
                    user?.id || 1
                ]
            );

            const returnId = result.lastInsertId;

            // Insert return items and reduce stock
            for (const sri of supplierReturnItems) {
                const unitPrice = sri.batch.mrp;
                const gstRate = sri.batch.gst_rate;
                const amount = unitPrice * sri.quantity;
                const gst = (amount * gstRate) / (100 + gstRate);
                const cgst = gst / 2;
                const sgst = gst / 2;

                // Insert return item
                await execute(
                    `INSERT INTO purchase_return_items (return_id, batch_id, medicine_id, quantity, unit_price, gst_rate, cgst, sgst, total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [returnId, sri.batch.batch_id, sri.batch.medicine_id, sri.quantity, unitPrice, gstRate, cgst, sgst, amount]
                );

                // Reduce stock from batch
                await execute(
                    `UPDATE batches SET quantity = quantity - ? WHERE id = ?`,
                    [sri.quantity, sri.batch.batch_id]
                );
            }

            showToast('success', `Supplier return ${returnNumber} created successfully`);
            setShowSupplierReturnModal(false);
            resetSupplierReturnForm();
            loadSupplierReturns();
        } catch (error) {
            console.error('Failed to process supplier return:', error);
            showToast('error', 'Failed to process return');
        }
    };

    const resetSalesReturnForm = () => {
        setBillSearch('');
        setSelectedBill(null);
        setBillItems([]);
        setReturnItems([]);
        setSalesReturnReason('');
        setSalesRefundMode('CASH');
    };

    const resetSupplierReturnForm = () => {
        setSelectedSupplier(null);
        setSupplierBatches([]);
        setSupplierReturnItems([]);
        setSupplierReturnReason('EXPIRY');
        setSupplierReturnNotes('');
    };

    // Paginate returns
    const currentReturns = activeTab === 'sales' ? salesReturns : supplierReturns;
    const paginatedReturns = currentReturns.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page on tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return 'badge-success';
            case 'APPROVED':
                return 'badge-info';
            case 'PENDING':
                return 'badge-warning';
            default:
                return 'badge-secondary';
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Returns Management</h1>
                <div className="page-actions">
                    {activeTab === 'sales' ? (
                        <button className="btn btn-primary" onClick={() => setShowSalesReturnModal(true)}>
                            <Plus size={18} />
                            New Sales Return
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={() => setShowSupplierReturnModal(true)}>
                            <Plus size={18} />
                            New Supplier Return
                        </button>
                    )}
                </div>
            </header>

            <div className="page-body">
                <style>{`
                    .tabs {
                        display: flex;
                        gap: var(--space-1);
                        margin-bottom: var(--space-5);
                        border-bottom: 1px solid var(--border-light);
                    }
                    
                    .tab {
                        display: flex;
                        align-items: center;
                        gap: var(--space-2);
                        padding: var(--space-3) var(--space-5);
                        font-weight: var(--font-medium);
                        color: var(--text-secondary);
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        transition: all var(--transition-fast);
                    }
                    
                    .tab:hover {
                        color: var(--text-primary);
                    }
                    
                    .tab.active {
                        color: var(--color-primary-600);
                        border-bottom-color: var(--color-primary-600);
                    }
                    
                    .returns-grid {
                        display: grid;
                        gap: var(--space-3);
                    }
                    
                    .return-card {
                        display: grid;
                        grid-template-columns: 1fr auto;
                        gap: var(--space-4);
                        align-items: center;
                        padding: var(--space-4);
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-light);
                        border-radius: var(--radius-lg);
                    }
                    
                    .return-card:hover {
                        border-color: var(--color-primary-200);
                    }
                    
                    .return-info {
                        display: flex;
                        flex-direction: column;
                        gap: var(--space-2);
                    }
                    
                    .return-header {
                        display: flex;
                        align-items: center;
                        gap: var(--space-3);
                    }
                    
                    .return-number {
                        font-weight: var(--font-semibold);
                        font-family: var(--font-mono);
                    }
                    
                    .return-meta {
                        display: flex;
                        gap: var(--space-4);
                        font-size: var(--text-sm);
                        color: var(--text-secondary);
                    }
                    
                    .return-meta-item {
                        display: flex;
                        align-items: center;
                        gap: var(--space-1);
                    }
                    
                    .return-amount {
                        text-align: right;
                    }
                    
                    .return-total {
                        font-size: var(--text-lg);
                        font-weight: var(--font-bold);
                        font-family: var(--font-mono);
                    }
                    
                    .item-select-grid {
                        display: grid;
                        gap: var(--space-2);
                        max-height: 300px;
                        overflow-y: auto;
                    }
                    
                    .item-row {
                        display: grid;
                        grid-template-columns: 1fr 80px 80px 60px;
                        gap: var(--space-3);
                        align-items: center;
                        padding: var(--space-2) var(--space-3);
                        background: var(--bg-tertiary);
                        border-radius: var(--radius-sm);
                    }
                    
                    .selected-items {
                        margin-top: var(--space-4);
                        padding: var(--space-4);
                        background: var(--color-success-50);
                        border: 1px solid var(--color-success-200);
                        border-radius: var(--radius-md);
                    }
                    
                    .selected-item-row {
                        display: grid;
                        grid-template-columns: 1fr 100px 60px;
                        gap: var(--space-3);
                        align-items: center;
                        padding: var(--space-2) 0;
                        border-bottom: 1px solid var(--color-success-200);
                    }
                    
                    .selected-item-row:last-child {
                        border-bottom: none;
                    }
                `}</style>

                {/* Tabs */}
                <div className="tabs">
                    <div
                        className={`tab ${activeTab === 'sales' ? 'active' : ''}`}
                        onClick={() => handleTabChange('sales')}
                    >
                        <User size={18} />
                        Sales Returns
                    </div>
                    <div
                        className={`tab ${activeTab === 'supplier' ? 'active' : ''}`}
                        onClick={() => handleTabChange('supplier')}
                    >
                        <Building2 size={18} />
                        Supplier Returns
                    </div>
                </div>

                {/* Returns List */}
                <div className="returns-grid">
                    {isLoading ? (
                        <div className="empty-state">
                            <div className="loading-spinner" />
                        </div>
                    ) : paginatedReturns.length > 0 ? (
                        activeTab === 'sales' ? (
                            (paginatedReturns as SalesReturnRecord[]).map(ret => (
                                <div key={ret.id} className="return-card">
                                    <div className="return-info">
                                        <div className="return-header">
                                            <span className="return-number">{ret.return_number}</span>
                                            <span className={`badge ${getStatusBadge(ret.status)}`}>
                                                {ret.status}
                                            </span>
                                        </div>
                                        <div className="return-meta">
                                            <span className="return-meta-item">
                                                <Calendar size={14} />
                                                {formatDate(ret.return_date)}
                                            </span>
                                            <span className="return-meta-item">
                                                <FileText size={14} />
                                                Bill: {ret.bill_number}
                                            </span>
                                            {ret.customer_name && (
                                                <span className="return-meta-item">
                                                    <User size={14} />
                                                    {ret.customer_name}
                                                </span>
                                            )}
                                            {ret.refund_mode && (
                                                <span className="return-meta-item">
                                                    <ArrowLeftRight size={14} />
                                                    {ret.refund_mode}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="return-amount">
                                        <div className="return-total">{formatCurrency(ret.total_amount)}</div>
                                        <div className="text-xs text-secondary">
                                            GST: {formatCurrency(ret.total_gst)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            (paginatedReturns as SupplierReturnRecord[]).map(ret => (
                                <div key={ret.id} className="return-card">
                                    <div className="return-info">
                                        <div className="return-header">
                                            <span className="return-number">{ret.return_number}</span>
                                            <span className={`badge ${getStatusBadge(ret.status)}`}>
                                                {ret.status}
                                            </span>
                                        </div>
                                        <div className="return-meta">
                                            <span className="return-meta-item">
                                                <Calendar size={14} />
                                                {formatDate(ret.return_date)}
                                            </span>
                                            <span className="return-meta-item">
                                                <Building2 size={14} />
                                                {ret.supplier_name}
                                            </span>
                                            {ret.reason && (
                                                <span className="return-meta-item">
                                                    <RotateCcw size={14} />
                                                    {ret.reason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="return-amount">
                                        <div className="return-total">{formatCurrency(ret.total_amount)}</div>
                                        <div className="text-xs text-secondary">
                                            GST: {formatCurrency(ret.total_gst)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        <div className="empty-state">
                            <RotateCcw size={48} strokeWidth={1} />
                            <p className="mt-4">
                                No {activeTab === 'sales' ? 'sales' : 'supplier'} returns yet
                            </p>
                        </div>
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalItems={currentReturns.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Sales Return Modal */}
            {showSalesReturnModal && (
                <div className="modal-overlay" onClick={() => setShowSalesReturnModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Sales Return</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowSalesReturnModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Bill Search */}
                            <div className="form-group">
                                <label className="form-label">Search Bill by Number</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter bill number..."
                                        value={billSearch}
                                        onChange={(e) => setBillSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchBill()}
                                    />
                                    <button className="btn btn-secondary" onClick={searchBill}>
                                        <Search size={18} />
                                        Search
                                    </button>
                                </div>
                            </div>

                            {selectedBill && (
                                <>
                                    {/* Bill Info */}
                                    <div className="card mb-4" style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)' }}>
                                        <div className="flex justify-between">
                                            <div>
                                                <strong>{selectedBill.bill_number}</strong>
                                                <div className="text-sm text-secondary">
                                                    {formatDate(selectedBill.bill_date)} • {selectedBill.customer_name || 'Walk-in Customer'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-bold">{formatCurrency(selectedBill.grand_total)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items to Return */}
                                    <div className="form-group">
                                        <label className="form-label">Select Items to Return</label>
                                        <div className="item-select-grid">
                                            {billItems.map(item => (
                                                <div key={item.id} className="item-row">
                                                    <div>
                                                        <div className="font-medium">{item.medicine_name}</div>
                                                        <div className="text-xs text-secondary">
                                                            Batch: {item.batch_number}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono">
                                                        {formatCurrency((item.selling_price ?? item.mrp ?? 0) / (item.tablets_per_strip || 10))}/pc
                                                    </span>
                                                    <span className="font-mono">Qty: {item.quantity}</span>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => addReturnItem(item)}
                                                        disabled={returnItems.some(ri => ri.item.id === item.id)}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Selected Items */}
                                    {returnItems.length > 0 && (
                                        <div className="selected-items">
                                            <h4 className="mb-3">Items to Return ({returnItems.length})</h4>
                                            {returnItems.map(ri => (
                                                <div key={ri.item.id} className="selected-item-row">
                                                    <span>{ri.item.medicine_name}</span>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={ri.quantity}
                                                        onChange={(e) => updateReturnQuantity(ri.item.id, parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        max={ri.item.quantity}
                                                        style={{ padding: 'var(--space-1) var(--space-2)' }}
                                                    />
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeReturnItem(ri.item.id)}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-success-300)' }}>
                                                <strong>
                                                    Total: {formatCurrency(returnItems.reduce((sum, ri) => {
                                                        const pricePerTablet = (ri.item.selling_price ?? ri.item.mrp ?? 0) / (ri.item.tablets_per_strip || 10);
                                                        return sum + (pricePerTablet * ri.quantity);
                                                    }, 0))}
                                                </strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Return Options */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Return Reason</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={salesReturnReason}
                                                onChange={(e) => setSalesReturnReason(e.target.value)}
                                                placeholder="Optional reason..."
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Refund Mode</label>
                                            <select
                                                className="form-select"
                                                value={salesRefundMode}
                                                onChange={(e) => setSalesRefundMode(e.target.value as any)}
                                            >
                                                <option value="CASH">Cash Refund</option>
                                                <option value="CREDIT_NOTE">Credit Note</option>
                                                <option value="ADJUSTMENT">Adjustment</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowSalesReturnModal(false); resetSalesReturnForm(); }}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={processSalesReturn}
                                disabled={!selectedBill || returnItems.length === 0}
                            >
                                Process Return
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Return Modal */}
            {showSupplierReturnModal && (
                <div className="modal-overlay" onClick={() => setShowSupplierReturnModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Supplier Return</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowSupplierReturnModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Supplier Selection */}
                            <div className="form-group">
                                <label className="form-label">Select Supplier *</label>
                                <select
                                    className="form-select"
                                    value={selectedSupplier?.id || ''}
                                    onChange={(e) => setSelectedSupplier(suppliers.find(s => s.id === parseInt(e.target.value)) || null)}
                                >
                                    <option value="">Choose a supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedSupplier && (
                                <>
                                    {/* Batches to Return */}
                                    <div className="form-group">
                                        <label className="form-label">Select Batches to Return</label>
                                        <div className="item-select-grid">
                                            {supplierBatches.map(batch => (
                                                <div key={batch.batch_id} className="item-row">
                                                    <div>
                                                        <div className="font-medium">{batch.medicine_name}</div>
                                                        <div className="text-xs text-secondary">
                                                            Batch: {batch.batch_number} • Exp: {formatDate(batch.expiry_date)}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono">{formatCurrency(batch.mrp)}</span>
                                                    <span className="font-mono">Qty: {batch.quantity}</span>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => addSupplierReturnItem(batch)}
                                                        disabled={supplierReturnItems.some(sri => sri.batch.batch_id === batch.batch_id)}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {supplierBatches.length === 0 && (
                                                <div className="text-secondary text-center py-4">
                                                    No batches available from this supplier
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selected Batches */}
                                    {supplierReturnItems.length > 0 && (
                                        <div className="selected-items">
                                            <h4 className="mb-3">Batches to Return ({supplierReturnItems.length})</h4>
                                            {supplierReturnItems.map(sri => (
                                                <div key={sri.batch.batch_id} className="selected-item-row">
                                                    <div>
                                                        <span>{sri.batch.medicine_name}</span>
                                                        <span className="text-xs text-secondary ml-2">({sri.batch.batch_number})</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={sri.quantity}
                                                        onChange={(e) => updateSupplierReturnQuantity(sri.batch.batch_id, parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        max={sri.batch.quantity}
                                                        style={{ padding: 'var(--space-1) var(--space-2)' }}
                                                    />
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeSupplierReturnItem(sri.batch.batch_id)}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-success-300)' }}>
                                                <strong>
                                                    Total: {formatCurrency(supplierReturnItems.reduce((sum, sri) => sum + (sri.batch.mrp * sri.quantity), 0))}
                                                </strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Return Options */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Return Reason *</label>
                                            <select
                                                className="form-select"
                                                value={supplierReturnReason}
                                                onChange={(e) => setSupplierReturnReason(e.target.value as any)}
                                            >
                                                <option value="EXPIRY">Expired / Near Expiry</option>
                                                <option value="DAMAGE">Damaged</option>
                                                <option value="OVERSTOCK">Overstock</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notes</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={supplierReturnNotes}
                                                onChange={(e) => setSupplierReturnNotes(e.target.value)}
                                                placeholder="Optional notes..."
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowSupplierReturnModal(false); resetSupplierReturnForm(); }}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={processSupplierReturn}
                                disabled={!selectedSupplier || supplierReturnItems.length === 0}
                            >
                                Create Return
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
