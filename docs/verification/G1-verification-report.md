# G1 Verification Report — engine

**Document ID:** ML-VER-008 (ML-VER-003 was already used by `l2-references-report.md`; §10 item 1) · **Date:** 2026-11-16 · **Author:** Verification Engineer
(ML-TASK-018, final part) · **Status:** Approved by the owner on 2026-11-16; G1 passed on the conditions recorded in [G1-review.md](../releases/G1-review.md)

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

## 3. L3 gaps, stated explicitly

ADR-003 asks for both kinds of layer 3: "published worked examples with citation, and at least
one dataset from an established external tool". G0 decision D-5 required at least one of them
before G1. That requirement is met by Orekit alone.

1. **Families with no L3 evidence at all:** VT-01, VT-03, VT-04, VT-06, VT-07, VT-08, VT-09,
   VT-10, VT-11, VT-13, VT-14, VT-17, VT-18. Most are L1 or contract families, for which the
   plan does not ask for L3 (ML-TASK-012 `l3_gaps_for_g1`). VT-04 also falls short of its plan
   layer on L2 grounds (§2.2).
2. **L3 families with partial coverage:** VT-02, VT-05, VT-12, VT-15 and VT-16 have L3-O and
   no L3-T. For VT-12 and VT-15, the post-maneuver trajectories in the Orekit files are not
   compared: the record has no L3 row for them (R3 §6 item 2, §7 item 5). For VT-16 with m > 0,
   and for c1, the L3 arc is Orekit **restarted from the engine's own event state** (§9.3.2). So
   for segment 1 the L3 check covers the propagation, not the pre-maneuver state. The Δv_I part
   is covered separately (L3 VT-12 row; c1 premise in R4 §3).
3. **VT-19:** Orekit gets μ and R_ref from the request. It uses the same constants as the engine
   by construction and gives no evidence on their values (ML-TASK-012 `l3_gaps_for_g1`). The
   VT-19 evidence is the TN36 comparison (V19). **The WGS 84 attribution is not verified**: that
   GM = 3.986004418e14 m³/s² is the WGS 84 "atmosphere included" value, and that 6378137 m is
   the WGS 84 semi-major axis. NGA.STND.0036 could not be reached from this network (V19 §3).
   The IAU 2000 Resolution B1.8 primary text was not reached either. The owner listed this as an
   open gap that does not block G1 (decision 2026-11-16).
4. **Textbook (L3-T):** none. The ML-TASK-012 part A assessment (Wakker 2015) found five usable
   worked examples (two for VT-05, three for VT-15) at 3–5 significant digits, and none for
   element → state, the maneuver frame or ERA. Their use **waits on owner decision OA-15**
   (whether book values may be stored in the public repository). The assessment document is not
   on `main`. Even after OA-15, L3-T resolves only 10⁻² to 10⁻⁴ relative (`tolerances.md` §9.4,
   §11 item 4). It would catch convention errors, not numerical ones.
5. **Only one external tool.** L3 rests on Orekit 13.1.9 alone; there is no GMAT cross-check.
   Orekit's propagation algorithm was not studied, so its algorithmic independence from ADR-005
   is organisational only (ML-TASK-012 report; R3 §6 item 6). Orekit's accuracy is not
   documented to the record. It is backed by assumption A6 (confirmed for elliptic propagation)
   and by A6′, made pass/fail for hyperbolic arcs in revision 5. Both bounds are loose: the
   measurements use ≤ 0.4 % of them (R4 §6 item 3). Reproducibility of the Orekit run on another
   machine, OS or JDK was not tested.

## 4. Scope limits accepted by the owner, and parts not run

Accepted by the owner:

- **"VT-14: e = 0 only"** (P-1, 2026-11-15; `tolerances.md` §7 VT-14, §15). O-11 stays open
  and does not block G1.
- **VT-19:** IERS Conventions 2010 (TN36) accepted as the primary source for G1. The WGS 84
  attribution is an open gap that does not block G1 (owner, 2026-11-16, as communicated for this
  task). The decision is **not yet recorded on `main`**: `docs/status/status.json` on `main`
  still says "For G1 still: the WGS 84 constants check (VT-19)". The log entry with the
  acceptance is on the unmerged branch `chore/status-vt19`.
- **VT-16 near-parabolic arcs:** below the validity gate |E| ≥ 0.05(v²/2 + μ/r) (P-3, 0.1 → 0.05
  approved 2026-11-15) no state bound is derived and none is claimed. Δt < 0 on hyperbolic arcs
  is outside §6.8; the runner never propagates backwards.
- **VT-09 exact** rests on the approved reading of O-4 (P-4, 2026-11-15).

Not run, and **not covered by any owner decision I could find:**

- **VT-17**: not run at all. Plan §8 puts it in G1, but the backlog assigns it to ML-TASK-033
  (Phase 3, gate G3).
- **VT-18, FR-011 AC3 file level**: not run, for the same reason.
- **VT-04 substitute angles** (F-3) and the retrograde flag.
- **VT-15 L2 element comparison** (VI-03 rows).
- **The engine's FR-002 AC4 derived quantities** (`tolerances.md` §7, revision 2): I found no
  conformance test. Engine unit tests may exist, but they are not independent evidence.

Checked in each run report: R1 §6, R2 §5–§6, R3 §5–§6, R4 §6. No other family or part was
skipped.

## 5. CI status

- **Workflow:** `.github/workflows/ci.yml`, job `checks`, triggered on `pull_request` (every PR)
  and on `push` to `main`. Steps: `pnpm install --frozen-lockfile`, `format:check`, `lint`,
  `check:boundaries`, `typecheck`, `test`, `build`. `pnpm test` is `vitest run` over all six
  projects of `vitest.config.ts`, `conformance` included. So every numerical family that has a
  test runs on every PR: VT-01…VT-16, VT-18, VT-19, O-1 (elliptic and hyperbolic), the L3-O
  comparisons, and the hyperbolic suites in `vt16-r5-hyperbolic.test.ts` (the
  `ML_CONFORMANCE_REV5` switch was removed in PR #39). The `e2e` job runs Playwright for
  `apps/web`.
- **Branch protection** (`gh api repos/trivinet/mission-lab/branches/main/protection`, read
  2026-11-16): required status checks `checks` and `e2e`, enforced for admins, `strict: false`.
- **Recent green run:** run 43847512903 on `main` 77cdbaa (push, merge of PR #40),
  2026-11-16T10:17Z, success. Its `checks` log reports 68 test files and 1574 of 1574 tests
  passed in 7.98 s on Node v24.22.2. `vt16-r5-hyperbolic.test.ts` (158 tests) and
  `vt19-constants.test.ts` (4 tests) appear in the list as passed. The PR #40 run (43847117044)
  was also green.

**Known CI risks:**

1. **Restarted Orekit arcs cannot be regenerated in CI.** `conformance/l3-restart/` and
   `conformance/l3-restart-r5/` are tied bit for bit to the engine's event states. An engine
   change that moves an event state by one bit makes the L3 segment-1 tests fail as "stale"
   until `restart.py` and `selfcheck.py --restart` are rerun in the Orekit environment. CI has no
   Orekit (R3 §6 item 1, R4 §6 item 1). Such a failure is correct behaviour, not a flake, but it
   blocks every PR until someone with the Orekit venv regenerates the arcs and the owner accepts
   them. No procedure exists beyond `conformance/l3-restart-r5/README.md`.
2. **60 s timeout.** PR #39 raised the per-test timeout of the `verification` and `conformance`
   projects to 60 s, because 320-bit tests hit Vitest's 5 s default on a loaded machine (R4 §3).
   Only the time limit changed, no assertion. The suite takes about 8 s in CI and about 32 s
   locally. The risks: a real slowdown can hide inside 60 s, and a heavy test in another project
   still gets the 5 s default.
3. **The record lock reads the document header.** `conformance/src/support/rev5-gate.ts` throws
   at collection unless the first five lines of `tolerances.md` record the approval of revision 5
   (or of a later revision that says "Revision 5 was approved by the owner on …"). A revision 6
   drafted as "Proposed" without that sentence fails CI for the whole hyperbolic file. The lock
   is intended, but whoever drafts revision 6 must know about it.
4. **CI does not block skipped tests.** Plan §7 says a PR cannot merge with a skipped numerical
   test, but Vitest exits 0 with skipped tests and CI does not count them. There are none today
   (0 skipped). Enforcing the rule needs a reporter check (proposed, not done).
5. **`strict: false`.** A PR can merge without being re-tested against the latest `main`. A bad
   combination is then caught only by the push run on `main`, after the merge.

## 6. Open items and approval states

### 6.1 Open items (`tolerances.md` §12 and related)

| Item | Status now | Blocks G1? |
|---|---|---|
| O-1 solver criterion | Route (1) evidence passed: elliptic, 1728 cases, worst 0.094 (R1 §3); hyperbolic, 150 cases / 546 samples, worst 0.083 (R4 §3). §12 does not mark O-1 closed | No; owner to acknowledge closure |
| O-2 atan2 conditioning | VT-03/VT-04 pass at ≤ 0.015 outside the convention term; an acos-based extraction would fail by design (§11 item 1). Not marked closed in §12 | No |
| O-3, O-6, O-10 | Decided by the owner (2026-11-12/13; ADR-008) | No |
| O-4 | Resolved in revision 4 (P-4) | No |
| O-5 | Closed in revision 4 | No |
| O-7 VT-02 algorithmic independence | Covered by L3-O VT-02 (R3) | No |
| O-8 scene conversion | Principle decided; VI-02 belongs to G2 | No |
| O-9 A2, A3, A6 | A6 confirmed for elliptic propagation; A6′ pass/fail, including hyperbolic arcs (R4 §2). A2 and A3 measured on a sample only (L2 report §7: c_f = 2 held, max 1.82u for sinh), with no proof; ECMA-262 gives no bound | No, but every tolerance assumes it |
| **O-11** VT-14 K(e), e > 0 | **Open, not blocking** (P-1) | No |
| **O-12** hyperbolic solver residual | **Proven in run 4** (R4 §4). §12 still says "subject to the owner's signature", although revision 5 was signed 2026-11-16 | No |
| **O-13** A6′ hyperbolic | **Proven in run 4** (R4 §2, §4). Same stale wording | No |
| L2 report F-1, F-3, F-4, F-5, F-7 | Not reflected in the record. F-1: C5 O-1 threshold printed 1.21e-8 s, formula gives 1.20e-8 s (§6.1 table). F-3: no tolerance for the substitute angles. F-4: BigFloat used, but §9.1 still names `mpmath`. F-5: A3 wording. F-7: RK4 vs "high-order" | No; F-3 limits VT-04 |
| Record §14 citations | Higham, Curtis, Vallado, Hairer, IEEE 754, ECMA-262 still "to be confirmed". The VT-14 Clohessy–Wiltshire coefficients rest on one of them | No; documentation debt |
| ADR-007 / coding standards §6 | Still do not list `conformance/` (R1 §7 item 1) | No |

### 6.2 Review and approval states of the evidence

Everything below is merged on `main`. **Merged is not approved.** Each run report and dataset
below says in its own status line or field that it is "In review (not approved)" or "Not yet
reviewed or approved". The ML-TASK-018 report repeats that this evidence counts toward G1 only
after approval, unchanged (`report.known_limitations`, `report_part_c`, `report_part_d2`,
`report_part_d3_phase2`).

| Evidence | State in the file | Owner decision recorded? |
|---|---|---|
| `tolerances.md` revisions 3, 4, 5 | Approved (§15) | Yes, 2026-11-13 / 15 / 16 |
| `l2-references-report.md` (ML-TASK-011) | In review (not approved) | No explicit approval found; merged with PR #17 on the owner's instruction |
| `conformance-run-1.md`, `-2.md`, `-3.md` | In review (not approved) | Merged (PRs #19, #27, #33) on the owner's go-ahead; no acceptance recorded |
| `conformance-run-4.md` | In review (not approved) | **Accepted** by the owner per the `status.json` log ("Accepted conformance run 4"); the document's status line was not updated |
| `vt-19-constants.md` | No status line | TN36 accepted for G1 (owner, 2026-11-16); recorded only on branch `chore/status-vt19` |
| 190 dataset files in `test-data/reference-cases/` (55 run 1, 67 part C, 61 part D2, 7 `o1-hyp-r5`) | "Not yet reviewed or approved" | No |
| 43 Orekit files in `test-data/l3-orekit/` | Stored tolerances not approved and not used (record C-8) | Location decided 2026-11-15; contents not approved |
| Restarted arcs `conformance/l3-restart/` (2 arcs + event states) and `l3-restart-r5/` (1 arc + event state) | Committed artefacts of runs 3 and 4 | Only through the run-4 acceptance (r5) |
| `verification/l3/selfcheck.py` A6′ change (ML-TASK-012 paths) | Merged in PR #35 | Approved with revision 5 (O-13 row of §15) |
| Task contracts ML-TASK-010, 011, 013–017, 019 | `status: in_review` in the YAML; `status.json` says done (record C-7, now wider) | Coordinator bookkeeping |
| ML-TASK-012 | in_review; part A waits on OA-15 | Partly |

### 6.3 What the owner must approve at G1 for this evidence to count

1. The **datasets**: the 190 files under `test-data/reference-cases/`, unchanged, and the use of
   the 43 Orekit files under `test-data/l3-orekit/` as L3 references.
2. The **L2 references report**, with a decision on each of its open findings F-1, F-3, F-4, F-5
   and F-7.
3. **Conformance runs 1, 2 and 3**, and a recorded acceptance of run 4 in the document itself.
4. The **VT-19 report**, with the owner's TN36 decision recorded on `main`.
5. **VT-17 and the FR-011 AC3 part of VT-18**: either defer them formally to ML-TASK-033 / G3
   (amend plan §8 by owner decision) or hold G1 until they exist. They cannot run today because
   there is no persistence code.
6. The **reduced scopes not yet decided**: VT-04 without the substitute angles (F-3), and VT-15
   without the L2 element comparison.
7. The **L3 gaps of §3**: one tool (Orekit), no textbook (OA-15), no L3 for the L1 families, the
   WGS 84 attribution.
8. **O-1 and O-2**: acknowledge them as closed on the evidence above, or state that they stay
   open.
9. How the **restarted-arc staleness risk** in CI will be handled (§5 risk 1), before any engine
   change after G1.
10. **This report.**

## 7. Independence statement (ADR-003)

1. **Phase discipline.** Each run report has an "Order of work" table (R2 §1, R3 §1, R4 §1)
   showing that references, datasets, evaluated tolerances and comparison tests were committed
   before any engine run on them. The boundaries were: run 2, 0e904ea (datasets) and 5d9b54d
   (tests); run 3, a55eb1f; run 4, PR #35 phase 1 (o1-hyp-r5 at 8ac71f4), approved in b60a06a
   before phase 2. Before each boundary nothing under `packages/astrodynamics/src` or
   `packages/simulation/src` was opened, except the `export` lines and the public doc comments
   (R2 §1, R3 §1, R4 §1). Run 1: the datasets were merged (PR #17) before the tests were
   committed (1b4f514), and the tests before the first run (R1 §1). **I did not re-check these
   commit orders for this report; they come from the run reports.**
2. **No reference derived from engine output.** Every reference comes from Orekit or from code
   in `verification/` that does not import the engine. That separation is enforced by the lint
   boundary and the 20 boundary fixtures (`check:boundaries` 20/20, §1.2). The references use
   algorithms different from ADR-005: L2a classical elements with Newton–Kepler, L2b RK4, L2c
   matrix construction, and 320-bit and 200-bit references. Tolerances were derived from error
   models before engine results were seen (`tolerances.md` §0, §4.1). Revisions 4 and 5 state
   that no value was derived from, or adjusted to, engine output or earlier measured values, and
   that nothing was loosened (§15).
   **One documented exception in kind:** for VT-16 segment 1, the L3 arcs start from the
   engine's event state (§9.3.2, approved), so that the comparison isolates the propagation. The
   engine output is a reference *input* there, by design, not a reference value. The event state
   was committed before the Orekit restart (R4 §1 steps 1–2) and checked bit for bit before use.
3. **Coordinator perturbation probes (as documented in PR descriptions).**
   - PR #19 (run 1): one reference value in `vt-02/c1` multiplied by (1 + 1e-9), about 1.2 mm,
     made exactly that test fail. The agent's own probes are in R1 §4 (μ × (1 + 1e-13) → ratio
     3.38; Δt + 1e-8 s → 2.90; χ̂ × (1 + 1e-14) → 2.32).
   - PR #27 (run 2): a 1e-9 relative change to one reference Δv in
     `vt-12/c1-circular-inclined-t0.json` made exactly that test fail.
   - PR #33 (run 3): one Orekit VT-02 position (C4) moved by 3e-6 m, against a tolerance of
     8.29e-7 m, made exactly that L3 test fail.
   - PR #37 (run 4): no coordinator perturbation probe is described; the coordinator re-ran the
     conformance project. Run 4's reference validation includes a 1e-9 perturbation of the O-1
     hyperbolic root, which is detected on all 546 samples (ML-TASK-018
     `report_part_d3_phase1`).
   - PR #40 (VT-19): no probe described.
   Where a probe is described, the file was restored afterwards.
4. **Limits.** Both agents are language models; L3 exists to catch a misconception they share,
   but L3 rests on one tool and covers 5 of the 19 families (§3). VT-12's L2c reference takes the
   meaning of R, S, W from the same contract text as the engine (R2 §4). For VT-02, L2c and the
   engine may implement the same textbook map (O-7); L3-O covers that.

## 8. Recommendation (proposed; owner decision)

**Do not pass G1 as plan §8 is currently worded**: VT-17 has not been run. I recommend passing
G1 **on these conditions:**

1. The owner formally moves VT-17 and the FR-011 AC3 part of VT-18 to ML-TASK-033 / G3, by
   amending plan §8 or by recording a decision. This matches the backlog, and the code VT-17
   would test does not exist yet.
2. The owner approves the evidence of §6.3 items 1–4 **unchanged**, and the reduced scopes of
   §6.3 item 6. If any dataset or report needs a correction, a new version is committed and the
   affected comparisons are rerun before G1 (plan §6).
3. The owner accepts the L3 gaps of §3 and records VT-14 as "VT-14: e = 0 only".
4. Before the next engine change after G1, a written procedure exists for regenerating the
   restarted Orekit arcs (§5 risk 1).

On the numerical evidence itself I see no reason to hold G1. All 1574 tests pass locally and in
CI. Every asserted comparison of runs 1–4 passed; outside the VT-04 convention term the worst
ratio is 0.094. No engine or reference defect was found.

## 9. Not verified (summary)

- VT-17; VT-18 for FR-011 AC3 file loading.
- VT-04 substitute angles and retrograde flag; the VT-15 L2 element comparison; the post-maneuver
  trajectories in the VT-12 and VT-15 Orekit files.
- VT-14 for e > 0 (O-11).
- State accuracy for negative Δt (only the elliptic O-1 residual is checked); hyperbolic Δt < 0;
  near-parabolic arcs below the 0.05 gate.
- The WGS 84 attribution of GM and R_ref; the IAU 2000 B1.8 primary text; the engine's
  `EARTH_CONSTANTS_SOURCE` citation. ERA has no engine export (string check only).
- A2 and A3 beyond the measured sample; Orekit accuracy beyond A6/A6′; reproducibility of the
  Orekit run on another machine, OS or JDK.
- The FR-002 AC4 derived quantities (no conformance test found).
- VI-02 (G2), and VI-03 beyond the element rows (G3).
- The commit-order claims of §7 item 1, which come from the run reports and were not re-derived
  here.
- Independent confirmation of the in-repo 320-bit evaluator by a second tool.

## 10. Inconsistencies found (reported, not fixed)

1. **Document ID collision.** `l2-references-report.md` already has ID ML-VER-003. This report
   uses ML-VER-003 because the task instruction says so. The run reports use ML-VER-004…007.
   Proposed: renumber this report ML-VER-008 (Coordinator or owner).
2. **Plan vs backlog on VT-17.** Plan §8 requires VT-17 for G1. Backlog ML-TASK-033 (Phase 3)
   carries VT-17 and the persistence part of VT-18.
3. **VT-19 layer naming.** Plan §3 lists VT-19 as L3. `vt-19-constants.md` and ML-TASK-011
   `report_vt19` call the same evidence "L1 only". The evidence is a comparison against an
   external primary document, which is what plan §3 means. The two labels should agree.
4. **Stale status text.** `conformance-run-4.md` still reads "In review (not approved)" after the
   owner accepted it (`status.json` log). `tolerances.md` lines 5–10 say the revision-5 additions
   "are not approved until the owner signs", and §12 O-12/O-13 say "subject to the owner's
   signature". Both read as conditions, but both are stale after 2026-11-16. The plan's preamble ("No test
   described here has been written or executed yet") and plan §2 ("L3 status: not available
   yet") are stale too.
5. **`status.json` on `main` is behind.** It does not record PR #40, the VT-19 acceptance or this
   task's state. Those are on the unmerged branch `chore/status-vt19`.
6. **Task YAML status fields.** ML-TASK-010, 011, 013–017 and 019 read `status: in_review`, while
   `status.json` lists them as done (record C-7, but wider than recorded there).
7. **ML-TASK-018 affected paths** do not list `docs/verification/G1-verification-report.md`,
   although the G1 report is one of the task's deliverables. This report was written on the
   Coordinator's explicit instruction.
8. **Superseded informative tests remain.** `vt16-r4-hyperbolic.test.ts` and the informative
   recorder in `l3-vt16-escape-intersection.test.ts` still describe the hyperbolic rows as
   "INFORMATIVE ONLY, never asserted"; the asserted versions are in `vt16-r5-hyperbolic.test.ts`.
   Harmless, but it can mislead a reader. So can the ML-TASK-012 `l3_gaps_for_g1` item "VT-16
   hyperbolic arcs: no evaluated tolerance", which is superseded.
9. **L2 report findings F-1 and F-4** are still not reflected in the record: the C5 threshold is
   printed 1.21e-8 s where the formula gives 1.20e-8 s, and §9.1 names `mpmath` although the
   in-repo BigFloat was used.
