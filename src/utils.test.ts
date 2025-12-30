import { describe, expect, it } from 'vitest'
import {
    capitalize,
    daysUntil,
    formatCurrency,
    formatDate,
    formatNumber,
    getExpiryStatusInfo,
    getStockStatusInfo,
    isExpired,
    isExpiringSoon,
    isValidEmail,
    isValidGSTIN,
    isValidPhone,
    matchesSearch,
    parseCurrency,
    truncate
} from './utils'

describe('Utility Functions', () => {
    describe('Currency Formatting', () => {
        describe('formatCurrency', () => {
            it('formats positive numbers with ₹ symbol', () => {
                expect(formatCurrency(100)).toContain('100')
                expect(formatCurrency(100)).toContain('₹')
            })

            it('formats zero correctly', () => {
                expect(formatCurrency(0)).toContain('0')
            })

            it('formats decimals to 2 places', () => {
                expect(formatCurrency(1234.56)).toContain('1,234.56')
            })
        })

        describe('formatNumber', () => {
            it('formats without currency symbol', () => {
                const result = formatNumber(1234.56)
                expect(result).not.toContain('₹')
                expect(result).toContain('1,234.56')
            })
        })

        describe('parseCurrency', () => {
            it('parses currency string to number', () => {
                expect(parseCurrency('₹1,234.56')).toBe(1234.56)
                expect(parseCurrency('1000')).toBe(1000)
            })

            it('handles invalid strings', () => {
                expect(parseCurrency('')).toBe(0)
                expect(parseCurrency('abc')).toBe(0)
            })
        })
    })

    describe('Date Formatting', () => {
        describe('formatDate', () => {
            it('formats date string to dd/MM/yyyy by default', () => {
                const result = formatDate('2024-12-25')
                expect(result).toBe('25/12/2024')
            })

            it('handles invalid dates gracefully', () => {
                const result = formatDate('')
                expect(result).toBe('-')
            })

            it('formats with custom format string', () => {
                const result = formatDate('2024-12-25', 'yyyy-MM-dd')
                expect(result).toBe('2024-12-25')
            })
        })

        describe('daysUntil', () => {
            it('returns positive days for future dates', () => {
                const futureDate = new Date()
                futureDate.setDate(futureDate.getDate() + 10)
                expect(daysUntil(futureDate)).toBe(10)
            })

            it('returns negative days for past dates', () => {
                const pastDate = new Date()
                pastDate.setDate(pastDate.getDate() - 5)
                expect(daysUntil(pastDate)).toBe(-5)
            })
        })

        describe('isExpired', () => {
            it('returns true for past dates', () => {
                const pastDate = new Date()
                pastDate.setDate(pastDate.getDate() - 1)
                expect(isExpired(pastDate)).toBe(true)
            })

            it('returns false for future dates', () => {
                const futureDate = new Date()
                futureDate.setDate(futureDate.getDate() + 10)
                expect(isExpired(futureDate)).toBe(false)
            })
        })

        describe('isExpiringSoon', () => {
            it('returns true for dates within default 30 days', () => {
                const soonDate = new Date()
                soonDate.setDate(soonDate.getDate() + 15)
                expect(isExpiringSoon(soonDate)).toBe(true)
            })

            it('returns false for dates beyond 30 days', () => {
                const farDate = new Date()
                farDate.setDate(farDate.getDate() + 60)
                expect(isExpiringSoon(farDate)).toBe(false)
            })
        })
    })

    describe('Status Info Functions', () => {
        describe('getExpiryStatusInfo', () => {
            it('returns correct info for expired items', () => {
                const info = getExpiryStatusInfo('EXPIRED')
                expect(info.color).toBe('red')
                expect(info.label).toBe('Expired')
            })

            it('returns correct info for expiring soon items', () => {
                const info = getExpiryStatusInfo('EXPIRING_SOON')
                expect(info.color).toBe('orange')
                expect(info.label).toBe('Expiring Soon')
            })

            it('returns correct info for OK items', () => {
                const info = getExpiryStatusInfo('OK')
                expect(info.color).toBe('green')
                expect(info.label).toBe('Valid')
            })
        })

        describe('getStockStatusInfo', () => {
            it('returns correct info for out of stock', () => {
                const info = getStockStatusInfo('OUT_OF_STOCK')
                expect(info.color).toBe('red')
                expect(info.label).toBe('Out of Stock')
            })

            it('returns correct info for low stock', () => {
                const info = getStockStatusInfo('LOW_STOCK')
                expect(info.color).toBe('orange')
                expect(info.label).toBe('Low Stock')
            })

            it('returns correct info for in stock', () => {
                const info = getStockStatusInfo('IN_STOCK')
                expect(info.color).toBe('green')
                expect(info.label).toBe('In Stock')
            })
        })
    })

    describe('String Utilities', () => {
        describe('capitalize', () => {
            it('capitalizes first letter', () => {
                expect(capitalize('hello')).toBe('Hello')
                expect(capitalize('WORLD')).toBe('World')
            })
        })

        describe('truncate', () => {
            it('truncates long strings with ellipsis', () => {
                expect(truncate('Hello World', 5)).toBe('Hello...')
            })

            it('keeps short strings unchanged', () => {
                expect(truncate('Hi', 10)).toBe('Hi')
            })
        })

        describe('matchesSearch', () => {
            it('matches partial strings', () => {
                expect(matchesSearch('Paracetamol 500mg', 'para')).toBe(true)
                expect(matchesSearch('Paracetamol 500mg', '500')).toBe(true)
            })

            it('returns true for empty query', () => {
                expect(matchesSearch('Anything', '')).toBe(true)
            })

            it('returns false for non-matching strings', () => {
                expect(matchesSearch('Paracetamol', 'xyz')).toBe(false)
            })
        })
    })

    describe('Validation', () => {
        describe('isValidGSTIN', () => {
            it('validates correct GSTIN format', () => {
                expect(isValidGSTIN('22AAAAA0000A1Z5')).toBe(true)
            })

            it('returns true for empty string (optional field)', () => {
                expect(isValidGSTIN('')).toBe(true)
            })

            it('rejects invalid GSTIN', () => {
                expect(isValidGSTIN('invalid')).toBe(false)
                expect(isValidGSTIN('12345')).toBe(false)
            })
        })

        describe('isValidPhone', () => {
            it('validates Indian phone numbers', () => {
                expect(isValidPhone('9876543210')).toBe(true)
                expect(isValidPhone('6123456789')).toBe(true)
            })

            it('returns true for empty string (optional field)', () => {
                expect(isValidPhone('')).toBe(true)
            })

            it('rejects invalid phone numbers', () => {
                expect(isValidPhone('12345')).toBe(false)
                expect(isValidPhone('0123456789')).toBe(false)
            })
        })

        describe('isValidEmail', () => {
            it('validates correct email format', () => {
                expect(isValidEmail('test@example.com')).toBe(true)
                expect(isValidEmail('user.name@domain.co.in')).toBe(true)
            })

            it('returns true for empty string (optional field)', () => {
                expect(isValidEmail('')).toBe(true)
            })

            it('rejects invalid emails', () => {
                expect(isValidEmail('invalid')).toBe(false)
                expect(isValidEmail('missing@domain')).toBe(false)
            })
        })
    })
})
