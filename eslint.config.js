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
  conformance: 'conformance',
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
  // ADR-009: the conformance workspace compares the engine with the references. It may import
  // both sides; no element lists it as a target, so nothing may import conformance.
  allowDependency('conformance', 'astrodynamics', 'simulation', 'contracts', 'verification'),
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
  'conformance/**/*.{ts,tsx}',
  'tools/boundary-fixtures/{astrodynamics,contracts,simulation,verification,conformance}/**/*.{ts,tsx}',
];

// ML-NFR-003 (determinism): the engine packages read no clock and no randomness. A run is a pure
// function of its request, so `Date.now()`, `new Date()` / `Date()` (no argument: the current
// time), `performance`, `Math.random` and the Web Crypto random functions are forbidden there.
// `Date.parse(text)` and `new Date(value)` stay allowed: they are calendar arithmetic on an
// argument, not a clock read (packages/simulation/src/utc-label.ts uses them, ADR-004).
const determinismFiles = [
  'packages/astrodynamics/**/*.{ts,tsx}',
  'packages/simulation/**/*.{ts,tsx}',
  'tools/boundary-fixtures/{astrodynamics,simulation}/**/*.{ts,tsx}',
];
const NFR_003 = 'ML-NFR-003: the engine reads no clock and no randomness.';
const determinismProperties = [
  { object: 'Date', property: 'now', message: NFR_003 },
  { object: 'performance', property: 'now', message: NFR_003 },
  { object: 'Math', property: 'random', message: NFR_003 },
  { property: 'getRandomValues', message: NFR_003 },
  { property: 'randomUUID', message: NFR_003 },
];
const determinismSyntax = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: `${NFR_003} \`new Date()\` is the current time.`,
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: `${NFR_003} \`Date()\` is the current time.`,
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.claude/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'tools/boundary-fixtures/**',
      // ML-TASK-030: throwaway browser/Node spike code, not part of the app or CI (see
      // spikes/charting/README.md). Plain JS with browser and Node globals, so `no-undef` would fail.
      'spikes/**',
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
    files: [
      '{packages,apps,verification,conformance}/**/*.{ts,tsx}',
      'tools/boundary-fixtures/**/*.{ts,tsx}',
    ],
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
  {
    files: determinismFiles,
    rules: {
      // Replaces the list above for these files, so the browser globals are repeated.
      'no-restricted-globals': [
        'error',
        ...browserGlobals,
        { name: 'performance', message: NFR_003 },
        { name: 'crypto', message: NFR_003 },
      ],
      'no-restricted-properties': ['error', ...determinismProperties],
      'no-restricted-syntax': ['error', ...determinismSyntax],
    },
  },
);
