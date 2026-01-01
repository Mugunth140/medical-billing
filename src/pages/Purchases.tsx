// =====================================================
// Purchases Page
// Purchase Entry and Supplier Management
// =====================================================

import {
    Calendar,
    FileText,
    Package,
    Plus,
    Search,
    Trash2,
    Truck,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import { useAuthStore } from '../stores';
import type { CreateSupplierInput, GstRate, Medicine, Purchase, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils';

// Types for purchase entry
interface PurchaseItemEntry {
    id: string;
    medicine_id: number;
    medicine_name: string;
    hsn_code: string;
    gst_rate: GstRate;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    free_quantity: number;
    purchase_price: number;
    mrp: number;
    selling_price: number;
    rack?: string;
    box?: string;
    cgst: number;
    sgst: number;
    total_gst: number;
    total: number;
}

interface PurchaseForm {
    supplier_id: number;
    invoice_number: string;
    invoice_date: string;
    payment_status: 'PENDING' | 'PARTIAL' | 'PAID';
    paid_amount: number;
    due_date?: string;
    notes?: string;
}

export function Purchases() {
    const { showToast } = useToast();
    const { user } = useAuthStore();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);

    // Medicine search state
    const [medicineSearch, setMedicineSearch] = useState('');
    const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
    const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);

    // Purchase form state
    const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
        supplier_id: 0,
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        payment_status: 'PENDING',
        paid_amount: 0,
    });
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItemEntry[]>([]);

    // Form state for new supplier
    const [supplierForm, setSupplierForm] = useState<CreateSupplierInput>({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        gstin: '',
        address: '',
        city: '',
        state: 'Tamil Nadu',
        pincode: '',
        payment_terms: 30
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [purchasesData, suppliersData, medicinesData] = await Promise.all([
                query<Purchase>(
                    `SELECT p.*, s.name as supplier_name 
             FROM purchases p 
             LEFT JOIN suppliers s ON p.supplier_id = s.id 
             ORDER BY p.invoice_date DESC 
             LIMIT 50`,
                    []
                ),
                query<Supplier>(
                    'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name',
                    []
                ),
                query<Medicine>(
                    'SELECT * FROM medicines WHERE is_active = 1 ORDER BY name',
                    []
                )
            ]);

            setPurchases(purchasesData);
            setSuppliers(suppliersData);
            setMedicines(medicinesData);
        } catch (error) {
            console.error('Failed to load purchases:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter medicines based on search
    useEffect(() => {
        if (medicineSearch.length > 0) {
            const filtered = medicines.filter(m =>
                m.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
                (m.generic_name && m.generic_name.toLowerCase().includes(medicineSearch.toLowerCase()))
            ).slice(0, 10);
            setFilteredMedicines(filtered);
            setShowMedicineDropdown(true);
        } else {
            setFilteredMedicines([]);
            setShowMedicineDropdown(false);
        }
    }, [medicineSearch, medicines]);

    const getPaymentStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return 'badge-success';
            case 'PARTIAL':
                return 'badge-warning';
            default:
                return 'badge-danger';
        }
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute(
                `INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, pincode, payment_terms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    supplierForm.name,
                    supplierForm.contact_person || null,
                    supplierForm.phone || null,
                    supplierForm.email || null,
                    supplierForm.gstin || null,
                    supplierForm.address || null,
                    supplierForm.city || null,
                    supplierForm.state || 'Tamil Nadu',
                    supplierForm.pincode || null,
                    supplierForm.payment_terms || 30
                ]
            );
            showToast('success', `Supplier "${supplierForm.name}" added successfully!`);
            setShowAddSupplierModal(false);
            setSupplierForm({
                name: '',
                contact_person: '',
                phone: '',
                email: '',
                gstin: '',
                address: '',
                city: '',
                state: 'Tamil Nadu',
                pincode: '',
                payment_terms: 30
            });
            loadData();
        } catch (error) {
            console.error('Failed to add supplier:', error);
            showToast('error', 'Failed to add supplier. Please try again.');
        }
    };

    // Add medicine to purchase
    const handleAddMedicine = (medicine: Medicine) => {
        const newItem: PurchaseItemEntry = {
            id: `item-${Date.now()}`,
            medicine_id: medicine.id,
            medicine_name: medicine.name,
            hsn_code: medicine.hsn_code,
            gst_rate: medicine.gst_rate,
            batch_number: '',
            expiry_date: '',
            quantity: 0,
            free_quantity: 0,
            purchase_price: 0,
            mrp: 0,
            selling_price: 0,
            rack: '',
            box: '',
            cgst: 0,
            sgst: 0,
            total_gst: 0,
            total: 0,
        };
        setPurchaseItems([...purchaseItems, newItem]);
        setMedicineSearch('');
        setShowMedicineDropdown(false);
    };

    // Update purchase item
    const updatePurchaseItem = (id: string, field: keyof PurchaseItemEntry, value: any) => {
        setPurchaseItems(items =>
            items.map(item => {
                if (item.id !== id) return item;

                const updated = { ...item, [field]: value };

                // Recalculate GST and total when price or quantity changes
                if (['purchase_price', 'quantity', 'gst_rate'].includes(field)) {
                    const qty = field === 'quantity' ? Number(value) : updated.quantity;
                    const price = field === 'purchase_price' ? Number(value) : updated.purchase_price;
                    const gstRate = field === 'gst_rate' ? Number(value) : updated.gst_rate;

                    const subtotal = qty * price;
                    const halfGstRate = gstRate / 2;
                    updated.cgst = (subtotal * halfGstRate) / 100;
                    updated.sgst = (subtotal * halfGstRate) / 100;
                    updated.total_gst = updated.cgst + updated.sgst;
                    updated.total = subtotal + updated.total_gst;
                }

                return updated;
            })
        );
    };

    // Remove purchase item
    const removePurchaseItem = (id: string) => {
        setPurchaseItems(items => items.filter(item => item.id !== id));
    };

    // Calculate purchase totals
    const purchaseTotals = purchaseItems.reduce(
        (acc, item) => ({
            subtotal: acc.subtotal + (item.quantity * item.purchase_price),
            total_cgst: acc.total_cgst + item.cgst,
            total_sgst: acc.total_sgst + item.sgst,
            total_gst: acc.total_gst + item.total_gst,
            grand_total: acc.grand_total + item.total,
        }),
        { subtotal: 0, total_cgst: 0, total_sgst: 0, total_gst: 0, grand_total: 0 }
    );

    // Reset purchase form
    const resetPurchaseForm = () => {
        setPurchaseForm({
            supplier_id: 0,
            invoice_number: '',
            invoice_date: new Date().toISOString().split('T')[0],
            payment_status: 'PENDING',
            paid_amount: 0,
        });
        setPurchaseItems([]);
        setMedicineSearch('');
    };

    // Save new purchase
    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!purchaseForm.supplier_id) {
            showToast('error', 'Please select a supplier');
            return;
        }
        if (!purchaseForm.invoice_number) {
            showToast('error', 'Please enter invoice number');
            return;
        }
        if (purchaseItems.length === 0) {
            showToast('error', 'Please add at least one item');
            return;
        }

        // Validate all items
        for (const item of purchaseItems) {
            if (!item.batch_number) {
                showToast('error', `Please enter batch number for ${item.medicine_name}`);
                return;
            }
            if (!item.expiry_date) {
                showToast('error', `Please enter expiry date for ${item.medicine_name}`);
                return;
            }
            if (item.quantity <= 0) {
                showToast('error', `Please enter valid quantity for ${item.medicine_name}`);
                return;
            }
            if (item.purchase_price <= 0) {
                showToast('error', `Please enter purchase price for ${item.medicine_name}`);
                return;
            }
            if (item.mrp <= 0) {
                showToast('error', `Please enter MRP for ${item.medicine_name}`);
                return;
            }
            if (item.selling_price <= 0) {
                showToast('error', `Please enter selling price for ${item.medicine_name}`);
                return;
            }
        }

        try {
            // Insert purchase record
            const purchaseResult = await execute(
                `INSERT INTO purchases (
                    invoice_number, invoice_date, supplier_id, user_id,
                    subtotal, total_cgst, total_sgst, total_gst, grand_total,
                    payment_status, paid_amount, due_date, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    purchaseForm.invoice_number,
                    purchaseForm.invoice_date,
                    purchaseForm.supplier_id,
                    user?.id || 1,
                    purchaseTotals.subtotal,
                    purchaseTotals.total_cgst,
                    purchaseTotals.total_sgst,
                    purchaseTotals.total_gst,
                    purchaseTotals.grand_total,
                    purchaseForm.payment_status,
                    purchaseForm.paid_amount || 0,
                    purchaseForm.due_date || null,
                    purchaseForm.notes || null,
                ]
            );

            const purchaseId = purchaseResult.lastInsertId;

            // Insert items and create/update batches
            for (const item of purchaseItems) {
                // Check if batch already exists for this medicine
                const existingBatches = await query<{ id: number; quantity: number }>(
                    `SELECT id, quantity FROM batches 
                     WHERE medicine_id = ? AND batch_number = ?`,
                    [item.medicine_id, item.batch_number]
                );

                let batchId: number;

                if (existingBatches.length > 0) {
                    // Update existing batch
                    batchId = existingBatches[0].id;
                    await execute(
                        `UPDATE batches SET 
                            quantity = quantity + ?,
                            purchase_price = ?,
                            mrp = ?,
                            selling_price = ?,
                            expiry_date = ?,
                            rack = COALESCE(?, rack),
                            box = COALESCE(?, box),
                            purchase_id = ?,
                            updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [
                            item.quantity + item.free_quantity,
                            item.purchase_price,
                            item.mrp,
                            item.selling_price,
                            item.expiry_date,
                            item.rack || null,
                            item.box || null,
                            purchaseId,
                            batchId,
                        ]
                    );
                } else {
                    // Create new batch
                    const batchResult = await execute(
                        `INSERT INTO batches (
                            medicine_id, batch_number, expiry_date,
                            purchase_price, mrp, selling_price, price_type,
                            quantity, rack, box, purchase_id
                        ) VALUES (?, ?, ?, ?, ?, ?, 'INCLUSIVE', ?, ?, ?, ?)`,
                        [
                            item.medicine_id,
                            item.batch_number,
                            item.expiry_date,
                            item.purchase_price,
                            item.mrp,
                            item.selling_price,
                            item.quantity + item.free_quantity,
                            item.rack || null,
                            item.box || null,
                            purchaseId,
                        ]
                    );
                    batchId = batchResult.lastInsertId;
                }

                // Insert purchase item
                await execute(
                    `INSERT INTO purchase_items (
                        purchase_id, medicine_id, batch_id,
                        quantity, free_quantity,
                        purchase_price, mrp, selling_price,
                        gst_rate, cgst, sgst, total_gst, total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        purchaseId,
                        item.medicine_id,
                        batchId,
                        item.quantity,
                        item.free_quantity,
                        item.purchase_price,
                        item.mrp,
                        item.selling_price,
                        item.gst_rate,
                        item.cgst,
                        item.sgst,
                        item.total_gst,
                        item.total,
                    ]
                );
            }

            showToast('success', `Purchase ${purchaseForm.invoice_number} saved successfully!`);
            setShowNewPurchaseModal(false);
            resetPurchaseForm();
            loadData();
        } catch (error) {
            console.error('Failed to save purchase:', error);
            showToast('error', 'Failed to save purchase. Please try again.');
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Purchases</h1>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={() => setShowAddSupplierModal(true)}>
                        <Plus size={18} />
                        Add Supplier
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowNewPurchaseModal(true)}>
                        <Plus size={18} />
                        New Purchase
                    </button>
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
          
          .purchases-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--space-4);
            margin-bottom: var(--space-6);
          }
          
          .stat-mini {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
          }
          
          .stat-mini-value {
            font-size: var(--text-xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            margin-bottom: var(--space-1);
          }
          
          .stat-mini-label {
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
          
          .purchase-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            margin-bottom: var(--space-3);
            display: grid;
            grid-template-columns: 1fr auto;
            gap: var(--space-4);
            align-items: center;
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          
          .purchase-card:hover {
            border-color: var(--color-primary-300);
            box-shadow: var(--shadow-sm);
          }
          
          .purchase-info {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }
          
          .purchase-header {
            display: flex;
            align-items: center;
            gap: var(--space-3);
          }
          
          .purchase-invoice {
            font-weight: var(--font-semibold);
            font-family: var(--font-mono);
          }
          
          .purchase-meta {
            display: flex;
            gap: var(--space-4);
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
          
          .purchase-meta-item {
            display: flex;
            align-items: center;
            gap: var(--space-1);
          }
          
          .purchase-amount {
            text-align: right;
          }
          
          .purchase-total {
            font-size: var(--text-lg);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
          }
          
          .supplier-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
            margin-bottom: var(--space-3);
          }
          
          .supplier-name {
            font-weight: var(--font-semibold);
            font-size: var(--text-lg);
            margin-bottom: var(--space-1);
          }
          
          .supplier-contact {
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
        `}</style>

                {/* Tabs */}
                <div className="tabs">
                    <div
                        className={`tab ${activeTab === 'purchases' ? 'active' : ''}`}
                        onClick={() => setActiveTab('purchases')}
                    >
                        <FileText size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Purchase Bills
                    </div>
                    <div
                        className={`tab ${activeTab === 'suppliers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('suppliers')}
                    >
                        <Truck size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Suppliers
                    </div>
                </div>

                {activeTab === 'purchases' && (
                    <>
                        {/* Stats */}
                        <div className="purchases-stats">
                            <div className="stat-mini">
                                <div className="stat-mini-value">{purchases.length}</div>
                                <div className="stat-mini-label">Total Purchases</div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-value">
                                    {formatCurrency(purchases.reduce((sum, p) => sum + p.grand_total, 0))}
                                </div>
                                <div className="stat-mini-label">Total Value</div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-value">
                                    {purchases.filter(p => p.payment_status === 'PENDING').length}
                                </div>
                                <div className="stat-mini-label">Pending Payments</div>
                            </div>
                            <div className="stat-mini">
                                <div className="stat-mini-value">{suppliers.length}</div>
                                <div className="stat-mini-label">Active Suppliers</div>
                            </div>
                        </div>

                        {/* Purchase List */}
                        {isLoading ? (
                            <div className="empty-state">
                                <div className="loading-spinner" />
                            </div>
                        ) : purchases.length > 0 ? (
                            purchases.map((purchase) => (
                                <div key={purchase.id} className="purchase-card">
                                    <div className="purchase-info">
                                        <div className="purchase-header">
                                            <span className="purchase-invoice">{purchase.invoice_number}</span>
                                            <span className={`badge ${getPaymentStatusBadge(purchase.payment_status)}`}>
                                                {purchase.payment_status}
                                            </span>
                                        </div>
                                        <div className="purchase-meta">
                                            <span className="purchase-meta-item">
                                                <Truck size={14} />
                                                {(purchase as any).supplier_name || 'Unknown Supplier'}
                                            </span>
                                            <span className="purchase-meta-item">
                                                <Calendar size={14} />
                                                {formatDate(purchase.invoice_date)}
                                            </span>
                                            <span className="purchase-meta-item">
                                                <Package size={14} />
                                                Items
                                            </span>
                                        </div>
                                    </div>
                                    <div className="purchase-amount">
                                        <div className="purchase-total">{formatCurrency(purchase.grand_total)}</div>
                                        <div className="text-sm text-secondary">
                                            GST: {formatCurrency(purchase.total_gst)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <FileText size={48} strokeWidth={1} />
                                <h3 className="mt-4">No purchases yet</h3>
                                <p className="text-secondary">Use Inventory &gt; Add Stock to add inventory from suppliers</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'suppliers' && (
                    <>
                        {suppliers.length > 0 ? (
                            suppliers.map((supplier) => (
                                <div key={supplier.id} className="supplier-card">
                                    <div className="supplier-name">{supplier.name}</div>
                                    <div className="supplier-contact">
                                        {supplier.contact_person && <span>{supplier.contact_person} | </span>}
                                        {supplier.phone && <span>{supplier.phone} | </span>}
                                        {supplier.gstin && <span>GSTIN: {supplier.gstin}</span>}
                                    </div>
                                    {supplier.address && (
                                        <div className="text-sm text-tertiary mt-2">
                                            {supplier.address}, {supplier.city}, {supplier.state}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Truck size={48} strokeWidth={1} />
                                <h3 className="mt-4">No suppliers yet</h3>
                                <p className="text-secondary">Add suppliers to manage your purchases</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Supplier Modal */}
            {showAddSupplierModal && (
                <div className="modal-overlay" onClick={() => setShowAddSupplierModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Supplier</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddSupplierModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSupplier}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Supplier Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.name}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Person</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.contact_person}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            value={supplierForm.phone}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={supplierForm.email}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GSTIN</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.gstin}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value.toUpperCase() })}
                                            placeholder="22AAAAA0000A1Z5"
                                            maxLength={15}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Terms (Days)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={supplierForm.payment_terms}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: parseInt(e.target.value) || 30 })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Address</label>
                                        <textarea
                                            className="form-textarea"
                                            rows={2}
                                            value={supplierForm.address}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">City</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.city}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">State</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.state}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Pincode</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={supplierForm.pincode}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, pincode: e.target.value })}
                                            maxLength={6}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSupplierModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Supplier
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Purchase Modal */}
            {showNewPurchaseModal && (
                <div className="modal-overlay" onClick={() => { setShowNewPurchaseModal(false); resetPurchaseForm(); }}>
                    <div className="modal" style={{ maxWidth: '95vw', width: '1200px', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Purchase Entry</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowNewPurchaseModal(false); resetPurchaseForm(); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSavePurchase}>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                {/* Invoice Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Supplier *</label>
                                        <select
                                            className="form-input"
                                            value={purchaseForm.supplier_id}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: parseInt(e.target.value) })}
                                            required
                                        >
                                            <option value={0}>Select Supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Invoice Number *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={purchaseForm.invoice_number}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })}
                                            placeholder="INV-001"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Invoice Date *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={purchaseForm.invoice_date}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Status</label>
                                        <select
                                            className="form-input"
                                            value={purchaseForm.payment_status}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_status: e.target.value as any })}
                                        >
                                            <option value="PENDING">Pending</option>
                                            <option value="PARTIAL">Partial</option>
                                            <option value="PAID">Paid</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Add Medicine Search */}
                                <div style={{ marginBottom: 'var(--space-4)', position: 'relative' }}>
                                    <label className="form-label">Add Medicine</label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: 40 }}
                                            placeholder="Search medicine by name..."
                                            value={medicineSearch}
                                            onChange={(e) => setMedicineSearch(e.target.value)}
                                            onFocus={() => medicineSearch.length > 0 && setShowMedicineDropdown(true)}
                                        />
                                        {showMedicineDropdown && filteredMedicines.length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-medium)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-lg)',
                                                zIndex: 100,
                                                maxHeight: 200,
                                                overflowY: 'auto'
                                            }}>
                                                {filteredMedicines.map(m => (
                                                    <div
                                                        key={m.id}
                                                        style={{
                                                            padding: 'var(--space-3)',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid var(--border-light)'
                                                        }}
                                                        onClick={() => handleAddMedicine(m)}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                                            GST: {m.gst_rate}% | HSN: {m.hsn_code}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Purchase Items Table */}
                                {purchaseItems.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table" style={{ minWidth: 1100 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: 180 }}>Medicine</th>
                                                    <th style={{ minWidth: 100 }}>Batch *</th>
                                                    <th style={{ minWidth: 120 }}>Expiry *</th>
                                                    <th style={{ minWidth: 70 }}>Qty *</th>
                                                    <th style={{ minWidth: 70 }}>Free</th>
                                                    <th style={{ minWidth: 90 }}>Purchase ₹ *</th>
                                                    <th style={{ minWidth: 90 }}>MRP ₹ *</th>
                                                    <th style={{ minWidth: 90 }}>Sell ₹ *</th>
                                                    <th style={{ minWidth: 60 }}>GST%</th>
                                                    <th style={{ minWidth: 60 }}>Rack</th>
                                                    <th style={{ minWidth: 60 }}>Box</th>
                                                    <th style={{ minWidth: 100 }}>Total</th>
                                                    <th style={{ width: 40 }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {purchaseItems.map((item) => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <div style={{ fontWeight: 500 }}>{item.medicine_name}</div>
                                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>HSN: {item.hsn_code}</div>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}
                                                                value={item.batch_number}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'batch_number', e.target.value)}
                                                                placeholder="Batch"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="date"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}
                                                                value={item.expiry_date}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'expiry_date', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                                                value={item.quantity || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                                min={0}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                                                value={item.free_quantity || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'free_quantity', parseInt(e.target.value) || 0)}
                                                                min={0}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                                                value={item.purchase_price || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'purchase_price', parseFloat(e.target.value) || 0)}
                                                                step={0.01}
                                                                min={0}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                                                value={item.mrp || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'mrp', parseFloat(e.target.value) || 0)}
                                                                step={0.01}
                                                                min={0}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)', textAlign: 'right' }}
                                                                value={item.selling_price || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'selling_price', parseFloat(e.target.value) || 0)}
                                                                step={0.01}
                                                                min={0}
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{item.gst_rate}%</span>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}
                                                                value={item.rack || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'rack', e.target.value)}
                                                                placeholder="Rack"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                style={{ padding: 'var(--space-2)', fontSize: 'var(--text-sm)' }}
                                                                value={item.box || ''}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'box', e.target.value)}
                                                                placeholder="Box"
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                                            {formatCurrency(item.total)}
                                                        </td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost btn-icon"
                                                                onClick={() => removePurchaseItem(item.id)}
                                                                style={{ color: 'var(--color-danger-600)' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                                        <Package size={40} strokeWidth={1} />
                                        <p style={{ marginTop: 'var(--space-2)' }}>Search and add medicines to this purchase</p>
                                    </div>
                                )}

                                {/* Totals */}
                                {purchaseItems.length > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        marginTop: 'var(--space-4)',
                                        paddingTop: 'var(--space-4)',
                                        borderTop: '1px solid var(--border-light)'
                                    }}>
                                        <div style={{ minWidth: 280 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                                <span>Subtotal:</span>
                                                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(purchaseTotals.subtotal)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                                <span>CGST:</span>
                                                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(purchaseTotals.total_cgst)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                                <span>SGST:</span>
                                                <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(purchaseTotals.total_sgst)}</span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                paddingTop: 'var(--space-2)',
                                                borderTop: '2px solid var(--border-medium)',
                                                fontWeight: 700,
                                                fontSize: 'var(--text-lg)'
                                            }}>
                                                <span>Grand Total:</span>
                                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                                                    {formatCurrency(purchaseTotals.grand_total)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowNewPurchaseModal(false); resetPurchaseForm(); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={purchaseItems.length === 0}>
                                    <Plus size={18} />
                                    Save Purchase
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
