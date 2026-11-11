# Coding standards

**Scope:** rules that the repository and the approved documents already establish. Each rule
names its source. Anything a contributor guide would normally cover but no source establishes is
listed in section 9, *Not yet decided*. Process rules (branches, commits, PRs) are in
[contributing.md](contributing.md).

Source precedence follows [AGENTS.md](../../AGENTS.md): owner decisions, then approved
requirements and architecture, then approved ADRs and contracts, then repository conventions,
then the task contract.

## 1. Physical units, frames and time

- Physical field names carry a unit suffix: `_m`, `_mps`, `_s`, `_rad` ([AGENTS.md](../../AGENTS.md)).
  The architecture draft uses them throughout, for example `semiMajorAxis_m`, `inclination_rad`,
  `deltaV_mps`, `position_m` ([proposed-architecture.md](../architecture/proposed-architecture.md) §4).
- The gravitational parameter is named `mu_m3ps2` in the same draft (§4). `_m3ps2` is not in the
  AGENTS.md suffix list. See section 9.
- Angle fields use `_rad` in the draft contract (proposed-architecture §4). Degrees appear only
  in UI formatting (proposed-architecture §3).
- Internal units are SI: m, m/s, s, rad, kg. Conversion to km, km/s and degrees happens only in the
  UI formatting layer (proposed-architecture §3).
- Simulation time is `t_s`: elapsed SI seconds from the scenario epoch, float64. Physics functions
  do not receive calendar dates (proposed-architecture §3; ADR-004).
- The scenario epoch is `{ scale: "UTC", iso }` and appears only at the scenario boundary
  (proposed-architecture §3).
- The one inertial frame is `GCRF`. M1 accepts and produces no other frame (ADR-004; proposed-architecture §3).
- The RSW frame is used only to express maneuver input. Δv is resolved to inertial using the
  pre-maneuver state (proposed-architecture §3).
- Never mix reference frames or time scales implicitly ([AGENTS.md](../../AGENTS.md)).
- Displayed UTC is epoch + `t_s` with no leap-second handling. This is a recorded limitation
  (ADR-004; proposed-architecture §3).
- Earth orientation is for display only and is not used for numeric output in M1 (ADR-004).

## 2. Documenting physics code

- Every public physics function documents its units, frame and source reference (ML-NFR-002,
  [m1-requirements.md](../requirements/m1-requirements.md) §4). Review is the verification method.
- Do not invent physical constants, conventions, units or reference values. Cite a source. Never
  write reference numbers from memory ([AGENTS.md](../../AGENTS.md)).
- Constants are recorded with a source. The μ and reference-radius values are proposed in
  proposed-architecture §3 and are to be confirmed by the Verification Engineer (VT-19,
  [m1-verification-plan.md](../verification/m1-verification-plan.md) §3).

## 3. Error handling

- The engine does not throw for user-reachable conditions. It returns `status: "failed"` with
  diagnostics (proposed-architecture §4, rules attached to the contract).
- A diagnostic has `severity` (`info` | `warning` | `error`), `code`, `message` and an optional
  `t_s`. This shape is illustrative. The normative version is produced in ML-TASK-004
  (proposed-architecture §4 header).
- A non-finite value is an error diagnostic, never a sample (proposed-architecture §4).
- A sample-count limit is enforced at validation. Its value is measured in Phase 2 (ML-NFR-004;
  proposed-architecture §4).
- The M1 validator rejects more than one maneuver (`maneuvers` length ≤ 1) (proposed-architecture §4).
- Runtime validation uses zod schemas in `packages/contracts`. Static types are inferred from them
  (tech-baseline.md §3.7).
- Results are immutable and identified by `requestId` (proposed-architecture §4).
- The engine has no clock and no randomness, so identical requests give identical results
  (ML-NFR-003; proposed-architecture §4).

## 4. TypeScript and formatting

- `tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` and
  `verbatimModuleSyntax`. `types` is an empty array.
- Package configs (`packages/*/tsconfig.json`) use only the `es2025` lib, without `DOM`. A browser
  global is therefore a type error there (tech-baseline.md §3.9, ML-NFR-001).
- ESLint applies `strictTypeChecked` and `stylisticTypeChecked` to `.ts` and `.tsx` files
  (`eslint.config.js`).
- Prettier settings: semicolons, single quotes, trailing commas `all`, print width 100
  (`.prettierrc.json`).
- `.editorconfig`: UTF-8, LF line endings, 2-space indentation, final newline.
- `.prettierignore` excludes `*.md`, `docs/`, `pnpm-lock.yaml` and `.claude`. Markdown is not
  format-checked.

## 5. Dependencies

- Versions are exact, with no `^` or `~` ranges. `.npmrc` sets `save-exact=true`. Pins are
  listed in tech-baseline.md §2, and the lockfile is committed (tech-baseline.md; ML-NFR-007).
- Adding a dependency requires justification in the PR (ML-NFR-007).
- A dependency not listed in tech-baseline.md is a stop-and-report item for a task
  (ML-TASK-003 `out_of_scope`).
- `packages/astrodynamics` declares no `dependencies`. It must not list `contracts` or `zod`
  (tech-baseline.md §3.7; ADR-002).
- Dependency audit runs in CI (ML-NFR-006): the `audit` job of `.github/workflows/ci.yml` (ML-TASK-005).

## 6. Package boundaries

| Package / app | May import | Source |
|---|---|---|
| `packages/astrodynamics` | nothing from the workspace; no runtime dependencies | ADR-002; `eslint.config.js` |
| `packages/contracts` | `contracts` only, plus external modules (zod) | `eslint.config.js`; tech-baseline §3.7 |
| `packages/simulation` | `contracts`, `astrodynamics` | ADR-002; `eslint.config.js` |
| `verification/` | `contracts` only | ADR-003; `eslint.config.js` |
| `apps/web` | `simulation`, `contracts` | proposed-architecture §1; `eslint.config.js` |

- Outside `apps/web`, the following are forbidden: `react`, `react-dom`, `three`,
  `@react-three/*`, `zustand` (`no-restricted-imports`), and the browser globals listed in
  `eslint.config.js` (`window`, `document`, `fetch`, `Worker`, and others) (ML-NFR-001).
- Simulation code never imports UI, rendering or browser APIs. The renderer never computes physics
  ([AGENTS.md](../../AGENTS.md); ADR-002).
- `verification/` may not import `packages/astrodynamics` (ADR-003).
- Enforcement has three layers: package manifests (pnpm isolation), the TypeScript `lib` setting,
  and ESLint `boundaries/dependencies` with the TypeScript import resolver (tech-baseline.md §3.9).

## 7. Tests and verification evidence

### 7.1 Layout

- Unit tests live in `src/` in each workspace as `*.test.ts`. Vitest runs five projects declared
  in `vitest.config.ts`: `astrodynamics`, `contracts`, `simulation`, `verification`, `web`.
- The current placeholder tests are `src/index.test.ts` in each package (ML-TASK-003 report).
- End-to-end tests live in `apps/web/e2e/` as `*.spec.ts`. Playwright runs Chromium only
  (`apps/web/playwright.config.ts`).
- Reference datasets go in `test-data/reference-cases/<family>/<case>.json` with the fields in
  m1-verification-plan.md §6. Datasets are immutable once approved.
- The Verification Engineer may write test files. The Astrodynamics Engineer may not edit
  `verification/` or `test-data/reference-cases/` (ADR-003; ADR-007).
- A failing test is fixed in the implementation or escalated. It is never loosened or skipped
  (m1-verification-plan.md §1; AGENTS.md).

### 7.2 Three evidence layers

ADR-003 and m1-verification-plan.md §2 define three layers. Each scientific function is accepted
only against all of them.

| Layer | Content | Independence |
|---|---|---|
| L1 Invariants | Closed-form two-body relations | Mathematical |
| L2 Independent implementation | Code in `verification/`, different algorithm, engine source not read | Procedural and algorithmic |
| L3 External reference | Cited textbook examples; one dataset from Orekit or GMAT | Organisational |

- L2 methods: classical elements with Newton solution of Kepler's equation; fixed-step
  Runge–Kutta integration with step-halving check; direct rotation-matrix construction.
- L3 source: Python + Orekit (owner decision D-5, 2026-11-11, `docs/releases/G0-review.md`). No L3 dataset exists yet (ML-TASK-012).
- Tolerances are derived before the engine's results are seen, and the owner approves them.
  The method is fixed; the values are fixed at G1 (ADR-003; m1-verification-plan.md §4).
- Test families VT-01…VT-19, VI-01…VI-03 and VE-01…VE-02 are defined in
  m1-verification-plan.md §3. No test in these families has been written yet (plan header).
- Implementation under test is never the only reference for its own verification (AGENTS.md).

## 8. Documentation identifiers

- Identifiers: `ML-FR-NNN`, `ML-NFR-NNN`, `ML-UX-NNN`, `ML-TASK-NNN`, `ADR-NNN`, `VT-NN`
  (`.claude/agents/docs-release.md`). The verification identifiers `VI-NN` and `VE-NN` are defined
  in m1-verification-plan.md §3.
- Requirement IDs are permanent (m1-requirements.md header).

## 9. Not yet decided

- Naming rules beyond unit suffixes: identifiers, file names, folder names, exported names.
  Only `PACKAGE_NAME` / `PACKAGE_VERSION` constants are observed in the scaffold.
- Whether `_m3ps2` (used in `mu_m3ps2`) is an approved suffix. Suffix for `kg` and for
  dimensionless quantities (for example `eccentricity`) is not stated.
- Whether a function may throw for programmer errors. Only user-reachable conditions are covered.
- The normative diagnostic `code` format and its catalogue (ML-TASK-004).
- Error handling for non-finite inputs beyond the diagnostic rule in section 3.
- Test naming rules and the mapping of VT/VI/VE IDs to test files.
- Separation of unit, integration and numerical tests. Vitest runs one project per package.
  ML-NFR-005 requires integration and numerical runs in CI, which are not configured yet.
- Coverage tooling and thresholds. `@vitest/coverage-v8` is listed in tech-baseline.md only as
  "if coverage is enabled".
- Code review checklist and reviewer requirements.
- Logging conventions.
- Versioning and migration policy for the versioned JSON scenario format
  (ADR-006; proposed-architecture §5).
- Public API documentation format (for example TSDoc). Only the content rule is in ML-NFR-002.
- Lint rules for name-style imports (`@mission-lab/*`). The boundary fixtures use relative paths
  only (ML-TASK-003 report).
