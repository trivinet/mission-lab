import { defineConfig, devices } from '@playwright/test';

/**
 * Measurement harness config (ML-TASK-026, ML-NFR-004). Dev/test only: it is not part of
 * `pnpm test:e2e` (which uses playwright.config.ts and the ./e2e folder) nor of CI.
 * Run it with `pnpm perf:envelope` from the repository root (see
 * docs/verification/performance-envelope.md).
 */
export default defineConfig({
  testDir: './perf',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 20 * 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm run build && pnpm exec vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
