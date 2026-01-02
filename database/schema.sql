-- =====================================================
-- MedBill Database Schema
-- GST-Compliant Medical Billing & Inventory System
-- =====================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. USERS - Authentication & Roles
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    is_active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================
-- 2. MEDICINES - Product Master
-- =====================================================
CREATE TABLE IF NOT EXISTS medicines (
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
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_hsn ON medicines(hsn_code);
CREATE INDEX IF NOT EXISTS idx_medicines_gst ON medicines(gst_rate);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_schedule ON medicines(is_schedule);

-- =====================================================
-- 3. BATCHES - Batch-wise Inventory
-- =====================================================
CREATE TABLE IF NOT EXISTS batches (
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
    purchase_id INTEGER REFERENCES purchases(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_location ON batches(rack, box);
CREATE INDEX IF NOT EXISTS idx_batches_last_sold ON batches(last_sold_date);
CREATE INDEX IF NOT EXISTS idx_batches_quantity ON batches(quantity);

-- =====================================================
-- 4. SUPPLIERS - Supplier Master
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
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
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON suppliers(gstin);

-- =====================================================
-- 5. CUSTOMERS - Customer Master
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
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
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- =====================================================
-- 6. BILLS - Sales Bills
-- =====================================================
CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    bill_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT,
    doctor_name TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Bill-level discount
    discount_type TEXT CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    
    -- GST Totals
    taxable_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Final Amount
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    round_off DECIMAL(5,2) DEFAULT 0,
    
    -- Payment
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'ONLINE', 'CREDIT', 'SPLIT')),
    cash_amount DECIMAL(12,2) DEFAULT 0,
    online_amount DECIMAL(12,2) DEFAULT 0,
    credit_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED', 'RETURNED')),
    notes TEXT,
    total_items INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_payment ON bills(payment_mode);

-- =====================================================
-- 7. BILL_ITEMS - Bill Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    medicine_id INTEGER NOT NULL REFERENCES medicines(id),
    
    -- Item snapshot (for historical accuracy)
    medicine_name TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    rack TEXT,
    box TEXT,
    
    -- Quantity & Price
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    price_type TEXT NOT NULL CHECK (price_type IN ('INCLUSIVE', 'EXCLUSIVE')),
    
    -- Item-level discount
    discount_type TEXT CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    
    -- GST Calculation
    taxable_value DECIMAL(12,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    sgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Line Total
    total DECIMAL(12,2) NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_batch ON bill_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_medicine ON bill_items(medicine_id);

-- =====================================================
-- 8. PURCHASES - Purchase Bills
-- =====================================================
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Amounts
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Payment
    payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID')),
    paid_amount DECIMAL(12,2) DEFAULT 0,
    due_date DATE,
    
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(payment_status);

-- =====================================================
-- 9. PURCHASE_ITEMS - Purchase Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id),
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    
    -- Quantity
    quantity INTEGER NOT NULL,
    free_quantity INTEGER DEFAULT 0,
    
    -- Pricing
    purchase_price DECIMAL(10,2) NOT NULL,
    mrp DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    
    -- GST
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    sgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Total
    total DECIMAL(12,2) NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_medicine ON purchase_items(medicine_id);

-- =====================================================
-- 10. PURCHASE_RETURNS - Returns to Supplier
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL UNIQUE,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    purchase_id INTEGER REFERENCES purchases(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    reason TEXT NOT NULL CHECK (reason IN ('EXPIRY', 'DAMAGE', 'OVERSTOCK', 'OTHER')),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED')),
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date);

-- =====================================================
-- 11. PURCHASE_RETURN_ITEMS - Return Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    medicine_id INTEGER NOT NULL REFERENCES medicines(id),
    
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    sgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. SALES_RETURNS - Customer Returns
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL UNIQUE,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    reason TEXT,
    refund_mode TEXT CHECK (refund_mode IN ('CASH', 'CREDIT_NOTE', 'ADJUSTMENT')),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    status TEXT DEFAULT 'COMPLETED',
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_bill ON sales_returns(bill_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON sales_returns(return_date);

-- =====================================================
-- 13. SALES_RETURN_ITEMS - Return Line Items
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    bill_item_id INTEGER NOT NULL REFERENCES bill_items(id),
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    sgst DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 14. CREDITS - Credit Transactions (Udhar)
-- =====================================================
CREATE TABLE IF NOT EXISTS credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    bill_id INTEGER REFERENCES bills(id),
    
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SALE', 'PAYMENT', 'ADJUSTMENT', 'RETURN')),
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    
    payment_mode TEXT,
    reference TEXT,
    notes TEXT,
    
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_credits_bill ON credits(bill_id);
CREATE INDEX IF NOT EXISTS idx_credits_type ON credits(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(created_at);

-- =====================================================
-- 15. AUDIT_LOG - Activity Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- =====================================================
-- 16. SETTINGS - Application Configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 17. BILL_SEQUENCE - Bill Number Generation
-- =====================================================
CREATE TABLE IF NOT EXISTS bill_sequence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    prefix TEXT NOT NULL DEFAULT 'INV',
    current_number INTEGER NOT NULL DEFAULT 0,
    financial_year TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 18. SCHEDULED_MEDICINE_RECORDS - For Schedule H/H1 Drugs
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_medicine_records (
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
);

CREATE INDEX IF NOT EXISTS idx_scheduled_bill ON scheduled_medicine_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_medicine ON scheduled_medicine_records(medicine_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_patient ON scheduled_medicine_records(patient_name);
CREATE INDEX IF NOT EXISTS idx_scheduled_date ON scheduled_medicine_records(created_at);

-- =====================================================
-- 19. RUNNING_BILLS - Pending Stock Reconciliation
-- =====================================================
CREATE TABLE IF NOT EXISTS running_bills (
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
);

CREATE INDEX IF NOT EXISTS idx_running_bills_bill ON running_bills(bill_id);
CREATE INDEX IF NOT EXISTS idx_running_bills_status ON running_bills(status);

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Default Admin User (password: admin123)
INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES
(1, 'admin', '$2b$10$defaulthashforadmin123', 'Administrator', 'admin');

-- Bill Sequence Initialization
INSERT OR IGNORE INTO bill_sequence (id, prefix, current_number, financial_year) VALUES
(1, 'INV', 0, '2024-25');

-- Default Settings
INSERT OR IGNORE INTO settings (key, value, category, description) VALUES
('shop_name', 'Medical Store', 'shop', 'Shop name for bills'),
('shop_address', '', 'shop', 'Shop address'),
('shop_phone', '', 'shop', 'Shop phone number'),
('shop_gstin', '', 'shop', 'GST Number'),
('shop_drug_license', '', 'shop', 'Drug License Number'),
('shop_state', 'Tamil Nadu', 'shop', 'State for CGST/SGST'),
('bill_prefix', 'INV', 'billing', 'Bill number prefix'),
('thermal_printer_width', '80', 'printing', 'Thermal printer width in mm'),
('backup_path', './backups', 'system', 'Backup directory path'),
('last_backup_date', '', 'system', 'Last backup timestamp'),
('expiry_alert_days', '30', 'alerts', 'Days before expiry to alert'),
('low_stock_threshold', '10', 'alerts', 'Low stock alert threshold'),
('non_moving_days', '30', 'alerts', 'Days to consider non-moving'),
('default_gst_rate', '12', 'gst', 'Default GST rate for new medicines'),
('round_off_enabled', '1', 'billing', 'Enable bill rounding');

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Stock with Medicine Details
CREATE VIEW IF NOT EXISTS v_stock AS
SELECT 
    b.id AS batch_id,
    b.batch_number,
    b.expiry_date,
    b.purchase_price,
    b.mrp,
    b.selling_price,
    b.price_type,
    b.quantity,
    b.rack,
    b.box,
    b.last_sold_date,
    m.id AS medicine_id,
    m.name AS medicine_name,
    m.generic_name,
    m.manufacturer,
    m.hsn_code,
    m.gst_rate,
    m.taxability,
    m.category,
    m.unit,
    m.reorder_level,
    CASE 
        WHEN b.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN b.quantity <= m.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END AS stock_status,
    CASE 
        WHEN b.expiry_date <= date('now') THEN 'EXPIRED'
        WHEN b.expiry_date <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
    END AS expiry_status,
    julianday(b.expiry_date) - julianday('now') AS days_to_expiry
FROM batches b
JOIN medicines m ON b.medicine_id = m.id
WHERE b.is_active = 1 AND m.is_active = 1;

-- View: Expiring Items (Next 30 Days)
CREATE VIEW IF NOT EXISTS v_expiring_items AS
SELECT * FROM v_stock
WHERE expiry_status IN ('EXPIRED', 'EXPIRING_SOON')
ORDER BY expiry_date ASC;

-- View: Low Stock Items
CREATE VIEW IF NOT EXISTS v_low_stock AS
SELECT * FROM v_stock
WHERE stock_status IN ('OUT_OF_STOCK', 'LOW_STOCK')
ORDER BY quantity ASC;

-- View: Non-Moving Items (Not sold in 30 days)
CREATE VIEW IF NOT EXISTS v_non_moving_items AS
SELECT * FROM v_stock
WHERE quantity > 0 
AND (last_sold_date IS NULL OR last_sold_date < date('now', '-30 days'))
ORDER BY last_sold_date ASC NULLS FIRST;

-- View: Customer Credit Summary
CREATE VIEW IF NOT EXISTS v_customer_credits AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.credit_limit,
    c.current_balance,
    (SELECT COUNT(*) FROM bills b WHERE b.customer_id = c.id AND b.payment_mode = 'CREDIT') AS total_credit_bills,
    (SELECT MAX(created_at) FROM credits cr WHERE cr.customer_id = c.id) AS last_transaction_date
FROM customers c
WHERE c.current_balance > 0
ORDER BY c.current_balance DESC;

-- View: Today's Sales Summary
CREATE VIEW IF NOT EXISTS v_today_sales AS
SELECT 
    COUNT(*) AS total_bills,
    COALESCE(SUM(grand_total), 0) AS total_amount,
    COALESCE(SUM(cash_amount), 0) AS cash_amount,
    COALESCE(SUM(online_amount), 0) AS online_amount,
    COALESCE(SUM(credit_amount), 0) AS credit_amount,
    COALESCE(SUM(total_gst), 0) AS total_gst
FROM bills
WHERE date(bill_date) = date('now') AND status = 'COMPLETED';

-- =====================================================
-- TRIGGERS FOR DATA INTEGRITY
-- =====================================================

-- Trigger: Update stock on sale
CREATE TRIGGER IF NOT EXISTS trg_update_stock_on_sale
AFTER INSERT ON bill_items
BEGIN
    UPDATE batches 
    SET quantity = quantity - NEW.quantity,
        last_sold_date = date('now'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.batch_id;
END;

-- Trigger: Update bill totals
CREATE TRIGGER IF NOT EXISTS trg_update_bill_totals
AFTER INSERT ON bill_items
BEGIN
    UPDATE bills SET
        subtotal = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        taxable_total = (SELECT COALESCE(SUM(taxable_value), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        total_cgst = (SELECT COALESCE(SUM(cgst), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        total_sgst = (SELECT COALESCE(SUM(sgst), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        total_gst = (SELECT COALESCE(SUM(total_gst), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        grand_total = (SELECT COALESCE(SUM(total), 0) FROM bill_items WHERE bill_id = NEW.bill_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.bill_id;
END;

-- Trigger: Update customer balance on credit sale
CREATE TRIGGER IF NOT EXISTS trg_update_customer_balance_on_credit
AFTER INSERT ON credits
WHEN NEW.transaction_type = 'SALE'
BEGIN
    UPDATE customers 
    SET current_balance = current_balance + NEW.amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.customer_id;
END;

-- Trigger: Update customer balance on payment
CREATE TRIGGER IF NOT EXISTS trg_update_customer_balance_on_payment
AFTER INSERT ON credits
WHEN NEW.transaction_type = 'PAYMENT'
BEGIN
    UPDATE customers 
    SET current_balance = current_balance - NEW.amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.customer_id;
END;

-- Trigger: Restore stock on sales return
CREATE TRIGGER IF NOT EXISTS trg_restore_stock_on_return
AFTER INSERT ON sales_return_items
BEGIN
    UPDATE batches 
    SET quantity = quantity + NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.batch_id;
END;

-- Trigger: Update timestamp on settings change
CREATE TRIGGER IF NOT EXISTS trg_settings_updated
AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;
