import { defineConfig } from 'vitest/config';

const project = (name: string, root: string) => ({
  test: {
    name,
    root,
    include: ['src/**/*.test.ts'],
    environment: 'node' as const,
  },
});

export default defineConfig({
  test: {
    projects: [
      project('astrodynamics', 'packages/astrodynamics'),
      project('contracts', 'packages/contracts'),
      project('simulation', 'packages/simulation'),
      project('verification', 'verification'),
      project('web', 'apps/web'),
    ],
  },
});
