import { defineConfig } from 'vitest/config';

// High-precision reference tests (320-bit arithmetic, large grids) can take several seconds each
// on a loaded developer machine; Vitest's 5 s default made them fail by timeout, not by assertion
// (conformance-run-4.md, findings). Only the time limit changes; no assertion does.
const HEAVY_TEST_TIMEOUT_MS = 60_000;

const project = (name: string, root: string, testTimeout?: number) => ({
  test: {
    name,
    root,
    include: ['src/**/*.test.ts'],
    environment: 'node' as const,
    ...(testTimeout === undefined ? {} : { testTimeout }),
  },
});

export default defineConfig({
  test: {
    projects: [
      project('astrodynamics', 'packages/astrodynamics'),
      project('conformance', 'conformance', HEAVY_TEST_TIMEOUT_MS),
      project('contracts', 'packages/contracts'),
      project('simulation', 'packages/simulation'),
      project('verification', 'verification', HEAVY_TEST_TIMEOUT_MS),
      project('web', 'apps/web'),
    ],
  },
});
