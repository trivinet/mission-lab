# Gate G2 — Workspace Review Decision

**Date:** 2026-11-17 · **Prepared by:** Coordinator · **Decision owner:** Product Owner
**Status:** **APPROVED** by the owner on 2026-11-17 ("Apruebo G2"), on the evidence at `main` f5289fd and with the limits in section C. Phase 3 may start on tasks marked *ready*.

Gate G2, from the [verification plan](../verification/m1-verification-plan.md) §8: "VI-01, VI-02,
VE-02 pass". The backlog adds the Phase 2 tasks ML-TASK-020…026 and the owner-approved performance
envelope (ML-NFR-004).

## A. Evidence for the gate criteria

| Item | What it checks | Tests (all passing on `main`, CI green) |
|---|---|---|
| VI-01 | Request → result structure, segments and events, metadata completeness | `conformance/src/vi01-structure.test.ts` (engine); `apps/web/src/worker/vi01-integration.test.ts` (app request builder + worker handler, real engine, with a maneuver); `apps/web/src/worker/run-handler.test.ts` |
| VI-02 | Every rendered trajectory vertex equals `Math.fround(sample × s)` (ML-FR-007 AC2) | `apps/web/src/scene/scene-geometry.test.ts` (918 components, 3 scenarios, `Object.is`, 0 mismatches; a 1.0000001 scale mutation fails 4 tests); `apps/web/e2e/scene.spec.ts` (browser, default and maneuvered, 0 mismatches); `apps/web/e2e/playback.spec.ts` (marker at sample times) |
| VE-02 | Result states none → computing → current → stale | `apps/web/e2e/result-states.spec.ts` (real engine in the worker); `apps/web/src/state/result-state.test.ts` (every transition) |

Suite at f5289fd: 1792 unit/integration tests and 53 browser e2e tests (Chromium), all passing locally
and in CI.

## B. Phase 2 deliverables

| Task | Delivered | Requirements |
|---|---|---|
| ML-TASK-020 | Visual direction approved (layout A, blue accent, banner + chip) | §9 |
| ML-TASK-021 | Store, five result states, engine in a Web Worker (latest run wins) | FR-001 AC1–AC2, UX-001…003 |
| ML-TASK-022 | Layout, scenario editor, field validation from the engine, derived values, degenerate convention, maneuver, keyboard | FR-001, FR-002, FR-005, UX-004 |
| ML-TASK-023 | 3D scene, exact vertices, scene-state hook | FR-007 |
| ML-TASK-024 | Timeline, playback, Hermite display interpolation exact at samples | FR-008 |
| ML-TASK-025 | Model and assumptions panel from `SimulationResult.model`; not-qualified statement (owner-approved wording) | FR-012 |
| ML-TASK-026 | Integration; measured performance envelope; hard limit 1,000,000 kept with a soft warning above 250,000 (owner decision 2026-11-17); deterministic maneuver ids | NFR-004, contracts-v1 §14 |
| ML-TASK-027 | Scenario-view API in `packages/simulation` so the UI computes no physics | FR-002, FR-005, ADR-002 |

## C. Not verified, or accepted limits

- Browsers other than Chromium; screen reader; colour contrast of the newer text; colour-blind
  rendering.
- Rendering on a real GPU: the performance record used software WebGL on one loaded machine
  ([performance-envelope.md](../verification/performance-envelope.md)).
- ML-FR-001 AC3 (confirmation before replacing an unsaved scenario) is deferred to ML-TASK-033
  (persistence, Phase 3), as recorded in the ML-TASK-021 report.
- A superseded run is discarded, not cancelled; a long earlier run delays a later one.

## D. Decision requested

1. Approve gate G2 on the evidence above, with the limits in C.
2. Recommended before approving: a short owner walkthrough of the workspace
   (`pnpm --filter @mission-lab/web dev`, then edit the orbit, add a maneuver, run, play).
