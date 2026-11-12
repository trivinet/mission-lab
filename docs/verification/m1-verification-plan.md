# M1 Verification Plan

**Document ID:** ML-VER-001 · **Date:** 2026-11-11 · **Author:** Coordinator (to be owned by the Verification Engineer) · **Status:** Approved at gate G0 (owner, 2026-11-11)

Implements ADR-003. No test described here has been written or executed yet.

## 1. Principles

1. A result is accepted on numerical evidence, never on appearance.
2. The reference for a scientific test is never produced by the code under test.
3. Tolerances are derived and recorded before the implementation's results are seen.
4. A failing test is fixed in the implementation or escalated — never by loosening the test.
5. Every reference dataset records inputs, model assumptions, producing tool and version, output
   quantities and tolerance (ML-SYS-001 §8.3).

## 2. Evidence layers

| Layer | Source | Independence | Catches |
|---|---|---|---|
| L1 Invariants | Closed-form two-body relations | Mathematical | Gross errors, drift, non-conservation |
| L2 Independent implementation | `verification/` code by the Verification Engineer, different algorithm, engine source not consulted | Procedural + algorithmic | Convention errors that preserve invariants |
| L3 External reference | Cited textbook worked examples; one dataset from Orekit or GMAT | Organisational | Misconceptions shared by both agents |

L2 methods: (a) classical elements with Newton solution of Kepler's equation; (b) fixed-step
high-order Runge–Kutta integration of the equations of motion with a step-halving convergence
check; (c) direct rotation-matrix construction for element→state and RSW→inertial.

L3 status: **not available yet.** It needs either textbook examples transcribed from a physical
or licensed copy with page citation, or an external tool run. Both need owner input (decision
D-5). Example values are never written from an agent's memory.

## 3. Test families

IDs are permanent. "Grid" = the orbit test grid of §5.

| ID | Family (ML-SYS-001 §8.2) | Requirement | Layers | Check |
|---|---|---|---|---|
| VT-01 | Vector/matrix utilities | — | L1 | Identities: orthogonality, norm, triple product |
| VT-02 | Elements → Cartesian | FR-003 AC1 | L2c, L3 | Position/velocity vs reference |
| VT-03 | Round trip state ↔ elements | FR-003 AC2 | L1 | Round-trip error over the grid |
| VT-04 | Degenerate elements | FR-002 AC3, FR-003 AC2 | L1, L2 | Convention applied (ADR-008); state round trip still holds |
| VT-05 | Circular and elliptical propagation | FR-004 AC1 | L2a, L2b, L3 | State vs reference at fractional and multi-period times |
| VT-06 | Energy conservation | FR-004 AC2 | L1 | Relative deviation of specific energy on all samples |
| VT-07 | Angular momentum conservation | FR-004 AC2 | L1 | Relative deviation of **h** (vector) on all samples |
| VT-08 | Full-period closure | FR-004 AC3 | L1 | State after n periods vs initial state |
| VT-09 | Sampling independence | FR-004 AC4 | L1 | Same state at common times for different output steps |
| VT-10 | Determinism | FR-004 AC5 | — | Bit-identical repeated runs |
| VT-11 | RSW basis | FR-006 AC1 | L1 | Orthonormality, handedness, R ∥ r, W ∥ r × v |
| VT-12 | Maneuver frame transformation | FR-006 AC2 | L2c | Inertial Δv vs reference |
| VT-13 | Impulsive velocity change | FR-006 AC3 | L1 | Position continuity; v⁺ = fl(v⁻ + Δv) per component, bit-exact, as defined by contract R12 (contracts-v1.md §5.5) |
| VT-14 | Zero-magnitude maneuver | FR-006 AC4 | L1 | Equivalence with coast run |
| VT-15 | Post-maneuver orbit | FR-006 AC5, FR-010 AC3 | L1, L2 | Elements after burn vs closed form (e.g. tangential burn at apsis via vis-viva) and reference |
| VT-16 | Escape / surface intersection | FR-006 AC6 | L2b | Correct propagation and warning present |
| VT-17 | Scenario serialisation round trip | FR-011 AC2 | — | File identity; result reproduction |
| VT-18 | Invalid input handling | FR-002 AC2, FR-005 AC2, FR-011 AC3 | — | Each invalid class rejected with its diagnostic |
| VT-19 | Constants | — | L3 | μ, reference radius and ERA coefficients vs primary sources |

Non-numerical verification:

| ID | Level | Scope |
|---|---|---|
| VI-01 | Integration | Request → result structure, segments and events, metadata completeness |
| VI-02 | Integration | Scene-state hook: rendered vertices equal scaled engine samples (FR-007 AC2; exact, `Math.fround(x * s)`) |
| VI-03 | Integration | Analysis outputs equal values recomputed from the result |
| VE-01 | End-to-end | The 13-step release acceptance scenario (ML-SYS-001 §14) |
| VE-02 | End-to-end | Result-state transitions: none → computing → current → stale |
| VV-01 | Visual regression | 2D layout only; the WebGL canvas is masked (review finding F-13) |

## 4. Tolerance policy (method fixed now, values fixed at G1)

For each numerical family the Verification Engineer records, in
`docs/verification/tolerances.md`:

- the quantity compared and whether the measure is absolute or relative;
- the error model: float64 unit round-off (2⁻⁵³), the conditioning of the operation (for example
  the growth of along-track error with elapsed time and the loss of significance near e → 0, 1 or
  i → 0, π), the solver's convergence criterion, and the accuracy of the reference itself;
- the resulting tolerance and a margin factor with its reason;
- the approval (owner, date).

Rules: a tolerance may only be changed with a written justification and owner approval; the
reference's own accuracy bounds the tightest meaningful tolerance (an RK reference is checked by
step halving first); when a comparison fails, the default assumption is that the implementation
is wrong.

Indicative expectation, **not a requirement**: analytical propagation in float64 should agree
with an independent analytical method to many orders of magnitude better than display
resolution; if it only agrees to "a few metres", that is treated as a defect signal, not a pass.

## 5. Orbit test grid (initial proposal; the Verification Engineer may extend it)

| Case | Purpose |
|---|---|
| Circular low orbit, inclined | Baseline; argument of periapsis undefined |
| Circular equatorial | Doubly degenerate elements |
| Elliptical equatorial | Node undefined |
| Moderately elliptical, inclined | General case |
| Highly elliptical (Molniya-like) | Conditioning near perigee |
| Geostationary radius | Larger scale, long period |
| Near-polar and retrograde (i > 90°) | Quadrant handling |
| Elements at angle boundaries (0, π, 2π) | Wrapping |
| Post-maneuver: tangential at perigee and at apogee; pure radial; pure cross-track; combined | FR-006 |
| Post-maneuver escape; post-maneuver sub-surface perigee | FR-006 AC6 |

Concrete element values are chosen by the Verification Engineer and recorded with each dataset.

## 6. Reference data format

`test-data/reference-cases/<family>/<case>.json`, each with: `id`, `description`, `inputs`
(SI, frame, epoch), `model` (dynamics, μ, frame), `producedBy` (tool or script, version, commit),
`method`, `outputs`, `tolerance` (reference to the tolerance record). Datasets are immutable
once approved; corrections create a new file version.

## 7. CI gates

Every PR: lint, type-check, unit, integration, all numerical families, build. End-to-end runs on
PRs that touch `apps/web`. A PR cannot merge with a failing or skipped numerical test.

## 8. Phase exit evidence

| Gate | Evidence |
|---|---|
| G1 (engine) | VT-01…VT-19 pass; tolerance record approved; verification report listing which layers back each family, with L3 gaps stated explicitly |
| G2 (workspace) | VI-01, VI-02, VE-02 pass |
| G3 (analysis) | VI-03, VE-01 pass |
| G4 (release) | Full suite green on the release commit; performance record; owner walkthrough of §14 |
