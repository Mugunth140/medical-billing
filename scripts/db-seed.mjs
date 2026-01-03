#!/usr/bin/env node
// =====================================================
// Database Seed Script (Standalone)
// Run with: npm run db:seed, npm run db:clear, or npm run db:reset
// Simplified with 10 practical medicine entries
// All quantities stored in TABLETS (base unit)
// =====================================================

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Database path - same as Tauri uses (.config on Linux in dev mode)
const DATA_DIR = join(homedir(), '.config/com.medicalbilling.app');
const DB_PATH = join(DATA_DIR, 'medbill.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`Database path: ${DB_PATH}`);

// Open database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Date helpers
const today = new Date();
const formatDate = (d) => d.toISOString().split('T')[0];
const addDays = (days) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
const subDays = (days) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

// =====================================================
// CREATE TABLES
// =====================================================
function createTables() {
    console.log('Creating tables...');
    
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
            is_active INTEGER DEFAULT 1,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            generic_name TEXT,
            manufacturer TEXT,
            hsn_code TEXT NOT NULL DEFAULT '3004',
            gst_rate DECIMAL(5,2) NOT NULL CHECK (gst_rate IN (0, 5, 12, 18)),
            taxability TEXT NOT NULL DEFAULT 'TAXABLE' CHECK (taxability IN ('TAXABLE', 'EXEMPT')),
            category TEXT,
            drug_type TEXT,
            unit TEXT DEFAULT 'PCS',
            reorder_level INTEGER DEFAULT 10,
            is_schedule INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            batch_number TEXT NOT NULL,
            expiry_date DATE NOT NULL,
            purchase_price DECIMAL(10,2) NOT NULL,
            mrp DECIMAL(10,2) NOT NULL,
            selling_price DECIMAL(10,2) NOT NULL,
            price_type TEXT NOT NULL DEFAULT 'INCLUSIVE' CHECK (price_type IN ('INCLUSIVE', 'EXCLUSIVE')),
            quantity INTEGER NOT NULL DEFAULT 0,
            tablets_per_strip INTEGER DEFAULT 10,
            rack TEXT,
            box TEXT,
            last_sold_date DATE,
            purchase_id INTEGER,
            supplier_id INTEGER REFERENCES suppliers(id),
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(medicine_id, batch_number)
        )`,
        `CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            city TEXT,
            state TEXT DEFAULT 'Tamil Nadu',
            pincode TEXT,
            payment_terms INTEGER DEFAULT 30,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            credit_limit DECIMAL(12,2) DEFAULT 0,
            current_balance DECIMAL(12,2) DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_number TEXT NOT NULL UNIQUE,
            bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            customer_id INTEGER REFERENCES customers(id),
            customer_name TEXT,
            doctor_name TEXT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
            discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            discount_percent DECIMAL(5,2) DEFAULT 0,
            taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            cgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            sgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
            round_off DECIMAL(5,2) DEFAULT 0,
            grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
            payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'ONLINE', 'CREDIT', 'SPLIT')),
            payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'PENDING')),
            cash_amount DECIMAL(12,2) DEFAULT 0,
            online_amount DECIMAL(12,2) DEFAULT 0,
            credit_amount DECIMAL(12,2) DEFAULT 0,
            notes TEXT,
            total_items INTEGER DEFAULT 0,
            is_cancelled INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            batch_id INTEGER NOT NULL REFERENCES batches(id),
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            medicine_name TEXT NOT NULL,
            hsn_code TEXT,
            batch_number TEXT,
            quantity INTEGER NOT NULL,
            quantity_strips INTEGER DEFAULT 0,
            quantity_pieces INTEGER DEFAULT 0,
            tablets_per_strip INTEGER DEFAULT 10,
            unit TEXT DEFAULT 'PCS',
            mrp DECIMAL(10,2),
            selling_price DECIMAL(10,2) NOT NULL,
            discount_percent DECIMAL(5,2) DEFAULT 0,
            discount_amount DECIMAL(10,2) DEFAULT 0,
            taxable_amount DECIMAL(12,2) NOT NULL,
            gst_rate DECIMAL(5,2) NOT NULL,
            cgst_amount DECIMAL(10,2) NOT NULL,
            sgst_amount DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bill_sequence (
            id INTEGER PRIMARY KEY,
            prefix TEXT NOT NULL DEFAULT 'INV',
            current_number INTEGER NOT NULL DEFAULT 0,
            financial_year TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS credits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            bill_id INTEGER REFERENCES bills(id),
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SALE', 'PAYMENT', 'ADJUSTMENT', 'RETURN')),
            amount DECIMAL(12,2) NOT NULL,
            balance_after DECIMAL(12,2) NOT NULL,
            payment_mode TEXT,
            reference_number TEXT,
            notes TEXT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS running_bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER REFERENCES bills(id),
            bill_number TEXT,
            medicine_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            gst_rate DECIMAL(5,2) DEFAULT 12,
            hsn_code TEXT DEFAULT '3004',
            notes TEXT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'STOCKED', 'CANCELLED')),
            linked_batch_id INTEGER REFERENCES batches(id),
            linked_medicine_id INTEGER REFERENCES medicines(id),
            stocked_at DATETIME,
            stocked_by INTEGER REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS scheduled_medicine_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            bill_item_id INTEGER REFERENCES bill_items(id),
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            batch_id INTEGER NOT NULL REFERENCES batches(id),
            patient_name TEXT NOT NULL,
            patient_age INTEGER,
            patient_gender TEXT,
            patient_phone TEXT,
            patient_address TEXT,
            doctor_name TEXT,
            doctor_registration_number TEXT,
            clinic_hospital_name TEXT,
            prescription_number TEXT,
            prescription_date TEXT,
            quantity INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            category TEXT DEFAULT 'general',
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id INTEGER,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    for (const sql of tables) {
        db.exec(sql);
    }

    // Create indexes
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)',
        'CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id)',
        'CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)',
        'CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number)',
        'CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date)',
        'CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id)'
    ];

    for (const sql of indexes) {
        db.exec(sql);
    }

    // Insert default user and bill sequence if not exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        db.exec(`INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', 'admin@123', 'Administrator', 'admin')`);
    }

    const seqCount = db.prepare('SELECT COUNT(*) as count FROM bill_sequence').get();
    if (seqCount.count === 0) {
        db.exec(`INSERT INTO bill_sequence (id, prefix, current_number, financial_year) VALUES (1, 'INV', 0, '2024-25')`);
    }

    console.log('Tables created successfully!');
}

// =====================================================
// CLEAR DATABASE
// =====================================================
function clearDatabase() {
    console.log('Clearing database...');
    
    // Disable foreign keys temporarily for clean delete
    db.exec('PRAGMA foreign_keys = OFF');
    
    const tables = [
        'running_bills', 'credits', 'scheduled_medicine_records',
        'bill_items', 'bills', 'batches', 'medicines',
        'customers', 'suppliers', 'audit_log', 'purchases', 'purchase_items',
        'sales_returns', 'sales_return_items', 'purchase_returns', 'purchase_return_items'
    ];

    for (const table of tables) {
        try {
            db.exec(`DELETE FROM ${table}`);
            console.log(`  - Cleared ${table}`);
        } catch (e) {
            // Table might not exist
        }
    }

    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');

    // Reset bill sequence
    try {
        db.exec('UPDATE bill_sequence SET current_number = 0');
    } catch (e) {}

    // Reset auto-increment
    try {
        db.exec('DELETE FROM sqlite_sequence');
    } catch (e) {}

    // Mark tablets migration as done
    try {
        db.exec(`INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`);
    } catch (e) {}

    console.log('Database cleared!');
}

// =====================================================
// SEED DATABASE (10 practical entries)
// =====================================================
function seedDatabase(skipCheck = false) {
    console.log('Seeding database with simplified data...');

    // Check if already has data (skip if called after clear)
    if (!skipCheck) {
        const medCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get();
        if (medCount.count > 0) {
            console.log('Database already has data. Use "npm run db:reset" to clear and reseed.');
            return;
        }
    }

    // Expiry dates
    const expiry1Year = formatDate(addDays(365));
    const expiry6Months = formatDate(addDays(180));
    const expiry25Days = formatDate(addDays(25));
    const expiry10Days = formatDate(addDays(10));
    const expired = formatDate(subDays(5));
    const billDate1 = formatDate(subDays(5));
    const billDate2 = formatDate(subDays(2));
    const billDate3 = formatDate(today);

    // =========================================
    // 2 SUPPLIERS
    // =========================================
    console.log('  - Seeding suppliers...');
    db.exec(`
        INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
        ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street', 'Chennai', 'Tamil Nadu', 30),
        ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane', 'Chennai', 'Tamil Nadu', 45)
    `);

    // =========================================
    // 10 MEDICINES (8 regular, 2 scheduled)
    // =========================================
    console.log('  - Seeding 10 medicines...');
    db.exec(`
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
    `);

    // =========================================
    // 10 BATCHES (quantity in TABLETS)
    // Scenarios covered:
    // - Normal stock (Dolo, Pan)
    // - Low stock based on strips (Shelcal, Allegra, etc.)
    // - Expiring soon (Crocin, Combiflam)
    // - Expired (Zincovit)
    // - Non-moving (Shelcal - old created_at, no last_sold_date)
    // - Scheduled drugs (Alprazolam, Tramadol)
    // =========================================
    console.log('  - Seeding batches (quantity in tablets)...');
    
    // Dates for non-moving items (created 60+ days ago)
    const oldCreatedDate = formatDate(subDays(60));
    const recentSaleDate = formatDate(subDays(3));
    
    db.exec(`
        INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box, last_sold_date, created_at) VALUES
        (1, 'DL24001', '${expiry1Year}', 25.00, 35.00, 32.00, 'INCLUSIVE', 600, 10, 'A1', '1', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (2, 'AZ24001', '${expiry6Months}', 80.00, 120.00, 115.00, 'INCLUSIVE', 180, 6, 'A2', '1', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (3, 'PN24001', '${expiry1Year}', 45.00, 65.00, 60.00, 'INCLUSIVE', 500, 10, 'A3', '1', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (4, 'CR24001', '${expiry25Days}', 20.00, 30.00, 28.00, 'INCLUSIVE', 150, 15, 'A4', '1', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (5, 'SH24001', '${expiry1Year}', 150.00, 210.00, 200.00, 'INCLUSIVE', 225, 15, 'B1', '2', NULL, '${oldCreatedDate}'),
        (6, 'AL24001', '${expiry6Months}', 55.00, 85.00, 80.00, 'INCLUSIVE', 200, 10, 'B2', '2', NULL, '${oldCreatedDate}'),
        (7, 'CF24001', '${expiry10Days}', 35.00, 50.00, 48.00, 'INCLUSIVE', 80, 10, 'B3', '2', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (8, 'AP24001', '${expiry1Year}', 25.00, 45.00, 42.00, 'INCLUSIVE', 100, 10, 'C1', '3', '${recentSaleDate}', CURRENT_TIMESTAMP),
        (9, 'TR24001', '${expiry6Months}', 30.00, 55.00, 50.00, 'INCLUSIVE', 60, 10, 'C2', '3', NULL, '${oldCreatedDate}'),
        (10, 'ZN24001', '${expired}', 85.00, 130.00, 125.00, 'INCLUSIVE', 25, 1, 'C3', '3', NULL, '${oldCreatedDate}')
    `);

    // =========================================
    // 5 CUSTOMERS
    // =========================================
    console.log('  - Seeding customers...');
    db.exec(`
        INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES
        ('Ramesh Kumar', '9876543220', 'ramesh@email.com', '12 Gandhi Street, Chennai', 5000, 1500),
        ('Lakshmi Devi', '9876543221', 'lakshmi@email.com', '34 Nehru Road, Chennai', 3000, 0),
        ('Suresh Babu', '9876543222', 'suresh@email.com', '56 Anna Nagar, Chennai', 10000, 2500),
        ('Kavitha Rajan', '9876543223', 'kavitha@email.com', '78 T Nagar, Chennai', 2000, 800),
        ('Walk-in Customer', '9876543224', '', 'Walk-in', 0, 0)
    `);

    // =========================================
    // 3 SAMPLE BILLS
    // =========================================
    console.log('  - Seeding sample bills...');
    db.exec(`UPDATE bill_sequence SET current_number = 3`);
    db.exec(`
        INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_mode, cash_amount, online_amount, credit_amount, is_cancelled, total_items) VALUES
        ('INV-2425-00001', '${billDate1}', 1, 'Ramesh Kumar', 1, 256.00, 228.57, 13.71, 13.71, 27.43, 256.00, 'CASH', 256.00, 0, 0, 0, 2),
        ('INV-2425-00002', '${billDate2}', 2, 'Lakshmi Devi', 1, 345.00, 308.04, 18.48, 18.48, 36.96, 345.00, 'ONLINE', 0, 345.00, 0, 0, 3),
        ('INV-2425-00003', '${billDate3}', 3, 'Suresh Babu', 1, 500.00, 446.43, 26.79, 26.79, 53.57, 500.00, 'CREDIT', 0, 0, 500.00, 0, 2)
    `);

    // =========================================
    // BILL ITEMS (quantity in tablets)
    // =========================================
    console.log('  - Seeding bill items...');
    db.exec(`
        INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, quantity_strips, quantity_pieces, tablets_per_strip, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit) VALUES
        (1, 1, 1, 'Dolo 650', '3004', 'DL24001', 20, 2, 0, 10, 32.00, 57.14, 12, 3.43, 3.43, 64.00, 35.00, 'STRIP'),
        (1, 3, 3, 'Pan 40', '3004', 'PN24001', 30, 3, 0, 10, 60.00, 160.71, 12, 9.64, 9.64, 180.00, 65.00, 'STRIP'),
        (2, 2, 2, 'Azithral 500', '3004', 'AZ24001', 6, 1, 0, 6, 115.00, 102.68, 12, 6.16, 6.16, 115.00, 120.00, 'STRIP'),
        (2, 6, 6, 'Allegra 120', '3004', 'AL24001', 10, 1, 0, 10, 80.00, 71.43, 12, 4.29, 4.29, 80.00, 85.00, 'STRIP'),
        (2, 5, 5, 'Shelcal 500', '3004', 'SH24001', 15, 1, 0, 15, 200.00, 133.33, 0, 0, 0, 150.00, 210.00, 'STRIP'),
        (3, 7, 7, 'Combiflam', '3004', 'CF24001', 20, 2, 0, 10, 48.00, 85.71, 12, 5.14, 5.14, 96.00, 50.00, 'STRIP'),
        (3, 8, 8, 'Alprazolam 0.5', '3004', 'AP24001', 10, 1, 0, 10, 42.00, 375.00, 12, 22.50, 22.50, 420.00, 45.00, 'STRIP')
    `);

    // =========================================
    // SCHEDULED MEDICINE RECORD
    // =========================================
    console.log('  - Seeding scheduled medicine records...');
    db.exec(`
        INSERT INTO scheduled_medicine_records (bill_id, bill_item_id, medicine_id, batch_id, patient_name, patient_age, patient_gender, patient_phone, patient_address, doctor_name, doctor_registration_number, clinic_hospital_name, prescription_number, prescription_date, doctor_prescription, quantity) VALUES
        (3, 7, 8, 8, 'Suresh Babu', 45, 'M', '9876543222', '56 Anna Nagar, Chennai', 'Dr. Ramesh Kumar', 'TN12345', 'Apollo Clinic', 'RX2025001', '${formatDate(subDays(1))}', 'Alprazolam 0.5mg - Take 1 tablet twice daily after meals for anxiety. Duration: 2 weeks.', 10)
    `);

    // =========================================
    // RUNNING BILLS
    // =========================================
    console.log('  - Seeding running bills...');
    db.exec(`
        INSERT INTO running_bills (bill_id, medicine_name, quantity, unit_price, total_amount, gst_rate, hsn_code, notes, user_id, status) VALUES
        (1, 'Paracetamol 500mg Generic', 20, 15.00, 300.00, 12, '3004', 'Out of stock item', 1, 'PENDING'),
        (2, 'Vitamin B Complex', 30, 8.00, 240.00, 0, '3004', 'Generic substitute given', 1, 'PENDING')
    `);

    // =========================================
    // CREDIT TRANSACTIONS
    // =========================================
    console.log('  - Seeding credit transactions...');
    db.exec(`
        INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, notes, user_id) VALUES
        (1, 1, 'SALE', 256.00, 1756.00, 'Credit sale', 1),
        (1, NULL, 'PAYMENT', 256.00, 1500.00, 'Cash payment received', 1),
        (3, 3, 'SALE', 500.00, 3000.00, 'Credit sale', 1)
    `);

    // Mark migration done
    db.exec(`INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`);

    console.log('');
    console.log('========================================');
    console.log('Database seeded successfully!');
    console.log('========================================');
    console.log('');
    console.log('Seeded data:');
    console.log('  - 2 Suppliers');
    console.log('  - 10 Medicines (8 regular, 2 scheduled drugs)');
    console.log('  - 10 Batches with tablet-based quantities:');
    console.log('      * Normal stock: Dolo (60 strips), Pan (50 strips)');
    console.log('      * Expiring soon: Crocin (25 days), Combiflam (10 days)');
    console.log('      * Expired: Zincovit');
    console.log('      * Non-moving (60+ days): Shelcal, Allegra, Tramadol, Zincovit');
    console.log('      * Schedule H drugs: Alprazolam, Tramadol');
    console.log('  - 5 Customers (3 with credit balances)');
    console.log('  - 3 Sample bills with 7 items');
    console.log('  - 2 Running bills (pending reconciliation)');
    console.log('  - 1 Scheduled medicine record');
    console.log('  - 3 Credit transactions');
    console.log('');
    console.log('Stock storage: TABLETS (strips are derived for display)');
    console.log('Prices: Per STRIP (converted to per-tablet at billing time)');
    console.log('Low stock: Based on strips (tablets / tablets_per_strip)');
    console.log('========================================');

}

// =====================================================
// MAIN
// =====================================================
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('');
    console.log('MedBill Database Management');
    console.log('===========================');
    console.log('');
    console.log('Usage: npm run db:<command>');
    console.log('');
    console.log('Commands:');
    console.log('  npm run db:seed     Seed database with sample data');
    console.log('  npm run db:clear    Clear all data from database');
    console.log('  npm run db:reset    Clear and reseed (full reset)');
    console.log('');
    console.log('Or directly:');
    console.log('  node scripts/db-seed.mjs --seed');
    console.log('  node scripts/db-seed.mjs --clear');
    console.log('  node scripts/db-seed.mjs --reset');
    console.log('');
    process.exit(0);
}

try {
    createTables();
    
    const isReset = args.includes('--reset');
    
    if (args.includes('--clear') || isReset) {
        clearDatabase();
    }
    
    if (args.includes('--seed') || isReset) {
        // Skip data check if we just cleared (reset mode)
        seedDatabase(isReset);
    }
    
    if (!args.includes('--clear') && !args.includes('--seed') && !isReset) {
        console.log('');
        console.log('No action specified. Use one of:');
        console.log('  npm run db:seed   - Seed with sample data');
        console.log('  npm run db:clear  - Clear all data');
        console.log('  npm run db:reset  - Full reset (clear + seed)');
        console.log('');
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
} finally {
    db.close();
}
