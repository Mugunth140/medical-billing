// =====================================================
// Backup Service
// SQLite Database Backup & Restore Operations
// =====================================================

import { appDataDir } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir, readDir, remove, stat } from '@tauri-apps/plugin-fs';
import { closeDatabase, initDatabase } from './database';

/**
 * Backup file information
 */
export interface BackupInfo {
    filename: string;
    filepath: string;
    createdAt: Date;
    sizeBytes: number;
    isAutomatic: boolean;
}

/**
 * Get the backup folder path
 */
export async function getBackupFolderPath(): Promise<string> {
    const appData = await appDataDir();
    return `${appData}\\backups`;
}

/**
 * Get the database file path
 */
export async function getDatabasePath(): Promise<string> {
    const appData = await appDataDir();
    return `${appData}\\medbill.db`;
}

/**
 * Ensure backup folder exists
 */
async function ensureBackupFolder(): Promise<string> {
    const backupFolder = await getBackupFolderPath();

    try {
        const folderExists = await exists(backupFolder);
        if (!folderExists) {
            await mkdir(backupFolder, { recursive: true });
            console.log('[Backup] Created backup folder:', backupFolder);
        }
    } catch (error) {
        console.error('[Backup] Error ensuring backup folder exists:', error);
        // Try to create anyway
        await mkdir(backupFolder, { recursive: true });
    }

    return backupFolder;
}

/**
 * Format date as DDMMYYYY
 */
function formatDateDDMMYYYY(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
}

/**
 * Format date with time as DDMMYYYY_HHMMSS
 */
function formatDateTimestamp(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}${month}${year}_${hours}${minutes}${seconds}`;
}

/**
 * Parse backup filename to extract date
 */
function parseBackupFilename(filename: string): { date: Date; isAutomatic: boolean } | null {
    // Match Backup_DDMMYYYY.db (automatic daily backup)
    const dailyMatch = filename.match(/^Backup_(\d{2})(\d{2})(\d{4})\.db$/);
    if (dailyMatch) {
        const [, day, month, year] = dailyMatch;
        return {
            date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
            isAutomatic: true
        };
    }

    // Match Backup_DDMMYYYY_HHMMSS.db (manual backup)
    const manualMatch = filename.match(/^Backup_(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})(\d{2})\.db$/);
    if (manualMatch) {
        const [, day, month, year, hours, minutes, seconds] = manualMatch;
        return {
            date: new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            ),
            isAutomatic: false
        };
    }

    return null;
}

/**
 * Create a manual backup with timestamp
 */
export async function createBackup(): Promise<BackupInfo> {
    const backupFolder = await ensureBackupFolder();
    const dbPath = await getDatabasePath();
    const now = new Date();
    const filename = `Backup_${formatDateTimestamp(now)}.db`;
    const backupPath = `${backupFolder}\\${filename}`;

    console.log('[Backup] Creating manual backup:', filename);
    console.log('[Backup] Source:', dbPath);
    console.log('[Backup] Destination:', backupPath);

    try {
        // Close database connection to ensure all data is flushed
        await closeDatabase();

        // Copy the database file
        await copyFile(dbPath, backupPath);

        // Reinitialize database connection
        await initDatabase();

        // Get backup file info
        const fileInfo = await stat(backupPath);

        console.log('[Backup] Manual backup created successfully');

        return {
            filename,
            filepath: backupPath,
            createdAt: now,
            sizeBytes: fileInfo.size,
            isAutomatic: false
        };
    } catch (error) {
        // Make sure to reinitialize database even if backup fails
        await initDatabase();
        console.error('[Backup] Failed to create backup:', error);
        throw new Error(`Failed to create backup: ${error}`);
    }
}

/**
 * Create automatic daily backup if not already done today
 */
export async function createDailyBackup(): Promise<BackupInfo | null> {
    const backupFolder = await ensureBackupFolder();
    const dbPath = await getDatabasePath();
    const now = new Date();
    const filename = `Backup_${formatDateDDMMYYYY(now)}.db`;
    const backupPath = `${backupFolder}\\${filename}`;

    console.log('[Backup] Checking daily backup:', filename);

    try {
        // Check if today's backup already exists
        const backupExists = await exists(backupPath);
        if (backupExists) {
            console.log('[Backup] Daily backup already exists for today');
            return null;
        }

        // Close database connection to ensure all data is flushed
        await closeDatabase();

        // Copy the database file
        await copyFile(dbPath, backupPath);

        // Reinitialize database connection
        await initDatabase();

        // Get backup file info
        const fileInfo = await stat(backupPath);

        console.log('[Backup] Daily backup created successfully');

        return {
            filename,
            filepath: backupPath,
            createdAt: now,
            sizeBytes: fileInfo.size,
            isAutomatic: true
        };
    } catch (error) {
        // Make sure to reinitialize database even if backup fails
        try {
            await initDatabase();
        } catch {
            // Ignore reinitialization errors
        }
        console.error('[Backup] Failed to create daily backup:', error);
        return null;
    }
}

/**
 * List all available backups sorted by date (newest first)
 */
export async function listBackups(): Promise<BackupInfo[]> {
    const backupFolder = await ensureBackupFolder();
    const backups: BackupInfo[] = [];

    try {
        const entries = await readDir(backupFolder);

        for (const entry of entries) {
            if (entry.isFile && entry.name.endsWith('.db')) {
                const parsed = parseBackupFilename(entry.name);
                if (parsed) {
                    try {
                        const filepath = `${backupFolder}\\${entry.name}`;
                        const fileInfo = await stat(filepath);

                        backups.push({
                            filename: entry.name,
                            filepath,
                            createdAt: parsed.date,
                            sizeBytes: fileInfo.size,
                            isAutomatic: parsed.isAutomatic
                        });
                    } catch (error) {
                        console.warn('[Backup] Could not stat file:', entry.name, error);
                    }
                }
            }
        }

        // Sort by date, newest first
        backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
        console.error('[Backup] Failed to list backups:', error);
    }

    return backups;
}

/**
 * Restore database from a backup file
 */
export async function restoreFromBackup(filename: string): Promise<void> {
    const backupFolder = await getBackupFolderPath();
    const dbPath = await getDatabasePath();
    const backupPath = `${backupFolder}\\${filename}`;

    console.log('[Backup] Restoring from backup:', filename);
    console.log('[Backup] Source:', backupPath);
    console.log('[Backup] Destination:', dbPath);

    // Verify backup exists
    const backupExists = await exists(backupPath);
    if (!backupExists) {
        throw new Error('Backup file not found');
    }

    try {
        // Close database connection
        await closeDatabase();

        // Copy backup over the current database
        await copyFile(backupPath, dbPath);

        // Reinitialize database connection
        await initDatabase();

        console.log('[Backup] Restore completed successfully');
    } catch (error) {
        // Try to reinitialize database even if restore fails
        try {
            await initDatabase();
        } catch {
            // Ignore reinitialization errors
        }
        console.error('[Backup] Failed to restore backup:', error);
        throw new Error(`Failed to restore backup: ${error}`);
    }
}

/**
 * Delete a backup file
 */
export async function deleteBackup(filename: string): Promise<void> {
    const backupFolder = await getBackupFolderPath();
    const backupPath = `${backupFolder}\\${filename}`;

    console.log('[Backup] Deleting backup:', filename);

    // Verify backup exists
    const backupExists = await exists(backupPath);
    if (!backupExists) {
        throw new Error('Backup file not found');
    }

    try {
        await remove(backupPath);
        console.log('[Backup] Backup deleted successfully');
    } catch (error) {
        console.error('[Backup] Failed to delete backup:', error);
        throw new Error(`Failed to delete backup: ${error}`);
    }
}

/**
 * Format bytes to human readable size
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}

/**
 * Get last backup date from settings or backups list
 */
export async function getLastBackupDate(): Promise<Date | null> {
    const backups = await listBackups();
    if (backups.length === 0) {
        return null;
    }
    return backups[0].createdAt;
}

export default {
    createBackup,
    createDailyBackup,
    listBackups,
    restoreFromBackup,
    deleteBackup,
    getBackupFolderPath,
    getDatabasePath,
    formatFileSize,
    getLastBackupDate
};
