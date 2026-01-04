// =====================================================
// MedBill - Settings Page
// Application Settings and Configuration
// =====================================================

import {
    AlertCircle,
    Calendar,
    Check,
    Clock,
    Database,
    Download,
    Edit2,
    FolderOpen,
    HardDrive,
    Printer,
    RefreshCw,
    Save,
    Store,
    Trash2,
    Upload,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createUser, deactivateUser, updateUser } from '../services/auth.service';
import type { BackupInfo } from '../services/backup.service';
import {
    createBackup,
    deleteBackup,
    formatFileSize,
    getBackupFolderPath,
    listBackups,
    restoreFromBackup
} from '../services/backup.service';
import { execute, query } from '../services/database';
import { useAuthStore, useSettingsStore } from '../stores';
import type { User, UserRole } from '../types';

type SettingsTab = 'shop' | 'billing' | 'users' | 'backup' | 'about';

interface UserFormData {
    username: string;
    password: string;
    confirmPassword: string;
    full_name: string;
    role: UserRole;
}

const initialUserForm: UserFormData = {
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'staff'
};

export function Settings() {
    const { user } = useAuthStore();
    const { settings, updateSetting } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [users, setUsers] = useState<User[]>([]);

    // User management state
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userForm, setUserForm] = useState<UserFormData>(initialUserForm);
    const [userFormError, setUserFormError] = useState<string>('');

    // Backup state
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);
    const [backupFolder, setBackupFolder] = useState<string>('');
    const [deletingBackup, setDeletingBackup] = useState<string | null>(null);

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
        if (activeTab === 'backup') {
            loadBackups();
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
        setIsBackingUp(true);
        try {
            await createBackup();
            await loadBackups();
            alert('Backup created successfully!');
        } catch (error) {
            console.error('Backup failed:', error);
            alert('Failed to create backup. Check console for details.');
        }
        setIsBackingUp(false);
    };

    const handleRestoreBackup = async (filename: string) => {
        if (!confirm(`⚠️ WARNING: This will replace ALL current data with the backup "${filename}".\n\nThe application will reload after restore. Are you sure you want to continue?`)) {
            return;
        }

        setIsRestoring(true);
        try {
            await restoreFromBackup(filename);
            alert('Database restored successfully! The app will now reload.');
            window.location.reload();
        } catch (error) {
            console.error('Restore failed:', error);
            alert('Failed to restore backup. The file may be corrupted.');
        }
        setIsRestoring(false);
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete the backup "${filename}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        setDeletingBackup(filename);
        try {
            await deleteBackup(filename);
            await loadBackups();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete backup.');
        }
        setDeletingBackup(null);
    };

    const loadBackups = async () => {
        setIsLoadingBackups(true);
        try {
            const backupList = await listBackups();
            setBackups(backupList);
            const folder = await getBackupFolderPath();
            setBackupFolder(folder);
        } catch (error) {
            console.error('Failed to load backups:', error);
        }
        setIsLoadingBackups(false);
    };

    // User management functions
    const handleOpenUserModal = (userToEdit?: User) => {
        if (userToEdit) {
            setEditingUser(userToEdit);
            setUserForm({
                username: userToEdit.username,
                password: '',
                confirmPassword: '',
                full_name: userToEdit.full_name,
                role: userToEdit.role
            });
        } else {
            setEditingUser(null);
            setUserForm(initialUserForm);
        }
        setUserFormError('');
        setShowUserModal(true);
    };

    const handleCloseUserModal = () => {
        setShowUserModal(false);
        setEditingUser(null);
        setUserForm(initialUserForm);
        setUserFormError('');
    };

    const handleSaveUser = async () => {
        // Validation
        if (!userForm.full_name.trim()) {
            setUserFormError('Full name is required');
            return;
        }
        if (!userForm.username.trim()) {
            setUserFormError('Username is required');
            return;
        }
        if (userForm.username.length < 3) {
            setUserFormError('Username must be at least 3 characters');
            return;
        }

        if (!editingUser) {
            // New user - password required
            if (!userForm.password) {
                setUserFormError('Password is required');
                return;
            }
            if (userForm.password.length < 4) {
                setUserFormError('Password must be at least 4 characters');
                return;
            }
            if (userForm.password !== userForm.confirmPassword) {
                setUserFormError('Passwords do not match');
                return;
            }
        } else if (userForm.password) {
            // Editing user with new password
            if (userForm.password.length < 4) {
                setUserFormError('Password must be at least 4 characters');
                return;
            }
            if (userForm.password !== userForm.confirmPassword) {
                setUserFormError('Passwords do not match');
                return;
            }
        }

        setIsSaving(true);
        try {
            if (editingUser) {
                // Update existing user
                await updateUser(editingUser.id, {
                    full_name: userForm.full_name,
                    role: userForm.role
                });
                // Update password if provided
                if (userForm.password) {
                    await execute(
                        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [userForm.password, editingUser.id]
                    );
                }
            } else {
                // Create new user
                await createUser(
                    userForm.username.trim().toLowerCase(),
                    userForm.password,
                    userForm.full_name.trim(),
                    userForm.role
                );
            }

            handleCloseUserModal();
            await loadUsers();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error: any) {
            console.error('Failed to save user:', error);
            if (error.message?.includes('UNIQUE constraint')) {
                setUserFormError('Username already exists');
            } else {
                setUserFormError('Failed to save user. Please try again.');
            }
        }
        setIsSaving(false);
    };

    const handleDeleteUser = async (userToDelete: User) => {
        // Prevent deleting yourself
        if (userToDelete.id === user?.id) {
            alert('You cannot delete your own account!');
            return;
        }

        // Prevent deleting the last admin
        const adminCount = users.filter(u => u.role === 'admin').length;
        if (userToDelete.role === 'admin' && adminCount <= 1) {
            alert('Cannot delete the last admin user!');
            return;
        }

        if (!confirm(`Are you sure you want to delete user "${userToDelete.full_name}"?`)) {
            return;
        }

        try {
            await deactivateUser(userToDelete.id);
            await loadUsers();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user. Please try again.');
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
            width: 60px;
            height: 60px;
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
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenUserModal()}>
                                            <Users size={16} />
                                            Add User
                                        </button>
                                    </div>

                                    <div className="user-list">
                                        {users.length === 0 && (
                                            <div className="text-center text-secondary py-8">
                                                No users found. Click "Add User" to create one.
                                            </div>
                                        )}
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
                                                <div className="flex gap-2 items-center">
                                                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}>
                                                        {u.role}
                                                    </span>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleOpenUserModal(u)}
                                                        title="Edit User"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    {u.id !== user?.id && (
                                                        <button
                                                            className="btn btn-ghost btn-sm text-danger"
                                                            onClick={() => handleDeleteUser(u)}
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                        <h2 className="settings-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Backup & Restore</h2>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={loadBackups} disabled={isLoadingBackups}>
                                                <RefreshCw size={16} className={isLoadingBackups ? 'animate-spin' : ''} />
                                                Refresh
                                            </button>
                                            <button className="btn btn-primary" onClick={handleBackup} disabled={isBackingUp}>
                                                <Download size={18} />
                                                {isBackingUp ? 'Creating...' : 'Create Backup'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Backup folder location */}
                                    {backupFolder && (
                                        <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}>
                                            <FolderOpen size={18} />
                                            <div>
                                                <strong>Backup Location:</strong>
                                                <span style={{ marginLeft: 'var(--space-2)', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                                                    {backupFolder}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Backup list */}
                                    <div style={{ marginTop: 'var(--space-4)' }}>
                                        <h3 className="font-semibold mb-3">Available Backups</h3>

                                        {isLoadingBackups ? (
                                            <div className="text-center text-secondary" style={{ padding: 'var(--space-6)' }}>
                                                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
                                                Loading backups...
                                            </div>
                                        ) : backups.length === 0 ? (
                                            <div className="text-center text-secondary" style={{ padding: 'var(--space-6)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
                                                <Database size={32} style={{ margin: '0 auto var(--space-2)', opacity: 0.5 }} />
                                                <p>No backups found</p>
                                                <p className="text-sm">Click "Create Backup" to create your first backup</p>
                                            </div>
                                        ) : (
                                            <div className="backup-list">
                                                {backups.map((backup) => (
                                                    <div key={backup.filename} className="backup-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                                            <div className="backup-icon" style={{ width: '40px', height: '40px', background: backup.isAutomatic ? 'var(--color-success-100)' : 'var(--color-primary-100)', color: backup.isAutomatic ? 'var(--color-success-600)' : 'var(--color-primary-600)' }}>
                                                                {backup.isAutomatic ? <Clock size={20} /> : <Download size={20} />}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                                    {backup.filename}
                                                                    {backup.isAutomatic && (
                                                                        <span className="badge badge-success" style={{ fontSize: 'var(--text-xs)' }}>Auto</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '2px' }}>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Calendar size={12} />
                                                                        {backup.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </span>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <Clock size={12} />
                                                                        {backup.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <HardDrive size={12} />
                                                                        {formatFileSize(backup.sizeBytes)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => handleRestoreBackup(backup.filename)}
                                                                disabled={isRestoring}
                                                                title="Restore this backup"
                                                            >
                                                                <Upload size={16} />
                                                                {isRestoring ? 'Restoring...' : 'Restore'}
                                                            </button>
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => handleDeleteBackup(backup.filename)}
                                                                disabled={deletingBackup === backup.filename}
                                                                title="Delete this backup"
                                                                style={{ color: 'var(--color-danger-500)' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="alert alert-info" style={{ marginTop: 'var(--space-6)' }}>
                                        <HardDrive size={18} />
                                        <div>
                                            <strong>Automatic Daily Backups:</strong> The application creates automatic daily backups
                                            with the format Backup_DDMMYYYY.db. Manual backups include timestamp for precise tracking.
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <style>{`
                          @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(10px); }
                            to { opacity: 1; transform: translateY(0); }
                          }

                          @keyframes slideIn {
                            from { opacity: 0; transform: translateX(-10px); }
                            to { opacity: 1; transform: translateX(0); }
                          }

                          .about-container {
                            animation: fadeIn 0.4s ease-out;
                            color: var(--text-primary);
                          }

                          .about-hero {
                            background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
                            border-radius: var(--radius-xl);
                            padding: var(--space-8);
                            color: white;
                            text-align: center;
                            margin-bottom: var(--space-8);
                            position: relative;
                            overflow: hidden;
                            box-shadow: 0 10px 30px -10px rgba(59, 130, 246, 0.3);
                          }

                          .about-hero::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: radial-gradient(circle at top right, rgba(255,255,255,0.1) 0%, transparent 60%);
                            pointer-events: none;
                          }

                          .about-logo-wrapper {
                            background: white;
                            width: 80px;
                            height: 80px;
                            border-radius: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto cubic-bezier(0.34, 1.56, 0.64, 1);
                            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                            margin-bottom: var(--space-4);
                            position: relative;
                            z-index: 1;
                          }

                          .about-logo-wrapper img {
                             width: 60px;
                             height: 60px;
                             object-fit: contain;
                          }

                          .about-app-name {
                            font-size: 2rem;
                            font-weight: 800;
                            letter-spacing: -0.02em;
                            margin-bottom: var(--space-1);
                            position: relative;
                            z-index: 1;
                          }

                          .about-version-badge {
                            display: inline-flex;
                            align-items: center;
                            gap: var(--space-1);
                            background: rgba(255,255,255,0.2);
                            backdrop-filter: blur(4px);
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: var(--text-sm);
                            font-weight: 500;
                            margin-bottom: var(--space-4);
                          }

                          .about-tagline {
                            font-size: var(--text-lg);
                            opacity: 0.9;
                            max-width: 400px;
                            margin: 0 auto;
                            line-height: 1.5;
                          }

                          .features-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: var(--space-4);
                            margin-bottom: var(--space-8);
                          }

                          .feature-card {
                            background: var(--bg-primary);
                            padding: var(--space-4);
                            border-radius: var(--radius-lg);
                            border: 1px solid var(--border-light);
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: flex-start;
                            gap: var(--space-3);
                          }

                          .about-hero {
                            background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
                            border-radius: var(--radius-xl);
                            padding: var(--space-10) var(--space-8);
                            color: white;
                            text-align: center;
                            margin-bottom: var(--space-8);
                            position: relative;
                            overflow: hidden;
                            box-shadow: 0 20px 40px -15px rgba(59, 130, 246, 0.4);
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                          }

                          .about-hero::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: radial-gradient(circle at 15% 15%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                        radial-gradient(circle at 85% 85%, rgba(0,0,0,0.1) 0%, transparent 50%);
                            pointer-events: none;
                          }

                          .about-brand-row {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: var(--space-6);
                            margin-bottom: var(--space-6);
                            position: relative;
                            z-index: 1;
                          }

                          .about-logo-wrapper {
                            background: rgba(255, 255, 255, 1);
                            width: 100px;
                            height: 100px;
                            border-radius: 28px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 12px 24px rgba(0,0,0,0.15);
                            flex-shrink: 0;
                            border: 4px solid rgba(255,255,255,0.2);
                          }

                          .about-logo-wrapper img {
                             width: 75px;
                             height: 75px;
                             object-fit: contain;
                          }

                          .about-title-group {
                            text-align: left;
                          }

                          .about-app-name {
                            font-size: 2.75rem;
                            font-weight: 900;
                            letter-spacing: -0.03em;
                            margin: 0;
                            line-height: 1;
                            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                          }

                          .about-software-badge {
                            font-size: 1.25rem;
                            font-weight: 500;
                            opacity: 0.9;
                            margin-top: 4px;
                            letter-spacing: 0.02em;
                          }

                          .about-status-row {
                            display: flex;
                            align-items: center;
                            gap: var(--space-4);
                            margin-top: var(--space-2);
                            position: relative;
                            z-index: 1;
                          }

                          .about-version-badge {
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            background: rgba(255,255,255,0.15);
                            backdrop-filter: blur(10px);
                            padding: 6px 16px;
                            border-radius: 100px;
                            font-size: var(--text-sm);
                            font-weight: 600;
                            border: 1px solid rgba(255,255,255,0.1);
                          }

                          .about-tagline {
                            font-size: var(--text-lg);
                            opacity: 0.85;
                            max-width: 500px;
                            margin: var(--space-6) auto 0;
                            line-height: 1.6;
                            font-weight: 400;
                            position: relative;
                            z-index: 1;
                          }

                          .features-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: var(--space-6);
                            margin-bottom: var(--space-8);
                          }

                          .feature-card {
                            background: rgba(255, 255, 255, 0.7);
                            backdrop-filter: blur(10px);
                            padding: var(--space-6);
                            border-radius: var(--radius-xl);
                            border: 1px solid rgba(255, 255, 255, 0.8);
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            display: flex;
                            align-items: center;
                            gap: var(--space-4);
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                          }

                          .feature-card:hover {
                            transform: translateY(-4px);
                            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.1);
                            border-color: var(--color-primary-200);
                            background: white;
                          }

                          .feature-icon-box {
                            background: linear-gradient(135deg, var(--color-primary-50), var(--color-primary-100));
                            color: var(--color-primary-600);
                            width: 48px;
                            height: 48px;
                            border-radius: 14px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            box-shadow: inset 0 2px 4px rgba(255,255,255,0.5);
                          }

                          .feature-content h4 {
                            font-size: var(--text-lg);
                            font-weight: 700;
                            margin-bottom: 4px;
                            color: var(--text-primary);
                          }

                          .feature-content p {
                            font-size: var(--text-sm);
                            color: var(--text-secondary);
                            line-height: 1.5;
                          }

                          .about-footer {
                            text-align: center;
                            padding-top: var(--space-4);
                          }
                        `}</style>

                        {activeTab === 'about' && (
                            <div className="about-container">
                                <div className="about-hero">
                                    <div className="about-brand-row">
                                        <div className="about-logo-wrapper">
                                            <img src="/logo.png" alt="Logo" />
                                        </div>
                                        <div className="about-title-group">
                                            <h1 className="about-app-name">Velan Medicals</h1>
                                            <div className="about-software-badge">Billing Software</div>
                                        </div>
                                    </div>

                                    <div className="about-status-row">
                                        <div className="about-version-badge">
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                                            Version 1.0.0 Stable
                                        </div>
                                    </div>

                                    <p className="about-tagline">
                                        Empowering medical retail stores with intelligent billing,
                                        seamless inventory management, and reliable offline-first technology.
                                    </p>
                                </div>

                                <div className="features-grid">
                                    <div className="feature-card">
                                        <div className="feature-icon-box">
                                            <Database size={24} />
                                        </div>
                                        <div className="feature-content">
                                            <h4>Offline Intelligence</h4>
                                            <p>Fully functional without internet. Your data is encrypted and saved locally.</p>
                                        </div>
                                    </div>
                                    <div className="feature-card">
                                        <div className="feature-icon-box">
                                            <Check size={24} />
                                        </div>
                                        <div className="feature-content">
                                            <h4>GST Precision</h4>
                                            <p>Hassle-free compliance with automatic GST splitting and HSN tracking.</p>
                                        </div>
                                    </div>
                                    <div className="feature-card">
                                        <div className="feature-icon-box">
                                            <RefreshCw size={24} />
                                        </div>
                                        <div className="feature-content">
                                            <h4>Smart Stocks</h4>
                                            <p>Automated expiry warnings and low-stock alerts to keep your shop running.</p>
                                        </div>
                                    </div>
                                    <div className="feature-card">
                                        <div className="feature-icon-box">
                                            <Users size={24} />
                                        </div>
                                        <div className="feature-content">
                                            <h4>Secure access</h4>
                                            <p>Role-based permissions to ensure your business data remains safe.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="about-footer">
                                    <div className="text-xs text-tertiary font-medium">
                                        Designed and Developed for Velan Medicals © {new Date().getFullYear()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="modal-overlay" onClick={handleCloseUserModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <button className="btn btn-ghost btn-sm" onClick={handleCloseUserModal}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {userFormError && (
                                <div className="alert alert-danger mb-4">
                                    <AlertCircle size={18} />
                                    {userFormError}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userForm.full_name}
                                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Username *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={userForm.username}
                                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                                    placeholder="Enter username"
                                    disabled={!!editingUser}
                                />
                                {editingUser && (
                                    <span className="form-hint">Username cannot be changed</span>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={userForm.password}
                                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                    placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={userForm.confirmPassword}
                                    onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                                    placeholder="Confirm password"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role *</label>
                                <select
                                    className="form-select"
                                    value={userForm.role}
                                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                                >
                                    <option value="staff">Staff</option>
                                    <option value="admin">Administrator</option>
                                </select>
                                <span className="form-hint">
                                    Administrators have full access. Staff have limited permissions.
                                </span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={handleCloseUserModal}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveUser}
                                disabled={isSaving}
                            >
                                <Save size={18} />
                                {isSaving ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
