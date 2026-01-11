use rusqlite::Connection;
use std::path::PathBuf;
use tauri::Manager;

/// Get the path to a bundled resource
fn get_resource_path(app: &tauri::AppHandle, resource: &str) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map(|p| p.join(resource))
        .map_err(|e| format!("Failed to get resource directory: {}", e))
}

/// Get the main database path (matches Tauri SQL plugin location - ~/.config/)
fn get_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("medbill.db"))
        .map_err(|e| format!("Failed to get config directory: {}", e))
}

#[tauri::command]
pub async fn import_bundled_medicines(app: tauri::AppHandle) -> Result<u32, String> {
    // Get paths
    let bundle_path = get_resource_path(&app, "resources/medicines-bundle.db")?;
    let db_path = get_db_path(&app)?;

    // Check if bundle exists
    if !bundle_path.exists() {
        return Err(format!(
            "Bundled medicines database not found at {:?}",
            bundle_path
        ));
    }

    // Open main database
    let main_db =
        Connection::open(&db_path).map_err(|e| format!("Failed to open main database: {}", e))?;

    // Check current medicine count
    let current_count: u32 = main_db
        .query_row("SELECT COUNT(*) FROM medicines", [], |row| row.get(0))
        .unwrap_or(0);

    log::info!(
        "Current medicines count: {}, bundle at: {:?}",
        current_count,
        bundle_path
    );

    // Only import if no medicines exist
    if current_count > 0 {
        log::info!("Medicines already exist, skipping import");
        return Ok(current_count);
    }

    log::info!("Importing medicines from bundled database...");

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
