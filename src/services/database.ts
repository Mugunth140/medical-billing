// =====================================================
// Database Service
// SQLite Database Operations via Tauri SQL Plugin
// =====================================================

import { appConfigDir } from '@tauri-apps/api/path';
import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let dbPath: string | null = null;
let initPromise: Promise<Database> | null = null;

// Individual table creation statements
const TABLE_STATEMENTS = [
    // Users Table
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

    // Medicines Table - Master data only (GST/schedule set per batch)
    `CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        generic_name TEXT,
        manufacturer TEXT,
        hsn_code TEXT NOT NULL DEFAULT '3004',
        category TEXT,
        drug_type TEXT,
        pack_size TEXT,
        unit TEXT DEFAULT 'PCS',
        reorder_level INTEGER DEFAULT 10,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Batches Table - GST rate and schedule stored per batch
    `CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL REFERENCES medicines(id),
        batch_number TEXT NOT NULL,
        expiry_date DATE NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        mrp DECIMAL(10,2) NOT NULL,
        selling_price DECIMAL(10,2) NOT NULL,
        price_type TEXT NOT NULL DEFAULT 'INCLUSIVE' CHECK (price_type IN ('INCLUSIVE', 'EXCLUSIVE')),
        gst_rate DECIMAL(5,2) NOT NULL DEFAULT 12 CHECK (gst_rate >= 0 AND gst_rate <= 28),
        is_schedule INTEGER DEFAULT 0,
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

    // Suppliers Table
    `CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        dealer_number TEXT,
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

    // Customers Table
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

    // Bills Table
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

    // Bill Items Table
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

    // Purchases Table
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
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Purchase Items Table
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

    // Credits Table (Udhar)
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
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Audit Log Table
    `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Settings Table
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Bill Sequence Table
    `CREATE TABLE IF NOT EXISTS bill_sequence (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        prefix TEXT NOT NULL DEFAULT 'INV',
        current_number INTEGER NOT NULL DEFAULT 0,
        financial_year TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Scheduled Medicine Records Table - Patient details for scheduled drug sales
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
        doctor_prescription TEXT,
        quantity INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Running Bills Table - For medicines sold without stock (to be reconciled later)
    // Creates an actual bill for the customer, but tracks the pending stock reconciliation
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
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'STOCKED', 'CANCELLED')),
        linked_batch_id INTEGER REFERENCES batches(id),
        linked_medicine_id INTEGER REFERENCES medicines(id),
        stocked_at DATETIME,
        stocked_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Sales Returns Table - Customer returns to pharmacy
    `CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT NOT NULL UNIQUE,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        bill_id INTEGER NOT NULL REFERENCES bills(id),
        customer_id INTEGER REFERENCES customers(id),
        reason TEXT,
        refund_mode TEXT CHECK (refund_mode IN ('CASH', 'CREDIT_NOTE', 'ADJUSTMENT')),
        total_amount DECIMAL(12,2) NOT NULL,
        total_gst DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'COMPLETED',
        notes TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Sales Return Items Table
    `CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES sales_returns(id),
        bill_item_id INTEGER NOT NULL REFERENCES bill_items(id),
        batch_id INTEGER NOT NULL REFERENCES batches(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        gst_rate DECIMAL(5,2) NOT NULL,
        cgst DECIMAL(10,2) DEFAULT 0,
        sgst DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Purchase Returns Table - Pharmacy returns to supplier
    `CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT NOT NULL UNIQUE,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        purchase_id INTEGER REFERENCES purchases(id),
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        reason TEXT CHECK (reason IN ('EXPIRY', 'DAMAGE', 'OVERSTOCK', 'OTHER')),
        total_amount DECIMAL(12,2) NOT NULL,
        total_gst DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED')),
        notes TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Purchase Return Items Table
    `CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES purchase_returns(id),
        batch_id INTEGER NOT NULL REFERENCES batches(id),
        medicine_id INTEGER NOT NULL REFERENCES medicines(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        gst_rate DECIMAL(5,2) NOT NULL,
        cgst DECIMAL(10,2) DEFAULT 0,
        sgst DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Medicine Notes Table - For tracking medicines to buy
    `CREATE TABLE IF NOT EXISTS medicine_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_name TEXT NOT NULL,
        notes TEXT,
        quantity INTEGER DEFAULT 1,
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'completed')),
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    )`
];

// Index creation statements
const INDEX_STATEMENTS = [
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
    `CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)`,
    `CREATE INDEX IF NOT EXISTS idx_medicines_hsn ON medicines(hsn_code)`,
    `CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON medicines(manufacturer)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_location ON batches(rack, box)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_quantity ON batches(quantity)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_gst ON batches(gst_rate)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_schedule ON batches(is_schedule)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_cancelled ON bills(is_cancelled)`,
    `CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bill_items_batch ON bill_items(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bill_items_medicine ON bill_items(medicine_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(invoice_date)`,
    `CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_credits_bill ON credits(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scheduled_medicine_bill ON scheduled_medicine_records(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scheduled_medicine_medicine ON scheduled_medicine_records(medicine_id)`,
    `CREATE INDEX IF NOT EXISTS idx_running_bills_status ON running_bills(status)`,
    `CREATE INDEX IF NOT EXISTS idx_running_bills_bill ON running_bills(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_supplier ON batches(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_returns_bill ON sales_returns(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(return_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(return_id)`,
    `CREATE INDEX IF NOT EXISTS idx_medicine_notes_status ON medicine_notes(status)`
];


// Default data statements
const DEFAULT_DATA_STATEMENTS = [
    // Default Admin User - IMPORTANT: Change password on first login!
    // In production, password should be hashed with bcrypt
    `INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (1, 'admin', 'admin@123', 'Administrator', 'admin')`,

    // Bill Sequence
    `INSERT OR IGNORE INTO bill_sequence (id, prefix, current_number, financial_year) VALUES (1, 'INV', 0, '2024-25')`,

    // Default Settings
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_name', 'Medical Store', 'shop', 'Shop name for bills')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_address', '', 'shop', 'Shop address')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_phone', '', 'shop', 'Shop phone number')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_gstin', '', 'shop', 'GST Number')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_drug_license', '', 'shop', 'Drug License Number')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('shop_state', 'Tamil Nadu', 'shop', 'State for CGST/SGST')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('bill_prefix', 'INV', 'billing', 'Bill number prefix')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('thermal_printer_width', '80', 'printing', 'Thermal printer width in mm')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('backup_path', './backups', 'system', 'Backup directory path')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('last_backup_date', '', 'system', 'Last backup timestamp')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('expiry_alert_days', '30', 'alerts', 'Days before expiry to alert')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('low_stock_threshold', '10', 'alerts', 'Low stock alert threshold')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('non_moving_days', '30', 'alerts', 'Days to consider non-moving')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('default_gst_rate', '12', 'gst', 'Default GST rate for new medicines')`,
    `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES ('round_off_enabled', '1', 'billing', 'Enable bill rounding')`
];


/**
 * Initialize the database connection and create schema
 */
export async function initDatabase(): Promise<Database> {
    if (db) return db;
    // Prevent duplicate concurrent initialization (React Strict Mode calls useEffect twice)
    if (initPromise) return initPromise;
    initPromise = _doInitDatabase();
    try {
        return await initPromise;
    } finally {
        initPromise = null;
    }
}

async function _doInitDatabase(): Promise<Database> {
    if (db) return db;

    try {
        console.log('Connecting to database...');

        // Get the app config directory and build an explicit database path
        // This ensures the database persists across Windows app updates
        // Using appConfigDir() to match backup.service.ts for consistency
        const configDir = await appConfigDir();
        dbPath = `${configDir}/medbill.db`;
        console.log('Database path:', dbPath);

        // Connect to SQLite database using explicit path
        db = await Database.load(`sqlite:${dbPath}`);
        console.log('Database connected successfully');

        // Enable WAL mode for better concurrent access and prevent "database is locked" errors
        await db.execute('PRAGMA journal_mode = WAL');
        console.log('WAL mode enabled');

        // Set busy timeout to wait for locks (5 seconds)
        await db.execute('PRAGMA busy_timeout = 5000');
        console.log('Busy timeout set');

        // Enable foreign keys
        await db.execute('PRAGMA foreign_keys = ON');
        console.log('Foreign keys enabled');

        // Create tables
        console.log('Creating tables...');
        for (const statement of TABLE_STATEMENTS) {
            try {
                await db.execute(statement);
            } catch (tableError) {
                console.error('Error creating table:', tableError);
                throw tableError;
            }
        }
        console.log('Tables created successfully');

        // Create indexes
        console.log('Creating indexes...');
        for (const statement of INDEX_STATEMENTS) {
            try {
                await db.execute(statement);
            } catch (indexError) {
                console.warn('Index creation warning:', indexError);
                // Continue even if index creation fails
            }
        }
        console.log('Indexes created');

        // Insert default data
        console.log('Inserting default data...');
        for (const statement of DEFAULT_DATA_STATEMENTS) {
            try {
                await db.execute(statement);
            } catch (dataError) {
                console.warn('Default data insertion warning:', dataError);
                // Continue even if data insertion fails (may already exist)
            }
        }
        console.log('Default data inserted');

        // Run migrations for existing databases
        console.log('Running migrations...');
        const migrations = [
            // Add tablets_per_strip to batches if not exists
            `ALTER TABLE batches ADD COLUMN tablets_per_strip INTEGER DEFAULT 10`,
            // Add new columns to bill_items if not exists
            `ALTER TABLE bill_items ADD COLUMN quantity_strips INTEGER DEFAULT 0`,
            `ALTER TABLE bill_items ADD COLUMN quantity_pieces INTEGER DEFAULT 0`,
            `ALTER TABLE bill_items ADD COLUMN tablets_per_strip INTEGER DEFAULT 10`,
            // Add total_items to bills if not exists
            `ALTER TABLE bills ADD COLUMN total_items INTEGER DEFAULT 0`,
            // Add doctor_name to bills for prescription tracking
            `ALTER TABLE bills ADD COLUMN doctor_name TEXT`,
            // Add missing columns to scheduled_medicine_records for older databases
            `ALTER TABLE scheduled_medicine_records ADD COLUMN doctor_registration_number TEXT`,
            `ALTER TABLE scheduled_medicine_records ADD COLUMN clinic_hospital_name TEXT`,
            `ALTER TABLE scheduled_medicine_records ADD COLUMN prescription_date TEXT`,
            `ALTER TABLE scheduled_medicine_records ADD COLUMN doctor_prescription TEXT`,
            // Add supplier_id to batches for direct supplier tracking
            `ALTER TABLE batches ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)`,
            // Add gst_rate and is_schedule to batches (moved from medicines)
            `ALTER TABLE batches ADD COLUMN gst_rate DECIMAL(5,2) DEFAULT 12`,
            `ALTER TABLE batches ADD COLUMN is_schedule INTEGER DEFAULT 0`,
            // Add pack_size to medicines for dataset import
            `ALTER TABLE medicines ADD COLUMN pack_size TEXT`,
            // Add free_quantity to batches for supplier free units
            `ALTER TABLE batches ADD COLUMN free_quantity INTEGER DEFAULT 0`,
            // Add dealer_number to suppliers
            `ALTER TABLE suppliers ADD COLUMN dealer_number TEXT`
        ];
        for (const migration of migrations) {
            try {
                await db.execute(migration);
            } catch {
                // Column probably already exists, ignore
            }
        }

        // One-time migration: relax GST rate constraint to 0-28
        try {
            const gstConstraintFlag = await db.select<{ value: string }[]>(
                `SELECT value FROM settings WHERE key = 'gst_rate_range_migration_done'`
            );
            if (gstConstraintFlag.length === 0) {
                console.log('Updating GST rate constraint to 0-28...');
                await db.execute('PRAGMA foreign_keys=OFF');

                await db.execute(`CREATE TABLE IF NOT EXISTS batches_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicine_id INTEGER NOT NULL REFERENCES medicines(id),
                    batch_number TEXT NOT NULL,
                    expiry_date DATE NOT NULL,
                    purchase_price DECIMAL(10,2) NOT NULL,
                    mrp DECIMAL(10,2) NOT NULL,
                    selling_price DECIMAL(10,2) NOT NULL,
                    price_type TEXT NOT NULL DEFAULT 'INCLUSIVE' CHECK (price_type IN ('INCLUSIVE', 'EXCLUSIVE')),
                    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 12 CHECK (gst_rate >= 0 AND gst_rate <= 28),
                    is_schedule INTEGER DEFAULT 0,
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
                    free_quantity INTEGER DEFAULT 0,
                    UNIQUE(medicine_id, batch_number)
                )`);

                await db.execute(`INSERT INTO batches_new (
                    id, medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price,
                    price_type, gst_rate, is_schedule, quantity, tablets_per_strip, rack, box,
                    last_sold_date, purchase_id, supplier_id, is_active, created_at, updated_at, free_quantity
                )
                SELECT
                    id, medicine_id, batch_number, expiry_date, purchase_price, mrp, selling_price,
                    price_type, gst_rate, is_schedule, quantity, tablets_per_strip, rack, box,
                    last_sold_date, purchase_id, supplier_id, is_active, created_at, updated_at, free_quantity
                FROM batches`);

                await db.execute('DROP TABLE batches');
                await db.execute('ALTER TABLE batches_new RENAME TO batches');

                // Recreate batch indexes (dropped with the table)
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_location ON batches(rack, box)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_quantity ON batches(quantity)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_gst ON batches(gst_rate)`);
                await db.execute(`CREATE INDEX IF NOT EXISTS idx_batches_schedule ON batches(is_schedule)`);

                await db.execute('PRAGMA foreign_keys=ON');
                await db.execute(
                    `INSERT INTO settings (key, value, category, description)
                     VALUES ('gst_rate_range_migration_done', 'true', 'system', 'Allow GST rate 0-28')`
                );
                console.log('GST rate constraint updated');
            }
        } catch (gstMigrationErr) {
            console.warn('GST rate constraint migration skipped:', gstMigrationErr);
        }


        // Migrate existing batch quantities from strips to tablets (one-time)
        try {
            const migrationFlag = await db.select<{ value: string }[]>(
                `SELECT value FROM settings WHERE key = 'tablets_migration_done'`
            );
            if (migrationFlag.length === 0) {
                console.log('Running one-time quantity migration...');
                await db.execute(
                    `UPDATE batches SET quantity = quantity * COALESCE(tablets_per_strip, 10) WHERE quantity > 0`
                );
                await db.execute(
                    `INSERT INTO settings (key, value, category, description) VALUES ('tablets_migration_done', 'true', 'system', 'Quantity converted from strips to tablets')`
                );
                console.log('Migrated batch quantities from strips to tablets');
            }
        } catch (migrationErr) {
            console.warn('Batch quantity migration skipped:', migrationErr);
        }

        console.log('Migrations complete');

        // One-time dedup: remove duplicate medicines created by repeated force imports
        // Keeps the medicine with the lowest ID for each name, only deletes unreferenced duplicates
        try {
            const dedupFlag = await db.select<{ value: string }[]>(
                `SELECT value FROM settings WHERE key = 'medicines_dedup_done'`
            );
            if (dedupFlag.length === 0) {
                const countBefore = await db.select<{ count: number }[]>(
                    `SELECT COUNT(*) as count FROM medicines`
                );
                const before = countBefore[0]?.count ?? 0;

                if (before > 260000) {
                    console.log(`[Dedup] Found ${before.toLocaleString()} medicines, running dedup...`);
                    // Delete duplicate medicines that:
                    // 1. Are NOT the first occurrence of a name (keep lowest ID per name)
                    // 2. Are NOT referenced by any foreign key (batches, bill_items, etc.)
                    await db.execute(
                        `DELETE FROM medicines WHERE id NOT IN (
                            SELECT MIN(id) FROM medicines GROUP BY name
                        ) AND id NOT IN (
                            SELECT DISTINCT medicine_id FROM batches
                            UNION SELECT DISTINCT medicine_id FROM bill_items
                            UNION SELECT DISTINCT medicine_id FROM purchase_items
                        )`
                    );

                    const countAfter = await db.select<{ count: number }[]>(
                        `SELECT COUNT(*) as count FROM medicines`
                    );
                    const after = countAfter[0]?.count ?? 0;
                    console.log(`[Dedup] Removed ${(before - after).toLocaleString()} duplicate medicines. Now: ${after.toLocaleString()}`);
                }

                await db.execute(
                    `INSERT INTO settings (key, value, category, description) VALUES ('medicines_dedup_done', 'true', 'system', 'Duplicate medicines cleaned up')`
                );
            }
        } catch (dedupErr) {
            console.warn('[Dedup] Medicine dedup skipped:', dedupErr);
        }

        // Import bundled medicines if table is empty
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            console.log('Checking for bundled medicines...');
            const importCount = await invoke<number>('import_bundled_medicines');
            if (importCount > 0) {
                console.log(`Medicines imported/loaded: ${importCount.toLocaleString()}`);
                // CRITICAL: The Rust import used its own SQLite connection.
                // Our JS connection's WAL snapshot is stale and won't see the
                // 246K medicines Rust just inserted.  Close and reopen to get
                // a fresh connection that sees the current database state.
                console.log('Refreshing DB connection after medicine import...');
                await db!.close();
                db = await Database.load(`sqlite:${dbPath}`);
                await db.execute('PRAGMA journal_mode = WAL');
                await db.execute('PRAGMA busy_timeout = 5000');
                await db.execute('PRAGMA foreign_keys = ON');
                console.log('DB connection refreshed — medicines are now visible');
            }
        } catch (importErr) {
            console.warn('Medicine import skipped (may already exist or bundle not found):', importErr);
        }

        console.log('Database initialized successfully');
        return db;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Get the database instance
 */
export function getDatabase(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Global write mutex - ensures only one write operation at a time
 * This prevents "database is locked" errors from concurrent writes
 */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Execute a query and return results (READ operation - no locking needed)
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const database = getDatabase();
    return await database.select<T[]>(sql, params);
}

/**
 * Execute an insert/update/delete and return affected rows (WRITE operation - serialized)
 */
export async function execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    // Serialize all write operations
    const previousWrite = writeQueue;
    let resolveWrite: () => void = () => { };

    writeQueue = new Promise<void>((resolve) => {
        resolveWrite = resolve;
    });

    await previousWrite;

    try {
        const database = getDatabase();
        const result = await database.execute(sql, params);
        return {
            rowsAffected: result.rowsAffected,
            lastInsertId: result.lastInsertId ?? 0
        };
    } finally {
        resolveWrite();
    }
}


/**
 * Operation queue to serialize all database operations
 * This prevents "database is locked" errors by ensuring only one operation runs at a time
 */
let operationQueue: Promise<unknown> = Promise.resolve();

/** Helper: sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run operations in a serialized queue
 * 
 * NOTE: We're NOT using explicit BEGIN/COMMIT transactions because:
 * 1. Tauri SQL plugin has issues with explicit transaction management
 * 2. SQLite already uses auto-commit for each statement which is ACID
 * 3. For our use case (billing), individual statement atomicity is sufficient
 * 
 * The queue ensures only one operation runs at a time, preventing lock errors.
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Queue this operation to run after any pending operations
    const previousQueue = operationQueue;
    let resolveQueue: () => void = () => { };

    operationQueue = new Promise<void>((resolve) => {
        resolveQueue = resolve;
    });

    // Wait for previous operation to complete
    await previousQueue;

    console.log('[DB] Starting serialized operation');

    try {
        const result = await executeWithRetry(callback);
        console.log('[DB] Operation completed successfully');
        return result;
    } finally {
        resolveQueue();
    }
}

/**
 * Execute callback with retry logic for transient errors
 */
async function executeWithRetry<T>(callback: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await callback();
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[DB] Operation error (attempt ${attempt}/${maxRetries}):`, errorMsg);

            // Check if it's a lock/busy error that we should retry
            if (errorMsg.includes('locked') || errorMsg.includes('busy')) {
                const delayMs = 100 * Math.pow(2, attempt - 1); // 100, 200, 400ms
                console.warn(`[DB] Database busy, retrying in ${delayMs}ms...`);
                lastError = error instanceof Error ? error : new Error(errorMsg);
                await sleep(delayMs);
                continue;
            }

            // Non-recoverable error - throw immediately
            throw error;
        }
    }

    throw lastError || new Error('Operation failed after all retries');
}





/**
 * Get a single row
 */
export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
    }
}

/**
 * Export entire database to JSON for backup
 * NOTE: Only exports medicines that have batches (user's actual stock data).
 * The 240K bundled medicine catalog is NOT exported — it will be automatically
 * re-imported from the embedded bundle during restore.
 */
export async function exportDatabase(): Promise<Record<string, unknown[]>> {
    const tables = [
        'users',
        'batches',
        'suppliers',
        'customers',
        'purchases',
        'purchase_items',
        'bills',
        'bill_items',
        'credits',
        'scheduled_medicine_records',
        'running_bills',
        'sales_returns',
        'sales_return_items',
        'purchase_returns',
        'purchase_return_items',
        'medicine_notes',
        'audit_log',
        'settings',
        'bill_sequence'
    ];

    const backup: Record<string, unknown[]> = {
        _meta: [{
            version: '2.0.0',
            created_at: new Date().toISOString(),
            tables: [...tables, 'medicines']
        }]
    };

    for (const table of tables) {
        try {
            const data = await query<unknown>(`SELECT * FROM ${table}`, []);
            backup[table] = data;
        } catch (error) {
            console.warn(`Failed to export table ${table}:`, error);
            backup[table] = [];
        }
    }

    // Export only medicines that are referenced by batches, bills, purchases, etc.
    // This avoids exporting 240K bundled catalog medicines (they'll be re-imported from bundle)
    try {
        const medicines = await query<unknown>(
            `SELECT DISTINCT m.* FROM medicines m
             WHERE m.id IN (
                SELECT DISTINCT medicine_id FROM batches
                UNION SELECT DISTINCT medicine_id FROM bill_items
                UNION SELECT DISTINCT medicine_id FROM purchase_items
                UNION SELECT DISTINCT medicine_id FROM scheduled_medicine_records
                UNION SELECT DISTINCT medicine_id FROM running_bills WHERE medicine_id IS NOT NULL
                UNION SELECT DISTINCT medicine_id FROM purchase_return_items
             )`,
            []
        );
        backup.medicines = medicines;
        console.log(`[Export] Exported ${medicines.length} referenced medicines (skipping bundled catalog)`);
    } catch (error) {
        console.warn('Failed to export medicines selectively, falling back to all:', error);
        try {
            backup.medicines = await query<unknown>('SELECT * FROM medicines', []);
        } catch {
            backup.medicines = [];
        }
    }

    return backup;
}

/**
 * Import database from JSON backup
 */
export async function importDatabase(backup: Record<string, unknown[]>): Promise<void> {
    // Validate backup format
    if (!backup._meta || !Array.isArray(backup._meta)) {
        throw new Error('Invalid backup format: missing metadata');
    }

    // Delete order: children first, then parents (respects FK constraints)
    const deleteOrder = [
        'audit_log',
        'medicine_notes',
        'purchase_return_items',
        'purchase_returns',
        'sales_return_items',
        'sales_returns',
        'scheduled_medicine_records',
        'running_bills',
        'credits',
        'bill_items',
        'bills',
        'purchase_items',
        'purchases',
        'batches',
        'medicines',
        'customers',
        'suppliers',
        'settings',
        'bill_sequence'
    ];

    // Insert order: parents first, then children (respects FK constraints)
    const insertOrder = [
        'settings',
        'bill_sequence',
        'suppliers',
        'customers',
        'medicines',
        'batches',
        'purchases',
        'bills',
        'purchase_items',
        'bill_items',
        'credits',
        'sales_returns',
        'purchase_returns',
        'sales_return_items',
        'purchase_return_items',
        'scheduled_medicine_records',
        'running_bills',
        'medicine_notes',
        'audit_log'
    ];

    console.log('[Import] Starting database restore...');

    // Disable foreign keys during import for robustness
    try {
        await execute('PRAGMA foreign_keys = OFF', []);
    } catch (err) {
        console.warn('[Import] Could not disable foreign keys:', err);
    }

    // Clear existing data (except users) — children first
    for (const table of deleteOrder) {
        try {
            await execute(`DELETE FROM ${table}`, []);
        } catch (error) {
            console.warn(`[Import] Failed to clear table ${table}:`, error);
        }
    }

    // Handle users first — import but don't replace current user
    if (backup.users && Array.isArray(backup.users)) {
        console.log(`[Import] Importing ${backup.users.length} users...`);
        for (const row of backup.users) {
            if (typeof row !== 'object' || row === null) continue;
            const userRow = row as Record<string, unknown>;

            const columns = Object.keys(userRow);
            const values = Object.values(userRow);
            const placeholders = columns.map(() => '?').join(', ');

            try {
                await execute(
                    `INSERT OR IGNORE INTO users (${columns.join(', ')}) VALUES (${placeholders})`,
                    values
                );
            } catch (error) {
                console.warn(`[Import] Failed to import user:`, error);
            }
        }
    }

    // Import data — parents first, then children
    for (const table of insertOrder) {
        let data = backup[table];
        if (!data || !Array.isArray(data) || data.length === 0) continue;

        // For medicines: if the backup has a huge number (old format with full catalog),
        // only import medicines that are referenced by batches in the backup.
        // The 240K catalog will be re-imported from the Rust bundle at the end.
        if (table === 'medicines' && data.length > 1000) {
            const batchData = backup.batches;
            const billItemData = backup.bill_items;
            const referencedIds = new Set<unknown>();

            if (batchData && Array.isArray(batchData)) {
                for (const b of batchData) {
                    if (b && typeof b === 'object' && 'medicine_id' in b) {
                        referencedIds.add((b as Record<string, unknown>).medicine_id);
                    }
                }
            }
            if (billItemData && Array.isArray(billItemData)) {
                for (const bi of billItemData) {
                    if (bi && typeof bi === 'object' && 'medicine_id' in bi) {
                        referencedIds.add((bi as Record<string, unknown>).medicine_id);
                    }
                }
            }

            if (referencedIds.size > 0) {
                const originalCount = data.length;
                data = data.filter(row => {
                    if (!row || typeof row !== 'object' || !('id' in row)) return true;
                    return referencedIds.has((row as Record<string, unknown>).id);
                });
                console.log(`[Import] Filtered medicines: ${data.length} referenced out of ${originalCount} (catalog will be re-imported from bundle)`);
            }
        }

        console.log(`[Import] Importing ${data.length} rows into ${table}...`);

        for (const row of data) {
            if (typeof row !== 'object' || row === null) continue;

            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map(() => '?').join(', ');

            try {
                await execute(
                    `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
                    values
                );
            } catch (error) {
                console.warn(`[Import] Failed to import row into ${table}:`, error);
            }
        }
    }

    // Re-enable foreign keys
    try {
        await execute('PRAGMA foreign_keys = ON', []);
    } catch (err) {
        console.warn('[Import] Could not re-enable foreign keys:', err);
    }

    console.log('[Import] Backup data restored. Flushing WAL before bundle import...');

    // CRITICAL: Force a WAL checkpoint to write all changes to the main DB file.
    // The Rust import_bundled_medicines opens its OWN SQLite connection and won't
    // see uncommitted WAL changes. A TRUNCATE checkpoint writes everything and
    // removes the WAL file, guaranteeing Rust sees the current state.
    try {
        await execute('PRAGMA wal_checkpoint(TRUNCATE)', []);
        console.log('[Import] WAL checkpoint completed successfully');
    } catch (walErr) {
        console.warn('[Import] WAL checkpoint failed, trying FULL:', walErr);
        try {
            await execute('PRAGMA wal_checkpoint(FULL)', []);
        } catch {
            console.warn('[Import] WAL FULL checkpoint also failed');
        }
    }

    // Now close the connection
    await closeDatabase();

    // Re-import the 240K bundled medicines catalog after restore
    // Rust opens its own connection, sees the clean DB state after deletes,
    // and uses WHERE NOT EXISTS (by name) to avoid duplicates
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        console.log('[Import] Re-importing bundled medicines catalog...');
        const totalCount = await invoke<number>('import_bundled_medicines', { force: true });
        console.log(`[Import] Bundled medicines re-imported. Total medicines: ${totalCount.toLocaleString()}`);
    } catch (importErr) {
        console.warn('[Import] Bundled medicine re-import after restore skipped:', importErr);
    }

    // Re-initialize the database connection for the app to use
    await initDatabase();

    console.log('[Import] Database restore complete!');
}

export default {
    initDatabase,
    getDatabase,
    query,
    execute,
    transaction,
    queryOne,
    closeDatabase,
    exportDatabase,
    importDatabase
};
