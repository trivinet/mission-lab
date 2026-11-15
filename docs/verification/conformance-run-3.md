# Conformance Run 3 — revision-4 rows and the L3 Orekit comparison

**Document ID:** ML-VER-006 · **Date:** 2026-11-15 · **Author:** Verification Engineer (ML-TASK-018 part D2) · **Status:** In review (not approved)

Third engine run. It covers what [tolerance record revision 4](tolerances.md) (approved by the owner
on 2026-11-15) newly makes toleranced, and the first comparison of the engine with the L3 Orekit
datasets of ML-TASK-012. Result: **every asserted comparison passed; nothing failed.** The
hyperbolic arc states (L2b and L3) were measured and reported only, as the record requires while
O-12 and O-13 are open (§5). No engine defect and no reference defect was found.

## 1. Order of work (evidence for tolerances.md §4.1 and ADR-003)

| Commit | Content | Engine read or run? |
|---|---|---|
| 29699cf | Revision-4 formulas transcribed (`verification/src/tol/tolerances-r4.ts`) and checked against every printed revision-4 value; 200-bit hyperbolic reference (`ref/hyperbolic.ts`) with self-tests; D2 dataset builder (`datasets/build-d2.ts`) and reference-side checks | No |
| 976380b | Datasets with their evaluated tolerances: `vt-15-r4/` (14), `vt-16-r4/` (4), `l3-r4-vt-02/-05/-12/-15/-16/` (43); `producedBy.codeRevision` 29699cfa1b3b | No |
| **a55eb1f** | **Phase 1 end:** conformance tests for all new comparisons and the Orekit restart script `verification/l3-d2/restart.py` | Public API signatures only; not run |
| b2881c2 | Phase 2: engine event states of the two L3 cases with m > 0 and the Orekit arcs restarted from them (`conformance/l3-restart/`) | Run |

Before a55eb1f, nothing under `packages/astrodynamics/src` or `packages/simulation/src` was opened
except the `export` lines of the two `index.ts` files, and only the verification project was run
(no conformance test). After a55eb1f no reference, dataset, tolerance or test was changed. The
run-2 datasets (`vt-15/`, `vt-16/`) are unchanged and their tests still run with their approved
values (§4.1 item 5 (ii)).

`verification/l3/selfcheck.py --repro` was rerun before the L3 data were used (Orekit venv
`C:\dev\mission-lab-tools\orekit-venv`, Python 3.13.17, Orekit 13.1.9, JDK Temurin 21.0.13):
**exit 0, 489 pass/fail checks, 0 failures, 72 informational measurements; generator unchanged
since df84b5e6d75a; same 43 files; byte-identical regeneration.**

## 2. What was run

| Item | Value |
|---|---|
| Engine | `packages/` as on `main` 60c580e (unchanged on the branch; event states recorded at a55eb1f), public API of `@mission-lab/astrodynamics` and `@mission-lab/simulation` |
| Entry points | `runSimulation(request)` for every family except L3 VT-02 (`elementsToState`). Orekit requests get their `requestId` from the contract payload (SHA-256 of `canonicalRequestPayload`, contracts-v1 §7.1) |
| Tolerances | Revision 4 of the record, evaluated at each dataset's scale with reference-side inputs and committed before the run (§4.1 items 1, 2, 5). The tolerances stored inside the Orekit files are **not** used (record C-8) |
| L3 restart (§9.3.2) | `verification/l3-d2/restart.py` with `verification/l3/generate.py` `propagate` unchanged: `KeplerianPropagator` on a `CartesianOrbit` from the engine event state, μ explicit, GCRF |
| Runtime | Node.js v24.22.2, Windows 11, Vitest 5.0.5 |
| Command | `pnpm test`; ratio summaries from `npx vitest run --project conformance --silent=false` |

## 3. Results per family

"Ratio" = observed / tolerance (≤ 1 passes), maximum over the family.

| Family | Cases | Comparisons | Asserted? | Worst ratio | Where | Result |
|---|---|---|---|---|---|---|
| VT-15 rev. 4, L2 new versions: a⁺ | 14 | 14 | asserted | 0.034 | c1-circular-prograde | pass |
| — e⁺ | 14 | 14 | asserted | 0.0069 | c1-normal | pass |
| — plane normal δψ_n | 14 | 14 | asserted | 0.019 | c5-perigee-prograde | pass |
| — plane rotation δψ | 14 | 14 | asserted | 0.0029 | c4-apogee-prograde | pass |
| VT-16 hyperbolic arcs vs L2b (rev. 4 §6.8) | 4 | 367 samples × 2 | **informative** (O-12) | 0.0032 r / 0.0033 v | c3-midrun-escape | none over the value |
| L3 VT-02 elements → state | 9 | 9 × 2 | asserted | 0.0055 r / 0.0090 v | c3 / c4 | pass |
| L3 VT-05 propagation (runner) | 9 | 1440 × 2 | asserted | 0.0046 r / 0.0032 v | c8-b, t = 47 684 s | pass |
| L3 VT-12 inertial Δv | 8 | 8 | asserted | 0.0094 | c7 combined | pass |
| L3 VT-15 a⁺ / e⁺ / δψ_n / δψ | 14 | 14 × 4 | asserted | 0.010 / 0.0033 / 0.0042 / 0.00096 | c1 circular / c4 perigee / c4 apogee | pass |
| L3 VT-16 warnings | 3 | 3 sets | asserted (exact) | exact | — | pass |
| L3 VT-16 segment 0 (3 cases) and elliptic segment 1 vs restarted Orekit (c4-midrun-retro-subsurface) | 3 + 1 | 42 × 2 | asserted | 0.00079 r / 0.00026 v | c3 seg 0 t = 4000 s / c4 seg 0 | pass |
| L3 VT-16 hyperbolic segment 1 (c1-escape-prograde, c3-midrun-escape restarted) | 2 | 35 × 2 | **informative** (O-13, O-12) | 0.0011 r / 0.0016 v | c1 t = 17 000 s / c3 t = 6000 s | none over the value |

Preconditions checked and met: at m = 0 the event pre-maneuver state equals `initialState`
bit-for-bit in all 30 maneuver cases at m = 0 that rely on it (11 VT-15 new versions, 8 L3 VT-12,
11 L3 VT-15; §1 precondition row); every engine
sample time equals the Orekit or reference time bit-for-bit; sample 0 of every L3 VT-05 run equals
`initialState`; both restarted Orekit arcs were produced from the engine's current event state
(checked bit-for-bit before use).

Whole repository: 63 test files, 1248 tests, all passed; conformance project 452 tests (74 new).

## 4. Evidence layers behind each family after this run

| Family | Layers run (all runs) | Missing |
|---|---|---|
| VT-02 | L2c (run 1), **L3 Orekit** | — |
| VT-05 | L2a, L2b (run 1, propagator level), **L3 Orekit through `runSimulation`** | — |
| VT-12 | L2c (run 2), **L3 Orekit** | — |
| VT-15 | L1 closed form, tangential a⁺/e⁺ on version 1 (run 2); **L1 closed form, every row of revision 4 on the 14 new versions** (non-tangential burns and plane rows now toleranced); **L3 Orekit** | L2 element comparison (VI-03 rows) |
| VT-16 warnings | L2 analytic classification (run 2), **L3 Orekit expectations (3 cases)** | — |
| VT-16 elliptic sub-surface states | L2a, L2b (run 2), **L3 Orekit restarted from the engine event state (c4)** | — |
| VT-16 hyperbolic states | L2b and L3 **measured only** (informative) | asserted evidence until O-12 and O-13 are closed |
| VT-14 | L1, **e = 0 only** (run 2; owner direction P-1) | e > 0 (O-11, not blocking G1) |
| VT-09 | L1 exact (run 2); O-4 now resolved (revision 4, P-4), so the exactness rests on an approved reading | — |

The G1 report must state for VT-14 exactly: **"VT-14: e = 0 only"** (§7 VT-14).

## 5. Asserted versus informative, and why

- **VT-16 hyperbolic states vs L2b** (`vt-16-r4`, 4 arcs): informative. The validity gate 0.05 was
  approved, so the four arcs carry evaluated values (§7 VT-16). But §6.8 (Scope) says ε_t,gen
  assumes the engine's solve ends at the noise level on hyperbolic arcs, which is not verified (open
  item O-12), and §12 O-12 puts the extension of the O-1 check to these arcs "before the hyperbolic
  state comparison". I read that as making the comparison conditional on O-12 (instruction of this
  task); see §7 item 1.
- **L3 VT-16 hyperbolic rows** (2 arcs): informative. §9.3.1 and §15 make them usable only after
  O-13 (a pass/fail hyperbolic check in `verification/l3/selfcheck.py`, which belongs to
  ML-TASK-012 and is outside this task's paths). O-12 applies too.
- Everything else in §3 is asserted with the record's revision-4 values.

## 6. Limits of the evidence

1. The restarted Orekit arcs (`conformance/l3-restart/`) depend on the engine's event state. If an
   engine change alters an event state by one bit, the L3 VT-16 segment-1 test fails as "stale"
   until `restart.py` is rerun, which needs the Orekit environment (not available in CI). This must
   be handled before CI wiring.
2. VT-12 and VT-15 L3 files also contain post-maneuver trajectories. The record's L3 rows for these
   families are Δv and elements only; the trajectories were not compared (§7 item 4).
3. `c1-escape-prograde` (m = 0, hyperbolic) is compared with Orekit's own segment 1, not a restart
   (§9.3.2 covers m > 0 only). Its first sample is Orekit's event state, which differs from the
   engine's by the Δv_I difference (|Δv⁺| = 1.8 × 10⁻¹² m/s, the VT-12 L3 level). The informative
   check flagged it as "exact sample differs", because the tolerance file marks the first sample as
   exact. This is a harness limitation of an informative row, not an engine finding.
4. L3 rests on one external tool (Orekit 13.1.9). A6′ covers the Orekit element map, QSW frame and
   getters; it is backed by the pass/fail checks of ML-TASK-012 and by this run's small ratios, not
   by a published accuracy statement.
5. The new datasets and this report are committed but not approved. The evidence counts toward G1
   only after approval, unchanged.
6. Algorithmic independence of L3 propagation from ADR-005 is organisational (Orekit's
   `KeplerianPropagator` algorithm was not studied; ML-TASK-012 report).

## 7. Places where the record was silent or ambiguous

1. **O-12 and the L2 hyperbolic comparison.** §7 VT-16 and §15 put the four arcs in the toleranced
   set; §6.8 Scope and §12 O-12 make the solver assumption unverified and place the O-1 extension
   before the comparison. Treated as informative. Decision needed (owner or reviewer): either
   resolve O-12 (derive the hyperbolic δt_α and extend the O-1 check; a record change), or state that
   the arcs are asserted without it.
2. **Rounding of printed values.** The transcription check reproduces every revision-4 value, but
   11 of them are printed rounded up in the last digit (for example L3 VT-15 c1 δψ_n: formula
   1.1948 × 10⁻¹⁴, printed 1.20 × 10⁻¹⁴; L3 C1 P_b,gen 2.4249 × 10⁻⁶, printed 2.43 × 10⁻⁶). The
   datasets carry the unrounded formula values, which are never above the printed ones. Not a
   loosening; the record could say that printed values are rounded up.
3. **§6.8 first sample of L2 `c3-midrun-escape`.** The record says "Δt = 60 s for L2"; on the §5.2
   grid the first post-maneuver sample of that arc is at t = 5040 s, Δt = 40 s. The printed value
   (1.603 × 10⁻⁶ m) was reproduced at Δt = 60 s; the dataset uses the actual sample times. No effect
   on any value.
4. **L3 VT-15, Orekit side.** "Each evaluated from its own post-maneuver state" does not say whether
   Orekit's a⁺, e⁺ are its getters or the test's evaluation of Orekit's state. Chosen: Orekit's
   getters for a⁺, e⁺ (A6′ names the getters), and the test's binary64 evaluation of Orekit's event
   state for ĥ⁺ and ψ (Orekit gives no plane normal). Both readings fit the per-side budget; the
   worst ratio is 0.010. Flagged so a reviewer can confirm.
5. **Trajectories in the VT-12 and VT-15 L3 files.** The record defines no L3 row for them at
   m = 0. Not compared (§6 item 2).
6. **Reference-side scales.** For L3 VT-02, VT-05 and segment 0 of VT-16 the scales are the grid
   (a, e) of `inputs.elements`; for post-maneuver rows, the conic of Orekit's event state
   (§9.3.2 item 3). These reproduce every printed §9.3.1 value.

## 8. Findings

- No conformance failure. No engine defect. No reference or dataset defect: the L2b hyperbolic
  references agree with the independent 200-bit hyperbolic propagation within 2E_RK (worst
  measured/E_RK 0.56), every E_RK is within the §9.2 target (no loosening), and every revision-4
  dataset value is at or below the corresponding approved run-2 value.
- The engine's revision-4 margins are large: the worst asserted ratio of the run is 0.034 (VT-15
  a⁺, c1 circular). The worst informative ratio is 0.0033 (hyperbolic, L2b).
- Open items unchanged by this run: O-11 (VT-14, e > 0; not blocking G1), O-12 (hyperbolic solver
  residual), O-13 (Orekit hyperbolic pass/fail check, ML-TASK-012).
