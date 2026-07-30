import { defineConfig } from "vitest/config";
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Use global setup for database initialization
    globalSetup: ['./vitest.global.setup.ts'],
    // Alias for imports
    alias: {
      '@': resolve(__dirname, './'),
      '@shared': resolve(__dirname, './shared'),
      '@core': resolve(__dirname, './server/_core'),
    },
    // Increase timeout for slow operations (like database setup)
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});