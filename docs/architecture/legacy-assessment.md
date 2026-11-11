# Legacy Assessment — Satellite Viewer

**Document ID:** ML-ARCH-001 · **Date:** 2026-11-11 · **Author:** Coordinator · **Status:** Approved at gate G0 (owner, 2026-11-11)

**Subject:** `github.com/trivinet/satellite-viewer` at commit `4937189` (2025-09-30), deployed at
satellite-viewer.vercel.app.

**Method:** read-only clone; static inspection of structure, manifests and source; `npm audit`
against the committed lockfile. The application was **not** installed, built or run, and the
deployed site was not tested. Statements below are about the source, not runtime behaviour.

## 1. What it is

A Next.js (Pages Router) site, plain JavaScript, that tracks real satellites from TLE data:

| Area | Implementation |
|---|---|
| Pages | Home, 2D map, 3D map, satellite catalogue/statistics, theory documentation, about |
| Orbit computation | `tle.js` (SGP4 wrapper): lat/lon/altitude at wall-clock time, ground-track points |
| 2D map | `google-map-react` (Google Maps, API key from env) |
| 3D globe | ArcGIS JS API via `esri-loader-hooks` (CDN-loaded) |
| UI | MUI 5, MUI DataGrid, `mui-datatables`, Font Awesome, CSS modules, `recharts` |
| Data | Daily Vercel cron fetches CelesTrak "active" TLEs into Vercel Blob; `/api/tle` serves them |
| Languages | ES/EN toggle through module-level globals |

Size: 87 tracked files, 88 MB checkout, 6 commits. About 5,000 lines of hand-written JS/JSX; one
further 30,000-line file (`components/generateIDs.jsx`, 1.7 MB) is generated data in source form.

## 2. Findings

| # | Finding | Evidence |
|---|---|---|
| L-01 | No TypeScript, no tests, no CI. | No `tsconfig`, no test files, no `.github/`. |
| L-02 | Physics is delegated entirely to `tle.js`/SGP4 and called from React components and pages. There is no domain layer. | `components/trace.jsx`, `pages/map.js`, `pages/map3D.js`. |
| L-03 | Different physical domain: SGP4 on TLEs in TEME/geodetic output, evaluated at `Date.now()`. Mission Lab M1 is idealised two-body from user-defined elements in an inertial frame with simulation time. No orbital-element conversion, propagator or maneuver code exists to reuse. | Same files. |
| L-04 | Both renderers are third-party map products (Google Maps, ArcGIS), not Three.js. Neither supports the custom inertial-frame scene M1 needs, and both bring API keys and usage terms. | `pages/map.js`, `pages/map3D.js`. |
| L-05 | It has a backend (API routes, cron, Blob storage). Mission Lab M1 forbids a mandatory backend (ARCH-009). | `pages/api/*`, `vercel.json`. |
| L-06 | ~57 MB of data and scratch files committed inside `components/` and `pages/api/` (`active2.json` 43 MB, `todosTLE.txt` 7 MB, a 2 MB PDF, `.txt` backups of old code). | `git ls-files` sizes. |
| L-07 | Dependency health: `npm audit` on the lockfile reports **18 vulnerabilities (1 critical, 12 high, 5 moderate)**. Mixed versions (`next ^15` with `eslint-config-next 12`, React 18, MUI 5). Not triaged individually. | `npm audit --package-lock-only`. |
| L-08 | A `MAPBOX_ACCESS_TOKEN` entry is defined inline in `next.config.js` in a public repository. **Owner action:** check whether it is a live token and rotate it if so. (Not reproduced here.) | `next.config.js:5-7`. |
| L-09 | Monolithic page components (545–2,287 lines), module-level mutable globals for theme/language, ESLint rules disabled (`react/jsx-key`). | `pages/satelites.js`, `pages/_app.js`, `.eslintrc.json`. |
| L-10 | No licence file. Not a problem for the owner's own reuse; relevant only if third parties contribute. | Repository root. |

## 3. Compatibility with ML-SYS-001

| Principle | Legacy status |
|---|---|
| ARCH-001 separation of concerns | Not met — computation inside UI components |
| ARCH-002 single source of physical truth | Not met |
| ARCH-003/004 explicit units and frames | Not met — implicit, library-defined |
| ARCH-005 reproducibility | Not met — results depend on wall-clock time and live TLEs |
| ARCH-007 testability without browser | Not met |
| ARCH-009 minimal infrastructure | Not met — cron + blob + API routes |
| §4.1 TypeScript, Three.js, Tailwind | None of the three is present |

## 4. Options

| Option | Description | Assessment |
|---|---|---|
| A. Build Mission Lab inside Satellite Viewer | Add the lab as new pages in the existing app. | Inherits JS, Pages Router, MUI, map SDKs, backend, 57 MB of data and 18 advisories. Every Mission Lab principle would have to be retrofitted first. The retrofit *is* a rewrite, done in a worse place. |
| B. Incremental refactor into the target architecture | Convert to TS, extract domain, swap renderers. | Nothing would survive the refactor: no domain code to extract, both renderers replaced, styling system replaced. Cost of a rewrite plus the cost of keeping the old site working meanwhile. |
| C. Clean repository; legacy left as-is | New `mission-lab` repo. Satellite Viewer stays deployed as a separate project. | No constraint inherited. Loses nothing, because no code is reusable. |

## 5. Recommendation

**Option C — greenfield.** Recorded as [ADR-001](adr/ADR-001-greenfield-repository.md).

What carries over is knowledge, not code:

- The theory/documentation content (`pages/docu.js`) and the TFG itself are the owner's own
  material and can inform in-app help later.
- The product lesson: real-satellite tracking (TLE/SGP4) is a distinct capability. If Mission Lab
  ever imports real objects (an M2+ candidate, not currently a requirement), it will be specified
  with its own frame handling (TEME) rather than ported.

Independent of Mission Lab, Satellite Viewer has maintenance items (L-06, L-07, L-08). They are
out of scope for this project; L-08 deserves the owner's attention regardless.
