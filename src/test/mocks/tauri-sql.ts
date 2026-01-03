// Mock for @tauri-apps/plugin-sql
import { vi } from 'vitest'

// In-memory database simulation
interface MockResult {
    rowsAffected: number
    lastInsertId: number
}

// Mock database state
let mockData: Record<string, any[]> = {
    medicines: [],
    batches: [],
    customers: [],
    suppliers: [],
    bills: [],
    users: [
        { id: 1, username: 'admin', password_hash: 'admin123', full_name: 'Administrator', role: 'admin', is_active: 1 }
    ],
    settings: []
}

let autoIncrementIds: Record<string, number> = {
    medicines: 1,
    batches: 1,
    customers: 1,
    suppliers: 1,
    bills: 1,
}

class MockDatabase {
    constructor(_path: string) {
        // Path stored for reference but not used in mock
    }

    async select<T>(sql: string, _params: unknown[] = []): Promise<T> {
        console.log('[MockDB] SELECT:', sql.substring(0, 100))

        // Parse table name from SQL
        const tableMatch = sql.match(/FROM\s+(\w+)/i)
        const tableName = tableMatch ? tableMatch[1] : ''

        if (tableName && mockData[tableName]) {
            return mockData[tableName] as T
        }

        return [] as T
    }

    async execute(sql: string, params: unknown[] = []): Promise<MockResult> {
        console.log('[MockDB] EXECUTE:', sql.substring(0, 100))

        // Handle CREATE TABLE
        if (sql.includes('CREATE TABLE')) {
            return { rowsAffected: 0, lastInsertId: 0 }
        }

        // Handle INSERT
        if (sql.includes('INSERT INTO')) {
            const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i)
            const tableName = tableMatch ? tableMatch[1] : ''

            if (tableName && mockData[tableName]) {
                const id = autoIncrementIds[tableName] || 1
                mockData[tableName].push({ id, ...params })
                autoIncrementIds[tableName] = id + 1
                return { rowsAffected: 1, lastInsertId: id }
            }
        }

        // Handle UPDATE
        if (sql.includes('UPDATE')) {
            return { rowsAffected: 1, lastInsertId: 0 }
        }

        // Handle DELETE
        if (sql.includes('DELETE')) {
            return { rowsAffected: 1, lastInsertId: 0 }
        }

        return { rowsAffected: 0, lastInsertId: 0 }
    }

    async close(): Promise<void> {
        // No-op for mock
    }
}

// Export the default Database class
export default {
    load: vi.fn().mockImplementation(async (path: string) => {
        return new MockDatabase(path)
    })
}

// Export helper to reset mock data between tests
export function resetMockDatabase() {
    mockData = {
        medicines: [],
        batches: [],
        customers: [],
        suppliers: [],
        bills: [],
        users: [
            { id: 1, username: 'admin', password_hash: 'admin123', full_name: 'Administrator', role: 'admin', is_active: 1 }
        ],
        settings: []
    }
    autoIncrementIds = {
        medicines: 1,
        batches: 1,
        customers: 1,
        suppliers: 1,
        bills: 1,
    }
}

// Export helper to add mock data
export function addMockData(table: string, data: any[]) {
    if (!mockData[table]) {
        mockData[table] = []
    }
    mockData[table].push(...data)
}

// Export helper to get mock data
export function getMockData(table: string) {
    return mockData[table] || []
}
