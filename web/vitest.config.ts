import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Load `.env` (DATABASE_URL etc.) before any test file imports run,
    // so the lib code reading `process.env.DATABASE_URL!` at module-load
    // time finds it. Integration tests that need a live DB self-skip via
    // `describe.skipIf(!process.env.DATABASE_URL)`.
    setupFiles: ['dotenv/config'],
    // Server-side code under test; no DOM needed.
    environment: 'node',
    // Drizzle + neon-serverless connect over WebSocket; first connect can
    // take a second on a cold Neon branch.
    testTimeout: 20000,
  },
})
