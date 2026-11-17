# Accessibility harness (ML-TASK-040)

Throwaway tooling. **Not part of the app, the pnpm workspace, CI or any shipped build.** No
dependency was added to the app or to the root lockfile.

- `spikes/` is not in `pnpm-workspace.yaml`. `axe-core` (4.11.1) is installed with **npm** into
  `spikes/axe-readiness/node_modules` (own lockfile, git-ignored folder).
- Playwright is taken from the repository root install (`createRequire` on the root
  `package.json`); Chromium is the one the e2e suite already uses.
- The built app (`apps/web/dist`) is served by a small in-process Node static server on a free
  port, so no `vite preview` process exists that could be left behind.

```
pnpm --filter @mission-lab/web build        # from the repository root
cd spikes/axe-readiness
npm install
node run-axe.mjs      # axe scan of 11 UI states, tab order, focus outline, reflow -> results/axe.json
node contrast.mjs     # contrast from the CSS tokens and from every text node per state -> results/contrast.json
```

`probe*.mjs` are the exploratory scripts used to find reachable error paths (failed run, sample
limit, worker crash); the same paths are asserted in `apps/web/e2e/release-readiness.spec.ts`.
Findings and interpretation: `docs/verification/release-readiness-review.md`.
