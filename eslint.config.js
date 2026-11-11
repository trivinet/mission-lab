import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

// Fixtures for `pnpm check:boundaries` live under tools/boundary-fixtures/<element>/ and are
// classified as the element they impersonate, so the same rules are exercised on illegal imports.
// They are ignored by normal linting; the check script lints them with `ignore: false`.
const elementDirs = {
  astrodynamics: 'packages/astrodynamics',
  contracts: 'packages/contracts',
  simulation: 'packages/simulation',
  web: 'apps/web',
  verification: 'verification',
};

const elements = Object.entries(elementDirs).map(([type, dir]) => ({
  type,
  pattern: [dir, `tools/boundary-fixtures/${type}`],
  partialMatch: false,
}));

/**
 * @param {string} from
 * @param {...string} to
 */
const allowDependency = (from, ...to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: [from, ...to] } } } },
});

// One-way dependencies of docs/architecture/proposed-architecture.md section 1 and ADR-002.
const dependencyPolicies = [
  allowDependency('astrodynamics'),
  allowDependency('contracts'),
  allowDependency('simulation', 'contracts', 'astrodynamics'),
  allowDependency('web', 'simulation', 'contracts'),
  allowDependency('verification', 'contracts'),
  // Third-party and Node built-in modules are governed by package manifests and by
  // no-restricted-imports below, not by this rule.
  { allow: { to: { module: { origin: ['external', 'core'] } } } },
];

const uiLibraryImports = [
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    message: 'React is allowed in apps/web only.',
  },
  {
    group: ['three', 'three/*', '@react-three/*'],
    message: 'Three.js is allowed in apps/web only.',
  },
  { group: ['zustand', 'zustand/*'], message: 'The UI store is allowed in apps/web only.' },
];

const browserGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'Worker',
  'SharedWorker',
  'requestAnimationFrame',
  'fetch',
  'XMLHttpRequest',
  'HTMLElement',
  'WebGLRenderingContext',
].map((name) => ({ name, message: 'Browser APIs are allowed in apps/web only (ML-NFR-001).' }));

const nonWebFiles = [
  'packages/**/*.{ts,tsx}',
  'verification/**/*.{ts,tsx}',
  'tools/boundary-fixtures/{astrodynamics,contracts,simulation,verification}/**/*.{ts,tsx}',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'tools/boundary-fixtures/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['{packages,apps,verification}/**/*.{ts,tsx}', 'tools/boundary-fixtures/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/dependencies': [2, { default: 'disallow', policies: dependencyPolicies }],
    },
  },
  {
    files: nonWebFiles,
    rules: {
      'no-restricted-imports': ['error', { patterns: uiLibraryImports }],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
);
