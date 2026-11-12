# M1 Requirements — Orbital Sandbox

**Document ID:** ML-REQ-001 · **Date:** 2026-11-11 · **Author:** Coordinator · **Status:** Approved at gate G0 (owner, 2026-11-11)

Refines ML-SYS-001 §6 for release M1. Requirement IDs are permanent. Each acceptance criterion
(AC) is testable; the verification method column refers to the
[verification plan](../verification/m1-verification-plan.md): **N** numerical test, **U** unit,
**I** integration, **E** end-to-end, **R** owner review.

Numeric tolerances are not stated here. "Within tolerance" means the tolerance recorded for that
test family in the verification plan, derived and approved as described there.

The accuracy required of derived angles (i, Ω, ω, ν and the angles assigned by the degenerate
convention) is set by an owner-approved angular accuracy target that is independent of how the UI
formats or rounds values for display (ADR-008). Its value is approved with the tolerance record.
(Amended by owner decision, 2026-11-12.)

**Open:** the display precision of numeric values in the UI (decimal places or significant
digits per quantity) is not defined by these requirements. It is not a source of accuracy
requirements.

## 1. In scope / out of scope

**In:** one spacecraft; Earth; two-body dynamics; closed input orbits; zero or one impulsive RSW
maneuver; frame `GCRF`; 3D view; timeline playback; plots; coast-vs-maneuver comparison; JSON
save/load; model metadata.

**Out (M1):** J2, drag, third bodies, SRP; numerical propagation; multiple maneuvers; finite
burns; spacecraft mass and propellant; ground tracks, sub-satellite points, geodetic altitude;
other frames; TLE/SGP4 or any real-object data; comparison across different scenarios; backend,
accounts, cloud storage; mobile layout.

## 2. Functional requirements

### ML-FR-001 — Create a new orbital scenario (MUST)
- AC1 A "new scenario" action produces a valid default scenario (documented default orbit, epoch,
  duration, step) that can be run without further input. **E**
- AC2 Name, epoch (UTC), duration and output step are editable; each shows its unit. **E**
- AC3 Creating a new scenario with unsaved changes asks for confirmation. **E**

### ML-FR-002 — Configure and validate Keplerian elements (MUST)
- AC1 The six elements a, e, i, Ω, ω, ν are editable, displayed in km and degrees, stored in m and
  rad. **U, E**
- AC2 Validation rejects, with a field-level message: non-finite values; a ≤ 0; e < 0 or e ≥ 1;
  i outside [0°, 180°]; perigee radius a(1−e) not above the reference radius. Angles Ω, ω, ν are
  normalised to [0°, 360°). **U**
- AC3 Degenerate configurations (circular and/or equatorial within the approved thresholds) are
  detected, and the UI states which elements are undefined and which convention is applied. **U, E**
- AC4 Derived read-only quantities are shown and visually distinct from inputs: perigee and
  apogee radius and altitude, period, specific energy. **U, E**

### ML-FR-003 — Convert Keplerian elements to Cartesian states (MUST)
- AC1 Elements → state matches independent references within tolerance. **N**
- AC2 State → elements → state round trip holds within tolerance over the test grid, including
  degenerate cases under the documented convention (ADR-008): eccentricity and inclination are
  reported as computed and never set to zero; the convention assigns only the undefined angles.
  (Amended by owner decision, 2026-11-12.) **N**
- AC3 The output state declares frame, central body and epoch (ARCH-004). **U**

### ML-FR-004 — Propagate an orbit with the two-body model (MUST)
- AC1 Propagated states match independent references within tolerance for circular, moderately
  and highly elliptical orbits, over fractions of a period and many periods. **N**
- AC2 Specific energy and angular momentum vector are conserved within tolerance on every
  sample. **N**
- AC3 After exactly one period the state returns to the initial state within tolerance. **N**
- AC4 Samples are produced at t = k·Δt, at the end time, and at maneuver times; changing the
  output step does not change the state at any common time beyond tolerance. **N**
- AC5 Identical requests produce identical results. **I**
- AC6 Solver non-convergence or non-finite values yield `status: "failed"` with a diagnostic. **U**

### ML-FR-005 — Configure an impulsive RSW maneuver (MUST)
- AC1 The user can add, edit and remove one maneuver: time (elapsed, and shown as UTC) and
  radial, along-track, cross-track Δv in m/s. **E**
- AC2 Validation rejects a maneuver time outside [0, duration], non-finite components, and a
  second maneuver (M1 limit, with a message saying so). **U**
- AC3 The UI shows total |Δv| and documents the RSW convention, including that along-track is not
  the velocity direction on a non-circular orbit. **E, R**

### ML-FR-006 — Execute maneuver propagation (MUST)
- AC1 The RSW basis at the maneuver point is orthonormal and right-handed within tolerance. **N**
- AC2 The inertial Δv matches independent references within tolerance. **N**
- AC3 Position is continuous and velocity changes by exactly the inertial Δv across the
  maneuver; both sides are present in the result. **N**
- AC4 A zero-magnitude maneuver produces the same trajectory as no maneuver within tolerance. **N**
- AC5 Post-maneuver orbital elements match independent references within tolerance. **N**
- AC6 A post-maneuver orbit that escapes (e ≥ 1) or intersects the reference sphere is propagated
  and reported with a warning diagnostic. **N, U**

### ML-FR-007 — Display orbital trajectories in 3D (MUST)
- AC1 Earth, the trajectory, the spacecraft marker and the maneuver point are displayed; camera
  orbit, zoom and reset work. **E**
- AC2 Every rendered trajectory vertex equals the engine sample scaled by the single
  scene-unit conversion; verified through the scene-state test hook, not by image. The scene
  coordinate of a sample component x is one binary64 multiplication by the scene scale s followed
  by one rounding to binary32, `Math.fround(x * s)`, so "equals" is exact. (Amended by owner
  decision, 2026-11-12.) **I**
- AC3 The inertial axes can be shown; the Earth orientation is labelled illustrative. **E, R**
- AC4 Changing a display option does not trigger a new simulation. **I**

### ML-FR-008 — Control simulation playback (MUST)
- AC1 Play, pause, scrub, jump to start/end/maneuver, and selectable time rates. **E**
- AC2 The displayed time, spacecraft marker and plot cursor always refer to the same `t_s`. **I**
- AC3 Interpolated display positions never cross a maneuver discontinuity and equal the engine
  sample at sample times. **U**

### ML-FR-009 — Visualize orbital parameter histories (MUST)
- AC1 Time histories are available for radius, altitude above the reference sphere, speed, true
  anomaly, and the classical elements. **E**
- AC2 Plots have axis titles with units, a legend, and a marker at the maneuver time. **E, R**
- AC3 Plotted values come from the analysis module and match its output exactly. **I**

### ML-FR-010 — Compare baseline and maneuver scenarios (MUST)
- AC1 With a maneuver defined, running produces a coast run and a maneuvered run over the same
  span; both trajectories can be shown together with distinct, labelled styles. **E**
- AC2 A comparison table lists before/after values and differences for a, e, i, Ω, ω, perigee and
  apogee radius, period and specific energy, plus the applied Δv. **I, E**
- AC3 Comparison values match independent references within tolerance. **N**

### ML-FR-011 — Save and load scenario configurations (MUST)
- AC1 Save produces a JSON file containing `schemaVersion` and everything needed to reproduce
  the run. **I**
- AC2 Save → load → save yields an identical file; load → run reproduces the original result. **I, E**
- AC3 Loading rejects, with a readable message and without changing the current scenario: invalid
  JSON, unknown or missing schema version, schema violations, out-of-range values, and files over
  a size limit. **U, E**
- AC4 The UI indicates unsaved changes. **E**

### ML-FR-012 — Display active physical models and assumptions (MUST)
- AC1 A panel shows, for the current result: dynamics model, central body and constants with
  source, propagator, maneuver model, frame, time convention, engine version, sampling
  configuration and the list of limitations (ML-SYS-001 §5.7). **E, R**
- AC2 The content is rendered from `SimulationResult.model`, not hard-coded in the UI. **I**
- AC3 The application states that it is not qualified for operational use. **R**

### ML-FR-013 — Predefined example scenarios (SHOULD)
- AC1 At least three presets load through the same validation path as user files. **I, E**

### ML-FR-014 — Export simulation results as CSV (SHOULD)
- AC1 Export contains a header with units, frame and epoch, and one row per sample; values equal
  the result. **I**

## 3. Workspace state requirements (from ML-SYS-001 §9.2)

- **ML-UX-001** The UI distinguishes five result states: none, computing, current, stale, error.
  A run that returns `status: "failed"` puts the UI in the error state and shows its diagnostics;
  validation issues prevent the run and are shown at the fields; a successful result with warning
  diagnostics is current, with the warnings listed. (Amended by owner decision, 2026-11-11: fifth
  state added after the contract review, PR #7.) **E**
- **ML-UX-002** Editing a physical parameter marks the result stale; it does not silently
  recompute or silently keep showing the old result as current. **E**
- **ML-UX-003** Computation runs off the main thread; the UI stays interactive meanwhile. **E**
- **ML-UX-004** All inputs are reachable and operable by keyboard. **E, R**

## 4. Nonfunctional requirements

| ID | Requirement | Method |
|---|---|---|
| ML-NFR-001 | `packages/astrodynamics` and `packages/simulation` import no UI, rendering or browser API; enforced in CI. | lint |
| ML-NFR-002 | Every public physics function documents units, frame and source reference. | review |
| ML-NFR-003 | The engine has no clock or randomness dependency. | lint, **I** |
| ML-NFR-004 | A sample-count limit is enforced at validation; its value and the supported performance envelope are measured and recorded in Phase 2. | **U**, report |
| ML-NFR-005 | CI runs lint, type-check, unit, integration, numerical and build on every PR; reference cases run in CI. | CI |
| ML-NFR-006 | No secrets in the repository; dependency audit runs in CI. | CI |
| ML-NFR-007 | Dependencies are pinned through the lockfile; adding one requires justification in the PR. | review |

## 5. Traceability to the release acceptance scenario (ML-SYS-001 §14)

| Step | Requirements |
|---|---|
| 1–2 create orbit, inspect elements | FR-001, FR-002 |
| 3–4 propagate, visualise | FR-003, FR-004, FR-007, FR-008 |
| 5–7 define and execute maneuver, visualise | FR-005, FR-006, FR-007 |
| 8–9 inspect changes, compare | FR-009, FR-010 |
| 10–12 save, reload, reproduce | FR-011, FR-004 AC5 |
| 13 inspect model metadata | FR-012 |
