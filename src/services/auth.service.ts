// =====================================================
// MedBill - Auth Service
// User authentication and session management
// =====================================================

import type { User, UserRole } from '../types';
import { execute, query, queryOne } from './database';

/**
 * Authenticate user with username and password
 * Note: In production, use proper password hashing (bcrypt)
 */
export async function login(username: string, password: string): Promise<User | null> {
    // For now, simple password comparison
    // TODO: Implement proper bcrypt hashing
    const user = await queryOne<User>(
        `SELECT * FROM users 
     WHERE username = ? AND password_hash = ? AND is_active = 1`,
        [username, password]
    );

    if (user) {
        // Update last login
        await execute(
            `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
            [user.id]
        );
    }

    return user;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User | null> {
    return await queryOne<User>(
        `SELECT * FROM users WHERE id = ? AND is_active = 1`,
        [id]
    );
}

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
    return await query<User>(
        `SELECT * FROM users WHERE is_active = 1 ORDER BY full_name`,
        []
    );
}

/**
 * Create a new user
 */
export async function createUser(
    username: string,
    password: string,
    fullName: string,
    role: UserRole
): Promise<number> {
    // TODO: Hash password with bcrypt
    const result = await execute(
        `INSERT INTO users (username, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)`,
        [username, password, fullName, role]
    );

    return result.lastInsertId;
}

/**
 * Update user password
 */
export async function updatePassword(userId: number, newPassword: string): Promise<void> {
    // TODO: Hash password with bcrypt
    await execute(
        `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newPassword, userId]
    );
}

/**
 * Update user details
 */
export async function updateUser(
    userId: number,
    updates: { full_name?: string; role?: UserRole }
): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.full_name) {
        sets.push('full_name = ?');
        params.push(updates.full_name);
    }
    if (updates.role) {
        sets.push('role = ?');
        params.push(updates.role);
    }

    if (sets.length === 0) return;

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await execute(
        `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
        params
    );
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(userId: number): Promise<void> {
    await execute(
        `UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [userId]
    );
}

/**
 * Check if user has permission
 */
export function hasPermission(user: User, action: string): boolean {
    // Admin has all permissions
    if (user.role === 'admin') return true;

    // Staff permissions
    const staffPermissions = [
        'billing:create',
        'billing:view',
        'inventory:view',
        'customer:view',
        'customer:create'
    ];

    return staffPermissions.includes(action);
}

/**
 * Admin-only actions
 */
export const ADMIN_ONLY_ACTIONS = [
    'billing:cancel',
    'billing:return',
    'inventory:edit',
    'inventory:delete',
    'purchase:create',
    'purchase:return',
    'discount:override',
    'settings:edit',
    'user:manage',
    'backup:manage',
    'audit:view'
];

export default {
    login,
    getUserById,
    getUsers,
    createUser,
    updatePassword,
    updateUser,
    deactivateUser,
    hasPermission,
    ADMIN_ONLY_ACTIONS
};
