use flate2::read::GzDecoder;
use rusqlite::Connection;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

/// Embedded compressed medicines database (gzip compressed)
const MEDICINES_DB_GZ: &[u8] = include_bytes!("../resources/medicines-bundle.db.gz");

/// Guard to prevent concurrent imports
static IMPORT_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// Get the path where bundled database should be extracted
fn get_bundle_extract_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("medicines-bundle.db"))
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

/// Get the main database path (matches Tauri SQL plugin location)
fn get_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("medbill.db"))
        .map_err(|e| format!("Failed to get data directory: {}", e))
}

/// Extract embedded compressed database to a file
fn extract_embedded_database(target_path: &PathBuf) -> Result<(), String> {
    log::info!("Extracting embedded medicines database...");

    // Decompress the embedded gzip data
    let mut decoder = GzDecoder::new(MEDICINES_DB_GZ);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| format!("Failed to decompress medicines database: {}", e))?;

    log::info!(
        "Decompressed {} bytes from {} compressed bytes",
        decompressed.len(),
        MEDICINES_DB_GZ.len()
    );

    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Write to file
    let mut file =
        File::create(target_path).map_err(|e| format!("Failed to create bundle file: {}", e))?;
    file.write_all(&decompressed)
        .map_err(|e| format!("Failed to write bundle file: {}", e))?;

    log::info!("Extracted medicines database to {:?}", target_path);
    Ok(())
}

#[tauri::command]
pub async fn import_bundled_medicines(app: tauri::AppHandle, force: Option<bool>) -> Result<u32, String> {
    // Concurrency guard: prevent duplicate simultaneous imports
    if IMPORT_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        log::warn!("Import already in progress, skipping duplicate call");
        return Ok(0);
    }

    // Use a scope guard to always reset the flag
    let result = do_import(&app, force).await;
    IMPORT_IN_PROGRESS.store(false, Ordering::SeqCst);
    result
}

async fn do_import(app: &tauri::AppHandle, force: Option<bool>) -> Result<u32, String> {
    let db_path = get_db_path(app)?;
    let bundle_path = get_bundle_extract_path(app)?;
    let force = force.unwrap_or(false);

    log::info!("Opening main database at: {:?}", db_path);

    // Open main database
    let main_db =
        Connection::open(&db_path).map_err(|e| format!("Failed to open main database: {}", e))?;

    // Enable WAL mode and read any pending WAL entries from the JS connection
    main_db.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA wal_checkpoint(PASSIVE);"
    ).map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Ensure medicines table exists in the MAIN database
    // (JS creates it, but Rust must guarantee it's visible here)
    main_db.execute_batch(
        "CREATE TABLE IF NOT EXISTS medicines (
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
        )"
    ).map_err(|e| format!("Failed to ensure medicines table: {}", e))?;

    // CRITICAL: Always use main.medicines to avoid resolving to an attached DB
    let current_count: u32 = main_db
        .query_row("SELECT COUNT(*) FROM main.medicines", [], |row| row.get(0))
        .unwrap_or(0);

    log::info!("Current medicines count in main DB: {}, force: {}", current_count, force);

    // Only import if no medicines exist (unless force mode for post-restore merge)
    if current_count > 0 && !force {
        log::info!("Medicines already exist ({}), skipping import", current_count);
        return Ok(current_count);
    }

    // Extract embedded database if needed
    if !bundle_path.exists() {
        extract_embedded_database(&bundle_path)?;
    }

    log::info!("Importing medicines from embedded database (force={})...", force);

    // Attach bundled database
    main_db
        .execute(
            "ATTACH DATABASE ?1 AS bundle",
            rusqlite::params![bundle_path.to_string_lossy()],
        )
        .map_err(|e| format!("Failed to attach bundle database: {}", e))?;

    // CRITICAL: Always qualify target as main.medicines and source as bundle.medicines
    // Without main. prefix, SQLite may resolve unqualified 'medicines' to bundle.medicines
    // if the main database's table isn't visible (WAL issue), causing data to go into the
    // bundle file instead of the main database.
    let insert_sql = if force {
        "INSERT INTO main.medicines (name, generic_name, manufacturer, hsn_code, category, drug_type, pack_size, unit, reorder_level, is_active)
         SELECT b.name, b.generic_name, b.manufacturer, b.hsn_code, b.category, b.drug_type, b.pack_size, b.unit, b.reorder_level, b.is_active
         FROM bundle.medicines b
         WHERE NOT EXISTS (SELECT 1 FROM main.medicines WHERE name = b.name)"
    } else {
        "INSERT INTO main.medicines (name, generic_name, manufacturer, hsn_code, category, drug_type, pack_size, unit, reorder_level, is_active)
         SELECT name, generic_name, manufacturer, hsn_code, category, drug_type, pack_size, unit, reorder_level, is_active
         FROM bundle.medicines"
    };

    let imported = main_db
        .execute(insert_sql, [])
        .map_err(|e| format!("Failed to import medicines: {}", e))?;

    // Detach bundle
    main_db
        .execute("DETACH DATABASE bundle", [])
        .map_err(|e| format!("Failed to detach bundle: {}", e))?;

    // Clean up extracted bundle file (optional, saves space)
    let _ = std::fs::remove_file(&bundle_path);

    // Get final count (after DETACH, main.medicines is the only option, but be explicit)
    let final_count: u32 = main_db
        .query_row("SELECT COUNT(*) FROM main.medicines", [], |row| row.get(0))
        .unwrap_or(0);

    log::info!("Successfully imported {} new medicines (total: {})", imported, final_count);

    Ok(final_count)
}

#[tauri::command]
pub fn get_medicines_count(app: tauri::AppHandle) -> Result<u32, String> {
    let db_path = get_db_path(&app)?;

    if !db_path.exists() {
        return Ok(0);
    }

    let db = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable WAL mode to read any pending writes from the JS connection
    let _ = db.execute_batch("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

    let count: u32 = db
        .query_row(
            "SELECT COUNT(*) FROM main.medicines WHERE is_active = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(count)
}
