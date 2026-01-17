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
import { useCallback, useEffect, useState } from 'react';
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
    getNonMovingItems,
    getScheduledMedicines,
    updateMedicine
} from '../services/inventory.service';
import { useAuthStore } from '../stores';
import type { CreateBatchInput, CreateMedicineInput, GstRate, Medicine, StockItem, Supplier } from '../types';
import { formatCurrency, formatDate, getExpiryStatusInfo, getStockStatusInfo } from '../utils';

type FilterType = 'all' | 'expiring' | 'low-stock' | 'non-moving' | 'scheduled' | 'other-products';

export function Inventory() {
    const { showToast } = useToast();
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
    const [medicineSearchResults, setMedicineSearchResults] = useState<Medicine[]>([]);
    const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
    const [medicineCount, setMedicineCount] = useState<number>(0);
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

    // Multi-item stock cart
    interface StockCartItem {
        medicine: Medicine;
        batch_number: string;
        expiry_date: string;
        purchase_price: number;
        mrp: number;
        selling_price: number;
        gst_rate: GstRate;
        is_schedule: boolean;
        quantity: number;
        free_quantity: number;
        tablets_per_strip: number;
        rack: string;
        box: string;
    }
    const [stockCart, setStockCart] = useState<StockCartItem[]>([]);
    const [isNonMedicine, setIsNonMedicine] = useState(false);

    // Form state for new medicine (simplified - GST now per-batch)
    const [medicineForm, setMedicineForm] = useState<CreateMedicineInput>({
        name: '',
        generic_name: '',
        manufacturer: '',
        hsn_code: '3004',
        category: '',
        unit: 'PCS',
        reorder_level: 10
    });

    // Form state for new batch (includes gst_rate and is_schedule)
    const [batchForm, setBatchForm] = useState<CreateBatchInput>({
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
        free_quantity: 0,
        tablets_per_strip: 10,
        rack: '',
        box: ''
    });

    const loadData = useCallback(async () => {
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
                case 'other-products':
                    // Filter for non-medicine products (no manufacturer/generic_name)
                    const allItems = await getAllStock();
                    items = allItems.filter(item => !item.manufacturer && !item.generic_name);
                    break;
                default:
                    items = await getAllStock();
            }

            setStockItems(items);
            setFilteredItems(items);

            // Only load suppliers, not all medicines (too many)
            const suppliersData = await query<Supplier>('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name', []);
            setSuppliers(suppliersData);
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
        setIsLoading(false);
    }, [activeFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Load medicine count when Add Stock modal opens
    const loadMedicineCount = useCallback(async () => {
        try {
            const result = await query<{ count: number }>('SELECT COUNT(*) as count FROM medicines WHERE is_active = 1', []);
            const count = result[0]?.count || 0;
            console.log('[MedicineCount] Total medicines in database:', count);
            setMedicineCount(count);
        } catch (err) {
            console.error('[MedicineCount] Failed to load count:', err);
        }
    }, []);

    // Search medicines for Add Batch modal
    const searchMedicinesForBatch = async (term: string) => {
        setMedicineSearchQuery(term);
        if (term.length < 1) {
            setMedicineSearchResults([]);
            return;
        }
        try {
            const searchTerm = `%${term}%`;
            console.log('[MedicineSearch] Searching for:', term);
            const results = await query<Medicine>(
                `SELECT * FROM medicines WHERE is_active = 1 
                 AND (name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ?)
                 ORDER BY name LIMIT 20`,
                [searchTerm, searchTerm, searchTerm]
            );
            console.log('[MedicineSearch] Found:', results.length, 'results');
            setMedicineSearchResults(results);
        } catch (error) {
            console.error('[MedicineSearch] Failed to search medicines:', error);
            showToast('error', 'Failed to search medicines');
        }
    };

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

    // Load medicine count when Add Stock modal opens
    useEffect(() => {
        if (showAddBatchModal) {
            loadMedicineCount();
        }
    }, [showAddBatchModal, loadMedicineCount]);

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
                category: '',
                unit: 'PCS',
                reorder_level: 10
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
            category: medicine.category || '',
            unit: medicine.unit,
            reorder_level: medicine.reorder_level
        });
        setShowEditMedicineModal(true);
    };

    const openDeleteConfirm = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setShowDeleteConfirm(true);
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

          .toggle-switch {
            position: relative;
            width: 48px;
            height: 24px;
            background: var(--border-medium);
            border-radius: var(--radius-full);
            cursor: pointer;
            transition: all var(--transition-fast);
            flex-shrink: 0;
          }
          
          .toggle-switch.active {
            background: var(--color-primary-500);
          }
          
          .toggle-switch::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: all var(--transition-fast);
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          
          .toggle-switch.active::after {
            left: 26px;
          }
          
          /* Mini variant for dense forms */
          .toggle-switch.mini {
            width: 36px;
            height: 20px;
          }
          
          .toggle-switch.mini::after {
            width: 16px;
            height: 16px;
          }
          
          .toggle-switch.mini.active::after {
            left: 18px;
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
                    <button
                        className={`filter-btn ${activeFilter === 'other-products' ? 'active' : ''}`}
                        onClick={() => handleFilterChange('other-products')}
                        title="Non-medicine products (FMCG, etc.)"
                    >
                        <Package size={16} />
                        Other Products
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
                        <span>{activeFilter === 'other-products' ? 'Product' : 'Medicine'}</span>
                        <span>Batch</span>
                        <span>Expiry</span>
                        <span>{activeFilter === 'other-products' ? 'Units' : 'Tablets'}</span>
                        <span>{activeFilter === 'other-products' ? 'Packs' : 'Strips'}</span>
                        <span>MRP</span>
                        <span>Location</span>
                        <span style={{ textAlign: 'center' }}>Status</span>
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
                                    <span style={{ textAlign: 'center' }}>
                                        <span className={`badge badge-${item.expiry_status !== 'OK' ? 'danger' : stockInfo.color === 'green' ? 'success' : 'warning'}`}>
                                            {item.expiry_status !== 'OK' ? expiryInfo.label : stockInfo.label}
                                        </span>
                                    </span>
                                    <div className="action-btns">
                                        <button
                                            className="action-btn"
                                            onClick={async () => {
                                                // Fetch medicine on demand
                                                const [med] = await query<Medicine>('SELECT * FROM medicines WHERE id = ?', [item.medicine_id]);
                                                if (med) openEditMedicineModal(med);
                                            }}
                                            title="Edit Medicine"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            onClick={async () => {
                                                const [med] = await query<Medicine>('SELECT * FROM medicines WHERE id = ?', [item.medicine_id]);
                                                if (med) openDeleteConfirm(med);
                                            }}
                                            title="Delete Medicine"
                                        >
                                            <Trash2 size={16} />
                                        </button>
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
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                                            <strong>Note:</strong> GST Rate and Schedule status will be set per-batch when adding stock.
                                        </p>
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
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                                            <strong>Note:</strong> GST Rate and Schedule status are set per-batch.
                                        </p>
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

            {/* Add Stock Modal - Multi-Item Support */}
            {showAddBatchModal && (
                <div className="modal-overlay" onClick={() => {
                    setShowAddBatchModal(false);
                    setSelectedSupplierId(0);
                    setInvoiceNumber('');
                    setInvoiceDate(new Date().toISOString().split('T')[0]);
                    setMedicineSearchQuery('');
                    setMedicineSearchResults([]);
                    setSelectedMedicine(null);
                    setStockCart([]);
                    setBatchForm({
                        medicine_id: 0, batch_number: '', expiry_date: '',
                        purchase_price: 0, mrp: 0, selling_price: 0, price_type: 'INCLUSIVE',
                        gst_rate: 12, is_schedule: false, quantity: 0, free_quantity: 0, tablets_per_strip: 10, rack: '', box: ''
                    });
                }}>
                    <div className="modal" style={{ maxWidth: '1100px', width: '95vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <h3 className="modal-title">Add Stock</h3>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Add {isNonMedicine ? 'products' : 'medicines'} to cart, then save all at once
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                {/* Medicine/Non-Medicine Toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--bg-tertiary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                                    <span
                                        style={{ fontSize: 'var(--text-xs)', fontWeight: !isNonMedicine ? 600 : 400, color: !isNonMedicine ? 'var(--color-primary-600)' : 'var(--text-tertiary)', cursor: 'pointer' }}
                                        onClick={() => setIsNonMedicine(false)}
                                    >
                                        Medicine
                                    </span>
                                    <div
                                        className={`toggle-switch mini ${isNonMedicine ? 'active' : ''}`}
                                        onClick={() => setIsNonMedicine(!isNonMedicine)}
                                    />
                                    <span
                                        style={{ fontSize: 'var(--text-xs)', fontWeight: isNonMedicine ? 600 : 400, color: isNonMedicine ? 'var(--color-primary-600)' : 'var(--text-tertiary)', cursor: 'pointer' }}
                                        onClick={() => setIsNonMedicine(true)}
                                    >
                                        Other Product
                                    </span>
                                </div>
                                <button className="btn btn-ghost btn-icon" onClick={() => {
                                    setShowAddBatchModal(false);
                                    setStockCart([]);
                                }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-5)', padding: 'var(--space-4)' }}>
                            {/* Left: Form & Cart Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                                {/* MEDICINE MODE: Search & Select */}
                                {!isNonMedicine && (
                                    <div style={{ position: 'relative' }}>
                                        <label className="form-label" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>
                                                <Pill size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                                                Search & Add Medicine
                                            </span>
                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: medicineCount > 0 ? 'var(--color-success-600)' : 'var(--color-error-500)' }}>
                                                {medicineCount.toLocaleString()} medicines available
                                            </span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ paddingLeft: 40, fontSize: 'var(--text-base)' }}
                                                placeholder="Type medicine name to search..."
                                                value={medicineSearchQuery}
                                                onChange={(e) => searchMedicinesForBatch(e.target.value)}
                                            />
                                        </div>
                                        {/* Autocomplete Dropdown */}
                                        {medicineSearchResults.length > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                boxShadow: 'var(--shadow-lg)',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                zIndex: 100
                                            }}>
                                                {medicineSearchResults.map((m: Medicine) => (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => {
                                                            setSelectedMedicine(m);
                                                            setMedicineSearchQuery('');
                                                            setMedicineSearchResults([]);
                                                        }}
                                                        style={{
                                                            padding: 'var(--space-2) var(--space-3)',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid var(--border-color)',
                                                            transition: 'background 0.1s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{m.name}</div>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                            {m.manufacturer || 'Unknown'} • {m.category || 'General'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* OTHER PRODUCTS MODE: Inline Entry Form */}
                                {isNonMedicine && !selectedMedicine && (
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-4)',
                                        border: '1px solid var(--color-primary-200)'
                                    }}>
                                        <div style={{ marginBottom: 'var(--space-3)' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--color-primary-700)', fontSize: 'var(--text-sm)' }}>
                                                <Package size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                                                Add New Product
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                                                Enter product details directly
                                            </div>
                                        </div>

                                        {/* Product Name & Category Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Product Name *</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={medicineForm.name} placeholder="e.g., Shampoo, Noodles"
                                                    onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Category</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={medicineForm.category || ''} placeholder="FMCG"
                                                    onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value })} />
                                            </div>
                                        </div>

                                        {/* Batch & Pricing Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Batch No *</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.batch_number} placeholder="B-123"
                                                    onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Expiry *</label>
                                                <input type="date" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.expiry_date}
                                                    onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>GST %</label>
                                                <select className="form-select" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.gst_rate}
                                                    onChange={(e) => setBatchForm({ ...batchForm, gst_rate: parseInt(e.target.value) as GstRate })}>
                                                    <option value={0}>0%</option>
                                                    <option value={5}>5%</option>
                                                    <option value={12}>12%</option>
                                                    <option value={18}>18%</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>HSN Code</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={medicineForm.hsn_code || ''} placeholder="3304"
                                                    onChange={(e) => setMedicineForm({ ...medicineForm, hsn_code: e.target.value })} />
                                            </div>
                                        </div>

                                        {/* Pricing Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Purchase ₹ *</label>
                                                <input type="number" step="0.01" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.purchase_price || ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, purchase_price: Math.max(0, parseFloat(e.target.value) || 0) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>MRP ₹ *</label>
                                                <input type="number" step="0.01" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.mrp || ''}
                                                    onChange={(e) => {
                                                        const mrp = Math.max(0, parseFloat(e.target.value) || 0);
                                                        setBatchForm({ ...batchForm, mrp, selling_price: mrp });
                                                    }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Qty *</label>
                                                <input type="number" min="1" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.quantity || ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, quantity: Math.max(0, parseInt(e.target.value) || 0) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Free (pcs)</label>
                                                <input type="number" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.free_quantity || ''} placeholder="0"
                                                    onChange={(e) => setBatchForm({ ...batchForm, free_quantity: Math.max(0, parseInt(e.target.value) || 0) })} />
                                            </div>
                                        </div>

                                        {/* Location Row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Pack Size</label>
                                                <input type="number" min="1" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.tablets_per_strip} placeholder="1"
                                                    onChange={(e) => setBatchForm({ ...batchForm, tablets_per_strip: Math.max(1, parseInt(e.target.value) || 1) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Rack</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.rack || ''} placeholder="A1"
                                                    onChange={(e) => setBatchForm({ ...batchForm, rack: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Box</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.box || ''} placeholder="B2"
                                                    onChange={(e) => setBatchForm({ ...batchForm, box: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                {(batchForm.quantity > 0 || batchForm.free_quantity) && (
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '18px 0 0 0' }}>
                                                        Total: <strong>{((batchForm.quantity || 0) * (batchForm.tablets_per_strip || 1)) + (batchForm.free_quantity || 0)}</strong> units
                                                        {(batchForm.free_quantity || 0) > 0 && <span style={{ color: 'var(--color-success-600)' }}> (+{batchForm.free_quantity} free)</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Add to Cart Button */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                                            <button type="button" className="btn btn-primary btn-sm"
                                                disabled={!medicineForm.name || !batchForm.batch_number || !batchForm.expiry_date || !batchForm.quantity || batchForm.mrp <= 0}
                                                onClick={async () => {
                                                    if (!medicineForm.name || !batchForm.batch_number || !batchForm.expiry_date || batchForm.quantity <= 0 || batchForm.mrp <= 0) {
                                                        showToast('error', 'Please fill required fields');
                                                        return;
                                                    }
                                                    // Create product in DB first
                                                    try {
                                                        const productId = await createMedicine({
                                                            name: medicineForm.name,
                                                            category: medicineForm.category || 'General',
                                                            hsn_code: medicineForm.hsn_code || '3304',
                                                            unit: 'PCS',
                                                            reorder_level: 10
                                                        });
                                                        const newMedicine: Medicine = {
                                                            id: productId,
                                                            name: medicineForm.name,
                                                            hsn_code: medicineForm.hsn_code || '3304',
                                                            category: medicineForm.category || 'General',
                                                            unit: 'PCS',
                                                            reorder_level: 10,
                                                            is_active: true,
                                                            created_at: new Date().toISOString(),
                                                            updated_at: new Date().toISOString()
                                                        };
                                                        // Add to cart
                                                        setStockCart([...stockCart, {
                                                            medicine: newMedicine,
                                                            batch_number: batchForm.batch_number,
                                                            expiry_date: batchForm.expiry_date,
                                                            purchase_price: batchForm.purchase_price,
                                                            mrp: batchForm.mrp,
                                                            selling_price: batchForm.selling_price,
                                                            gst_rate: batchForm.gst_rate,
                                                            is_schedule: false,
                                                            quantity: batchForm.quantity,
                                                            free_quantity: batchForm.free_quantity || 0,
                                                            tablets_per_strip: batchForm.tablets_per_strip || 1,
                                                            rack: batchForm.rack || '',
                                                            box: batchForm.box || ''
                                                        }]);
                                                        // Reset forms
                                                        setMedicineForm({ name: '', generic_name: '', manufacturer: '', hsn_code: '3304', category: '', unit: 'PCS', reorder_level: 10 });
                                                        setBatchForm({ medicine_id: 0, batch_number: '', expiry_date: '', purchase_price: 0, mrp: 0, selling_price: 0, price_type: 'INCLUSIVE', gst_rate: 18, is_schedule: false, quantity: 0, free_quantity: 0, tablets_per_strip: 1, rack: '', box: '' });
                                                        showToast('success', 'Product added to cart');
                                                    } catch (err) {
                                                        console.error('Failed to create product:', err);
                                                        showToast('error', 'Failed to create product');
                                                    }
                                                }}>
                                                <Plus size={14} /> Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Selected Medicine Form */}
                                {selectedMedicine && (
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-4)',
                                        border: '1px solid var(--color-primary-200)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>{selectedMedicine.name}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{selectedMedicine.manufacturer}</div>
                                            </div>
                                            <button type="button" onClick={() => setSelectedMedicine(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                                <X size={16} style={{ color: 'var(--text-tertiary)' }} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Batch No *</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.batch_number} placeholder="B-123"
                                                    onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Expiry *</label>
                                                <input type="date" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.expiry_date}
                                                    onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>GST %</label>
                                                <select className="form-select" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.gst_rate}
                                                    onChange={(e) => setBatchForm({ ...batchForm, gst_rate: parseInt(e.target.value) as GstRate })}>
                                                    <option value={0}>0%</option>
                                                    <option value={5}>5%</option>
                                                    <option value={12}>12%</option>
                                                    <option value={18}>18%</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Schedule Drug</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 4 }}>
                                                    <div
                                                        className={`toggle-switch mini ${batchForm.is_schedule ? 'active' : ''}`}
                                                        onClick={() => setBatchForm({ ...batchForm, is_schedule: !batchForm.is_schedule })}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 'var(--text-xs)',
                                                            fontWeight: 500,
                                                            color: batchForm.is_schedule ? 'var(--color-primary-600)' : 'var(--text-tertiary)',
                                                            cursor: 'pointer',
                                                            userSelect: 'none'
                                                        }}
                                                        onClick={() => setBatchForm({ ...batchForm, is_schedule: !batchForm.is_schedule })}
                                                    >
                                                        {batchForm.is_schedule ? 'Yes, Sch.H' : 'No'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Purchase ₹ *</label>
                                                <input type="number" step="0.01" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.purchase_price || ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, purchase_price: Math.max(0, parseFloat(e.target.value) || 0) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>MRP ₹ *</label>
                                                <input type="number" step="0.01" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.mrp || ''}
                                                    onChange={(e) => {
                                                        const mrp = Math.max(0, parseFloat(e.target.value) || 0);
                                                        setBatchForm({ ...batchForm, mrp, selling_price: mrp });
                                                    }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Qty (Strips) *</label>
                                                <input type="number" min="1" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.quantity || ''}
                                                    onChange={(e) => setBatchForm({ ...batchForm, quantity: Math.max(0, parseInt(e.target.value) || 0) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Free (tabs)</label>
                                                <input type="number" min="0" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.free_quantity || ''}
                                                    placeholder="0"
                                                    onChange={(e) => setBatchForm({ ...batchForm, free_quantity: Math.max(0, parseInt(e.target.value) || 0) })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>{isNonMedicine ? 'Pack Size' : 'Tabs/Strip'}</label>
                                                <input type="number" min="1" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.tablets_per_strip} placeholder="10"
                                                    onChange={(e) => setBatchForm({ ...batchForm, tablets_per_strip: Math.max(1, parseInt(e.target.value) || 10) })} />
                                            </div>
                                        </div>
                                        {/* Second row: Location fields */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Rack</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.rack || ''} placeholder="A1"
                                                    onChange={(e) => setBatchForm({ ...batchForm, rack: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Box</label>
                                                <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                                                    value={batchForm.box || ''} placeholder="B2"
                                                    onChange={(e) => setBatchForm({ ...batchForm, box: e.target.value })} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                                {(batchForm.quantity > 0 || batchForm.free_quantity) && (
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '6px 0' }}>
                                                        Total: <strong>{((batchForm.quantity || 0) * (batchForm.tablets_per_strip || 10)) + (batchForm.free_quantity || 0)}</strong> {isNonMedicine ? 'units' : 'tablets'}
                                                        {(batchForm.free_quantity || 0) > 0 && <span style={{ color: 'var(--color-success-600)' }}> (+{batchForm.free_quantity} free)</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)', gap: 'var(--space-2)' }}>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedMedicine(null)}>
                                                Cancel
                                            </button>
                                            <button type="button" className="btn btn-primary btn-sm"
                                                disabled={!batchForm.batch_number || !batchForm.expiry_date || !batchForm.quantity || batchForm.mrp <= 0}
                                                onClick={() => {
                                                    // Validate required fields
                                                    if (!selectedMedicine || !batchForm.batch_number || !batchForm.expiry_date || batchForm.quantity <= 0) return;
                                                    if (batchForm.mrp <= 0) {
                                                        showToast('error', 'MRP is required');
                                                        return;
                                                    }
                                                    // Check for duplicate medicine + batch combo
                                                    const isDuplicate = stockCart.some(item =>
                                                        item.medicine.id === selectedMedicine.id && item.batch_number === batchForm.batch_number
                                                    );
                                                    if (isDuplicate) {
                                                        showToast('error', 'This medicine with same batch already in cart');
                                                        return;
                                                    }
                                                    if (selectedMedicine && batchForm.batch_number && batchForm.expiry_date && batchForm.quantity > 0) {
                                                        setStockCart([...stockCart, {
                                                            medicine: selectedMedicine,
                                                            batch_number: batchForm.batch_number,
                                                            expiry_date: batchForm.expiry_date,
                                                            purchase_price: batchForm.purchase_price,
                                                            mrp: batchForm.mrp,
                                                            selling_price: batchForm.selling_price,
                                                            gst_rate: batchForm.gst_rate,
                                                            is_schedule: batchForm.is_schedule || false,
                                                            quantity: batchForm.quantity,
                                                            free_quantity: batchForm.free_quantity || 0,
                                                            tablets_per_strip: batchForm.tablets_per_strip || 10,
                                                            rack: batchForm.rack || '',
                                                            box: batchForm.box || ''
                                                        }]);
                                                        setSelectedMedicine(null);
                                                        setBatchForm({
                                                            medicine_id: 0, batch_number: '', expiry_date: '',
                                                            purchase_price: 0, mrp: 0, selling_price: 0, price_type: 'INCLUSIVE',
                                                            gst_rate: 12, is_schedule: false, quantity: 0, free_quantity: 0, tablets_per_strip: 10, rack: '', box: ''
                                                        });
                                                    }
                                                }}>
                                                <Plus size={14} /> Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Cart Items List */}
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                                        Cart Items ({stockCart.length})
                                    </div>
                                    {stockCart.length === 0 ? (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: 'var(--space-6)',
                                            color: 'var(--text-tertiary)',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '2px dashed var(--border-color)'
                                        }}>
                                            <Package size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
                                            <div>No items added yet</div>
                                            <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>Search and add medicines above</div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {stockCart.map((item, idx) => (
                                                <div key={idx} style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto auto auto auto',
                                                    gap: 'var(--space-3)',
                                                    alignItems: 'center',
                                                    padding: 'var(--space-2) var(--space-3)',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-color)',
                                                    fontSize: 'var(--text-sm)'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{item.medicine.name}</div>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                            Batch: {item.batch_number} • Exp: {item.expiry_date}
                                                            {(item.rack || item.box) && <> • Loc: {item.rack || '-'}/{item.box || '-'}</>}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Qty</div>
                                                        <div style={{ fontWeight: 600 }}>
                                                            {item.quantity}
                                                            {item.free_quantity > 0 && <span style={{ color: 'var(--color-success-600)', fontWeight: 400 }}>+{item.free_quantity}</span>}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>MRP</div>
                                                        <div>₹{item.mrp}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Total</div>
                                                        <div style={{ fontWeight: 600 }}>₹{(item.quantity * item.mrp).toFixed(0)}</div>
                                                    </div>
                                                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                                        onClick={() => setStockCart(stockCart.filter((_, i) => i !== idx))}>
                                                        <Trash2 size={14} style={{ color: 'var(--color-error-500)' }} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Summary Panel */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)',
                                display: 'flex',
                                flexDirection: 'column',
                                height: 'fit-content',
                                position: 'sticky',
                                top: 0
                            }}>
                                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                                    Summary
                                </h4>

                                {/* Totals Box */}
                                <div style={{
                                    background: 'var(--color-primary-600)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--space-4)',
                                    textAlign: 'center',
                                    marginBottom: 'var(--space-4)'
                                }}>
                                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>Total Items</div>
                                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold' }}>{stockCart.length}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8, marginTop: 'var(--space-2)' }}>
                                        {stockCart.reduce((sum, item) => sum + (item.quantity * item.tablets_per_strip) + item.free_quantity, 0).toLocaleString()} units
                                        {stockCart.reduce((sum, item) => sum + item.free_quantity, 0) > 0 && (
                                            <span style={{ color: 'var(--color-success-100)' }}> (+{stockCart.reduce((sum, item) => sum + item.free_quantity, 0)} free)</span>
                                        )}
                                    </div>
                                </div>

                                {/* Value Summary */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Purchase Value</span>
                                        <span style={{ fontWeight: 500 }}>₹{stockCart.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>MRP Value</span>
                                        <span style={{ fontWeight: 500 }}>₹{stockCart.reduce((sum, item) => sum + item.quantity * item.mrp, 0).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-2)' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Profit Margin</span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-success-600)' }}>
                                            {(() => {
                                                const purchase = stockCart.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0);
                                                const mrp = stockCart.reduce((sum, item) => sum + item.quantity * item.mrp, 0);
                                                return purchase > 0 ? (((mrp - purchase) / purchase) * 100).toFixed(1) : '0';
                                            })()}%
                                        </span>
                                    </div>
                                </div>

                                {/* Supplier Section */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                    <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                        <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Supplier (Optional)</label>
                                        <select className="form-select" style={{ fontSize: 'var(--text-sm)' }}
                                            value={selectedSupplierId}
                                            onChange={(e) => {
                                                const id = parseInt(e.target.value);
                                                setSelectedSupplierId(id);
                                                if (id === 0) setInvoiceNumber('');
                                            }}>
                                            <option value={0}>No Supplier</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    {selectedSupplierId > 0 && (
                                        <>
                                            <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Invoice No *</label>
                                                <input type="text" className="form-input" style={{ fontSize: 'var(--text-sm)' }}
                                                    value={invoiceNumber} placeholder="INV-001"
                                                    onChange={(e) => setInvoiceNumber(e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Invoice Date</label>
                                                <input type="date" className="form-input" style={{ fontSize: 'var(--text-sm)' }}
                                                    value={invoiceDate}
                                                    onChange={(e) => setInvoiceDate(e.target.value)} />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Save All Button */}
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: 'var(--space-3)' }}
                                    disabled={stockCart.length === 0 || isSubmitting || (selectedSupplierId > 0 && !invoiceNumber)}
                                    onClick={async () => {
                                        if (stockCart.length === 0 || isSubmitting) return;
                                        if (selectedSupplierId > 0 && !invoiceNumber) {
                                            showToast('error', 'Invoice number required');
                                            return;
                                        }
                                        setIsSubmitting(true);
                                        try {
                                            // Create purchase entry first if supplier selected
                                            let purchaseId: number | null = null;
                                            if (selectedSupplierId > 0) {
                                                const subtotal = stockCart.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0);
                                                const totalGst = stockCart.reduce((sum, item) => {
                                                    const itemTotal = item.quantity * item.purchase_price;
                                                    return sum + (itemTotal * item.gst_rate / 100);
                                                }, 0);
                                                const purchaseResult = await execute(
                                                    `INSERT INTO purchases (invoice_number, invoice_date, supplier_id, user_id, subtotal, cgst_amount, sgst_amount, total_gst, grand_total, payment_status, paid_amount)
                                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
                                                    [invoiceNumber, invoiceDate, selectedSupplierId, user?.id || 1, subtotal, totalGst / 2, totalGst / 2, totalGst, subtotal + totalGst]
                                                );
                                                purchaseId = purchaseResult.lastInsertId;
                                            }

                                            // Create all batches
                                            for (const item of stockCart) {
                                                const batchId = await createBatch({
                                                    medicine_id: item.medicine.id,
                                                    batch_number: item.batch_number,
                                                    expiry_date: item.expiry_date,
                                                    purchase_price: item.purchase_price,
                                                    mrp: item.mrp,
                                                    selling_price: item.selling_price,
                                                    price_type: 'INCLUSIVE',
                                                    gst_rate: item.gst_rate,
                                                    is_schedule: item.is_schedule,
                                                    quantity: item.quantity,
                                                    free_quantity: item.free_quantity,
                                                    tablets_per_strip: item.tablets_per_strip,
                                                    rack: item.rack,
                                                    box: item.box
                                                });

                                                if (purchaseId) {
                                                    const itemTotal = item.quantity * item.purchase_price;
                                                    const gst = itemTotal * item.gst_rate / 100;
                                                    await execute(`UPDATE batches SET purchase_id = ?, supplier_id = ? WHERE id = ?`, [purchaseId, selectedSupplierId, batchId]);
                                                    await execute(
                                                        `INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, medicine_name, batch_number, expiry_date, quantity, free_quantity, purchase_price, mrp, discount_percent, gst_rate, cgst_amount, sgst_amount, total_amount)
                                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                                                        [purchaseId, item.medicine.id, batchId, item.medicine.name, item.batch_number, item.expiry_date, item.quantity, item.free_quantity, item.purchase_price, item.mrp, item.gst_rate, gst / 2, gst / 2, itemTotal + gst]
                                                    );
                                                }
                                            }

                                            showToast('success', `Added ${stockCart.length} item(s) to stock`);
                                            setShowAddBatchModal(false);
                                            setStockCart([]);
                                            setSelectedSupplierId(0);
                                            setInvoiceNumber('');
                                            loadData();
                                        } catch (err) {
                                            console.error(err);
                                            showToast('error', 'Failed to add stock');
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                >
                                    {isSubmitting ? 'Saving...' : `Save ${stockCart.length} Item${stockCart.length !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
