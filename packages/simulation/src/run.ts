/**
 * The simulation runner: SimulationRequest → SimulationResult (contracts-v1 §4–§6, §8.3;
 * ADR-005; ML-FR-004, ML-FR-006, ML-FR-012).
 *
 * Pure and deterministic: no clock, no randomness, no I/O (ML-NFR-003). Units SI; every vector in
 * the result is in the request frame (GCRF).
 */
import {
  applyImpulsiveManeuver,
  classifyEscape,
  detectReferenceSphereIntersection,
  propagateKeplerUniversal,
} from '@mission-lab/astrodynamics';
import type { KeplerPropagationFailure, Vec3 } from '@mission-lab/astrodynamics';
import {
  DIAGNOSTIC_CODE_SEVERITY,
  validateSimulationRequest,
  validateSimulationResult,
} from '@mission-lab/contracts';
import type {
  Diagnostic,
  DiagnosticCode,
  ImpulsiveManeuver,
  ManeuverEvent,
  SimulationRequest,
  SimulationResult,
  TrajectorySegment,
  ValidationResult,
} from '@mission-lab/contracts';
import { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
import { buildResultModel } from './model';
import { buildSamplingGrid, sampleCount } from './sampling-grid';

/** Builds a diagnostic with the registry severity of its code (R13). */
function diagnostic(code: DiagnosticCode, message: string, t_s?: number): Diagnostic {
  const base = { severity: DIAGNOSTIC_CODE_SEVERITY[code], code, message };
  return t_s === undefined ? base : { ...base, t_s };
}

/** Raised inside a run to stop it with an error diagnostic; caught in runSimulation. */
class RunFailure extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message);
  }
}

function propagationDiagnostic(
  reason: KeplerPropagationFailure,
  t_s: number,
  context: string,
): Diagnostic {
  switch (reason) {
    case 'NOT_CONVERGED':
      return diagnostic(
        'PROPAGATOR_NOT_CONVERGED',
        `${context}: universal Kepler equation did not converge.`,
        t_s,
      );
    case 'NON_FINITE_STATE':
      return diagnostic('NON_FINITE_STATE', `${context}: computed state is not finite.`, t_s);
    case 'INVALID_INPUT':
      return diagnostic('INTERNAL_ERROR', `${context}: propagator rejected its input.`, t_s);
    case 'RECTILINEAR_COLLISION':
      // Callers use collisionDiagnostic, which knows the collision time; kept for exhaustiveness.
      return collisionDiagnostic(t_s, context);
  }
}

/**
 * A rectilinear trajectory that reaches the centre of the central body (propagator failure
 * 'RECTILINEAR_COLLISION', ML-TASK-019). The contract registers no dedicated code; owner decision
 * 2026-11-14 with §11.4 P4/P5: mapped to NON_FINITE_STATE (the state at r = 0 is singular), with
 * t_s = the computed time of the passage through the centre (s from epoch).
 */
function collisionDiagnostic(collision_t_s: number, context: string): Diagnostic {
  return diagnostic(
    'NON_FINITE_STATE',
    `${context}: the trajectory is rectilinear (position x velocity = 0) and reaches the centre ` +
      `of the central body (r = 0) at t_s ≈ ${collision_t_s.toPrecision(9)} s, where the state ` +
      `is singular; the run cannot continue past it.`,
    collision_t_s,
  );
}

/** Copies a Vec3 into a new tuple (no aliasing of frozen request tuples). */
function copyVec3(v: Vec3): [number, number, number] {
  return [v[0], v[1], v[2]];
}

/** The maneuvers in event order: increasing t_s, stable for equal times (contracts-v1 §5.1). */
function maneuversInTimeOrder(maneuvers: readonly ImpulsiveManeuver[]): ImpulsiveManeuver[] {
  return maneuvers
    .map((maneuver, index) => ({ maneuver, index }))
    .sort((a, b) => a.maneuver.t_s - b.maneuver.t_s || a.index - b.index)
    .map((entry) => entry.maneuver);
}

interface RunOutput {
  readonly segments: TrajectorySegment[];
  readonly events: ManeuverEvent[];
}

/**
 * The segments and events of a valid request. Appends warnings to `diagnostics`; throws
 * RunFailure for a numerical failure (never for anything else intentionally).
 */
function propagateRequest(request: SimulationRequest, diagnostics: Diagnostic[]): RunOutput {
  const { mu_m3ps2, referenceRadius_m } = request.constants;
  const maneuvers = maneuversInTimeOrder(request.maneuvers);
  const grid = buildSamplingGrid(
    request.duration_s,
    request.outputStep_s,
    maneuvers.map((m) => m.t_s),
  );
  const segments: TrajectorySegment[] = [];
  const events: ManeuverEvent[] = [];

  // Initial state of the current segment (copied; contracts-v1 §5.2 revision 3).
  let r0: Vec3 = copyVec3(request.initialState.position_m);
  let v0: Vec3 = copyVec3(request.initialState.velocity_mps);

  grid.forEach((segmentGrid, n) => {
    const times = segmentGrid.times_s;
    const count = times.length;
    // Each array owns its own ArrayBuffer (R11).
    const t_s = new Float64Array(count);
    const position_m = new Float64Array(3 * count);
    const velocity_mps = new Float64Array(3 * count);
    let last: { r: Vec3; v: Vec3 } = { r: r0, v: v0 };
    times.forEach((t, k) => {
      let r: Vec3;
      let v: Vec3;
      if (k === 0) {
        // First sample: a copy of the segment's initial state, not an evaluation at Δt = 0.
        r = r0;
        v = v0;
      } else {
        // Every other sample independently from the segment's initial state (ADR-005).
        const deltaT_s = t - segmentGrid.start_s;
        const result = propagateKeplerUniversal(mu_m3ps2, r0, v0, deltaT_s);
        if (!result.ok && result.reason === 'RECTILINEAR_COLLISION') {
          throw new RunFailure(
            collisionDiagnostic(
              segmentGrid.start_s + result.collisionDeltaT_s,
              `Segment ${String(n)}, sample at t_s = ${String(t)}`,
            ),
          );
        }
        if (!result.ok) {
          throw new RunFailure(
            propagationDiagnostic(
              result.reason,
              t,
              `Segment ${String(n)}, sample at t_s = ${String(t)}`,
            ),
          );
        }
        r = result.position_m;
        v = result.velocity_mps;
      }
      t_s[k] = t;
      position_m.set(r, 3 * k);
      velocity_mps.set(v, 3 * k);
      last = { r, v };
    });
    segments.push({ index: n, t_s, position_m, velocity_mps });

    const maneuver = maneuvers[n];
    if (maneuver === undefined) {
      return;
    }
    // Pre-maneuver state = last sample of segment n (same values as stored).
    const applied = applyImpulsiveManeuver(last.r, last.v, maneuver.deltaV_mps);
    if (!applied.ok) {
      const code: DiagnosticCode =
        applied.reason === 'NON_FINITE_RESULT' ? 'NON_FINITE_STATE' : 'INTERNAL_ERROR';
      throw new RunFailure(
        diagnostic(
          code,
          `Maneuver ${maneuver.id} could not be applied (${applied.reason}).`,
          maneuver.t_s,
        ),
      );
    }
    const m = applied.maneuver;
    events.push({
      maneuverId: maneuver.id,
      t_s: maneuver.t_s,
      position_m: copyVec3(m.position_m),
      velocityBefore_mps: copyVec3(m.velocityBefore_mps),
      deltaV_inertial_mps: copyVec3(m.deltaV_inertial_mps),
      velocityAfter_mps: copyVec3(m.velocityAfter_mps),
      deltaV_magnitude_mps: m.deltaV_magnitude_mps,
    });
    // Next segment starts from position + velocityAfter, bit-identical (R8).
    r0 = copyVec3(m.position_m);
    v0 = copyVec3(m.velocityAfter_mps);

    // Post-maneuver flags (contracts-v1 §8.3, §11.3 D1–D8). t_s of both = maneuver time.
    const escape = classifyEscape(r0, v0, mu_m3ps2);
    if (!escape.ok) {
      const code: DiagnosticCode =
        escape.reason === 'NON_FINITE_RESULT' ? 'NON_FINITE_STATE' : 'INTERNAL_ERROR';
      throw new RunFailure(
        diagnostic(code, `Escape classification failed (${escape.reason}).`, maneuver.t_s),
      );
    }
    if (escape.classification.escape) {
      diagnostics.push(
        diagnostic(
          'ESCAPE_TRAJECTORY',
          `Post-maneuver trajectory is not bound (regime ${escape.classification.regime}, ` +
            `specific energy ${String(escape.classification.specificEnergy_m2ps2)} m^2/s^2).`,
          maneuver.t_s,
        ),
      );
    }
    // Span = the Δt of the post-maneuver segment's last sample (D3; trajectory-flags.ts).
    const nextGrid = grid[n + 1];
    const span_s = (nextGrid?.times_s.at(-1) ?? request.duration_s) - maneuver.t_s;
    const intersection = detectReferenceSphereIntersection(
      r0,
      v0,
      mu_m3ps2,
      referenceRadius_m,
      span_s,
    );
    if (!intersection.ok) {
      // D8: a failure of the check is a failure of the run, never "no intersection".
      if (
        intersection.reason === 'PROPAGATION_FAILED' &&
        intersection.propagationFailure === 'RECTILINEAR_COLLISION' &&
        intersection.collisionDeltaT_s !== undefined
      ) {
        throw new RunFailure(
          collisionDiagnostic(
            maneuver.t_s + intersection.collisionDeltaT_s,
            `Post-maneuver trajectory (maneuver ${maneuver.id})`,
          ),
        );
      }
      if (
        intersection.reason === 'PROPAGATION_FAILED' &&
        intersection.propagationFailure !== null
      ) {
        throw new RunFailure(
          propagationDiagnostic(
            intersection.propagationFailure,
            maneuver.t_s,
            'Reference-sphere intersection check',
          ),
        );
      }
      const code: DiagnosticCode =
        intersection.reason === 'NON_FINITE_RESULT' ? 'NON_FINITE_STATE' : 'INTERNAL_ERROR';
      throw new RunFailure(
        diagnostic(
          code,
          `Reference-sphere intersection check failed (${intersection.reason}).`,
          maneuver.t_s,
        ),
      );
    }
    if (intersection.intersection.intersects) {
      diagnostics.push(
        diagnostic(
          'REFERENCE_SPHERE_INTERSECTION',
          `Post-maneuver trajectory reaches the reference sphere within the simulated span ` +
            `(${String(intersection.intersection.reason)}; periapsis radius ` +
            `${String(intersection.intersection.periapsisRadius_m)} m).`,
          maneuver.t_s,
        ),
      );
    }
  });
  return { segments, events };
}

function failedResult(request: SimulationRequest, diagnostics: Diagnostic[]): SimulationResult {
  return {
    requestId: request.requestId,
    model: buildResultModel(request),
    segments: [],
    events: [],
    diagnostics,
    status: 'failed',
  };
}

/** Result of a valid request; never throws. */
function runValidRequest(request: SimulationRequest): SimulationResult {
  const diagnostics: Diagnostic[] = [];
  try {
    // Engine backstop for requests built without the semantic check (contracts-v1 §6).
    const count = sampleCount(
      request.duration_s,
      request.outputStep_s,
      request.maneuvers.map((m) => m.t_s),
    );
    if (count > PROVISIONAL_MAX_SAMPLE_COUNT) {
      return failedResult(request, [
        diagnostic(
          'SAMPLE_COUNT_EXCEEDED',
          `The run would produce ${String(count)} samples; the limit is ${String(PROVISIONAL_MAX_SAMPLE_COUNT)}.`,
        ),
      ]);
    }
    const { segments, events } = propagateRequest(request, diagnostics);
    return {
      requestId: request.requestId,
      model: buildResultModel(request),
      segments,
      events,
      diagnostics,
      status: 'ok',
    };
  } catch (error: unknown) {
    if (error instanceof RunFailure) {
      return failedResult(request, [...diagnostics, error.diagnostic]);
    }
    const detail = error instanceof Error ? error.message : String(error);
    return failedResult(request, [
      ...diagnostics,
      diagnostic('INTERNAL_ERROR', `Unexpected engine fault: ${detail}`),
    ]);
  }
}

/**
 * Runs a simulation request (contracts-v1 §4–§6).
 *
 * @param input A SimulationRequest (validated here with `validateSimulationRequest`).
 * @returns
 * - `{ ok: false, issues }` if the input is not a structurally valid request: invalid input never
 *   produces a SimulationResult (contracts-v1 §6 "Engine boundary").
 * - `{ ok: true, value }` otherwise: a SimulationResult with `status: "ok"`, or `status: "failed"`
 *   with no segments, no events and at least one error diagnostic for a condition found while
 *   running (PROPAGATOR_NOT_CONVERGED, NON_FINITE_STATE, the SAMPLE_COUNT_EXCEEDED backstop,
 *   INTERNAL_ERROR). Warnings found before a failure are kept, in the order found.
 *   A rectilinear trajectory (position x velocity = 0 exactly) that reaches the centre of the
 *   central body within its segment is a failed run with NON_FINITE_STATE at the computed time of
 *   that passage (ML-TASK-019; propagator reason RECTILINEAR_COLLISION). After a maneuver it is
 *   found by the reference-sphere intersection check (its span covers every sample of the
 *   segment), so no REFERENCE_SPHERE_INTERSECTION warning for that maneuver precedes it; an
 *   ESCAPE_TRAJECTORY warning for it (incoming motion that is not bound) is kept before it.
 *   Never throws for JSON-like input.
 *
 * Behaviour (contracts-v1 §5.2): sample times from the normative grid (sampling-grid.ts);
 * segment 0 starts from request.initialState; each sample other than a segment's first is
 * propagateKeplerUniversal(μ, r_n, v_n, t − b_n) from the segment's initial state (r_n, v_n) and
 * start b_n (no chaining); the first sample of each segment is a copy of its initial state. At
 * maneuver time m: the pre-maneuver state is the last sample of segment n, the maneuver is
 * applyImpulsiveManeuver (packages/astrodynamics), the ManeuverEvent copies its fields, and segment
 * n + 1 starts from (position_m, velocityAfter_mps). After each maneuver the post-maneuver state is
 * classified with classifyEscape and detectReferenceSphereIntersection (span = the Δt of that
 * segment's last sample); both warnings carry t_s = the maneuver time (proposal, see the
 * ML-TASK-017 report). Model metadata: model.ts.
 *
 * Self-check: every result is passed through `validateSimulationResult` (R1–R13) before it is
 * returned; a result that fails it (an engine defect) is replaced by a failed result with
 * INTERNAL_ERROR.
 */
export function runSimulation(input: unknown): ValidationResult<SimulationResult> {
  const validated = validateSimulationRequest(input);
  if (!validated.ok) {
    return validated;
  }
  const request = validated.value;
  const result = runValidRequest(request);
  const check = validateSimulationResult(result);
  if (check.ok) {
    return { ok: true, value: result };
  }
  const codes = check.issues.map((issue) => issue.code).join(', ');
  return {
    ok: true,
    value: failedResult(request, [
      diagnostic(
        'INTERNAL_ERROR',
        `Engine produced a result that violates the contract: ${codes}.`,
      ),
    ]),
  };
}
