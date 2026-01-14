// =====================================================
// Supplier Management Page
// Dedicated page for managing suppliers and their medicine inventory
// =====================================================

import {
    Building2,
    ChevronDown,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import type { CreateBatchInput, CreateMedicineInput, CreateSupplierInput, GstRate, Medicine, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils';

// Extended batch type with medicine info
interface SupplierBatch {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    purchase_price: number;
    mrp: number;
    selling_price: number;
    quantity: number;
    tablets_per_strip: number;
    rack?: string;
    box?: string;
    medicine_id: number;
    medicine_name: string;
    manufacturer?: string;
    gst_rate: number;
    hsn_code: string;
    supplier_id?: number;
    purchase_date?: string;
}

export function SupplierManagement() {
    const { showToast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierBatches, setSupplierBatches] = useState<SupplierBatch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Modal states
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
    const [showAddMedicineModal, setShowAddMedicineModal] = useState(false);
    const [showAddBatchModal, setShowAddBatchModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    // Pagination
    const ITEMS_PER_PAGE = 50;

    // Form states
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

    const [medicineForm, setMedicineForm] = useState<CreateMedicineInput>({
        name: '',
        generic_name: '',
        manufacturer: '',
        hsn_code: '3004',
        category: '',
        unit: 'PCS',
        reorder_level: 10
    });

    const [batchForm, setBatchForm] = useState<CreateBatchInput & { supplier_id?: number }>({
        medicine_id: 0,
        batch_number: '',
        expiry_date: '',
        purchase_price: 0,
        mrp: 0,
        selling_price: 0,
        price_type: 'INCLUSIVE',
        gst_rate: 12,
        is_schedule: false,
        quantity: 0,
        tablets_per_strip: 10,
        rack: '',
        box: ''
    });

    const [selectedMedicineForBatch, setSelectedMedicineForBatch] = useState<Medicine | null>(null);

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

    // Search medicines on demand instead of loading all
    const [medicineSearch, setMedicineSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Medicine[]>([]);

    const searchMedicines = async (term: string) => {
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const searchTerm = `%${term}%`;
            const data = await query<Medicine>(
                `SELECT * FROM medicines WHERE is_active = 1 
                 AND (name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ?)
                 ORDER BY name LIMIT 20`,
                [searchTerm, searchTerm, searchTerm]
            );
            setSearchResults(data);
        } catch (error) {
            console.error('Failed to search medicines:', error);
        }
    };

    const loadSupplierBatches = async (supplierId: number) => {
        try {
            // Query batches that are linked to this supplier via purchases or directly
            const data = await query<SupplierBatch>(
                `SELECT 
                    b.id as batch_id,
                    b.batch_number,
                    b.expiry_date,
                    b.purchase_price,
                    b.mrp,
                    b.selling_price,
                    b.quantity,
                    b.tablets_per_strip,
                    b.rack,
                    b.box,
                    b.supplier_id,
                    m.id as medicine_id,
                    m.name as medicine_name,
                    m.manufacturer,
                    COALESCE(b.gst_rate, 12) as gst_rate,
                    m.hsn_code,
                    p.invoice_date as purchase_date
                FROM batches b
                JOIN medicines m ON b.medicine_id = m.id
                LEFT JOIN purchases p ON b.purchase_id = p.id
                WHERE b.is_active = 1 
                AND (b.supplier_id = ? OR p.supplier_id = ?)
                ORDER BY m.name, b.batch_number`,
                [supplierId, supplierId]
            );
            setSupplierBatches(data);
        } catch (error) {
            console.error('Failed to load supplier batches:', error);
            setSupplierBatches([]);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await loadSuppliers();
            setIsLoading(false);
        };
        loadData();
    }, []);


    useEffect(() => {
        if (selectedSupplier) {
            loadSupplierBatches(selectedSupplier.id);
        } else {
            setSupplierBatches([]);
        }
    }, [selectedSupplier]);

    // Filter batches by search query
    const filteredBatches = supplierBatches.filter(batch =>
        batch.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Paginate
    const paginatedBatches = filteredBatches.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page on search

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedSupplier]);

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
            resetSupplierForm();
            loadSuppliers();
        } catch (error) {
            console.error('Failed to add supplier:', error);
            showToast('error', 'Failed to add supplier');
        }
    };

    const handleEditSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier) return;

        try {
            await execute(
                `UPDATE suppliers SET 
                    name = ?, contact_person = ?, phone = ?, email = ?, 
                    gstin = ?, address = ?, city = ?, state = ?, pincode = ?, payment_terms = ?
                 WHERE id = ?`,
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
                    supplierForm.payment_terms || 30,
                    editingSupplier.id
                ]
            );
            showToast('success', `Supplier "${supplierForm.name}" updated successfully!`);
            setShowEditSupplierModal(false);
            setEditingSupplier(null);
            resetSupplierForm();
            loadSuppliers();
        } catch (error) {
            console.error('Failed to update supplier:', error);
            showToast('error', 'Failed to update supplier');
        }
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) return;

        try {
            await execute('UPDATE suppliers SET is_active = 0 WHERE id = ?', [supplier.id]);
            showToast('success', `Supplier "${supplier.name}" deleted successfully`);
            if (selectedSupplier?.id === supplier.id) {
                setSelectedSupplier(null);
            }
            loadSuppliers();
        } catch (error) {
            console.error('Failed to delete supplier:', error);
            showToast('error', 'Failed to delete supplier');
        }
    };

    const openEditSupplierModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setSupplierForm({
            name: supplier.name,
            contact_person: supplier.contact_person || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            gstin: supplier.gstin || '',
            address: supplier.address || '',
            city: supplier.city || '',
            state: supplier.state || 'Tamil Nadu',
            pincode: supplier.pincode || '',
            payment_terms: supplier.payment_terms || 30
        });
        setShowEditSupplierModal(true);
    };

    const resetSupplierForm = () => {
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
    };

    const handleAddMedicineWithBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier) return;

        try {
            // Insert medicine (without gst_rate - now per-batch)
            const medicineResult = await execute(
                `INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, category, unit, reorder_level)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    medicineForm.name,
                    medicineForm.generic_name || null,
                    medicineForm.manufacturer || null,
                    medicineForm.hsn_code || '3004',
                    medicineForm.category || null,
                    medicineForm.unit || 'PCS',
                    medicineForm.reorder_level || 10
                ]
            );

            const medicineId = medicineResult.lastInsertId;

            // Insert batch with supplier_id, gst_rate, is_schedule
            const tabletsPerStrip = batchForm.tablets_per_strip || 10;
            const totalPieces = batchForm.quantity * tabletsPerStrip;

            await execute(
                `INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, gst_rate, is_schedule, quantity, tablets_per_strip, rack, box, supplier_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    medicineId,
                    batchForm.batch_number,
                    batchForm.expiry_date,
                    batchForm.purchase_price,
                    batchForm.mrp,
                    batchForm.selling_price,
                    batchForm.price_type,
                    batchForm.gst_rate,
                    batchForm.is_schedule ? 1 : 0,
                    totalPieces,
                    tabletsPerStrip,
                    batchForm.rack || null,
                    batchForm.box || null,
                    selectedSupplier.id
                ]
            );

            showToast('success', `Medicine "${medicineForm.name}" with batch added for ${selectedSupplier.name}`);
            setShowAddMedicineModal(false);
            resetMedicineForm();
            resetBatchForm();
            loadSupplierBatches(selectedSupplier.id);
        } catch (error) {
            console.error('Failed to add medicine with batch:', error);
            showToast('error', 'Failed to add medicine');
        }
    };

    const handleAddBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier || !selectedMedicineForBatch) return;

        try {
            const tabletsPerStrip = batchForm.tablets_per_strip || 10;
            const totalPieces = batchForm.quantity * tabletsPerStrip;

            await execute(
                `INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box, supplier_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    selectedMedicineForBatch.id,
                    batchForm.batch_number,
                    batchForm.expiry_date,
                    batchForm.purchase_price,
                    batchForm.mrp,
                    batchForm.selling_price,
                    batchForm.price_type,
                    totalPieces,
                    tabletsPerStrip,
                    batchForm.rack || null,
                    batchForm.box || null,
                    selectedSupplier.id
                ]
            );

            showToast('success', `Batch "${batchForm.batch_number}" added for ${selectedMedicineForBatch.name}`);
            setShowAddBatchModal(false);
            setSelectedMedicineForBatch(null);
            resetBatchForm();
            loadSupplierBatches(selectedSupplier.id);
        } catch (error) {
            console.error('Failed to add batch:', error);
            showToast('error', 'Failed to add batch');
        }
    };

    const resetMedicineForm = () => {
        setMedicineForm({
            name: '',
            generic_name: '',
            manufacturer: '',
            hsn_code: '3004',
            category: '',
            unit: 'PCS',
            reorder_level: 10
        });
    };

    const resetBatchForm = () => {
        setBatchForm({
            medicine_id: 0,
            batch_number: '',
            expiry_date: '',
            purchase_price: 0,
            mrp: 0,
            selling_price: 0,
            price_type: 'INCLUSIVE',
            gst_rate: 12,
            is_schedule: false,
            quantity: 0,
            tablets_per_strip: 10,
            rack: '',
            box: ''
        });
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Supplier Management</h1>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddSupplierModal(true)}>
                        <Plus size={18} />
                        Add Supplier
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
                    .supplier-management {
                        display: grid;
                        grid-template-columns: 320px 1fr;
                        gap: var(--space-6);
                        min-height: 600px;
                    }
                    
                    .supplier-list {
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-light);
                        border-radius: var(--radius-lg);
                        padding: var(--space-4);
                        max-height: calc(100vh - 200px);
                        overflow-y: auto;
                    }
                    
                    .supplier-list-header {
                        font-weight: var(--font-semibold);
                        margin-bottom: var(--space-3);
                        color: var(--text-secondary);
                        font-size: var(--text-sm);
                    }
                    
                    .supplier-item {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: var(--space-3);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        transition: all var(--transition-fast);
                        margin-bottom: var(--space-2);
                    }
                    
                    .supplier-item:hover {
                        background: var(--bg-tertiary);
                    }
                    
                    .supplier-item.selected {
                        background: var(--color-primary-50);
                        border: 1px solid var(--color-primary-200);
                    }
                    
                    .supplier-item-info {
                        flex: 1;
                    }
                    
                    .supplier-item-name {
                        font-weight: var(--font-medium);
                    }
                    
                    .supplier-item-meta {
                        font-size: var(--text-xs);
                        color: var(--text-tertiary);
                    }
                    
                    .supplier-item-actions {
                        display: flex;
                        gap: var(--space-1);
                        opacity: 0;
                        transition: opacity var(--transition-fast);
                    }
                    
                    .supplier-item:hover .supplier-item-actions {
                        opacity: 1;
                    }
                    
                    .supplier-content {
                        display: flex;
                        flex-direction: column;
                        gap: var(--space-4);
                    }
                    
                    .supplier-content-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: var(--space-4);
                    }
                    
                    .supplier-content-title {
                        display: flex;
                        align-items: center;
                        gap: var(--space-3);
                    }
                    
                    .supplier-content-title h2 {
                        margin: 0;
                        font-size: var(--text-xl);
                    }
                    
                    .batch-search {
                        position: relative;
                        max-width: 300px;
                    }
                    
                    .batch-search input {
                        padding-left: var(--space-10);
                    }
                    
                    .batch-search-icon {
                        position: absolute;
                        left: var(--space-3);
                        top: 50%;
                        transform: translateY(-50%);
                        color: var(--text-tertiary);
                    }
                    
                    .batch-grid {
                        display: grid;
                        gap: var(--space-3);
                    }
                    
                    .batch-row {
                        display: grid;
                        grid-template-columns: 2fr 1fr 100px 80px 80px 100px 120px;
                        gap: var(--space-3);
                        align-items: center;
                        padding: var(--space-3) var(--space-4);
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-light);
                        border-radius: var(--radius-md);
                    }
                    
                    .batch-row:hover {
                        border-color: var(--color-primary-200);
                    }
                    
                    .batch-header {
                        font-weight: var(--font-semibold);
                        color: var(--text-secondary);
                        font-size: var(--text-sm);
                        background: transparent;
                        border: none;
                    }
                    
                    .no-supplier-selected {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: var(--space-12);
                        text-align: center;
                        color: var(--text-tertiary);
                    }
                    
                    .action-btn {
                        padding: var(--space-1);
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        color: var(--text-tertiary);
                        border-radius: var(--radius-sm);
                        transition: all var(--transition-fast);
                    }
                    
                    .action-btn:hover {
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                    }
                    
                    .action-btn.delete:hover {
                        color: var(--color-danger-600);
                    }
                `}</style>

                <div className="supplier-management">
                    {/* Supplier List */}
                    <div className="supplier-list">
                        <div className="supplier-list-header">
                            Suppliers ({suppliers.length})
                        </div>

                        {isLoading ? (
                            <div className="empty-state">
                                <div className="loading-spinner" />
                            </div>
                        ) : suppliers.length > 0 ? (
                            suppliers.map(supplier => (
                                <div
                                    key={supplier.id}
                                    className={`supplier-item ${selectedSupplier?.id === supplier.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedSupplier(supplier)}
                                >
                                    <div className="supplier-item-info">
                                        <div className="supplier-item-name">{supplier.name}</div>
                                        <div className="supplier-item-meta">
                                            {supplier.city || supplier.state} • {supplier.phone || 'No phone'}
                                        </div>
                                    </div>
                                    <div className="supplier-item-actions">
                                        <button
                                            className="action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditSupplierModal(supplier);
                                            }}
                                            title="Edit"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSupplier(supplier);
                                            }}
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Building2 size={32} strokeWidth={1} />
                                <p className="mt-2">No suppliers yet</p>
                            </div>
                        )}
                    </div>

                    {/* Supplier Content */}
                    <div className="supplier-content">
                        {selectedSupplier ? (
                            <>
                                <div className="supplier-content-header">
                                    <div className="supplier-content-title">
                                        <Building2 size={24} />
                                        <div>
                                            <h2>{selectedSupplier.name}</h2>
                                            <span className="text-sm text-secondary">
                                                {selectedSupplier.gstin || 'No GSTIN'} • {selectedSupplier.phone || 'No phone'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowAddBatchModal(true)}
                                        >
                                            <Plus size={16} />
                                            Add Batch
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setShowAddMedicineModal(true)}
                                        >
                                            <Plus size={16} />
                                            New Medicine
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="batch-search">
                                    <Search className="batch-search-icon" size={18} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Search medicines or batches..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {/* Batch Grid */}
                                <div className="batch-grid">
                                    <div className="batch-row batch-header">
                                        <span>Medicine</span>
                                        <span>Batch</span>
                                        <span>Expiry</span>
                                        <span>Qty</span>
                                        <span>Strips</span>
                                        <span>MRP</span>
                                        <span>Location</span>
                                    </div>

                                    {paginatedBatches.length > 0 ? (
                                        paginatedBatches.map(batch => (
                                            <div key={batch.batch_id} className="batch-row">
                                                <div>
                                                    <div className="font-medium">{batch.medicine_name}</div>
                                                    <div className="text-xs text-secondary">
                                                        {batch.manufacturer} | HSN: {batch.hsn_code}
                                                    </div>
                                                </div>
                                                <span className="font-mono text-sm">{batch.batch_number}</span>
                                                <span className="text-sm">{formatDate(batch.expiry_date)}</span>
                                                <span className="font-mono font-semibold">{batch.quantity}</span>
                                                <span className="font-mono text-sm">
                                                    {Math.floor(batch.quantity / (batch.tablets_per_strip || 10))}
                                                </span>
                                                <span className="font-mono">{formatCurrency(batch.mrp)}</span>
                                                <span className="text-sm text-secondary">
                                                    {batch.rack || '-'} / {batch.box || '-'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">
                                            <Package size={48} strokeWidth={1} />
                                            <p className="mt-4">No medicines from this supplier yet</p>
                                        </div>
                                    )}
                                </div>

                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={filteredBatches.length}
                                    itemsPerPage={ITEMS_PER_PAGE}
                                    onPageChange={setCurrentPage}
                                />
                            </>
                        ) : (
                            <div className="no-supplier-selected">
                                <ChevronDown size={48} strokeWidth={1} />
                                <h3 className="mt-4">Select a Supplier</h3>
                                <p className="mt-2">Choose a supplier from the list to view their medicines and batches</p>
                            </div>
                        )}
                    </div>
                </div>
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
                                            type="text"
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
                                            onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Terms (days)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={supplierForm.payment_terms}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Address</label>
                                        <input
                                            type="text"
                                            className="form-input"
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

            {/* Edit Supplier Modal */}
            {showEditSupplierModal && editingSupplier && (
                <div className="modal-overlay" onClick={() => setShowEditSupplierModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Supplier</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowEditSupplierModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSupplier}>
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
                                            type="text"
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
                                            onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Payment Terms (days)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={supplierForm.payment_terms}
                                            onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Address</label>
                                        <input
                                            type="text"
                                            className="form-input"
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
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditSupplierModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Medicine with Batch Modal */}
            {showAddMedicineModal && selectedSupplier && (
                <div className="modal-overlay" onClick={() => setShowAddMedicineModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Add New Medicine for {selectedSupplier.name}</h3>
                                <div className="text-xs text-secondary mt-1">
                                    This medicine will be linked to this supplier
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddMedicineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddMedicineWithBatch}>
                            <div className="modal-body">
                                <h4 className="mb-4">Medicine Details</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Medicine Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.name}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Generic Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.generic_name}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, generic_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Manufacturer</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.manufacturer}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, manufacturer: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">HSN Code</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.hsn_code}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, hsn_code: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GST Rate</label>
                                        <select
                                            className="form-select"
                                            value={batchForm.gst_rate}
                                            onChange={(e) => setBatchForm({ ...batchForm, gst_rate: parseInt(e.target.value) as GstRate })}
                                        >
                                            <option value={0}>0% (Exempt)</option>
                                            <option value={5}>5%</option>
                                            <option value={12}>12%</option>
                                            <option value={18}>18%</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.category}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <hr className="my-6" style={{ borderColor: 'var(--border-light)' }} />

                                <h4 className="mb-4">Initial Batch Details</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Batch Number *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.batch_number}
                                            onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Expiry Date *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={batchForm.expiry_date}
                                            onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Purchase Price/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.purchase_price || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, purchase_price: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">MRP/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.mrp || ''}
                                            onChange={(e) => {
                                                const mrp = parseFloat(e.target.value) || 0;
                                                setBatchForm({ ...batchForm, mrp, selling_price: mrp });
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Selling Price/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.selling_price || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, selling_price: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Quantity (Strips) *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={batchForm.quantity || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 0 })}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tablets Per Strip</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={batchForm.tablets_per_strip || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, tablets_per_strip: parseInt(e.target.value) || 10 })}
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Rack</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.rack}
                                            onChange={(e) => setBatchForm({ ...batchForm, rack: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Box</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.box}
                                            onChange={(e) => setBatchForm({ ...batchForm, box: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMedicineModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Medicine
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Batch Modal */}
            {showAddBatchModal && selectedSupplier && (
                <div className="modal-overlay" onClick={() => setShowAddBatchModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Add Batch for {selectedSupplier.name}</h3>
                                <div className="text-xs text-secondary mt-1">
                                    This batch will be linked exclusively to this supplier
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddBatchModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddBatch}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Select Medicine *</label>
                                    <select
                                        className="form-select"
                                        value={selectedMedicineForBatch?.id || ''}
                                        onChange={(e) => setSelectedMedicineForBatch(searchResults.find(m => m.id === parseInt(e.target.value)) || null)}
                                        required
                                    >
                                        <option value="">Search and select a medicine...</option>
                                        {searchResults.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} | {m.manufacturer || 'Unknown'}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        className="form-input mt-2"
                                        placeholder="Type to search medicines..."
                                        value={medicineSearch}
                                        onChange={(e) => {
                                            setMedicineSearch(e.target.value);
                                            searchMedicines(e.target.value);
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Batch Number *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.batch_number}
                                            onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Expiry Date *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={batchForm.expiry_date}
                                            onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Purchase Price/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.purchase_price || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, purchase_price: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">MRP/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.mrp || ''}
                                            onChange={(e) => {
                                                const mrp = parseFloat(e.target.value) || 0;
                                                setBatchForm({ ...batchForm, mrp, selling_price: mrp });
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Selling Price/Strip *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={batchForm.selling_price || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, selling_price: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Quantity (Strips) *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={batchForm.quantity || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 0 })}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tablets Per Strip</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={batchForm.tablets_per_strip || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, tablets_per_strip: parseInt(e.target.value) || 10 })}
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Rack</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.rack}
                                            onChange={(e) => setBatchForm({ ...batchForm, rack: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Box</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={batchForm.box}
                                            onChange={(e) => setBatchForm({ ...batchForm, box: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBatchModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!selectedMedicineForBatch}>
                                    Add Batch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
