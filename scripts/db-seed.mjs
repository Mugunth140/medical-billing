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

// Database path - same as Tauri uses
// Windows uses AppData/Roaming (appConfigDir), Linux/Mac use .config
const DATA_DIR = process.platform === 'win32'
    ? join(homedir(), 'AppData/Roaming/com.velanmedicals.app')
    : join(homedir(), '.config/com.velanmedicals.app');
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
            doctor_prescription TEXT,
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
    } catch (e) { }

    // Reset auto-increment
    try {
        db.exec('DELETE FROM sqlite_sequence');
    } catch (e) { }

    // Mark tablets migration as done
    try {
        db.exec(`INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`);
    } catch (e) { }

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
    // 6 SUPPLIERS
    // =========================================
    console.log('  - Seeding suppliers...');
    db.exec(`
        INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
        ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street, Vadapalani', 'Chennai', 'Tamil Nadu', 30),
        ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane, Guindy', 'Chennai', 'Tamil Nadu', 45),
        ('HealthPlus Distributors', 'Venkat Raman', '9876543212', 'venkat@healthplus.com', '33AABCU9603R3ZO', '789 Health Avenue, T Nagar', 'Chennai', 'Tamil Nadu', 30),
        ('Lifeline Pharma', 'Anitha Krishnan', '9876543213', 'anitha@lifelinepharma.com', '33AABCU9603R4ZP', '101 Lifeline Road, Adyar', 'Chennai', 'Tamil Nadu', 60),
        ('MedSupply India', 'Karthik Subramanian', '9876543214', 'karthik@medsupply.in', '33AABCU9603R5ZQ', '202 Supply Street, Anna Nagar', 'Chennai', 'Tamil Nadu', 15),
        ('PharmaWorld', 'Deepa Murthy', '9876543215', 'deepa@pharmaworld.com', '33AABCU9603R6ZR', '303 World Plaza, Nungambakkam', 'Chennai', 'Tamil Nadu', 45)
    `);

    // =========================================
    // 25 MEDICINES (Various categories for comprehensive testing)
    // Note: gst_rate and is_schedule are on batches table, not medicines
    // =========================================
    console.log('  - Seeding 25 medicines...');
    db.exec(`
        INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, category, unit, reorder_level) VALUES
        ('Dolo 650', 'Paracetamol 650mg', 'Micro Labs', '3004', 'Analgesic', 'STRIP', 50),
        ('Azithral 500', 'Azithromycin 500mg', 'Alembic Pharma', '3004', 'Antibiotic', 'STRIP', 30),
        ('Pan 40', 'Pantoprazole 40mg', 'Alkem Labs', '3004', 'Antacid', 'STRIP', 40),
        ('Crocin Advance', 'Paracetamol 500mg', 'GSK', '3004', 'Analgesic', 'STRIP', 60),
        ('Shelcal 500', 'Calcium + Vitamin D3', 'Torrent Pharma', '3004', 'Supplement', 'STRIP', 20),
        ('Allegra 120', 'Fexofenadine 120mg', 'Sanofi', '3004', 'Antiallergic', 'STRIP', 25),
        ('Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', '3004', 'Analgesic', 'STRIP', 40),
        ('Alprazolam 0.5', 'Alprazolam 0.5mg', 'Sun Pharma', '3004', 'Anxiolytic', 'STRIP', 20),
        ('Tramadol 50', 'Tramadol HCl 50mg', 'Cipla', '3004', 'Analgesic', 'STRIP', 15),
        ('Zincovit', 'Multivitamin + Zinc', 'Apex Labs', '3004', 'Supplement', 'BOTTLE', 30),
        ('Augmentin 625', 'Amoxicillin + Clavulanic Acid', 'GSK', '3004', 'Antibiotic', 'STRIP', 25),
        ('Metformin 500', 'Metformin HCl 500mg', 'Sun Pharma', '3004', 'Antidiabetic', 'STRIP', 100),
        ('Atenolol 50', 'Atenolol 50mg', 'Cipla', '3004', 'Cardiac', 'STRIP', 50),
        ('Amlodipine 5', 'Amlodipine 5mg', 'Lupin', '3004', 'Cardiac', 'STRIP', 60),
        ('Omeprazole 20', 'Omeprazole 20mg', 'Dr Reddys', '3004', 'Antacid', 'STRIP', 40),
        ('Cetirizine 10', 'Cetirizine 10mg', 'Mankind', '3004', 'Antiallergic', 'STRIP', 50),
        ('Montelukast 10', 'Montelukast 10mg', 'Sun Pharma', '3004', 'Respiratory', 'STRIP', 30),
        ('Losartan 50', 'Losartan 50mg', 'Torrent Pharma', '3004', 'Cardiac', 'STRIP', 40),
        ('Aspirin 75', 'Aspirin 75mg', 'USV', '3004', 'Cardiac', 'STRIP', 80),
        ('B Complex Forte', 'Vitamin B Complex', 'Abbott', '3004', 'Supplement', 'STRIP', 40),
        ('Diazepam 5', 'Diazepam 5mg', 'Ranbaxy', '3004', 'Anxiolytic', 'STRIP', 15),
        ('Codeine 15', 'Codeine Phosphate 15mg', 'Wockhardt', '3004', 'Analgesic', 'STRIP', 10),
        ('Ranitidine 150', 'Ranitidine 150mg', 'Intas', '3004', 'Antacid', 'STRIP', 30),
        ('Amoxicillin 500', 'Amoxicillin 500mg', 'Cipla', '3004', 'Antibiotic', 'STRIP', 35),
        ('Cough Syrup', 'Dextromethorphan + Guaifenesin', 'Himalaya', '3004', 'Respiratory', 'BOTTLE', 25)
    `);

    // =========================================
    // 30 BATCHES (quantity in TABLETS) - Comprehensive scenarios
    // =========================================
    console.log('  - Seeding batches (quantity in tablets)...');

    // Dates for non-moving items (created 60+ days ago)
    const oldCreatedDate = formatDate(subDays(60));
    const recentSaleDate = formatDate(subDays(3));

    db.exec(`
        INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box, last_sold_date, created_at, supplier_id) VALUES
        (1, 'DL24001', '${expiry1Year}', 25.00, 35.00, 32.00, 'INCLUSIVE', 600, 10, 'A1', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (1, 'DL24002', '${expiry6Months}', 26.00, 35.00, 33.00, 'INCLUSIVE', 300, 10, 'A1', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 2),
        (2, 'AZ24001', '${expiry6Months}', 80.00, 120.00, 115.00, 'INCLUSIVE', 180, 6, 'A2', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (3, 'PN24001', '${expiry1Year}', 45.00, 65.00, 60.00, 'INCLUSIVE', 500, 10, 'A3', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 3),
        (4, 'CR24001', '${expiry25Days}', 20.00, 30.00, 28.00, 'INCLUSIVE', 150, 15, 'A4', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (5, 'SH24001', '${expiry1Year}', 150.00, 210.00, 200.00, 'INCLUSIVE', 225, 15, 'B1', '2', NULL, '${oldCreatedDate}', 4),
        (6, 'AL24001', '${expiry6Months}', 55.00, 85.00, 80.00, 'INCLUSIVE', 200, 10, 'B2', '2', NULL, '${oldCreatedDate}', 2),
        (7, 'CF24001', '${expiry10Days}', 35.00, 50.00, 48.00, 'INCLUSIVE', 80, 10, 'B3', '2', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (8, 'AP24001', '${expiry1Year}', 25.00, 45.00, 42.00, 'INCLUSIVE', 100, 10, 'C1', '3', '${recentSaleDate}', CURRENT_TIMESTAMP, 5),
        (9, 'TR24001', '${expiry6Months}', 30.00, 55.00, 50.00, 'INCLUSIVE', 60, 10, 'C2', '3', NULL, '${oldCreatedDate}', 5),
        (10, 'ZN24001', '${expired}', 85.00, 130.00, 125.00, 'INCLUSIVE', 25, 1, 'C3', '3', NULL, '${oldCreatedDate}', 3),
        (11, 'AG24001', '${expiry1Year}', 120.00, 180.00, 170.00, 'INCLUSIVE', 240, 6, 'D1', '4', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (12, 'MF24001', '${expiry1Year}', 15.00, 25.00, 22.00, 'INCLUSIVE', 1000, 10, 'D2', '4', '${recentSaleDate}', CURRENT_TIMESTAMP, 2),
        (13, 'AT24001', '${expiry1Year}', 20.00, 35.00, 32.00, 'INCLUSIVE', 500, 14, 'D3', '4', '${recentSaleDate}', CURRENT_TIMESTAMP, 3),
        (14, 'AM24001', '${expiry6Months}', 18.00, 30.00, 28.00, 'INCLUSIVE', 600, 10, 'E1', '5', NULL, '${oldCreatedDate}', 4),
        (15, 'OM24001', '${expiry1Year}', 25.00, 40.00, 38.00, 'INCLUSIVE', 400, 10, 'E2', '5', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (16, 'CT24001', '${expiry25Days}', 8.00, 15.00, 12.00, 'INCLUSIVE', 300, 10, 'E3', '5', '${recentSaleDate}', CURRENT_TIMESTAMP, 6),
        (17, 'MK24001', '${expiry1Year}', 45.00, 70.00, 65.00, 'INCLUSIVE', 200, 10, 'F1', '6', '${recentSaleDate}', CURRENT_TIMESTAMP, 2),
        (18, 'LS24001', '${expiry6Months}', 30.00, 50.00, 45.00, 'INCLUSIVE', 280, 10, 'F2', '6', NULL, '${oldCreatedDate}', 3),
        (19, 'AS24001', '${expiry1Year}', 10.00, 18.00, 15.00, 'INCLUSIVE', 800, 14, 'F3', '6', '${recentSaleDate}', CURRENT_TIMESTAMP, 4),
        (20, 'BC24001', '${expiry1Year}', 35.00, 55.00, 50.00, 'INCLUSIVE', 400, 15, 'G1', '7', '${recentSaleDate}', CURRENT_TIMESTAMP, 5),
        (21, 'DZ24001', '${expiry1Year}', 20.00, 40.00, 35.00, 'INCLUSIVE', 50, 10, 'G2', '7', NULL, '${oldCreatedDate}', 5),
        (22, 'CD24001', '${expiry6Months}', 35.00, 60.00, 55.00, 'INCLUSIVE', 30, 10, 'G3', '7', NULL, '${oldCreatedDate}', 6),
        (23, 'RN24001', '${expiry10Days}', 22.00, 38.00, 35.00, 'INCLUSIVE', 200, 10, 'H1', '8', '${recentSaleDate}', CURRENT_TIMESTAMP, 1),
        (24, 'AX24001', '${expiry1Year}', 40.00, 65.00, 60.00, 'INCLUSIVE', 350, 10, 'H2', '8', '${recentSaleDate}', CURRENT_TIMESTAMP, 2),
        (25, 'CS24001', '${expiry6Months}', 50.00, 85.00, 80.00, 'INCLUSIVE', 45, 1, 'H3', '8', NULL, '${oldCreatedDate}', 3),
        (1, 'DL24003', '${expired}', 24.00, 35.00, 32.00, 'INCLUSIVE', 50, 10, 'A1', '1', NULL, '${oldCreatedDate}', 4),
        (3, 'PN24002', '${expiry25Days}', 46.00, 65.00, 60.00, 'INCLUSIVE', 100, 10, 'A3', '1', '${recentSaleDate}', CURRENT_TIMESTAMP, 5),
        (12, 'MF24002', '${expiry6Months}', 16.00, 25.00, 23.00, 'INCLUSIVE', 500, 10, 'D2', '4', NULL, '${oldCreatedDate}', 6),
        (19, 'AS24002', '${expired}', 9.00, 18.00, 15.00, 'INCLUSIVE', 100, 14, 'F3', '6', NULL, '${oldCreatedDate}', 1)
    `);

    // =========================================
    // 12 CUSTOMERS
    // =========================================
    console.log('  - Seeding customers...');
    db.exec(`
        INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES
        ('Ramesh Kumar', '9876543220', 'ramesh@email.com', '12 Gandhi Street, Chennai', 5000, 1500),
        ('Lakshmi Devi', '9876543221', 'lakshmi@email.com', '34 Nehru Road, Chennai', 3000, 0),
        ('Suresh Babu', '9876543222', 'suresh@email.com', '56 Anna Nagar, Chennai', 10000, 2500),
        ('Kavitha Rajan', '9876543223', 'kavitha@email.com', '78 T Nagar, Chennai', 2000, 800),
        ('Walk-in Customer', '9876543224', '', 'Walk-in', 0, 0),
        ('Vijay Anand', '9876543225', 'vijay.anand@email.com', '90 Adyar, Chennai', 8000, 3200),
        ('Meena Sundaram', '9876543226', 'meena@email.com', '11 Velachery, Chennai', 4000, 0),
        ('Prakash Rao', '9876543227', 'prakash.rao@email.com', '22 Mylapore, Chennai', 15000, 5000),
        ('Sangeetha Pillai', '9876543228', 'sangeetha@email.com', '33 Guindy, Chennai', 6000, 1800),
        ('Arjun Menon', '9876543229', 'arjun.menon@email.com', '44 Nungambakkam, Chennai', 7500, 0),
        ('Divya Krishnan', '9876543230', 'divya.k@email.com', '55 Besant Nagar, Chennai', 5500, 2200),
        ('Mohan Raj', '9876543231', 'mohan.raj@email.com', '66 Kodambakkam, Chennai', 12000, 4500)
    `);

    // =========================================
    // 10 SAMPLE BILLS (All payment modes)
    // =========================================
    console.log('  - Seeding sample bills...');
    const billDate4 = formatDate(subDays(10));
    const billDate5 = formatDate(subDays(8));
    const billDate6 = formatDate(subDays(7));
    const billDate7 = formatDate(subDays(4));

    db.exec(`UPDATE bill_sequence SET current_number = 10`);
    db.exec(`
        INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, doctor_name, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_mode, cash_amount, online_amount, credit_amount, is_cancelled, total_items) VALUES
        ('INV-2425-00001', '${billDate4}', 1, 'Ramesh Kumar', 'Dr. Venkat', 1, 256.00, 228.57, 13.71, 13.71, 27.43, 256.00, 'CASH', 256.00, 0, 0, 0, 2),
        ('INV-2425-00002', '${billDate5}', 2, 'Lakshmi Devi', 'Dr. Priya', 1, 345.00, 308.04, 18.48, 18.48, 36.96, 345.00, 'ONLINE', 0, 345.00, 0, 0, 3),
        ('INV-2425-00003', '${billDate6}', 3, 'Suresh Babu', 'Dr. Kumar', 1, 500.00, 446.43, 26.79, 26.79, 53.57, 500.00, 'CREDIT', 0, 0, 500.00, 0, 2),
        ('INV-2425-00004', '${billDate1}', 6, 'Vijay Anand', 'Dr. Sharma', 1, 420.00, 375.00, 22.50, 22.50, 45.00, 420.00, 'SPLIT', 200.00, 220.00, 0, 0, 3),
        ('INV-2425-00005', '${billDate1}', 8, 'Prakash Rao', 'Dr. Menon', 1, 680.00, 607.14, 36.43, 36.43, 72.86, 680.00, 'CREDIT', 0, 0, 680.00, 0, 4),
        ('INV-2425-00006', '${billDate2}', 5, 'Walk-in Customer', NULL, 1, 150.00, 133.93, 8.04, 8.04, 16.07, 150.00, 'CASH', 150.00, 0, 0, 0, 2),
        ('INV-2425-00007', '${billDate2}', 9, 'Sangeetha Pillai', 'Dr. Rao', 1, 890.00, 794.64, 47.68, 47.68, 95.36, 890.00, 'ONLINE', 0, 890.00, 0, 0, 5),
        ('INV-2425-00008', '${billDate3}', 11, 'Divya Krishnan', 'Dr. Lakshmi', 1, 320.00, 285.71, 17.14, 17.14, 34.29, 320.00, 'CASH', 320.00, 0, 0, 0, 2),
        ('INV-2425-00009', '${billDate3}', 12, 'Mohan Raj', 'Dr. Rajan', 1, 1250.00, 1116.07, 66.96, 66.96, 133.93, 1250.00, 'SPLIT', 500.00, 0, 750.00, 0, 6),
        ('INV-2425-00010', '${billDate7}', 4, 'Kavitha Rajan', 'Dr. Anand', 1, 175.00, 156.25, 9.38, 9.38, 18.75, 175.00, 'CASH', 175.00, 0, 0, 1, 1)
    `);

    // =========================================
    // BILL ITEMS (20+ items across all bills)
    // =========================================
    console.log('  - Seeding bill items...');
    db.exec(`
        INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, quantity_strips, quantity_pieces, tablets_per_strip, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit) VALUES
        (1, 1, 1, 'Dolo 650', '3004', 'DL24001', 20, 2, 0, 10, 32.00, 57.14, 12, 3.43, 3.43, 64.00, 35.00, 'STRIP'),
        (1, 4, 3, 'Pan 40', '3004', 'PN24001', 30, 3, 0, 10, 60.00, 160.71, 12, 9.64, 9.64, 180.00, 65.00, 'STRIP'),
        (2, 3, 2, 'Azithral 500', '3004', 'AZ24001', 6, 1, 0, 6, 115.00, 102.68, 12, 6.16, 6.16, 115.00, 120.00, 'STRIP'),
        (2, 7, 6, 'Allegra 120', '3004', 'AL24001', 10, 1, 0, 10, 80.00, 71.43, 12, 4.29, 4.29, 80.00, 85.00, 'STRIP'),
        (2, 6, 5, 'Shelcal 500', '3004', 'SH24001', 15, 1, 0, 15, 200.00, 133.33, 0, 0, 0, 150.00, 210.00, 'STRIP'),
        (3, 8, 7, 'Combiflam', '3004', 'CF24001', 20, 2, 0, 10, 48.00, 85.71, 12, 5.14, 5.14, 96.00, 50.00, 'STRIP'),
        (3, 9, 8, 'Alprazolam 0.5', '3004', 'AP24001', 10, 1, 0, 10, 42.00, 375.00, 12, 22.50, 22.50, 420.00, 45.00, 'STRIP'),
        (4, 12, 11, 'Augmentin 625', '3004', 'AG24001', 6, 1, 0, 6, 170.00, 151.79, 12, 9.11, 9.11, 170.00, 180.00, 'STRIP'),
        (4, 13, 12, 'Metformin 500', '3004', 'MF24001', 30, 3, 0, 10, 22.00, 58.93, 12, 3.54, 3.54, 66.00, 25.00, 'STRIP'),
        (4, 16, 15, 'Omeprazole 20', '3004', 'OM24001', 20, 2, 0, 10, 38.00, 67.86, 12, 4.07, 4.07, 76.00, 40.00, 'STRIP'),
        (5, 14, 13, 'Atenolol 50', '3004', 'AT24001', 28, 2, 0, 14, 32.00, 57.14, 12, 3.43, 3.43, 64.00, 35.00, 'STRIP'),
        (5, 15, 14, 'Amlodipine 5', '3004', 'AM24001', 30, 3, 0, 10, 28.00, 75.00, 12, 4.50, 4.50, 84.00, 30.00, 'STRIP'),
        (5, 18, 17, 'Montelukast 10', '3004', 'MK24001', 20, 2, 0, 10, 65.00, 116.07, 12, 6.96, 6.96, 130.00, 70.00, 'STRIP'),
        (5, 19, 18, 'Losartan 50', '3004', 'LS24001', 30, 3, 0, 10, 45.00, 120.54, 12, 7.23, 7.23, 135.00, 50.00, 'STRIP'),
        (6, 1, 1, 'Dolo 650', '3004', 'DL24001', 10, 1, 0, 10, 32.00, 28.57, 12, 1.71, 1.71, 32.00, 35.00, 'STRIP'),
        (6, 17, 16, 'Cetirizine 10', '3004', 'CT24001', 10, 1, 0, 10, 12.00, 10.71, 12, 0.64, 0.64, 12.00, 15.00, 'STRIP'),
        (7, 20, 19, 'Aspirin 75', '3004', 'AS24001', 28, 2, 0, 14, 15.00, 26.79, 12, 1.61, 1.61, 30.00, 18.00, 'STRIP'),
        (7, 21, 20, 'B Complex Forte', '3004', 'BC24001', 30, 2, 0, 15, 50.00, 89.29, 0, 0, 0, 100.00, 55.00, 'STRIP'),
        (7, 10, 9, 'Tramadol 50', '3004', 'TR24001', 10, 1, 0, 10, 50.00, 44.64, 12, 2.68, 2.68, 50.00, 55.00, 'STRIP'),
        (7, 22, 21, 'Diazepam 5', '3004', 'DZ24001', 10, 1, 0, 10, 35.00, 31.25, 12, 1.88, 1.88, 35.00, 40.00, 'STRIP'),
        (7, 24, 23, 'Ranitidine 150', '3004', 'RN24001', 20, 2, 0, 10, 35.00, 62.50, 12, 3.75, 3.75, 70.00, 38.00, 'STRIP'),
        (8, 2, 1, 'Dolo 650', '3004', 'DL24002', 20, 2, 0, 10, 33.00, 58.93, 12, 3.54, 3.54, 66.00, 35.00, 'STRIP'),
        (8, 25, 24, 'Amoxicillin 500', '3004', 'AX24001', 20, 2, 0, 10, 60.00, 107.14, 12, 6.43, 6.43, 120.00, 65.00, 'STRIP'),
        (9, 4, 3, 'Pan 40', '3004', 'PN24001', 50, 5, 0, 10, 60.00, 267.86, 12, 16.07, 16.07, 300.00, 65.00, 'STRIP'),
        (9, 13, 12, 'Metformin 500', '3004', 'MF24001', 100, 10, 0, 10, 22.00, 196.43, 12, 11.79, 11.79, 220.00, 25.00, 'STRIP'),
        (9, 14, 13, 'Atenolol 50', '3004', 'AT24001', 56, 4, 0, 14, 32.00, 114.29, 12, 6.86, 6.86, 128.00, 35.00, 'STRIP'),
        (9, 15, 14, 'Amlodipine 5', '3004', 'AM24001', 60, 6, 0, 10, 28.00, 150.00, 12, 9.00, 9.00, 168.00, 30.00, 'STRIP'),
        (9, 19, 18, 'Losartan 50', '3004', 'LS24001', 60, 6, 0, 10, 45.00, 241.07, 12, 14.46, 14.46, 270.00, 50.00, 'STRIP'),
        (9, 20, 19, 'Aspirin 75', '3004', 'AS24001', 56, 4, 0, 14, 15.00, 53.57, 12, 3.21, 3.21, 60.00, 18.00, 'STRIP'),
        (10, 5, 4, 'Crocin Advance', '3004', 'CR24001', 30, 2, 0, 15, 28.00, 50.00, 12, 3.00, 3.00, 56.00, 30.00, 'STRIP')
    `);

    // =========================================
    // SCHEDULED MEDICINE RECORDS (4 records for Schedule H drugs)
    // =========================================
    console.log('  - Seeding scheduled medicine records...');
    db.exec(`
        INSERT INTO scheduled_medicine_records (bill_id, bill_item_id, medicine_id, batch_id, patient_name, patient_age, patient_gender, patient_phone, patient_address, doctor_name, doctor_registration_number, clinic_hospital_name, prescription_number, prescription_date, doctor_prescription, quantity) VALUES
        (3, 7, 8, 9, 'Suresh Babu', 45, 'M', '9876543222', '56 Anna Nagar, Chennai', 'Dr. Ramesh Kumar', 'TN12345', 'Apollo Clinic', 'RX2025001', '${formatDate(subDays(7))}', 'Alprazolam 0.5mg - Take 1 tablet twice daily after meals for anxiety. Duration: 2 weeks.', 10),
        (7, 19, 9, 10, 'Sangeetha Pillai', 38, 'F', '9876543228', '33 Guindy, Chennai', 'Dr. Lakshmi Rao', 'TN23456', 'Fortis Hospital', 'RX2025002', '${formatDate(subDays(2))}', 'Tramadol 50mg - Take 1 tablet thrice daily for pain management.', 10),
        (7, 20, 21, 22, 'Sangeetha Pillai', 38, 'F', '9876543228', '33 Guindy, Chennai', 'Dr. Lakshmi Rao', 'TN23456', 'Fortis Hospital', 'RX2025003', '${formatDate(subDays(2))}', 'Diazepam 5mg - Take 1 tablet at bedtime for insomnia.', 10)
    `);

    // =========================================
    // RUNNING BILLS (5 pending items)
    // =========================================
    console.log('  - Seeding running bills...');
    db.exec(`
        INSERT INTO running_bills (bill_id, medicine_name, quantity, unit_price, total_amount, gst_rate, hsn_code, notes, user_id, status) VALUES
        (1, 'Paracetamol 500mg Generic', 20, 15.00, 300.00, 12, '3004', 'Out of stock item', 1, 'PENDING'),
        (2, 'Vitamin B Complex', 30, 8.00, 240.00, 0, '3004', 'Generic substitute given', 1, 'PENDING'),
        (4, 'Ibuprofen 400mg', 15, 12.00, 180.00, 12, '3004', 'Brand not available', 1, 'PENDING'),
        (6, 'Cough Drops', 10, 5.00, 50.00, 12, '3004', 'Small quantity sold', 1, 'STOCKED'),
        (9, 'Antacid Syrup', 2, 85.00, 170.00, 12, '3004', 'Syrup out of stock', 1, 'PENDING')
    `);

    // =========================================
    // CREDIT TRANSACTIONS (10 transactions)
    // =========================================
    console.log('  - Seeding credit transactions...');
    db.exec(`
        INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, notes, user_id) VALUES
        (1, 1, 'SALE', 256.00, 1756.00, 'Credit sale', 1),
        (1, NULL, 'PAYMENT', 256.00, 1500.00, 'Cash payment received', 1),
        (3, 3, 'SALE', 500.00, 3000.00, 'Credit sale', 1),
        (6, 4, 'SALE', 420.00, 3620.00, 'Split payment - partial credit', 1),
        (6, NULL, 'PAYMENT', 420.00, 3200.00, 'Online payment received', 1),
        (8, 5, 'SALE', 680.00, 5680.00, 'Credit sale - bulk purchase', 1),
        (9, 7, 'SALE', 890.00, 2690.00, 'Online payment sale', 1),
        (9, NULL, 'PAYMENT', 890.00, 1800.00, 'UPI payment received', 1),
        (11, 8, 'SALE', 320.00, 2520.00, 'Cash sale', 1),
        (12, 9, 'SALE', 750.00, 5250.00, 'Split payment - credit portion', 1)
    `);

    // Mark migration done
    db.exec(`INSERT OR REPLACE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`);

    console.log('');
    console.log('========================================');
    console.log('Database seeded successfully!');
    console.log('========================================');
    console.log('');
    console.log('Seeded data:');
    console.log('  - 6 Suppliers');
    console.log('  - 25 Medicines (21 regular, 4 scheduled drugs)');
    console.log('  - 30 Batches with various scenarios:');
    console.log('      * Normal stock, Low stock, Expiring soon, Expired');
    console.log('      * Non-moving items, Multiple batches per medicine');
    console.log('  - 12 Customers (8 with credit balances)');
    console.log('  - 10 Sample bills with 30 items');
    console.log('  - 5 Running bills (4 pending, 1 stocked)');
    console.log('  - 3 Scheduled medicine records');
    console.log('  - 10 Credit transactions');
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
