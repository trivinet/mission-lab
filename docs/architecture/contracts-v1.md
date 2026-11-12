# Simulation Contracts v1.0

**Document ID:** ML-ARCH-003 · **Date:** 2026-11-11 · **Author:** Systems Architect (ML-TASK-004) · **Revision:** 2 (owner decisions of 2026-11-11 and role reviews incorporated) · **Status:** Accepted — owner approval 2026-11-12 (merge of PR #7)

Normative prose for `packages/contracts` (`@mission-lab/contracts`). It refines the approved
draft contract v0.2 of [proposed-architecture.md §4](proposed-architecture.md#4-simulation-contract-draft-v02--replaces-the-illustrative-sample).
The zod schemas in `packages/contracts/src` are the single source of truth for the TypeScript
types (`z.infer`); this document gives the meaning those schemas cannot express. Where this
document and the schemas disagree, that is a defect to be reported, not resolved silently.

Deviations from §4 are listed in §10, the owner decisions of 2026-11-11 in §11 and the questions
still open in §12. Non-normative guidance for consumers is in §14.

## 1. Scope

| Object | Role | Persisted | Versioned by |
|---|---|---|---|
| `Scenario` | Editable definition, the saved JSON file | yes | `schemaVersion` |
| `SimulationRequest` | What the engine receives: resolved, Cartesian, self-contained | no | `schemaVersion` |
| `SimulationResult` | Output of one run; must not be mutated once produced | no | `requestId` + `model.engineVersion` |
| `TrajectorySegment`, `ManeuverEvent`, `Diagnostic` | Parts of a result | no | containing result |

Not in this contract: the physics (element↔Cartesian conversion, propagation, RSW transformation,
constants values), the worker message protocol (including its per-job id, §14), the file-size
limit of ML-FR-011 AC3 and the canonical serialisation of the saved file (persistence,
`packages/simulation`), the sample-count limit value (ML-NFR-004, measured in Phase 2).

`packages/contracts` depends on `zod` only and imports no other workspace package (ADR-002,
architecture §1). It performs no arithmetic on physical quantities beyond the checks of §5.5.

## 2. Conventions common to all objects

| Topic | Rule | Source |
|---|---|---|
| Units | SI only: m, m/s, s, rad, m³/s². No km, degrees or km/s anywhere in the contract. | Architecture §3, ML-SYS-001 §5.6 |
| Field names | A field holding a physical quantity ends with its unit suffix: `_m`, `_mps` (m/s), `_s`, `_rad`, `_m3ps2` (m³/s²). Dimensionless quantities (`eccentricity`) and non-physical fields carry no suffix. Enforced by a test over every field of the fixtures. | Architecture §3, AGENTS.md |
| Numbers | IEEE-754 binary64. Every number in every contract object is finite: NaN, +∞ and −∞ are rejected with `NON_FINITE_NUMBER`. −0 is a distinct value: it passes every `≥ 0` rule and fails every `> 0` rule, and the `requestId` distinguishes it from +0 (§7.2). | §4 rules ("Non-finite values are an error diagnostic, never a sample"); owner decision 8 |
| Equality | "Bit-identical" means `Object.is` on finite numbers (same IEEE-754 bit pattern; +0 and −0 differ). "Equal" without qualifier means `===`. | Owner decisions 2, 5 |
| `Vec3` | `readonly [x, y, z]`, exactly three finite numbers. Its frame and unit are those of the field that holds it. Parsed tuples are frozen by zod (`.readonly()`, checked on zod 4.6.7); consumers copy before editing. | §4 |
| Inertial frame | `"GCRF"`: origin at Earth's centre of mass, axes aligned with the GCRF. The only inertial frame accepted or produced in v1.0. | ADR-004 |
| Local frame | `"RSW"`: R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R, evaluated with the pre-maneuver state. Used only for maneuver inputs. | Architecture §3 |
| Epoch | `{ scale: "UTC", iso }`, `iso` exactly `YYYY-MM-DDTHH:MM:SS.sssZ` (4-digit year, 3 fractional digits, literal `Z`) and an existing calendar instant. Second 60 is not representable (§11, OQ-7). Appears only at the scenario/request boundary and in result metadata. | ADR-004, architecture §3 |
| Simulation time | `t_s`: elapsed SI seconds from the epoch, binary64. No physics field carries a calendar date. | ADR-004 |
| Central body | `"EARTH"`, explicit in every object that implies one. | ML-SYS-001 A.2 |
| Unknown fields | Rejected (`UNKNOWN_FIELD`) in every object. | ML-FR-011 AC3, AC2 (round-trip identity) |
| Identifiers | Non-empty strings compared by exact equality, otherwise uninterpreted. | §4 |

## 3. Scenario (persisted file)

The JSON file written by *Save* is exactly one `Scenario` object (UTF-8). Key order inside the
file is not significant for validation.

| Field | Type | Unit / frame | Meaning and rules |
|---|---|---|---|
| `schemaVersion` | `"1.0"` | — | Format version (§9). Anything else, or missing: `SCHEMA_VERSION_UNSUPPORTED`, reported alone. |
| `id` | string, non-empty | — | Scenario identifier. `ID_EMPTY`. |
| `name` | string | — | Display label. Any string, including empty. |
| `centralBody` | `"EARTH"` | — | Central body of the dynamics. |
| `frame` | `"GCRF"` | — | Inertial frame of the scenario. |
| `epoch` | `Epoch` | UTC | Instant at which `t_s = 0` and at which `initialOrbit` is given. `EPOCH_INVALID`. |
| `initialOrbit.kind` | `"KEPLERIAN"` | — | Representation of the initial orbit; the only kind in v1.0. |
| `initialOrbit.elements.semiMajorAxis_m` | number | m | a > 0. `SEMI_MAJOR_AXIS_NOT_POSITIVE`. |
| `initialOrbit.elements.eccentricity` | number | dimensionless | 0 ≤ e < 1 (closed input orbit). `ECCENTRICITY_OUT_OF_RANGE`. |
| `initialOrbit.elements.inclination_rad` | number | rad | 0 ≤ i ≤ π (`Math.PI`). `INCLINATION_OUT_OF_RANGE`. |
| `initialOrbit.elements.raan_rad` | number | rad | Ω, normalised: 0 ≤ Ω < 2π (`2 * Math.PI`). `ANGLE_OUT_OF_RANGE`. |
| `initialOrbit.elements.argPeriapsis_rad` | number | rad | ω, normalised: 0 ≤ ω < 2π. `ANGLE_OUT_OF_RANGE`. |
| `initialOrbit.elements.trueAnomaly_rad` | number | rad | ν at the epoch, normalised: 0 ≤ ν < 2π. `ANGLE_OUT_OF_RANGE`. |
| `maneuvers` | `ImpulsiveManeuver[]` | — | Length ≤ 1 in v1.0 (`MANEUVER_COUNT_EXCEEDED`). Ids unique (`ID_DUPLICATE`). |
| `duration_s` | number | s | Propagated span from the epoch; > 0. `DURATION_NOT_POSITIVE`. |
| `outputStep_s` | number | s | Sampling interval; > 0. `OUTPUT_STEP_NOT_POSITIVE`. |

**Reading the elements (owner decision 4).** The angles are referred to the scenario `frame`.
Element→Cartesian conversion uses the given elements with the regular map: no special-casing of
circular or equatorial orbits and no re-normalisation of the inputs. The degenerate-element
conventions of architecture §3 (circular: ω := 0; equatorial: Ω := 0; both: ν := true longitude)
apply only to state→elements, i.e. to the derived element view of a computed state, with the
circular/equatorial thresholds taken from the tolerance record. "Equatorial" means i = 0 or
i = π. The rotation formulas are physics and are specified, with a cited source, by
ML-TASK-013/014 in `packages/astrodynamics`; this contract gives none.

**Semantic rules not checked here (owner decision 3).** Perigee radius a(1 − e) must exceed the
reference radius (ML-FR-002 AC2), and the sample count of §5.2 must not exceed the ML-NFR-004
limit. Both need a physical constant or a measured limit, so they are checked by a synchronous
function of `packages/simulation` that runs on a structurally valid `Scenario` **before a request
is built**. It returns `ValidationIssue[]` (§6) with these codes and paths:

| Code | `path` |
|---|---|
| `PERIGEE_BELOW_REFERENCE_RADIUS` | `["initialOrbit", "elements"]` |
| `SAMPLE_COUNT_EXCEEDED` | `["outputStep_s"]` |

A semantic rejection never produces a `SimulationRequest` or a `SimulationResult`.

### 3.1 ImpulsiveManeuver

| Field | Type | Unit / frame | Meaning and rules |
|---|---|---|---|
| `id` | string, non-empty | — | Referenced by `ManeuverEvent.maneuverId`. |
| `t_s` | number | s from epoch | Application time; 0 ≤ `t_s` ≤ `duration_s` (both ends inclusive). `MANEUVER_TIME_OUT_OF_RANGE`. |
| `frame` | `"RSW"` | — | Frame of `deltaV_mps`. |
| `deltaV_mps` | `Vec3` | m/s, RSW | [ΔvR radial, ΔvS along-track, ΔvW cross-track]. Δv_inertial = ΔvR·R + ΔvS·S + ΔvW·W with the pre-maneuver state. Zero vector allowed. |

The maneuver is instantaneous: position unchanged, velocity incremented, no mass model. A
zero-Δv maneuver is still a maneuver: it yields one event and splits the trajectory into two
segments (§5.2).

## 4. SimulationRequest

Built by `packages/simulation` from a `Scenario` that passed structural (§6) and semantic (§3)
validation: element→Cartesian conversion, constants from `packages/astrodynamics`. The engine
reads nothing else.

| Field | Type | Unit / frame | Meaning and rules |
|---|---|---|---|
| `requestId` | string | — | `sha256:` + 64 lowercase hex digits, defined in §7. `REQUEST_ID_INVALID`. |
| `schemaVersion` | `"1.0"` | — | As for Scenario. |
| `centralBody` | `"EARTH"` | — | |
| `constants.mu_m3ps2` | number | m³/s² | Gravitational parameter used by the run; > 0 (`MU_NOT_POSITIVE`). |
| `constants.referenceRadius_m` | number | m | Radius of the reference sphere used for altitude display, the perigee rule and `REFERENCE_SPHERE_INTERSECTION`; > 0 (`REFERENCE_RADIUS_NOT_POSITIVE`). |
| `constants.source` | string | — | Citation of the constants' source. |
| `dynamicsModel` | `"TWO_BODY"` | — | Point-mass two-body. |
| `frame` | `"GCRF"` | — | Frame of `initialState` and of every output vector. |
| `epoch` | `Epoch` | UTC | Copied from the scenario. |
| `initialState.position_m` | `Vec3` | m, `frame` | Position at `t_s = 0`. |
| `initialState.velocity_mps` | `Vec3` | m/s, `frame` | Velocity at `t_s = 0`. |
| `maneuvers` | `ImpulsiveManeuver[]` | — | Same schema and rules as Scenario (≤ 1, time in range, unique ids). |
| `duration_s`, `outputStep_s` | number | s | As for Scenario. |

**Constants (owner decision 1).** The values of `constants` come from `packages/astrodynamics`
(architecture §3, to be confirmed by VT-19); the contract fixes no value. `constants` is part of
the canonical payload (§7), so a change of constants changes the `requestId`. The engine copies
`constants` unchanged into `result.model.constants`; bit-identical equality of the two (both
numbers and the `source` string) is checked by VI-01, not by the result schema, which does not
see the request.

## 5. SimulationResult

### 5.1 Top level

| Field | Type | Meaning |
|---|---|---|
| `requestId` | string (§7 format) | `requestId` of the request that produced it. |
| `model` | `ResultModel` (§5.4) | Everything ML-FR-012 displays. |
| `segments` | `TrajectorySegment[]` | k events → k + 1 segments, ordered by time. |
| `events` | `ManeuverEvent[]` | Applied maneuvers, ordered by time. |
| `diagnostics` | `Diagnostic[]` | All conditions found, in the order found. |
| `status` | `"ok"` \| `"failed"` | See invariants. |

A result must not be mutated after it is produced (including its typed arrays). The contract does
not freeze it; the obligation is on every holder.

### 5.2 TrajectorySegment (columnar)

A continuous arc between discontinuities. N ≥ 1 samples.

| Field | Type | Unit / frame | Layout |
|---|---|---|---|
| `index` | number | — | Equals the segment's position in `segments`. |
| `t_s` | `Float64Array`, length N | s from epoch | Strictly increasing. |
| `position_m` | `Float64Array`, length 3N | m, `model.frame` | `[x0, y0, z0, x1, y1, z1, …]`; sample k at `3k … 3k+2`. |
| `velocity_mps` | `Float64Array`, length 3N | m/s, `model.frame` | Same layout. |

Every element is finite. A segment is not JSON-serialisable as is; CSV export (ML-FR-014)
converts explicitly.

**Buffer ownership (owner decision 7).** Each of `t_s`, `position_m` and `velocity_mps` owns its
own `ArrayBuffer`: `byteOffset === 0`, `buffer.byteLength === byteLength`, the buffer is an
`ArrayBuffer` (not a `SharedArrayBuffer`), and no two arrays of a result share a buffer. A result
crosses the worker boundary by transfer of these buffers, not by copy; after the transfer the
sender no longer holds the data, so any cache of results lives on the receiving side. Enforced
by the result schema (R11).

**Sampling grid (normative, owner decision 2).** For a request with duration D = `duration_s`,
step h = `outputStep_s` and maneuver times m₁ … m_k (k ≤ 1 in v1.0), the sample times are:

1. Grid candidates t_j = fl(j × h), each computed as one binary64 multiplication of the integer
   j (exactly representable) by h, for j = 0, 1, 2, …, kept only while t_j < D (strict). t₀ is
   +0. The candidates are not accumulated (t_j is never computed as t_{j−1} + h).
2. D itself.
3. Each maneuver time mᵢ. A grid point or D that is equal (`===`) to mᵢ is not duplicated: the
   single sample at that time takes the value mᵢ (this matters only for mᵢ = −0, where the
   sample time is −0).

The union is sorted increasingly. Values one ulp apart are distinct samples and are both kept.

If h ≥ D, the only grid candidate is t₀ = 0, so a coast run has exactly the two samples 0 and D.

Segments: the boundaries are b₀ = 0, b₁ = m₁, …, b_k = m_k, b_{k+1} = D. Segment n holds every
sample time t with b_n ≤ t ≤ b_{n+1}, in increasing order. A boundary time mᵢ therefore appears
exactly once in segment i − 1 (as its last sample) and once in segment i (as its first sample),
and nowhere else. A maneuver at 0 makes segment 0 the single sample [0]; a maneuver at D makes
the last segment the single sample [D]. "Common time" in §4 of the architecture means
bit-identical `t_s`.

The sample count checked by `SAMPLE_COUNT_EXCEEDED` (§3) is the sum of N over all segments of
this grid (boundary samples counted once per segment). The candidates are strictly increasing in
j while j < 2⁵¹: the exact products differ by h, the spacing of binary64 values at that magnitude
is at most h/2, and each rounding moves a product by at most half a spacing. The ML-NFR-004
limit, when fixed, must be far below that.

### 5.3 ManeuverEvent and Diagnostic

| Field | Type | Unit / frame | Meaning |
|---|---|---|---|
| `maneuverId` | string, non-empty | — | `id` of the applied `ImpulsiveManeuver`. |
| `t_s` | number | s from epoch | Application time, bit-identical to the maneuver's `t_s`. |
| `position_m` | `Vec3` | m, `model.frame` | Position at `t_s` (unchanged by the maneuver). |
| `velocityBefore_mps` | `Vec3` | m/s, `model.frame` | Velocity immediately before the maneuver. |
| `deltaV_inertial_mps` | `Vec3` | m/s, `model.frame` | The applied Δv expressed in the inertial frame. |
| `velocityAfter_mps` | `Vec3` | m/s, `model.frame` | For each component i, the binary64 sum `velocityBefore_mps[i] + deltaV_inertial_mps[i]` (one rounded addition). Schema-checked bit-exactly (R12). |
| `deltaV_magnitude_mps` | number ≥ 0 | m/s | The Euclidean norm ‖`deltaV_inertial_mps`‖. `MAGNITUDE_NEGATIVE`. Its value is **not** schema-checked: the norm cannot be pinned bit-exactly without fixing an evaluation order and relying on correctly rounded square root, which the contract does not do; it is checked within tolerance by VT-13. |

| Diagnostic field | Type | Meaning |
|---|---|---|
| `severity` | `"info"` \| `"warning"` \| `"error"` | Fixed by the code: `DIAGNOSTIC_CODE_SEVERITY[code]` (§8). Any other severity is rejected (`DIAGNOSTIC_SEVERITY_MISMATCH`). `error` ⇔ the run could not produce a trustworthy trajectory. |
| `code` | `DiagnosticCode` (§8) | Stable machine-readable code; unregistered codes are rejected (`UNSUPPORTED_VALUE`). |
| `message` | string | English text for logs. Not stable, never parsed, not shown as the UI's own wording: user interfaces map `code` (and `t_s`) to their text. |
| `t_s` | number, optional | Simulation time the condition refers to, when there is one. |

### 5.4 ResultModel

| Field | Type | Meaning |
|---|---|---|
| `engineVersion` | string | Version of `packages/astrodynamics` in Semantic Versioning 2.0.0 syntax (checked with the regular expression suggested by semver.org). `ENGINE_VERSION_INVALID`. |
| `centralBody` | `"EARTH"` | *Added, §10 D-2.* |
| `dynamicsModel` | `"TWO_BODY"` | |
| `propagator` | `"KEPLER_UNIVERSAL_VARIABLE"` | ADR-005. |
| `maneuverModel` | `"IMPULSIVE"` | |
| `frame` | `"GCRF"` | Frame of every vector in the result. |
| `epoch` | `Epoch` | *Added, §10 D-2.* Epoch of `t_s = 0` for every `t_s` in the result. |
| `timeConvention` | string | Human-readable statement of the time convention (UTC epoch + elapsed SI seconds, no leap-second handling in labels). |
| `sampling.duration_s`, `sampling.outputStep_s` | number > 0 | *Added, §10 D-2.* Sampling configuration of the run, copied from the request. |
| `constants` | as in §4 | Copied unchanged from `request.constants` (owner decision 1). |
| `limitations` | string[] | Model limitations shown by ML-FR-012 (ML-SYS-001 §5.7). |

**Content of `limitations` (guidance for the engine, ML-TASK-017).** Besides the model limitations
of ML-SYS-001 §5.7 and the sample-count limit (§11, OQ-6), it states that any Earth orientation
shown in the 3D view is illustrative only and is not used by the simulation (no Earth rotation
model in M1). No new field is introduced for this.

### 5.5 Result invariants (checked by `validateSimulationResult`)

| # | Invariant | Code | Trace |
|---|---|---|---|
| R1 | `segments[n].index === n` | `SEGMENT_INDEX_MISMATCH` | §4 |
| R2 | Each segment has N ≥ 1 samples | `SEGMENT_EMPTY` | §4, ML-FR-005 AC2 |
| R3 | `position_m.length === velocity_mps.length === 3 · t_s.length` | `TYPED_ARRAY_LENGTH_MISMATCH` | §4 (N, 3N) |
| R4 | `t_s`, `position_m`, `velocity_mps` are `Float64Array` | `TYPE_MISMATCH` | §4, architecture §5 (transfer) |
| R5 | Every typed-array element finite (first offender per array reported) | `NON_FINITE_NUMBER` | §4 rules |
| R6 | `t_s` strictly increasing within a segment (first offender reported; not evaluated when `t_s` has a non-finite element) | `SAMPLE_TIMES_NOT_INCREASING` | ML-FR-004 AC4, ML-FR-008 AC3 |
| R7 | `status: "ok"` ⇒ no `error` diagnostic and `segments.length === events.length + 1` | `RESULT_STATUS_INCONSISTENT`, `SEGMENT_COUNT_MISMATCH` | §4 ("k maneuvers → k+1 segments") |
| R8 | `status: "ok"` ⇒ for each event n, bit-identically: last `t_s` of segment n = `events[n].t_s` = first `t_s` of segment n+1; last position of segment n = first position of segment n+1 = `events[n].position_m`; last velocity of segment n = `velocityBefore_mps`; first velocity of segment n+1 = `velocityAfter_mps` | `SEGMENT_BOUNDARY_MISMATCH` (path names the event field) | §4 rule 1, ML-FR-006 AC3, owner decision 5 |
| R9 | `status: "failed"` ⇒ ≥ 1 `error` diagnostic, `segments` and `events` empty | `RESULT_STATUS_INCONSISTENT` | §4 rule 3, §11 OQ-4 |
| R10 | `status: "ok"` ⇒ first `t_s` of segment 0 `=== 0`; last `t_s` of the last segment bit-identical to `model.sampling.duration_s`; every event `t_s` in [0, `model.sampling.duration_s`] | `SEGMENT_TIME_SPAN_MISMATCH`, `MANEUVER_TIME_OUT_OF_RANGE` | §5.2 grid, ML-FR-004 AC4 |
| R11 | Typed-array buffer ownership (§5.2) | `TYPED_ARRAY_BUFFER_NOT_OWNED` | Owner decision 7 |
| R12 | `velocityAfter_mps[i]` bit-identical to `velocityBefore_mps[i] + deltaV_inertial_mps[i]` | `VELOCITY_INCREMENT_MISMATCH` | Owner decision 5 |
| R13 | `diagnostic.severity === DIAGNOSTIC_CODE_SEVERITY[diagnostic.code]` | `DIAGNOSTIC_SEVERITY_MISMATCH` | §8 |

R10 compares the first sample with `=== 0`, so −0 is accepted there (it occurs only for a
maneuver at −0, §5.2). R8 and R10 read sample values and run only when every segment satisfies
R2, R3 and R5.

Checked elsewhere, not by the schema: the sample times themselves against the §5.2 grid and
`result.model.constants` / `model.sampling` / `model.epoch` against the request (VI-01, which sees
both); `deltaV_magnitude_mps` and the physical correctness of every state (VT-13 and the
reference tests).

## 6. Validation API and error behaviour

```ts
validateScenario(input: unknown): ValidationResult<Scenario>
validateSimulationRequest(input: unknown): ValidationResult<SimulationRequest>
validateSimulationResult(input: unknown): ValidationResult<SimulationResult>
type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
interface ValidationIssue { code: ValidationCode; path: (string | number)[]; message: string }
```

- **Throwing scope.** The validators do not throw for any input built from JSON values
  (`JSON.parse` output), structured-clone output, or plain objects, arrays, primitives and typed
  arrays; every rejection is an issue. An input whose property access itself throws (a getter or
  a `Proxy` trap that throws, a revoked `Proxy`) may propagate that exception. Reason for not
  catching it: such inputs cannot come from a file or from the worker boundary, and a caught
  exception would need a code that hides a programming error.
- `path` locates the field from the validated root (e.g. `["maneuvers", 0, "t_s"]`), so the UI can
  show a field-level message (ML-FR-002 AC2). `message` is for logs; the UI maps `code` + `path`.
- For `Scenario` and `SimulationRequest`, an object whose `schemaVersion` is not `"1.0"` (or is
  missing) yields exactly one issue, `SCHEMA_VERSION_UNSUPPORTED`, and nothing else is checked.
- Otherwise all independent violations are reported, in schema field order. Cross-field rules
  (maneuver time ≤ `duration_s`, duplicate ids, R1, R7–R13 at result level) run only when the
  object they belong to has no type error (wrong type, missing field, non-finite number, wrong
  literal); range-rule failures (e.g. `duration_s = 0`) do not suppress them.
- The `value` returned is a new object (typed arrays are the same instances, not copies); nothing
  is stripped (unknown fields are rejected) and nothing is transformed (no defaults, no coercion,
  no angle normalisation).
- **Realm.** Class and buffer checks use `instanceof` (`Float64Array`, `ArrayBuffer`), so a result
  must be validated in the realm that owns its arrays. Full result validation (O(total samples))
  is intended to run in the worker before transfer; the receiving side may rely on it.
- Validation in this package is structural only. Semantic rules (§3) are a synchronous function
  of `packages/simulation` returning the same `ValidationIssue` shape (owner decision 3).

**Engine boundary.** The engine never throws for user-reachable conditions; it returns
`status: "failed"` with diagnostics (§4 rule 3). Input reaches the engine only as a request built
from a scenario that passed structural and semantic validation. A structurally or semantically
invalid input is therefore reported as `ValidationIssue[]` before any request exists and never
produces a `SimulationResult` (whose `model` could not be filled). A failed result is produced
only for conditions found while running a valid request: numerical failures and internal faults
(§8.3), and the engine's backstop sample-count guard: if a request built without the semantic
check exceeds the limit, the engine returns a failed result with an `error` diagnostic
`SAMPLE_COUNT_EXCEEDED`.

### 6.1 Validation rule table

| Rule | Applies to | Code | Trace |
|---|---|---|---|
| `schemaVersion === "1.0"` | Scenario, Request | `SCHEMA_VERSION_UNSUPPORTED` | ML-FR-011 AC3, ARCH-006 |
| Correct JSON type; required field present; `Vec3` has 3 elements; typed array class | all | `TYPE_MISMATCH` | ML-FR-011 AC3 |
| No unknown field | all | `UNKNOWN_FIELD` | ML-FR-011 AC2, AC3 |
| Every number finite | all | `NON_FINITE_NUMBER` | ML-FR-002 AC2, ML-FR-005 AC2, §4 |
| Literal / enum in the v1.0 set (`EARTH`, `GCRF`, `UTC`, `KEPLERIAN`, `RSW`, `TWO_BODY`, …, registered codes) | all | `UNSUPPORTED_VALUE` | ADR-004, ML-SYS-001 A.2 |
| Identifiers non-empty | all | `ID_EMPTY` | §4 (event ↔ maneuver reference) |
| Maneuver ids unique | Scenario, Request | `ID_DUPLICATE` | §4 (event ↔ maneuver reference) |
| Epoch format and calendar validity | Scenario, Request, Result | `EPOCH_INVALID` | ADR-004 |
| `duration_s > 0` | Scenario, Request, Result | `DURATION_NOT_POSITIVE` | ML-FR-001 AC2, ML-FR-004 |
| `outputStep_s > 0` | Scenario, Request, Result | `OUTPUT_STEP_NOT_POSITIVE` | ML-FR-001 AC2, ML-FR-004 AC4 |
| a > 0 | Scenario | `SEMI_MAJOR_AXIS_NOT_POSITIVE` | ML-FR-002 AC2 |
| 0 ≤ e < 1 | Scenario | `ECCENTRICITY_OUT_OF_RANGE` | ML-FR-002 AC2, architecture §3, A.2 |
| 0 ≤ i ≤ π | Scenario | `INCLINATION_OUT_OF_RANGE` | ML-FR-002 AC2 |
| 0 ≤ Ω, ω, ν < 2π | Scenario | `ANGLE_OUT_OF_RANGE` | ML-FR-002 AC2 (§11 OQ-1) |
| `maneuvers.length ≤ 1` | Scenario, Request | `MANEUVER_COUNT_EXCEEDED` | ML-FR-005 AC2, review F-04 |
| 0 ≤ maneuver `t_s` ≤ `duration_s` | Scenario, Request (Result: R10) | `MANEUVER_TIME_OUT_OF_RANGE` | ML-FR-005 AC2 |
| μ > 0 | Request, Result | `MU_NOT_POSITIVE` | ML-SYS-001 §5.1 (attracting point mass) |
| reference radius > 0 | Request, Result | `REFERENCE_RADIUS_NOT_POSITIVE` | Architecture §3 |
| `requestId` format | Request, Result | `REQUEST_ID_INVALID` | §7 |
| `engineVersion` is SemVer 2.0.0 | Result | `ENGINE_VERSION_INVALID` | §4 ("semver of packages/astrodynamics") |
| ‖Δv‖ ≥ 0 | Result | `MAGNITUDE_NEGATIVE` | Definition of a norm |
| R1–R13 | Result | §5.5 | §5.5 |
| Perigee above reference radius; sample count within limit | Scenario (by `packages/simulation`) | `PERIGEE_BELOW_REFERENCE_RADIUS`, `SAMPLE_COUNT_EXCEEDED` | ML-FR-002 AC2, ML-NFR-004; §3 |
| Any other zod issue (should not occur) | all | `SCHEMA_VIOLATION` | Fallback; its appearance is a contract defect |

### 6.2 From validation and status to the UI state (owner decision 9)

The UI states are defined by ML-UX-001 (owned by the requirements document). The contract fixes
only which contract outcome maps to which state:

| Contract outcome | UI state |
|---|---|
| `ValidationIssue[]` from structural or semantic validation | No run is started; the issues are shown at their `path`; the displayed result (if any) is unchanged and judged by §7.4. |
| `SimulationResult` with `status: "failed"` | *error* |
| `SimulationResult` with `status: "ok"` and at least one `warning` diagnostic | *current with warnings* |
| `SimulationResult` with `status: "ok"` and no warning or error diagnostic | *current* |

## 7. requestId

### 7.1 Definition

```
requestId = "sha256:" + lowercase_hex( SHA-256( UTF-8( canonicalRequestPayload(request) ) ) )
```

- SHA-256 as specified in FIPS 180-4.
- `canonicalRequestPayload` is defined in §7.2 and implemented in `packages/contracts`.
- The payload covers **every request field except `requestId`**, including `schemaVersion`,
  `constants` (with `source`), `epoch` and maneuver `id`s. Reason: a result is a function of
  exactly those fields (events carry `maneuverId`, metadata carries the epoch and constants).
  Consequence: renaming a maneuver marks a displayed result stale.
- **Scope of "equal `requestId` ⇒ equal result".** It holds within one build, i.e. for the same
  `model.engineVersion` on the same platform (§4 rule 5, ARCH-005). A new engine build may give a
  different result for the same `requestId`. An in-memory cache may key on `requestId` alone; a
  cache that outlives the build keys on (`requestId`, `engineVersion`).

### 7.2 Canonical payload

Input: a request that passes `validateSimulationRequest`. Output: a string. The string is a
hash pre-image, not JSON.

1. Remove the `requestId` member.
2. No insignificant whitespace.
3. Objects as `{` members `}`, members separated by `,`, each member `"key":value`; members in
   ascending order of their keys compared as sequences of UTF-16 code units (JavaScript default
   `Array.prototype.sort` on strings), at every nesting level.
4. Arrays as `[` values `]`, separated by `,`, in their original order.
5. Strings (values and keys) as by `JSON.stringify`.
6. **Numbers (owner decision 8)** as the IEEE-754 binary64 bit pattern of the value: 16 lowercase
   hexadecimal digits, most significant first (sign bit, 11 exponent bits, 52 fraction bits),
   without quotes. +0 is `0000000000000000`, −0 is `8000000000000000`, 1 is `3ff0000000000000`.
   No decimal formatting is involved, so the payload does not depend on any number-to-string
   algorithm. Non-finite numbers are a precondition violation (`TypeError`). The encoding is
   exported as `binary64Hex`.

Within a valid request a number token can never be confused with another value: strings start
with `"`, objects with `{`, arrays with `[`, and the request contains no booleans or nulls.

Example (the test fixture, μ = 1, reference radius 0.5, placeholder values only):
`{"centralBody":"EARTH","constants":{"mu_m3ps2":3ff0000000000000,"referenceRadius_m":3fe0000000000000,"source":"placeholder"},"duration_s":408f400000000000,"dynamicsModel":"TWO_BODY","epoch":{"iso":"2030-01-02T03:04:05.678Z","scale":"UTC"},"frame":"GCRF","initialState":{"position_m":[3ff0000000000000,4000000000000000,4008000000000000],"velocity_mps":[4010000000000000,4014000000000000,4018000000000000]},"maneuvers":[{"deltaV_mps":[3ff0000000000000,4000000000000000,4008000000000000],"frame":"RSW","id":"m1","t_s":4059000000000000}],"outputStep_s":4024000000000000,"schemaVersion":"1.0"}`

### 7.3 Hashing — deferred to ML-TASK-017

The SHA-256 step is **not implemented in this task**. Decided (§11): ML-TASK-017 implements an
in-repo, synchronous SHA-256 in `packages/simulation`, tested against the FIPS 180-4 / NIST test
vectors transcribed from the primary source (not from memory), plus a differential test in
`verification/`. No platform crypto API is used below `apps/web`. Until then the contract fixes
only the format (`REQUEST_ID_PATTERN`).

### 7.4 Staleness (owner decision 6)

After ML-TASK-017, a displayed result is stale exactly when its `requestId` differs from the
`requestId` of the current scenario; `requestId` equality is the only staleness test.
`packages/simulation` exports the derivation scenario → `requestId` (element→Cartesian
conversion, constants and hash), so the UI computes no physics. Until ML-TASK-017 lands, the UI
uses a scenario revision counter; that is a UI concern outside this contract.

## 8. Code registry

Codes are stable identifiers (`SCREAMING_SNAKE_CASE`). A published code is never renamed, removed
or reused with another meaning; new codes may be added in a minor version (§9). Exported from the
package as `STRUCTURAL_VALIDATION_CODES`, `SEMANTIC_VALIDATION_CODES`, `RUNTIME_DIAGNOSTIC_CODES`
and their union `DIAGNOSTIC_CODES`. `DIAGNOSTIC_CODE_SEVERITY` maps every code to the only
severity a `Diagnostic` with that code may carry (R13): every validation code (§8.1, §8.2) is
`error`; runtime codes as in §8.3. `info` is reserved; no v1.0 code uses it.

### 8.1 Structural validation (emitted by `packages/contracts`)

| Code | Meaning |
|---|---|
| `SCHEMA_VERSION_UNSUPPORTED` | `schemaVersion` missing or not a version this build reads. |
| `TYPE_MISMATCH` | Wrong type, missing required field, wrong vector length or typed-array class. |
| `UNKNOWN_FIELD` | Field not defined by the schema version. |
| `NON_FINITE_NUMBER` | NaN or ±∞ where a number is expected. |
| `UNSUPPORTED_VALUE` | Value outside the closed set allowed by v1.0 (body, frame, scale, kind, model, code…). |
| `SCHEMA_VIOLATION` | Fallback for an unmapped schema issue; indicates a contract defect. |
| `ID_EMPTY` | Empty identifier. |
| `ID_DUPLICATE` | Two maneuvers share an id. |
| `EPOCH_INVALID` | Epoch string malformed or not a calendar instant. |
| `DURATION_NOT_POSITIVE` | `duration_s ≤ 0` (including −0). |
| `OUTPUT_STEP_NOT_POSITIVE` | `outputStep_s ≤ 0` (including −0). |
| `SEMI_MAJOR_AXIS_NOT_POSITIVE` | a ≤ 0. |
| `ECCENTRICITY_OUT_OF_RANGE` | e < 0 or e ≥ 1. |
| `INCLINATION_OUT_OF_RANGE` | i < 0 or i > π. |
| `ANGLE_OUT_OF_RANGE` | Ω, ω or ν outside [0, 2π). |
| `MANEUVER_COUNT_EXCEEDED` | More maneuvers than the M1 limit (1). |
| `MANEUVER_TIME_OUT_OF_RANGE` | Maneuver or event `t_s` outside [0, `duration_s`]. |
| `MU_NOT_POSITIVE` | μ ≤ 0. |
| `REFERENCE_RADIUS_NOT_POSITIVE` | Reference radius ≤ 0. |
| `REQUEST_ID_INVALID` | `requestId` not in the §7 format. |
| `ENGINE_VERSION_INVALID` | `engineVersion` not SemVer 2.0.0. |
| `MAGNITUDE_NEGATIVE` | Negative ‖Δv‖. |
| `SEGMENT_EMPTY` | Segment with no sample. |
| `TYPED_ARRAY_LENGTH_MISMATCH` | Position/velocity length ≠ 3N. |
| `SAMPLE_TIMES_NOT_INCREASING` | `t_s` not strictly increasing in a segment. |
| `SEGMENT_INDEX_MISMATCH` | `segments[n].index ≠ n`. |
| `SEGMENT_COUNT_MISMATCH` | `ok` result without k + 1 segments for k events. |
| `SEGMENT_BOUNDARY_MISMATCH` | Event time, position or velocity not bit-identical to the adjacent segment ends (R8). |
| `SEGMENT_TIME_SPAN_MISMATCH` | `ok` result not starting at 0 or not ending at `duration_s` (R10). |
| `VELOCITY_INCREMENT_MISMATCH` | `velocityAfter_mps ≠ velocityBefore_mps + deltaV_inertial_mps` bit-exactly (R12). |
| `TYPED_ARRAY_BUFFER_NOT_OWNED` | Typed array not the whole of its own `ArrayBuffer`, or sharing it (R11). |
| `DIAGNOSTIC_SEVERITY_MISMATCH` | Diagnostic severity differs from the registry severity of its code (R13). |
| `RESULT_STATUS_INCONSISTENT` | `status` contradicts diagnostics or content. |

### 8.2 Semantic validation (emitted by `packages/simulation`)

| Code | Severity | Meaning | Trace |
|---|---|---|---|
| `PERIGEE_BELOW_REFERENCE_RADIUS` | error | Input perigee radius a(1 − e) not above the reference radius. Returned as a `ValidationIssue` only. | ML-FR-002 AC2 |
| `SAMPLE_COUNT_EXCEEDED` | error | Sample count of the §5.2 grid above the limit fixed in Phase 2. Returned as a `ValidationIssue`; also the engine backstop diagnostic of a failed result (§6). | ML-NFR-004 |

### 8.3 Runtime diagnostics (emitted by the engine)

| Code | Severity | Meaning | Trace |
|---|---|---|---|
| `PROPAGATOR_NOT_CONVERGED` | error | Universal Kepler equation solve did not converge; `t_s` set. | ML-FR-004 AC6, ADR-005 |
| `NON_FINITE_STATE` | error | A computed state is non-finite; `t_s` set. | ML-FR-004 AC6, §4 rule 3 |
| `ESCAPE_TRAJECTORY` | warning | Post-maneuver conic is open (e ≥ 1); propagated anyway; `t_s` = maneuver time. | ML-FR-006 AC6, A.2 |
| `REFERENCE_SPHERE_INTERSECTION` | warning | Post-maneuver trajectory goes below the reference sphere; propagated anyway. | ML-FR-006 AC6, A.2 |
| `INTERNAL_ERROR` | error | Unexpected engine fault caught at the boundary (a defect, never a user condition). | §4 rule 3 |

The exact detection criteria (thresholds, analytic vs sampled detection) of the runtime codes are
engine behaviour owned by ML-TASK-016/017 and the tolerance record, not by this contract.

**Not registered: `RSW_FRAME_UNDEFINED`.** The RSW frame is undefined when r × v = 0. In v1.0 the
only maneuver is applied on the input orbit, which has a > 0 and 0 ≤ e < 1 and therefore non-zero
angular momentum, so the condition is not reachable by a valid v1.0 request. The code is to be
added, as §9 allows, in the minor version that lifts the one-maneuver limit (a later maneuver may
follow a maneuver that produced a rectilinear state).

## 9. Versioning policy

- **Contract version** = the `schemaVersion` string `"MAJOR.MINOR"`. This document is `1.0`.
- **Minor** (`1.x`): additive and backward-compatible for readers of the new version — new optional
  fields, new enum members, new diagnostic codes, lifting a v1.0 limit (e.g. more maneuvers).
  A file written as `1.0` stays valid `1.x` input. In a `1.1` reader the `schemaVersion` schema
  becomes a union of the known versions (`"1.0" | "1.1"`), not a single literal.
- **Major** (`2.0`): removing or renaming a field, changing a unit, frame, meaning or default.
- A reader accepts only the versions it knows. Older known versions are migrated forward by
  `packages/simulation/persistence` (architecture §2); newer or unknown versions are rejected with
  `SCHEMA_VERSION_UNSUPPORTED`, never partially read. Persistence also owns the canonical
  serialisation of the saved file and its size limit (ML-FR-011 AC3).
- Every contract change, minor or major, needs a new revision of this document and owner approval;
  a major change also needs an ADR.
- Future capabilities (ML-SYS-001 A.2) enter through the explicit fields that already exist:
  `centralBody`, `constants`, `frame`, `dynamicsModel`, `propagator`, `initialOrbit.kind`,
  `maneuvers` length. No v1.0 type assumes Earth, a closed orbit or a single body except through
  those fields (the closed-orbit rule is a v1.0 validation rule on `eccentricity`, not a type).

## 10. Deviations from architecture §4 (draft v0.2)

All accepted by the owner on 2026-11-11 (§11).

| # | Change | Reason |
|---|---|---|
| D-1 | `Diagnostic.code` is the closed registry `DiagnosticCode` instead of `string`. | The task requires a stable machine-readable code list; a closed enum makes an unregistered code a validation error instead of a silent typo. |
| D-2 | `SimulationResult.model` gains `centralBody`, `epoch` and `sampling { duration_s, outputStep_s }`. | ML-FR-012 AC1–AC2 require the panel to show central body and sampling configuration *from `SimulationResult.model`*; ARCH-004 requires output states to declare frame, central body and epoch; ML-SYS-001 A.2 requires the central body to be explicit. Additive. |
| D-3 | Structural invariants added to the result (R1–R9 in revision 1; R10–R13 added in revision 2). | Make §4's rules checkable by VI-01. |
| D-4 | `requestId` has a fixed format `sha256:<64 hex>` and covers all request fields except itself. | §4 says only "deterministic hash of the physical inputs"; covering non-physical fields (maneuver id, constants source) is required for "a result is identified by requestId" to hold. |
| D-5 | All objects reject unknown fields. | FR-011 AC2/AC3 (round-trip identity, typo detection). Can be relaxed in a minor version, not tightened. |
| D-6 | `SimulationRequest.mu_m3ps2` is replaced by `constants { mu_m3ps2, referenceRadius_m, source }` (revision 2). | The engine must output and use the reference radius and the source; owner decision 1. |

No field of §4 was given another unit or meaning; `mu_m3ps2` moved into `constants` (D-6).

## 11. Owner decisions, 2026-11-11

Decisions taken by the owner on the role reviews of PR #7 (Astrodynamics, Frontend, Verification
Engineers) and on the questions of revision 1.

| # | Decision | Where |
|---|---|---|
| 1 | `SimulationRequest` carries `constants { mu_m3ps2, referenceRadius_m, source }`, replacing top-level `mu_m3ps2`; the engine copies it into `result.model.constants`; it is part of the canonical payload; request↔result equality is a VI-01 check. | §4, §5.4, §7, D-6 |
| 2 | Normative sampling grid: t_j = fl(j × h) while t_j < D, plus D, plus maneuver times without duplicates; boundary times once in each adjacent segment; near-duplicates one ulp apart kept; "common time" = bit-identical; zero-Δv maneuver gives 1 event and 2 segments; the h ≥ D case stated. | §5.2, §3.1 |
| 3 | Semantic rejections are `ValidationIssue[]` with a `path`, from a synchronous function of `packages/simulation` run before a request exists; no `SimulationResult`. The engine may additionally guard the sample count and then returns a failed result with `SAMPLE_COUNT_EXCEEDED`. | §3, §6, §8.2 |
| 4 | Element→Cartesian uses the given elements with the regular map, no special-casing, no re-normalisation; degenerate conventions only for state→elements with thresholds from the tolerance record; equatorial = i ∈ {0, π}; no rotation formulas here (ML-TASK-013/014, cited source). | §3 |
| 5 | Maneuver boundary bit-exact and schema-enforced in v1.0 (positions, velocities, `velocityAfter` as one binary64 addition); `deltaV_magnitude_mps` is the norm of `deltaV_inertial_mps`, its value left to VT-13. | §5.3, §5.5 R8, R12 |
| 6 | After ML-TASK-017 `requestId` equality is the only staleness test and `packages/simulation` exports the id derivation; until then a UI revision counter. The worker protocol needs a per-job id distinct from `requestId`, outside the contract. | §7.4, §14 |
| 7 | Each typed array owns its own `ArrayBuffer`; a result is transferred, not copied; caches live on the receiving side; enforced by the result validator. | §5.2, R11 |
| 8 | The `requestId` pre-image encodes every number as its binary64 bit pattern, 16 lowercase hex digits. SHA-256 stays deferred to ML-TASK-017: in-repo, synchronous, tested against FIPS 180-4 vectors from the primary source. | §7.2, §7.3 |
| 9 | ML-UX-001 gains a fifth state "error" (requirements document, by the Coordinator). The contract documents the mapping from outcomes to states. | §6.2 |

Also accepted as proposed in revision 1:

| Item | Resolution |
|---|---|
| D-1 … D-5 | Accepted (§10). |
| OQ-1 Angles outside [0, 2π) in a saved file | Rejected (`ANGLE_OUT_OF_RANGE`); the stored form is canonical; the editor normalises before building the scenario. A normaliser using `x mod 2π` can return exactly 2π after rounding and must map it to 0. The Frontend's request for `degToRad` / `normalizeAngle_rad` helpers is **not** met in `packages/contracts` (it would put arithmetic in the contract package); they belong to a tested formatting module, to be assigned by the Coordinator (§12, NQ-3). |
| OQ-2 D-2 | Accepted. |
| OQ-3 Bit-exact boundary | Superseded by decision 5 (schema-enforced in v1.0). |
| OQ-4 Content of a failed result | No segments, no events, ≥ 1 error diagnostic; invalid input yields issues, not a result. A partial trajectory up to the failure may be added later as a minor version. |
| OQ-5 Hash | In-repo synchronous SHA-256 (decision 8); number encoding superseded by decision 8; hash covers non-physical fields (D-4). |
| OQ-6 Sample-count limit | A build constant of `packages/simulation`, recorded in `result.model.limitations`; engine backstop per decision 3. |
| OQ-7 Leap-second epochs | Not representable (`EPOCH_INVALID`), consistent with ADR-004. |
| OQ-8 `schemaVersion` on results | Not added; add only if results are ever persisted or exchanged across builds. |

## 12. Open questions for the owner

| # | Question | Implemented now | Recommendation |
|---|---|---|---|
| NQ-1 | −0 is accepted where a rule says `≥ 0` (angles, eccentricity, inclination, maneuver `t_s`, vector components). `JSON.stringify` writes −0 as `0`, but `JSON.parse("-0")` yields −0 (both checked on Node 24), so a hand-edited file can carry it, and it changes the `requestId` (decision 8). Should the request builder (ML-TASK-017) map −0 to +0 in inputs where the sign of zero has no physical meaning? | Accepted unchanged; the grid (§5.2) and R10 handle a maneuver at −0. | Leave the contract as is; let the request builder normalise −0 to +0 in every input field so equal-looking scenarios get equal ids. Decide in ML-TASK-017. |
| NQ-2 | `RSW_FRAME_UNDEFINED` (§8.3 note). | Not registered. | Register it in the minor version that lifts the one-maneuver limit. |
| NQ-3 | Who owns the degree/radian and angle-normalisation helpers requested by the Frontend review? | Not in contracts. | A tested formatting module in `apps/web` (or a small UI-free package), assigned by the Coordinator before ML-TASK-022. |

## 13. Verification hooks

- VT-18 (invalid input handling) uses the codes of §6.1 and §8, including the semantic function's
  issues and paths (§3).
- VI-01 (request → result structure) uses `validateSimulationResult` (R1–R13) and additionally
  checks against the request: `result.model.constants` bit-identical to `request.constants`;
  `model.sampling`, `model.epoch` equal to the request; sample times equal to the §5.2 grid;
  `events[n].maneuverId` and `t_s` equal to the maneuver's.
- VT-13 checks `deltaV_magnitude_mps` and the post-maneuver state within tolerance.
- VT-17 (serialisation round trip) relies on: no transforms, unknown fields rejected, canonical
  epoch text.
- The verification workspace may import `@mission-lab/contracts` (ADR-003, architecture §1).

## 14. Notes for consumers (non-normative)

- **Worker protocol.** Messages between UI and worker need a per-job id distinct from `requestId`
  (two jobs may carry the same request, e.g. a re-run). Defined by the worker protocol, not here.
- **Playback.** Playback never interpolates across segments. At a time equal to a maneuver time,
  the post-maneuver segment (segment n + 1) is displayed.
- **Maneuver ids.** Maneuver ids enter the `requestId`; the editor should generate them
  deterministically (e.g. from a counter persisted in the scenario) so that re-creating the same
  scenario gives the same id.
- **Messages.** `ValidationIssue.message` and `Diagnostic.message` are for logs; the UI maps
  `code` + `path` (or `code` + `t_s`) to its own wording.
- **Validation placement.** Full result validation runs in the worker before transfer; the main
  thread may do a cheap shape check only (§6, realm).
