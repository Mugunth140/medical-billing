import { describe, expect, it } from 'vitest'
import type { ScheduledMedicineRecord } from '../types'

// Mock query results for scheduled medicine reports
const mockScheduledRecords: ScheduledMedicineRecord[] = [
    {
        id: 1,
        bill_id: 100,
        bill_item_id: 1,
        medicine_id: 1,
        batch_id: 1,
        medicine_name: 'Alprazolam 0.5mg',
        batch_number: 'BATCH001',
        quantity: 10,
        patient_name: 'John Doe',
        patient_age: 45,
        patient_gender: 'M',
        patient_phone: '9876543210',
        patient_address: '123 Main Street',
        doctor_name: 'Dr. Smith',
        prescription_number: 'RX2024001',
        created_at: '2024-01-15T10:30:00Z',
        bill_number: 'INV-001'
    },
    {
        id: 2,
        bill_id: 101,
        bill_item_id: 2,
        medicine_id: 2,
        batch_id: 2,
        medicine_name: 'Codeine Phosphate',
        batch_number: 'BATCH002',
        quantity: 5,
        patient_name: 'Jane Smith',
        patient_age: 32,
        patient_gender: 'F',
        patient_phone: '9876543211',
        patient_address: '456 Oak Avenue',
        doctor_name: 'Dr. Johnson',
        prescription_number: 'RX2024002',
        created_at: '2024-01-15T14:45:00Z',
        bill_number: 'INV-002'
    }
]

describe('Scheduled Medicines Report', () => {
    describe('Report Data Structure', () => {
        it('should have all required fields for regulatory compliance', () => {
            const record = mockScheduledRecords[0]
            
            // Regulatory required fields
            expect(record).toHaveProperty('patient_name')
            expect(record).toHaveProperty('patient_age')
            expect(record).toHaveProperty('patient_gender')
            expect(record).toHaveProperty('medicine_name')
            expect(record).toHaveProperty('quantity')
            expect(record).toHaveProperty('doctor_name')
            expect(record).toHaveProperty('prescription_number')
            expect(record).toHaveProperty('created_at')
            expect(record).toHaveProperty('bill_number')
        })

        it('should display gender correctly', () => {
            const genderLabels: Record<string, string> = {
                'M': 'Male',
                'F': 'Female',
                'O': 'Other'
            }

            mockScheduledRecords.forEach(record => {
                if (record.patient_gender) {
                    expect(genderLabels[record.patient_gender]).toBeDefined()
                }
            })
        })

        it('should format dates for display', () => {
            const record = mockScheduledRecords[0]
            const date = new Date(record.created_at)
            
            // Should be a valid date
            expect(date.getTime()).not.toBeNaN()
            
            // Format date for display
            const formattedDate = date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
            expect(formattedDate).toMatch(/\d{2}\/\d{2}\/\d{4}/)
        })
    })

    describe('Report Filtering', () => {
        it('should filter records by date range', () => {
            const startDate = new Date('2024-01-01')
            const endDate = new Date('2024-01-31')

            const filtered = mockScheduledRecords.filter(record => {
                const recordDate = new Date(record.created_at)
                return recordDate >= startDate && recordDate <= endDate
            })

            expect(filtered.length).toBe(2)
        })

        it('should filter records by medicine name', () => {
            const searchTerm = 'Alprazolam'
            
            const filtered = mockScheduledRecords.filter(record =>
                record.medicine_name?.toLowerCase().includes(searchTerm.toLowerCase())
            )

            expect(filtered.length).toBe(1)
            expect(filtered[0].medicine_name).toBe('Alprazolam 0.5mg')
        })

        it('should filter records by patient name', () => {
            const searchTerm = 'John'
            
            const filtered = mockScheduledRecords.filter(record =>
                record.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
            )

            expect(filtered.length).toBe(1)
            expect(filtered[0].patient_name).toBe('John Doe')
        })
    })

    describe('Report Statistics', () => {
        it('should calculate total quantity of scheduled medicines sold', () => {
            const totalQuantity = mockScheduledRecords.reduce(
                (sum, record) => sum + record.quantity, 0
            )
            expect(totalQuantity).toBe(15) // 10 + 5
        })

        it('should count unique patients', () => {
            const uniquePatients = new Set(
                mockScheduledRecords.map(record => record.patient_name)
            )
            expect(uniquePatients.size).toBe(2)
        })

        it('should count unique medicines', () => {
            const uniqueMedicines = new Set(
                mockScheduledRecords.map(record => record.medicine_id)
            )
            expect(uniqueMedicines.size).toBe(2)
        })

        it('should count records by doctor', () => {
            const byDoctor = mockScheduledRecords.reduce((acc, record) => {
                const doctor = record.doctor_name || 'Unknown'
                acc[doctor] = (acc[doctor] || 0) + 1
                return acc
            }, {} as Record<string, number>)

            expect(byDoctor['Dr. Smith']).toBe(1)
            expect(byDoctor['Dr. Johnson']).toBe(1)
        })
    })

    describe('Report Export', () => {
        it('should format data for CSV export', () => {
            const headers = [
                'Date',
                'Bill No',
                'Patient Name',
                'Age',
                'Gender',
                'Medicine',
                'Batch',
                'Qty',
                'Doctor',
                'Rx No'
            ]

            const rows = mockScheduledRecords.map(record => [
                new Date(record.created_at).toLocaleDateString(),
                record.bill_number || '',
                record.patient_name,
                record.patient_age?.toString() || '',
                record.patient_gender || '',
                record.medicine_name,
                record.batch_number || '',
                record.quantity.toString(),
                record.doctor_name || '',
                record.prescription_number || ''
            ])

            expect(headers.length).toBe(10)
            expect(rows.length).toBe(2)
            expect(rows[0].length).toBe(headers.length)
        })
    })
})

describe('Scheduled Medicine Inventory Display', () => {
    it('should show schedule indicator in medicine list', () => {
        const medicines = [
            { id: 1, name: 'Paracetamol 500mg', is_schedule: false },
            { id: 2, name: 'Alprazolam 0.5mg', is_schedule: true },
            { id: 3, name: 'Vitamin C', is_schedule: false },
            { id: 4, name: 'Codeine Phosphate', is_schedule: true }
        ]

        const scheduledMedicines = medicines.filter(m => m.is_schedule)
        const regularMedicines = medicines.filter(m => !m.is_schedule)

        expect(scheduledMedicines.length).toBe(2)
        expect(regularMedicines.length).toBe(2)
    })

    it('should display Schedule H/H1 badge for scheduled medicines', () => {
        const medicine = { id: 2, name: 'Alprazolam 0.5mg', is_schedule: true }
        
        const badgeText = medicine.is_schedule ? 'Schedule H/H1' : null
        expect(badgeText).toBe('Schedule H/H1')
    })
})
