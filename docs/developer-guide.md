# Mission Lab developer guide

**Release:** M1 (v1.0.0 draft) · **Audience:** a developer or reviewer who was not part of the
project so far.

This guide gathers what the repository already establishes and points to the source of each rule.
Where this guide and a source disagree, the source wins; report the difference. Where the
repository does not define something, this guide says so instead of guessing. Related documents:
[contributing.md](engineering/contributing.md), [coding-standards.md](engineering/coding-standards.md),
[AGENTS.md](../AGENTS.md), [user guide](user-guide.md),
[traceability matrix](verification/traceability-matrix.md).

## 1. Authority

Source precedence, highest first (AGENTS.md): owner decisions; approved requirements and
architecture (`docs/product/ML-SYS-001.md`, `docs/requirements/`, `docs/architecture/`); approved
ADRs and contracts (`docs/architecture/adr/`, `packages/contracts`); repository conventions; the
task contract. If two sources conflict, stop and report. A document marked *Proposed* is not
authority.

Identifiers: `ML-FR-NNN`, `ML-NFR-NNN`, `ML-UX-NNN`, `ML-TASK-NNN`, `ADR-NNN`, `VT-NN` (and
`VI-NN`, `VE-NN`, defined in the verification plan). Requirement IDs are permanent.

## 2. Repository layout and boundaries

Decision: ADR-002 (layout) and ADR-009 (conformance workspace).

| Path | Role | May import (workspace) |
|---|---|---|
| `packages/astrodynamics` | Pure physics. No runtime dependencies. | nothing |
| `packages/contracts` | Shared types and zod schemas (contracts v1.0, `docs/architecture/contracts-v1.md`) | nothing |
| `packages/simulation` | Run orchestration, scenario view, analysis (histories, comparison, coast request) | `contracts`, `astrodynamics` |
| `apps/web` | UI, 3D scene (three, react-three-fiber), plots (uPlot), worker host, persistence | `simulation`, `contracts` |
| `verification/` | Independent reference code, tolerance transcriptions, dataset builders, Orekit scripts | `contracts` only |
| `conformance/` | Tests only. Feeds the reference datasets to the engine and compares. Nothing imports it. | `astrodynamics`, `simulation`, `contracts`, `verification` |
| `test-data/` | Reference datasets (`reference-cases/`) and Orekit L3 datasets (`l3-orekit/`) | data |
| `tools/boundary-fixtures` | Illegal-import fixtures that prove the lint rules work | tooling |
| `docs/` | Documents, backlog, status board | not code |
| `spikes/` | Throwaway experiments (`spikes/charting` for ADR-010) | not product |

Sources: `docs/engineering/coding-standards.md` section 6; `eslint.config.js`;
`conformance/package.json`.

Rules that matter most:

- Simulation code never imports UI, rendering or browser APIs. The renderer never computes
  physics (AGENTS.md; ML-NFR-001). Outside `apps/web`, `react`, `react-dom`, `three`,
  `@react-three/*`, `zustand` and browser globals are forbidden by lint
  (coding-standards section 6).
- `verification/` may not import the engine, so reference code stays independent (ADR-003,
  ADR-009).
- `packages/astrodynamics` takes no runtime dependency without a new ADR (ADR-002).
- The engine has no clock and no randomness (ML-NFR-003). Time inside the engine is elapsed
  seconds `t_s` from the scenario epoch; physical field names carry unit suffixes
  (`_m`, `_mps`, `_s`, `_rad`). The one frame is `GCRF`; UTC appears only at the scenario boundary
  (ADR-004; coding-standards section 1).
- Persistence is JSON-only; there is no backend (ADR-006, AGENTS.md).

Data flow in the app: the scenario store (`apps/web/src/state`) holds the scenario and the result
state; a run builds a request, posts it to a Web Worker (`apps/web/src/worker`), which runs the
engine and returns a `SimulationResult`. The scene, plots, model panel, CSV export and comparison
table all read that result. The analysis module (`packages/simulation/src/analysis`) supplies the
plotted values, so the UI computes no physics.

## 3. Toolchain and commands

Pinned versions: Node 24.22.2 (`.nvmrc`, `engines.node` `>=24.22.2 <25`), pnpm 12.16.1
(`packageManager`), exact dependency versions with a committed lockfile (`.npmrc`
`save-exact=true`). Full machine setup (Windows 11): `docs/engineering/contributing.md` section 5.
Playwright uses Chromium only.

All commands run from the repository root (root `package.json`):

| Command | Does |
|---|---|
| `pnpm install --frozen-lockfile` | Installs from the lockfile |
| `pnpm lint` | `eslint .`, including the import-boundary rules |
| `pnpm typecheck` | Root `tsc --noEmit`, then each workspace |
| `pnpm test` | `vitest run`: six projects, `astrodynamics`, `conformance`, `contracts`, `simulation`, `verification`, `web` (`vitest.config.ts`) |
| `pnpm build` | Builds the workspaces that define a build (`apps/web`: `tsc`, then `vite build`) |
| `pnpm format` / `pnpm format:check` | Prettier write / check. `.prettierignore` excludes `*.md` and `docs/`, so Markdown is not checked |
| `pnpm check:boundaries` | Exits 0 only if every illegal-import fixture is reported |
| `pnpm test:e2e` | Playwright in `apps/web` (builds, serves with `vite preview` on port 4173, Chromium) |
| `pnpm perf:envelope` | Playwright performance probe (`apps/web/playwright.perf.config.ts`) that produced `docs/verification/performance-envelope.md` |
| `pnpm --filter @mission-lab/web run dev` | Vite development server |

Running one project: `pnpm vitest run --project conformance` (the form used in
`docs/verification/l3-restart-procedure.md`). Contributing.md section 8 lists "how to run one
package's tests alone" as undecided; the command above is used in other repository documents but
is not recorded as a rule.

## 4. Continuous integration

`.github/workflows/ci.yml`, on every pull request and on pushes to `main`. Third-party actions are
pinned by commit hash.

| Job | Steps |
|---|---|
| `checks` | install (frozen lockfile), `format:check`, `lint`, `check:boundaries`, `typecheck`, `test`, `build` |
| `e2e` | install, install Chromium, `pnpm test:e2e` |
| `audit` | `pnpm audit --audit-level high`. Informational: not a required check (ML-NFR-006) |

`pnpm test` includes the whole `conformance` project, so the reference comparisons run in CI. CI
has no Orekit, Python or JDK, so the L3 datasets are committed files and are never regenerated in
CI (`l3-restart-procedure.md`). That `checks` is a required status check on `main` is stated in the
G1 verification report (section on gate criterion 4); branch protection settings themselves are not
in the repository.

## 5. How verification is organised

Principles (`docs/verification/m1-verification-plan.md` sections 1 and 2; ADR-003):

1. A result is accepted on numerical evidence, never on appearance.
2. The reference for a scientific test is never produced by the code under test.
3. Tolerances are derived and recorded before the engine's results are seen.
4. A failing test is fixed in the implementation or escalated. It is never loosened or skipped.

**Layers.**

| Layer | Source |
|---|---|
| L1 | Closed-form invariants and relations |
| L2 | Independent implementation in `verification/` (different algorithm; engine source not read) |
| L3 | External: Orekit datasets in `test-data/l3-orekit/` (owner decision D-5). Textbook L3 does not exist (owner decision OA-15 open; `l3-textbook-assessment.md`) |

**Test families.** VT-01…VT-19 (numerical), VI-01…VI-03 (integration), VE-01…VE-02 (end to end);
the table is in the verification plan section 3. Test files are named after their family, for
example `conformance/src/vt05-propagation.test.ts`, `conformance/src/vi03-analysis.test.ts`,
`apps/web/e2e/acceptance.spec.ts` (VE-01). The traceability matrix maps requirements to files.
Contributing and coding-standards note that no naming rule for tests is decided.

**Tolerance record.** `docs/verification/tolerances.md` (revision 5, approved by the owner on
2026-11-16 per G1-review.md). It holds the error model, margins and per-family tolerances. Its
section 15 lists approvals and "Loosenings". Never change a tolerance without a written
justification and owner approval (plan section 4). Do not edit this file as part of ordinary
work.

**Phase discipline (tolerances.md section 4.1).** A tolerance evaluated at a new dataset scale is
valid only if the dataset and the evaluated tolerance are committed before the engine is run on
that dataset (evidence: commit order in `main`). Inputs to the evaluation come from the reference
side, never from engine output. Making a tolerance larger than the approved formula gives needs
owner sign-off before the engine is run against it. The conformance run reports record this as a
table of commits ("phase boundary", for example `conformance-run-5.md` section 1).

**Conformance runs.** Reports of running the engine or the analysis module against the reference
datasets, written by the Verification Engineer:

| Run | Subject |
|---|---|
| `docs/verification/conformance-run-1.md` | engine against the L2 reference datasets |
| `docs/verification/conformance-run-2.md` | remaining VT families, VI-01 and the runner |
| `docs/verification/conformance-run-3.md` | revision-4 rows and the L3 Orekit comparison |
| `docs/verification/conformance-run-4.md` | revision 5: hyperbolic arcs |
| `docs/verification/conformance-run-5.md` | VI-03 (b) and ML-FR-010 AC3: analysis module |

**Restarted Orekit arcs.** When an engine change moves an event state by even one bit, the
restarted Orekit arcs for the VT-16 segment-1 tests become stale and the comparison fails with
`restarted arc was produced from another event state (stale); regenerate`. The procedure to tell a
stale arc from an engine defect, and to regenerate (Verification Engineer only, pinned Orekit
environment, commands, review and owner approval) is in
`docs/verification/l3-restart-procedure.md`. Its status is *Proposed*: it has not been reviewed
by the Verification Engineer. Do not regenerate to make a tolerance failure go away.

**Approved evidence is versioned.** Reference datasets are immutable once approved; a change is a
new version that needs its own approval (plan section 6; G1-review.md decision 4).

**End to end.** `apps/web/e2e/acceptance.spec.ts` walks the 13-step release scenario
(ML-SYS-001 section 14), mapped in `docs/verification/ve-01-acceptance.md`. It is a flow test, not
numerical verification. The test hooks used by the e2e tests (`?sceneHook=1`) expose scene and
plot data so vertices and plotted values are checked exactly, not by image.

## 6. How to add a feature without breaking the rules

1. Take a task. One task = one `ML-TASK-NNN` = one branch `<type>/ml-task-nnn-slug` = one pull
   request. Only the owner merges to `main`. Read the contract in `docs/backlog/tasks/` and
   confirm it is *ready* (every field filled, acceptance criteria testable). Touch only the task's
   `affected_paths` (AGENTS.md).
2. Check the requirement. A new capability needs an approved requirement with acceptance criteria
   and a verification method. Do not change scope, architecture, scientific assumptions or
   tolerances; propose an ADR instead.
3. Put the code in the right package (section 2). Physics goes in `packages/astrodynamics` or
   `packages/simulation`. The UI only displays what the engine returns.
4. Document every public physics function with units, frame and source (ML-NFR-002). Do not
   invent constants, conventions or reference numbers; cite a source.
5. Write tests. Scientific changes need evidence from an independent reference, written without
   reading the implementation (AGENTS.md; ADR-003). Never weaken, skip or delete a test to make
   a change pass.
6. If you add a dependency, justify it in the PR (ML-NFR-007). One not listed in
   `docs/architecture/tech-baseline.md` is a stop-and-report item.
7. Run the checks in the order used in task reports: install, lint, typecheck, test, build,
   format:check, check:boundaries, test:e2e.
8. Fill in the `report:` section of the task file (`docs/agents/task-template.yaml`), separating
   done and verified, done but not verified, and proposed. Open the PR with summary and
   verification evidence. Stop.
9. No deployment, publication or other external action without owner authorisation.

Roles and model allocation are in ADR-007 and `.claude/agents/`.

## 7. Where things are decided or recorded

| Question | Document |
|---|---|
| What must M1 do? | `docs/requirements/m1-requirements.md` |
| Engine and UI contract | `docs/architecture/contracts-v1.md` |
| Why this layout, frame, algorithm, stack, charting library | ADR-002, 004, 005, 006, 010 |
| Degenerate elements and angular accuracy | ADR-008 |
| Gate decisions and accepted limits | `docs/releases/G0-review.md` … `G3-review.md` |
| Task status | `docs/status/status.json`, `docs/backlog/backlog.md` |
| Sample limit and performance | `docs/verification/performance-envelope.md` |

## 8. Known gaps in this guide's sources

- Allowed branch `<type>` values, commit message format, merge method, reviewer counts and branch
  protection are not defined in the repository (contributing.md section 8).
- `contributing.md` and `coding-standards.md` still contain statements from before Phase 1
  (for example "five Vitest projects", "no test has been written yet", "no L3 dataset exists
  yet"). This guide follows the repository as it is now; the differences are listed in the
  ML-TASK-041 report.
- The package versions are all `0.0.0`. The versioning and release process for v1.0.0 is not
  defined in the repository; it belongs to ML-TASK-043.
