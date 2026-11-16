# G1 Verification Report — engine

**Document ID:** ML-VER-003 (as instructed; see §10 item 1: this ID is already used by
`l2-references-report.md`) · **Date:** 2026-11-16 · **Author:** Verification Engineer
(ML-TASK-018, final part) · **Status:** Proposed, for owner review at gate G1

Gate G1 needs, from the [verification plan](m1-verification-plan.md) §8: "VT-01…VT-19 pass;
tolerance record approved; verification report listing which layers back each family, with L3
gaps stated explicitly". ML-TASK-018's acceptance criterion adds: "all VT families pass in CI
(plan §7); the G1 report states the evidence layers per family (plan §8)".

This report collects evidence. It does not create any. Every number below comes from a run
report or a task report and is cited there. I also re-ran the whole suite and the conformance
project on the commit under review (§1.2), and every worst ratio quoted below was reproduced
there.

Words used: **verified** = a test asserts it and the test passed; **informative** = measured
and printed, no assertion; **not verified** = no test, or no approved tolerance; **proposed** =
a recommendation that needs a decision.

## 1. Summary verdict

### 1.1 Criterion by criterion

| # | G1 criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | VT-01…VT-19 pass | **Not met as written.** 18 of the 19 families have tests that pass. **VT-17 has no test**: persistence does not exist, and the backlog places VT-17 in ML-TASK-033 (Phase 3). Four families pass only on a reduced scope: VT-14 (owner-accepted: "VT-14: e = 0 only"), VT-18 (the file-level classes of FR-011 AC3 are not covered), VT-04 (substitute angles have no approved tolerance and are not compared), VT-19 (WGS 84 attribution not verified; the owner accepted IERS TN36 as the source for G1). | §2, §4; runs 1–4; `vt-19-constants.md` |
| 2 | Tolerance record approved | **Met.** Revision 5 was approved on 2026-11-16, revision 4 on 2026-11-15 and revision 3 on 2026-11-13 (`tolerances.md` header and §15). Every asserted comparison in runs 1–4 uses values from an approved revision, committed before the engine was run on them (run reports §1). Open items remain: O-11 (not blocking) and literature citations marked "to be confirmed" in §14. | `tolerances.md` §15, §12 |
| 3 | Report listing the layers behind each family, with L3 gaps stated explicitly | **Met by this document once the owner accepts it.** | §2, §3 |
| 4 | (ML-TASK-018) All VT families pass in CI | **Met for every family that has a test.** VT-17 has none. The `checks` job runs `pnpm test` on every PR and on every push to `main`. That includes the whole `conformance` project, with the hyperbolic suites (switch removed in PR #39) and VT-19. `checks` is a required status check on `main`. Latest green run on `main` 77cdbaa: 68 files, 1574 tests passed, 0 skipped. | §5 |

**Bottom line.** Every comparison that exists passes, with large margins: the worst asserted
ratio is 0.81, and that is the VT-04 convention term, which is expected to come close to 1.
Outside VT-04 the worst is 0.094 (the O-1 solver check). Nothing failed in any run, and no engine
or reference defect was found. G1 is **not met to the letter**, for three reasons:
(a) VT-17 has not been run, and part of VT-18 cannot be run before ML-TASK-033;
(b) all the datasets and run reports 1–3 are committed but not approved, and the run-4 acceptance
is recorded only in `status.json`;
(c) L3 has gaps (§3).
§8 recommends passing G1 on explicit owner conditions.

### 1.2 Suite run for this report

Run on branch `docs/ml-task-018-g1-report`, which equals `origin/main` 77cdbaa (merge of PR #40);
Node.js v24.22.2, Windows 11, pnpm 12.16.1. Each command exited 0.

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (lockfile up to date) |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — **68 test files, 1574 tests passed, 0 skipped** (31.9 s, default worker count) |
| `pnpm format:check` | exit 0 |
| `pnpm check:boundaries` | exit 0 — 20/20 fixtures |
| `npx vitest run --project conformance --silent=false` | exit 0 — 26 files, 617 tests; ratio summaries printed (used to cross-check §2) |

Run 4 reported timeouts at the default worker count (`conformance-run-4.md` §3). They did not
recur here: PR #39 set a 60 s timeout for the `verification` and `conformance` projects.

## 2. Per-family evidence

Layers (plan §2): **L1** invariants and closed forms; **L2a** classical elements with
Newton–Kepler; **L2b** fixed-step RK4 with step halving; **L2c** direct rotation-matrix
construction; **L3-O** Orekit 13.1.9 datasets (ML-TASK-012 part B); **L3-T** cited textbook
examples. "Exact" means `Object.is` or structural equality, with no tolerance (`tolerances.md`
§1). "Ratio" means observed / tolerance; it passes when ≤ 1. A case is one dataset file, or one
generated case where stated.

Run reports: R1 = [`conformance-run-1.md`](conformance-run-1.md), R2 =
[`conformance-run-2.md`](conformance-run-2.md), R3 = [`conformance-run-3.md`](conformance-run-3.md),
R4 = [`conformance-run-4.md`](conformance-run-4.md), V19 = [`vt-19-constants.md`](vt-19-constants.md).
Test files are under `conformance/src/`. The record is [`tolerances.md`](tolerances.md).

### 2.1 Table

| Family | Layers that back it (run; test file) | Asserted / informative | Worst asserted ratio (source) | Cases | Record row | Plan layer | Met? |
|---|---|---|---|---|---|---|---|
| **VT-01** vector/matrix | L1 (R2; `vt01-vector.test.ts`) | asserted | 0.071, unit norm (R2 §3) | 1 dataset; 1000 random comparisons + exact special inputs | §7 VT-01 | L1 | yes |
| **VT-02** elements → state | L2c (R1; `vt02-elements-to-state.test.ts`); L3-O (R3; `l3-vt02-elements-to-state.test.ts`) | asserted | L2c 0.0044 r / 0.0041 v (R1 §2); L3-O 0.0055 r / **0.0090** v (R3 §3) | 9 + 9 | §7 VT-02; §9.3.1 | L2c, L3 | yes (L3-T missing, §3) |
| **VT-03** round trip | L1, round trip to the exact input; L2c for the element-view rows (R1; `vt03-round-trip.test.ts`) | asserted | round trip 0.011 (R1 §2); element rows e **0.0146**, ω 0.0039, ν 0.0085, i and Ω 0.000 (R1 §2) | 9 | §7 VT-03; §8 VI-03(b) rows | L1 | yes |
| **VT-04** degenerate | L1 round trip; L2c classification, e, i (R1; `vt04-degenerate.test.ts`) | asserted; substitute angles ϖ, λ, u **not compared** (no approved tolerance, L2 report F-3); retrograde flag not compared (the engine has none) | exact-degenerate 0.0101; near-degenerate **0.811** (convention term, expected near 1); regular 0.0017; e 0.0134; classification exact 10/10 (R1 §2) | 10 | §7 VT-04(a), (b) | L1, L2 | **partly**: L2 covers classification, e and i, but not the convention's angles |
| **VT-05** propagation | L2a, L2b (R1, propagator level; `vt05-propagation.test.ts`); L3-O through `runSimulation` (R3; `l3-vt05-propagation.test.ts`); O-1 solver residual check, black box, 320-bit (R1; `o1-solver-residual.test.ts`) | asserted; sample 0 exact | L2a 0.0096; L2b **0.0148** (R1 §2); L3-O 0.0046 (R3 §3); O-1 0.094 (R1 §3) | 9 L2 + 9 L3; 1440 samples each; O-1 1728 cases | §6.1–§6.6, §7 VT-05; §9.3; O-1 §12 | L2a, L2b, L3 | yes (L3-T missing, §3) |
| **VT-06** energy | L1 (R2; `vt06-07-invariants.test.ts`) | asserted | 0.0022 (R2 §3) | 9; 1449 samples | §7 VT-06 | L1 | yes |
| **VT-07** angular momentum | L1 (R2; same file) | asserted | 0.0017 (R2 §3) | 9; 1449 samples | §7 VT-07 | L1 | yes |
| **VT-08** closure | L1 (R1; `vt08-closure.test.ts`) | asserted | 0.0056 at N = 1, 0.0053 at N = 10 (R1 §2) | 18 | §7 VT-08 | L1 | yes |
| **VT-09** sampling independence | L1, self-consistency (R2; `vt09-sampling-independence.test.ts`) | asserted, exact | exact (R2 §3) | 5; 57 common samples × 3 runs | §1; §12 O-4 (resolved in rev. 4) | L1 | yes |
| **VT-10** determinism | contract check, exact (R2; `vi01-structure.test.ts`, block "VT-10 determinism") | asserted, exact | exact (R2 §3) | 44 runs | §1 | — | yes |
| **VT-11** RSW basis | L1 (R2; `vt11-13-maneuver.test.ts`) | asserted. **R ∥ r and W ∥ r × v carry no independent evidence**: the engine and the test use the same expression (ratio 0.000, R2 §3 note 1) | orthonormality 0.027, handedness 0.015 (R2 §3) | 12 datasets; 84 runs | §7 VT-11 | L1 | yes (see note) |
| **VT-12** maneuver frame | L2c, 320-bit projection form (R2; `vt11-13-maneuver.test.ts`); L3-O (R3; `l3-vt12-maneuver-frame.test.ts`) | asserted | L2c 0.0060 (R2 §3); L3-O **0.0094** (R3 §3) | 84 runs + 8 L3 | §7 VT-12; §9.3.1 | L2c | yes (exceeds plan: L3 too) |
| **VT-13** impulsive change | L1 (R2; `vt11-13-maneuver.test.ts`) | asserted; R12 and R8 exact × 84. The magnitude check has no independent evidence (same expression, ratio 0.000) | ‖Δv_I‖ vs ‖Δv_RSW‖ 0.014 (R2 §3) | 84 runs | §1 R8/R12; §7 VT-13 | L1 | yes |
| **VT-14** zero maneuver | L1 (R2; `vt14-zero-maneuver.test.ts`) | asserted at e = 0; for e > 0 only the exact parts and segment 0, with the trajectory after m informative | 0.00059 (R2 §3) | 6 (4 toleranced at e = 0); 576 samples × 2 | §7 VT-14 (scope for G1) | L1 | **VT-14: e = 0 only** (owner-accepted, P-1) |
| **VT-15** post-maneuver | L1 closed form in 320-bit: tangential a⁺/e⁺ on version 1 (R2; `vt15-post-maneuver.test.ts`); every revision-4 row on the 14 new versions (R3; `vt15-r4-post-maneuver.test.ts`); L3-O (R3; `l3-vt15-post-maneuver.test.ts`) | asserted. The version-1 non-tangential rows are informative (R2 §5 item 2; superseded by `vt15-r4`) | v1 a⁺ 0.0016, e⁺ 0.00053 (R2 §3); r4 a⁺ **0.034**, e⁺ 0.0069, δψ_n 0.019, δψ 0.0029; L3-O 0.010 / 0.0033 / 0.0042 / 0.00096 (R3 §3) | 14 v1 + 14 r4 + 14 L3 | §7 VT-15; §9.3.1; §9.3.2 | L1, L2 | **partly**: the L2 element comparison (VI-03 rows) was not run (R3 §4). L1 and L3-O are present |
| **VT-16** escape / surface | Warnings: L2 analytic classification (R2), L3-O expectations (R3), exact. Elliptic sub-surface states: L2a, L2b (R2; `vt16-escape-intersection.test.ts`), L3-O including the restarted c4 arc (R3; `l3-vt16-escape-intersection.test.ts`). Hyperbolic states: L2b and L3-O restarted (R4; `vt16-r5-hyperbolic.test.ts`). Hyperbolic solver residual: extended O-1 check (R4; same file) | asserted (hyperbolic since R4, under §4.1 item 6). The run-3 informative copies remain in `vt16-r4-hyperbolic.test.ts` and in the informative recorder of `l3-vt16-escape-intersection.test.ts` | warnings exact 18 + 3; elliptic L2a 0.0050, L2b **0.030** (R2 §3); L3 seg 0 / elliptic seg 1 0.00079 (R3 §3); hyperbolic L2b 0.0033, L3 0.0016 (R4 §3); O-1 hyperbolic **0.083** (R4 §3) | 18 L2 + 4 r4 + 3 L3; O-1 150 cases / 546 samples | §6.8; §7 VT-16; §9.3.1; §9.3.2 | L2b | yes (exceeds plan) |
| **VT-17** serialisation round trip | **none** | — | — | 0 | §1 (exact) | — | **NOT RUN**: persistence does not exist (ML-TASK-033, Phase 3) |
| **VT-18** invalid input | contract conformance, exact (R2; `vt18-invalid-input.test.ts`) | asserted, exact | exact (R2 §3) | 1 dataset; 48 classes (44 rejected + 4 accepted controls) | §1 | — | **partly**: FR-002 AC2 and FR-005 AC2 are covered. FR-011 AC3 (file loading: invalid JSON text, file-size limit, current scenario unchanged) is not; it needs ML-TASK-033. Schema-version classes are covered at validator level |
| **VT-19** constants | Comparison against a primary document: IERS Conventions 2010 (TN36), Tables 1.1 and 1.2 and Eq. (5.14) (V19; `vt19-constants.test.ts`) | asserted: GM and R_ref equal TN36 bit for bit. ERA coefficients: string equality in the document only (no engine export) | exact (V19 §5) | 4 tests | §1 (exact) | L3 (primary sources) | **met on the owner-accepted source** (TN36, owner 2026-11-16). WGS 84 attribution not verified (§3) |
| VI-01 (numeric part) | contract conformance, exact (R2; `vi01-structure.test.ts`); −0 rule P3 exact (same file) | asserted, exact | exact (R2 §3) | 12 + 9 | §8 VI-01 | — (gate G2 in plan §8) | run early; counts toward G2 |
| VI-02 | none: no renderer yet | — | — | 0 | §8 VI-02 | — (G2) | not applicable at G1 |
| VI-03(b) element rows | L2c, inside VT-03 (R1 §2) | asserted | e 0.0146 (R1 §2) | 9 | §8 VI-03(b) | — (G3) | analysis module does not exist (ML-TASK-031); only the element-view rows were exercised |

### 2.2 Families whose backing is weaker than the plan asks

1. **VT-17**: not run at all.
2. **VT-18**: the FR-011 AC3 part is not run.
3. **VT-04**: the plan asks for L1 and L2. L2 covers classification, e and i. The substitute
   angles (ϖ, λ, u) have no approved tolerance and are not compared (L2 report F-3, still
   open; not in `tolerances.md` §12).
4. **VT-15**: the plan asks for L1 and L2. The L2 element comparison (VI-03 rows) was not run
   (R3 §4). L1 (320-bit closed form) and L3-O back it instead. They are stronger
   organisationally, but they are not the plan's L2.
5. **VT-14**: L1 at e = 0 only. **VT-14: e = 0 only** (owner direction P-1, 2026-11-15; O-11
   open, not blocking).
6. **VT-19**: the plan asks for primary sources. The engine values match TN36, which the owner
   accepted for G1. The WGS 84 standard (NGA.STND.0036) was not reached. Note on naming: V19 and
   the ML-TASK-011 `report_vt19` label this evidence "L1 only", while plan §3 lists VT-19 as L3
   (§10 item 3).
7. **VT-11 / VT-13**: the checks R ∥ r, W ∥ r × v and |Δv| carry no independent numerical
   evidence (same expression in engine and test). The independent evidence for the basis is
   VT-12 (L2c, L3-O) and the orthonormality and handedness checks.
8. **VT-05, VT-08, VT-03 element rows**: the O-1 evaluator and every 320-bit reference are
   in-repo code (own BigFloat, substituted for `mpmath`, L2 report F-4). They were validated
   against an independent 200-bit hyperbolic propagation and against 60-digit decimal scripts
   kept in a scratchpad (R4 §6 item 4). No second tool was used.

### 2.3 Cross-check of the quoted ratios

Every ratio in §2.1 was reproduced exactly (to the printed digits) by the
`--silent=false` conformance run of §1.2 on 77cdbaa. The run reports do not disagree. Two values
look different at first and are explained:

- L3 VT-16 hyperbolic position, c1: 0.0011 in R3 (informative, against Orekit's own segment 1)
  and 0.0010 in R4 (asserted, against the arc restarted from the engine event state, §9.3.2
  item 6). Different reference arcs; both values are reproduced today (0.001128 and 0.001042).
- Conformance project size: R4 reports 25 files and 614 tests. Today there are 26 files and 617
  tests: `vt19-constants.test.ts` adds 4 tests (PR #40), and PR #39 reduced
  `rev5-gate.test.ts` to 3 tests.
