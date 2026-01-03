// =====================================================
// Inventory Page
// Medicine and Stock Management
// =====================================================

import {
    AlertTriangle,
    Clock,
    Edit,
    MapPin,
    Package,
    Pill,
    Plus,
    Search,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import {
    createBatch,
    createMedicine,
    deleteMedicine,
    getAllStock,
    getExpiringItems,
    getLowStockItems,
    getMedicines,
    getNonMovingItems,
    getScheduledMedicines,
    updateMedicine
} from '../services/inventory.service';
import { useAuthStore } from '../stores';
import type { CreateBatchInput, CreateMedicineInput, GstRate, Medicine, StockItem, Supplier } from '../types';
import { formatCurrency, formatDate, getExpiryStatusInfo, getStockStatusInfo } from '../utils';

type FilterType = 'all' | 'expiring' | 'low-stock' | 'non-moving' | 'scheduled';

export function Inventory() {
    const { showToast } = useToast();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilter, setActiveFilter] = useState<FilterType>(
        (searchParams.get('filter') as FilterType) || 'all'
    );

    // Pagination constants
    const ITEMS_PER_PAGE = 50;
    const [showAddMedicineModal, setShowAddMedicineModal] = useState(false);
    const [showEditMedicineModal, setShowEditMedicineModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAddBatchModal, setShowAddBatchModal] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

    // Form state for new medicine
    const [medicineForm, setMedicineForm] = useState<CreateMedicineInput>({
        name: '',
        generic_name: '',
        manufacturer: '',
        hsn_code: '3004',
        gst_rate: 12,
        taxability: 'TAXABLE',
        category: '',
        unit: 'PCS',
        reorder_level: 10,
        is_schedule: false
    });

    // Form state for new batch
    const [batchForm, setBatchForm] = useState<CreateBatchInput>({
        medicine_id: 0,
        batch_number: '',
        expiry_date: '',
        purchase_price: 0,
        mrp: 0,
        selling_price: 0,
        price_type: 'INCLUSIVE',
        quantity: 0,
        tablets_per_strip: 10,
        rack: '',
        box: ''
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            let items: StockItem[];

            switch (activeFilter) {
                case 'expiring':
                    items = await getExpiringItems(30);
                    break;
                case 'low-stock':
                    items = await getLowStockItems();
                    break;
                case 'non-moving':
                    items = await getNonMovingItems(30);
                    break;
                case 'scheduled':
                    items = await getScheduledMedicines();
                    break;
                default:
                    items = await getAllStock();
            }

            setStockItems(items);
            setFilteredItems(items);

            const [meds, suppliersData] = await Promise.all([
                getMedicines(),
                query<Supplier>('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name', [])
            ]);
            setMedicines(meds);
            setSuppliers(suppliersData);
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [activeFilter]);

    useEffect(() => {
        if (!searchQuery) {
            setFilteredItems(stockItems);
            return;
        }

        const query = searchQuery.toLowerCase();
        setFilteredItems(
            stockItems.filter(item =>
                item.medicine_name.toLowerCase().includes(query) ||
                item.batch_number.toLowerCase().includes(query) ||
                item.manufacturer?.toLowerCase().includes(query)
            )
        );
    }, [searchQuery, stockItems]);

    const handleFilterChange = (filter: FilterType) => {
        setActiveFilter(filter);
        setSearchParams(filter === 'all' ? {} : { filter });
        setCurrentPage(1); // Reset to first page on filter change
    };

    // Paginated items
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleAddMedicine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await createMedicine(medicineForm);
            setShowAddMedicineModal(false);
            setMedicineForm({
                name: '',
                generic_name: '',
                manufacturer: '',
                hsn_code: '3004',
                gst_rate: 12,
                taxability: 'TAXABLE',
                category: '',
                unit: 'PCS',
                reorder_level: 10,
                is_schedule: false
            });
            showToast('success', `Medicine "${medicineForm.name}" added successfully!`);
            loadData();
        } catch (error) {
            console.error('Failed to add medicine:', error);
            showToast('error', 'Failed to add medicine. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditMedicine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMedicine || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await updateMedicine(editingMedicine.id, medicineForm);
            setShowEditMedicineModal(false);
            setEditingMedicine(null);
            showToast('success', `Medicine "${medicineForm.name}" updated successfully!`);
            loadData();
        } catch (error) {
            console.error('Failed to update medicine:', error);
            showToast('error', 'Failed to update medicine. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMedicine = async () => {
        if (!editingMedicine || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const medicineName = editingMedicine.name;
            await deleteMedicine(editingMedicine.id);
            setShowDeleteConfirm(false);
            setEditingMedicine(null);
            showToast('success', `Medicine "${medicineName}" deleted successfully!`);
            loadData();
        } catch (error) {
            console.error('Failed to delete medicine:', error);
            showToast('error', 'Failed to delete medicine. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditMedicineModal = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setMedicineForm({
            name: medicine.name,
            generic_name: medicine.generic_name || '',
            manufacturer: medicine.manufacturer || '',
            hsn_code: medicine.hsn_code,
            gst_rate: medicine.gst_rate,
            taxability: medicine.taxability,
            category: medicine.category || '',
            unit: medicine.unit,
            reorder_level: medicine.reorder_level,
            is_schedule: medicine.is_schedule || false
        });
        setShowEditMedicineModal(true);
    };

    const openDeleteConfirm = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setShowDeleteConfirm(true);
    };

    const handleAddBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMedicine || isSubmitting) return;

        // Validate supplier if provided
        if (selectedSupplierId > 0 && !invoiceNumber) {
            showToast('error', 'Please enter invoice number when supplier is selected');
            return;
        }

        setIsSubmitting(true);
        try {
            // Quantity is stored directly, tablets_per_strip is used for display

            // Create batch first
            const batchId = await createBatch({ ...batchForm, medicine_id: selectedMedicine.id });

            // If supplier is selected, create purchase entry automatically
            if (selectedSupplierId > 0) {
                const subtotal = batchForm.quantity * batchForm.purchase_price;
                const gstRate = selectedMedicine.gst_rate;
                const halfGstRate = gstRate / 2;
                const cgst = (subtotal * halfGstRate) / 100;
                const sgst = (subtotal * halfGstRate) / 100;
                const totalGst = cgst + sgst;
                const grandTotal = subtotal + totalGst;

                // Create purchase entry
                const purchaseResult = await execute(
                    `INSERT INTO purchases (
                        invoice_number, invoice_date, supplier_id, user_id,
                        subtotal, cgst_amount, sgst_amount, total_gst, grand_total,
                        payment_status, paid_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
                    [
                        invoiceNumber,
                        invoiceDate,
                        selectedSupplierId,
                        user?.id || 1,
                        subtotal,
                        cgst,
                        sgst,
                        totalGst,
                        grandTotal
                    ]
                );

                const purchaseId = purchaseResult.lastInsertId;

                // Link batch to purchase
                await execute(
                    `UPDATE batches SET purchase_id = ?, supplier_id = ? WHERE id = ?`,
                    [purchaseId, selectedSupplierId, batchId]
                );

                // Create purchase item
                await execute(
                    `INSERT INTO purchase_items (
                        purchase_id, medicine_id, batch_id,
                        medicine_name, batch_number, expiry_date,
                        quantity, free_quantity,
                        purchase_price, mrp, discount_percent,
                        gst_rate, cgst_amount, sgst_amount, total_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?)`,
                    [
                        purchaseId,
                        selectedMedicine.id,
                        batchId,
                        selectedMedicine.name,
                        batchForm.batch_number,
                        batchForm.expiry_date,
                        batchForm.quantity,
                        batchForm.purchase_price,
                        batchForm.mrp,
                        gstRate,
                        cgst,
                        sgst,
                        grandTotal
                    ]
                );

                showToast('success', `Stock added and purchase entry created for "${selectedMedicine.name}" (Batch: ${batchForm.batch_number})`);
            } else {
                showToast('success', `Stock added for "${selectedMedicine.name}" (Batch: ${batchForm.batch_number})`);
            }

            setShowAddBatchModal(false);
            setBatchForm({
                medicine_id: 0,
                batch_number: '',
                expiry_date: '',
                purchase_price: 0,
                mrp: 0,
                selling_price: 0,
                price_type: 'INCLUSIVE',
                quantity: 0,
                tablets_per_strip: 10,
                rack: '',
                box: ''
            });
            setSelectedMedicine(null);
            setSelectedSupplierId(0);
            setInvoiceNumber('');
            setInvoiceDate(new Date().toISOString().split('T')[0]);
            loadData();
        } catch (error) {
            console.error('Failed to add batch:', error);
            showToast('error', 'Failed to add stock. Please check your inputs.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Inventory</h1>
                <div className="page-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSelectedMedicine(null);
                            setShowAddBatchModal(true);
                        }}
                    >
                        <Plus size={18} />
                        Add Stock
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddMedicineModal(true)}
                    >
                        <Plus size={18} />
                        New Medicine
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .inventory-filters {
            display: flex;
            gap: var(--space-2);
            margin-bottom: var(--space-4);
            flex-wrap: wrap;
          }
          
          .filter-btn {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-4);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-full);
            background: var(--bg-secondary);
            cursor: pointer;
            transition: all var(--transition-fast);
            font-size: var(--text-sm);
          }
          
          .filter-btn:hover {
            border-color: var(--color-primary-300);
          }
          
          .filter-btn.active {
            background: var(--color-primary-600);
            color: var(--text-inverse);
            border-color: var(--color-primary-600);
          }
          
          .filter-btn.danger.active {
            background: var(--color-danger-600);
            border-color: var(--color-danger-600);
          }
          
          .filter-btn.warning.active {
            background: var(--color-warning-600);
            border-color: var(--color-warning-600);
          }
          
          .inventory-search {
            position: relative;
            max-width: 400px;
            margin-bottom: var(--space-4);
          }
          
          .inventory-search input {
            padding-left: var(--space-10);
          }
          
          .inventory-search-icon {
            position: absolute;
            left: var(--space-3);
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
          }
          
          .stock-grid {
            display: grid;
            gap: var(--space-3);
          }
          
          .stock-row {
            display: grid;
            grid-template-columns: 2fr 1fr 100px 80px 80px 100px 120px 100px 80px;
            gap: var(--space-3);
            align-items: center;
            padding: var(--space-3) var(--space-4);
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
          }
          
          .stock-row:hover {
            border-color: var(--color-primary-200);
          }
          
          .stock-header {
            font-weight: var(--font-semibold);
            color: var(--text-secondary);
            font-size: var(--text-sm);
            background: transparent;
            border: none;
          }
          
          .medicine-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          
          .medicine-name {
            font-weight: var(--font-medium);
          }
          
          .medicine-meta {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }
          
          .location-badge {
            display: inline-flex;
            align-items: center;
            gap: var(--space-1);
            font-size: var(--text-xs);
            color: var(--text-secondary);
          }
          
          .action-btns {
            display: flex;
            gap: var(--space-1);
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

                {/* Filters */}
                <div className="inventory-filters">
                    <button
                        className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('all')}
                    >
                        <Package size={16} />
                        All Stock
                    </button>
                    <button
                        className={`filter-btn danger ${activeFilter === 'expiring' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('expiring')}
                    >
                        <AlertTriangle size={16} />
                        Expiring Soon
                    </button>
                    <button
                        className={`filter-btn warning ${activeFilter === 'low-stock' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('low-stock')}
                    >
                        <Package size={16} />
                        Low Stock
                    </button>
                    <button
                        className={`filter-btn ${activeFilter === 'non-moving' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('non-moving')}
                    >
                        <Clock size={16} />
                        Non-Moving
                    </button>
                    <button
                        className={`filter-btn ${activeFilter === 'scheduled' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('scheduled')}
                        title="Schedule H/H1 Drugs"
                    >
                        <Pill size={16} />
                        Schedule Drugs
                    </button>
                </div>

                {/* Search */}
                <div className="inventory-search">
                    <Search className="inventory-search-icon" size={18} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search medicines..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Stock Grid */}
                <div className="stock-grid">
                    <div className="stock-row stock-header">
                        <span>Medicine</span>
                        <span>Batch</span>
                        <span>Expiry</span>
                        <span>Tablets</span>
                        <span>Strips</span>
                        <span>MRP</span>
                        <span>Location</span>
                        <span>Status</span>
                        <span>Actions</span>
                    </div>

                    {isLoading ? (
                        <div className="empty-state">
                            <div className="loading-spinner" />
                        </div>
                    ) : paginatedItems.length > 0 ? (
                        paginatedItems.map((item) => {
                            const stockInfo = getStockStatusInfo(item.stock_status);
                            const expiryInfo = getExpiryStatusInfo(item.expiry_status);
                            const medicine = medicines.find(m => m.id === item.medicine_id);

                            return (
                                <div key={item.batch_id} className="stock-row">
                                    <div className="medicine-info">
                                        <span className="medicine-name">{item.medicine_name}</span>
                                        <span className="medicine-meta">
                                            {item.manufacturer} | HSN: {item.hsn_code} | GST: {item.gst_rate}%
                                        </span>
                                    </div>
                                    <span className="font-mono text-sm">{item.batch_number}</span>
                                    <span className={`text-sm ${item.expiry_status !== 'OK' ? 'text-danger font-semibold' : ''}`}>
                                        {formatDate(item.expiry_date)}
                                    </span>
                                    <span className={`font-mono font-semibold ${item.stock_status !== 'IN_STOCK' ? 'text-warning' : ''}`}>
                                        {item.quantity}
                                    </span>
                                    <span className="font-mono text-sm">
                                        {Math.floor(item.quantity / (item.tablets_per_strip || 10))}
                                    </span>
                                    <span className="font-mono">{formatCurrency(item.mrp)}</span>
                                    <span className="location-badge">
                                        <MapPin size={12} />
                                        {item.rack || '-'} / {item.box || '-'}
                                    </span>
                                    <span className={`badge badge-${item.expiry_status !== 'OK' ? 'danger' : stockInfo.color === 'green' ? 'success' : 'warning'}`}>
                                        {item.expiry_status !== 'OK' ? expiryInfo.label : stockInfo.label}
                                    </span>
                                    <div className="action-btns">
                                        {medicine && (
                                            <>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => openEditMedicineModal(medicine)}
                                                    title="Edit Medicine"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => openDeleteConfirm(medicine)}
                                                    title="Delete Medicine"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <Package size={48} strokeWidth={1} />
                            <p className="mt-4">No items found</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredItems.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Add Medicine Modal */}
            {showAddMedicineModal && (
                <div className="modal-overlay" onClick={() => setShowAddMedicineModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Medicine</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddMedicineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddMedicine}>
                            <div className="modal-body">
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
                                        <label className="form-label">HSN Code *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.hsn_code}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, hsn_code: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GST Rate *</label>
                                        <select
                                            className="form-select"
                                            value={medicineForm.gst_rate}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, gst_rate: parseInt(e.target.value) as GstRate })}
                                        >
                                            <option value={0}>0% (Exempt)</option>
                                            <option value={5}>5%</option>
                                            <option value={12}>12%</option>
                                            <option value={18}>18%</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <select
                                            className="form-select"
                                            value={medicineForm.unit}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, unit: e.target.value })}
                                        >
                                            <option value="PCS">Pieces</option>
                                            <option value="STRIP">Strip</option>
                                            <option value="BOX">Box</option>
                                            <option value="BOTTLE">Bottle</option>
                                            <option value="TUBE">Tube</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.category}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
                                            placeholder="e.g., Antibiotics, Pain Relief"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reorder Level</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={medicineForm.reorder_level === 0 ? '' : medicineForm.reorder_level}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, reorder_level: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={medicineForm.is_schedule || false}
                                                onChange={(e) => setMedicineForm({ ...medicineForm, is_schedule: e.target.checked })}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            <span style={{ fontWeight: 500 }}>Schedule H/H1 Drug</span>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                (Requires patient details when billing)
                                            </span>
                                        </label>
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

            {/* Edit Medicine Modal */}
            {showEditMedicineModal && editingMedicine && (
                <div className="modal-overlay" onClick={() => setShowEditMedicineModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Medicine</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowEditMedicineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditMedicine}>
                            <div className="modal-body">
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
                                        <label className="form-label">HSN Code *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.hsn_code}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, hsn_code: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GST Rate *</label>
                                        <select
                                            className="form-select"
                                            value={medicineForm.gst_rate}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, gst_rate: parseInt(e.target.value) as GstRate })}
                                        >
                                            <option value={0}>0% (Exempt)</option>
                                            <option value={5}>5%</option>
                                            <option value={12}>12%</option>
                                            <option value={18}>18%</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <select
                                            className="form-select"
                                            value={medicineForm.unit}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, unit: e.target.value })}
                                        >
                                            <option value="PCS">Pieces</option>
                                            <option value="STRIP">Strip</option>
                                            <option value="BOX">Box</option>
                                            <option value="BOTTLE">Bottle</option>
                                            <option value="TUBE">Tube</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={medicineForm.category}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })}
                                            placeholder="e.g., Antibiotics, Pain Relief"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reorder Level</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={medicineForm.reorder_level === 0 ? '' : medicineForm.reorder_level}
                                            onChange={(e) => setMedicineForm({ ...medicineForm, reorder_level: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={medicineForm.is_schedule || false}
                                                onChange={(e) => setMedicineForm({ ...medicineForm, is_schedule: e.target.checked })}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            <span style={{ fontWeight: 500 }}>Schedule H/H1 Drug</span>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                (Requires patient details when billing)
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditMedicineModal(false)}>
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

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && editingMedicine && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Medicine</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>{editingMedicine.name}</strong>?</p>
                            <p className="text-secondary mt-2">This will also remove all associated batches from inventory.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleDeleteMedicine}>
                                Delete Medicine
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Batch Modal */}
            {showAddBatchModal && (
                <div className="modal-overlay" onClick={() => {
                    setShowAddBatchModal(false);
                    setSelectedSupplierId(0);
                    setInvoiceNumber('');
                    setInvoiceDate(new Date().toISOString().split('T')[0]);
                }}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Add Stock / New Batch</h3>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Add new stock for existing medicines. For new medicines, use "New Medicine" first.
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => {
                                setShowAddBatchModal(false);
                                setSelectedSupplierId(0);
                                setInvoiceNumber('');
                                setInvoiceDate(new Date().toISOString().split('T')[0]);
                            }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddBatch} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="modal-body">
                                {/* Section 1: Purchase Source */}
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <div style={{
                                        padding: 'var(--space-4)',
                                        background: 'var(--color-primary-50)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-primary-100)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-2)',
                                            marginBottom: 'var(--space-3)',
                                            color: 'var(--color-primary-700)',
                                            fontWeight: 600,
                                            fontSize: 'var(--text-sm)'
                                        }}>
                                            <Package size={16} />
                                            Purchase Source (Optional)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Supplier</label>
                                                <select
                                                    className="form-select"
                                                    value={selectedSupplierId}
                                                    onChange={(e) => {
                                                        const supplierId = parseInt(e.target.value);
                                                        setSelectedSupplierId(supplierId);
                                                        if (supplierId === 0) {
                                                            setInvoiceNumber('');
                                                        }
                                                    }}
                                                >
                                                    <option value={0}>No Supplier (Direct Entry)</option>
                                                    {suppliers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {selectedSupplierId > 0 && (
                                                <>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label">Invoice Number *</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={invoiceNumber}
                                                            onChange={(e) => setInvoiceNumber(e.target.value)}
                                                            required={selectedSupplierId > 0}
                                                            placeholder="INV-001"
                                                        />
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label">Invoice Date *</label>
                                                        <input
                                                            type="date"
                                                            className="form-input"
                                                            value={invoiceDate}
                                                            onChange={(e) => setInvoiceDate(e.target.value)}
                                                            required={selectedSupplierId > 0}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Medicine Selection */}
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h4 style={{
                                        fontSize: 'var(--text-xs)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: 'var(--text-tertiary)',
                                        marginBottom: 'var(--space-3)',
                                        fontWeight: 600
                                    }}>
                                        Medicine Details
                                    </h4>
                                    <div className="form-group">
                                        <label className="form-label">Select Medicine *</label>
                                        <select
                                            className="form-select form-input-lg"
                                            value={selectedMedicine?.id ?? ''}
                                            onChange={(e) => setSelectedMedicine(medicines.find(m => m.id === parseInt(e.target.value)) ?? null)}
                                            required
                                            style={{ fontWeight: 500 }}
                                        >
                                            <option value="">Select a medicine...</option>
                                            {medicines.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.gst_rate}% GST)</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                                    {/* Left Column: Batch & Pricing */}
                                    <div>
                                        <h4 style={{
                                            fontSize: 'var(--text-xs)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: 'var(--text-tertiary)',
                                            marginBottom: 'var(--space-3)',
                                            fontWeight: 600
                                        }}>
                                            Batch & Pricing
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Batch Number *</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={batchForm.batch_number}
                                                    onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                                                    required
                                                    placeholder="e.g. B-123"
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
                                                <label className="form-label">Purchase Price / Strip *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-tertiary)' }}>₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="form-input"
                                                        style={{ paddingLeft: 25 }}
                                                        value={batchForm.purchase_price || ''}
                                                        onChange={(e) => setBatchForm({ ...batchForm, purchase_price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">MRP / Strip *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-tertiary)' }}>₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="form-input"
                                                        style={{ paddingLeft: 25 }}
                                                        value={batchForm.mrp || ''}
                                                        onChange={(e) => {
                                                            const mrp = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                            setBatchForm({ ...batchForm, mrp, selling_price: mrp });
                                                        }}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                <label className="form-label">Selling Price / Strip *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-tertiary)' }}>₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="form-input"
                                                        style={{ paddingLeft: 25, fontWeight: 'bold', color: 'var(--color-primary-600)' }}
                                                        value={batchForm.selling_price || ''}
                                                        onChange={(e) => setBatchForm({ ...batchForm, selling_price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-hint">Usually same as MRP</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Quantity & Location */}
                                    <div>
                                        <h4 style={{
                                            fontSize: 'var(--text-xs)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: 'var(--text-tertiary)',
                                            marginBottom: 'var(--space-3)',
                                            fontWeight: 600
                                        }}>
                                            Quantity & Storage
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Quantity (Strips) *</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={batchForm.quantity || ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                                                    required
                                                    min="0"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Tablets / Strip</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={batchForm.tablets_per_strip ?? ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, tablets_per_strip: e.target.value === '' ? 10 : parseInt(e.target.value) })}
                                                    min="1"
                                                    placeholder="10"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Rack Location</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={batchForm.rack}
                                                    onChange={(e) => setBatchForm({ ...batchForm, rack: e.target.value })}
                                                    placeholder="e.g., A1"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Box Location</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={batchForm.box}
                                                    onChange={(e) => setBatchForm({ ...batchForm, box: e.target.value })}
                                                    placeholder="e.g., 1"
                                                />
                                            </div>
                                            <div style={{
                                                gridColumn: '1 / -1',
                                                padding: 'var(--space-3)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                marginTop: 'var(--space-2)'
                                            }}>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>Total Tablets</div>
                                                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                    {((batchForm.quantity || 0) * (batchForm.tablets_per_strip || 10)).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowAddBatchModal(false);
                                    setSelectedSupplierId(0);
                                    setInvoiceNumber('');
                                    setInvoiceDate(new Date().toISOString().split('T')[0]);
                                }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!selectedMedicine || (selectedSupplierId > 0 && !invoiceNumber)}>
                                    <Plus size={18} />
                                    Add Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
