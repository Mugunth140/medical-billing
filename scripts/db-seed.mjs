#!/usr/bin/env node
// =====================================================
// Database Seed Script (Standalone)
// Run with: npm run db:seed or npm run db:clear
// =====================================================

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Database path - same as Tauri uses (in .config, not .local/share)
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
            gstin TEXT,
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
            user_id INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            is_cancelled INTEGER DEFAULT 0,
            total_items INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            batch_id INTEGER NOT NULL REFERENCES batches(id),
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            medicine_name TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            hsn_code TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            quantity_strips INTEGER DEFAULT 0,
            quantity_pieces INTEGER DEFAULT 0,
            tablets_per_strip INTEGER DEFAULT 10,
            unit TEXT NOT NULL DEFAULT 'PCS',
            mrp DECIMAL(10,2) NOT NULL,
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
        `CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER REFERENCES suppliers(id),
            invoice_number TEXT NOT NULL,
            invoice_date DATE NOT NULL,
            subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
            discount_amount DECIMAL(12,2) DEFAULT 0,
            taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            cgst_amount DECIMAL(12,2) DEFAULT 0,
            sgst_amount DECIMAL(12,2) DEFAULT 0,
            igst_amount DECIMAL(12,2) DEFAULT 0,
            total_gst DECIMAL(12,2) DEFAULT 0,
            grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
            payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PAID', 'PARTIAL', 'PENDING')),
            paid_amount DECIMAL(12,2) DEFAULT 0,
            notes TEXT,
            user_id INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id),
            batch_id INTEGER REFERENCES batches(id),
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            medicine_name TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            expiry_date DATE NOT NULL,
            quantity INTEGER NOT NULL,
            free_quantity INTEGER DEFAULT 0,
            pack_size INTEGER DEFAULT 1,
            purchase_price DECIMAL(10,2) NOT NULL,
            mrp DECIMAL(10,2) NOT NULL,
            discount_percent DECIMAL(5,2) DEFAULT 0,
            gst_rate DECIMAL(5,2) NOT NULL,
            cgst_amount DECIMAL(10,2) DEFAULT 0,
            sgst_amount DECIMAL(10,2) DEFAULT 0,
            total_amount DECIMAL(12,2) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS credits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            bill_id INTEGER REFERENCES bills(id),
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CREDIT', 'PAYMENT', 'SALE', 'ADJUSTMENT')),
            amount DECIMAL(12,2) NOT NULL,
            balance_after DECIMAL(12,2) NOT NULL,
            payment_mode TEXT CHECK (payment_mode IN ('CASH', 'ONLINE', 'ADJUSTMENT')),
            reference_number TEXT,
            notes TEXT,
            user_id INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bill_sequence (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            prefix TEXT NOT NULL DEFAULT 'INV',
            current_number INTEGER NOT NULL DEFAULT 0,
            financial_year TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS scheduled_medicine_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            bill_item_id INTEGER NOT NULL REFERENCES bill_items(id),
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            batch_id INTEGER NOT NULL REFERENCES batches(id),
            patient_name TEXT NOT NULL,
            patient_age INTEGER,
            patient_gender TEXT CHECK (patient_gender IN ('M', 'F', 'O')),
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
        `CREATE TABLE IF NOT EXISTS running_bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id),
            bill_item_id INTEGER REFERENCES bill_items(id),
            medicine_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            gst_rate DECIMAL(5,2) DEFAULT 0,
            hsn_code TEXT DEFAULT '3004',
            notes TEXT,
            user_id INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'STOCKED', 'CANCELLED')),
            linked_batch_id INTEGER REFERENCES batches(id),
            linked_medicine_id INTEGER REFERENCES medicines(id),
            stocked_at DATETIME,
            stocked_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];
    
    for (const sql of tables) {
        db.exec(sql);
    }
    
    // Insert default data
    try {
        db.exec(`INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (1, 'admin', 'admin123', 'Administrator', 'admin')`);
        db.exec(`INSERT OR IGNORE INTO bill_sequence (id, prefix, current_number, financial_year) VALUES (1, 'INV', 0, '2024-25')`);
        db.exec(`INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_name', 'Medical Store', 'shop', 'Shop name for bills')`);
        db.exec(`INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity stored in tablets')`);
    } catch (e) {
        // Ignore duplicates
    }
    
    console.log('Tables created successfully!');
}

// =====================================================
// CLEAR DATABASE
// =====================================================
function clearDatabase() {
    console.log('Clearing database...');
    
    const tables = [
        'running_bills',
        'credits',
        'scheduled_medicine_records',
        'bill_items',
        'bills',
        'purchase_items',
        'purchases',
        'batches',
        'medicines',
        'customers',
        'suppliers',
        'audit_log'
    ];
    
    // Disable foreign keys temporarily
    db.pragma('foreign_keys = OFF');
    
    for (const table of tables) {
        try {
            db.exec(`DELETE FROM ${table}`);
            console.log(`  Cleared ${table}`);
        } catch (e) {
            console.log(`  Skipped ${table} (${e.message})`);
        }
    }
    
    // Reset sequences
    try {
        db.exec('DELETE FROM sqlite_sequence');
        console.log('  Reset auto-increment counters');
    } catch (e) {
        // Ignore
    }
    
    try {
        db.exec('UPDATE bill_sequence SET current_number = 0');
    } catch (e) {
        // Ignore
    }
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log('Database cleared!');
}

// =====================================================
// SEED DATABASE
// =====================================================
function seedDatabase() {
    console.log('Starting database seeding...');
    
    // Check if already seeded
    const count = db.prepare('SELECT COUNT(*) as count FROM medicines').get();
    if (count.count > 0) {
        console.log('Database already has data. Run with --clear first.');
        return;
    }
    
    const chunkSize = 20;
    
    // =========================================
    // SUPPLIERS (45)
    // =========================================
    console.log('Seeding suppliers...');
    db.exec(`
        INSERT INTO suppliers (name, contact_person, phone, email, gstin, address, city, state, payment_terms) VALUES
        ('ABC Pharma Distributors', 'Rajesh Kumar', '9876543210', 'rajesh@abcpharma.com', '33AABCU9603R1ZM', '123 Pharma Street, Vadapalani', 'Chennai', 'Tamil Nadu', 30),
        ('MediCare Wholesale', 'Priya Sharma', '9876543211', 'priya@medicare.in', '33AABCU9603R2ZN', '456 Medical Lane, Guindy', 'Chennai', 'Tamil Nadu', 45),
        ('HealthFirst Supplies', 'Arun Kumar', '9876543212', 'arun@healthfirst.com', '33AABCU9603R3ZO', '789 Health Road', 'Coimbatore', 'Tamil Nadu', 30),
        ('Pharma Traders', 'Suresh B', '9876543213', 'suresh@pharmatraders.com', '33AABCU9603R4ZP', '321 Trade Complex', 'Madurai', 'Tamil Nadu', 60),
        ('Medical Hub', 'Kavitha R', '9876543214', 'kavitha@medhub.in', '33AABCU9603R5ZQ', '654 Hub Plaza', 'Chennai', 'Tamil Nadu', 30),
        ('Apollo Medicals', 'Ramesh S', '9876543215', 'ramesh@apollo.com', '33AABCU9603R6ZR', '100 Apollo Street', 'Chennai', 'Tamil Nadu', 30),
        ('Star Pharmaceuticals', 'Divya M', '9876543216', 'divya@starpharma.com', '33AABCU9603R7ZS', '200 Star Complex', 'Trichy', 'Tamil Nadu', 45),
        ('Global MediLink', 'Vijay K', '9876543217', 'vijay@globalmedi.com', '33AABCU9603R8ZT', '300 Global Tower', 'Salem', 'Tamil Nadu', 30),
        ('City Pharma Supplies', 'Anitha P', '9876543218', 'anitha@citypharma.com', '33AABCU9603R9ZU', '400 City Center', 'Chennai', 'Tamil Nadu', 60),
        ('Prime Medical Traders', 'Kumar R', '9876543219', 'kumar@primetraders.com', '33AABCU9603RAZV', '500 Prime Plaza', 'Chennai', 'Tamil Nadu', 30)
    `);
    
    // =========================================
    // MEDICINES (61)
    // =========================================
    console.log('Seeding medicines...');
    db.exec(`
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
        ('Livogen', 'Iron + Folic Acid', 'Merck', '3004', 0, 'Supplement', 'STRIP', 35),
        ('Rantac 150', 'Ranitidine 150mg', 'J B Chemicals', '3004', 12, 'Antacid', 'STRIP', 45),
        ('Ciprofloxacin 500', 'Ciprofloxacin 500mg', 'Cipla', '3004', 12, 'Antibiotic', 'STRIP', 30),
        ('Metrogyl 400', 'Metronidazole 400mg', 'J B Chemicals', '3004', 12, 'Antibiotic', 'STRIP', 35),
        ('Avil 25', 'Pheniramine 25mg', 'Sanofi', '3004', 12, 'Antiallergic', 'STRIP', 40),
        ('Brufen 400', 'Ibuprofen 400mg', 'Abbott', '3004', 12, 'Analgesic', 'STRIP', 50),
        ('Calpol 500', 'Paracetamol 500mg', 'GSK', '3004', 12, 'Analgesic', 'STRIP', 60),
        ('Disprin', 'Aspirin 350mg', 'Reckitt Benckiser', '3004', 12, 'Analgesic', 'STRIP', 55),
        ('Sinarest', 'Paracetamol + Phenylephrine', 'Centaur Pharma', '3004', 12, 'Cold & Cough', 'STRIP', 45),
        ('Mucinac 600', 'Acetylcysteine 600mg', 'Cipla', '3004', 12, 'Expectorant', 'STRIP', 30),
        ('Cheston Cold', 'Paracetamol + CPM', 'Cipla', '3004', 12, 'Cold & Cough', 'STRIP', 40)
    `);
    
    // Add scheduled (H1) medicines separately
    console.log('Seeding scheduled (H1) medicines...');
    db.exec(`
        INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, category, unit, reorder_level, is_schedule) VALUES
        ('Alprazolam 0.5mg', 'Alprazolam 0.5mg', 'Sun Pharma', '3004', 12, 'Anxiolytic', 'STRIP', 20, 1),
        ('Clonazepam 0.5mg', 'Clonazepam 0.5mg', 'Sun Pharma', '3004', 12, 'Anticonvulsant', 'STRIP', 15, 1),
        ('Diazepam 5mg', 'Diazepam 5mg', 'Ranbaxy', '3004', 12, 'Anxiolytic', 'STRIP', 20, 1),
        ('Tramadol 50mg', 'Tramadol HCL 50mg', 'Intas Pharma', '3004', 12, 'Analgesic', 'STRIP', 25, 1),
        ('Codeine Phosphate 15mg', 'Codeine Phosphate', 'Lupin', '3004', 12, 'Antitussive', 'STRIP', 10, 1),
        ('Phenobarbitone 30mg', 'Phenobarbital 30mg', 'Abbott', '3004', 12, 'Anticonvulsant', 'STRIP', 15, 1),
        ('Lorazepam 2mg', 'Lorazepam 2mg', 'Torrent Pharma', '3004', 12, 'Anxiolytic', 'STRIP', 10, 1),
        ('Nitrazepam 5mg', 'Nitrazepam 5mg', 'Sun Pharma', '3004', 12, 'Sedative', 'STRIP', 15, 1),
        ('Zolpidem 10mg', 'Zolpidem Tartrate 10mg', 'Intas Pharma', '3004', 12, 'Hypnotic', 'STRIP', 20, 1),
        ('Morphine Sulfate 10mg', 'Morphine Sulfate 10mg', 'Sun Pharma', '3004', 12, 'Opioid Analgesic', 'STRIP', 5, 1)
    `);
    
    // =========================================
    // BATCHES (60 total - 2 per medicine with supplier linking)
    // =========================================
    console.log('Seeding batches...');
    const expiry6Months = formatDate(addDays(180));
    const expiry1Year = formatDate(addDays(365));
    const expiry20Days = formatDate(addDays(20));
    const expiry3Months = formatDate(addDays(90));
    
    const batchInserts = [];
    for (let i = 1; i <= 30; i++) {
        // First batch for each medicine
        const expiry1 = i % 5 === 0 ? expiry20Days : (i % 2 === 0 ? expiry6Months : expiry1Year);
        const rack1 = `${String.fromCharCode(65 + Math.floor((i-1) / 12))}${((i-1) % 12) + 1}`;
        const box1 = String(Math.floor((i-1) / 5) + 1);
        const purchasePrice1 = (15 + i * 5).toFixed(2);
        const mrp1 = (25 + i * 6).toFixed(2);
        const sellingPrice1 = (parseFloat(mrp1) - 2).toFixed(2);
        const quantity1 = (100 + i * 30) * 10;
        const tps1 = [1, 6, 10, 15][(i-1) % 4];
        const supplierId1 = ((i - 1) % 10) + 1; // Link to suppliers 1-10
        
        batchInserts.push(`(${i}, 'BT2024${String(i).padStart(3, '0')}', '${expiry1}', ${purchasePrice1}, ${mrp1}, ${sellingPrice1}, 'INCLUSIVE', ${quantity1}, ${tps1}, '${rack1}', '${box1}', ${supplierId1})`);
        
        // Second batch for each medicine (different supplier, different expiry)
        const expiry2 = i % 3 === 0 ? expiry3Months : expiry1Year;
        const rack2 = `${String.fromCharCode(65 + Math.floor((i-1) / 12))}${((i-1) % 12) + 1}B`;
        const purchasePrice2 = (parseFloat(purchasePrice1) * 0.95).toFixed(2); // Slightly different price
        const mrp2 = mrp1;
        const sellingPrice2 = sellingPrice1;
        const quantity2 = Math.floor(quantity1 * 0.6);
        const tps2 = tps1;
        const supplierId2 = ((i + 4) % 10) + 1; // Different supplier
        
        batchInserts.push(`(${i}, 'BT2025${String(i).padStart(3, '0')}', '${expiry2}', ${purchasePrice2}, ${mrp2}, ${sellingPrice2}, 'INCLUSIVE', ${quantity2}, ${tps2}, '${rack2}', '${box1}', ${supplierId2})`);
    }
    db.exec(`INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box, supplier_id) VALUES ${batchInserts.join(', ')}`);
    
    // Add batches for scheduled medicines (medicine IDs 31-40)
    console.log('Seeding batches for scheduled medicines...');
    const scheduledBatchInserts = [];
    for (let i = 31; i <= 40; i++) {
        const medIndex = i - 30;
        const expiry = expiry1Year;
        const rack = `H${medIndex}`;
        const box = 'SAFE';
        const purchasePrice = (50 + medIndex * 10).toFixed(2);
        const mrp = (80 + medIndex * 15).toFixed(2);
        const sellingPrice = (parseFloat(mrp) - 5).toFixed(2);
        const quantity = 50 + medIndex * 10;
        const tps = 10;
        const supplierId = ((medIndex - 1) % 5) + 1; // Use first 5 suppliers
        
        scheduledBatchInserts.push(`(${i}, 'SCH2024${String(medIndex).padStart(3, '0')}', '${expiry}', ${purchasePrice}, ${mrp}, ${sellingPrice}, 'INCLUSIVE', ${quantity}, ${tps}, '${rack}', '${box}', ${supplierId})`);
    }
    db.exec(`INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price, price_type, quantity, tablets_per_strip, rack, box, supplier_id) VALUES ${scheduledBatchInserts.join(', ')}`);
    
    // =========================================
    // CUSTOMERS (50)
    // =========================================
    console.log('Seeding customers...');
    const customerInserts = [];
    for (let i = 1; i <= 50; i++) {
        const name = `Customer ${i}`;
        const phone = `987654${String(3200 + i).padStart(4, '0')}`;
        const email = `customer${i}@email.com`;
        const address = `${i} Main Street, Chennai`;
        const creditLimit = 5000 + (i * 100);
        const balance = i % 3 === 0 ? (500 + i * 50) : 0;
        customerInserts.push(`('${name}', '${phone}', '${email}', '${address}', ${creditLimit}, ${balance})`);
    }
    db.exec(`INSERT INTO customers (name, phone, email, address, credit_limit, current_balance) VALUES ${customerInserts.join(', ')}`);
    
    // =========================================
    // PURCHASES (50)
    // =========================================
    console.log('Seeding purchases...');
    const purchaseInserts = [];
    for (let i = 1; i <= 50; i++) {
        const supplierId = ((i - 1) % 10) + 1;
        const date = formatDate(subDays(Math.floor(Math.random() * 90) + 1));
        const subtotal = (5000 + i * 300).toFixed(2);
        const cgstAmount = (parseFloat(subtotal) * 0.06).toFixed(2);
        const sgstAmount = cgstAmount;
        const totalGst = (parseFloat(cgstAmount) * 2).toFixed(2);
        const grandTotal = (parseFloat(subtotal) + parseFloat(totalGst)).toFixed(2);
        const paymentStatus = i % 3 === 0 ? 'PAID' : (i % 5 === 0 ? 'PARTIAL' : 'PENDING');
        const paidAmount = paymentStatus === 'PAID' ? grandTotal : (paymentStatus === 'PARTIAL' ? (parseFloat(grandTotal) * 0.6).toFixed(2) : '0.00');
        
        purchaseInserts.push(`('P2024/${String(i).padStart(4, '0')}', '${date}', ${supplierId}, 1, ${subtotal}, ${subtotal}, ${cgstAmount}, ${sgstAmount}, ${totalGst}, ${grandTotal}, '${paymentStatus}', ${paidAmount})`);
    }
    db.exec(`INSERT INTO purchases (invoice_number, invoice_date, supplier_id, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_status, paid_amount) VALUES ${purchaseInserts.join(', ')}`);
    
    // =========================================
    // PURCHASE ITEMS
    // =========================================
    console.log('Seeding purchase items...');
    const purchaseItemInserts = [];
    for (let i = 1; i <= 50; i++) {
        const itemCount = 2 + (i % 3);
        for (let j = 0; j < itemCount; j++) {
            const medicineId = ((i + j - 1) % 30) + 1;
            const medicineName = `Medicine ${medicineId}`;
            const batchNumber = `BT2024${String(medicineId).padStart(3, '0')}`;
            const expiryDate = formatDate(addDays(365));
            const quantity = 50 + (j * 25);
            const purchasePrice = (15 + medicineId * 3).toFixed(2);
            const mrp = (25 + medicineId * 5).toFixed(2);
            const gstRate = [0, 5, 12, 18][(medicineId - 1) % 4];
            const itemTotal = (parseFloat(purchasePrice) * quantity).toFixed(2);
            const cgstAmount = (parseFloat(itemTotal) * gstRate / 200).toFixed(2);
            
            purchaseItemInserts.push(`(${i}, ${medicineId}, ${medicineId}, '${medicineName}', '${batchNumber}', '${expiryDate}', ${quantity}, 0, 10, ${purchasePrice}, ${mrp}, 0, ${gstRate}, ${cgstAmount}, ${cgstAmount}, ${itemTotal})`);
        }
    }
    // Insert in chunks
    for (let i = 0; i < purchaseItemInserts.length; i += chunkSize) {
        const chunk = purchaseItemInserts.slice(i, i + chunkSize);
        db.exec(`INSERT INTO purchase_items (purchase_id, batch_id, medicine_id, medicine_name, batch_number, expiry_date, quantity, free_quantity, pack_size, purchase_price, mrp, discount_percent, gst_rate, cgst_amount, sgst_amount, total_amount) VALUES ${chunk.join(', ')}`);
    }
    
    // =========================================
    // BILLS (65)
    // =========================================
    console.log('Seeding bills...');
    db.exec('UPDATE bill_sequence SET current_number = 70');
    
    const billInserts = [];
    for (let i = 1; i <= 65; i++) {
        const billNumber = `INV-2425${String(i).padStart(5, '0')}`;
        const daysAgo = Math.floor(Math.random() * 30);
        const billDate = formatDate(subDays(daysAgo));
        const customerId = i % 10 === 0 ? 'NULL' : ((i - 1) % 50) + 1;
        const customerName = i % 10 === 0 ? 'Walk-in' : `Customer ${((i - 1) % 50) + 1}`;
        const subtotal = (200 + i * 15).toFixed(2);
        const taxableAmount = (parseFloat(subtotal) / 1.12).toFixed(2);
        const cgstAmount = (parseFloat(taxableAmount) * 0.06).toFixed(2);
        const sgstAmount = cgstAmount;
        const totalGst = (parseFloat(cgstAmount) * 2).toFixed(2);
        const paymentMode = ['CASH', 'ONLINE', 'CREDIT', 'SPLIT'][i % 4];
        const cashAmount = paymentMode === 'CASH' ? subtotal : (paymentMode === 'SPLIT' ? (parseFloat(subtotal) * 0.6).toFixed(2) : '0.00');
        const onlineAmount = paymentMode === 'ONLINE' ? subtotal : (paymentMode === 'SPLIT' ? (parseFloat(subtotal) * 0.4).toFixed(2) : '0.00');
        const creditAmount = paymentMode === 'CREDIT' ? subtotal : '0.00';
        
        billInserts.push(`('${billNumber}', '${billDate}', ${customerId}, '${customerName}', 1, ${subtotal}, ${taxableAmount}, ${cgstAmount}, ${sgstAmount}, ${totalGst}, ${subtotal}, '${paymentMode}', ${cashAmount}, ${onlineAmount}, ${creditAmount}, 0)`);
    }
    for (let i = 0; i < billInserts.length; i += chunkSize) {
        const chunk = billInserts.slice(i, i + chunkSize);
        db.exec(`INSERT INTO bills (bill_number, bill_date, customer_id, customer_name, user_id, subtotal, taxable_amount, cgst_amount, sgst_amount, total_gst, grand_total, payment_mode, cash_amount, online_amount, credit_amount, is_cancelled) VALUES ${chunk.join(', ')}`);
    }
    
    // =========================================
    // BILL ITEMS
    // =========================================
    console.log('Seeding bill items...');
    const billItemInserts = [];
    for (let i = 1; i <= 65; i++) {
        const itemCount = (i % 3) + 1;
        for (let j = 0; j < itemCount; j++) {
            const batchId = ((i + j - 1) % 30) + 1;
            const medicineId = batchId;
            const qty = 10 + (j * 5);
            const unitPrice = (25 + medicineId * 6).toFixed(2);
            const itemSubtotal = (parseFloat(unitPrice) * qty).toFixed(2);
            const itemTaxable = (parseFloat(itemSubtotal) / 1.12).toFixed(2);
            const itemCgst = (parseFloat(itemTaxable) * 0.06).toFixed(2);
            
            billItemInserts.push(`(${i}, ${batchId}, ${medicineId}, 'Medicine ${medicineId}', '3004', 'BT2024${String(batchId).padStart(3, '0')}', ${qty}, ${unitPrice}, ${itemTaxable}, 12, ${itemCgst}, ${itemCgst}, ${itemSubtotal}, ${unitPrice}, 'PCS')`);
        }
    }
    for (let i = 0; i < billItemInserts.length; i += chunkSize) {
        const chunk = billItemInserts.slice(i, i + chunkSize);
        db.exec(`INSERT INTO bill_items (bill_id, batch_id, medicine_id, medicine_name, hsn_code, batch_number, quantity, selling_price, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, mrp, unit) VALUES ${chunk.join(', ')}`);
    }
    
    // =========================================
    // CREDITS
    // =========================================
    console.log('Seeding credits...');
    const creditInserts = [];
    for (let i = 1; i <= 45; i++) {
        const customerId = ((i - 1) % 50) + 1;
        const billId = ((i - 1) % 65) + 1;
        const amount = (100 + i * 50).toFixed(2);
        const transactionType = i % 4 === 0 ? 'PAYMENT' : 'SALE';
        const balanceAfter = transactionType === 'PAYMENT' ? Math.max(0, 5000 - i * 100).toFixed(2) : (1000 + i * 100).toFixed(2);
        const paymentMode = transactionType === 'PAYMENT' ? "'CASH'" : 'NULL';
        const notes = transactionType === 'PAYMENT' ? 'Payment received' : 'Credit sale';
        creditInserts.push(`(${customerId}, ${billId}, '${transactionType}', ${amount}, ${balanceAfter}, ${paymentMode}, '${notes}', 1)`);
    }
    db.exec(`INSERT INTO credits (customer_id, bill_id, transaction_type, amount, balance_after, payment_mode, notes, user_id) VALUES ${creditInserts.join(', ')}`);
    
    // =========================================
    // SCHEDULED MEDICINE RECORDS
    // =========================================
    console.log('Seeding scheduled medicine records...');
    const patientNames = ['Arun Kumar', 'Bhavani Devi', 'Chandran M', 'Deepa S', 'Ezhil V', 'Fathima B', 'Ganesh R', 'Hari Prasad', 'Indira K', 'Jayashree M'];
    const doctorNames = ['Dr. Ramesh Kumar', 'Dr. Lakshmi Devi', 'Dr. Suresh Babu', 'Dr. Kavitha Rajan', 'Dr. Mohan Raj'];
    const clinics = ['Apollo Clinic', 'Kauvery Hospital', 'MIOT Hospital', 'Fortis Malar', 'Vijaya Hospital'];
    
    const scheduledInserts = [];
    for (let i = 1; i <= 45; i++) {
        const billId = ((i - 1) % 65) + 1;
        const billItemId = ((i - 1) % 130) + 1;
        const medicineId = ((i - 1) % 30) + 1;
        const batchId = medicineId;
        const patientName = patientNames[(i - 1) % patientNames.length];
        const patientAge = 20 + (i % 60);
        const patientGender = i % 3 === 0 ? 'M' : (i % 3 === 1 ? 'F' : 'O');
        const patientPhone = `987654${String(3000 + i).padStart(4, '0')}`;
        const patientAddress = `${i} Main Street, Chennai`;
        const doctorName = doctorNames[(i - 1) % doctorNames.length];
        const doctorRegNo = `TN${String(10000 + i).padStart(6, '0')}`;
        const clinic = clinics[(i - 1) % clinics.length];
        const prescriptionNo = `RX2024${String(i).padStart(5, '0')}`;
        const prescriptionDate = formatDate(subDays(i % 30));
        const qty = 5 + (i % 20);
        
        scheduledInserts.push(`(${billId}, ${billItemId}, ${medicineId}, ${batchId}, '${patientName}', ${patientAge}, '${patientGender}', '${patientPhone}', '${patientAddress}', '${doctorName}', '${doctorRegNo}', '${clinic}', '${prescriptionNo}', '${prescriptionDate}', ${qty})`);
    }
    db.exec(`INSERT INTO scheduled_medicine_records (bill_id, bill_item_id, medicine_id, batch_id, patient_name, patient_age, patient_gender, patient_phone, patient_address, doctor_name, doctor_registration_number, clinic_hospital_name, prescription_number, prescription_date, quantity) VALUES ${scheduledInserts.join(', ')}`);
    
    // =========================================
    // RUNNING BILLS
    // =========================================
    console.log('Seeding running bills...');
    const runningBillMedicines = ['Crocin Advance', 'Dolo 650', 'Paracetamol IP', 'Azithromycin 500', 'Pantoprazole 40', 'Omeprazole 20', 'Metformin 500', 'Atorvastatin 10'];
    
    const runningBillInserts = [];
    for (let i = 1; i <= 45; i++) {
        const billId = ((i - 1) % 65) + 1;
        const medicineName = runningBillMedicines[(i - 1) % runningBillMedicines.length];
        const quantity = 5 + (i % 25);
        const unitPrice = (15 + (i * 3)).toFixed(2);
        const totalAmount = (parseFloat(unitPrice) * quantity).toFixed(2);
        const gstRate = [0, 5, 12, 18][(i - 1) % 4];
        const notes = i % 3 === 0 ? `Urgent for patient ${i}` : '';
        const status = i <= 35 ? 'PENDING' : (i <= 40 ? 'STOCKED' : 'CANCELLED');
        const linkedBatchId = status === 'STOCKED' ? ((i - 1) % 30) + 1 : 'NULL';
        const linkedMedicineId = status === 'STOCKED' ? ((i - 1) % 30) + 1 : 'NULL';
        const stockedAt = status === 'STOCKED' ? `'${formatDate(subDays(i % 10))}'` : 'NULL';
        const stockedBy = status === 'STOCKED' ? 1 : 'NULL';
        
        runningBillInserts.push(`(${billId}, '${medicineName}', ${quantity}, ${unitPrice}, ${totalAmount}, ${gstRate}, '3004', '${notes}', 1, '${status}', ${linkedBatchId}, ${linkedMedicineId}, ${stockedAt}, ${stockedBy})`);
    }
    db.exec(`INSERT INTO running_bills (bill_id, medicine_name, quantity, unit_price, total_amount, gst_rate, hsn_code, notes, user_id, status, linked_batch_id, linked_medicine_id, stocked_at, stocked_by) VALUES ${runningBillInserts.join(', ')}`);
    
    // =========================================
    // AUDIT LOG
    // =========================================
    console.log('Seeding audit log...');
    const auditActions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'PRINT', 'EXPORT'];
    const auditEntities = ['BILL', 'PURCHASE', 'MEDICINE', 'CUSTOMER', 'SUPPLIER', 'SETTINGS'];
    const auditInserts = [];
    for (let i = 1; i <= 50; i++) {
        const action = auditActions[(i - 1) % auditActions.length];
        const entity = auditEntities[(i - 1) % auditEntities.length];
        const entityId = ((i - 1) % 20) + 1;
        auditInserts.push(`(1, '${action}', '${entity}', ${entityId}, '${action} ${entity.toLowerCase()} #${entityId}')`);
    }
    db.exec(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, description) VALUES ${auditInserts.join(', ')}`);
    
    console.log('');
    console.log('========================================');
    console.log('Database seeding completed successfully!');
    console.log('========================================');
    console.log('Summary:');
    console.log('  - 10 Suppliers');
    console.log('  - 40 Medicines (30 regular + 10 scheduled/H1)');
    console.log('  - 70 Batches (60 regular + 10 scheduled, linked to suppliers)');
    console.log('  - 50 Customers');
    console.log('  - 50 Purchases with items');
    console.log('  - 65 Bills with items');
    console.log('  - 45 Credits');
    console.log('  - 45 Scheduled medicine records');
    console.log('  - 45 Running bills');
    console.log('  - 50 Audit log entries');
    console.log('========================================');
}

// =====================================================
// MAIN
// =====================================================
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/db-seed.mjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --clear     Clear all data from database');
    console.log('  --seed      Seed database with sample data');
    console.log('  --reset     Clear and then seed (full reset)');
    console.log('  --help      Show this help message');
    process.exit(0);
}

try {
    createTables();
    
    if (args.includes('--clear') || args.includes('--reset')) {
        clearDatabase();
    }
    
    if (args.includes('--seed') || args.includes('--reset')) {
        seedDatabase();
    }
    
    if (!args.includes('--clear') && !args.includes('--seed') && !args.includes('--reset')) {
        console.log('No action specified. Use --help for options.');
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
} finally {
    db.close();
}
