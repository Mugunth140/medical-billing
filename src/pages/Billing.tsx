// =====================================================
// Billing Page
// POS-style multi-item billing with GST calculations
// =====================================================

import {
    AlertCircle,
    Banknote,
    Check,
    CreditCard,
    Minus,
    Percent,
    Plus,
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
import type { Bill, Customer, StockItem } from '../types';
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
        addItem,
        updateItemQuantity,
        removeItem,
        setCustomer,
        setBillDiscount,
        setPaymentMode,
        setSplitAmounts,
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

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Calculate bill totals
    const billCalc = calculateBill(
        items.map(item => ({
            batch: {
                id: item.batch.batch_id,
                selling_price: item.batch.selling_price,
                price_type: item.batch.price_type,
                gst_rate: item.batch.gst_rate
            },
            quantity: item.quantity,
            discountType: item.discountType,
            discountValue: item.discountValue
        })),
        discountType ?? undefined,
        discountValue
    );

    // Load customers
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

    // Search medicines
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

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Focus search: Ctrl+F or F2
            if ((e.ctrlKey && e.key === 'f') || e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // Save bill: Ctrl+S
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (items.length > 0 && !isSubmitting) {
                    handleSubmitBill();
                }
            }
            // Clear bill: Ctrl+Delete
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                clearBill();
            }
            // Escape: Close dropdowns
            if (e.key === 'Escape') {
                setShowSearchDropdown(false);
            }
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

        // Validate credit sale requires customer
        if (paymentMode === 'CREDIT' && !customerId) {
            setError('Please select a customer for credit sale');
            showToast('warning', 'Please select a customer for credit sale');
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
                        discount_type: item.discountType,
                        discount_value: item.discountValue
                    })),
                    discount_type: discountType ?? undefined,
                    discount_value: discountValue,
                    payment_mode: paymentMode,
                    cash_amount: cashAmount,
                    online_amount: onlineAmount,
                    notes: notes || undefined
                },
                user!.id
            );

            setLastBill(bill);
            setShowSuccessModal(true);
            showToast('success', `Bill ${bill.bill_number} created successfully!`);
            clearBill();
        } catch (err) {
            console.error('Bill creation error:', err);
            let errorMessage = 'Failed to create bill';
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else {
                errorMessage = JSON.stringify(err);
            }

            setError(errorMessage);
            showToast('error', errorMessage);
        }

        setIsSubmitting(false);
    };

    const handlePrint = () => {
        // Note: Thermal printing requires proper printer setup
        // For now, use browser print which works without a connected printer
        try {
            window.print();
            showToast('info', 'Print dialog opened. Bill saved to history.');
        } catch {
            showToast('warning', 'Printer not connected. Bill has been saved to history.');
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">New Bill</h1>
                <div className="page-actions">
                    <span className="text-sm text-secondary">
                        <kbd className="kbd">F2</kbd> Search &nbsp;
                        <kbd className="kbd">Ctrl+S</kbd> Save
                    </span>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .billing-container {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: var(--space-6);
            height: calc(100vh - 180px);
          }
          
          .billing-main {
            display: flex;
            flex-direction: column;
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            border: 1px solid var(--border-light);
            overflow: hidden;
          }
          
          .billing-search-wrapper {
            position: relative;
            padding: var(--space-4);
            border-bottom: 1px solid var(--border-light);
          }
          
          .billing-search-input {
            width: 100%;
            padding: var(--space-3) var(--space-4);
            padding-left: var(--space-10);
            font-size: var(--text-lg);
            border: 2px solid var(--border-light);
            border-radius: var(--radius-lg);
            transition: all var(--transition-fast);
          }
          
          .billing-search-input:focus {
            outline: none;
            border-color: var(--color-primary-500);
          }
          
          .billing-search-icon {
            position: absolute;
            left: calc(var(--space-4) + var(--space-3));
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
          }
          
          .search-dropdown {
            position: absolute;
            top: 100%;
            left: var(--space-4);
            right: var(--space-4);
            background: var(--bg-secondary);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            max-height: 400px;
            overflow-y: auto;
            z-index: var(--z-dropdown);
          }
          
          .search-item {
            display: grid;
            grid-template-columns: 1fr auto auto auto;
            gap: var(--space-3);
            align-items: center;
            padding: var(--space-3) var(--space-4);
            cursor: pointer;
            border-bottom: 1px solid var(--border-light);
          }
          
          .search-item:hover {
            background: var(--bg-tertiary);
          }
          
          .search-item:last-child {
            border-bottom: none;
          }
          
          .search-item-name {
            font-weight: var(--font-medium);
          }
          
          .search-item-meta {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }
          
          .billing-items-table {
            flex: 1;
            overflow-y: auto;
          }
          
          .items-header {
            display: grid;
            grid-template-columns: 2.5fr 80px 100px 80px 100px 50px;
            gap: var(--space-2);
            padding: var(--space-3) var(--space-4);
            background: var(--bg-tertiary);
            font-size: var(--text-sm);
            font-weight: var(--font-semibold);
            color: var(--text-secondary);
            position: sticky;
            top: 0;
          }
          
          .item-row {
            display: grid;
            grid-template-columns: 2.5fr 80px 100px 80px 100px 50px;
            gap: var(--space-2);
            padding: var(--space-3) var(--space-4);
            border-bottom: 1px solid var(--border-light);
            align-items: center;
          }
          
          .item-row:hover {
            background: var(--bg-tertiary);
          }
          
          .item-name {
            font-weight: var(--font-medium);
          }
          
          .item-meta {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }
          
          .qty-controls {
            display: flex;
            align-items: center;
            gap: var(--space-1);
          }
          
          .qty-btn {
            width: 24px;
            height: 24px;
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-sm);
            background: var(--bg-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          
          .qty-btn:hover {
            background: var(--bg-tertiary);
          }
          
          .qty-input {
            width: 40px;
            text-align: center;
            border: 1px solid var(--border-light);
            border-radius: var(--radius-sm);
            padding: var(--space-1);
            font-family: var(--font-mono);
          }
          
          .delete-btn {
            color: var(--color-danger-500);
            cursor: pointer;
            opacity: 0.6;
            transition: all var(--transition-fast);
          }
          
          .delete-btn:hover {
            opacity: 1;
          }
          
          .billing-sidebar {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }
          
          .sidebar-card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            border: 1px solid var(--border-light);
            padding: var(--space-4);
          }
          
          .sidebar-title {
            font-weight: var(--font-semibold);
            margin-bottom: var(--space-3);
            display: flex;
            align-items: center;
            gap: var(--space-2);
          }
          
          .customer-select {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            border: 1px solid var(--border-medium);
            border-radius: var(--radius-md);
            cursor: pointer;
          }
          
          .customer-select:hover {
            border-color: var(--color-primary-500);
          }
          
          .payment-modes {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-2);
          }
          
          .payment-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-1);
            padding: var(--space-3);
            border: 2px solid var(--border-light);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
            background: var(--bg-secondary);
          }
          
          .payment-btn:hover {
            border-color: var(--color-primary-300);
          }
          
          .payment-btn.active {
            border-color: var(--color-primary-500);
            background: var(--color-primary-50);
          }
          
          .payment-btn-label {
            font-size: var(--text-xs);
            font-weight: var(--font-medium);
          }
          
          .totals-card {
            background: var(--color-gray-900);
            color: var(--text-inverse);
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: var(--space-2) 0;
            font-size: var(--text-sm);
          }
          
          .total-row.grand {
            font-size: var(--text-xl);
            font-weight: var(--font-bold);
            border-top: 1px solid rgba(255,255,255,0.2);
            padding-top: var(--space-3);
            margin-top: var(--space-2);
          }
          
          .submit-btn {
            width: 100%;
            padding: var(--space-4);
            font-size: var(--text-lg);
            font-weight: var(--font-semibold);
            margin-top: var(--space-3);
          }
          
          .empty-items {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-tertiary);
            padding: var(--space-8);
          }
          
          .gst-info {
            font-size: var(--text-xs);
            color: rgba(255,255,255,0.7);
            margin-top: var(--space-3);
            padding-top: var(--space-3);
            border-top: 1px solid rgba(255,255,255,0.1);
          }
          
          .success-modal {
            text-align: center;
          }
          
          .success-icon {
            width: 80px;
            height: 80px;
            background: var(--color-success-100);
            color: var(--color-success-600);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto var(--space-4);
          }
          
          .bill-number {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            color: var(--color-primary-600);
            margin-bottom: var(--space-2);
          }
        `}</style>

                {error && (
                    <div className="alert alert-danger mb-4">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setError(null)}
                            style={{ marginLeft: 'auto' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <div className="billing-container">
                    {/* Main Billing Area */}
                    <div className="billing-main">
                        {/* Search */}
                        <div className="billing-search-wrapper">
                            <Search className="billing-search-icon" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="billing-search-input"
                                placeholder="Search medicine by name or batch number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                            />

                            {showSearchDropdown && searchResults.length > 0 && (
                                <div className="search-dropdown">
                                    {searchResults.map((item) => (
                                        <div
                                            key={item.batch_id}
                                            className="search-item"
                                            onClick={() => handleAddItem(item)}
                                        >
                                            <div>
                                                <div className="search-item-name">{item.medicine_name}</div>
                                                <div className="search-item-meta">
                                                    Batch: {item.batch_number} | Exp: {formatDate(item.expiry_date)} |
                                                    Loc: {item.rack || '-'}/{item.box || '-'}
                                                </div>
                                            </div>
                                            <span className="gst-badge">{item.gst_rate}%</span>
                                            <span className="font-mono">{formatCurrency(item.selling_price)}</span>
                                            <span className="badge badge-success">{item.quantity} qty</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div className="billing-items-table">
                            {items.length > 0 ? (
                                <>
                                    <div className="items-header">
                                        <span>Medicine</span>
                                        <span className="text-center">Qty</span>
                                        <span className="text-right">Rate</span>
                                        <span className="text-center">GST%</span>
                                        <span className="text-right">Amount</span>
                                        <span></span>
                                    </div>
                                    {items.map((item, index) => {
                                        const itemCalc = billCalc.items[index];
                                        return (
                                            <div key={item.batch.batch_id} className="item-row">
                                                <div>
                                                    <div className="item-name">{item.batch.medicine_name}</div>
                                                    <div className="item-meta">
                                                        {item.batch.batch_number} | Exp: {formatDate(item.batch.expiry_date)}
                                                    </div>
                                                </div>
                                                <div className="qty-controls">
                                                    <button
                                                        className="qty-btn"
                                                        onClick={() => updateItemQuantity(item.batch.batch_id, Math.max(1, item.quantity - 1))}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="qty-input"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                                                            updateItemQuantity(item.batch.batch_id, Math.max(1, val));
                                                        }}
                                                        min={1}
                                                        max={item.batch.quantity}
                                                    />
                                                    <button
                                                        className="qty-btn"
                                                        onClick={() => updateItemQuantity(item.batch.batch_id, Math.min(item.batch.quantity, item.quantity + 1))}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <div className="text-right font-mono">
                                                    {formatCurrency(item.batch.selling_price)}
                                                </div>
                                                <div className="text-center">
                                                    <span className="gst-badge">{item.batch.gst_rate}%</span>
                                                </div>
                                                <div className="text-right font-mono font-semibold">
                                                    {formatCurrency(itemCalc?.total ?? 0)}
                                                </div>
                                                <div>
                                                    <Trash2
                                                        size={18}
                                                        className="delete-btn"
                                                        onClick={() => removeItem(item.batch.batch_id)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className="empty-items">
                                    <Search size={48} strokeWidth={1} />
                                    <p className="mt-4">Search and add medicines to start billing</p>
                                    <p className="text-sm">Press F2 to focus search</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="billing-sidebar">
                        {/* Customer */}
                        <div className="sidebar-card">
                            <div className="sidebar-title">
                                <User size={18} />
                                Customer
                            </div>
                            <select
                                className="form-select"
                                value={customerId ?? ''}
                                onChange={(e) => {
                                    const id = e.target.value ? parseInt(e.target.value) : null;
                                    const customer = customers.find(c => c.id === id);
                                    setCustomer(id, customer?.name ?? '');
                                }}
                            >
                                <option value="">Walk-in Customer</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {customerId && (
                                <div className="text-xs mt-2 text-secondary">
                                    Credit Balance: {formatCurrency(customers.find(c => c.id === customerId)?.current_balance ?? 0)}
                                </div>
                            )}
                        </div>

                        {/* Payment Mode */}
                        <div className="sidebar-card">
                            <div className="sidebar-title">
                                <CreditCard size={18} />
                                Payment Mode
                            </div>
                            <div className="payment-modes">
                                <button
                                    className={`payment-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
                                    onClick={() => setPaymentMode('CASH')}
                                >
                                    <Banknote size={20} />
                                    <span className="payment-btn-label">CASH</span>
                                </button>
                                <button
                                    className={`payment-btn ${paymentMode === 'ONLINE' ? 'active' : ''}`}
                                    onClick={() => setPaymentMode('ONLINE')}
                                >
                                    <Smartphone size={20} />
                                    <span className="payment-btn-label">ONLINE</span>
                                </button>
                                <button
                                    className={`payment-btn ${paymentMode === 'CREDIT' ? 'active' : ''}`}
                                    onClick={() => setPaymentMode('CREDIT')}
                                >
                                    <CreditCard size={20} />
                                    <span className="payment-btn-label">CREDIT</span>
                                </button>
                                <button
                                    className={`payment-btn ${paymentMode === 'SPLIT' ? 'active' : ''}`}
                                    onClick={() => setPaymentMode('SPLIT')}
                                >
                                    <Percent size={20} />
                                    <span className="payment-btn-label">SPLIT</span>
                                </button>
                            </div>

                            {paymentMode === 'SPLIT' && (
                                <div className="mt-3">
                                    <div className="form-group">
                                        <label className="form-label">Cash Amount</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={cashAmount || ''}
                                            onChange={(e) => setSplitAmounts(e.target.value === '' ? 0 : parseFloat(e.target.value), onlineAmount)}
                                        />
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="form-label">Online Amount</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={onlineAmount || ''}
                                            onChange={(e) => setSplitAmounts(cashAmount, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Discount */}
                        <div className="sidebar-card">
                            <div className="sidebar-title">
                                <Percent size={18} />
                                Bill Discount
                            </div>
                            <div className="flex gap-2">
                                <select
                                    className="form-select"
                                    style={{ width: '100px' }}
                                    value={discountType ?? ''}
                                    onChange={(e) => setBillDiscount(
                                        (e.target.value as 'PERCENTAGE' | 'FLAT') || null,
                                        discountValue
                                    )}
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
                                    onChange={(e) => setBillDiscount(
                                        discountType,
                                        e.target.value === '' ? 0 : parseFloat(e.target.value)
                                    )}
                                    disabled={!discountType}
                                />
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="sidebar-card totals-card">
                            <div className="total-row">
                                <span>Subtotal</span>
                                <span className="font-mono">{formatCurrency(billCalc.subtotal)}</span>
                            </div>
                            {billCalc.itemDiscountTotal > 0 && (
                                <div className="total-row">
                                    <span>Item Discounts</span>
                                    <span className="font-mono">-{formatCurrency(billCalc.itemDiscountTotal)}</span>
                                </div>
                            )}
                            <div className="total-row">
                                <span>Taxable Amount</span>
                                <span className="font-mono">{formatCurrency(billCalc.taxableTotal)}</span>
                            </div>
                            <div className="total-row">
                                <span>CGST</span>
                                <span className="font-mono">{formatCurrency(billCalc.totalCgst)}</span>
                            </div>
                            <div className="total-row">
                                <span>SGST</span>
                                <span className="font-mono">{formatCurrency(billCalc.totalSgst)}</span>
                            </div>
                            {billCalc.billDiscount > 0 && (
                                <div className="total-row">
                                    <span>Bill Discount</span>
                                    <span className="font-mono">-{formatCurrency(billCalc.billDiscount)}</span>
                                </div>
                            )}
                            {billCalc.roundOff !== 0 && (
                                <div className="total-row">
                                    <span>Round Off</span>
                                    <span className="font-mono">{billCalc.roundOff > 0 ? '+' : ''}{formatCurrency(billCalc.roundOff)}</span>
                                </div>
                            )}
                            <div className="total-row grand">
                                <span>Grand Total</span>
                                <span className="font-mono">{formatCurrency(billCalc.finalAmount)}</span>
                            </div>

                            <div className="gst-info">
                                Total GST: {formatCurrency(billCalc.totalGst)} (CGST: {formatCurrency(billCalc.totalCgst)} + SGST: {formatCurrency(billCalc.totalSgst)})
                            </div>

                            <button
                                className="btn btn-success submit-btn"
                                onClick={handleSubmitBill}
                                disabled={items.length === 0 || isSubmitting}
                            >
                                {isSubmitting ? 'Processing...' : `Save Bill (${formatCurrency(billCalc.finalAmount)})`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && lastBill && (
                <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-body success-modal">
                            <div className="success-icon">
                                <Check size={40} />
                            </div>
                            <h2>Bill Created Successfully!</h2>
                            <div className="bill-number">{lastBill.bill_number}</div>
                            <p className="text-secondary">
                                Amount: {formatCurrency(lastBill.grand_total)} | Mode: {lastBill.payment_mode}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSuccessModal(false)}>
                                Close
                            </button>
                            <button className="btn btn-primary" onClick={handlePrint}>
                                <Printer size={18} />
                                Print Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
