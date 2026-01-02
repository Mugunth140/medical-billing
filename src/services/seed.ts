// =====================================================
// MedBill - Database Seeding & Reset Script
// Simplified seed data with 10 practical medicine entries
// All quantities stored in TABLETS (base unit)
// =====================================================

import { execute, initDatabase, query } from './database';

/**
 * Safely delete from a table if it exists
 */
async function safeDelete(tableName: string): Promise<void> {
    try {
        await execute(`DELETE FROM ${tableName}`, []);
    } catch (error) {
        console.log(`Skipped clearing ${tableName} (may not exist)`);
    }
}

/**
 * Clear all user data from the database (keep schema and default settings)
 */
export async function clearDatabase(): Promise<void> {
    console.log('Clearing database...');

    await initDatabase();

    // Clear in order respecting foreign keys
    await safeDelete('running_bills');
    await safeDelete('credits');
    await safeDelete('scheduled_medicine_records');
    await safeDelete('sales_return_items');
    await safeDelete('sales_returns');
    await safeDelete('purchase_return_items');
    await safeDelete('purchase_returns');
    await safeDelete('bill_items');
    await safeDelete('bills');
    await safeDelete('purchase_items');
    await safeDelete('purchases');
    await safeDelete('batches');
    await safeDelete('medicines');
    await safeDelete('customers');
    await safeDelete('suppliers');
    await safeDelete('audit_log');

    // Reset bill sequence
    try {
        await execute('UPDATE bill_sequence SET current_number = 0', []);
    } catch (error) {
        console.log('Bill sequence reset skipped');
    }

    // Reset SQLite auto-increment counters
    try {
        await execute('DELETE FROM sqlite_sequence', []);
        console.log('Auto-increment counters reset');
    } catch (error) {
        console.log('Sequence reset skipped');
    }

    // Mark tablets migration as done (we're seeding fresh data in tablets)
    try {
        await execute(
            `INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`,
            []
        );
    } catch (error) {
        console.log('Settings update skipped');
    }

    console.log('Database cleared successfully!');
}

/**
 * Seed the database with 10 practical medicine entries
 * Covering all scenarios: normal stock, low stock, expiring soon, scheduled drugs, etc.
 */
export async function seedDatabase(): Promise<void> {
    console.log('Starting simplified database seeding...');

    try {
        await initDatabase();

        // Check if already seeded
        const existingMedicines = await query<{ count: number }>(
            'SELECT COUNT(*) as count FROM medicines',
            []
        );

        if (existingMedicines[0]?.count > 0) {
            console.log('Database already has data. Clear first if you want to reseed.');
            return;
        }

        // Date helpers
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const addDays = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        const subDays = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

        // =========================================
        // 2 SUPPLIERS (Minimal for testing)
        // =========================================
        console.log('Seeding suppliers...');
        await execute(`
            INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
            ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street, Vadapalani', 'Chennai', 'Tamil Nadu', 30),
            ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane, Guindy', 'Chennai', 'Tamil Nadu', 45)
        `, []);

        // =========================================
        // 10 MEDICINES (Diverse scenarios)
        // =========================================
        console.log('Seeding 10 medicines...');
        await execute(`
            INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, category, unit, reorder_level, is_schedule) VALUES
            ('Dolo 650', 'Paracetamol 650mg', 'Micro Labs', '3004', 12, 'Analgesic', 'STRIP', 50, 0),
            ('Azithral 500', 'Azithromycin 500mg', 'Alembic Pharma', '3004', 12, 'Antibiotic', 'STRIP', 30, 0),
            ('Pan 40', 'Pantoprazole 40mg', 'Alkem Labs', '3004', 12, 'Antacid', 'STRIP', 40, 0),
            ('Crocin Advance', 'Paracetamol 500mg', 'GSK', '3004', 12, 'Analgesic', 'STRIP', 60, 0),
            ('Shelcal 500', 'Calcium + Vitamin D3', 'Torrent Pharma', '3004', 0, 'Supplement', 'STRIP', 20, 0),
            ('Allegra 120', 'Fexofenadine 120mg', 'Sanofi', '3004', 12, 'Antiallergic', 'STRIP', 25, 0),
            ('Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', '3004', 12, 'Analgesic', 'STRIP', 40, 0),
            ('Alprazolam 0.5', 'Alprazolam 0.5mg', 'Sun Pharma', '3004', 12, 'Anxiolytic', 'STRIP', 20, 1),
            ('Tramadol 50', 'Tramadol HCl 50mg', 'Cipla', '3004', 12, 'Analgesic', 'STRIP', 15, 1),
            ('Zincovit', 'Multivitamin + Zinc', 'Apex Labs', '3004', 0, 'Supplement', 'BOTTLE', 30, 0)
        `, []);

        // =========================================
        // 10 BATCHES (Various stock levels and expiry scenarios)
        // All quantities in TABLETS (not strips)
        // =========================================
        console.log('Seeding batches (quantity in tablets)...');
        
        // Expiry date scenarios
        const expiry1Year = formatDate(addDays(365));      // Normal
        const expiry6Months = formatDate(addDays(180));    // OK
        const expiry25Days = formatDate(addDays(25));      // Expiring soon
        const expiry10Days = formatDate(addDays(10));      // Critical expiry
        const expired = formatDate(subDays(5));            // Already expired

        // NOTE: All quantities are in TABLETS
        // tabletsPerStrip defines how many tablets make 1 strip
        await execute(`
            INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box) VALUES
            (1, 'DL24001', '${expiry1Year}', 25.00, 35.00, 32.00, 'INCLUSIVE', 500, 10, 'A1', '1'),
            (2, 'AZ24001', '${expiry6Months}', 80.00, 120.00, 115.00, 'INCLUSIVE', 180, 6, 'A2', '1'),
            (3, 'PN24001', '${expiry1Year}', 45.00, 65.00, 60.00, 'INCLUSIVE', 300, 10, 'A3', '1'),
            (4, 'CR24001', '${expiry25Days}', 20.00, 30.00, 28.00, 'INCLUSIVE', 200, 15, 'A4', '1'),
            (5, 'SH24001', '${expiry1Year}', 150.00, 210.00, 200.00, 'INCLUSIVE', 150, 15, 'B1', '2'),
            (6, 'AL24001', '${expiry6Months}', 55.00, 85.00, 80.00, 'INCLUSIVE', 100, 10, 'B2', '2'),
            (7, 'CF24001', '${expiry10Days}', 35.00, 50.00, 48.00, 'INCLUSIVE', 80, 10, 'B3', '2'),
            (8, 'AP24001', '${expiry1Year}', 25.00, 45.00, 42.00, 'INCLUSIVE', 60, 10, 'C1', '3'),
            (9, 'TR24001', '${expiry6Months}', 30.00, 55.00, 50.00, 'INCLUSIVE', 40, 10, 'C2', '3'),
            (10, 'ZN24001', '${expired}', 85.00, 130.00, 125.00, 'INCLUSIVE', 25, 1, 'C3', '3')
        `, []);

        // =========================================
        // 5 CUSTOMERS (For testing credits)
        // =========================================
        console.log('Seeding customers...');
        await execute(`
            INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES
            ('Ramesh Kumar', '9876543220', 'ramesh@email.com', '12 Gandhi Street, Chennai', 5000, 1500),
            ('Lakshmi Devi', '9876543221', 'lakshmi@email.com', '34 Nehru Road, Chennai', 3000, 0),
            ('Suresh Babu', '9876543222', 'suresh@email.com', '56 Anna Nagar, Chennai', 10000, 2500),
            ('Kavitha Rajan', '9876543223', 'kavitha@email.com', '78 T Nagar, Chennai', 2000, 800),
            ('Walk-in Customer', '9876543224', '', 'Walk-in', 0, 0)
        `, []);

        // =========================================
        // 3 SAMPLE BILLS (For testing bill history)
        // =========================================
        console.log('Seeding sample bills...');
        const billDate1 = formatDate(subDays(5));
        const billDate2 = formatDate(subDays(2));
        const billDate3 = formatDate(today);

        await execute('UPDATE bill_sequence SET current_number = 3', []);

        await execute(`
            INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_mode, cash_amount, online_amount, credit_amount, is_cancelled, total_items) VALUES
            ('INV-2425-00001', '${billDate1}', 1, 'Ramesh Kumar', 1, 256.00, 228.57, 13.71, 13.71, 27.43, 256.00, 'CASH', 256.00, 0, 0, 0, 2),
            ('INV-2425-00002', '${billDate2}', 2, 'Lakshmi Devi', 1, 345.00, 308.04, 18.48, 18.48, 36.96, 345.00, 'ONLINE', 0, 345.00, 0, 0, 3),
            ('INV-2425-00003', '${billDate3}', 3, 'Suresh Babu', 1, 500.00, 446.43, 26.79, 26.79, 53.57, 500.00, 'CREDIT', 0, 0, 500.00, 0, 2)
        `, []);

        // =========================================
        // BILL ITEMS (Quantity in tablets)
        // =========================================
        console.log('Seeding bill items (quantity in tablets)...');
        await execute(`
            INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, quantity_strips, quantity_pieces, tablets_per_strip, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit) VALUES
            (1, 1, 1, 'Dolo 650', '3004', 'DL24001', 20, 2, 0, 10, 32.00, 57.14, 12, 3.43, 3.43, 64.00, 35.00, 'STRIP'),
            (1, 3, 3, 'Pan 40', '3004', 'PN24001', 30, 3, 0, 10, 60.00, 160.71, 12, 9.64, 9.64, 180.00, 65.00, 'STRIP'),
            (2, 2, 2, 'Azithral 500', '3004', 'AZ24001', 6, 1, 0, 6, 115.00, 102.68, 12, 6.16, 6.16, 115.00, 120.00, 'STRIP'),
            (2, 6, 6, 'Allegra 120', '3004', 'AL24001', 10, 1, 0, 10, 80.00, 71.43, 12, 4.29, 4.29, 80.00, 85.00, 'STRIP'),
            (2, 5, 5, 'Shelcal 500', '3004', 'SH24001', 15, 1, 0, 15, 200.00, 133.33, 0, 0, 0, 150.00, 210.00, 'STRIP'),
            (3, 7, 7, 'Combiflam', '3004', 'CF24001', 20, 2, 0, 10, 48.00, 85.71, 12, 5.14, 5.14, 96.00, 50.00, 'STRIP'),
            (3, 8, 8, 'Alprazolam 0.5', '3004', 'AP24001', 10, 1, 0, 10, 42.00, 375.00, 12, 22.50, 22.50, 420.00, 45.00, 'STRIP')
        `, []);

        // =========================================
        // 2 SCHEDULED MEDICINE RECORDS (For Schedule H drugs)
        // =========================================
        console.log('Seeding scheduled medicine records...');
        await execute(`
            INSERT INTO scheduled_medicine_records (bill_id, bill_item_id, medicine_id, batch_id, patient_name, patient_age, patient_gender, patient_phone, patient_address, doctor_name, doctor_registration_number, clinic_hospital_name, prescription_number, prescription_date, doctor_prescription, quantity) VALUES
            (3, 7, 8, 8, 'Suresh Babu', 45, 'M', '9876543222', '56 Anna Nagar, Chennai', 'Dr. Ramesh Kumar', 'TN12345', 'Apollo Clinic', 'RX2025001', '${formatDate(subDays(1))}', 'Alprazolam 0.5mg - Take 1 tablet twice daily after meals for anxiety. Duration: 2 weeks.', 10)
        `, []);

        // =========================================
        // 2 RUNNING BILLS (Pending stock reconciliation)
        // =========================================
        console.log('Seeding running bills...');
        await execute(`
            INSERT INTO running_bills (bill_id, medicine_name, quantity, unit_price, total_amount, gst_rate, hsn_code, notes, user_id, status) VALUES
            (1, 'Paracetamol 500mg Generic', 20, 15.00, 300.00, 12, '3004', 'Out of stock item', 1, 'PENDING'),
            (2, 'Vitamin B Complex', 30, 8.00, 240.00, 0, '3004', 'Generic substitute given', 1, 'PENDING')
        `, []);

        // =========================================
        // CREDIT TRANSACTIONS
        // =========================================
        console.log('Seeding credit transactions...');
        await execute(`
            INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, notes, user_id) VALUES
            (1, 1, 'SALE', 256.00, 1756.00, 'Credit sale', 1),
            (1, NULL, 'PAYMENT', 256.00, 1500.00, 'Cash payment received', 1),
            (3, 3, 'SALE', 500.00, 3000.00, 'Credit sale', 1)
        `, []);

        // Mark tablets migration as done
        await execute(
            `INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`,
            []
        );

        console.log('');
        console.log('========================================');
        console.log('Database seeding completed successfully!');
        console.log('========================================');
        console.log('');
        console.log('Seeded data summary:');
        console.log('  - 2 Suppliers');
        console.log('  - 10 Medicines (8 regular, 2 scheduled drugs)');
        console.log('  - 10 Batches with various scenarios:');
        console.log('      * Normal stock: 5 batches');
        console.log('      * Low stock: 3 batches (60-80 tablets)');
        console.log('      * Expiring soon: 2 batches (10-25 days)');
        console.log('      * Expired: 1 batch');
        console.log('  - 5 Customers (3 with credit balance)');
        console.log('  - 3 Sample bills with 7 bill items');
        console.log('  - 2 Running bills (pending reconciliation)');
        console.log('  - 1 Scheduled medicine record');
        console.log('');
        console.log('Stock unit: All quantities stored in TABLETS');
        console.log('Display: Strips are derived (tablets / tablets_per_strip)');
        console.log('========================================');

    } catch (error) {
        console.error('Failed to seed database:', error);
        throw error;
    }
}

// Export for command-line usage
export { clearDatabase as clear, seedDatabase as seed };
