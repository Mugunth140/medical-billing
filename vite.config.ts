/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    // Only alias Tauri APIs to mocks during testing
    alias: {
      '@tauri-apps/plugin-sql': path.resolve(__dirname, './src/test/mocks/tauri-sql.ts'),
      '@tauri-apps/api': path.resolve(__dirname, './src/test/mocks/tauri-api.ts'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // NOTE: Tauri API mocks are now ONLY applied in test.alias above
      // This prevents mocks from being used in development/production
    },
  },

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
})
