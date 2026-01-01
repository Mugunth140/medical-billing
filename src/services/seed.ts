// =====================================================
// MedBill - Database Seeding & Reset Script
// Comprehensive seed data for all screens
// =====================================================

import { execute, initDatabase, query, transaction } from './database';

/**
 * Safely delete from a table if it exists
 */
async function safeDelete(tableName: string): Promise<void> {
    try {
        await execute(`DELETE FROM ${tableName}`, []);
    } catch (error) {
        // Table might not exist, that's okay
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
    // Use safeDelete for tables that may not exist in runtime schema
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

    // Mark that we've already done the tablet migration (since we're seeding fresh data in tablets)
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
 * Seed the database with comprehensive sample data
 */
export async function seedDatabase(): Promise<void> {
    console.log('Starting comprehensive database seeding...');

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

        await transaction(async () => {
            // =========================================
            // SUPPLIERS
            // =========================================
            console.log('Seeding suppliers...');
            await execute(`
                INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
                ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street, Vadapalani', 'Chennai', 'Tamil Nadu', 30),
                ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane, Guindy', 'Chennai', 'Tamil Nadu', 45),
                ('HealthFirst Supplies', 'Arun Kumar', '9876543212', 'arun@healthfirst.com', '33AABCU9603R3ZO', '789 Health Road', 'Coimbatore', 'Tamil Nadu', 30),
                ('Pharma Traders', 'Suresh B', '9876543213', 'suresh@pharmatraders.com', '33AABCU9603R4ZP', '321 Trade Complex', 'Madurai', 'Tamil Nadu', 60),
                ('Medical Hub', 'Kavitha R', '9876543214', 'kavitha@medhub.in', '33AABCU9603R5ZQ', '654 Hub Plaza', 'Chennai', 'Tamil Nadu', 30)
            `, []);

            // =========================================
            // MEDICINES
            // =========================================
            console.log('Seeding medicines...');
            await execute(`
                INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, category, unit, reorder_level) VALUES
                ('Dolo 650', 'Paracetamol 650mg', 'Micro Labs', '3004', 12, 'Analgesic', 'STRIP', 50),
                ('Azithral 500', 'Azithromycin 500mg', 'Alembic Pharma', '3004', 12, 'Antibiotic', 'STRIP', 30),
                ('Pan 40', 'Pantoprazole 40mg', 'Alkem Labs', '3004', 12, 'Antacid', 'STRIP', 40),
                ('Crocin Advance', 'Paracetamol 500mg', 'GSK', '3004', 12, 'Analgesic', 'STRIP', 60),
                ('Amoxyclav 625', 'Amoxicillin + Clavulanic Acid', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 25),
                ('Cetrizine 10mg', 'Cetirizine 10mg', 'Sun Pharma', '3004', 12, 'Antiallergic', 'STRIP', 40),
                ('Montair LC', 'Montelukast + Levocetirizine', 'Cipla', '3004', 12, 'Antiallergic', 'STRIP', 30),
                ('Shelcal 500', 'Calcium + Vitamin D3', 'Torrent Pharma', '3004', 12, 'Supplement', 'BOTTLE', 20),
                ('B-Complex Forte', 'Vitamin B Complex', 'Abbott', '3004', 0, 'Supplement', 'BOTTLE', 25),
                ('ORS Powder', 'Oral Rehydration Salts', 'FDC', '3004', 5, 'Rehydration', 'PCS', 100),
                ('Calpol 250', 'Paracetamol 250mg Syrup', 'GSK', '3004', 12, 'Pediatric', 'BOTTLE', 30),
                ('Allegra 120', 'Fexofenadine 120mg', 'Sanofi', '3004', 12, 'Antiallergic', 'STRIP', 25),
                ('Omez 20', 'Omeprazole 20mg', 'Dr Reddys', '3004', 12, 'Antacid', 'STRIP', 50),
                ('Augmentin 625', 'Amoxicillin + Clavulanic Acid', 'GSK', '3004', 12, 'Antibiotic', 'STRIP', 20),
                ('Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', '3004', 12, 'Analgesic', 'STRIP', 40),
                ('Zincovit', 'Multivitamin + Zinc', 'Apex Labs', '3004', 0, 'Supplement', 'BOTTLE', 30),
                ('Digene Gel', 'Antacid Gel', 'Abbott', '3004', 12, 'Antacid', 'BOTTLE', 25),
                ('Vicks Vaporub', 'Camphor + Menthol', 'P&G', '3004', 18, 'Cold & Cough', 'PCS', 50),
                ('Benadryl DR', 'Diphenhydramine Syrup', 'Johnson & Johnson', '3004', 12, 'Cold & Cough', 'BOTTLE', 20),
                ('Livogen', 'Iron + Folic Acid', 'Merck', '3004', 0, 'Supplement', 'STRIP', 35)
            `, []);

            // =========================================
            // BATCHES
            // =========================================
            console.log('Seeding batches...');
            // Different expiry scenarios for testing
            const expiry6Months = formatDate(addDays(180));
            const expiry1Year = formatDate(addDays(365));
            const expiry20Days = formatDate(addDays(20)); // Expiring soon
            const expiry3Months = formatDate(addDays(90));

            await execute(`
                INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box) VALUES
                (1, 'DL24001', '${expiry1Year}', 25.00, 35.00, 35.00, 'INCLUSIVE', 2000, 10, 'A1', '1'),
                (1, 'DL24002', '${expiry20Days}', 24.00, 35.00, 35.00, 'INCLUSIVE', 300, 10, 'A1', '2'),
                (2, 'AZ24001', '${expiry6Months}', 85.00, 120.00, 118.00, 'INCLUSIVE', 600, 6, 'A2', '1'),
                (3, 'PN24001', '${expiry1Year}', 45.00, 65.00, 65.00, 'INCLUSIVE', 1500, 10, 'A3', '1'),
                (4, 'CR24001', '${expiry6Months}', 20.00, 30.00, 30.00, 'INCLUSIVE', 1800, 10, 'A1', '3'),
                (5, 'AM24001', '${expiry3Months}', 95.00, 135.00, 132.00, 'INCLUSIVE', 480, 6, 'A4', '1'),
                (6, 'CT24001', '${expiry1Year}', 8.00, 15.00, 15.00, 'INCLUSIVE', 3000, 10, 'B1', '1'),
                (7, 'ML24001', '${expiry6Months}', 70.00, 98.00, 95.00, 'INCLUSIVE', 1200, 10, 'B2', '1'),
                (8, 'SC24001', '${expiry1Year}', 120.00, 180.00, 175.00, 'INCLUSIVE', 600, 15, 'C1', '1'),
                (9, 'BC24001', '${expiry1Year}', 35.00, 55.00, 55.00, 'INCLUSIVE', 80, 10, 'C2', '1'),
                (10, 'OR24001', '${expiry6Months}', 5.00, 12.00, 12.00, 'INCLUSIVE', 500, 1, 'D1', '1'),
                (11, 'CP24001', '${expiry3Months}', 40.00, 65.00, 65.00, 'INCLUSIVE', 45, 1, 'D2', '1'),
                (12, 'AL24001', '${expiry1Year}', 55.00, 85.00, 85.00, 'INCLUSIVE', 900, 10, 'B3', '1'),
                (13, 'OM24001', '${expiry6Months}', 22.00, 38.00, 38.00, 'INCLUSIVE', 2000, 10, 'A5', '1'),
                (14, 'AU24001', '${expiry20Days}', 110.00, 165.00, 160.00, 'INCLUSIVE', 150, 6, 'A4', '2'),
                (15, 'CF24001', '${expiry1Year}', 18.00, 32.00, 32.00, 'INCLUSIVE', 2500, 10, 'A1', '4'),
                (16, 'ZC24001', '${expiry1Year}', 90.00, 140.00, 140.00, 'INCLUSIVE', 400, 15, 'C3', '1'),
                (17, 'DG24001', '${expiry6Months}', 45.00, 75.00, 75.00, 'INCLUSIVE', 55, 1, 'D3', '1'),
                (18, 'VV24001', '${expiry1Year}', 60.00, 99.00, 99.00, 'INCLUSIVE', 100, 1, 'E1', '1'),
                (19, 'BD24001', '${expiry3Months}', 55.00, 85.00, 85.00, 'INCLUSIVE', 35, 1, 'D4', '1'),
                (20, 'LV24001', '${expiry1Year}', 28.00, 45.00, 45.00, 'INCLUSIVE', 50, 10, 'C4', '1')
            `, []);

            // =========================================
            // CUSTOMERS
            // =========================================
            console.log('Seeding customers...');
            await execute(`
                INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES
                ('Ramesh Kumar', '9876543220', 'ramesh@email.com', '12 Gandhi Street, Chennai', 5000.00, 1500.00),
                ('Lakshmi Devi', '9876543221', 'lakshmi@email.com', '34 Nehru Road, Chennai', 3000.00, 0.00),
                ('Suresh Babu', '9876543222', 'suresh@email.com', '56 Anna Nagar, Chennai', 10000.00, 4500.00),
                ('Kavitha Rajan', '9876543223', 'kavitha@email.com', '78 T Nagar, Chennai', 2000.00, 800.00),
                ('Mohan Raj', '9876543224', 'mohan@email.com', '90 Adyar, Chennai', 8000.00, 2200.00),
                ('Priya S', '9876543225', 'priya@email.com', '11 Velachery, Chennai', 4000.00, 0.00),
                ('Ganesh V', '9876543226', 'ganesh@email.com', '22 Tambaram, Chennai', 6000.00, 3100.00),
                ('Anitha K', '9876543227', 'anitha@email.com', '33 Chrompet, Chennai', 3500.00, 500.00)
            `, []);

            // =========================================
            // PURCHASES
            // =========================================
            console.log('Seeding purchases...');
            const purchaseDate1 = formatDate(subDays(30));
            const purchaseDate2 = formatDate(subDays(15));
            const purchaseDate3 = formatDate(subDays(7));

            await execute(`
                INSERT INTO purchases (invoice_number, invoice_date, supplier_id, user_id, subtotal, total_cgst, total_sgst, total_gst, grand_total, payment_status, paid_amount) VALUES
                ('ABC/2024/001', '${purchaseDate1}', 1, 1, 15000.00, 900.00, 900.00, 1800.00, 16800.00, 'PAID', 16800.00),
                ('MED/2024/102', '${purchaseDate2}', 2, 1, 8500.00, 510.00, 510.00, 1020.00, 9520.00, 'PARTIAL', 5000.00),
                ('HFS/2024/055', '${purchaseDate3}', 3, 1, 12000.00, 720.00, 720.00, 1440.00, 13440.00, 'PENDING', 0.00)
            `, []);

            // =========================================
            // BILLS (Sales)
            // =========================================
            console.log('Seeding bills...');
            const billDate1 = formatDate(subDays(5));
            const billDate2 = formatDate(subDays(3));
            const billDate3 = formatDate(subDays(1));
            const billDateToday = formatDate(today);

            // Update bill sequence
            await execute('UPDATE bill_sequence SET current_number = 10', []);

            await execute(`
                INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, user_id, subtotal, taxable_total, total_cgst, total_sgst, total_gst, grand_total, payment_mode, cash_amount, status) VALUES
                ('INV-242500001', '${billDate1}', 1, 'Ramesh Kumar', 1, 350.00, 312.50, 18.75, 18.75, 37.50, 350.00, 'CASH', 350.00, 'COMPLETED'),
                ('INV-242500002', '${billDate1}', 2, 'Lakshmi Devi', 1, 520.00, 464.29, 27.86, 27.86, 55.71, 520.00, 'ONLINE', 0.00, 'COMPLETED'),
                ('INV-242500003', '${billDate2}', NULL, 'Walk-in', 1, 180.00, 160.71, 9.64, 9.64, 19.29, 180.00, 'CASH', 180.00, 'COMPLETED'),
                ('INV-242500004', '${billDate2}', 3, 'Suresh Babu', 1, 1250.00, 1116.07, 66.96, 66.96, 133.93, 1250.00, 'CREDIT', 0.00, 'COMPLETED'),
                ('INV-242500005', '${billDate3}', 4, 'Kavitha Rajan', 1, 450.00, 401.79, 24.11, 24.11, 48.21, 450.00, 'CASH', 450.00, 'COMPLETED'),
                ('INV-242500006', '${billDate3}', 5, 'Mohan Raj', 1, 680.00, 607.14, 36.43, 36.43, 72.86, 680.00, 'SPLIT', 400.00, 'COMPLETED'),
                ('INV-242500007', '${billDateToday}', NULL, 'Walk-in', 1, 95.00, 84.82, 5.09, 5.09, 10.18, 95.00, 'CASH', 95.00, 'COMPLETED'),
                ('INV-242500008', '${billDateToday}', 6, 'Priya S', 1, 320.00, 285.71, 17.14, 17.14, 34.29, 320.00, 'ONLINE', 0.00, 'COMPLETED'),
                ('INV-242500009', '${billDateToday}', 7, 'Ganesh V', 1, 850.00, 758.93, 45.54, 45.54, 91.07, 850.00, 'CREDIT', 0.00, 'COMPLETED'),
                ('INV-242500010', '${billDateToday}', NULL, 'Walk-in', 1, 210.00, 187.50, 11.25, 11.25, 22.50, 210.00, 'CASH', 210.00, 'COMPLETED')
            `, []);

            // =========================================
            // BILL ITEMS
            // =========================================
            console.log('Seeding bill items...');
            await execute(`
                INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, expiry_date, quantity, unit_price, price_type, taxable_value, gst_rate, cgst, sgst, total_gst, total) VALUES
                (1, 1, 1, 'Dolo 650', '3004', 'DL24001', '${expiry1Year}', 10, 35.00, 'INCLUSIVE', 312.50, 12, 18.75, 18.75, 37.50, 350.00),
                (2, 3, 2, 'Azithral 500', '3004', 'AZ24001', '${expiry6Months}', 4, 118.00, 'INCLUSIVE', 421.43, 12, 25.29, 25.29, 50.57, 472.00),
                (2, 6, 5, 'Amoxyclav 625', '3004', 'AM24001', '${expiry3Months}', 1, 132.00, 'INCLUSIVE', 117.86, 12, 7.07, 7.07, 14.14, 132.00),
                (3, 4, 3, 'Pan 40', '3004', 'PN24001', '${expiry1Year}', 2, 65.00, 'INCLUSIVE', 116.07, 12, 6.96, 6.96, 13.93, 130.00),
                (3, 7, 6, 'Cetrizine 10mg', '3004', 'CT24001', '${expiry1Year}', 3, 15.00, 'INCLUSIVE', 40.18, 12, 2.41, 2.41, 4.82, 45.00),
                (4, 8, 7, 'Montair LC', '3004', 'ML24001', '${expiry6Months}', 10, 95.00, 'INCLUSIVE', 848.21, 12, 50.89, 50.89, 101.79, 950.00),
                (4, 12, 11, 'Calpol 250', '3004', 'CP24001', '${expiry3Months}', 3, 65.00, 'INCLUSIVE', 174.11, 12, 10.45, 10.45, 20.89, 195.00),
                (5, 13, 12, 'Allegra 120', '3004', 'AL24001', '${expiry1Year}', 5, 85.00, 'INCLUSIVE', 379.46, 12, 22.77, 22.77, 45.54, 425.00),
                (6, 15, 14, 'Augmentin 625', '3004', 'AU24001', '${expiry20Days}', 4, 160.00, 'INCLUSIVE', 571.43, 12, 34.29, 34.29, 68.57, 640.00),
                (7, 11, 10, 'ORS Powder', '3004', 'OR24001', '${expiry6Months}', 8, 12.00, 'INCLUSIVE', 91.43, 5, 2.29, 2.29, 4.57, 96.00),
                (8, 16, 15, 'Combiflam', '3004', 'CF24001', '${expiry1Year}', 10, 32.00, 'INCLUSIVE', 285.71, 12, 17.14, 17.14, 34.29, 320.00),
                (9, 9, 8, 'Shelcal 500', '3004', 'SC24001', '${expiry1Year}', 5, 175.00, 'INCLUSIVE', 781.25, 12, 46.88, 46.88, 93.75, 875.00),
                (10, 1, 1, 'Dolo 650', '3004', 'DL24001', '${expiry1Year}', 6, 35.00, 'INCLUSIVE', 187.50, 12, 11.25, 11.25, 22.50, 210.00)
            `, []);

            // =========================================
            // CREDITS (for customers with balance)
            // =========================================
            console.log('Seeding credit transactions...');
            await execute(`
                INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, payment_mode, notes, user_id) VALUES
                (1, 1, 'SALE', 1500.00, 1500.00, NULL, 'Credit sale', 1),
                (3, 4, 'SALE', 4500.00, 4500.00, NULL, 'Credit sale', 1),
                (4, NULL, 'SALE', 800.00, 800.00, NULL, 'Previous balance', 1),
                (5, NULL, 'SALE', 2200.00, 2200.00, NULL, 'Previous balance', 1),
                (7, 9, 'SALE', 850.00, 850.00, NULL, 'Credit sale', 1),
                (7, NULL, 'SALE', 2250.00, 3100.00, NULL, 'Previous balance', 1),
                (8, NULL, 'SALE', 500.00, 500.00, NULL, 'Previous balance', 1)
            `, []);

            // =========================================
            // AUDIT LOG
            // =========================================
            console.log('Seeding audit log...');
            await execute(`
                INSERT INTO audit_log (user_id, action, entity_type, entity_id, description) VALUES
                (1, 'LOGIN', 'USER', 1, 'User logged in'),
                (1, 'CREATE', 'BILL', 1, 'Created bill INV-242500001'),
                (1, 'CREATE', 'BILL', 2, 'Created bill INV-242500002'),
                (1, 'CREATE', 'PURCHASE', 1, 'Recorded purchase ABC/2024/001'),
                (1, 'UPDATE', 'SETTINGS', NULL, 'Updated shop settings')
            `, []);
        });

        console.log('');
        console.log('========================================');
        console.log('Database seeding completed successfully!');
        console.log('========================================');
        console.log('Seeded data summary:');
        console.log('  - 5 Suppliers');
        console.log('  - 20 Medicines with batches');
        console.log('  - 8 Customers (some with credit balances)');
        console.log('  - 3 Purchase invoices');
        console.log('  - 10 Sales bills with items');
        console.log('  - Credit transactions');
        console.log('  - Audit log entries');
        console.log('');
        console.log('Features to test:');
        console.log('  - Dashboard: Shows today\'s sales, alerts');
        console.log('  - Inventory: 20 medicines, some expiring soon');
        console.log('  - Billing: Search medicines, create bills');
        console.log('  - Purchases: View purchase history');
        console.log('  - Customers: Credit balances to collect');
        console.log('  - Reports: Sales and inventory reports');
        console.log('========================================');

    } catch (error) {
        console.error('Failed to seed database:', error);
        throw error;
    }
}

// Export for command-line usage
export { clearDatabase as clear, seedDatabase as seed };
