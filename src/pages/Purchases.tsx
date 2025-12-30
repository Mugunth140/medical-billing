// =====================================================
// Purchases Page
// Purchase Entry and Supplier Management
// =====================================================

import {
    Calendar,
    FileText,
    Package,
    Plus,
    Truck,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import type { CreateSupplierInput, Purchase, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils';

export function Purchases() {
    const { showToast } = useToast();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

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
            const [purchasesData, suppliersData] = await Promise.all([
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
                )
            ]);

            setPurchases(purchasesData);
            setSuppliers(suppliersData);
        } catch (error) {
            console.error('Failed to load purchases:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

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

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Purchases</h1>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={() => setShowAddSupplierModal(true)}>
                        <Plus size={18} />
                        Add Supplier
                    </button>
                    <button className="btn btn-primary" onClick={() => alert('New Purchase feature coming soon. Use Inventory > Add Stock to add inventory.')}>
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
        </>
    );
}
