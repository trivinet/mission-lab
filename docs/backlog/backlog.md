# Implementation Backlog — M0/M1

**Document ID:** ML-BKL-001 · **Date:** 2026-11-11 · **Author:** Coordinator · **Status:** Approved at gate G0 (owner, 2026-11-11)

Dependency-ordered. No task after ML-TASK-001 starts before G0 is approved. Once the GitHub
repository exists, each task becomes an issue and this file becomes the index. Full task
contracts follow [task-template.yaml](../agents/task-template.yaml) and are written when a task
is made *ready*, not in advance.

Roles: **CO** Coordinator · **SA** Systems Architect · **AE** Astrodynamics Engineer ·
**FE** Frontend & Visualization Engineer · **VE** Verification Engineer · **DR** Documentation & Release.
**H** = owner approval required beyond the normal merge.

## Phase 0a — Baseline (documents only)

| ID | Task | Role | Depends on | Acceptance | H |
|---|---|---|---|---|---|
| ML-TASK-001 | Phase 0 assessment, architecture, requirements, verification plan, backlog | CO | — | Gate G0 package delivered | ✔ G0 |

## Phase 0b — Scaffold

| ID | Task | Role | Depends on | Acceptance | H |
|---|---|---|---|---|---|
| ML-TASK-002 | Select and pin toolchain and library versions; record in `docs/architecture/tech-baseline.md` | SA | 001 | Versions verified against current stable releases, compatibility (React/R3F) checked, licences listed | ✔ |
| ML-TASK-003 | Monorepo scaffold: workspaces, TS config, lint with import boundaries, test runners, empty packages, empty app shell | FE | 002 | `install`, `lint`, `typecheck`, `test`, `build` succeed locally; boundary rule proven by a failing fixture | |
| ML-TASK-004 | Normative contracts v1.0 in `packages/contracts` (types + runtime schemas) | SA | 003 | Matches approved architecture §4; schema tests; reviewed by AE, FE and VE before merge | ✔ |
| ML-TASK-005 | CI pipeline, PR and issue templates, branch protection on `main` | CO | 003 | CI green on a PR; direct push to `main` rejected | |
| ML-TASK-006 | Coding standards and contributor guide (`docs/engineering/`) | DR | 003 | Covers naming with unit suffixes, error handling, test layout, commit/PR conventions | |
| ML-TASK-007 | Fold Appendix A amendments into the body of ML-SYS-001 (v0.3), no change of meaning | DR | 001 | Every F-01…F-18 resolution and A.2 roadmap item appears in the body; diff reviewed by owner | ✔ |

## Phase 1 — Astrodynamics foundation (gate G1)

| ID | Task | Role | Depends on | Req. | Acceptance | H |
|---|---|---|---|---|---|---|
| ML-TASK-010 | Tolerance derivation and record | VE | 004 | — | `tolerances.md` per verification plan §4, before any engine result exists | ✔ |
| ML-TASK-011 | Independent reference implementations and datasets (L2), constants check (VT-19) | VE | 004 | — | Datasets in `test-data/reference-cases/` with full provenance; RK reference validated by step halving | |
| ML-TASK-012 | External references (L3) | VE | D-5 | — | Cited textbook cases and/or one Orekit/GMAT dataset; or a written statement of the gap | ✔ |
| ML-TASK-013 | Constants, units, vector math | AE | 004 | — | VT-01; constants carry source | |
| ML-TASK-014 | Element ↔ Cartesian conversion incl. degenerate conventions; derived quantities | AE | 013 | FR-002, FR-003 | VT-02, VT-03, VT-04 | |
| ML-TASK-015 | Universal-variable Kepler propagator | AE | 013 | FR-004 | VT-05…VT-09 | |
| ML-TASK-016 | RSW basis and impulsive maneuver | AE | 013 | FR-006 | VT-11…VT-15 | |
| ML-TASK-017 | Simulation runner: validation, segments, sampling, events, diagnostics, metadata | AE | 014, 015, 016 | FR-004, FR-006, FR-012 | VT-10, VT-16, VT-18, VI-01 | |
| ML-TASK-018 | Numerical suite wired into CI; G1 verification report | VE | 011, 017 | — | All VT pass in CI; report states evidence layer per family | ✔ G1 |

Parallelism: 010–012 (VE) run alongside 013–016 (AE), in separate worktrees and directories.
014, 015 and 016 touch separate modules and may run in parallel after 013.

## Phase 2 — Interactive workspace (gate G2)

| ID | Task | Role | Depends on | Req. | Acceptance | H |
|---|---|---|---|---|---|---|
| ML-TASK-020 | Visual direction: workspace layout and design tokens (mock-up) | FE | 003 | §9 | Owner approves the mock-up | ✔ |
| ML-TASK-021 | Scenario store, result states, worker host | FE | 004 | FR-001, UX-001…003 | VE-02 (against a stub engine until 017 lands) | |
| ML-TASK-022 | Scenario editor with validation and derived values | FE | 020, 021 | FR-001, FR-002, FR-005 | e2e for editing and each validation class | |
| ML-TASK-023 | 3D scene: Earth, trajectory, markers, camera, scene-state hook | FE | 020, 021 | FR-007 | VI-02 | |
| ML-TASK-024 | Timeline and playback with display interpolation | FE | 023 | FR-008 | FR-008 AC1–AC3 | |
| ML-TASK-025 | Model & assumptions panel | FE | 017, 021 | FR-012 | FR-012 AC1–AC3 | |
| ML-TASK-026 | Integration with the real engine; performance envelope and sample limit | FE + VE | 017, 022–024 | NFR-004 | Measured record; limit enforced | ✔ G2 |

Parallelism: 020–021 may start during Phase 1 once 004 is merged, against a stub engine.

## Phase 3 — Analysis and comparison (gate G3)

| ID | Task | Role | Depends on | Req. | Acceptance | H |
|---|---|---|---|---|---|---|
| ML-TASK-030 | Charting library spike (OD-006) and ADR-008 | FE | 026 | — | Candidates tested on representative data; ADR proposed | ✔ |
| ML-TASK-031 | Analysis module: histories and coast-vs-maneuver comparison | AE | 017 | FR-009, FR-010 | VI-03; FR-010 AC3 | |
| ML-TASK-032 | Plots and comparison UI | FE | 030, 031 | FR-009, FR-010 | FR-009, FR-010 ACs | |
| ML-TASK-033 | Persistence: format, validation, save/load UI, unsaved indicator | AE + FE | 004, 022 | FR-011 | VT-17, VT-18 | |
| ML-TASK-034 | Presets and CSV export (SHOULD) | FE | 033 | FR-013, FR-014 | Their ACs | |
| ML-TASK-035 | Acceptance scenario end-to-end test | VE | 032, 033 | §14 | VE-01 passes | ✔ G3 |

## Phase 4 — Stabilisation and release (gate G4)

| ID | Task | Role | Depends on | Acceptance | H |
|---|---|---|---|---|---|
| ML-TASK-040 | Full regression, accessibility and keyboard review, error-path review | VE | 035 | Report; defects filed and closed or accepted by owner | |
| ML-TASK-041 | User guide, developer guide, traceability matrix, release notes | DR | 035 | Every FR traces to tests and evidence | |
| ML-TASK-042 | Hosting decision and deployment setup | CO | 040 | Owner-chosen provider; preview works | ✔ |
| ML-TASK-043 | Release v1.0.0 checklist and tag | CO | 040–042 | Owner walkthrough of §14 | ✔ G4 |

## Risks carried forward

| ID | Risk | Mitigation |
|---|---|---|
| R-002 | Frame/time inconsistency | ADR-004; unit-suffixed names; single conversion modules |
| R-003 | Plausible but wrong visuals | ADR-003; VI-02 |
| R-004 | Scope growth | Out-of-scope list in requirements §1; changes only through the owner |
| R-005 | Agent edit conflicts | Package ownership; one task per branch/worktree |
| R-007 | Weak references | Three evidence layers; L3 gap reported explicitly |
| R-008 | Documentation overhead | Task contracts written just-in-time; no documents beyond those listed |
| R-009 (new) | Implementer and verifier share model blind spots | L3 external reference (D-5) |
| R-010 (new) | Repository inside a cloud-synced folder: file locking and slow installs once `node_modules` exists | Owner decision D-6 before ML-TASK-003 |
