// =====================================================
// Database Service
// SQLite Database Operations via Tauri SQL Plugin
// =====================================================

import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

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

    // Medicines Table
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
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Batches Table
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
        user_id INTEGER NOT NULL REFERENCES users(id),
        notes TEXT,
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
    )`
];

// Index creation statements
const INDEX_STATEMENTS = [
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
    `CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)`,
    `CREATE INDEX IF NOT EXISTS idx_medicines_hsn ON medicines(hsn_code)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)`,
    `CREATE INDEX IF NOT EXISTS idx_batches_location ON batches(rack, box)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id)`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`
];

// Default data statements
const DEFAULT_DATA_STATEMENTS = [
    // Default Admin User
    `INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (1, 'admin', 'admin123', 'Administrator', 'admin')`,

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

    try {
        console.log('Connecting to database...');

        // Connect to SQLite database
        db = await Database.load('sqlite:medbill.db');
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
            `ALTER TABLE bills ADD COLUMN total_items INTEGER DEFAULT 0`
        ];
        for (const migration of migrations) {
            try {
                await db.execute(migration);
            } catch {
                // Column probably already exists, ignore
            }
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
 * Execute a query and return results
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const database = getDatabase();
    return await database.select<T[]>(sql, params);
}

/**
 * Execute an insert/update/delete and return affected rows
 */
export async function execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const database = getDatabase();
    const result = await database.execute(sql, params);
    return {
        rowsAffected: result.rowsAffected,
        lastInsertId: result.lastInsertId ?? 0
    };
}

/**
 * Run multiple statements in a transaction
 * Uses DEFERRED transaction with proper error handling
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
    const database = getDatabase();
    let transactionStarted = false;

    // Use BEGIN (DEFERRED by default) - WAL mode handles concurrency
    try {
        await database.execute('BEGIN');
        transactionStarted = true;
    } catch (beginError) {
        console.warn('Could not start transaction, using auto-commit mode:', beginError);
        // Execute in auto-commit mode (each statement commits individually)
        return await callback();
    }

    try {
        const result = await callback();
        if (transactionStarted) {
            await database.execute('COMMIT');
        }
        return result;
    } catch (error) {
        // Try to rollback only if we started a transaction
        if (transactionStarted) {
            try {
                await database.execute('ROLLBACK');
            } catch (rollbackError) {
                console.warn('Rollback warning:', rollbackError);
            }
        }
        throw error;
    }
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

export default {
    initDatabase,
    getDatabase,
    query,
    execute,
    transaction,
    queryOne,
    closeDatabase
};
