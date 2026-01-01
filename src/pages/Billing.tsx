// =====================================================
// Billing Page
// Modern POS-style billing with tablet/piece tracking
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
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastBill, setLastBill] = useState<Bill | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [tempPatientInfo, setTempPatientInfo] = useState<ScheduledMedicineInput>({
        patient_name: '',
        patient_age: undefined,
        patient_gender: undefined,
        patient_phone: '',
        patient_address: '',
        doctor_name: '',
        prescription_number: ''
    });

    // Check if cart has scheduled medicines
    const hasScheduled = hasScheduledMedicines();
    const searchInputRef = useRef<HTMLInputElement>(null);

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
            } catch (err) {
                console.error('Search failed:', err);
            }
        }, 300),
        []
    );

    useEffect(() => {
        performSearch(searchQuery);
    }, [searchQuery, performSearch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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
                clearBill();
            }
            if (e.key === 'Escape') setShowSearchDropdown(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, isSubmitting, clearBill]);

    const handleAddItem = (item: StockItem) => {
        addItem(item, 1);
        setSearchQuery('');
        setShowSearchDropdown(false);
        searchInputRef.current?.focus();
    };

    const handleSubmitBill = async () => {
        if (items.length === 0) return;
        if (paymentMode === 'CREDIT' && !customerId) {
            setError('Please select a customer for credit sale');
            showToast('warning', 'Please select a customer for credit sale');
            return;
        }

        // Check if scheduled medicines require patient info
        if (hasScheduled && (!patientInfo || !patientInfo.patient_name)) {
            setError('Patient details required for scheduled medicines');
            showToast('warning', 'Please enter patient details for scheduled medicines');
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
            // Reset patient info form
            setTempPatientInfo({
                patient_name: '',
                patient_age: undefined,
                patient_gender: undefined,
                patient_phone: '',
                patient_address: '',
                doctor_name: '',
                prescription_number: ''
            });
        } catch (err) {
            console.error('Bill creation error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to create bill';
            setError(errorMessage);
            showToast('error', errorMessage);
        }
        setIsSubmitting(false);
    };

    const handlePrint = () => {
        try {
            window.print();
            showToast('info', 'Print dialog opened');
        } catch {
            showToast('warning', 'Printer not available');
        }
    };

    const styles = `
        .pos-layout {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 16px;
            height: calc(100vh - 120px);
            padding: 16px;
            overflow: hidden;
        }
        
        .pos-main {
            display: flex;
            flex-direction: column;
            background: var(--bg-secondary);
            border-radius: 12px;
            border: 1px solid var(--border-light);
            overflow: hidden;
        }
        
        .pos-search {
            position: relative;
            padding: 12px;
            background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
        }
        
        .pos-search input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            font-size: 15px;
            border: none;
            border-radius: 8px;
            background: rgba(255,255,255,0.95);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        .pos-search input:focus {
            outline: none;
            box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        }
        
        .pos-search-icon {
            position: absolute;
            left: 24px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
        }
        
        .pos-dropdown {
            position: absolute;
            top: 100%;
            left: 12px;
            right: 12px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            max-height: 300px;
            overflow-y: auto;
            z-index: 100;
        }
        
        .pos-dropdown-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            cursor: pointer;
            border-bottom: 1px solid var(--border-light);
            gap: 12px;
        }
        
        .pos-dropdown-item:hover {
            background: var(--color-primary-50);
        }
        
        .pos-dropdown-item:last-child {
            border-bottom: none;
        }
        
        .pos-items {
            flex: 1;
            overflow-y: auto;
        }
        
        .pos-items-header {
            display: grid;
            grid-template-columns: 2fr 70px 50px 80px 80px 32px;
            gap: 8px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            font-size: 11px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: sticky;
            top: 0;
        }
        
        .pos-item-row {
            display: grid;
            grid-template-columns: 2fr 70px 50px 80px 80px 32px;
            gap: 8px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-light);
            align-items: center;
            font-size: 13px;
        }
        
        .pos-item-row:hover {
            background: var(--bg-tertiary);
        }
        
        .pos-item-name {
            font-weight: 500;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .pos-item-batch {
            font-size: 10px;
            color: var(--text-tertiary);
        }
        
        .pos-qty-input {
            width: 100%;
            padding: 4px 6px;
            text-align: center;
            border: 1px solid var(--border-light);
            border-radius: 4px;
            font-size: 13px;
            font-family: var(--font-mono);
        }
        
        .pos-qty-input:focus {
            outline: none;
            border-color: var(--color-primary-500);
        }
        
        .pos-delete {
            color: var(--color-danger-500);
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.15s;
        }
        
        .pos-delete:hover {
            opacity: 1;
        }
        
        .pos-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-tertiary);
            gap: 8px;
        }
        
        .pos-sidebar {
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
        }
        
        .pos-card {
            background: var(--bg-secondary);
            border-radius: 10px;
            border: 1px solid var(--border-light);
            padding: 12px;
        }
        
        .pos-card-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .pos-payment-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }
        
        .pos-pay-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            padding: 8px 4px;
            border: 2px solid var(--border-light);
            border-radius: 6px;
            background: var(--bg-secondary);
            cursor: pointer;
            font-size: 9px;
            font-weight: 500;
            transition: all 0.15s;
        }
        
        .pos-pay-btn:hover {
            border-color: var(--color-primary-300);
        }
        
        .pos-pay-btn.active {
            border-color: var(--color-primary-500);
            background: var(--color-primary-50);
            color: var(--color-primary-700);
        }
        
        .pos-totals {
            background: linear-gradient(135deg, #1a1f2e, #0f1219);
            color: white;
            border: none;
        }
        
        .pos-total-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
        }
        
        .pos-total-row.grand {
            font-size: 18px;
            font-weight: 700;
            border-top: 1px solid rgba(255,255,255,0.2);
            padding-top: 10px;
            margin-top: 6px;
        }
        
        .pos-submit {
            width: 100%;
            padding: 12px;
            font-size: 14px;
            font-weight: 600;
            background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
            margin-top: 8px;
        }
        
        .pos-submit:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(30, 142, 180, 0.3);
        }
        
        .pos-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .pos-success {
            text-align: center;
            padding: 20px;
        }
        
        .pos-success-icon {
            width: 64px;
            height: 64px;
            background: var(--color-success-100);
            color: var(--color-success-600);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
        }
        
        .pos-bill-number {
            font-size: 20px;
            font-weight: 700;
            font-family: var(--font-mono);
            color: var(--color-primary-600);
        }
    `;

    return (
        <>
            <style>{styles}</style>

            {error && (
                <div className="alert alert-danger" style={{ margin: '8px 16px 0' }}>
                    <AlertCircle size={16} />
                    <span style={{ flex: 1 }}>{error}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="pos-layout">
                {/* Main Area */}
                <div className="pos-main">
                    {/* Search */}
                    <div className="pos-search">
                        <Search className="pos-search-icon" size={18} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search medicine... (F2)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                        />

                        {showSearchDropdown && searchResults.length > 0 && (
                            <div className="pos-dropdown">
                                {searchResults.map((item) => {
                                    const tps = item.tablets_per_strip || 10;
                                    const s = Math.floor(item.quantity / tps);
                                    const p = item.quantity % tps;
                                    return (
                                        <div
                                            key={item.batch_id}
                                            className="pos-dropdown-item"
                                            onClick={() => handleAddItem(item)}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.medicine_name}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                    {item.batch_number} • Exp: {formatDate(item.expiry_date)}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                                    {formatCurrency(item.selling_price)}
                                                </div>
                                                <div style={{ fontSize: 10 }}>
                                                    <span className="badge badge-success">
                                                        {s > 0 ? `${s}S${p > 0 ? `+${p}` : ''}` : `${p}pcs`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="pos-items">
                        {items.length > 0 ? (
                            <>
                                <div className="pos-items-header">
                                    <span>Medicine</span>
                                    <span style={{ textAlign: 'center' }}>Strips</span>
                                    <span style={{ textAlign: 'center' }}>Pcs</span>
                                    <span style={{ textAlign: 'right' }}>Rate</span>
                                    <span style={{ textAlign: 'right' }}>Amount</span>
                                    <span></span>
                                </div>
                                {items.map((item, index) => {
                                    const itemCalc = billCalc.items[index];
                                    const tps = item.batch.tablets_per_strip || 10;
                                    return (
                                        <div key={item.batch.batch_id} className="pos-item-row">
                                            <div>
                                                <div className="pos-item-name">{item.batch.medicine_name}</div>
                                                <div className="pos-item-batch">
                                                    {item.batch.batch_number} • {tps}/strip • {item.quantity}pcs
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                className="pos-qty-input"
                                                value={item.quantityStrips}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                    updateItemStripsPieces(item.batch.batch_id, Math.max(0, val), item.quantityPieces);
                                                }}
                                                min={0}
                                            />
                                            <input
                                                type="number"
                                                className="pos-qty-input"
                                                value={item.quantityPieces}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                    updateItemStripsPieces(item.batch.batch_id, item.quantityStrips, Math.max(0, val));
                                                }}
                                                min={0}
                                                max={tps - 1}
                                            />
                                            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                                {formatCurrency(item.batch.selling_price / tps)}/pc
                                            </div>
                                            <div style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                                {formatCurrency(itemCalc?.total ?? 0)}
                                            </div>
                                            <Trash2
                                                size={16}
                                                className="pos-delete"
                                                onClick={() => removeItem(item.batch.batch_id)}
                                            />
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="pos-empty">
                                <Search size={40} strokeWidth={1} />
                                <span>Search medicine to add</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="pos-sidebar">
                    {/* Customer */}
                    <div className="pos-card">
                        <div className="pos-card-title">
                            <User size={14} /> Customer
                        </div>
                        <select
                            className="form-select"
                            style={{ fontSize: 13 }}
                            value={customerId ?? ''}
                            onChange={(e) => {
                                const id = e.target.value ? parseInt(e.target.value) : null;
                                const c = customers.find(c => c.id === id);
                                setCustomer(id, c?.name ?? '');
                            }}
                        >
                            <option value="">Walk-in Customer</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Patient Details for Scheduled Medicines */}
                    {hasScheduled && (
                        <div className="pos-card" style={{ borderColor: patientInfo?.patient_name ? 'var(--color-success-500)' : 'var(--color-warning-500)', borderWidth: 2 }}>
                            <div className="pos-card-title" style={{ color: patientInfo?.patient_name ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>
                                <AlertCircle size={14} /> Patient Details (Required)
                            </div>
                            {patientInfo?.patient_name ? (
                                <div style={{ fontSize: 12 }}>
                                    <div style={{ fontWeight: 600 }}>{patientInfo.patient_name}</div>
                                    {patientInfo.patient_age && <span>Age: {patientInfo.patient_age} </span>}
                                    {patientInfo.patient_gender && <span>({patientInfo.patient_gender}) </span>}
                                    {patientInfo.patient_phone && <div>📞 {patientInfo.patient_phone}</div>}
                                    {patientInfo.doctor_name && <div>Dr. {patientInfo.doctor_name}</div>}
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
                                    className="btn btn-warning"
                                    style={{ width: '100%' }}
                                    onClick={() => setShowPatientModal(true)}
                                >
                                    Enter Patient Details
                                </button>
                            )}
                        </div>
                    )}

                    {/* Payment */}
                    <div className="pos-card">
                        <div className="pos-card-title">
                            <CreditCard size={14} /> Payment
                        </div>
                        <div className="pos-payment-grid">
                            <button
                                className={`pos-pay-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('CASH')}
                            >
                                <Banknote size={16} />
                                CASH
                            </button>
                            <button
                                className={`pos-pay-btn ${paymentMode === 'ONLINE' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('ONLINE')}
                            >
                                <Smartphone size={16} />
                                UPI
                            </button>
                            <button
                                className={`pos-pay-btn ${paymentMode === 'CREDIT' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('CREDIT')}
                            >
                                <CreditCard size={16} />
                                CREDIT
                            </button>
                            <button
                                className={`pos-pay-btn ${paymentMode === 'SPLIT' ? 'active' : ''}`}
                                onClick={() => setPaymentMode('SPLIT')}
                            >
                                <Percent size={16} />
                                SPLIT
                            </button>
                        </div>

                        {paymentMode === 'SPLIT' && (
                            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Cash</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ fontSize: 13 }}
                                        value={cashAmount || ''}
                                        onChange={(e) => setSplitAmounts(parseFloat(e.target.value) || 0, onlineAmount)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Online</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ fontSize: 13 }}
                                        value={onlineAmount || ''}
                                        onChange={(e) => setSplitAmounts(cashAmount, parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Discount */}
                    <div className="pos-card">
                        <div className="pos-card-title">
                            <Percent size={14} /> Discount
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select
                                className="form-select"
                                style={{ width: 80, fontSize: 13 }}
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
                                style={{ fontSize: 13 }}
                                placeholder="0"
                                value={discountValue || ''}
                                onChange={(e) => setBillDiscount(discountType, parseFloat(e.target.value) || 0)}
                                disabled={!discountType}
                            />
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="pos-card pos-totals">
                        <div className="pos-total-row">
                            <span>Subtotal</span>
                            <span>{formatCurrency(billCalc.subtotal)}</span>
                        </div>
                        {billCalc.billDiscount > 0 && (
                            <div className="pos-total-row" style={{ color: 'var(--color-success-400)' }}>
                                <span>Discount</span>
                                <span>-{formatCurrency(billCalc.billDiscount)}</span>
                            </div>
                        )}
                        <div className="pos-total-row">
                            <span>GST</span>
                            <span>{formatCurrency(billCalc.totalGst)}</span>
                        </div>
                        <div className="pos-total-row grand">
                            <span>Total</span>
                            <span>{formatCurrency(billCalc.finalAmount)}</span>
                        </div>

                        <button
                            className="pos-submit"
                            onClick={handleSubmitBill}
                            disabled={items.length === 0 || isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : `Save Bill • ${formatCurrency(billCalc.finalAmount)}`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && lastBill && (
                <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
                    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-body pos-success">
                            <div className="pos-success-icon">
                                <Check size={32} />
                            </div>
                            <div className="pos-bill-number">{lastBill.bill_number}</div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Bill saved successfully!<br />
                                Amount: {formatCurrency(lastBill.grand_total)}
                            </p>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={handlePrint}>
                                    <Printer size={16} /> Print
                                </button>
                                <button className="btn btn-primary" onClick={() => setShowSuccessModal(false)}>
                                    New Bill
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Patient Details Modal for Scheduled Medicines */}
            {showPatientModal && (
                <div className="modal-overlay" onClick={() => setShowPatientModal(false)}>
                    <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Patient Details (Schedule H/H1 Drug)</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPatientModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (tempPatientInfo.patient_name) {
                                setPatientInfo(tempPatientInfo);
                                setShowPatientModal(false);
                            }
                        }}>
                            <div className="modal-body">
                                <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                                    As per drug regulations, patient details are required for scheduled medicines.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                                        <label className="form-label">Age</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={tempPatientInfo.patient_age ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_age: e.target.value ? parseInt(e.target.value) : undefined })}
                                            min="0"
                                            max="150"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select
                                            className="form-select"
                                            value={tempPatientInfo.patient_gender ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_gender: e.target.value as 'M' | 'F' | 'O' | undefined || undefined })}
                                        >
                                            <option value="">Select</option>
                                            <option value="M">Male</option>
                                            <option value="F">Female</option>
                                            <option value="O">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            value={tempPatientInfo.patient_phone ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Doctor Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.doctor_name ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, doctor_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Address</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.patient_address ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, patient_address: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Prescription Number</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={tempPatientInfo.prescription_number ?? ''}
                                            onChange={(e) => setTempPatientInfo({ ...tempPatientInfo, prescription_number: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPatientModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!tempPatientInfo.patient_name}>
                                    Save Patient Details
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
