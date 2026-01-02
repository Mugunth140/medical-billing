import { describe, expect, it, vi } from 'vitest'
import {
    capitalize,
    convertToUnits,
    daysUntil,
    debounce,
    deepClone,
    formatCurrency,
    formatDate,
    formatNumber,
    formatQuantityDisplay,
    generateId,
    getExpiryStatusInfo,
    getGstLabel,
    getStockStatusInfo,
    groupBy,
    isEmpty,
    isExpired,
    isExpiringSoon,
    isValidEmail,
    isValidGSTIN,
    isValidPhone,
    matchesSearch,
    parseCurrency,
    sortBy,
    throttle,
    toISODate,
    toSearchable,
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

    describe('Unit Conversion', () => {
        describe('convertToUnits', () => {
            it('converts total pieces to strips and loose pieces', () => {
                const result = convertToUnits(25, 10)
                expect(result.strips).toBe(2)
                expect(result.loosePieces).toBe(5)
            })

            it('handles exact strip multiples', () => {
                const result = convertToUnits(30, 10)
                expect(result.strips).toBe(3)
                expect(result.loosePieces).toBe(0)
            })

            it('handles only loose pieces (less than one strip)', () => {
                const result = convertToUnits(5, 10)
                expect(result.strips).toBe(0)
                expect(result.loosePieces).toBe(5)
            })

            it('generates correct full display string', () => {
                const result = convertToUnits(25, 10)
                expect(result.displayFull).toBe('2 strips + 5 pcs')
            })

            it('generates correct short display string', () => {
                const result = convertToUnits(25, 10)
                expect(result.displayShort).toBe('2S + 5P')
            })

            it('handles single strip correctly', () => {
                const result = convertToUnits(10, 10)
                expect(result.displayFull).toBe('1 strip')
            })

            it('handles single piece correctly', () => {
                const result = convertToUnits(1, 10)
                expect(result.displayFull).toBe('1 pc')
            })

            it('uses default tablets per strip of 10', () => {
                const result = convertToUnits(15)
                expect(result.strips).toBe(1)
                expect(result.loosePieces).toBe(5)
            })

            it('works with different tablets per strip values', () => {
                const result = convertToUnits(20, 6)
                expect(result.strips).toBe(3)
                expect(result.loosePieces).toBe(2)
            })
        })

        describe('formatQuantityDisplay', () => {
            it('returns full format by default', () => {
                const result = formatQuantityDisplay(25, 10)
                expect(result).toBe('2 strips + 5 pcs')
            })

            it('returns short format when specified', () => {
                const result = formatQuantityDisplay(25, 10, 'short')
                expect(result).toBe('2S + 5P')
            })

            it('handles zero quantity', () => {
                const result = formatQuantityDisplay(0, 10)
                expect(result).toBe('0 pcs')
            })
        })
    })

    describe('GST Utilities', () => {
        describe('getGstLabel', () => {
            it('returns Exempt for 0%', () => {
                expect(getGstLabel(0)).toBe('Exempt')
            })

            it('returns percentage for standard rates', () => {
                expect(getGstLabel(5)).toBe('5%')
                expect(getGstLabel(12)).toBe('12%')
                expect(getGstLabel(18)).toBe('18%')
            })

            it('handles non-standard rates', () => {
                expect(getGstLabel(28)).toBe('28%')
            })
        })
    })

    describe('Date Utilities', () => {
        describe('toISODate', () => {
            it('formats date to ISO format', () => {
                const date = new Date('2026-01-15T10:30:00')
                expect(toISODate(date)).toBe('2026-01-15')
            })
        })

        describe('toSearchable', () => {
            it('converts to lowercase and trims', () => {
                expect(toSearchable('  Hello World  ')).toBe('hello world')
            })

            it('normalizes multiple spaces', () => {
                expect(toSearchable('hello    world')).toBe('hello world')
            })
        })
    })

    describe('Debounce and Throttle', () => {
        describe('debounce', () => {
            it('delays function execution', async () => {
                vi.useFakeTimers()
                const fn = vi.fn()
                const debouncedFn = debounce(fn, 100)

                debouncedFn()
                debouncedFn()
                debouncedFn()

                expect(fn).not.toHaveBeenCalled()
                
                vi.advanceTimersByTime(100)
                expect(fn).toHaveBeenCalledTimes(1)
                vi.useRealTimers()
            })
        })

        describe('throttle', () => {
            it('limits function calls', () => {
                vi.useFakeTimers()
                const fn = vi.fn()
                const throttledFn = throttle(fn, 100)

                throttledFn()
                throttledFn()
                throttledFn()

                expect(fn).toHaveBeenCalledTimes(1)
                
                vi.advanceTimersByTime(100)
                throttledFn()
                expect(fn).toHaveBeenCalledTimes(2)
                vi.useRealTimers()
            })
        })
    })

    describe('Misc Utilities', () => {
        describe('generateId', () => {
            it('generates unique IDs', () => {
                const id1 = generateId()
                const id2 = generateId()
                expect(id1).not.toBe(id2)
            })

            it('generates non-empty string', () => {
                const id = generateId()
                expect(id.length).toBeGreaterThan(0)
            })
        })

        describe('deepClone', () => {
            it('creates a deep copy of object', () => {
                const original = { a: 1, b: { c: 2 } }
                const clone = deepClone(original)
                
                expect(clone).toEqual(original)
                expect(clone).not.toBe(original)
                expect(clone.b).not.toBe(original.b)
            })

            it('clones arrays', () => {
                const original = [1, 2, { a: 3 }]
                const clone = deepClone(original)
                
                expect(clone).toEqual(original)
                expect(clone).not.toBe(original)
            })
        })

        describe('isEmpty', () => {
            it('returns true for empty object', () => {
                expect(isEmpty({})).toBe(true)
            })

            it('returns false for non-empty object', () => {
                expect(isEmpty({ a: 1 })).toBe(false)
            })
        })

        describe('groupBy', () => {
            it('groups array by key', () => {
                const data = [
                    { category: 'A', value: 1 },
                    { category: 'B', value: 2 },
                    { category: 'A', value: 3 },
                ]
                const result = groupBy(data, 'category')
                
                expect(result['A'].length).toBe(2)
                expect(result['B'].length).toBe(1)
            })
        })

        describe('sortBy', () => {
            it('sorts array in ascending order', () => {
                const data = [{ value: 3 }, { value: 1 }, { value: 2 }]
                const result = sortBy(data, 'value', 'asc')
                
                expect(result[0].value).toBe(1)
                expect(result[2].value).toBe(3)
            })

            it('sorts array in descending order', () => {
                const data = [{ value: 3 }, { value: 1 }, { value: 2 }]
                const result = sortBy(data, 'value', 'desc')
                
                expect(result[0].value).toBe(3)
                expect(result[2].value).toBe(1)
            })

            it('does not mutate original array', () => {
                const data = [{ value: 3 }, { value: 1 }]
                const result = sortBy(data, 'value')
                
                expect(result).not.toBe(data)
                expect(data[0].value).toBe(3)
            })
        })
    })
})
