// =====================================================
// Purchases Page
// Purchase Entry and Supplier Management
// =====================================================

import {
    Calendar,
    FileText,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    Truck,
    X
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import { useAuthStore } from '../stores';
import type { CreateSupplierInput, GstRate, Medicine, Purchase, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils';

// Types for purchase entry
// NOTE: All prices (purchase_price, mrp, selling_price) are PER STRIP/PACK
// Quantity is in STRIPS/PACKS (will be converted to pieces when saving)
interface PurchaseItemEntry {
    id: string;
    medicine_id: number;
    medicine_name: string;
    hsn_code: string;
    gst_rate: GstRate;
    batch_number: string;
    expiry_date: string;
    quantity: number;           // Number of strips/packs
    free_quantity: number;      // Free strips/packs
    tablets_per_strip: number;  // Pieces per strip/pack
    purchase_price: number;     // Per strip
    mrp: number;                // Per strip
    selling_price: number;      // Per strip
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
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
    const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false);
    const [showQuickAddMedicineModal, setShowQuickAddMedicineModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentSuppliersPage, setCurrentSuppliersPage] = useState(1);
    const itemIdPrefix = useId();

    // Pagination constants
    const ITEMS_PER_PAGE = 50;

    // Medicine search state
    const [medicineSearch, setMedicineSearch] = useState('');
    const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
    const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);

    // Quick add medicine form
    const [quickMedicineForm, setQuickMedicineForm] = useState({
        name: '',
        generic_name: '',
        manufacturer: '',
        hsn_code: '3004',
        gst_rate: 12 as GstRate,
        category: '',
        is_schedule: false
    });

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
            const [purchasesData, suppliersData] = await Promise.all([
                query<Purchase>(
                    `SELECT p.*, s.name as supplier_name 
             FROM purchases p 
             LEFT JOIN suppliers s ON p.supplier_id = s.id 
             ORDER BY p.invoice_date DESC`,
                    []
                ),
                query<Supplier>(
                    'SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name',
                    []
                )
                // Don't load all medicines - use search instead
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

    // Search medicines from database on-demand (debounced)
    useEffect(() => {
        if (medicineSearch.length < 2) {
            setFilteredMedicines([]);
            setShowMedicineDropdown(false);
            return;
        }

        const searchMedicines = async () => {
            try {
                const term = `%${medicineSearch}%`;
                const results = await query<Medicine>(
                    `SELECT * FROM medicines 
                     WHERE is_active = 1 
                       AND (name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ?)
                     ORDER BY name ASC
                     LIMIT 15`,
                    [term, term, term]
                );
                setFilteredMedicines(results);
                setShowMedicineDropdown(results.length > 0);
            } catch (error) {
                console.error('Medicine search failed:', error);
            }
        };

        const debounceTimer = setTimeout(searchMedicines, 200);
        return () => clearTimeout(debounceTimer);
    }, [medicineSearch]);

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

    // Delete purchase
    const handleDeletePurchase = async (purchaseId: number, invoiceNumber: string) => {
        if (!confirm(`Are you sure you want to delete purchase ${invoiceNumber}? This will also remove associated batch records.`)) {
            return;
        }

        try {
            // Delete purchase items first
            await execute('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);

            // Delete batches associated with this purchase
            await execute('DELETE FROM batches WHERE purchase_id = ?', [purchaseId]);

            // Delete the purchase
            await execute('DELETE FROM purchases WHERE id = ?', [purchaseId]);

            showToast('success', `Purchase ${invoiceNumber} deleted successfully`);
            loadData();
        } catch (error) {
            console.error('Failed to delete purchase:', error);
            showToast('error', 'Failed to delete purchase. It may have associated transactions.');
        }
    };

    // Delete supplier
    const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
        if (!confirm(`Are you sure you want to delete supplier "${supplierName}"?`)) {
            return;
        }

        try {
            // Soft delete - set is_active to 0
            await execute('UPDATE suppliers SET is_active = 0 WHERE id = ?', [supplierId]);

            showToast('success', `Supplier "${supplierName}" deleted successfully`);
            loadData();
        } catch (error) {
            console.error('Failed to delete supplier:', error);
            showToast('error', 'Failed to delete supplier.');
        }
    };

    // Open edit supplier modal
    const handleEditSupplier = (supplier: Supplier) => {
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
        setShowAddSupplierModal(true);
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                // Update existing supplier
                await execute(
                    `UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, 
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
                showToast('success', 'Supplier updated successfully!');
            } else {
                // Insert new supplier
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
            }
            setShowAddSupplierModal(false);
            setEditingSupplier(null);
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
            console.error('Failed to save supplier:', error);
            showToast('error', 'Failed to save supplier. Please try again.');
        }
    };

    // Add medicine to purchase
    const handleAddMedicine = async (medicine: Medicine) => {
        // Check if this exact medicine is already in the list (prevent duplicates)
        const existingMedicine = purchaseItems.find(
            item => item.medicine_id === medicine.id
        );

        if (existingMedicine) {
            showToast('warning', `${medicine.name} is already in the list. Please edit the existing entry or remove it before adding again.`);
            setMedicineSearch('');
            setShowMedicineDropdown(false);
            return;
        }

        // Fetch last batch info to pre-fill values (all prices are per strip)
        // Now includes gst_rate and is_schedule from batch
        let lastBatch: { mrp: number; selling_price: number; rack: string; box: string; purchase_price: number; tablets_per_strip: number; gst_rate: number; is_schedule: number } | null = null;
        try {
            const batches = await query<{ mrp: number; selling_price: number; rack: string; box: string; purchase_price: number; tablets_per_strip: number; gst_rate: number; is_schedule: number }>(
                `SELECT mrp, selling_price, rack, box, purchase_price, 
                        COALESCE(tablets_per_strip, 10) as tablets_per_strip,
                        COALESCE(gst_rate, 12) as gst_rate,
                        COALESCE(is_schedule, 0) as is_schedule
                 FROM batches 
                 WHERE medicine_id = ? ORDER BY created_at DESC LIMIT 1`,
                [medicine.id]
            );
            if (batches.length > 0) {
                lastBatch = batches[0];
            }
        } catch (error) {
            console.warn('Could not fetch last batch:', error);
        }

        const newItem: PurchaseItemEntry = {
            id: `${itemIdPrefix}-${purchaseItems.length}`,
            medicine_id: medicine.id,
            medicine_name: medicine.name,
            hsn_code: medicine.hsn_code,
            gst_rate: (lastBatch?.gst_rate || 12) as GstRate, // Get from batch or default to 12%
            batch_number: '',
            expiry_date: '',
            quantity: 1,
            free_quantity: 0,
            tablets_per_strip: lastBatch?.tablets_per_strip || 10,
            purchase_price: lastBatch?.purchase_price || 0,  // Per strip
            mrp: lastBatch?.mrp || 0,                        // Per strip
            selling_price: lastBatch?.selling_price || 0,    // Per strip
            rack: lastBatch?.rack || '',
            box: lastBatch?.box || '',
            cgst: 0,
            sgst: 0,
            total_gst: 0,
            total: 0,
        };
        setPurchaseItems([...purchaseItems, newItem]);
        setMedicineSearch('');
        setShowMedicineDropdown(false);
    };

    // Quick add new medicine
    const handleQuickAddMedicine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickMedicineForm.name) {
            showToast('error', 'Medicine name is required');
            return;
        }

        try {
            // Insert medicine without gst_rate (now per-batch)
            const result = await execute(
                `INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, category)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    quickMedicineForm.name,
                    quickMedicineForm.generic_name || null,
                    quickMedicineForm.manufacturer || null,
                    quickMedicineForm.hsn_code || '3004',
                    quickMedicineForm.category || null
                ]
            );

            const newMedicine: Medicine = {
                id: result.lastInsertId,
                name: quickMedicineForm.name,
                generic_name: quickMedicineForm.generic_name || undefined,
                manufacturer: quickMedicineForm.manufacturer || undefined,
                hsn_code: quickMedicineForm.hsn_code || '3004',
                category: quickMedicineForm.category || undefined,
                unit: 'PCS',
                reorder_level: 10,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Add to purchase items (GST will be set per-batch)
            handleAddMedicine(newMedicine);

            showToast('success', `Medicine "${quickMedicineForm.name}" added`);
            setShowQuickAddMedicineModal(false);
            setQuickMedicineForm({
                name: '',
                generic_name: '',
                manufacturer: '',
                hsn_code: '3004',
                gst_rate: 12,
                category: '',
                is_schedule: false
            });
        } catch (error) {
            console.error('Failed to add medicine:', error);
            showToast('error', 'Failed to add medicine');
        }
    };

    // Open quick add with search text pre-filled
    const openQuickAddMedicine = () => {
        setQuickMedicineForm({
            ...quickMedicineForm,
            name: medicineSearch
        });
        setShowMedicineDropdown(false);
        setShowQuickAddMedicineModal(true);
    };

    // Update purchase item
    const updatePurchaseItem = (id: string, field: keyof PurchaseItemEntry, value: PurchaseItemEntry[keyof PurchaseItemEntry]) => {
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
            notes: ''
        });
        setPurchaseItems([]);
        setMedicineSearch('');
        setEditingPurchase(null);
    };

    // Handle Edit Purchase Click
    const handleEditPurchase = (purchase: Purchase) => {
        setEditingPurchase(purchase);
        setPurchaseForm({
            supplier_id: purchase.supplier_id,
            invoice_number: purchase.invoice_number,
            invoice_date: purchase.invoice_date,
            payment_status: purchase.payment_status,
            paid_amount: purchase.paid_amount || 0,
            notes: purchase.notes || ''
        });
        setShowEditPurchaseModal(true);
    };

    // Update Purchase Details (Header only)
    const handleUpdatePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPurchase) return;

        try {
            await execute(
                `UPDATE purchases SET 
                    supplier_id = ?, 
                    invoice_number = ?, 
                    invoice_date = ?, 
                    payment_status = ?, 
                    paid_amount = ?, 
                    notes = ? 
                 WHERE id = ?`,
                [
                    purchaseForm.supplier_id,
                    purchaseForm.invoice_number,
                    purchaseForm.invoice_date,
                    purchaseForm.payment_status,
                    purchaseForm.paid_amount,
                    purchaseForm.notes || null,
                    editingPurchase.id
                ]
            );
            showToast('success', 'Purchase updated successfully');
            setShowEditPurchaseModal(false);
            resetPurchaseForm();
            loadData();
        } catch (error) {
            console.error('Failed to update purchase:', error);
            showToast('error', 'Failed to update purchase');
        }
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
                    subtotal, cgst_amount, sgst_amount, total_gst, grand_total,
                    payment_status, paid_amount, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                const tabletsPerStrip = item.tablets_per_strip || 10;
                // Convert strips to pieces for storage
                const totalPieces = (item.quantity + item.free_quantity) * tabletsPerStrip;

                if (existingBatches.length > 0) {
                    // Update existing batch - add pieces to existing quantity
                    batchId = existingBatches[0].id;
                    await execute(
                        `UPDATE batches SET 
                            quantity = quantity + ?,
                            purchase_price = ?,
                            mrp = ?,
                            selling_price = ?,
                            tablets_per_strip = ?,
                            expiry_date = ?,
                            rack = COALESCE(?, rack),
                            box = COALESCE(?, box),
                            purchase_id = ?,
                            supplier_id = ?,
                            updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [
                            totalPieces,            // Add pieces, not strips
                            item.purchase_price,    // Per strip
                            item.mrp,               // Per strip
                            item.selling_price,     // Per strip
                            tabletsPerStrip,
                            item.expiry_date,
                            item.rack || null,
                            item.box || null,
                            purchaseId,
                            purchaseForm.supplier_id,
                            batchId,
                        ]
                    );
                } else {
                    // Create new batch - store quantity in pieces
                    const batchResult = await execute(
                        `INSERT INTO batches (
                            medicine_id, batch_number, expiry_date,
                            purchase_price, mrp, selling_price, price_type,
                            quantity, tablets_per_strip, rack, box, purchase_id, supplier_id
                        ) VALUES (?, ?, ?, ?, ?, ?, 'INCLUSIVE', ?, ?, ?, ?, ?, ?)`,
                        [
                            item.medicine_id,
                            item.batch_number,
                            item.expiry_date,
                            item.purchase_price,    // Per strip
                            item.mrp,               // Per strip
                            item.selling_price,     // Per strip
                            totalPieces,            // Store as pieces
                            tabletsPerStrip,
                            item.rack || null,
                            item.box || null,
                            purchaseId,
                            purchaseForm.supplier_id,
                        ]
                    );
                    batchId = batchResult.lastInsertId;
                }

                // Insert purchase item
                await execute(
                    `INSERT INTO purchase_items (
                        purchase_id, medicine_id, batch_id,
                        medicine_name, batch_number, expiry_date,
                        quantity, free_quantity,
                        purchase_price, mrp, discount_percent,
                        gst_rate, cgst_amount, sgst_amount, total_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        purchaseId,
                        item.medicine_id,
                        batchId,
                        item.medicine_name,
                        item.batch_number,
                        item.expiry_date,
                        item.quantity,
                        item.free_quantity,
                        item.purchase_price,
                        item.mrp,
                        0, // discount_percent
                        item.gst_rate,
                        item.cgst,
                        item.sgst,
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
                    {activeTab === 'suppliers' && (
                        <button className="btn btn-secondary" onClick={() => setShowAddSupplierModal(true)}>
                            <Plus size={18} />
                            Add Supplier
                        </button>
                    )}
                    {activeTab === 'purchases' && (
                        <button className="btn btn-primary" onClick={() => setShowNewPurchaseModal(true)}>
                            <Plus size={18} />
                            New Purchase
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
                            purchases.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((purchase) => (
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
                                                {(purchase as Purchase & { supplier_name?: string }).supplier_name || 'Unknown Supplier'}
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div className="purchase-amount">
                                            <div className="purchase-total">{formatCurrency(purchase.grand_total)}</div>
                                            <div className="text-sm text-secondary">
                                                GST: {formatCurrency(purchase.total_gst)}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditPurchase(purchase);
                                            }}
                                            title="Edit purchase details"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePurchase(purchase.id, purchase.invoice_number);
                                            }}
                                            title="Delete purchase"
                                            style={{ color: 'var(--color-danger-600)' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
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

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalItems={purchases.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}

                {activeTab === 'suppliers' && (
                    <>
                        {suppliers.length > 0 ? (
                            suppliers.slice((currentSuppliersPage - 1) * ITEMS_PER_PAGE, currentSuppliersPage * ITEMS_PER_PAGE).map((supplier) => (
                                <div key={supplier.id} className="supplier-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                        <div style={{ flex: 1 }}>
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
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => handleEditSupplier(supplier)}
                                                title="Edit supplier"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                                                title="Delete supplier"
                                                style={{ color: 'var(--color-danger-600)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <Truck size={48} strokeWidth={1} />
                                <h3 className="mt-4">No suppliers yet</h3>
                                <p className="text-secondary">Add suppliers to manage your purchases</p>
                            </div>
                        )}

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentSuppliersPage}
                            totalItems={suppliers.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentSuppliersPage}
                        />
                    </>
                )}
            </div>

            {/* Add Supplier Modal */}
            {showAddSupplierModal && (
                <div className="modal-overlay" onClick={() => setShowAddSupplierModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => {
                                setShowAddSupplierModal(false);
                                setEditingSupplier(null);
                            }}>
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
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowAddSupplierModal(false);
                                    setEditingSupplier(null);
                                }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
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
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_status: e.target.value as 'PENDING' | 'PARTIAL' | 'PAID' })}
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
                                            placeholder="Search medicine by name or add new..."
                                            value={medicineSearch}
                                            onChange={(e) => setMedicineSearch(e.target.value)}
                                            onFocus={() => medicineSearch.length > 0 && setShowMedicineDropdown(true)}
                                        />
                                        {showMedicineDropdown && medicineSearch.length > 0 && (
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
                                                maxHeight: 250,
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
                                                            {m.manufacturer && `${m.manufacturer} | `}{m.generic_name && `${m.generic_name.substring(0, 50)}... | `}HSN: {m.hsn_code}
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Add New Medicine Option */}
                                                <div
                                                    style={{
                                                        padding: 'var(--space-3)',
                                                        cursor: 'pointer',
                                                        background: 'var(--color-primary-50)',
                                                        borderTop: '2px solid var(--color-primary-200)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--space-2)',
                                                        color: 'var(--color-primary-700)',
                                                        fontWeight: 500
                                                    }}
                                                    onClick={openQuickAddMedicine}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-100)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-primary-50)'}
                                                >
                                                    <Plus size={16} />
                                                    Add "{medicineSearch}" as new medicine
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Purchase Items Table */}
                                {purchaseItems.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <div style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            background: 'var(--color-primary-50)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: 'var(--space-2)',
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--color-primary-700)'
                                        }}>
                                            💡 All prices are <strong>per strip/pack</strong>. Qty is in strips. Pieces = Qty × Pcs/Strip
                                        </div>
                                        <table className="data-table" style={{ minWidth: 1200 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ minWidth: 180 }}>Medicine</th>
                                                    <th style={{ minWidth: 100 }}>Batch *</th>
                                                    <th style={{ minWidth: 120 }}>Expiry *</th>
                                                    <th style={{ minWidth: 70 }}>Strips *</th>
                                                    <th style={{ minWidth: 70 }}>Free</th>
                                                    <th style={{ minWidth: 60 }}>Pcs/Strip</th>
                                                    <th style={{ minWidth: 100 }}>Purchase/Strip *</th>
                                                    <th style={{ minWidth: 100 }}>MRP/Strip *</th>
                                                    <th style={{ minWidth: 100 }}>Sell/Strip *</th>
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
                                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                                                HSN: {item.hsn_code} | {(item.quantity + item.free_quantity) * (item.tablets_per_strip || 10)} pcs total
                                                            </div>
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
                                                                value={item.tablets_per_strip || 10}
                                                                onChange={(e) => updatePurchaseItem(item.id, 'tablets_per_strip', parseInt(e.target.value) || 10)}
                                                                min={1}
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

            {/* Quick Add Medicine Modal */}
            {showQuickAddMedicineModal && (
                <div className="modal-overlay" onClick={() => setShowQuickAddMedicineModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Quick Add Medicine</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowQuickAddMedicineModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleQuickAddMedicine}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Medicine Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={quickMedicineForm.name}
                                        onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, name: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Generic Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={quickMedicineForm.generic_name}
                                            onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, generic_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Manufacturer</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={quickMedicineForm.manufacturer}
                                            onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, manufacturer: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">HSN Code</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={quickMedicineForm.hsn_code}
                                            onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, hsn_code: e.target.value })}
                                            placeholder="3004"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GST Rate</label>
                                        <select
                                            className="form-select"
                                            value={quickMedicineForm.gst_rate}
                                            onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, gst_rate: parseInt(e.target.value) as GstRate })}
                                        >
                                            <option value={0}>0%</option>
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
                                            value={quickMedicineForm.category}
                                            onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, category: e.target.value })}
                                            placeholder="e.g., Tablets, Syrup"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <input
                                                type="checkbox"
                                                checked={quickMedicineForm.is_schedule}
                                                onChange={(e) => setQuickMedicineForm({ ...quickMedicineForm, is_schedule: e.target.checked })}
                                            />
                                            Schedule H/H1 Drug
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickAddMedicineModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Plus size={18} /> Add & Continue
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Purchase Modal */}
            {showEditPurchaseModal && (
                <div className="modal-overlay" onClick={() => { setShowEditPurchaseModal(false); resetPurchaseForm(); }}>
                    <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Purchase Details</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowEditPurchaseModal(false); resetPurchaseForm(); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdatePurchase}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Supplier</label>
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
                                    <label className="form-label">Invoice Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={purchaseForm.invoice_number}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Invoice Date</label>
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
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_status: e.target.value as 'PENDING' | 'PARTIAL' | 'PAID' })}
                                    >
                                        <option value="PENDING">Pending</option>
                                        <option value="PARTIAL">Partial</option>
                                        <option value="PAID">Paid</option>
                                    </select>
                                </div>
                                {purchaseForm.payment_status !== 'PENDING' && (
                                    <div className="form-group">
                                        <label className="form-label">Paid Amount</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={purchaseForm.paid_amount}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, paid_amount: parseFloat(e.target.value) || 0 })}
                                            min={0}
                                        />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        value={purchaseForm.notes || ''}
                                        onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                                        placeholder="Add notes..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditPurchaseModal(false); resetPurchaseForm(); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Update Purchase
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
