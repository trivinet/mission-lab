# Gate G3 — Analysis Review Decision

**Date:** 2026-11-17 · **Prepared by:** Coordinator · **Decision owner:** Product Owner
**Status:** **APPROVED** by the owner on 2026-11-17 ("apruebo G3"), on the evidence at `main` 3e7e502 and with the limits in section C; the optional review of run-5 readings was not requested. Phase 4 may start.

Gate G3, from the [verification plan](../verification/m1-verification-plan.md) §8: "VI-03, VE-01
pass; VT-17 and the FR-011 AC3 part of VT-18 pass (moved from G1 with persistence, ML-TASK-033)".

## A. Evidence for the gate criteria

| Item | What it checks | Evidence (all passing on `main`, CI green) |
|---|---|---|
| VI-03 (a) | Plotted values equal the analysis module output (FR-009 AC3), exact | `apps/web/src/plots/plot-model.test.ts` (13 quantities, 3 scenarios, coast included, `Object.is`); `apps/web/e2e/plots.spec.ts` (read back from uPlot, 0 mismatches) |
| VI-03 (b) | Analysis values correct against an independent recomputation, under tolerances.md rev. 5 §8 | [Conformance run 5](../verification/conformance-run-5.md): 1,217 history samples, worst ratio 0.090 (Ω, C5); independent 200-bit reference; phase boundary 894ad6b |
| FR-010 AC3 | Comparison-table values against independent references | Conformance run 5: 5 maneuver cases, all rows pass, worst ratio 0.035 |
| VE-01 | The 13-step release acceptance scenario (ML-SYS-001 §14) | `apps/web/e2e/acceptance.spec.ts`, mapped in [ve-01-acceptance.md](../verification/ve-01-acceptance.md); passes with `--repeat-each=3`; reload and rerun give byte-identical engine positions and the same requestIds |
| VT-17 | Save → load → save byte identity; load → run reproduces the result | `apps/web/src/persistence/scenario-file.test.ts` (default, maneuvered, degenerate), `apps/web/e2e/persistence.spec.ts` |
| VT-18 (FR-011 AC3) | Each invalid file class rejected with its message, scenario unchanged | `scenario-file.test.ts` (14 classes, deep-equality after each), `persistence.spec.ts` |

Suite at 3e7e502: 1,978 unit/integration tests and 77 browser e2e tests (Chromium), all passing
locally and in CI.

## B. Phase 3 deliverables

| Task | Delivered |
|---|---|
| ML-TASK-030 | ADR-010 accepted: uPlot 1.6.32; angles break the line at each wrap |
| ML-TASK-031 | Analysis module: histories per segment, coast-vs-maneuver comparison, coast request |
| ML-TASK-032 | Plots, coast run in scene and plots, comparison table, text alternatives |
| ML-TASK-033 | Versioned scenario file (64 KiB limit, owner-confirmed), validated load, unsaved indicator, confirmation dialog |
| ML-TASK-034 | Three presets (owner-approved), round-trip CSV export, comparison-table display precision |
| ML-TASK-035 | VE-01 acceptance test |
| ML-TASK-036 | Conformance run 5 (VI-03 (b), FR-010 AC3) |

## C. Accepted limits (owner decisions recorded)

- Quantities with no approved tolerance row are informative only (owner, 2026-11-17, PR #65): e, ω,
  ν on hyperbolic states; r_p, r_a, T histories; hyperbolic r_p; convention-assigned angles on
  degenerate orbits. All measured differences ≤ 4.4e-15.
- Flight-path angle and mean anomaly histories are not provided (owner, 2026-11-17, PR #60; not in
  FR-009 AC1).
- Chromium only; no screen-reader test; real OS file dialogs and downloads not tested outside
  Playwright.
- Analysis and plot construction run once per result on the main thread and are not measured near
  the 1,000,000-sample limit.
- VE-01 is a flow test, not numerical verification (numerical evidence: G1 and conformance runs).
- Readings of the tolerance record chosen in conformance run 5 §4 items 5–9 have not had a separate
  Systems Architect review.

## D. Decision requested

1. Approve gate G3 on the evidence above, with the limits in C.
2. Optional before approving: a bounded Systems Architect review of conformance run 5 §4 readings
   5–9.
