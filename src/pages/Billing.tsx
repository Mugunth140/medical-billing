// =====================================================
// Billing Page
// Modern POS-style billing with tablet/piece tracking
// Redesigned for Accessibility and Premium UX
// =====================================================

import {
    AlertCircle,
    Banknote,
    Check,
    CreditCard,
    Percent,
    Printer,
    Search,
    Smartphone,
    Trash2,
    User,
    X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { createBill } from '../services/billing.service';
import { query } from '../services/database';
import { calculateBill, formatCurrency } from '../services/gst.service';
import { searchMedicinesForBilling } from '../services/inventory.service';
import { printBill } from '../services/print.service';
import { useAuthStore, useBillingStore } from '../stores';
import type { Bill, Customer, ScheduledMedicineInput, StockItem } from '../types';
import { debounce, formatDate } from '../utils';

export function Billing() {
    const { user } = useAuthStore();
    const {
        items,
        customerId,
        customerName,
        discountType,
        discountValue,
        paymentMode,
        cashAmount,
        onlineAmount,
        notes,
        patientInfo,
        addItem,
        updateItemStripsPieces,
        removeItem,
        setCustomer,
        setBillDiscount,
        setPaymentMode,
        setSplitAmounts,
        setPatientInfo,
        hasScheduledMedicines,
        clearBill
    } = useBillingStore();

    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StockItem[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1); // For keyboard navigation
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastBill, setLastBill] = useState<Bill | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [doctorName, setDoctorName] = useState(''); // Optional doctor name for all bills
    const [tempPatientInfo, setTempPatientInfo] = useState<ScheduledMedicineInput>({
        patient_name: '',
        patient_age: undefined,
        patient_gender: undefined,
        patient_phone: '',
        patient_address: '',
        doctor_name: '',
        doctor_registration_number: '',
        clinic_hospital_name: '',
        prescription_number: '',
        prescription_date: '',
        doctor_prescription: ''
    });

    // Check if cart has scheduled medicines
    const hasScheduled = hasScheduledMedicines();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Calculate bill totals (per-piece pricing)
    const billCalc = calculateBill(
        items.map(item => {
            const tabletsPerStrip = item.batch.tablets_per_strip || 10;
            const pricePerPiece = item.batch.selling_price / tabletsPerStrip;
            return {
                batch: {
                    id: item.batch.batch_id,
                    selling_price: pricePerPiece,
                    price_type: item.batch.price_type,
                    gst_rate: item.batch.gst_rate
                },
                quantity: item.quantity,
                discountType: item.discountType,
                discountValue: item.discountValue
            };
        }),
        discountType ?? undefined,
        discountValue
    );

    useEffect(() => {
        async function loadCustomers() {
            const result = await query<Customer>(
                'SELECT * FROM customers WHERE is_active = 1 ORDER BY name',
                []
            );
            setCustomers(result);
        }
        loadCustomers();
    }, []);

    const performSearch = useCallback(
        debounce(async (term: string) => {
            if (term.length < 2) {
                setSearchResults([]);
                setShowSearchDropdown(false);
                return;
            }
            try {
                const results = await searchMedicinesForBilling(term);
                setSearchResults(results);
                setShowSearchDropdown(true);
                setActiveIndex(-1); // Reset selection
            } catch (err) {
                console.error('Search failed:', err);
            }
        }, 300),
        []
    );

    useEffect(() => {
        performSearch(searchQuery);
    }, [searchQuery, performSearch]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Global shortcuts
            if ((e.ctrlKey && e.key === 'f') || e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (items.length > 0 && !isSubmitting) handleSubmitBill();
            }
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                if (window.confirm('Clear current bill?')) clearBill();
            }
            if (e.key === 'Escape') {
                setShowSearchDropdown(false);
                setActiveIndex(-1);
            }

            // Dropdown navigation
            if (showSearchDropdown && searchResults.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
                } else if (e.key === 'Enter' && activeIndex >= 0) {
                    e.preventDefault();
                    handleAddItem(searchResults[activeIndex]);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, isSubmitting, clearBill, showSearchDropdown, searchResults, activeIndex]);

    // Scroll active item into view
    useEffect(() => {
        if (activeIndex >= 0 && resultsRef.current) {
            const activeElement = resultsRef.current.children[activeIndex] as HTMLElement;
            if (activeElement) {
                activeElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [activeIndex]);

    const handleAddItem = (item: StockItem) => {
        addItem(item, 1);
        setSearchQuery('');
        setShowSearchDropdown(false);
        setActiveIndex(-1);
        searchInputRef.current?.focus();
    };

    const handleSubmitBill = async () => {
        if (items.length === 0) return;
        if (paymentMode === 'CREDIT' && !customerId) {
            setError('Please select a customer for credit sale');
            showToast('warning', 'Please select a customer for credit sale');
            return;
        }

        // Check credit limit
        if (paymentMode === 'CREDIT' && customerId) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                const newBalance = customer.current_balance + billCalc.finalAmount;
                if (newBalance > customer.credit_limit) {
                    const msg = `Credit limit exceeded! Limit: ${formatCurrency(customer.credit_limit)}, Current: ${formatCurrency(customer.current_balance)}`;
                    setError(msg);
                    showToast('error', msg);
                    return;
                }
            }
        }

        // Check if scheduled medicines require patient info, doctor details, prescription, age, and gender
        if (hasScheduled && (!patientInfo || !patientInfo.patient_name || !patientInfo.doctor_name || !patientInfo.doctor_prescription || patientInfo.patient_age === undefined || !patientInfo.patient_gender)) {
            setError('Patient details (name, age, gender), doctor name, and prescription are required for scheduled medicines');
            showToast('warning', 'Please enter all required patient details, doctor name, and prescription for scheduled medicines');
            setShowPatientModal(true);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const bill = await createBill(
                {
                    customer_id: customerId ?? undefined,
                    customer_name: customerName || undefined,
                    doctor_name: doctorName || (hasScheduled && patientInfo?.doctor_name ? patientInfo.doctor_name : undefined),
                    items: items.map(item => ({
                        batch_id: item.batch.batch_id,
                        quantity: item.quantity,
                        quantity_strips: item.quantityStrips,
                        quantity_pieces: item.quantityPieces,
                        discount_type: item.discountType,
                        discount_value: item.discountValue
                    })),
                    discount_type: discountType ?? undefined,
                    discount_value: discountValue,
                    payment_mode: paymentMode,
                    cash_amount: cashAmount,
                    online_amount: onlineAmount,
                    notes: notes || undefined,
                    patient_info: hasScheduled ? patientInfo ?? undefined : undefined
                },
                user!.id
            );

            setLastBill(bill);
            setShowSuccessModal(true);
            showToast('success', `Bill ${bill.bill_number} created!`);
            clearBill();
            setDoctorName(''); // Reset doctor name
            // Reset patient info form
            setTempPatientInfo({
                patient_name: '',
                patient_age: undefined,
                patient_gender: undefined,
                patient_phone: '',
                patient_address: '',
                doctor_name: '',
                doctor_registration_number: '',
                clinic_hospital_name: '',
                prescription_number: '',
                prescription_date: '',
                doctor_prescription: ''
            });
        } catch (err) {
            console.error('Bill creation error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to create bill';
            setError(errorMessage);
            showToast('error', errorMessage);
        }
        setIsSubmitting(false);
    };

    const handlePrint = async () => {
        if (!lastBill || !lastBill.items) {
            showToast('warning', 'No bill to print');
            return;
        }
        try {
            await printBill(lastBill, lastBill.items, { paperSize: 'thermal' });
            showToast('info', 'Print dialog opened');
        } catch (err) {
            console.error('Print error:', err);
            showToast('warning', 'Could not open print dialog. Bill was saved successfully.');
        }
    };

    const styles = `
        .billing-container {
            display: flex;
            gap: 20px;
            height: 100vh;
            padding: 20px;
            overflow: hidden;
            font-family: var(--font-sans);
            box-sizing: border-box;
        }

        .main-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
            height: 100%;
            min-width: 0; /* Prevent flex child overflow */
        }

        /* Search Bar */
        .search-container {
            position: relative;
            z-index: 50;
        }

        .search-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid var(--border-light);
            transition: all 0.2s ease;
        }

        .search-input-wrapper:focus-within {
            box-shadow: 0 8px 24px rgba(30, 142, 180, 0.15);
            border-color: var(--color-primary-300);
            transform: translateY(-1px);
        }

        .search-icon {
            position: absolute;
            left: 16px;
            color: var(--text-tertiary);
        }

        .search-input {
            width: 100%;
            padding: 16px 16px 16px 48px;
            font-size: 16px;
            border: none;
            background: transparent;
            border-radius: 12px;
            color: var(--text-primary);
        }

        .search-input:focus {
            outline: none;
        }

        .search-shortcut {
            position: absolute;
            right: 16px;
            padding: 4px 8px;
            background: var(--bg-tertiary);
            border-radius: 6px;
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 600;
            border: 1px solid var(--border-light);
        }

        /* Dropdown */
        .search-dropdown {
            position: absolute;
            top: calc(100% + 8px);
            left: 0;
            right: 0;
            background: white;
            border-radius: 12px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
            border: 1px solid var(--border-light);
            max-height: 400px;
            overflow-y: auto;
            z-index: 100;
            padding: 8px;
        }

        .dropdown-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
            border-bottom: 1px solid transparent;
        }

        .dropdown-item:hover, .dropdown-item.active {
            background: var(--color-primary-50);
        }

        .dropdown-item.active {
            border-left: 3px solid var(--color-primary-500);
        }

        /* Item List */
        .items-container {
            flex: 1;
            overflow-y: auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border-light);
        }

        .items-header {
            display: grid;
            grid-template-columns: 2fr 80px 60px 100px 100px 40px;
            gap: 12px;
            padding: 16px 20px;
            background: var(--bg-tertiary);
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 1px solid var(--border-light);
        }

        .item-row {
            display: grid;
            grid-template-columns: 2fr 80px 60px 100px 100px 40px;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-light);
            align-items: center;
            transition: background 0.15s ease;
        }

        .item-row:hover {
            background: var(--bg-primary);
        }

        .qty-input {
            width: 100%;
            padding: 8px;
            text-align: center;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            font-family: var(--font-mono);
            font-size: 14px;
            transition: all 0.2s;
        }

        .qty-input:focus {
            outline: none;
            border-color: var(--color-primary-500);
            box-shadow: 0 0 0 3px rgba(30, 142, 180, 0.1);
        }

        /* Sidebar - Fixed Width & Scrollable Content */
        .sidebar-section {
            width: 340px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: 16px;
            height: 100%;
            overflow-y: auto;
            padding-right: 4px;
        }

        .sidebar-card {
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid var(--border-light);
        }

        .sidebar-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--text-tertiary);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Payment Grid */
        .payment-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .payment-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 12px;
            border: 2px solid var(--border-light);
            border-radius: 10px;
            background: white;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--text-secondary);
        }

        .payment-btn:hover {
            border-color: var(--color-primary-200);
            background: var(--color-primary-50);
        }

        .payment-btn.active {
            border-color: var(--color-primary-500);
            background: var(--color-primary-50);
            color: var(--color-primary-700);
            font-weight: 600;
        }

        /* Totals Section */
        .totals-card {
            background: linear-gradient(145deg, #1e293b, #0f172a);
            color: white;
            border: none;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            opacity: 0.9;
        }

        .grand-total {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            font-size: 24px;
            font-weight: 700;
            color: var(--color-primary-200);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .save-btn {
            width: 100%;
            margin-top: 16px;
            padding: 14px;
            background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(30, 142, 180, 0.3);
        }

        .save-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(30, 142, 180, 0.4);
        }

        .save-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: var(--color-gray-600);
            box-shadow: none;
        }

        /* Empty State */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-tertiary);
            gap: 16px;
        }

        .empty-icon {
            width: 64px;
            height: 64px;
            background: var(--bg-tertiary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
        }
    `;

    return (
        <>
            <style>{styles}</style>

            {error && (
                <div className="alert alert-danger" style={{ position: 'fixed', top: 80, right: 20, zIndex: 1000, maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <AlertCircle size={18} />
                    <span style={{ flex: 1 }}>{error}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="billing-container">
                {/* LEFT COLUMN: Search & Items */}
                <div className="main-section">
                    {/* Search Bar */}
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <Search className="search-icon" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="search-input"
                                placeholder="Search medicine by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                                aria-label="Search medicines"
                            />
                            <div className="search-shortcut">F2</div>
                        </div>

                        {/* Search Dropdown */}
                        {showSearchDropdown && searchResults.length > 0 && (
                            <div className="search-dropdown" ref={resultsRef}>
                                {searchResults.map((item, index) => {
                                    const tps = item.tablets_per_strip || 10;
                                    const s = Math.floor(item.quantity / tps);
                                    const p = item.quantity % tps;
                                    return (
                                        <div
                                            key={item.batch_id}
                                            className={`dropdown-item ${index === activeIndex ? 'active' : ''}`}
                                            onClick={() => handleAddItem(item)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                                                    {item.medicine_name}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                    <span style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                                                        {item.batch_number}
                                                    </span>
                                                    <span>Exp: {formatDate(item.expiry_date)}</span>
                                                    <span>{tps}/strip</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--color-primary-600)' }}>
                                                    {formatCurrency(item.selling_price)}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                    {s > 0 ? `${s} strips ` : ''}{p > 0 ? `${p} pcs` : ''} left
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="items-container">
                        {items.length > 0 ? (
                            <>
                                <div className="items-header">
                                    <span>Medicine</span>
                                    <span style={{ textAlign: 'center' }}>Strips</span>
                                    <span style={{ textAlign: 'center' }}>Pcs</span>
                                    <span style={{ textAlign: 'right' }}>Rate</span>
                                    <span style={{ textAlign: 'right' }}>Total</span>
                                    <span></span>
                                </div>
                                <div>
                                    {items.map((item, index) => {
                                        const itemCalc = billCalc.items[index];
                                        const tps = item.batch.tablets_per_strip || 10;
                                        return (
                                            <div key={item.batch.batch_id} className="item-row">
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.batch.medicine_name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                        {item.batch.batch_number} • {tps} tabs/strip
                                                    </div>
                                                </div>
                                                <input
                                                    type="number"
                                                    className="qty-input"
                                                    value={item.quantityStrips || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                                        updateItemStripsPieces(item.batch.batch_id, Math.max(0, val), item.quantityPieces);
                                                    }}
                                                    min={0}
                                                    aria-label="Quantity Strips"
                                                />
                                                <input
                                                    type="number"
                                                    className="qty-input"
                                                    value={item.quantityPieces || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                                        updateItemStripsPieces(item.batch.batch_id, item.quantityStrips, Math.max(0, val));
                                                    }}
                                                    min={0}
                                                    max={tps - 1}
                                                    aria-label="Quantity Pieces"
                                                />
                                                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                                                    {formatCurrency(item.batch.selling_price)}
                                                </div>
                                                <div style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                                                    {formatCurrency(itemCalc?.total ?? 0)}
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-icon"
                                                    style={{ color: 'var(--color-danger-500)' }}
                                                    onClick={() => removeItem(item.batch.batch_id)}
                                                    aria-label="Remove Item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <Banknote size={32} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>No items added</h3>
                                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Search for medicines to start billing</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Sidebar */}
                <div className="sidebar-section">
                    {/* Customer Card */}
                    <div className="sidebar-card">
                        <div className="sidebar-title">
                            <User size={14} /> Customer Details
                        </div>
                        <select
                            className="form-select"
                            value={customerId ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                    setCustomer(null, 'Walk-in Customer');
                                } else {
                                    const id = parseInt(val);
                                    const c = customers.find(c => c.id === id);
                                    setCustomer(id, c?.name ?? '');
                                }
                            }}
                            aria-label="Select Customer"
                        >
                            <option value="">Walk-in Customer</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {customerId && (
                            <div style={{ marginTop: 8, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Credit Balance:</span>
                                <span style={{ color: 'var(--color-danger-600)', fontWeight: 600 }}>
                                    {formatCurrency(customers.find(c => c.id === customerId)?.current_balance || 0)}
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>
                                        / {formatCurrency(customers.find(c => c.id === customerId)?.credit_limit || 0)}
                                    </span>
                                </span>
                            </div>
                        )}

                        {!hasScheduled && (
                            <div style={{ marginTop: 12 }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Doctor Name (Optional)"
                                    value={doctorName}
                                    onChange={(e) => setDoctorName(e.target.value)}
                                    aria-label="Doctor Name"
                                />
                            </div>
                        )}
                    </div>

                    {/* Patient Details (Conditional) */}
                    {hasScheduled && (
                        <div className="sidebar-card" style={{ borderLeft: '4px solid var(--color-warning-500)' }}>
                            <div className="sidebar-title" style={{ color: 'var(--color-warning-600)' }}>
                                <AlertCircle size={14} /> Schedule H/H1 Drug
                            </div>
                            {patientInfo?.patient_name && patientInfo?.doctor_name && patientInfo?.doctor_prescription && patientInfo?.patient_age !== undefined && patientInfo?.patient_gender ? (
                                <div style={{ fontSize: 13 }}>
                                    <div style={{ fontWeight: 600 }}>{patientInfo.patient_name}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Dr. {patientInfo.doctor_name}</div>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        style={{ marginTop: 8, width: '100%' }}
                                        onClick={() => {
                                            setTempPatientInfo(patientInfo);
                                            setShowPatientModal(true);
                                        }}
                                    >
                                        Edit Details
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-warning btn-sm"
                                    style={{ width: '100%' }}
                                    onClick={() => setShowPatientModal(true)}
                                >
                                    Add Patient Details
                                </button>
                            )}
                        </div>
                    )}

                    {/* Payment Mode */}
                    <div className="sidebar-card">
                        <div className="sidebar-title">
                            <CreditCard size={14} /> Payment Mode
                        </div>
                        <div className="payment-grid">
                            <button
                                className={`payment-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('CASH')}
                            >
                                <Banknote size={20} />
                                <span>Cash</span>
                            </button>
                            <button
                                className={`payment-btn ${paymentMode === 'ONLINE' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('ONLINE')}
                            >
                                <Smartphone size={20} />
                                <span>UPI/Online</span>
                            </button>
                            <button
                                className={`payment-btn ${paymentMode === 'CREDIT' ? 'active' : ''}`}
                                onClick={() => {
                                    if (!customerId) {
                                        showToast('warning', 'Please select a customer for credit sale');
                                        return;
                                    }
                                    setPaymentMode('CREDIT');
                                }}
                            >
                                <CreditCard size={20} />
                                <span>Credit</span>
                            </button>
                            <button
                                className={`payment-btn ${paymentMode === 'SPLIT' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('SPLIT')}
                            >
                                <Percent size={20} />
                                <span>Split</span>
                            </button>
                        </div>

                        {paymentMode === 'SPLIT' && (
                            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: 11 }}>Cash</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={cashAmount || ''}
                                        onChange={(e) => setSplitAmounts(parseFloat(e.target.value) || 0, onlineAmount)}
                                    />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 11 }}>Online</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={onlineAmount || ''}
                                        onChange={(e) => setSplitAmounts(cashAmount, parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Discount */}
                    <div className="sidebar-card">
                        <div className="sidebar-title">
                            <Percent size={14} /> Discount
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select
                                className="form-select"
                                style={{ width: 90 }}
                                value={discountType ?? ''}
                                onChange={(e) => setBillDiscount((e.target.value as 'PERCENTAGE' | 'FLAT') || null, discountValue)}
                            >
                                <option value="">None</option>
                                <option value="PERCENTAGE">%</option>
                                <option value="FLAT">₹</option>
                            </select>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="Value"
                                value={discountValue || ''}
                                onChange={(e) => setBillDiscount(discountType, parseFloat(e.target.value) || 0)}
                                disabled={!discountType}
                            />
                        </div>
                    </div>

                    {/* Totals & Action */}
                    <div className="sidebar-card totals-card">
                        <div className="total-row">
                            <span>Subtotal</span>
                            <span>{formatCurrency(billCalc.subtotal)}</span>
                        </div>
                        {billCalc.billDiscount > 0 && (
                            <div className="total-row" style={{ color: '#4ade80' }}>
                                <span>Discount</span>
                                <span>-{formatCurrency(billCalc.billDiscount)}</span>
                            </div>
                        )}
                        <div className="total-row">
                            <span>GST</span>
                            <span>{formatCurrency(billCalc.totalGst)}</span>
                        </div>
                        <div className="grand-total">
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Total</span>
                            <span>{formatCurrency(billCalc.finalAmount)}</span>
                        </div>

                        <button
                            className="save-btn"
                            onClick={handleSubmitBill}
                            disabled={items.length === 0 || isSubmitting}
                        >
                            {isSubmitting ? 'Processing...' : 'Complete Sale (Ctrl+S)'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && lastBill && (
                <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
                    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-body" style={{ textAlign: 'center', padding: 32 }}>
                            <div style={{
                                width: 72, height: 72, background: 'var(--color-success-100)', color: 'var(--color-success-600)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                            }}>
                                <Check size={40} />
                            </div>
                            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Sale Completed!</h3>
                            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)', marginBottom: 24 }}>
                                {lastBill.bill_number}
                            </div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-secondary btn-lg" onClick={handlePrint}>
                                    <Printer size={18} /> Print Bill
                                </button>
                                <button className="btn btn-primary btn-lg" onClick={() => setShowSuccessModal(false)}>
                                    New Sale
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Patient Details Modal */}
            {showPatientModal && (
                <div className="modal-overlay" onClick={() => setShowPatientModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Patient & Prescription Details</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPatientModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (tempPatientInfo.patient_name && tempPatientInfo.doctor_name && tempPatientInfo.doctor_prescription && tempPatientInfo.patient_age !== undefined && tempPatientInfo.patient_gender) {
                                setPatientInfo(tempPatientInfo);
                                setShowPatientModal(false);
                            } else {
                                showToast('warning', 'Please fill all required fields: Patient Name, Age, Gender, Doctor Name, and Prescription');
                            }
                        }}>
                            <div className="modal-body">
                                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                                    <AlertCircle size={16} />
                                    <span>Required for Schedule H/H1 drugs compliance.</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Patient Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.patient_name}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_name: e.target.value })}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Age *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={tempPatientInfo.patient_age ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_age: e.target.value ? parseInt(e.target.value) : undefined })}
                                            required
                                            min={0}
                                            max={150}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Gender *</label>
                                        <select
                                            className="form-select"
                                            value={tempPatientInfo.patient_gender ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_gender: e.target.value as 'M' | 'F' | 'O' | undefined || undefined })}
                                            required
                                        >
                                            <option value="">Select</option>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                            <option value="O">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Doctor Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.doctor_name ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, doctor_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Doctor Reg. No.</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.doctor_registration_number ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, doctor_registration_number: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Doctor's Prescription *</label>
                                        <textarea
                                            className="form-input"
                                            rows={4}
                                            value={tempPatientInfo.doctor_prescription ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, doctor_prescription: e.target.value })}
                                            required
                                            placeholder="Enter the doctor's prescription details..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPatientModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Details
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
