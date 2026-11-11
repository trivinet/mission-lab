# Simulation Contracts v1.0

**Document ID:** ML-ARCH-003 · **Date:** 2026-11-11 · **Author:** Systems Architect (ML-TASK-004) · **Status:** Proposed — for review by the Astrodynamics, Frontend and Verification Engineers and approval by the owner

Normative prose for `packages/contracts` (`@mission-lab/contracts`). It refines the approved
draft contract v0.2 of [proposed-architecture.md §4](proposed-architecture.md#4-simulation-contract-draft-v02--replaces-the-illustrative-sample).
The zod schemas in `packages/contracts/src` are the single source of truth for the TypeScript
types (`z.infer`); this document gives the meaning those schemas cannot express. Where this
document and the schemas disagree, that is a defect to be reported, not resolved silently.

Deviations from §4 are listed in §10 and open questions in §11. Until the owner answers §11,
the implementation follows the most conservative reading stated there.

## 1. Scope

| Object | Role | Persisted | Versioned by |
|---|---|---|---|
| `Scenario` | Editable definition, the saved JSON file | yes | `schemaVersion` |
| `SimulationRequest` | What the engine receives: resolved, Cartesian, self-contained | no | `schemaVersion` |
| `SimulationResult` | Immutable output of one run | no | `requestId` + `model.engineVersion` |
| `TrajectorySegment`, `ManeuverEvent`, `Diagnostic` | Parts of a result | no | containing result |

Not in this contract: the physics (element↔Cartesian conversion, propagation, RSW transformation,
constants values), the worker message protocol, the file-size limit of ML-FR-011 AC3 (persistence
adapter), the sample-count limit value (ML-NFR-004, measured in Phase 2).

`packages/contracts` depends on `zod` only and imports no other workspace package (ADR-002,
architecture §1).

## 2. Conventions common to all objects

| Topic | Rule | Source |
|---|---|---|
| Units | SI only: m, m/s, s, rad, m³/s². No km, degrees or km/s anywhere in the contract. | Architecture §3, ML-SYS-001 §5.6 |
| Field names | A field holding a physical quantity ends with its unit suffix: `_m`, `_mps` (m/s), `_s`, `_rad`, `_m3ps2` (m³/s²). Dimensionless quantities (`eccentricity`) and non-physical fields carry no suffix. Enforced by a test over every field of the fixtures. | Architecture §3, AGENTS.md |
| Numbers | IEEE-754 binary64. Every number in every contract object is finite: NaN, +∞ and −∞ are rejected with `NON_FINITE_NUMBER`. | §4 rules ("Non-finite values are an error diagnostic, never a sample") |
| `Vec3` | `readonly [x, y, z]`, exactly three finite numbers. Its frame and unit are those of the field that holds it. Parsed tuples are frozen by zod (`.readonly()`); consumers copy before editing. | §4 |
| Inertial frame | `"GCRF"`: origin at Earth's centre of mass, axes aligned with the GCRF. The only inertial frame accepted or produced in v1.0. | ADR-004 |
| Local frame | `"RSW"`: R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R, evaluated with the pre-maneuver state. Used only for maneuver inputs. | Architecture §3 |
| Epoch | `{ scale: "UTC", iso }`, `iso` exactly `YYYY-MM-DDTHH:MM:SS.sssZ` (4-digit year, 3 fractional digits, literal `Z`) and an existing calendar instant. Second 60 is not representable (see §11 OQ-7). Appears only at the scenario/request boundary and in result metadata. | ADR-004, architecture §3 |
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
| `initialOrbit.elements.raan_rad` | number | rad | Ω, normalised: 0 ≤ Ω < 2π. `ANGLE_OUT_OF_RANGE`. |
| `initialOrbit.elements.argPeriapsis_rad` | number | rad | ω, normalised: 0 ≤ ω < 2π. `ANGLE_OUT_OF_RANGE`. |
| `initialOrbit.elements.trueAnomaly_rad` | number | rad | ν at the epoch, normalised: 0 ≤ ν < 2π. `ANGLE_OUT_OF_RANGE`. |
| `maneuvers` | `ImpulsiveManeuver[]` | — | Length ≤ 1 in v1.0 (`MANEUVER_COUNT_EXCEEDED`). Ids unique (`ID_DUPLICATE`). |
| `duration_s` | number | s | Propagated span from the epoch; > 0. `DURATION_NOT_POSITIVE`. |
| `outputStep_s` | number | s | Sampling interval; > 0. `OUTPUT_STEP_NOT_POSITIVE`. |

The angles are referred to the scenario `frame` with the degenerate-element conventions of
architecture §3 (circular: ω := 0; equatorial: Ω := 0; both: ν := true longitude). Interpreting
them is physics and lives in `packages/astrodynamics`.

**Semantic rule not checked here.** Perigee radius a(1 − e) must exceed the reference radius
(ML-FR-002 AC2). It needs a physical constant, so it is checked by `packages/simulation` and
reported as `PERIGEE_BELOW_REFERENCE_RADIUS`.

### 3.1 ImpulsiveManeuver

| Field | Type | Unit / frame | Meaning and rules |
|---|---|---|---|
| `id` | string, non-empty | — | Referenced by `ManeuverEvent.maneuverId`. |
| `t_s` | number | s from epoch | Application time; 0 ≤ `t_s` ≤ `duration_s` (both ends inclusive). `MANEUVER_TIME_OUT_OF_RANGE`. |
| `frame` | `"RSW"` | — | Frame of `deltaV_mps`. |
| `deltaV_mps` | `Vec3` | m/s, RSW | [ΔvR radial, ΔvS along-track, ΔvW cross-track]. Δv_inertial = ΔvR·R + ΔvS·S + ΔvW·W with the pre-maneuver state. Zero vector allowed. |

The maneuver is instantaneous: position unchanged, velocity incremented, no mass model.

## 4. SimulationRequest

Built by `packages/simulation` from a valid `Scenario` (element→Cartesian conversion, μ from the
constants module). The engine reads nothing else.

| Field | Type | Unit / frame | Meaning and rules |
|---|---|---|---|
| `requestId` | string | — | `sha256:` + 64 lowercase hex digits, defined in §7. `REQUEST_ID_INVALID`. |
| `schemaVersion` | `"1.0"` | — | As for Scenario. |
| `centralBody` | `"EARTH"` | — | |
| `mu_m3ps2` | number | m³/s² | Gravitational parameter used by the run; > 0 (`MU_NOT_POSITIVE`). Its value comes from `packages/astrodynamics` constants (architecture §3, to be confirmed by VT-19); the contract fixes no value. |
| `dynamicsModel` | `"TWO_BODY"` | — | Point-mass two-body. |
| `frame` | `"GCRF"` | — | Frame of `initialState` and of every output vector. |
| `epoch` | `Epoch` | UTC | Copied from the scenario. |
| `initialState.position_m` | `Vec3` | m, `frame` | Position at `t_s = 0`. |
| `initialState.velocity_mps` | `Vec3` | m/s, `frame` | Velocity at `t_s = 0`. |
| `maneuvers` | `ImpulsiveManeuver[]` | — | Same schema and rules as Scenario (≤ 1, time in range, unique ids). |
| `duration_s`, `outputStep_s` | number | s | As for Scenario. |

**Producer obligation.** The request builder normalises −0 to +0 in every numeric field, because
the canonical form (§7.2) cannot distinguish them.

## 5. SimulationResult

### 5.1 Top level

| Field | Type | Meaning |
|---|---|---|
| `requestId` | string (§7 format) | `requestId` of the request that produced it. A result is immutable and identified by it. |
| `model` | `ResultModel` (§5.4) | Everything ML-FR-012 displays. |
| `segments` | `TrajectorySegment[]` | k events → k + 1 segments, ordered by time. |
| `events` | `ManeuverEvent[]` | Applied maneuvers, ordered by time. |
| `diagnostics` | `Diagnostic[]` | All conditions found, in the order found. |
| `status` | `"ok"` \| `"failed"` | See invariants. |

### 5.2 TrajectorySegment (columnar)

A continuous arc between discontinuities. N ≥ 1 samples.

| Field | Type | Unit / frame | Layout |
|---|---|---|---|
| `index` | number | — | Equals the segment's position in `segments`. |
| `t_s` | `Float64Array`, length N | s from epoch | Strictly increasing. |
| `position_m` | `Float64Array`, length 3N | m, `model.frame` | `[x0, y0, z0, x1, y1, z1, …]`; sample k at `3k … 3k+2`. |
| `velocity_mps` | `Float64Array`, length 3N | m/s, `model.frame` | Same layout. |

Typed arrays are required (not plain arrays) so the worker can transfer their buffers. A segment is
not JSON-serialisable as is; CSV export (ML-FR-014) converts explicitly. Every element is finite.

Sampling (who decides which `t_s` appear) is engine behaviour, specified by ML-FR-004 AC4: samples
at t = k·`outputStep_s`, at `duration_s`, and at maneuver times. The contract checks only ordering.

### 5.3 ManeuverEvent and Diagnostic

| Field | Type | Unit / frame | Meaning |
|---|---|---|---|
| `maneuverId` | string, non-empty | — | `id` of the applied `ImpulsiveManeuver`. |
| `t_s` | number | s from epoch | Application time. |
| `position_m` | `Vec3` | m, `model.frame` | Position at `t_s` (unchanged by the maneuver). |
| `velocityBefore_mps`, `velocityAfter_mps` | `Vec3` | m/s, `model.frame` | Velocity immediately before / after. |
| `deltaV_inertial_mps` | `Vec3` | m/s, `model.frame` | The applied Δv expressed in the inertial frame. |
| `deltaV_magnitude_mps` | number ≥ 0 | m/s | ‖Δv‖. `MAGNITUDE_NEGATIVE`. |

| Diagnostic field | Type | Meaning |
|---|---|---|
| `severity` | `"info"` \| `"warning"` \| `"error"` | `error` ⇔ the run could not produce a trustworthy trajectory. |
| `code` | `DiagnosticCode` (§8) | Stable machine-readable code; unregistered codes are rejected (`UNSUPPORTED_VALUE`). |
| `message` | string | Human-readable English text; not stable, never parsed. |
| `t_s` | number, optional | Simulation time the condition refers to, when there is one. |

### 5.4 ResultModel

| Field | Type | Meaning |
|---|---|---|
| `engineVersion` | string | Semantic version (semver 2.0.0 syntax) of `packages/astrodynamics`. `ENGINE_VERSION_INVALID`. |
| `centralBody` | `"EARTH"` | *Added, see §10 D-2.* |
| `dynamicsModel` | `"TWO_BODY"` | |
| `propagator` | `"KEPLER_UNIVERSAL_VARIABLE"` | ADR-005. |
| `maneuverModel` | `"IMPULSIVE"` | |
| `frame` | `"GCRF"` | Frame of every vector in the result. |
| `epoch` | `Epoch` | *Added, see §10 D-2.* Epoch of `t_s = 0` for every `t_s` in the result. |
| `timeConvention` | string | Human-readable statement of the time convention (UTC epoch + elapsed SI seconds, no leap-second handling in labels). |
| `sampling.duration_s`, `sampling.outputStep_s` | number > 0 | *Added, see §10 D-2.* Sampling configuration of the run. |
| `constants.mu_m3ps2` | number > 0 | μ used. |
| `constants.referenceRadius_m` | number > 0 | Reference sphere radius used for altitude display and the intersection flag. `REFERENCE_RADIUS_NOT_POSITIVE`. |
| `constants.source` | string | Citation of the constants' source. |
| `limitations` | string[] | Model limitations shown by ML-FR-012 (ML-SYS-001 §5.7). |

### 5.5 Result invariants (checked by `validateSimulationResult`)

| # | Invariant | Code | Trace |
|---|---|---|---|
| R1 | `segments[n].index === n` | `SEGMENT_INDEX_MISMATCH` | §4 |
| R2 | Each segment has N ≥ 1 samples | `SEGMENT_EMPTY` | §4, ML-FR-005 AC2 (maneuver at 0 or at `duration_s` yields a one-sample segment) |
| R3 | `position_m.length === velocity_mps.length === 3 · t_s.length` | `TYPED_ARRAY_LENGTH_MISMATCH` | §4 (N, 3N) |
| R4 | `t_s`, `position_m`, `velocity_mps` are `Float64Array` | `TYPE_MISMATCH` | §4, architecture §5 (transfer) |
| R5 | Every typed-array element finite (first offender reported) | `NON_FINITE_NUMBER` | §4 rules |
| R6 | `t_s` strictly increasing within a segment (first offender reported) | `SAMPLE_TIMES_NOT_INCREASING` | ML-FR-004 AC4, ML-FR-008 AC3 |
| R7 | `status: "ok"` ⇒ no `error` diagnostic and `segments.length === events.length + 1` | `RESULT_STATUS_INCONSISTENT`, `SEGMENT_COUNT_MISMATCH` | §4 ("k maneuvers → k+1 segments") |
| R8 | `status: "ok"` ⇒ for each n, last `t_s` of segment n = `events[n].t_s` = first `t_s` of segment n+1 (exact equality) | `SEGMENT_BOUNDARY_MISMATCH` | §4 rule 1, ML-FR-006 AC3 |
| R9 | `status: "failed"` ⇒ ≥ 1 `error` diagnostic, `segments` and `events` empty | `RESULT_STATUS_INCONSISTENT` | §4 rule 3; see §11 OQ-4 |

Engine invariants **not** checked by the schema (verified numerically, VT-13): at each boundary the
last position of segment n and the first position of segment n+1 equal `events[n].position_m`;
their velocities equal `velocityBefore_mps` and `velocityAfter_mps`; `velocityAfter − velocityBefore`
= `deltaV_inertial_mps`. See §11 OQ-3.

## 6. Validation API and error behaviour

```ts
validateScenario(input: unknown): ValidationResult<Scenario>
validateSimulationRequest(input: unknown): ValidationResult<SimulationRequest>
validateSimulationResult(input: unknown): ValidationResult<SimulationResult>
type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
interface ValidationIssue { code: ValidationCode; path: (string | number)[]; message: string }
```

- The validators never throw for any input value; every rejection is an issue.
- `path` locates the field from the validated root (e.g. `["maneuvers", 0, "t_s"]`), so the UI can
  show a field-level message (ML-FR-002 AC2).
- For `Scenario` and `SimulationRequest`, an object whose `schemaVersion` is not `"1.0"` (or is
  missing) yields exactly one issue, `SCHEMA_VERSION_UNSUPPORTED`, and nothing else is checked.
- Otherwise all independent violations are reported. Cross-field rules (maneuver time ≤
  `duration_s`, duplicate ids, result invariants R1, R7–R9) run only when there is no type error in
  the object.
- The `value` returned is a new object (typed arrays are the same instances, not copies); nothing
  is stripped (unknown fields are rejected) and nothing is transformed (no defaults, no coercion,
  no angle normalisation).
- Validation is structural only. Rules needing constants or measured limits
  (`PERIGEE_BELOW_REFERENCE_RADIUS`, `SAMPLE_COUNT_EXCEEDED`) belong to `packages/simulation`, which
  reports them with the same `ValidationIssue` shape.

**Engine boundary.** The engine never throws for user-reachable conditions; it returns
`status: "failed"` with diagnostics (§4 rule 3). User input reaches the engine only through a
`Scenario`, which is validated first; the `SimulationRequest` is machine-built. Therefore a
structurally invalid request is a programming error of the caller, reported by
`validateSimulationRequest`, and does not produce a `SimulationResult` (whose `model` could not be
filled). Semantic rejections and numerical failures do produce a failed result. See §11 OQ-4.

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
| 0 ≤ Ω, ω, ν < 2π | Scenario | `ANGLE_OUT_OF_RANGE` | ML-FR-002 AC2 (see §11 OQ-1) |
| `maneuvers.length ≤ 1` | Scenario, Request | `MANEUVER_COUNT_EXCEEDED` | ML-FR-005 AC2, review F-04 |
| 0 ≤ maneuver `t_s` ≤ `duration_s` | Scenario, Request | `MANEUVER_TIME_OUT_OF_RANGE` | ML-FR-005 AC2 |
| μ > 0 | Request, Result | `MU_NOT_POSITIVE` | ML-SYS-001 §5.1 (attracting point mass) |
| reference radius > 0 | Result | `REFERENCE_RADIUS_NOT_POSITIVE` | Architecture §3 |
| `requestId` format | Request, Result | `REQUEST_ID_INVALID` | §7 |
| `engineVersion` is semver | Result | `ENGINE_VERSION_INVALID` | §4 ("semver of packages/astrodynamics") |
| ‖Δv‖ ≥ 0 | Result | `MAGNITUDE_NEGATIVE` | Definition of a norm |
| R1–R9 | Result | §5.5 | §5.5 |
| Any other zod issue (should not occur) | all | `SCHEMA_VIOLATION` | Fallback; its appearance is a contract defect |

## 7. requestId

### 7.1 Definition

```
requestId = "sha256:" + lowercase_hex( SHA-256( UTF-8( canonicalRequestPayload(request) ) ) )
```

- SHA-256 as specified in FIPS 180-4.
- `canonicalRequestPayload` is defined in §7.2 and implemented in `packages/contracts`
  (`canonicalRequestPayload`).
- The payload covers **every request field except `requestId`**, including `schemaVersion`,
  `epoch` and maneuver `id`s. Reason: a result is a pure function of exactly those fields (events
  carry `maneuverId`, metadata carries the epoch), so equal `requestId` ⇒ equal result content.
  Consequence: renaming a maneuver marks a displayed result stale.
- Equal requests on the same platform give bit-identical results (§4 rule 5, ARCH-005), so the
  `requestId` is also a cache key.

### 7.2 Canonical payload

Input: a request that passes `validateSimulationRequest`. Output: a string.

1. Remove the `requestId` member.
2. Serialise as JSON with no insignificant whitespace.
3. Object members in ascending order of their keys compared as sequences of UTF-16 code units
   (JavaScript default `Array.prototype.sort` on strings), at every nesting level.
4. Arrays in their original order.
5. Strings as by `JSON.stringify`.
6. Numbers as by `JSON.stringify`, i.e. ECMAScript Number::toString (shortest round-trip decimal;
   `1e+21`, `1e-7`; −0 is written `0`). Non-finite numbers are a precondition violation
   (`TypeError`).

Example (the test fixture):
`{"centralBody":"EARTH","duration_s":1000,"dynamicsModel":"TWO_BODY","epoch":{"iso":"2030-01-02T03:04:05.678Z","scale":"UTC"},"frame":"GCRF","initialState":{"position_m":[1,2,3],"velocity_mps":[4,5,6]},"maneuvers":[{"deltaV_mps":[1,2,3],"frame":"RSW","id":"m1","t_s":100}],"mu_m3ps2":1,"outputStep_s":10,"schemaVersion":"1.0"}`

### 7.3 Hashing — deferred to ML-TASK-017

The SHA-256 step is **not implemented in this task**. It needs either the platform Web Crypto API
(`crypto.subtle.digest`, asynchronous, a platform API not yet approved below `apps/web`) or an
in-repo SHA-256 implementation verified against the FIPS 180-4 / NIST CAVP test vectors, which
must be transcribed from the primary source, not written from memory. ML-TASK-017 (request
builder) implements it; the choice between the two is an open question (§11 OQ-5). Until then the
contract fixes only the format (`REQUEST_ID_PATTERN`).

## 8. Code registry

Codes are stable identifiers (`SCREAMING_SNAKE_CASE`). A published code is never renamed, removed
or reused with another meaning; new codes may be added in a minor version (§9). Exported from the
package as `STRUCTURAL_VALIDATION_CODES`, `SEMANTIC_VALIDATION_CODES`, `RUNTIME_DIAGNOSTIC_CODES`
and their union `DIAGNOSTIC_CODES`. When a validation issue is reported as a `Diagnostic`, its
severity is `error`.

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
| `DURATION_NOT_POSITIVE` | `duration_s ≤ 0`. |
| `OUTPUT_STEP_NOT_POSITIVE` | `outputStep_s ≤ 0`. |
| `SEMI_MAJOR_AXIS_NOT_POSITIVE` | a ≤ 0. |
| `ECCENTRICITY_OUT_OF_RANGE` | e < 0 or e ≥ 1. |
| `INCLINATION_OUT_OF_RANGE` | i < 0 or i > π. |
| `ANGLE_OUT_OF_RANGE` | Ω, ω or ν outside [0, 2π). |
| `MANEUVER_COUNT_EXCEEDED` | More maneuvers than the M1 limit (1). |
| `MANEUVER_TIME_OUT_OF_RANGE` | Maneuver `t_s` outside [0, `duration_s`]. |
| `MU_NOT_POSITIVE` | μ ≤ 0. |
| `REFERENCE_RADIUS_NOT_POSITIVE` | Reference radius ≤ 0. |
| `REQUEST_ID_INVALID` | `requestId` not in the §7 format. |
| `ENGINE_VERSION_INVALID` | `engineVersion` not semver. |
| `MAGNITUDE_NEGATIVE` | Negative ‖Δv‖. |
| `SEGMENT_EMPTY` | Segment with no sample. |
| `TYPED_ARRAY_LENGTH_MISMATCH` | Position/velocity length ≠ 3N. |
| `SAMPLE_TIMES_NOT_INCREASING` | `t_s` not strictly increasing in a segment. |
| `SEGMENT_INDEX_MISMATCH` | `segments[n].index ≠ n`. |
| `SEGMENT_COUNT_MISMATCH` | `ok` result without k + 1 segments for k events. |
| `SEGMENT_BOUNDARY_MISMATCH` | Event time not shared by the adjacent segment ends. |
| `RESULT_STATUS_INCONSISTENT` | `status` contradicts diagnostics or content. |

### 8.2 Semantic validation (emitted by `packages/simulation`)

| Code | Severity | Meaning | Trace |
|---|---|---|---|
| `PERIGEE_BELOW_REFERENCE_RADIUS` | error | Input perigee radius a(1 − e) not above the reference radius. | ML-FR-002 AC2 |
| `SAMPLE_COUNT_EXCEEDED` | error | Requested sample count above the limit fixed in Phase 2. | ML-NFR-004 |

### 8.3 Runtime diagnostics (emitted by the engine)

| Code | Severity | Meaning | Trace |
|---|---|---|---|
| `PROPAGATOR_NOT_CONVERGED` | error | Universal Kepler equation solve did not converge; `t_s` set. | ML-FR-004 AC6, ADR-005 |
| `NON_FINITE_STATE` | error | A computed state is non-finite; `t_s` set. | ML-FR-004 AC6, §4 rule 3 |
| `ESCAPE_TRAJECTORY` | warning | Post-maneuver conic is open (e ≥ 1); propagated anyway; `t_s` = maneuver time. | ML-FR-006 AC6, A.2 |
| `REFERENCE_SPHERE_INTERSECTION` | warning | Post-maneuver trajectory goes below the reference sphere; propagated anyway. | ML-FR-006 AC6, A.2 |
| `INTERNAL_ERROR` | error | Unexpected engine fault caught at the boundary (a defect, never a user condition). | §4 rule 3 |

The exact detection criteria (thresholds, which samples) of the runtime codes are engine
behaviour owned by ML-TASK-016/017 and the tolerance record, not by this contract.

## 9. Versioning policy

- **Contract version** = the `schemaVersion` string `"MAJOR.MINOR"`. This document is `1.0`.
- **Minor** (`1.x`): additive and backward-compatible for readers of the new version — new optional
  fields, new enum members, new diagnostic codes, lifting a v1.0 limit (e.g. more maneuvers).
  A file written as `1.0` stays valid `1.x` input.
- **Major** (`2.0`): removing or renaming a field, changing a unit, frame, meaning or default.
- A reader accepts only the versions it knows. Older known versions are migrated forward by
  `packages/simulation/persistence` (architecture §2); newer or unknown versions are rejected with
  `SCHEMA_VERSION_UNSUPPORTED`, never partially read.
- Every contract change, minor or major, needs a new revision of this document and owner approval;
  a major change also needs an ADR.
- Future capabilities (ML-SYS-001 A.2) enter through the explicit fields that already exist:
  `centralBody`, `mu_m3ps2`, `frame`, `dynamicsModel`, `propagator`, `initialOrbit.kind`,
  `maneuvers` length. No v1.0 type assumes Earth, a closed orbit or a single body except through
  those fields (the closed-orbit rule is a v1.0 validation rule on `eccentricity`, not a type).

## 10. Deviations from architecture §4 (draft v0.2)

| # | Change | Reason |
|---|---|---|
| D-1 | `Diagnostic.code` is the closed registry `DiagnosticCode` instead of `string`. | The task requires a stable machine-readable code list; a closed enum makes an unregistered code a validation error instead of a silent typo. |
| D-2 | `SimulationResult.model` gains `centralBody`, `epoch` and `sampling { duration_s, outputStep_s }`. | ML-FR-012 AC1–AC2 require the panel to show central body and sampling configuration *from `SimulationResult.model`*; ARCH-004 requires output states to declare frame, central body and epoch; ML-SYS-001 A.2 requires the central body to be explicit. §4 as drafted cannot satisfy these. Additive. **Owner question OQ-2.** |
| D-3 | Structural invariants R1–R9 (§5.5) added to the result. | Make §4's rules ("k maneuvers → k+1 segments", shared boundary time, N/3N layout, non-finite never a sample) checkable by VI-01. |
| D-4 | `requestId` has a fixed format `sha256:<64 hex>` and covers all request fields except itself. | §4 says only "deterministic hash of the physical inputs"; the task asks for a precise definition. Covering non-physical fields (maneuver id) is required for "a result is identified by requestId" to hold. **Owner question OQ-5.** |
| D-5 | All objects reject unknown fields. | §4 is silent; FR-011 AC2/AC3 need it (round-trip identity, typo detection). Conservative; can be relaxed in a minor version, not tightened. |

No field of §4 was removed, renamed or given another unit or meaning.

## 11. Open questions for the owner

Each states the conservative behaviour implemented now and a recommendation.

| # | Question | Implemented now | Recommendation |
|---|---|---|---|
| OQ-1 | ML-FR-002 AC2 says Ω, ω, ν "are normalised to [0°, 360°)". Is a saved file with an angle outside [0, 2π) rejected, or normalised on load? | Rejected (`ANGLE_OUT_OF_RANGE`); the stored form is canonical; normalisation is done by the editor before it builds the scenario. Stricter, can be relaxed later. | Keep. Note for ML-TASK-022: a normaliser using `x mod 2π` can return exactly 2π after rounding and must map it to 0. |
| OQ-2 | Accept D-2 (`centralBody`, `epoch`, `sampling` in `result.model`)? | Implemented as required fields. | Accept; without it ML-FR-012 AC2 cannot be met. |
| OQ-3 | §4 says boundary samples "share t_s and position". Must position equality be bit-exact (schema-enforced) or within tolerance (VT-13)? | `t_s` equality is exact and schema-enforced; position equality is left to VT-13. | Engine copies the boundary position bit-for-bit (ML-TASK-016/017); add schema enforcement in v1.1 once the engine does so. |
| OQ-4 | What does a `failed` result contain, and must a structurally invalid request yield a result? | Failed ⇒ no segments, no events, ≥ 1 error diagnostic. A structurally invalid request yields validation issues, not a result (§6). | Keep for M1; a partial trajectory up to the failure can be added later as a minor version. |
| OQ-5 | `requestId` hash: SHA-256 via Web Crypto (async platform API below `apps/web`) or an in-repo implementation verified against NIST vectors? Also confirm that the hash covers non-physical fields (D-4). | Format fixed, canonical payload implemented, hash not implemented. | In-repo synchronous SHA-256 in `packages/simulation`, tested against NIST CAVP vectors supplied from the primary source; keeps the engine synchronous and free of platform APIs. |
| OQ-6 | ML-NFR-004 sample-count limit: the request has no explicit limit field, so the limit is a build constant of `packages/simulation`. | Code `SAMPLE_COUNT_EXCEEDED` reserved; no check here. | Keep as a build constant; record it in `result.model.limitations`. |
| OQ-7 | Epochs at a leap second (`…:60.000Z`) cannot be entered. | Rejected (`EPOCH_INVALID`). | Accept; consistent with ADR-004 (no leap-second handling). |
| OQ-8 | `SimulationResult` has no `schemaVersion` (ARCH-006 "where appropriate"). It is not persisted and is tied to its request by `requestId`. | Not added. | Add only if results are ever persisted or exchanged across builds (e.g. CSV/JSON result export beyond ML-FR-014). |

## 12. Verification hooks

- VT-18 (invalid input handling) uses the codes of §6.1 and §8.
- VI-01 (request → result structure) uses `validateSimulationResult` and invariants R1–R9.
- VT-17 (serialisation round trip) relies on: no transforms, unknown fields rejected, canonical
  epoch text.
- The verification workspace may import `@mission-lab/contracts` (ADR-003, architecture §1).
