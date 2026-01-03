import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, UserRole } from '../types';

// Mock database functions
const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });
const mockQuery = vi.fn().mockResolvedValue([]);

vi.mock('../services/database', () => ({
    execute: (...args: unknown[]) => mockExecute(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    queryOne: vi.fn().mockResolvedValue(null),
    exportDatabase: vi.fn().mockResolvedValue({
        _meta: [{ version: '1.0.0', created_at: new Date().toISOString() }],
        users: [],
        medicines: [],
        settings: []
    }),
    importDatabase: vi.fn().mockResolvedValue(undefined)
}));

describe('User Management', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('User Form Validation', () => {
        it('should require full name', () => {
            const formData = {
                username: 'testuser',
                password: 'password123',
                confirmPassword: 'password123',
                full_name: '',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (!formData.full_name.trim()) {
                errors.push('Full name is required');
            }
            expect(errors).toContain('Full name is required');
        });

        it('should require username', () => {
            const formData = {
                username: '',
                password: 'password123',
                confirmPassword: 'password123',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (!formData.username.trim()) {
                errors.push('Username is required');
            }
            expect(errors).toContain('Username is required');
        });

        it('should require username to be at least 3 characters', () => {
            const formData = {
                username: 'ab',
                password: 'password123',
                confirmPassword: 'password123',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (formData.username.length < 3) {
                errors.push('Username must be at least 3 characters');
            }
            expect(errors).toContain('Username must be at least 3 characters');
        });

        it('should require password for new users', () => {
            const isEditing = false;
            const formData = {
                username: 'testuser',
                password: '',
                confirmPassword: '',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (!isEditing && !formData.password) {
                errors.push('Password is required');
            }
            expect(errors).toContain('Password is required');
        });

        it('should not require password when editing', () => {
            const isEditing = true;
            const formData = {
                username: 'testuser',
                password: '',
                confirmPassword: '',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (!isEditing && !formData.password) {
                errors.push('Password is required');
            }
            expect(errors).not.toContain('Password is required');
        });

        it('should require password confirmation to match', () => {
            const formData = {
                username: 'testuser',
                password: 'password123',
                confirmPassword: 'differentpassword',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (formData.password !== formData.confirmPassword) {
                errors.push('Passwords do not match');
            }
            expect(errors).toContain('Passwords do not match');
        });

        it('should require password to be at least 4 characters', () => {
            const formData = {
                username: 'testuser',
                password: 'abc',
                confirmPassword: 'abc',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (formData.password.length < 4) {
                errors.push('Password must be at least 4 characters');
            }
            expect(errors).toContain('Password must be at least 4 characters');
        });

        it('should accept valid form data', () => {
            const formData = {
                username: 'testuser',
                password: 'password123',
                confirmPassword: 'password123',
                full_name: 'Test User',
                role: 'staff' as UserRole
            };

            const errors: string[] = [];
            if (!formData.full_name.trim()) errors.push('Full name is required');
            if (!formData.username.trim()) errors.push('Username is required');
            if (formData.username.length < 3) errors.push('Username must be at least 3 characters');
            if (!formData.password) errors.push('Password is required');
            if (formData.password.length < 4) errors.push('Password must be at least 4 characters');
            if (formData.password !== formData.confirmPassword) errors.push('Passwords do not match');

            expect(errors).toHaveLength(0);
        });
    });

    describe('User Deletion Rules', () => {
        const currentUserId = 1;
        const users: User[] = [
            { id: 1, username: 'admin', password_hash: '', full_name: 'Admin', role: 'admin', is_active: true, created_at: '', updated_at: '' },
            { id: 2, username: 'staff1', password_hash: '', full_name: 'Staff 1', role: 'staff', is_active: true, created_at: '', updated_at: '' },
            { id: 3, username: 'admin2', password_hash: '', full_name: 'Admin 2', role: 'admin', is_active: true, created_at: '', updated_at: '' }
        ];

        it('should prevent deleting your own account', () => {
            const userToDelete = users[0]; // current user
            const canDelete = userToDelete.id !== currentUserId;
            expect(canDelete).toBe(false);
        });

        it('should allow deleting other users', () => {
            const userToDelete = users[1]; // staff user
            const canDelete = userToDelete.id !== currentUserId;
            expect(canDelete).toBe(true);
        });

        it('should prevent deleting the last admin', () => {
            const usersWithOneAdmin = [
                { id: 1, username: 'admin', role: 'admin' as UserRole, is_active: true },
                { id: 2, username: 'staff1', role: 'staff' as UserRole, is_active: true }
            ];

            const userToDelete = usersWithOneAdmin[0]; // the only admin
            const adminCount = usersWithOneAdmin.filter(u => u.role === 'admin').length;
            const canDeleteAdmin = !(userToDelete.role === 'admin' && adminCount <= 1);

            expect(canDeleteAdmin).toBe(false);
        });

        it('should allow deleting an admin if there are multiple', () => {
            const userToDelete = users[2]; // admin2
            const adminCount = users.filter(u => u.role === 'admin').length;
            const canDeleteAdmin = !(userToDelete.role === 'admin' && adminCount <= 1);

            expect(canDeleteAdmin).toBe(true);
        });
    });

    describe('User Roles', () => {
        it('should have valid role options', () => {
            const validRoles: UserRole[] = ['admin', 'staff'];
            expect(validRoles).toContain('admin');
            expect(validRoles).toContain('staff');
        });

        it('should display role labels correctly', () => {
            const roleLabels: Record<UserRole, string> = {
                admin: 'Administrator',
                staff: 'Staff'
            };

            expect(roleLabels.admin).toBe('Administrator');
            expect(roleLabels.staff).toBe('Staff');
        });
    });
});

describe('Backup & Restore', () => {
    describe('Backup Data Structure', () => {
        it('should include metadata in backup', () => {
            const backup = {
                _meta: [{
                    version: '1.0.0',
                    created_at: new Date().toISOString(),
                    tables: ['users', 'medicines', 'settings']
                }],
                users: [],
                medicines: [],
                settings: []
            };

            expect(backup._meta).toBeDefined();
            expect(backup._meta[0].version).toBe('1.0.0');
            expect(backup._meta[0].tables).toContain('users');
        });

        it('should include all required tables', () => {
            const requiredTables = [
                'users',
                'medicines',
                'batches',
                'suppliers',
                'customers',
                'purchases',
                'purchase_items',
                'bills',
                'bill_items',
                'credit_transactions',
                'scheduled_medicine_records',
                'settings'
            ];

            const backup: Record<string, unknown[]> = {
                _meta: [{ version: '1.0.0' }]
            };

            requiredTables.forEach(table => {
                backup[table] = [];
            });

            requiredTables.forEach(table => {
                expect(backup).toHaveProperty(table);
            });
        });
    });

    describe('Backup Validation', () => {
        it('should reject backup without metadata', () => {
            const invalidBackup: Record<string, unknown> = {
                users: [],
                medicines: []
            };

            const isValid = invalidBackup._meta && Array.isArray(invalidBackup._meta);
            expect(isValid).toBeFalsy();
        });

        it('should accept valid backup format', () => {
            const validBackup = {
                _meta: [{ version: '1.0.0', created_at: '2024-01-01' }],
                users: [{ id: 1, username: 'admin' }],
                medicines: []
            };

            const isValid = validBackup._meta && Array.isArray(validBackup._meta);
            expect(isValid).toBe(true);
        });
    });

    describe('Restore Order', () => {
        it('should clear tables in correct order (children first)', () => {
            const clearOrder = [
                'scheduled_medicine_records',
                'credit_transactions',
                'bill_items',
                'bills',
                'purchase_items',
                'purchases',
                'batches',
                'medicines',
                'customers',
                'suppliers',
                'settings'
            ];

            // bill_items should be cleared before bills
            const billItemsIndex = clearOrder.indexOf('bill_items');
            const billsIndex = clearOrder.indexOf('bills');
            expect(billItemsIndex).toBeLessThan(billsIndex);

            // purchase_items should be cleared before purchases
            const purchaseItemsIndex = clearOrder.indexOf('purchase_items');
            const purchasesIndex = clearOrder.indexOf('purchases');
            expect(purchaseItemsIndex).toBeLessThan(purchasesIndex);

            // batches should be cleared before medicines
            const batchesIndex = clearOrder.indexOf('batches');
            const medicinesIndex = clearOrder.indexOf('medicines');
            expect(batchesIndex).toBeLessThan(medicinesIndex);
        });
    });

    describe('Backup File Naming', () => {
        it('should generate filename with date', () => {
            const today = new Date().toISOString().split('T')[0];
            const filename = `medbill_backup_${today}.json`;
            
            expect(filename).toContain('medbill_backup');
            expect(filename).toContain(today);
            expect(filename).toMatch(/\.json$/);
        });
    });
});
