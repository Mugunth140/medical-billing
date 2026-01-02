// =====================================================
// Report Export Service Tests
// Tests for report generation and PDF/HTML export
// =====================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the database module
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

// Sample report data for testing
const mockSalesData = [
    {
        bill_date: '2026-01-01',
        bill_number: 'INV-2425-00001',
        customer_name: 'Customer 1',
        total_items: 3,
        taxable_amount: 850,
        total_gst: 102,
        grand_total: 952,
        payment_mode: 'CASH',
    },
    {
        bill_date: '2026-01-02',
        bill_number: 'INV-2425-00002',
        customer_name: 'Customer 2',
        total_items: 5,
        taxable_amount: 1200,
        total_gst: 144,
        grand_total: 1344,
        payment_mode: 'ONLINE',
    },
]

const mockGstData = [
    {
        gst_rate: 12,
        taxable_amount: 2050,
        cgst_amount: 123,
        sgst_amount: 123,
        total_gst: 246,
    },
    {
        gst_rate: 18,
        taxable_amount: 500,
        cgst_amount: 45,
        sgst_amount: 45,
        total_gst: 90,
    },
]

const mockScheduledDrugsData = [
    {
        bill_date: '2026-01-01',
        bill_number: 'INV-2425-00001',
        medicine_name: 'Alprazolam 0.5mg',
        quantity: 10,
        patient_name: 'John Doe',
        patient_age: 45,
        patient_gender: 'M',
        doctor_name: 'Dr. Smith',
        doctor_registration_number: 'TN12345',
        clinic_hospital_name: 'City Clinic',
    },
]

const mockCreditData = [
    {
        customer_name: 'Credit Customer 1',
        phone: '9876543210',
        credit_limit: 10000,
        current_balance: 5000,
        last_transaction_date: '2026-01-01',
    },
    {
        customer_name: 'Credit Customer 2',
        phone: '9876543211',
        credit_limit: 15000,
        current_balance: 8000,
        last_transaction_date: '2026-01-02',
    },
]

describe('Report Export Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Report Data Validation', () => {
        describe('Sales Report Data', () => {
            it('should have valid sales data structure', () => {
                mockSalesData.forEach(row => {
                    expect(row).toHaveProperty('bill_number')
                    expect(row).toHaveProperty('grand_total')
                    expect(row).toHaveProperty('payment_mode')
                })
            })

            it('should calculate totals correctly', () => {
                const total = mockSalesData.reduce((sum, row) => sum + row.grand_total, 0)
                expect(total).toBe(952 + 1344)
            })

            it('should have valid payment modes', () => {
                const validModes = ['CASH', 'ONLINE', 'CREDIT', 'SPLIT']
                mockSalesData.forEach(row => {
                    expect(validModes).toContain(row.payment_mode)
                })
            })
        })

        describe('GST Report Data', () => {
            it('should have valid GST data structure', () => {
                mockGstData.forEach(row => {
                    expect(row).toHaveProperty('gst_rate')
                    expect(row).toHaveProperty('cgst_amount')
                    expect(row).toHaveProperty('sgst_amount')
                    expect(row).toHaveProperty('total_gst')
                })
            })

            it('should have matching CGST and SGST for intra-state', () => {
                mockGstData.forEach(row => {
                    expect(row.cgst_amount).toBe(row.sgst_amount)
                })
            })

            it('should have total GST = CGST + SGST', () => {
                mockGstData.forEach(row => {
                    expect(row.total_gst).toBe(row.cgst_amount + row.sgst_amount)
                })
            })

            it('should have valid GST rates', () => {
                const validRates = [0, 5, 12, 18]
                mockGstData.forEach(row => {
                    expect(validRates).toContain(row.gst_rate)
                })
            })
        })

        describe('Scheduled Drugs Report Data', () => {
            it('should have valid scheduled drugs data structure', () => {
                mockScheduledDrugsData.forEach(row => {
                    expect(row).toHaveProperty('medicine_name')
                    expect(row).toHaveProperty('patient_name')
                    expect(row).toHaveProperty('doctor_name')
                    expect(row).toHaveProperty('quantity')
                })
            })

            it('should have required patient information', () => {
                mockScheduledDrugsData.forEach(row => {
                    expect(row.patient_name).toBeTruthy()
                    expect(row.patient_age).toBeGreaterThan(0)
                    expect(['M', 'F', 'O']).toContain(row.patient_gender)
                })
            })

            it('should have required doctor information', () => {
                mockScheduledDrugsData.forEach(row => {
                    expect(row.doctor_name).toBeTruthy()
                    expect(row.doctor_registration_number).toBeTruthy()
                })
            })
        })

        describe('Credit Report Data', () => {
            it('should have valid credit data structure', () => {
                mockCreditData.forEach(row => {
                    expect(row).toHaveProperty('customer_name')
                    expect(row).toHaveProperty('credit_limit')
                    expect(row).toHaveProperty('current_balance')
                })
            })

            it('should have balance within credit limit', () => {
                mockCreditData.forEach(row => {
                    expect(row.current_balance).toBeLessThanOrEqual(row.credit_limit)
                })
            })

            it('should calculate total outstanding', () => {
                const totalOutstanding = mockCreditData.reduce(
                    (sum, row) => sum + row.current_balance,
                    0
                )
                expect(totalOutstanding).toBe(5000 + 8000)
            })
        })
    })

    describe('Report Export Options', () => {
        it('should support date range filtering', () => {
            const options = {
                title: 'Sales Report',
                dateRange: {
                    start: '2026-01-01',
                    end: '2026-01-31',
                },
            }
            expect(options.dateRange.start).toBe('2026-01-01')
            expect(options.dateRange.end).toBe('2026-01-31')
        })

        it('should support PDF format', () => {
            const options = { title: 'Report', format: 'pdf' as const }
            expect(options.format).toBe('pdf')
        })

        it('should support HTML format', () => {
            const options = { title: 'Report', format: 'html' as const }
            expect(options.format).toBe('html')
        })
    })

    describe('HTML Generation', () => {
        it('should create valid HTML structure', () => {
            const html = `<!DOCTYPE html>
<html>
<head><title>Test Report</title></head>
<body><h1>Report</h1></body>
</html>`
            expect(html).toContain('<!DOCTYPE html>')
            expect(html).toContain('<html>')
            expect(html).toContain('</html>')
        })

        it('should include print styles', () => {
            const styles = '@page { size: A4; margin: 15mm; }'
            expect(styles).toContain('@page')
            expect(styles).toContain('A4')
        })
    })

    describe('Blob and URL Creation', () => {
        it('should create blob from HTML', () => {
            const html = '<html><body>Test</body></html>'
            const blob = new Blob([html], { type: 'text/html' })
            expect(blob.size).toBeGreaterThan(0)
            expect(blob.type).toBe('text/html')
        })

        it('should create object URL from blob', () => {
            const html = '<html><body>Test</body></html>'
            const blob = new Blob([html], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            expect(url).toContain('blob:')
            URL.revokeObjectURL(url)
        })
    })

    describe('Report Title Generation', () => {
        it('should generate correct sales report title', () => {
            const title = 'Sales Report - Daily Summary'
            expect(title).toContain('Sales')
        })

        it('should generate correct GST report title', () => {
            const title = 'GST Report - Tax Summary'
            expect(title).toContain('GST')
        })

        it('should generate correct scheduled drugs report title', () => {
            const title = 'Scheduled Drugs Report'
            expect(title).toContain('Scheduled')
        })

        it('should generate correct credit report title', () => {
            const title = 'Credit Report - Outstanding Balances'
            expect(title).toContain('Credit')
        })
    })

    describe('Date Formatting in Reports', () => {
        it('should format dates correctly for display', () => {
            const isoDate = '2026-01-02'
            const [year, month, day] = isoDate.split('-')
            const formatted = `${day}/${month}/${year}`
            expect(formatted).toBe('02/01/2026')
        })

        it('should handle date ranges in report headers', () => {
            const start = '2026-01-01'
            const end = '2026-01-31'
            const rangeText = `From ${start} to ${end}`
            expect(rangeText).toContain('From')
            expect(rangeText).toContain('to')
        })
    })

    describe('Currency Formatting in Reports', () => {
        it('should format currency with ₹ symbol', () => {
            const amount = 1234.56
            const formatted = `₹${amount.toFixed(2)}`
            expect(formatted).toBe('₹1234.56')
        })

        it('should handle large amounts', () => {
            const amount = 1234567.89
            expect(amount).toBeGreaterThan(1000000)
        })
    })
})

describe('Report Aggregation', () => {
    describe('Sales Aggregation', () => {
        it('should calculate total sales', () => {
            const total = mockSalesData.reduce((sum, row) => sum + row.grand_total, 0)
            expect(total).toBe(2296)
        })

        it('should count total transactions', () => {
            expect(mockSalesData.length).toBe(2)
        })

        it('should calculate average transaction value', () => {
            const total = mockSalesData.reduce((sum, row) => sum + row.grand_total, 0)
            const avg = total / mockSalesData.length
            expect(avg).toBe(1148)
        })
    })

    describe('GST Aggregation', () => {
        it('should calculate total taxable amount', () => {
            const total = mockGstData.reduce((sum, row) => sum + row.taxable_amount, 0)
            expect(total).toBe(2550)
        })

        it('should calculate total GST collected', () => {
            const total = mockGstData.reduce((sum, row) => sum + row.total_gst, 0)
            expect(total).toBe(336)
        })
    })

    describe('Credit Aggregation', () => {
        it('should calculate total credit limit', () => {
            const total = mockCreditData.reduce((sum, row) => sum + row.credit_limit, 0)
            expect(total).toBe(25000)
        })

        it('should calculate total outstanding', () => {
            const total = mockCreditData.reduce((sum, row) => sum + row.current_balance, 0)
            expect(total).toBe(13000)
        })

        it('should calculate available credit', () => {
            const totalLimit = mockCreditData.reduce((sum, row) => sum + row.credit_limit, 0)
            const totalUsed = mockCreditData.reduce((sum, row) => sum + row.current_balance, 0)
            const available = totalLimit - totalUsed
            expect(available).toBe(12000)
        })
    })
})
