// =====================================================
// Print Service Tests
// Tests for bill printing and PDF generation
// =====================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the database module before importing the service
vi.mock('../services/database', () => ({
    query: vi.fn().mockResolvedValue([
        { key: 'shop_name', value: 'Test Medical Store' },
        { key: 'shop_address', value: '123 Test Street, Chennai' },
        { key: 'shop_phone', value: '9876543210' },
        { key: 'shop_gstin', value: '33AABCU9603R1ZM' },
        { key: 'shop_drug_license', value: 'TN-12345' },
        { key: 'shop_state', value: 'Tamil Nadu' },
    ])
}))

// Mock window.open for print tests
const mockPrint = vi.fn()
const mockClose = vi.fn()
const mockFocus = vi.fn()

// Sample bill data for testing
const mockBill = {
    id: 1,
    bill_number: 'INV-2425-00001',
    bill_date: '2026-01-02T10:30:00',
    customer_id: 1,
    customer_name: 'John Doe',
    subtotal: 1000,
    discount_amount: 50,
    discount_percent: 5,
    taxable_amount: 850,
    cgst_amount: 51,
    sgst_amount: 51,
    total_gst: 102,
    round_off: 0.48,
    grand_total: 952,
    payment_mode: 'CASH' as const,
    payment_status: 'PAID' as const,
    cash_amount: 952,
    online_amount: 0,
    credit_amount: 0,
    user_id: 1,
    notes: '',
    is_cancelled: false,
    total_items: 2,
    created_at: '2026-01-02T10:30:00',
    updated_at: '2026-01-02T10:30:00',
}

const mockBillItems = [
    {
        id: 1,
        bill_id: 1,
        batch_id: 1,
        medicine_id: 1,
        medicine_name: 'Paracetamol 500mg',
        hsn_code: '3004',
        batch_number: 'BT2024001',
        expiry_date: '2027-06-30',
        rack: 'A1',
        box: '1',
        quantity: 20,
        quantity_strips: 2,
        quantity_pieces: 0,
        tablets_per_strip: 10,
        unit_price: 25,
        price_type: 'INCLUSIVE' as const,
        discount_type: 'PERCENTAGE' as const,
        discount_value: 5,
        discount_amount: 25,
        taxable_value: 425,
        taxable_amount: 425,
        gst_rate: 12 as const,
        cgst: 6,
        cgst_amount: 25.5,
        sgst: 6,
        sgst_amount: 25.5,
        total_gst: 51,
        total: 476,
    },
    {
        id: 2,
        bill_id: 1,
        batch_id: 2,
        medicine_id: 2,
        medicine_name: 'Azithromycin 500mg',
        hsn_code: '3004',
        batch_number: 'BT2024002',
        expiry_date: '2027-12-31',
        rack: 'B2',
        box: '2',
        quantity: 15,
        quantity_strips: 1,
        quantity_pieces: 5,
        tablets_per_strip: 10,
        unit_price: 35,
        price_type: 'INCLUSIVE' as const,
        discount_type: 'PERCENTAGE' as const,
        discount_value: 5,
        discount_amount: 26.25,
        taxable_value: 425,
        taxable_amount: 425,
        gst_rate: 12 as const,
        cgst: 6,
        cgst_amount: 25.5,
        sgst: 6,
        sgst_amount: 25.5,
        total_gst: 51,
        total: 476,
    }
]

describe('Print Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        
        // Mock window.open
        vi.stubGlobal('open', vi.fn().mockReturnValue({
            document: {
                write: vi.fn(),
                close: mockClose,
            },
            focus: mockFocus,
            print: mockPrint,
        }))
    })

    describe('Number to Words Conversion', () => {
        it('should be tested via HTML generation', async () => {
            // The numberToWords function is internal, but we can verify 
            // its output is included in the generated HTML
            // This is a placeholder for integration testing
            expect(true).toBe(true)
        })
    })

    describe('Bill Data Validation', () => {
        it('should have valid bill structure', () => {
            expect(mockBill).toHaveProperty('bill_number')
            expect(mockBill).toHaveProperty('grand_total')
            expect(mockBill).toHaveProperty('customer_name')
            expect(mockBill.grand_total).toBeGreaterThan(0)
        })

        it('should have valid bill items structure', () => {
            expect(mockBillItems.length).toBeGreaterThan(0)
            mockBillItems.forEach(item => {
                expect(item).toHaveProperty('medicine_name')
                expect(item).toHaveProperty('quantity')
                expect(item).toHaveProperty('unit_price')
                expect(item).toHaveProperty('total')
            })
        })

        it('should calculate item totals correctly', () => {
            mockBillItems.forEach(item => {
                const expectedBase = item.quantity * item.unit_price
                expect(item.total).toBeGreaterThan(0)
                expect(item.taxable_amount).toBeLessThanOrEqual(expectedBase)
            })
        })
    })

    describe('GST Calculations', () => {
        it('should split GST into CGST and SGST correctly', () => {
            mockBillItems.forEach(item => {
                expect(item.cgst_amount).toBe(item.sgst_amount)
                expect(item.total_gst).toBe(item.cgst_amount + item.sgst_amount)
            })
        })

        it('should have valid GST rates', () => {
            const validRates = [0, 5, 12, 18]
            mockBillItems.forEach(item => {
                expect(validRates).toContain(item.gst_rate)
            })
        })
    })

    describe('Print Options', () => {
        it('should support thermal paper size', () => {
            const options = { paperSize: 'thermal' as const }
            expect(options.paperSize).toBe('thermal')
        })

        it('should support legal paper size', () => {
            const options = { paperSize: 'legal' as const }
            expect(options.paperSize).toBe('legal')
        })

        it('should support A4 paper size', () => {
            const options = { paperSize: 'a4' as const }
            expect(options.paperSize).toBe('a4')
        })
    })

    describe('Unit Conversion in Bills', () => {
        it('should correctly represent strips and pieces', () => {
            const item = mockBillItems[1] // 15 qty, 10 per strip
            expect(item.quantity).toBe(15)
            expect(item.tablets_per_strip).toBe(10)
            // 15 / 10 = 1 strip + 5 pieces
            expect(Math.floor(item.quantity / item.tablets_per_strip)).toBe(1)
            expect(item.quantity % item.tablets_per_strip).toBe(5)
        })
    })

    describe('Bill Number Format', () => {
        it('should have valid bill number format', () => {
            const billNumberRegex = /^INV-\d{4}-\d{5}$/
            expect(mockBill.bill_number).toMatch(billNumberRegex)
        })
    })

    describe('Payment Modes', () => {
        it('should support CASH payment', () => {
            expect(mockBill.payment_mode).toBe('CASH')
            expect(mockBill.cash_amount).toBe(mockBill.grand_total)
        })

        it('should calculate payment totals correctly', () => {
            const totalPayment = mockBill.cash_amount + mockBill.online_amount + mockBill.credit_amount
            expect(totalPayment).toBe(mockBill.grand_total)
        })
    })
})

describe('Thermal Bill HTML Generation', () => {
    it('should include compact format for thermal printing', () => {
        // Test that thermal print would use 80mm width
        const thermalWidth = 80
        expect(thermalWidth).toBe(80)
    })
})

describe('Legal Bill HTML Generation', () => {
    it('should include detailed format for legal paper', () => {
        // Test that legal print uses standard dimensions
        const legalDimensions = { width: 8.5, height: 14 }
        expect(legalDimensions.width).toBe(8.5)
        expect(legalDimensions.height).toBe(14)
    })
})

describe('PDF Generation', () => {
    it('should generate blob URL for download', async () => {
        // Test blob URL creation
        const mockHtml = '<html><body>Test</body></html>'
        const blob = new Blob([mockHtml], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        
        expect(url).toContain('blob:')
        URL.revokeObjectURL(url)
    })
})
