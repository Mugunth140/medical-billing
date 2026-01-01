// =====================================================
// MedBill - Settings Page
// Application Settings and Configuration
// =====================================================

import {
    AlertCircle,
    Check,
    Database,
    Download,
    HardDrive,
    Package,
    Printer,
    Save,
    Store,
    Trash2,
    Upload,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { execute, query } from '../services/database';
import { clearDatabase, seedDatabase } from '../services/seed';
import { useAuthStore, useSettingsStore } from '../stores';
import type { User } from '../types';

type SettingsTab = 'shop' | 'billing' | 'users' | 'backup' | 'about';

export function Settings() {
    const { user } = useAuthStore();
    const { settings, updateSetting } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [users, setUsers] = useState<User[]>([]);

    // Shop settings form
    const [shopForm, setShopForm] = useState({
        shop_name: settings.shop_name || '',
        shop_address: settings.shop_address || '',
        shop_phone: settings.shop_phone || '',
        shop_email: settings.shop_email || '',
        shop_gstin: settings.shop_gstin || '',
        drug_license: settings.drug_license || ''
    });

    // Billing settings
    const [billingForm, setBillingForm] = useState<{
        bill_prefix: string;
        default_gst_rate: string;
        low_stock_threshold: string;
        expiry_warning_days: string;
        enable_discounts: boolean;
        require_customer: boolean;
        staff_discount_limit: string;
    }>({
        bill_prefix: settings.bill_prefix || 'INV',
        default_gst_rate: settings.default_gst_rate || '12',
        low_stock_threshold: settings.low_stock_threshold || '10',
        expiry_warning_days: settings.expiry_warning_days || '30',
        enable_discounts: settings.enable_discounts !== 'false',
        require_customer: settings.require_customer === 'true',
        staff_discount_limit: settings.staff_discount_limit || '10'
    });

    useEffect(() => {
        if (activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab]);

    const loadUsers = async () => {
        try {
            const data = await query<User>(
                'SELECT * FROM users WHERE is_active = 1 ORDER BY full_name',
                []
            );
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    const handleSaveShopSettings = async () => {
        setIsSaving(true);
        try {
            for (const [key, value] of Object.entries(shopForm)) {
                await execute(
                    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                    [key, value]
                );
                updateSetting(key, value);
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
        setIsSaving(false);
    };

    const handleSaveBillingSettings = async () => {
        setIsSaving(true);
        try {
            const settingsToSave = {
                ...billingForm,
                enable_discounts: String(billingForm.enable_discounts),
                require_customer: String(billingForm.require_customer)
            };

            for (const [key, value] of Object.entries(settingsToSave)) {
                await execute(
                    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                    [key, String(value)]
                );
                updateSetting(key, String(value));
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
        setIsSaving(false);
    };

    const handleBackup = async () => {
        // TODO: Implement actual backup using Tauri FS plugin
        alert('Backup functionality will be implemented with Tauri FS plugin');
    };

    const handleRestore = async () => {
        // TODO: Implement actual restore using Tauri dialog and FS plugins
        alert('Restore functionality will be implemented with Tauri dialog plugin');
    };

    const handleSeedDatabase = async () => {
        if (!confirm('This will add demo data to your database. Continue?')) return;
        try {
            await seedDatabase();
            alert('Demo data added successfully! Refresh the app to see the changes.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to seed database:', error);
            alert('Failed to seed database. Check console for details.');
        }
    };

    const handleClearDatabase = async () => {
        if (!confirm('⚠️ WARNING: This will DELETE all data except settings. This cannot be undone!\n\nAre you absolutely sure?')) return;
        if (!confirm('Final confirmation: Type "DELETE" below to confirm.\n\nClick OK to proceed or Cancel to abort.')) return;
        try {
            await clearDatabase();
            alert('Database cleared successfully! The app will now reload.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to clear database:', error);
            alert('Failed to clear database. Check console for details.');
        }
    };

    const isAdmin = user?.role === 'admin';

    const tabs = [
        { id: 'shop' as const, label: 'Shop Details', icon: Store, adminOnly: false },
        { id: 'billing' as const, label: 'Billing', icon: Printer, adminOnly: false },
        { id: 'users' as const, label: 'Users', icon: Users, adminOnly: true },
        { id: 'backup' as const, label: 'Backup', icon: Database, adminOnly: true },
        { id: 'about' as const, label: 'About', icon: AlertCircle, adminOnly: false },
    ];

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Settings</h1>
                {saveSuccess && (
                    <div className="flex items-center gap-2 text-success">
                        <Check size={18} />
                        Settings saved successfully
                    </div>
                )}
            </header>

            <div className="page-body">
                <style>{`
          .settings-layout {
            display: grid;
            grid-template-columns: 220px 1fr;
            gap: var(--space-6);
          }
          
          .settings-nav {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-4);
          }
          
          .settings-nav-item {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            cursor: pointer;
            color: var(--text-secondary);
            transition: all var(--transition-fast);
            margin-bottom: var(--space-1);
          }
          
          .settings-nav-item:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }
          
          .settings-nav-item.active {
            background: var(--color-primary-600);
            color: var(--text-inverse);
          }
          
          .settings-nav-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .settings-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-lg);
            padding: var(--space-6);
          }
          
          .settings-section {
            margin-bottom: var(--space-8);
          }
          
          .settings-section:last-child {
            margin-bottom: 0;
          }
          
          .settings-section-title {
            font-size: var(--text-lg);
            font-weight: var(--font-semibold);
            margin-bottom: var(--space-4);
            padding-bottom: var(--space-2);
            border-bottom: 1px solid var(--border-light);
          }
          
          .settings-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-4);
          }
          
          .settings-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-3) 0;
            border-bottom: 1px solid var(--border-light);
          }
          
          .settings-row:last-child {
            border-bottom: none;
          }
          
          .settings-label {
            font-weight: var(--font-medium);
          }
          
          .settings-description {
            font-size: var(--text-sm);
            color: var(--text-tertiary);
          }
          
          .toggle-switch {
            position: relative;
            width: 48px;
            height: 24px;
            background: var(--border-medium);
            border-radius: var(--radius-full);
            cursor: pointer;
            transition: all var(--transition-fast);
          }
          
          .toggle-switch.active {
            background: var(--color-success-500);
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
          }
          
          .toggle-switch.active::after {
            left: 26px;
          }
          
          .user-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
          }
          
          .user-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--space-4);
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
          }
          
          .user-info {
            display: flex;
            align-items: center;
            gap: var(--space-3);
          }
          
          .user-avatar {
            width: 40px;
            height: 40px;
            background: var(--color-primary-500);
            color: var(--text-inverse);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: var(--font-bold);
          }
          
          .backup-card {
            background: var(--bg-tertiary);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            margin-bottom: var(--space-4);
          }
          
          .backup-icon {
            width: 48px;
            height: 48px;
            background: var(--color-primary-100);
            color: var(--color-primary-600);
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: var(--space-3);
          }
          
          .about-info {
            text-align: center;
            padding: var(--space-8);
          }
          
          .about-logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700));
            color: var(--text-inverse);
            border-radius: var(--radius-xl);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: var(--text-3xl);
            font-weight: var(--font-bold);
            margin: 0 auto var(--space-4);
          }
          
          .about-title {
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            margin-bottom: var(--space-2);
          }
          
          .about-version {
            color: var(--text-secondary);
            margin-bottom: var(--space-4);
          }
          
          .about-features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-3);
            text-align: left;
            margin-top: var(--space-6);
          }
          
          .feature-item {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }
        `}</style>

                <div className="settings-layout">
                    {/* Navigation */}
                    <nav className="settings-nav">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isDisabled = tab.adminOnly && !isAdmin;
                            return (
                                <div
                                    key={tab.id}
                                    className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Content */}
                    <div className="settings-content">
                        {/* Shop Details */}
                        {activeTab === 'shop' && (
                            <>
                                <div className="settings-section">
                                    <h2 className="settings-section-title">Shop Information</h2>
                                    <div className="settings-grid">
                                        <div className="form-group">
                                            <label className="form-label">Shop Name</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={shopForm.shop_name}
                                                onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
                                                placeholder="Your Medical Store Name"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone Number</label>
                                            <input
                                                type="tel"
                                                className="form-input"
                                                value={shopForm.shop_phone}
                                                onChange={(e) => setShopForm({ ...shopForm, shop_phone: e.target.value })}
                                                placeholder="+91 XXXXXXXXXX"
                                            />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Address</label>
                                            <textarea
                                                className="form-textarea"
                                                rows={2}
                                                value={shopForm.shop_address}
                                                onChange={(e) => setShopForm({ ...shopForm, shop_address: e.target.value })}
                                                placeholder="Full shop address"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={shopForm.shop_email}
                                                onChange={(e) => setShopForm({ ...shopForm, shop_email: e.target.value })}
                                                placeholder="shop@example.com"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">GSTIN</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={shopForm.shop_gstin}
                                                onChange={(e) => setShopForm({ ...shopForm, shop_gstin: e.target.value.toUpperCase() })}
                                                placeholder="22AAAAA0000A1Z5"
                                                maxLength={15}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Drug License Number</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={shopForm.drug_license}
                                                onChange={(e) => setShopForm({ ...shopForm, drug_license: e.target.value })}
                                                placeholder="DL-XX-XXXXXXX"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveShopSettings}
                                    disabled={isSaving}
                                >
                                    <Save size={18} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        )}

                        {/* Billing Settings */}
                        {activeTab === 'billing' && (
                            <>
                                <div className="settings-section">
                                    <h2 className="settings-section-title">Invoice Settings</h2>
                                    <div className="settings-grid">
                                        <div className="form-group">
                                            <label className="form-label">Bill Number Prefix</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={billingForm.bill_prefix}
                                                onChange={(e) => setBillingForm({ ...billingForm, bill_prefix: e.target.value.toUpperCase() })}
                                                maxLength={5}
                                            />
                                            <span className="form-hint">Example: INV-242500001</span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Default GST Rate (%)</label>
                                            <select
                                                className="form-select"
                                                value={billingForm.default_gst_rate}
                                                onChange={(e) => setBillingForm({ ...billingForm, default_gst_rate: e.target.value })}
                                            >
                                                <option value="0">0% (Exempt)</option>
                                                <option value="5">5%</option>
                                                <option value="12">12%</option>
                                                <option value="18">18%</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h2 className="settings-section-title">Stock Alerts</h2>
                                    <div className="settings-grid">
                                        <div className="form-group">
                                            <label className="form-label">Low Stock Threshold</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={billingForm.low_stock_threshold}
                                                onChange={(e) => setBillingForm({ ...billingForm, low_stock_threshold: e.target.value })}
                                                min={1}
                                            />
                                            <span className="form-hint">Alert when stock falls below this quantity</span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Expiry Warning (Days)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={billingForm.expiry_warning_days}
                                                onChange={(e) => setBillingForm({ ...billingForm, expiry_warning_days: e.target.value })}
                                                min={1}
                                            />
                                            <span className="form-hint">Warn before this many days of expiry</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h2 className="settings-section-title">Billing Options</h2>
                                    <div className="settings-row">
                                        <div>
                                            <div className="settings-label">Enable Discounts</div>
                                            <div className="settings-description">Allow applying discounts on bills</div>
                                        </div>
                                        <div
                                            className={`toggle-switch ${billingForm.enable_discounts ? 'active' : ''}`}
                                            onClick={() => setBillingForm({ ...billingForm, enable_discounts: !billingForm.enable_discounts })}
                                        />
                                    </div>
                                    <div className="settings-row">
                                        <div>
                                            <div className="settings-label">Require Customer Selection</div>
                                            <div className="settings-description">Mandate customer selection for each bill</div>
                                        </div>
                                        <div
                                            className={`toggle-switch ${billingForm.require_customer ? 'active' : ''}`}
                                            onClick={() => setBillingForm({ ...billingForm, require_customer: !billingForm.require_customer })}
                                        />
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h2 className="settings-section-title">Staff Permissions</h2>
                                    <div className="settings-grid">
                                        <div className="form-group">
                                            <label className="form-label">Staff Discount Limit (%)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={billingForm.staff_discount_limit}
                                                onChange={(e) => setBillingForm({ ...billingForm, staff_discount_limit: e.target.value })}
                                                min={0}
                                                max={100}
                                            />
                                            <span className="form-hint">Maximum discount % staff can apply (Admin can apply unlimited)</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveBillingSettings}
                                    disabled={isSaving}
                                >
                                    <Save size={18} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        )}

                        {/* Users */}
                        {activeTab === 'users' && isAdmin && (
                            <>
                                <div className="settings-section">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="settings-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
                                            User Management
                                        </h2>
                                        <button className="btn btn-primary btn-sm">
                                            <Users size={16} />
                                            Add User
                                        </button>
                                    </div>

                                    <div className="user-list">
                                        {users.map((u) => (
                                            <div key={u.id} className="user-card">
                                                <div className="user-info">
                                                    <div className="user-avatar">
                                                        {u.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{u.full_name}</div>
                                                        <div className="text-sm text-secondary">
                                                            @{u.username} • {u.role === 'admin' ? 'Administrator' : 'Staff'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}>
                                                        {u.role}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Backup */}
                        {activeTab === 'backup' && isAdmin && (
                            <>
                                <div className="settings-section">
                                    <h2 className="settings-section-title">Backup & Restore</h2>

                                    <div className="backup-card">
                                        <div className="backup-icon">
                                            <Download size={24} />
                                        </div>
                                        <h3 className="font-semibold mb-2">Create Backup</h3>
                                        <p className="text-secondary text-sm mb-4">
                                            Download a complete backup of your database including all medicines,
                                            bills, customers, and settings.
                                        </p>
                                        <button className="btn btn-primary" onClick={handleBackup}>
                                            <Download size={18} />
                                            Download Backup
                                        </button>
                                    </div>

                                    <div className="backup-card">
                                        <div className="backup-icon" style={{ background: 'var(--color-warning-100)', color: 'var(--color-warning-600)' }}>
                                            <Upload size={24} />
                                        </div>
                                        <h3 className="font-semibold mb-2">Restore from Backup</h3>
                                        <p className="text-secondary text-sm mb-4">
                                            Restore your database from a previously created backup file.
                                            This will replace all current data.
                                        </p>
                                        <button className="btn btn-secondary" onClick={handleRestore}>
                                            <Upload size={18} />
                                            Restore Backup
                                        </button>
                                    </div>

                                    <div className="alert alert-info">
                                        <HardDrive size={18} />
                                        <div>
                                            <strong>Automatic Backups:</strong> The application automatically saves your
                                            data locally. For extra safety, create manual backups regularly and store
                                            them on a separate drive or cloud storage.
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h2 className="settings-section-title">Demo Data</h2>
                                    <div className="backup-card">
                                        <div className="backup-icon" style={{ background: 'var(--color-success-100)', color: 'var(--color-success-600)' }}>
                                            <Package size={24} />
                                        </div>
                                        <h3 className="font-semibold mb-2">Seed Demo Data</h3>
                                        <p className="text-secondary text-sm mb-4">
                                            Add sample medicines, suppliers, customers, bills, and purchases to test the application.
                                            This will not overwrite existing data.
                                        </p>
                                        <button className="btn btn-success" onClick={handleSeedDatabase}>
                                            <Package size={18} />
                                            Add Demo Data
                                        </button>
                                    </div>

                                    <div className="backup-card" style={{ marginTop: 'var(--space-4)' }}>
                                        <div className="backup-icon" style={{ background: 'var(--color-danger-100)', color: 'var(--color-danger-600)' }}>
                                            <Trash2 size={24} />
                                        </div>
                                        <h3 className="font-semibold mb-2">Clear All Data</h3>
                                        <p className="text-secondary text-sm mb-4">
                                            Delete all medicines, suppliers, customers, bills, and purchases.
                                            Settings will be preserved. This action cannot be undone!
                                        </p>
                                        <button className="btn btn-danger" onClick={handleClearDatabase}>
                                            <Trash2 size={18} />
                                            Clear Database
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* About */}
                        {activeTab === 'about' && (
                            <div className="about-info">
                                <div className="about-logo">💊</div>
                                <h2 className="about-title">Medical Billing</h2>
                                <p className="about-version">Version 1.0.0</p>
                                <p className="text-secondary">
                                    Offline Billing & Inventory Management Software<br />
                                    Designed for Indian Medical Retail Shops
                                </p>

                                <div className="about-features">
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        GST Compliant with HSN Codes
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Offline First Architecture
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Batch & Expiry Tracking
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Credit (Udhar) Management
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Multi-payment Modes
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Thermal Printer Support
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Keyboard Shortcuts
                                    </div>
                                    <div className="feature-item">
                                        <Check size={16} className="text-success" />
                                        Local Data Backup
                                    </div>
                                </div>

                                <div className="mt-8 text-sm text-tertiary">
                                    Built with ❤️ using React, Tauri & SQLite
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
