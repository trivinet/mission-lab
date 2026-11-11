# Proposed Architecture — Mission Lab M1

**Document ID:** ML-ARCH-002 · **Date:** 2026-11-11 · **Author:** Coordinator (acting Systems Architect) · **Status:** Approved at gate G0 (owner, 2026-11-11)

Nothing in this document is implemented. Library versions are deliberately not stated: they are
selected against current stable releases and pinned in ML-TASK-002, after G0.

## 1. Shape of the system

A static single-page web application. All computation runs in the browser; there is no server,
database, account or API key (ARCH-009).

```
apps/web  (React UI, 3D scene, plots, worker host, file I/O)
   │ uses                       │ uses
   ▼                            ▼
packages/simulation  ─────►  packages/contracts
   │ (run orchestration,        (types + runtime schemas:
   │  validation, analysis,      Scenario, SimulationRequest,
   │  serialisation/migration)   SimulationResult)
   ▼
packages/astrodynamics   (pure physics, zero runtime dependencies)

verification/  (independent reference implementations + reference datasets;
                imports contracts only — never astrodynamics — when producing references)
```

Dependency rule (enforced by lint and by package manifests): arrows point downward only.
`astrodynamics` imports nothing. Nothing below `apps/web` may import React, Three.js or any
browser API (ARCH-001, ARCH-007).

## 2. Module-to-package mapping (resolves review finding F-09)

| ML-SYS-001 §4.2 module | Location | Notes |
|---|---|---|
| B. Astrodynamics Core | `packages/astrodynamics` | constants, vector math, element↔state conversion, RSW basis, propagator, maneuver application, derived quantities |
| C. Simulation Controller | `packages/simulation/run` | request validation, segment sequencing around maneuvers, sampling, diagnostics. Pure function; the worker wrapper lives in `apps/web` |
| E. Analysis Engine | `packages/simulation/analysis` | time histories, coast-vs-maneuver deltas, plot datasets. Derived only from `SimulationResult` |
| G. Persistence Adapter | `packages/simulation/persistence` (format, validation, migration) + `apps/web` (file picker, download, local storage) | format logic is testable without a browser |
| A. Scenario Manager | `apps/web/src/features/scenario` (state) using `contracts` schemas | |
| D. Visualization Engine | `apps/web/src/features/scene` | separate `packages/visualization` deferred until a second consumer exists |
| F. User Interface | `apps/web` | |

Change from the original tree: `packages/visualization` is not created in M1, and a top-level
`verification/` workspace is added so the verifier's code is physically separate from the code
under test.

## 3. Scientific conventions (proposed; see ADR-004, ADR-005)

| Topic | Proposal |
|---|---|
| Dynamics | Point-mass two-body, Earth-centred (ML-SYS-001 §5.1) |
| μ (Earth) | 3.986004418 × 10¹⁴ m³/s² — WGS 84 value. To be confirmed against the primary source by the Verification Engineer before use |
| Reference radius | 6 378 137 m — WGS 84 equatorial radius. Used only for "altitude above reference sphere" display and the surface-intersection flag. Not geodetic altitude |
| Inertial frame | Frame id `GCRF`: origin at Earth's centre of mass, axes aligned with the Geocentric Celestial Reference Frame. For the idealised M1 dynamics the frame is exactly inertial by construction. No other frame is accepted or produced in M1 |
| Units | SI internally: m, m/s, s, rad, kg. Field names carry a unit suffix (`_m`, `_mps`, `_s`, `_rad`). Conversion to km, km/s, degrees happens only in the UI formatting layer |
| Epoch | `{ scale: "UTC", iso: "YYYY-MM-DDTHH:MM:SS.sssZ" }` at the scenario boundary only |
| Simulation time | `t_s`: elapsed SI seconds from the scenario epoch, float64. All physics uses `t_s`; no physics function receives a calendar date |
| UTC labels | Displayed timestamp = epoch + `t_s`, without leap-second handling. Limitation recorded in result metadata. No physical effect, because two-body dynamics is time-translation invariant |
| Classical elements | a, e, i, Ω, ω, ν. Degenerate cases follow a fixed convention (circular: ω := 0, ν := argument of latitude; equatorial: Ω := 0, ω := longitude of periapsis; both: ν := true longitude). The Cartesian state is always the authoritative representation; elements are a derived view |
| RSW frame | R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R (right-handed, Vallado convention). Δv_inertial = ΔvR·R + ΔvS·S + ΔvW·W, evaluated with the pre-maneuver state |
| Maneuver | Instantaneous: position unchanged, velocity incremented, at an epoch given as `t_s`. No mass model in M1 |
| Propagator | Analytical universal-variable Kepler propagation with Stumpff functions and Lagrange f/g coefficients (ADR-005). Each sample is propagated from the segment's initial state, not chained sample-to-sample, so error does not accumulate with output step |
| Input conics | Closed orbits only at input (0 ≤ e < 1, perigee radius > reference radius). Post-maneuver escape or surface intersection is propagated and flagged |
| Earth orientation (display only) | Rotation about inertial +Z by Earth Rotation Angle with UT1 ≈ UTC; precession, nutation and polar motion ignored. Labelled *illustrative*. Not used for any numeric output in M1 (ADR-004) |

## 4. Simulation contract (draft v0.2 — replaces the illustrative sample)

Illustrative TypeScript; the normative version is produced in ML-TASK-004 and reviewed before any
dependent work starts.

```ts
type Vec3 = readonly [number, number, number];

interface Epoch { scale: "UTC"; iso: string }

interface KeplerianElements {
  semiMajorAxis_m: number; eccentricity: number; inclination_rad: number;
  raan_rad: number; argPeriapsis_rad: number; trueAnomaly_rad: number;
}

/** Editable definition. This is what is saved to disk. */
interface Scenario {
  schemaVersion: "1.0";
  id: string; name: string;
  centralBody: "EARTH";
  frame: "GCRF";
  epoch: Epoch;
  initialOrbit: { kind: "KEPLERIAN"; elements: KeplerianElements };
  maneuvers: ImpulsiveManeuver[];          // M1 validator: length <= 1
  duration_s: number;
  outputStep_s: number;
}

interface ImpulsiveManeuver {
  id: string;
  t_s: number;                              // elapsed seconds from scenario epoch
  frame: "RSW";
  deltaV_mps: Vec3;                         // [radial, along-track (S), cross-track (W)]
}

/** What the engine actually receives: fully resolved, Cartesian, self-contained. */
interface SimulationRequest {
  requestId: string;                        // deterministic hash of the physical inputs
  schemaVersion: "1.0";
  centralBody: "EARTH"; mu_m3ps2: number;
  dynamicsModel: "TWO_BODY";
  frame: "GCRF"; epoch: Epoch;
  initialState: { position_m: Vec3; velocity_mps: Vec3 };
  maneuvers: ImpulsiveManeuver[];
  duration_s: number; outputStep_s: number;
}

/** Continuous arc between discontinuities. Columnar for cheap worker transfer. */
interface TrajectorySegment {
  index: number;
  t_s: Float64Array;                        // N
  position_m: Float64Array;                 // 3N
  velocity_mps: Float64Array;               // 3N
}

interface ManeuverEvent {
  maneuverId: string; t_s: number;
  position_m: Vec3;
  velocityBefore_mps: Vec3; velocityAfter_mps: Vec3;
  deltaV_inertial_mps: Vec3; deltaV_magnitude_mps: number;
}

interface Diagnostic { severity: "info" | "warning" | "error"; code: string; message: string; t_s?: number }

interface SimulationResult {
  requestId: string;
  model: {
    engineVersion: string;                  // semver of packages/astrodynamics
    dynamicsModel: "TWO_BODY"; propagator: "KEPLER_UNIVERSAL_VARIABLE";
    maneuverModel: "IMPULSIVE"; frame: "GCRF"; timeConvention: string;
    constants: { mu_m3ps2: number; referenceRadius_m: number; source: string };
    limitations: string[];
  };
  segments: TrajectorySegment[];            // k maneuvers -> k+1 segments
  events: ManeuverEvent[];
  diagnostics: Diagnostic[];
  status: "ok" | "failed";
}
```

Rules attached to the contract:

- Both sides of a maneuver are sampled exactly at the maneuver time: the last sample of segment
  *n* and the first of segment *n+1* share `t_s` and position and differ in velocity (§5.5).
- A result is immutable and is identified by `requestId`. The UI marks a result *stale* when the
  current scenario hashes to a different `requestId`.
- The engine never throws for user-reachable conditions: it returns `status: "failed"` with
  diagnostics. Non-finite values are an error diagnostic, never a sample.
- A resource limit on sample count (value measured in Phase 2) is enforced at validation.
- The engine contains no clock and no randomness, so identical requests give bit-identical
  results on the same platform (ARCH-005).

**Scenario / Run / Result.** A *Scenario* is the editable definition. A *Run* is one
`SimulationRequest` derived from it. A *Result* is the immutable output. The M1 comparison
(ML-FR-010) is two runs of the same scenario: one with `maneuvers: []` (coast) and one with the
maneuver.

## 5. Web application

| Concern | Proposal | Reason |
|---|---|---|
| Build / framework | Vite + React + TypeScript (strict) SPA | No server rendering, routing or API routes are needed; Next.js would add exactly the infrastructure ARCH-009 excludes. ADR-006 |
| 3D | Three.js via React Three Fiber (stable release line only) | Declarative scene tied to app state |
| Styling | Tailwind CSS + a small in-repo component set | Per ML-SYS-001 §4.1 |
| State | A single lightweight store; selection to be confirmed in ML-TASK-002 | |
| Computation | `packages/simulation` invoked inside a Web Worker; typed arrays transferred, not copied | Keeps the render loop free |
| Scene units | 1 scene unit = 1 000 km, applied in one function in `features/scene` | Float32 GPU precision; single conversion point (ARCH-002) |
| Playback | Display interpolation between engine samples (cubic Hermite from position + velocity). Never crosses a segment boundary | Smooth motion without the renderer computing physics |
| Charts | Decided by a spike at the start of Phase 3 (OD-006) | |
| Persistence | Versioned JSON file export/import. Optional local-storage autosave of the working scenario. No IndexedDB (OD-007) | |
| Deployment | Static hosting; provider and any publication decided by the owner before Phase 4 | No external action without authorisation |

## 6. Tooling (Phase 0b, after G0)

pnpm workspaces · TypeScript project references · Vitest (unit, integration, numerical) ·
Playwright (end-to-end) · ESLint with import-boundary rules + Prettier · GitHub Actions running
lint, type-check, tests and build on every PR · Node LTS pinned via `.nvmrc`/`engines`.

## 7. Proposed ADRs

| ADR | Decision | Resolves |
|---|---|---|
| [ADR-001](adr/ADR-001-greenfield-repository.md) | Greenfield repository; Satellite Viewer not reused | OD-001 |
| [ADR-002](adr/ADR-002-decoupled-typescript-engine.md) | Decoupled TypeScript engine and package boundaries | — |
| [ADR-003](adr/ADR-003-independent-verification.md) | Independent scientific verification | OD-009 (method) |
| [ADR-004](adr/ADR-004-frame-and-time-conventions.md) | Frame, time and Earth-orientation conventions | OD-003, OD-005 |
| [ADR-005](adr/ADR-005-kepler-propagation-algorithm.md) | Universal-variable Kepler propagator | OD-004 |
| [ADR-006](adr/ADR-006-frontend-stack.md) | Vite + React + R3F + Tailwind; JSON-only persistence | OD-002, OD-007 |
| [ADR-007](adr/ADR-007-agent-organisation.md) | Claude Code subagents, roles and model allocation | OD-008 |

OD-006 (charting library) stays open by design until the Phase 3 spike.
