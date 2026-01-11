#!/usr/bin/env node
/**
 * Create a bundled medicines database for embedding in the app
 * This creates a SQLite database with the medicines table pre-populated
 * The database will be bundled with the Tauri app and used for initial seeding
 */

import DatabaseConstructor from 'better-sqlite3';
import { createReadStream, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Input CSV file
const CSV_PATH = resolve(__dirname, '../dataset/indian_medicine_data.csv');

// Output bundled database file (in src-tauri for bundling)
const DB_PATH = resolve(__dirname, '../src-tauri/resources/medicines-bundle.db');

const BATCH_SIZE = 5000;

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
 */
function extractCategory(packSizeLabel) {
    if (!packSizeLabel) return null;
    const match = packSizeLabel.match(/^([^(]+)/);
    if (match) {
        const category = match[1].trim();
        if (['tablet', 'capsule', 'syrup', 'injection', 'cream', 'gel', 'drops', 'ointment', 'suspension', 'powder', 'solution', 'lotion', 'inhaler', 'spray', 'respules', 'sachets', 'granules', 'patch', 'suppository', 'vial', 'ampoule', 'strip', 'bottle', 'tube', 'jar'].some(t => category.toLowerCase().includes(t))) {
            return category;
        }
    }
    return packSizeLabel.split(' ')[0] || null;
}

async function main() {
    console.log('===========================================');
    console.log('Create Bundled Medicines Database');
    console.log('===========================================\n');

    // Check if CSV exists
    if (!existsSync(CSV_PATH)) {
        console.error(`Error: CSV file not found at ${CSV_PATH}`);
        process.exit(1);
    }

    // Create database
    console.log(`Creating database at: ${DB_PATH}`);
    const db = new DatabaseConstructor(DB_PATH);

    // Create medicines table with exact schema
    db.exec(`
        DROP TABLE IF EXISTS medicines;
        CREATE TABLE medicines (
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
        );
        CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
        CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON medicines(manufacturer);
        CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
    `);
    console.log('Created medicines table');

    // Prepare insert statement
    const insertStmt = db.prepare(`
        INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, category, pack_size, drug_type)
        VALUES (?, ?, ?, '3004', ?, ?, ?)
    `);

    // Process CSV
    const fileStream = createReadStream(CSV_PATH, { encoding: 'utf-8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineNumber = 0;
    let importedCount = 0;
    let skippedCount = 0;
    let batch = [];
    const startTime = Date.now();

    // Headers: id, name, price(₹), Is_discontinued, manufacturer_name, type, pack_size_label, short_composition1, short_composition2

    for await (const line of rl) {
        lineNumber++;

        // Skip header
        if (lineNumber === 1) continue;

        // Skip empty lines
        if (!line.trim()) continue;

        try {
            const fields = parseCSVLine(line);
            
            // Fields: [id, name, price, Is_discontinued, manufacturer_name, type, pack_size_label, composition1, composition2]
            const isDiscontinued = fields[3]?.toLowerCase() === 'true';
            
            // Skip discontinued medicines
            if (isDiscontinued) {
                skippedCount++;
                continue;
            }

            const name = fields[1]?.trim();
            if (!name) {
                skippedCount++;
                continue;
            }

            const manufacturer = fields[4]?.trim() || null;
            const drugType = fields[5]?.trim() || null;
            const packSizeLabel = fields[6]?.trim() || null;
            const composition1 = fields[7]?.trim() || '';
            const composition2 = fields[8]?.trim() || '';

            // Combine compositions for generic_name
            const genericName = [composition1, composition2].filter(Boolean).join(' + ') || null;
            
            // Extract category from pack_size_label
            const category = extractCategory(packSizeLabel);

            batch.push([name, genericName, manufacturer, category, packSizeLabel, drugType]);

            // Insert in batches for performance
            if (batch.length >= BATCH_SIZE) {
                const transaction = db.transaction(() => {
                    for (const params of batch) {
                        insertStmt.run(...params);
                    }
                });
                transaction();
                importedCount += batch.length;
                batch = [];

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                process.stdout.write(`\r  Imported: ${importedCount.toLocaleString()} | Skipped: ${skippedCount.toLocaleString()} | Time: ${elapsed}s`);
            }
        } catch (err) {
            skippedCount++;
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        const transaction = db.transaction(() => {
            for (const params of batch) {
                insertStmt.run(...params);
            }
        });
        transaction();
        importedCount += batch.length;
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n===========================================`);
    console.log(`Bundle Created!`);
    console.log(`===========================================`);
    console.log(`  Total medicines: ${importedCount.toLocaleString()}`);
    console.log(`  Skipped: ${skippedCount.toLocaleString()}`);
    console.log(`  Time: ${totalTime}s`);
    console.log(`  Output: ${DB_PATH}`);
    console.log(`===========================================\n`);

    db.close();
}

main().catch(console.error);
