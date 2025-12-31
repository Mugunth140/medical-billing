// =====================================================
// Customers Page
// Customer and Credit (Udhar) Management
// =====================================================

import {
    Edit,
    History,
    IndianRupee,
    Mail,
    Phone,
    Plus,
    Search,
    Trash2,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { execute, query } from '../services/database';
import type { CreateCustomerInput, Credit, Customer } from '../types';
import { formatCurrency, formatDate } from '../utils';

export function Customers() {
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [creditHistory, setCreditHistory] = useState<Credit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(0);

    const [customerForm, setCustomerForm] = useState<CreateCustomerInput>({
        name: '',
        phone: '',
        email: '',
        gstin: '',
        address: '',
        credit_limit: 5000
    });

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await query<Customer>(
                `SELECT * FROM customers WHERE is_active = 1 ORDER BY 
          CASE WHEN current_balance > 0 THEN 0 ELSE 1 END,
          current_balance DESC,
          name ASC`,
                []
            );
            setCustomers(data);
        } catch (error) {
            console.error('Failed to load customers:', error);
        }
        setIsLoading(false);
    };

    const loadCreditHistory = async (customerId: number) => {
        try {
            const data = await query<Credit>(
                `SELECT c.*, b.bill_number
         FROM credits c
         LEFT JOIN bills b ON c.bill_id = b.id
         WHERE c.customer_id = ?
         ORDER BY c.created_at DESC
         LIMIT 50`,
                [customerId]
            );
            setCreditHistory(data);
        } catch (error) {
            console.error('Failed to load credit history:', error);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            loadCreditHistory(selectedCustomer.id);
        }
    }, [selectedCustomer]);

    const filteredCustomers = searchQuery
        ? customers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone?.includes(searchQuery)
        )
        : customers;

    const totalCredit = customers.reduce((sum, c) => sum + c.current_balance, 0);
    const customersWithCredit = customers.filter(c => c.current_balance > 0).length;

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute(
                `INSERT INTO customers (name, phone, email, gstin, address, credit_limit)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    customerForm.name,
                    customerForm.phone || null,
                    customerForm.email || null,
                    customerForm.gstin || null,
                    customerForm.address || null,
                    customerForm.credit_limit || 5000
                ]
            );
            showToast('success', `Customer "${customerForm.name}" added successfully!`);
            setShowAddModal(false);
            setCustomerForm({ name: '', phone: '', email: '', gstin: '', address: '', credit_limit: 5000 });
            loadCustomers();
        } catch (error) {
            console.error('Failed to add customer:', error);
            showToast('error', 'Failed to add customer. Please try again.');
        }
    };

    const handleEditCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        try {
            await execute(
                `UPDATE customers SET name = ?, phone = ?, email = ?, gstin = ?, address = ?, credit_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [
                    customerForm.name,
                    customerForm.phone || null,
                    customerForm.email || null,
                    customerForm.gstin || null,
                    customerForm.address || null,
                    customerForm.credit_limit || 5000,
                    selectedCustomer.id
                ]
            );
            showToast('success', `Customer "${customerForm.name}" updated successfully!`);
            setShowEditModal(false);
            setSelectedCustomer({ ...selectedCustomer, ...customerForm });
            loadCustomers();
        } catch (error) {
            console.error('Failed to update customer:', error);
            showToast('error', 'Failed to update customer. Please try again.');
        }
    };

    const handleDeleteCustomer = async () => {
        if (!selectedCustomer) return;
        try {
            const customerName = selectedCustomer.name;
            // Soft delete - mark as inactive
            await execute(
                `UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [selectedCustomer.id]
            );
            showToast('success', `Customer "${customerName}" deleted successfully!`);
            setShowDeleteConfirm(false);
            setSelectedCustomer(null);
            loadCustomers();
        } catch (error) {
            console.error('Failed to delete customer:', error);
            showToast('error', 'Failed to delete customer. Please try again.');
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedCustomer || paymentAmount <= 0) return;

        try {
            const newBalance = selectedCustomer.current_balance - paymentAmount;

            await execute(
                `INSERT INTO credits (customer_id, transaction_type, amount, balance_after, payment_mode, user_id)
         VALUES (?, 'PAYMENT', ?, ?, 'CASH', 1)`,
                [selectedCustomer.id, paymentAmount, newBalance]
            );

            await execute(
                `UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newBalance, selectedCustomer.id]
            );

            setShowPaymentModal(false);
            setPaymentAmount(0);
            setSelectedCustomer({ ...selectedCustomer, current_balance: newBalance });
            loadCustomers();
            loadCreditHistory(selectedCustomer.id);
        } catch (error) {
            console.error('Failed to record payment:', error);
        }
    };

    const openEditModal = () => {
        if (selectedCustomer) {
            setCustomerForm({
                name: selectedCustomer.name,
                phone: selectedCustomer.phone || '',
                email: selectedCustomer.email || '',
                gstin: selectedCustomer.gstin || '',
                address: selectedCustomer.address || '',
                credit_limit: selectedCustomer.credit_limit
            });
            setShowEditModal(true);
        }
    };

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Customers & Credits</h1>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} />
                        Add Customer
                    </button>
                </div>
            </header>

            <div className="page-body">
                <style>{`
          .customers-layout {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: var(--space-6);
            height: calc(100vh - 180px);
          }
          
          .customers-list {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          
          .customers-header {
            padding: var(--space-4);
            border-bottom: 1px solid var(--border-light);
          }
          
          .customers-search {
            position: relative;
          }
          
          .customers-search input {
            padding-left: var(--space-10);
          }
          
          .customers-search-icon {
            position: absolute;
            left: var(--space-3);
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
          }
          
          .customers-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-3);
            padding: var(--space-4);
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-light);
          }
          
          .customers-scroll {
            flex: 1;
            overflow-y: auto;
          }
          
          .customer-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-4);
            border-bottom: 1px solid var(--border-light);
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          
          .customer-item:hover {
            background: var(--bg-tertiary);
          }
          
          .customer-item.selected {
            background: var(--color-primary-50);
            border-left: 3px solid var(--color-primary-500);
          }
          
          .customer-name {
            font-weight: var(--font-medium);
            margin-bottom: 2px;
          }
          
          .customer-phone {
            font-size: var(--text-sm);
            color: var(--text-tertiary);
          }
          
          .customer-balance {
            font-family: var(--font-mono);
            font-weight: var(--font-semibold);
          }
          
          .customer-balance.has-credit {
            color: var(--color-danger-600);
          }
          
          .customer-detail {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          
          .detail-header {
            padding: var(--space-5);
            border-bottom: 1px solid var(--border-light);
          }
          
          .detail-name {
            font-size: var(--text-xl);
            font-weight: var(--font-semibold);
            margin-bottom: var(--space-2);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          
          .detail-actions {
            display: flex;
            gap: var(--space-2);
          }
          
          .detail-contact {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
          
          .detail-contact-item {
            display: flex;
            align-items: center;
            gap: var(--space-2);
          }
          
          .detail-balance {
            padding: var(--space-4);
            background: var(--color-danger-50);
            margin: var(--space-4);
            border-radius: var(--radius-lg);
            text-align: center;
          }
          
          .detail-balance-value {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            font-family: var(--font-mono);
            color: var(--color-danger-600);
          }
          
          .detail-balance-label {
            font-size: var(--text-sm);
            color: var(--color-danger-700);
          }
          
          .credit-history {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-4);
          }
          
          .history-title {
            font-weight: var(--font-semibold);
            margin-bottom: var(--space-3);
            display: flex;
            align-items: center;
            gap: var(--space-2);
          }
          
          .history-item {
            display: flex;
            justify-content: space-between;
            padding: var(--space-3);
            background: var(--bg-tertiary);
            border-radius: var(--radius-md);
            margin-bottom: var(--space-2);
          }
          
          .history-type {
            font-size: var(--text-xs);
            font-weight: var(--font-medium);
            padding: 2px 6px;
            border-radius: var(--radius-sm);
          }
          
          .history-type.sale {
            background: var(--color-danger-100);
            color: var(--color-danger-700);
          }
          
          .history-type.payment {
            background: var(--color-success-100);
            color: var(--color-success-700);
          }
          
          .empty-detail {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-tertiary);
          }
        `}</style>

                <div className="customers-layout">
                    {/* Customer List */}
                    <div className="customers-list">
                        <div className="customers-header">
                            <div className="customers-search">
                                <Search className="customers-search-icon" size={18} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search customers..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="customers-stats">
                            <div>
                                <div className="text-lg font-bold text-danger">{formatCurrency(totalCredit)}</div>
                                <div className="text-xs text-secondary">Total Pending</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold">{customersWithCredit}</div>
                                <div className="text-xs text-secondary">With Credit</div>
                            </div>
                        </div>

                        <div className="customers-scroll">
                            {isLoading ? (
                                <div className="empty-state">
                                    <div className="loading-spinner" />
                                </div>
                            ) : filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer) => (
                                    <div
                                        key={customer.id}
                                        className={`customer-item ${selectedCustomer?.id === customer.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedCustomer(customer)}
                                    >
                                        <div>
                                            <div className="customer-name">{customer.name}</div>
                                            <div className="customer-phone">{customer.phone || 'No phone'}</div>
                                        </div>
                                        <div className={`customer-balance ${customer.current_balance > 0 ? 'has-credit' : ''}`}>
                                            {formatCurrency(customer.current_balance)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <Users size={48} strokeWidth={1} />
                                    <p className="mt-4">No customers found</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer Detail */}
                    <div className="customer-detail">
                        {selectedCustomer ? (
                            <>
                                <div className="detail-header">
                                    <div className="detail-name">
                                        <span>{selectedCustomer.name}</span>
                                        <div className="detail-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={openEditModal} title="Edit Customer">
                                                <Edit size={16} />
                                            </button>
                                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => setShowDeleteConfirm(true)} title="Delete Customer">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="detail-contact">
                                        {selectedCustomer.phone && (
                                            <div className="detail-contact-item">
                                                <Phone size={14} />
                                                {selectedCustomer.phone}
                                            </div>
                                        )}
                                        {selectedCustomer.email && (
                                            <div className="detail-contact-item">
                                                <Mail size={14} />
                                                {selectedCustomer.email}
                                            </div>
                                        )}
                                        <div className="detail-contact-item text-xs text-tertiary mt-2">
                                            Credit Limit: {formatCurrency(selectedCustomer.credit_limit)}
                                        </div>
                                    </div>
                                </div>

                                {selectedCustomer.current_balance > 0 && (
                                    <div className="detail-balance">
                                        <div className="detail-balance-value">
                                            {formatCurrency(selectedCustomer.current_balance)}
                                        </div>
                                        <div className="detail-balance-label">Outstanding Credit</div>
                                        <button
                                            className="btn btn-success mt-3"
                                            onClick={() => {
                                                setPaymentAmount(selectedCustomer.current_balance);
                                                setShowPaymentModal(true);
                                            }}
                                        >
                                            <IndianRupee size={16} />
                                            Record Payment
                                        </button>
                                    </div>
                                )}

                                <div className="credit-history">
                                    <div className="history-title">
                                        <History size={16} />
                                        Credit History
                                    </div>
                                    {creditHistory.length > 0 ? (
                                        creditHistory.map((credit) => (
                                            <div key={credit.id} className="history-item">
                                                <div>
                                                    <span className={`history-type ${credit.transaction_type.toLowerCase()}`}>
                                                        {credit.transaction_type}
                                                    </span>
                                                    <div className="text-xs text-tertiary mt-1">
                                                        {formatDate(credit.created_at, 'dd/MM/yyyy hh:mm a')}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-mono font-semibold ${credit.transaction_type === 'PAYMENT' ? 'text-success' : 'text-danger'
                                                        }`}>
                                                        {credit.transaction_type === 'PAYMENT' ? '-' : '+'}
                                                        {formatCurrency(credit.amount)}
                                                    </div>
                                                    <div className="text-xs text-tertiary">
                                                        Bal: {formatCurrency(credit.balance_after)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-tertiary text-sm">No credit history</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="empty-detail">
                                <Users size={48} strokeWidth={1} />
                                <p className="mt-4">Select a customer to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Customer</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddCustomer}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={customerForm.name}
                                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={customerForm.phone}
                                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={customerForm.email}
                                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">GSTIN (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={customerForm.gstin}
                                        onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                                        placeholder="e.g., 22AAAAA0000A1Z5"
                                        maxLength={15}
                                    />
                                    <small className="text-secondary">For B2B billing with GST credit</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={2}
                                        value={customerForm.address}
                                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Credit Limit (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={customerForm.credit_limit || ''}
                                        onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Customer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Customer Modal */}
            {showEditModal && selectedCustomer && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Customer</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowEditModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditCustomer}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={customerForm.name}
                                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={customerForm.phone}
                                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={customerForm.email}
                                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">GSTIN (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={customerForm.gstin}
                                        onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                                        placeholder="e.g., 22AAAAA0000A1Z5"
                                        maxLength={15}
                                    />
                                    <small className="text-secondary">For B2B billing with GST credit</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={2}
                                        value={customerForm.address}
                                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Credit Limit (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={customerForm.credit_limit || ''}
                                        onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
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
            {showDeleteConfirm && selectedCustomer && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Customer</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete <strong>{selectedCustomer.name}</strong>?</p>
                            {selectedCustomer.current_balance > 0 && (
                                <p className="text-danger mt-2">
                                    ⚠️ This customer has an outstanding balance of {formatCurrency(selectedCustomer.current_balance)}
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleDeleteCustomer}>
                                Delete Customer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedCustomer && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Record Payment</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPaymentModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="mb-4">
                                Recording payment for <strong>{selectedCustomer.name}</strong>
                            </p>
                            <p className="text-secondary mb-4">
                                Outstanding: <span className="text-danger font-semibold">{formatCurrency(selectedCustomer.current_balance)}</span>
                            </p>
                            <div className="form-group">
                                <label className="form-label">Payment Amount (₹)</label>
                                <input
                                    type="number"
                                    className="form-input form-input-lg"
                                    value={paymentAmount || ''}
                                    onChange={(e) => setPaymentAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    max={selectedCustomer.current_balance}
                                    min="0"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleRecordPayment}
                                disabled={paymentAmount <= 0 || paymentAmount > selectedCustomer.current_balance}
                            >
                                <IndianRupee size={16} />
                                Record {formatCurrency(paymentAmount)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
