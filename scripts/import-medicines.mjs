#!/usr/bin/env node

/**
 * Medicine Dataset Import Script
 * 
 * Imports the Indian medicine dataset (CSV) into the SQLite database.
 * This script uses streaming to handle large datasets efficiently.
 * 
 * Usage: npm run import:medicines
 */

import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import { dirname, resolve } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CSV_PATH = resolve(__dirname, '../dataset/indian_medicine_data.csv');
// Tauri app stores database in ~/.config/com.velanmedicals.app/
const DB_PATH = resolve(process.env.HOME, '.config/com.velanmedicals.app/medbill.db');
const BATCH_SIZE = 1000;

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result;
}

/**
 * Extract category from pack_size_label
 * e.g., "strip of 10 tablets" -> "Tablet"
 */
function extractCategory(packSize) {
    if (!packSize) return null;
    
    const lower = packSize.toLowerCase();
    if (lower.includes('tablet')) return 'Tablet';
    if (lower.includes('capsule')) return 'Capsule';
    if (lower.includes('syrup')) return 'Syrup';
    if (lower.includes('suspension')) return 'Suspension';
    if (lower.includes('injection')) return 'Injection';
    if (lower.includes('cream')) return 'Cream';
    if (lower.includes('ointment')) return 'Ointment';
    if (lower.includes('gel')) return 'Gel';
    if (lower.includes('drops') || lower.includes('drop')) return 'Drops';
    if (lower.includes('inhaler')) return 'Inhaler';
    if (lower.includes('lotion')) return 'Lotion';
    if (lower.includes('powder')) return 'Powder';
    if (lower.includes('solution')) return 'Solution';
    if (lower.includes('spray')) return 'Spray';
    if (lower.includes('soap')) return 'Soap';
    if (lower.includes('shampoo')) return 'Shampoo';
    
    return 'Other';
}

/**
 * Main import function
 */
async function importMedicines() {
    console.log('===========================================');
    console.log('Medicine Dataset Import');
    console.log('===========================================\n');
    
    console.log(`CSV Path: ${CSV_PATH}`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`Batch Size: ${BATCH_SIZE}\n`);
    
    // Open database
    const db = new Database(DB_PATH);
    
    // Enable WAL mode
    db.pragma('journal_mode = WAL');
    
    // Create medicines table if not exists
    console.log('Ensuring medicines table exists...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS medicines (
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
        )
    `);
    
    // Create index for faster searching
    db.exec(`CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON medicines(manufacturer)`);
    
    // Check current count
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get();
    console.log(`Existing medicines in database: ${existingCount.count}`);
    
    if (existingCount.count > 10000) {
        console.log('\n⚠️  Database already contains significant medicine data.');
        console.log('Skipping import to prevent duplicates.');
        console.log('Delete existing medicines first if you want to reimport.\n');
        db.close();
        return;
    }
    
    // Prepare insert statement
    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO medicines (
            name, generic_name, manufacturer, hsn_code, 
            category, drug_type, pack_size, unit, reorder_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Create readline interface
    const fileStream = createReadStream(CSV_PATH, { encoding: 'utf8' });
    const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    
    let lineNumber = 0;
    let imported = 0;
    let skipped = 0;
    let batch = [];
    let headers = null;
    
    const startTime = Date.now();
    
    // Test insert first
    console.log('Testing insert...');
    try {
        insertStmt.run('TEST_MEDICINE', 'Test Generic', 'Test Mfg', '3004', 'Test', 'allopathy', 'test pack', 'PCS', 10);
        const testCount = db.prepare('SELECT COUNT(*) as count FROM medicines WHERE name = ?').get('TEST_MEDICINE');
        console.log(`Test insert result: ${testCount.count} rows`);
        if (testCount.count === 0) {
            console.error('ERROR: Test insert failed - data not persisting!');
            db.close();
            return;
        }
        // Delete test row
        db.prepare('DELETE FROM medicines WHERE name = ?').run('TEST_MEDICINE');
        console.log('Test insert successful, proceeding with import...\n');
    } catch (testErr) {
        console.error('Test insert failed:', testErr);
        db.close();
        return;
    }
    
    // Begin transaction for batch inserts
    const insertBatch = db.transaction((records) => {
        for (const record of records) {
            try {
                insertStmt.run(
                    record.name,
                    record.generic_name,
                    record.manufacturer,
                    record.hsn_code,
                    record.category,
                    record.drug_type,
                    record.pack_size,
                    record.unit,
                    record.reorder_level
                );
                imported++;
            } catch (err) {
                if (imported < 10) console.error('Insert error:', err.message);
                skipped++;
            }
        }
    });
    
    console.log('Importing medicines...\n');

    
    for await (const line of rl) {
        lineNumber++;
        
        // Skip empty lines
        if (!line.trim()) continue;
        
        // Parse header
        if (lineNumber === 1) {
            headers = parseCSVLine(line);
            console.log('Headers:', headers.join(', '));
            console.log('');
            continue;
        }
        
        // Parse data line
        const values = parseCSVLine(line);
        
        // Map CSV columns to record
        // CSV columns: id, name, price(₹), Is_discontinued, manufacturer_name, type, pack_size_label, short_composition1, short_composition2
        const isDiscontinued = values[3]?.toUpperCase() === 'TRUE';
        
        // Skip discontinued medicines
        if (isDiscontinued) {
            skipped++;
            continue;
        }
        
        const name = values[1];
        const manufacturer = values[4];
        const drugType = values[5];
        const packSize = values[6];
        const composition1 = values[7];
        const composition2 = values[8];
        
        // Skip if no name
        if (!name || name.trim() === '') {
            skipped++;
            continue;
        }
        
        // Combine compositions for generic_name
        let genericName = composition1 || '';
        if (composition2 && composition2.trim()) {
            genericName = genericName ? `${genericName} + ${composition2}` : composition2;
        }
        
        // Create record
        const record = {
            name: name.trim(),
            generic_name: genericName.trim() || null,
            manufacturer: manufacturer?.trim() || null,
            hsn_code: '3004', // Default HSN for medicines
            category: extractCategory(packSize),
            drug_type: drugType?.trim() || 'allopathy',
            pack_size: packSize?.trim() || null,
            unit: 'PCS',
            reorder_level: 10
        };
        
        batch.push(record);
        
        // Insert batch when full
        if (batch.length >= BATCH_SIZE) {
            insertBatch(batch);
            batch = [];
            
            // Progress update
            if (imported % 10000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`  Imported: ${imported.toLocaleString()} | Skipped: ${skipped.toLocaleString()} | Time: ${elapsed}s`);
            }
        }
    }
    
    // Insert remaining batch
    if (batch.length > 0) {
        insertBatch(batch);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n===========================================');
    console.log('Import Complete!');
    console.log('===========================================');
    console.log(`  Total lines processed: ${lineNumber.toLocaleString()}`);
    console.log(`  Medicines imported: ${imported.toLocaleString()}`);
    console.log(`  Skipped (discontinued/invalid): ${skipped.toLocaleString()}`);
    console.log(`  Total time: ${totalTime}s`);
    console.log('===========================================\n');
    
    // Force WAL checkpoint to persist data
    console.log('Checkpointing WAL...');
    db.pragma('wal_checkpoint(TRUNCATE)');
    
    // Final count
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get();
    console.log(`Total medicines in database: ${finalCount.count.toLocaleString()}\n`);
    
    db.close();
    console.log('Database closed successfully.');
}

// Run import
importMedicines().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
