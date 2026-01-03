PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE purchase_returns_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL UNIQUE,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    purchase_id INTEGER REFERENCES purchases (id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
    reason TEXT CHECK (
        reason IN (
            'EXPIRY',
            'DAMAGE',
            'OVERSTOCK',
            'OTHER'
        )
    ),
    total_amount DECIMAL(12, 2) NOT NULL,
    total_gst DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'APPROVED',
            'COMPLETED',
            'REJECTED'
        )
    ),
    notes TEXT,
    user_id INTEGER NOT NULL REFERENCES users (id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO purchase_returns_new SELECT * FROM purchase_returns;

DROP TABLE purchase_returns;

ALTER TABLE purchase_returns_new RENAME TO purchase_returns;

COMMIT;

PRAGMA foreign_keys = ON;