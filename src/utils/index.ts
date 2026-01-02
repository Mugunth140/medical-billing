// =====================================================
// MedBill - Utility Functions
// Common helper functions used across the application
// =====================================================

import { differenceInDays, format, isValid, parseISO } from 'date-fns';

// =====================================================
// CURRENCY FORMATTING
// =====================================================

/**
 * Format amount as Indian Rupees
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format amount without currency symbol
 */
export function formatNumber(amount: number, decimals: number = 2): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
    const cleaned = value.replace(/[₹,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// =====================================================
// DATE FORMATTING
// =====================================================

/**
 * Format date for display
 */
export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        if (!isValid(d)) return '-';
        return format(d, formatStr);
    } catch {
        return '-';
    }
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
    return formatDate(date, 'dd/MM/yyyy hh:mm a');
}

/**
 * Format date for API/database
 */
export function toISODate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

/**
 * Get days until date (for expiry)
 */
export function daysUntil(date: string | Date): number {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return differenceInDays(d, new Date());
}

/**
 * Check if date is expired
 */
export function isExpired(date: string | Date): boolean {
    return daysUntil(date) < 0;
}

/**
 * Check if date is expiring soon (within days)
 */
export function isExpiringSoon(date: string | Date, days: number = 30): boolean {
    const diff = daysUntil(date);
    return diff >= 0 && diff <= days;
}

// =====================================================
// STRING UTILITIES
// =====================================================

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
    return str.length > length ? str.slice(0, length) + '...' : str;
}

/**
 * Generate search-friendly string
 */
export function toSearchable(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if string matches search query
 */
export function matchesSearch(text: string, query: string): boolean {
    if (!query.trim()) return true;
    const searchable = toSearchable(text);
    const terms = toSearchable(query).split(' ');
    return terms.every(term => searchable.includes(term));
}

// =====================================================
// GST UTILITIES
// =====================================================

/**
 * Get GST rate label
 */
export function getGstLabel(rate: number): string {
    switch (rate) {
        case 0: return 'Exempt';
        case 5: return '5%';
        case 12: return '12%';
        case 18: return '18%';
        default: return `${rate}%`;
    }
}

// =====================================================
// UNIT CONVERSION UTILITIES
// =====================================================

/**
 * Convert total pieces to strips and loose pieces
 * @param totalPieces - Total number of pieces/tablets
 * @param tabletsPerStrip - Number of tablets per strip (default 10)
 * @returns Object with strips, loosePieces, and formatted display strings
 */
export function convertToUnits(totalPieces: number, tabletsPerStrip: number = 10): {
    strips: number;
    loosePieces: number;
    displayFull: string;
    displayShort: string;
} {
    const strips = Math.floor(totalPieces / tabletsPerStrip);
    const loosePieces = totalPieces % tabletsPerStrip;

    let displayFull = '';
    let displayShort = '';

    if (strips > 0 && loosePieces > 0) {
        displayFull = `${strips} strip${strips > 1 ? 's' : ''} + ${loosePieces} pc${loosePieces > 1 ? 's' : ''}`;
        displayShort = `${strips}S + ${loosePieces}P`;
    } else if (strips > 0) {
        displayFull = `${strips} strip${strips > 1 ? 's' : ''}`;
        displayShort = `${strips}S`;
    } else {
        displayFull = `${loosePieces} pc${loosePieces !== 1 ? 's' : ''}`;
        displayShort = `${loosePieces}P`;
    }

    return {
        strips,
        loosePieces,
        displayFull,
        displayShort
    };
}

/**
 * Format quantity display with strips and pieces
 * @param quantity - Total pieces
 * @param tabletsPerStrip - Number per strip
 * @param format - 'full' or 'short'
 */
export function formatQuantityDisplay(
    quantity: number,
    tabletsPerStrip: number = 10,
    format: 'full' | 'short' = 'full'
): string {
    const units = convertToUnits(quantity, tabletsPerStrip);
    return format === 'full' ? units.displayFull : units.displayShort;
}

/**
 * Get stock status label and color
 */
export function getStockStatusInfo(status: string): { label: string; color: string } {
    switch (status) {
        case 'OUT_OF_STOCK':
            return { label: 'Out of Stock', color: 'red' };
        case 'LOW_STOCK':
            return { label: 'Low Stock', color: 'orange' };
        case 'IN_STOCK':
        default:
            return { label: 'In Stock', color: 'green' };
    }
}

/**
 * Get expiry status label and color
 */
export function getExpiryStatusInfo(status: string): { label: string; color: string } {
    switch (status) {
        case 'EXPIRED':
            return { label: 'Expired', color: 'red' };
        case 'EXPIRING_SOON':
            return { label: 'Expiring Soon', color: 'orange' };
        case 'OK':
        default:
            return { label: 'Valid', color: 'green' };
    }
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validate GST Number (GSTIN)
 */
export function isValidGSTIN(gstin: string): boolean {
    if (!gstin) return true; // Optional field
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(gstin.toUpperCase());
}

/**
 * Validate phone number (Indian)
 */
export function isValidPhone(phone: string): boolean {
    if (!phone) return true; // Optional field
    const regex = /^[6-9]\d{9}$/;
    return regex.test(phone.replace(/\s+/g, ''));
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
    if (!email) return true; // Optional field
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================

/**
 * Create keyboard shortcut handler
 */
export function createShortcutHandler(
    shortcuts: Record<string, () => void>
): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        const key = [
            e.ctrlKey && 'ctrl',
            e.altKey && 'alt',
            e.shiftKey && 'shift',
            e.key.toLowerCase()
        ].filter(Boolean).join('+');

        if (shortcuts[key]) {
            e.preventDefault();
            shortcuts[key]();
        }
    };
}

// =====================================================
// DEBOUNCE & THROTTLE
// =====================================================

/**
 * Debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// =====================================================
// MISC UTILITIES
// =====================================================

/**
 * Generate unique ID
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
        const groupKey = String(item[key]);
        (result[groupKey] = result[groupKey] || []).push(item);
        return result;
    }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
}
