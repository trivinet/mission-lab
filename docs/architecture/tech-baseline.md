# Technology Baseline — Mission Lab M1 (Phase 0b scaffold)

**Status:** Proposed — pending owner approval · **Task:** ML-TASK-002 · **Author role:** Systems Architect
· **Date of verification:** 2026-11-11 · **Implements:** ADR-002, ADR-006, proposed-architecture §5–§6,
ML-NFR-001, ML-NFR-005, ML-NFR-007

This document proposes the exact toolchain and library versions to pin when the Phase 0b scaffold is
created. It is not authority until the owner approves it. Nothing has been installed; no manifest
exists yet.

## 1. Selection rules applied

1. Stable releases only (npm `latest` dist-tag of a stable major; no alpha/beta/rc/canary/next).
2. Prefer a release that is at least ~14 days old on 2026-11-11 (i.e. published on or before about
   2026-10-28). The only deliberate exception is Vite (security fix, §3.2).
3. Peer-dependency ranges were read from the npm registry metadata of the exact version chosen.
4. Permissive licences only (MIT, Apache-2.0, BSD, ISC).
5. Smallest set that satisfies ADR-006 and proposed-architecture §6. Charting is out of scope (OD-006).

All registry data was read from `https://registry.npmjs.org/<package>` (fields `dist-tags`, `time`,
`versions[v].license`, `peerDependencies`, `engines`). In the table the "Source" column gives the
human-readable npm page; the registry document behind it is the same package name.

## 2. Summary table

| Package / tool | Pinned version | Published | Status | Licence | Source checked |
|---|---|---|---|---|---|
| Node.js | **24.22.2** (line 24 "Krypton") | 2026-10-27 | LTS (Maintenance since 2026-10-20, EOL 2028-04-30) | MIT | https://nodejs.org/dist/index.json, https://github.com/nodejs/Release/blob/main/schedule.json |
| pnpm | **12.16.1** | 2026-10-27 | Stable (`latest` line is 12) | MIT | https://www.npmjs.com/package/pnpm, https://pnpm.io/installation |
| typescript | **6.0.3** | 2026-04-16 | Stable (previous major; see §3.1) | Apache-2.0 | https://www.npmjs.com/package/typescript |
| vite | **8.3.7** | 2026-11-09 | Stable — security pin (§3.2) | MIT | https://www.npmjs.com/package/vite, https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7 |
| @vitejs/plugin-react | **6.1.2** | 2026-10-05 | Stable | MIT | https://www.npmjs.com/package/@vitejs/plugin-react |
| react | **19.3.1** | 2026-10-14 | Stable (`latest`) | MIT | https://www.npmjs.com/package/react |
| react-dom | **19.3.1** | 2026-10-14 | Stable (`latest`) | MIT | https://www.npmjs.com/package/react-dom |
| @types/react | **19.3.0** | 2026-09-09 | Stable (`ts6.0` tag points here) | MIT | https://www.npmjs.com/package/@types/react |
| @types/react-dom | **19.3.0** | 2026-09-09 | Stable (`ts6.0` tag points here) | MIT | https://www.npmjs.com/package/@types/react-dom |
| three | **0.186.1** | 2026-09-24 | Stable (0.187.0 is 12 days old, see §3.3) | MIT | https://www.npmjs.com/package/three |
| @types/three | **0.186.0** | 2026-09-11 | Stable, matches three r186 | MIT | https://www.npmjs.com/package/@types/three |
| @react-three/fiber | **9.8.2** | 2026-10-14 | Stable (`latest`; v10 is alpha) | MIT | https://www.npmjs.com/package/@react-three/fiber, https://r3f.docs.pmnd.rs/getting-started/installation |
| @react-three/drei | *not in scaffold*; if later justified: **10.7.9** | 2026-09-25 | Stable (`latest`) | MIT | https://www.npmjs.com/package/@react-three/drei |
| tailwindcss | **4.3.3** | 2026-07-16 | Stable | MIT | https://www.npmjs.com/package/tailwindcss |
| @tailwindcss/vite | **4.3.3** | 2026-07-16 | Stable (must equal tailwindcss) | MIT | https://www.npmjs.com/package/@tailwindcss/vite |
| zustand (state store) | **5.0.16** | 2026-10-22 | Stable | MIT | https://www.npmjs.com/package/zustand |
| zod (runtime schemas) | **4.6.7** | 2026-10-12 | Stable (`latest`) | MIT | https://www.npmjs.com/package/zod |
| vitest | **5.0.5** | 2026-10-15 | Stable | MIT | https://www.npmjs.com/package/vitest |
| @vitest/coverage-v8 (if coverage is enabled) | **5.0.5** | — | must equal vitest (peer pin) | not checked | see Not verified |
| @playwright/test | **1.64.1** | 2026-10-14 | Stable | Apache-2.0 | https://www.npmjs.com/package/@playwright/test |
| eslint | **10.13.0** | 2026-10-16 | Stable (`latest` major 10) | MIT | https://www.npmjs.com/package/eslint |
| @eslint/js | **10.0.1** | 2026-02-06 | Stable (`latest`) | MIT | https://www.npmjs.com/package/@eslint/js |
| typescript-eslint | **8.72.0** | 2026-10-19 | Stable | MIT | https://www.npmjs.com/package/typescript-eslint, https://typescript-eslint.io/users/dependency-versions/ |
| eslint-plugin-boundaries | **7.3.0** | 2026-10-23 | Stable | MIT | https://www.npmjs.com/package/eslint-plugin-boundaries, https://www.jsboundaries.dev/docs/quick-start/ |
| eslint-import-resolver-typescript | **4.4.5** | 2026-06-01 | Stable (`latest`) | ISC | https://www.npmjs.com/package/eslint-import-resolver-typescript, https://www.jsboundaries.dev/docs/guides/typescript-support/ |
| prettier | **3.9.10** | 2026-10-10 | Stable (3.10.0 published today) | MIT | https://www.npmjs.com/package/prettier |
| @types/node (tooling configs only) | **24.19.2** | 2026-10-09 | Stable, matches Node 24 | MIT | https://www.npmjs.com/package/@types/node |
| GitHub runner image | **ubuntu-24.04** | — | GA (`ubuntu-latest` currently maps here) | — | https://github.com/actions/runner-images |
| actions/checkout | **v7.0.1** @ `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | Stable release | MIT | https://api.github.com/repos/actions/checkout/releases |
| actions/setup-node | **v7.1.0** @ `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 | Stable release | MIT | https://api.github.com/repos/actions/setup-node/releases |
| pnpm/action-setup | **v6.1.0** (tag object `d9184bf108216479bc5a137cc391f4d7b14c870b`; commit SHA to be dereferenced at scaffold) | 2026-09-05 | Stable release | MIT | https://github.com/pnpm/action-setup |

Pins are exact (no `^`/`~`) in every `package.json`; the lockfile (`pnpm-lock.yaml`) is committed
(ML-NFR-007).

## 3. Decisions with rationale

### 3.1 TypeScript 6.0.3, not 7.x
`typescript@latest` is 7.0.2 (2026-07-08), the native-binary line (its registry entry depends on 20
per-platform `@typescript/typescript-*` packages). `typescript-eslint` 8.72.x declares the peer range
`typescript: >=4.8.4 <6.1.0`, and its dependency-versions page states the same range and does not
mention TypeScript 7. Type-aware linting is required for the boundary and strictness rules, so the
newest TypeScript that typescript-eslint supports is pinned: **6.0.3**. `@types/react`,
`@types/react-dom` and `@types/three` all carry a `ts6.0` dist-tag pointing at the chosen versions.
Revisit when typescript-eslint widens its range.

### 3.2 Vite 8.3.7 (security exception to the 14-day rule)
GHSA-p4f5-76q4-ffq7 (published 2026-11-10, Critical, CVSS v4 9.1) affects Vite 8.3.0–8.3.6 and is
patched in 8.3.7 (also 8.2.5, 8.1.7). Exploitation needs the dev server exposed to the network
(`--host` / `server.host`). Any 8.3.x older than two weeks is vulnerable, so the oldest patched
release, 8.3.7 (2026-11-09), is pinned. 8.3.8 (published today) contains bug fixes only and is not
needed. The scaffold must also not set `server.host` without owner approval.

### 3.3 React ↔ React Three Fiber ↔ three
Evidence:
- R3F docs (v9.8.2): "@react-three/fiber@8 pairs with react@18, @react-three/fiber@9 pairs with
  react@19."
- `@react-three/fiber@9.8.2` peers: `react >=19 <19.4`, `react-dom >=19 <19.4`, `three >=0.156`.
- R3F v10 exists only as pre-release: dist-tags `alpha: 10.0.0-alpha.6` (2026-10-17) and a canary;
  `latest` is 9.8.2. ADR-006 requires the stable line, so **v9**.
- `react@19.3.1` and `react-dom@19.3.1` satisfy `>=19 <19.4`. **React must not be upgraded to 19.4+
  until an R3F 9.x release widens that range.**
- `three@0.186.1` satisfies `>=0.156` (and drei's `>=0.159`). three r187 (0.187.0, 2026-10-30) is
  12 days old and three minor releases can break API; r186 is chosen as the conservative pin.

### 3.4 @react-three/drei — deferred
drei 10.7.9 is compatible (peers `react ^19`, `react-dom ^19` optional, `three >=0.159`,
`@react-three/fiber ^9.0.0`) but brings 21 direct runtime dependencies. M1 needs camera orbit controls
and polylines, which three's own addons provide and R3F can wrap. Smallest design: not in the
scaffold; the Frontend Engineer may propose it later with a justification in the PR (ML-NFR-007).

### 3.5 Tailwind CSS 4.3.3 with `@tailwindcss/vite`
Tailwind 4 integrates with Vite through the first-party `@tailwindcss/vite` plugin (no PostCSS
config). `@tailwindcss/vite@4.3.3` peers `vite ^5.2.0 || ^6 || ^7 || ^8` → compatible with 8.3.7.
4.3.4 / 4.3.5 are under two weeks old; 4.3.3 is the newest older patch. Both packages must carry the
same version.

### 3.6 State store: zustand 5.0.16
Zero runtime dependencies; React is an *optional* peer (`>=18`), so the same store can be updated
from the Web Worker message handler outside React and read from R3F's frame loop via `getState()`
without triggering re-renders. Selector-based subscriptions keep the workspace panels from
re-rendering on every playback tick. No provider tree. Used only in `apps/web` (architecture §1:
React and stores never appear below `apps/web`). 5.1.0 (2026-11-06) is too recent.

### 3.7 Runtime schemas: zod 4.6.7 in `packages/contracts`
Zero runtime dependencies; static types are inferred from the schema, so `Scenario`,
`SimulationRequest` and `SimulationResult` have one definition for types and validation.
Placement constraint: zod is a runtime dependency of `packages/contracts` only (and therefore,
transitively, of `simulation`, `apps/web` and `verification`). `packages/astrodynamics` imports
nothing (ADR-002, architecture §1) and must not list `contracts` or `zod` in its manifest; if it
ever needs a shared type it must be via an ADR.

### 3.8 Testing: Vitest 5.0.5, Playwright 1.64.1
`vitest@5.0.5` peers `vite ^6.4.0 || ^7.0.0 || ^8.0.0` → compatible with 8.3.7; engines
`^22.12.0 || ^24.0.0 || >=26.0.0` → compatible with Node 24. (Vitest 5.0.0 was released
2026-09-03; 4.1.12 is still maintained if the owner prefers the older major.) Playwright 1.64.1
requires Node `>=20`.

### 3.9 Lint and format
- ESLint 10.13.0 (flat config is the only config format in ESLint 10) + `@eslint/js` 10.0.1 (peer
  `eslint ^10.0.0`).
- `typescript-eslint` 8.72.0 peers `eslint ^8.57.0 || ^9.0.0 || ^10.0.0` and `typescript <6.1.0` →
  compatible with ESLint 10.13.0 and TS 6.0.3.
- **Import-boundary enforcement — three layers, smallest first:**
  1. *Package manifests:* pnpm's isolated `node_modules` means a package cannot resolve a dependency
     it does not declare. `astrodynamics` declares none.
  2. *TypeScript `lib`:* `packages/astrodynamics`, `packages/simulation` and `packages/contracts`
     compile without the `DOM` lib, so a browser global is a type error (ML-NFR-001).
  3. *ESLint:* `eslint-plugin-boundaries` 7.3.0 (`boundaries/dependencies` rule, element types =
     the workspace packages, allow-list mirroring architecture §1) with
     `eslint-import-resolver-typescript` 4.4.5 as the resolver its TypeScript guide names; plus core
     `no-restricted-imports` banning `react`, `react-dom`, `three`, `@react-three/*` and `zustand`
     outside `apps/web`.
  Alternative considered: `dependency-cruiser` 18.7.2 (MIT, engines `^22||^24||>=26`) — a separate
  CLI, not an ESLint plugin; not chosen to keep one lint entry point.
- Prettier 3.9.10 (3.10.0 is hours old).

### 3.10 Node.js 24 LTS and pnpm 12
Release schedule (nodejs/Release `schedule.json`):

| Line | Active LTS from | Maintenance from | End of life |
|---|---|---|---|
| 22 "Jod" (dev machine today) | 2024-10-29 | 2025-10-21 | **2027-04-30** |
| 24 "Krypton" (proposed) | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| 26 "Lithium" (alternative) | 2026-10-28 | 2027-10-20 | 2029-04-30 |

Node 22 ends support in under six months and is rejected. Node 24 is proposed: 18 months of support
remaining, a mature ecosystem, and all chosen tools declare it in `engines`. Node 26 entered LTS only
14 days ago; see owner decision D-1. 24.22.2 is a patch after the 24.22.1 security release.

pnpm 12 is the current line (`latest` = 12.x; 12.0.0 on 2026-08-26); pnpm's installation page states
pnpm 12 supports Node 18+. 12.16.1 is the newest release at least 14 days old. pnpm 12 makes unknown
`pnpm-workspace.yaml` settings an error when the project's pinned version is honoured — useful for
catching misspelt settings.

## 4. Compatibility matrix (peer/engine checks performed)

| Consumer (pinned) | Requires | Pinned provider | Result |
|---|---|---|---|
| vite 8.3.7 | node `^20.19.0 \|\| >=22.12.0` | Node 24.22.2 | OK |
| @vitejs/plugin-react 6.1.2 | vite `^8.0.0`; node `^20.19.0 \|\| >=22.12.0` | vite 8.3.7 | OK |
| @tailwindcss/vite 4.3.3 | vite `^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` | vite 8.3.7 | OK |
| vitest 5.0.5 | vite `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`; @types/node (optional) `^22.0.0 \|\| >=24.0.0` | vite 8.3.7, Node 24, @types/node 24.19.2 | OK |
| @react-three/fiber 9.8.2 | react / react-dom `>=19 <19.4`; three `>=0.156` | react 19.3.1, three 0.186.1 | OK — React 19.4 would break |
| @react-three/drei 10.7.9 (deferred) | react `^19`; three `>=0.159`; fiber `^9.0.0` | as above | OK if adopted |
| zustand 5.0.16 | react `>=18` (optional) | react 19.3.1 | OK |
| @types/react-dom 19.3.0 | @types/react `^19.3.0` | 19.3.0 | OK |
| typescript-eslint 8.72.0 | eslint `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`; typescript `>=4.8.4 <6.1.0`; node `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | eslint 10.13.0, TS 6.0.3 | OK — TS 7 would break |
| @eslint/js 10.0.1 | eslint `^10.0.0` | 10.13.0 | OK |
| eslint 10.13.0 | node `^20.19.0 \|\| ^22.13.0 \|\| >=24` | Node 24 | OK |
| eslint-plugin-boundaries 7.3.0 | eslint `>=6.0.0` (declared); node `>=18.18` | eslint 10.13.0 | Declared OK; ESLint 10 not explicitly documented (see Not verified) |
| eslint-import-resolver-typescript 4.4.5 | eslint `*`; node `^16.17.0 \|\| >=18.6.0` | — | OK |
| @playwright/test 1.64.1 | node `>=20` | Node 24 | OK |
| pnpm 12.16.1 | node `>=18` | Node 24 | OK |

## 5. Provisioning — Windows 11 dev machine

Current state: Node v22.20.0, npm 10.9.3, no pnpm.

1. **Node 24.22.2:** install from the official nodejs.org Windows installer (x64 MSI), or with a
   version manager of the owner's choice. The repository pins it in `.nvmrc` (`24.22.2`) and in root
   `package.json` `engines.node` (`>=24.22.2 <25`). Node 22.20.0 would satisfy most `engines`
   ranges but is not the pinned runtime and is not to be used for lockfile generation.
2. **pnpm 12.16.1 — standalone via npm, not Corepack.** Rationale: pnpm's installation page
   currently recommends installing with npm on Windows (Windows Defender may block the standalone
   executable); Corepack is not distributed with Node 25+ (Node TSC decision, 2025), so relying on it
   would break at the next Node upgrade. Command: `npm install -g pnpm@12.16.1`.
3. Root `package.json` declares `"packageManager": "pnpm@12.16.1"`; `pnpm/action-setup` reads this
   field when no `version` input is given, so local and CI versions come from one place.
4. Playwright browsers: `pnpm exec playwright install chromium` (Chromium only for M1 unless the
   owner wants more engines). pnpm's installation page notes Defender scanning can slow installs;
   excluding the pnpm store path is optional and an owner choice (it is a security setting).

**CI (GitHub Actions):** `runs-on: ubuntu-24.04` (explicit, not `ubuntu-latest`, so the image does not
move silently). Steps: `actions/checkout` → `pnpm/action-setup` (version from `packageManager`) →
`actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm` (setup-node docs show pnpm
installed first, then setup-node with `cache: 'pnpm'`) → `pnpm install --frozen-lockfile` → lint,
type-check, test, build. Actions referenced by full commit SHA with the tag in a comment.

## 6. Owner decisions

- **D-1 Node line.** Proposed: **Node 24** (Maintenance LTS, EOL 2028-04-30). Alternative: Node 26
  (Active LTS since 2026-10-28, EOL 2029-04-30; one more year of support, but only 14 days in LTS).
  All chosen tools declare support for both.
- **D-2 TypeScript 6.0.3 instead of 7.x.** Forced by typescript-eslint's `<6.1.0` peer range.
  Accept, or drop type-aware linting to use TS 7 (not recommended: boundary/strictness rules need it).
- **D-3 Action pinning style.** Proposed: full commit SHA (supply-chain hardening). Alternative:
  major tag (`@v7`) for lower maintenance.
- **D-4 (optional) Release-age policy.** pnpm 12 has a `minimumReleaseAge` workspace setting (named
  in the pnpm 12.0.0 release notes). Enforcing ~14 days would mechanise rule 2 of §1, but the Vite
  security pin would need an exemption. Default if not decided: not enabled.

## 7. Not verified

- **Transitive licences** of the full dependency tree (only the licence of each listed package was
  read). A licence check should run in CI once a lockfile exists.
- **`@vitest/coverage-v8` 5.0.5** licence and existence were not individually checked; only vitest's
  peer pin to the same version was read.
- **eslint-plugin-boundaries with ESLint 10:** the peer range `eslint >=6.0.0` admits it, but neither
  the README nor jsboundaries.dev states ESLint 10 support, and its monorepo guide was not read.
  Must be proven by the scaffold's lint run (a deliberate illegal import must fail).
- **pnpm/action-setup v6.1.0 commit SHA:** the tag is annotated; only the tag-object SHA was read.
  Dereference before use.
- **actions/setup-node v7 runtime** (node24 vs other) and **checkout v7 breaking changes**: release
  notes mention an ESM migration and fork-PR restrictions for `pull_request_target`/`workflow_run`
  only; no full review of v7 behaviour changes.
- **Corepack bundling in Node 24** and its removal in Node 25+: confirmed via a web search summary
  citing Node docs and the TSC decision, not by reading the Node 24/25 docs pages directly. Not
  load-bearing, since Corepack is not used.
- **zod / zustand feature claims** in §3.6–§3.7 (selector subscriptions, `getState()` outside React,
  type inference) are standard documented behaviour but were not re-read in their docs this session.
- **TypeScript 6.0 configuration changes** (deprecated options, new defaults) were not reviewed; the
  scaffold author must check the TS 6.0 release notes when writing `tsconfig` files.
- **Ubuntu 24.04 runner deprecation timeline:** runner-images README lists 24.04 and 26.04 as
  available and `ubuntu-latest` → 24.04; no deprecation date was found.
- **Security advisories** were checked for Vite only. No advisory database scan was done for the
  other packages; `pnpm audit` should run in CI (ML-NFR-006).
