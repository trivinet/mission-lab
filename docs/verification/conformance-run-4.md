# Conformance Run 4 — revision 5: hyperbolic arcs (O-12, O-13)

**Document ID:** ML-VER-007 · **Date:** 2026-11-16 · **Author:** Verification Engineer (ML-TASK-018 part D3, phase 2) · **Status:** In review (not approved)

Fourth engine run. It covers what [tolerance record revision 5](tolerances.md) (approved by the
owner on 2026-11-16, commit b60a06a) adds: the extended O-1 solver check on hyperbolic arcs (O-12),
the A6′ hyperbolic criterion for Orekit (O-13), and the hyperbolic state rows that conformance run 3
reported as informative and that §4.1 item 6 now asserts. Result: **all three conditions of §4.1
item 6 held in one run; every comparison passed; nothing failed.** No engine defect and no
reference defect was found.

## 1. Order of work (evidence for tolerances.md §4.1 and ADR-003)

| Commit | Content | Engine read or run? |
|---|---|---|
| 6967f93 … ebf18a5 (PR #35) | Phase 1: record revision 5, `selfcheck.py` A6′ hyperbolic checks, O-1 hyperbolic reference and thresholds (`o1-hyp-r5`, codeRevision 8ac71f4 after review N1), gated conformance test `vt16-r5-hyperbolic.test.ts` | No (public `export` lines only) |
| b60a06a | Owner approval of revision 5 (status line, §15) | — |
| c9aaaf8 | Merge of PR #35 into `main`; phase 2 branch `test/ml-task-018d3-phase2` cut from it | — |
| 959e9ac | Step 1: engine event state of L3 `c1-escape-prograde` (writer mode of the gated test; its output was redirected to a file and not read before step 2 was committed) | Run |
| 55d1670 | Step 2: Orekit arc restarted from that event state (`conformance/l3-restart-r5/restart_r5.py`, which runs `verification/l3-d2/restart.py` unchanged), committed before any comparison result was looked at | No (Orekit only) |
| — | Step 3: `selfcheck.py` on the L3 datasets and both restart directories (§2) | No |
| — | Step 4: `ML_CONFORMANCE_REV5=1 pnpm vitest run --project conformance` (§3) | Run |

Between `main` (c9aaaf8) and the run, no reference, dataset, tolerance or test was changed; the only
new files are the two step-1/step-2 artefacts above. The difference between the reviewed branch tip
ebf18a5 and `main` is the approval edit of the record only.

## 2. A6′ (O-13): selfcheck

Orekit venv `C:\dev\mission-lab-tools\orekit-venv` (Python 3.13.17, Orekit 13.1.9, orekit_jpype
13.1.9.0, Hipparchus 4.0.3, JDK Temurin 21.0.13).

| Command | Exit | Pass/fail checks | Failures | Info |
|---|---|---|---|---|
| `selfcheck.py --repro --restart conformance/l3-restart` | 0 | 500 | 0 | 66 |
| `selfcheck.py --restart conformance/l3-restart-r5` | 0 | 495 | 0 | 66 |

Reproducibility: generator unchanged since df84b5e6d75a, same 43 files, byte-identical regeneration.
Hyperbolic A6′ rows, worst sample (observed / bound = ratio):

| Arc | Energy | ‖Δh‖/h | Time of flight (s) |
|---|---|---|---|
| Orekit segment 1, c1-escape-prograde | 2.301e-15 / 2.087e-11 = 1.1e-4 | 3.532e-16 / 7.946e-12 = 4.5e-5 | 1.030e-11 / 1.960e-7 = 5.3e-5 |
| Orekit segment 1, c3-midrun-escape | 7.688e-16 / 2.794e-12 = 2.8e-4 | 3.933e-16 / 5.041e-12 = 7.8e-5 | 8.499e-12 / 6.110e-8 = 1.4e-4 |
| Restarted `l3-restart/c3-midrun-escape` | 2.691e-15 / 2.794e-12 = 9.6e-4 | 2.622e-16 / 2.736e-12 = 9.6e-5 | 2.280e-12 / 1.721e-8 = 1.3e-4 |
| Restarted `l3-restart-r5/c1-escape-prograde` (new) | 2.301e-15 / 2.087e-11 = 1.1e-4 | 3.404e-16 / 7.946e-12 = 4.3e-5 | 1.983e-11 / 2.991e-7 = 6.6e-5 |

The restarted elliptic arc `c4-midrun-retro-subsurface` passes the approved A6 checks (7.0e-5,
5.2e-5). **Condition (b) of §4.1 item 6 holds.**

## 3. Engine comparisons

Runtime: Node.js v24.22.2, Windows 11, Vitest 5.0.5; engine as on `main` c9aaaf8 (public API only:
`propagateKeplerUniversal` for O-1, `runSimulation` for the state rows). Conformance project: 25 files,
614 tests, all passed, none skipped (with the switch set).

"Ratio" = observed / tolerance (≤ 1 passes), maximum over the row.

| Row | Cases / samples | Worst ratio | Where | Result |
|---|---|---|---|---|
| Extended O-1, VT-16 hyperbolic arcs (§6.8) | 6 arcs / 402 samples | 0.069 | L2 escape-clear, Δt = 120 s | pass |
| Extended O-1, grid incl. near-gate supplement | 144 cases / 144 samples | 0.083 | \|a\| 3.0e7, e 5, F₀ 0, n_h Δt 0.05 | pass |
| VT-16 hyperbolic vs L2b (`vt-16-r4`), position | 4 arcs / 367 samples | 0.0032 | c3-midrun-escape, t = 7620 s | pass |
| — velocity | 4 / 367 | 0.0033 | c3-midrun-escape, t = 5940 s | pass |
| L3 VT-16 hyperbolic segment 1 vs restarted Orekit, position | 2 arcs / 35 samples | 0.0010 | c1-escape-prograde, t = 17 000 s | pass |
| — velocity | 2 / 35 | 0.0016 | c3-midrun-escape, t = 6000 s | pass |
| L3 c1 premise: ‖Δv_I,engine − Δv_I,Orekit‖ vs L3 VT-12 row (1.972e-10 m/s) | 1 | 0.0053 | c1-escape-prograde | pass |
| L3 c1 premise: event pre-maneuver state = initialState | 1 | exact | — | pass |
| First sample of each segment 1 (event state, R8) | 6 | exact | — | pass |

The O-1 total is 150 cases / 546 samples, all passed; every asserted test also checked in code that
all 150 O-1 cases ran and passed in the same run (§4.1 item 6 (c)). Before use, both restarted
arcs were checked to start from the engine's current event state bit-for-bit, and the L2 E_RK
transfer condition (event state within 1e-6 relative of the reference start) held for all four
arcs. **Conditions (c) and the asserted state rows hold; with §2, all three conditions of §4.1
item 6 held in one run.**

Whole repository without the switch: `pnpm test` (default worker count) exited 1 in four attempts
with 2–3 **timeouts** (Vitest's 5 s default) in pre-existing verification tests unrelated to this run
(`hp/a3-math-accuracy`, `ref/grid` large-span counting, `ref/kepler` L2a solver); the same three fail
identically on `main` c9aaaf8 without any phase-2 file, and the suite duration was about 32 s
against about 12 s on 2026-11-15, so the machine was slower. The same suite passes with
`npx vitest run --maxWorkers=4` (67 files, 1415 passed, 156 skipped = the gated tests; exit 0), and
the three files pass alone. No test was changed (§7).

## 4. Status of O-12 and O-13

- **O-12 — proven by this run.** The engine's universal-variable solve ends within ε_t,gen +
  δt_α,hyp on every sample of the six VT-16 hyperbolic arcs and of the 144-case grid; the largest
  ratio is 0.083. The assumption under ε_t,gen (§6.8 Scope) holds for the engine on the tested set.
- **O-13 — proven.** A6′ for Orekit's hyperbolic propagation passes pass/fail on Orekit's own arcs
  and on both restarted arcs (§2).
- The record is not edited by this run (it is approved); the record's §12 already states that O-12
  and O-13 close on these results. The hyperbolic VT-16 state rows are now **asserted evidence**,
  L2b and L3.

## 5. Evidence layers behind VT-16 after this run

| Family part | Layers | Missing |
|---|---|---|
| VT-16 warnings | L2 analytic classification (run 2), L3 Orekit expectations (run 3) | — |
| VT-16 elliptic sub-surface states | L2a, L2b (run 2), L3 restarted (run 3) | — |
| VT-16 hyperbolic states | **L2b and L3 asserted (this run)** | — |
| Solver residual, hyperbolic | **black-box O-1 check, 320-bit (this run)** | Δt < 0; arcs below the 0.05 gate |

Other families are as in conformance-run-3.md §4; VT-14 remains "VT-14: e = 0 only".

## 6. Limits of the evidence

1. The restarted Orekit arcs (`conformance/l3-restart`, `conformance/l3-restart-r5`) are tied to the
   engine's event states bit-for-bit. An engine change that moves an event state makes the L3
   segment-1 tests fail as stale until the restart and `selfcheck.py --restart` are rerun in the
   Orekit environment (not available in CI). This must be handled before CI wiring (as in run 3).
2. The O-1 check covers Δt > 0 inside the §7 VT-16 gate only; near-parabolic arcs (ratio < 0.05)
   have no bound and were not checked. 50 of the 144 grid arcs pass inside R_ref; the propagator
   accepted all of them (record §6.8 N7: a pure Kepler solve).
3. The A6′ bounds are worst-case and loose (measurements ≤ 0.1 % of them): they confirm A6′, they
   do not measure Orekit's accuracy. L3 rests on one external tool (Orekit 13.1.9).
4. The O-1 thresholds and the selfcheck formulas were checked against a 60-digit decimal evaluation
   in phase 1; the 320-bit evaluator is in-repo code (validated against an independent 200-bit
   hyperbolic propagation), not a second tool.
5. The step-1 writer run executed the whole gated file (O-1 and comparisons) before the c1 restart
   existed; its output was redirected to a file and not read before step 2 was committed. That run
   failed on the c1 L3 test only by design (restarted arc missing). The results reported here are
   from step 4.
6. This report is committed, not approved.

## 7. Findings

- No conformance failure, no engine defect, no reference or dataset defect.
- Worst asserted ratios: O-1 hyperbolic 0.083 (grid) and 0.069 (VT-16 arcs); hyperbolic states
  0.0033 (L2b) and 0.0016 (L3). The state ratios equal the informative values of run 3 (0.0033 vs
  L2b; 0.0016 vs L3), as expected for an unchanged engine; the c1 comparison now uses the restarted
  arc, and its worst ratio (0.0010 position) is below run 3's informative c1 value.
- **Repository finding (not a conformance result):** three pre-existing verification tests run close
  to Vitest's 5 s default timeout and time out under parallel load on this machine (§3), on `main`
  as well. They need an explicit timeout (as the 320-bit tests already have) before CI wiring; this
  belongs to the CI-wiring part and was not changed here.
- **Next step (N5), not done here:** once the owner accepts this report, the switch is removed: in
  `conformance/src/vt16-r5-hyperbolic.test.ts` the three `describe.skipIf(!enabled)` become plain
  `describe`, the writer block stays behind `ML_WRITE_R5_EVENT_STATES` only, and `rev5Enabled()` is
  replaced by a call that keeps the record lock (throws unless `recordApprovesRev5`) without reading
  `ML_CONFORMANCE_REV5`; `conformance/l3-restart-r5/README.md` and the gate's doc comment are updated
  accordingly. The tests then run in every `pnpm test` and in CI.
