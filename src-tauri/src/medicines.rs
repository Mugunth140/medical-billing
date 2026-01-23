use flate2::read::GzDecoder;
use rusqlite::Connection;
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::Manager;

/// Embedded compressed medicines database (gzip compressed)
const MEDICINES_DB_GZ: &[u8] = include_bytes!("../resources/medicines-bundle.db.gz");

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
        .app_config_dir()
        .map(|p| p.join("medbill.db"))
        .map_err(|e| format!("Failed to get config directory: {}", e))
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
pub async fn import_bundled_medicines(app: tauri::AppHandle) -> Result<u32, String> {
    let db_path = get_db_path(&app)?;
    let bundle_path = get_bundle_extract_path(&app)?;

    // Open main database
    let main_db =
        Connection::open(&db_path).map_err(|e| format!("Failed to open main database: {}", e))?;

    // Check current medicine count
    let current_count: u32 = main_db
        .query_row("SELECT COUNT(*) FROM medicines", [], |row| row.get(0))
        .unwrap_or(0);

    log::info!("Current medicines count: {}", current_count);

    // Only import if no medicines exist
    if current_count > 0 {
        log::info!("Medicines already exist, skipping import");
        return Ok(current_count);
    }

    // Extract embedded database if needed
    if !bundle_path.exists() {
        extract_embedded_database(&bundle_path)?;
    }

    log::info!("Importing medicines from embedded database...");

    // Attach bundled database
    main_db
        .execute(
            "ATTACH DATABASE ?1 AS bundle",
            rusqlite::params![bundle_path.to_string_lossy()],
        )
        .map_err(|e| format!("Failed to attach bundle database: {}", e))?;

    // Copy medicines from bundle to main database
    let imported = main_db
        .execute(
            "INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, category, drug_type, pack_size, unit, reorder_level, is_active)
             SELECT name, generic_name, manufacturer, hsn_code, category, drug_type, pack_size, unit, reorder_level, is_active
             FROM bundle.medicines",
            [],
        )
        .map_err(|e| format!("Failed to import medicines: {}", e))?;

    // Detach bundle
    main_db
        .execute("DETACH DATABASE bundle", [])
        .map_err(|e| format!("Failed to detach bundle: {}", e))?;

    // Clean up extracted bundle file (optional, saves space)
    let _ = std::fs::remove_file(&bundle_path);

    log::info!("Successfully imported {} medicines", imported);

    Ok(imported as u32)
}

#[tauri::command]
pub fn get_medicines_count(app: tauri::AppHandle) -> Result<u32, String> {
    let db_path = get_db_path(&app)?;

    if !db_path.exists() {
        return Ok(0);
    }

    let db = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    let count: u32 = db
        .query_row(
            "SELECT COUNT(*) FROM medicines WHERE is_active = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(count)
}
