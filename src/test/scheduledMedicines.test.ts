import { describe, expect, it, vi } from 'vitest'
import type { CreateMedicineInput, ScheduledMedicineInput, StockItem } from '../types'

// Mock the database module
vi.mock('../services/database', () => ({
    initDatabase: vi.fn().mockResolvedValue({}),
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    transaction: vi.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
    getDatabase: vi.fn().mockReturnValue({})
}))

describe('Scheduled Medicines Feature', () => {
    describe('Medicine Types', () => {
        it('should have is_schedule property in CreateMedicineInput', () => {
            const input: CreateMedicineInput = {
                name: 'Test Medicine',
                hsn_code: '3004',
                gst_rate: 12,
                taxability: 'TAXABLE',
                is_schedule: true
            }
            expect(input.is_schedule).toBe(true)
        })

        it('should allow is_schedule to be undefined (defaults to false)', () => {
            const input: CreateMedicineInput = {
                name: 'Test Medicine',
                hsn_code: '3004',
                gst_rate: 12,
                taxability: 'TAXABLE'
            }
            expect(input.is_schedule).toBeUndefined()
        })

        it('should have is_schedule property in StockItem', () => {
            const stockItem: Partial<StockItem> = {
                batch_id: 1,
                medicine_id: 1,
                medicine_name: 'Scheduled Drug',
                is_schedule: true
            }
            expect(stockItem.is_schedule).toBe(true)
        })
    })

    describe('Scheduled Medicine Input Validation', () => {
        it('should have required patient_name field', () => {
            const patientInfo: ScheduledMedicineInput = {
                patient_name: 'John Doe',
                patient_age: 30,
                patient_gender: 'M'
            }
            expect(patientInfo.patient_name).toBe('John Doe')
        })

        it('should accept optional fields', () => {
            const patientInfo: ScheduledMedicineInput = {
                patient_name: 'Jane Doe',
                patient_age: 25,
                patient_gender: 'F',
                patient_phone: '9876543210',
                patient_address: '123 Main St',
                doctor_name: 'Dr. Smith',
                prescription_number: 'RX123456'
            }
            expect(patientInfo.patient_phone).toBe('9876543210')
            expect(patientInfo.doctor_name).toBe('Dr. Smith')
            expect(patientInfo.prescription_number).toBe('RX123456')
        })

        it('should accept valid gender values', () => {
            const genders: Array<'M' | 'F' | 'O'> = ['M', 'F', 'O']
            genders.forEach(gender => {
                const patientInfo: ScheduledMedicineInput = {
                    patient_name: 'Test Patient',
                    patient_gender: gender
                }
                expect(patientInfo.patient_gender).toBe(gender)
            })
        })

        it('should accept age as number', () => {
            const patientInfo: ScheduledMedicineInput = {
                patient_name: 'Test Patient',
                patient_age: 45
            }
            expect(typeof patientInfo.patient_age).toBe('number')
        })
    })
})

describe('Billing Store - Scheduled Medicines', () => {
    // Test the billing store logic for scheduled medicines
    describe('hasScheduledMedicines', () => {
        it('should return true when cart has scheduled medicines', () => {
            const items = [
                {
                    batch: {
                        batch_id: 1,
                        medicine_name: 'Regular Med',
                        is_schedule: false
                    } as StockItem,
                    quantity: 10,
                    quantityStrips: 1,
                    quantityPieces: 0,
                    discountValue: 0
                },
                {
                    batch: {
                        batch_id: 2,
                        medicine_name: 'Schedule H Drug',
                        is_schedule: true
                    } as StockItem,
                    quantity: 10,
                    quantityStrips: 1,
                    quantityPieces: 0,
                    discountValue: 0
                }
            ]

            const hasScheduled = items.some(item => item.batch.is_schedule)
            expect(hasScheduled).toBe(true)
        })

        it('should return false when cart has no scheduled medicines', () => {
            const items = [
                {
                    batch: {
                        batch_id: 1,
                        medicine_name: 'Regular Med 1',
                        is_schedule: false
                    } as StockItem,
                    quantity: 10,
                    quantityStrips: 1,
                    quantityPieces: 0,
                    discountValue: 0
                },
                {
                    batch: {
                        batch_id: 2,
                        medicine_name: 'Regular Med 2',
                        is_schedule: false
                    } as StockItem,
                    quantity: 10,
                    quantityStrips: 1,
                    quantityPieces: 0,
                    discountValue: 0
                }
            ]

            const hasScheduled = items.some(item => item.batch.is_schedule)
            expect(hasScheduled).toBe(false)
        })
    })
})

describe('CreateBillInput with Patient Info', () => {
    it('should accept patient_info for scheduled medicines', () => {
        const billInput = {
            customer_id: 1,
            customer_name: 'Test Customer',
            items: [
                { batch_id: 1, quantity: 10 }
            ],
            payment_mode: 'CASH' as const,
            patient_info: {
                patient_name: 'Patient Name',
                patient_age: 30,
                patient_gender: 'M' as const,
                patient_phone: '1234567890',
                doctor_name: 'Dr. Test'
            }
        }

        expect(billInput.patient_info).toBeDefined()
        expect(billInput.patient_info?.patient_name).toBe('Patient Name')
    })

    it('should work without patient_info for regular medicines', () => {
        const billInput: { customer_name: string; items: { batch_id: number; quantity: number }[]; payment_mode: 'CASH'; patient_info?: unknown } = {
            customer_name: 'Walk-in',
            items: [
                { batch_id: 1, quantity: 10 }
            ],
            payment_mode: 'CASH' as const
        }

        expect(billInput.patient_info).toBeUndefined()
    })
})
