# Charting spike (ML-TASK-030, closes OD-006)

Throwaway evaluation code. **Not part of the app, the pnpm workspace, CI or any shipped build.**
The result is recorded in `docs/architecture/adr/ADR-010-charting-library.md`.

## Isolation

- `spikes/` is not listed in `pnpm-workspace.yaml`, so `pnpm install` at the repository root does
  not see it and `pnpm-lock.yaml` is unchanged. The candidates are installed with **npm** into
  `spikes/charting/node_modules` (own `package.json` and `package-lock.json`).
- Nothing under `apps/` or `packages/` is modified. The engine is bundled with esbuild into
  `node_modules/.spike-build/` by `tools/gen-data.mjs` and used read-only.
- The spike code is plain JavaScript (`.js`, `.mjs`) so it is outside the TypeScript project
  (`pnpm typecheck` does not see it) and is formatted with the repository's Prettier config, so
  `pnpm format:check` covers it. **`spikes/**`is excluded from ESLint** (one added entry in`eslint.config.js`): the files use browser and Node globals (`window`, `fetch`, ...), which
  the repository's JS rules (`no-undef`) reject, and the code is throwaway.
- Committed evidence is in `results/` (raw measurements, the Markdown table, bundle sizes, the
  keyboard/network probe). Screenshots go to `out/` (git-ignored).

## Commands (from `spikes/charting`)

Prerequisites: the repository root installed once with `pnpm install` (the engine's own
dependencies), and Chromium for Playwright (`pnpm exec playwright install chromium`, already
needed by the app's e2e tests).

```
npm install                 # candidates + vite + esbuild (own lockfile)
npm run data                # real engine runs -> data/*.f64 and data/manifest.json
npm run build               # vite build of the four spike pages -> dist/
npx vite preview            # http://localhost:5181/  (index lists the four pages)
node tools/smoke.mjs small  # feature smoke test, Object.is read-back, screenshots in out/
node tools/measure.mjs      # measurements (3 repetitions, medians) -> out/measurements.json
node tools/size.mjs         # min+gzip size per candidate
node tools/metadata.mjs     # version, licence, dates, from the npm registry
```

Pages accept `?dataset=small|n1e4|n2_5e5&mode=single|panel`. The scene-style test hook is
`window.__spike` (`render`, `setCursor`, `measureCursor`, `verify`).
