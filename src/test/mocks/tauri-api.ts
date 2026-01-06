// Mock for @tauri-apps/api
import { vi } from 'vitest'

export const invoke = vi.fn().mockImplementation(async (command: string, args?: unknown) => {
    console.log('[MockTauri] invoke:', command, args)
    return null
})

export const event = {
    listen: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
}

export const window = {
    appWindow: {
        close: vi.fn(),
        minimize: vi.fn(),
        maximize: vi.fn(),
        setTitle: vi.fn(),
    }
}

export default {
    invoke,
    event,
    window,
}
