import {
  PACKAGE_VERSION as ASTRODYNAMICS_VERSION,
  EARTH_CONSTANTS,
  applyImpulsiveManeuver,
  elementsToState,
  propagateKeplerUniversal,
} from '@mission-lab/astrodynamics';
import type { Vec3 } from '@mission-lab/astrodynamics';
import { DIAGNOSTIC_CODE_SEVERITY } from '@mission-lab/contracts';
import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
import { MODEL_LIMITATIONS, TIME_CONVENTION } from './model';
import { runSimulation } from './run';
import { buildSamplingGrid } from './sampling-grid';
import {
  bitEqual,
  cartesianRequest,
  leoScenario,
  maneuver,
  requestOf,
  runOk,
  sampleOf,
} from './test-fixtures';

/**
 * Direct checks of R1–R13 (contracts-v1 §5.5), independent of the contract validator (which
 * runOk also applies), with Object.is for every bit-exact rule.
 */
function checkInvariants(result: SimulationResult): void {
  const sampling = result.model.sampling;
  for (const d of result.diagnostics) {
    expect(d.severity).toBe(DIAGNOSTIC_CODE_SEVERITY[d.code]); // R13
  }
  if (result.status === 'failed') {
    expect(result.segments).toEqual([]); // R9
    expect(result.events).toEqual([]);
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    return;
  }
  expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(false); // R7
  expect(result.segments).toHaveLength(result.events.length + 1);
  const buffers = new Set<ArrayBufferLike>();
  result.segments.forEach((s, n) => {
    expect(s.index).toBe(n); // R1
    expect(s.t_s.length).toBeGreaterThanOrEqual(1); // R2
    expect(s.position_m.length).toBe(3 * s.t_s.length); // R3
    expect(s.velocity_mps.length).toBe(3 * s.t_s.length);
    for (const a of [s.t_s, s.position_m, s.velocity_mps]) {
      expect(a).toBeInstanceOf(Float64Array); // R4
      expect(a.every((x) => Number.isFinite(x))).toBe(true); // R5
      expect(a.byteOffset).toBe(0); // R11
      expect(a.buffer).toBeInstanceOf(ArrayBuffer);
      expect(a.buffer.byteLength).toBe(a.byteLength);
      buffers.add(a.buffer);
    }
    let increasing = true;
    for (let k = 1; k < s.t_s.length; k++) {
      increasing &&= (s.t_s[k] ?? 0) > (s.t_s[k - 1] ?? 0); // R6
    }
    expect(increasing).toBe(true);
  });
  expect(buffers.size).toBe(3 * result.segments.length); // R11: no sharing
  expect(result.segments[0]?.t_s[0] === 0).toBe(true); // R10 (=== 0, so −0 is accepted)
  expect(Object.is(result.segments.at(-1)?.t_s.at(-1), sampling.duration_s)).toBe(true);
  result.events.forEach((e, n) => {
    const before = result.segments[n];
    const after = result.segments[n + 1];
    if (before === undefined || after === undefined) {
      throw new Error('segment missing');
    }
    const last = before.t_s.length - 1;
    expect(Object.is(before.t_s[last], e.t_s)).toBe(true); // R8
    expect(Object.is(after.t_s[0], e.t_s)).toBe(true);
    expect(bitEqual(sampleOf(before, last).r, e.position_m)).toBe(true);
    expect(bitEqual(sampleOf(after, 0).r, e.position_m)).toBe(true);
    expect(bitEqual(sampleOf(before, last).v, e.velocityBefore_mps)).toBe(true);
    expect(bitEqual(sampleOf(after, 0).v, e.velocityAfter_mps)).toBe(true);
    for (let i = 0; i < 3; i++) {
      const sum = (e.velocityBefore_mps[i] ?? NaN) + (e.deltaV_inertial_mps[i] ?? NaN);
      expect(Object.is(e.velocityAfter_mps[i], sum)).toBe(true); // R12
    }
    expect(e.t_s >= 0 && e.t_s <= sampling.duration_s).toBe(true); // R10
  });
}

function run(request: SimulationRequest): SimulationResult {
  const result = runOk(request);
  checkInvariants(result);
  return result;
}

function segmentTimes(result: SimulationResult): number[][] {
  return result.segments.map((s) => Array.from(s.t_s));
}

describe('coast run (no maneuver)', () => {
  const request = requestOf(leoScenario());
  const result = run(request);

  it('is ok with one segment, no events and no diagnostics', () => {
    expect(result.status).toBe('ok');
    expect(result.segments).toHaveLength(1);
    expect(result.events).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.requestId).toBe(request.requestId);
  });

  it('samples at the §5.2 grid', () => {
    const expected = Array.from({ length: 100 }, (_, j) => j * 60);
    expect(segmentTimes(result)).toEqual([[...expected, 6000]]);
  });

  it('first sample is a bit-identical copy of the initial state', () => {
    const segment = result.segments[0];
    if (segment === undefined) {
      throw new Error('no segment');
    }
    expect(bitEqual(sampleOf(segment, 0).r, request.initialState.position_m)).toBe(true);
    expect(bitEqual(sampleOf(segment, 0).v, request.initialState.velocity_mps)).toBe(true);
  });

  it('every other sample is propagated directly from the initial state (no chaining)', () => {
    const segment = result.segments[0];
    if (segment === undefined) {
      throw new Error('no segment');
    }
    for (let k = 1; k < segment.t_s.length; k++) {
      const p = propagateKeplerUniversal(
        request.constants.mu_m3ps2,
        request.initialState.position_m,
        request.initialState.velocity_mps,
        segment.t_s[k] ?? NaN,
      );
      if (!p.ok) {
        throw new Error('propagation');
      }
      expect(bitEqual(sampleOf(segment, k).r, p.position_m)).toBe(true);
      expect(bitEqual(sampleOf(segment, k).v, p.velocity_mps)).toBe(true);
    }
  });

  it('the state at a common time does not depend on the output step', () => {
    const coarse = run(requestOf(leoScenario({ outputStep_s: 120 })));
    const fine = result.segments[0];
    const c = coarse.segments[0];
    if (fine === undefined || c === undefined) {
      throw new Error('no segment');
    }
    for (let k = 0; k < c.t_s.length; k++) {
      const kf = fine.t_s.indexOf(c.t_s[k] ?? NaN);
      expect(kf).toBeGreaterThanOrEqual(0);
      expect(bitEqual(sampleOf(c, k).r, sampleOf(fine, kf).r)).toBe(true);
      expect(bitEqual(sampleOf(c, k).v, sampleOf(fine, kf).v)).toBe(true);
    }
  });

  it('model metadata per §5.4, copied from the request', () => {
    const model = result.model;
    expect(model.engineVersion).toBe(ASTRODYNAMICS_VERSION);
    expect(model.centralBody).toBe('EARTH');
    expect(model.dynamicsModel).toBe('TWO_BODY');
    expect(model.propagator).toBe('KEPLER_UNIVERSAL_VARIABLE');
    expect(model.maneuverModel).toBe('IMPULSIVE');
    expect(model.frame).toBe('GCRF');
    expect(model.epoch).toEqual(request.epoch);
    expect(model.timeConvention).toBe(TIME_CONVENTION);
    expect(Object.is(model.sampling.duration_s, request.duration_s)).toBe(true);
    expect(Object.is(model.sampling.outputStep_s, request.outputStep_s)).toBe(true);
    expect(Object.is(model.constants.mu_m3ps2, request.constants.mu_m3ps2)).toBe(true);
    expect(Object.is(model.constants.referenceRadius_m, request.constants.referenceRadius_m)).toBe(
      true,
    );
    expect(model.constants.source).toBe(request.constants.source);
    expect(model.limitations).toEqual(MODEL_LIMITATIONS);
    expect(model.limitations.some((l) => l.includes('illustrative'))).toBe(true);
    expect(model.limitations.some((l) => l.includes(String(PROVISIONAL_MAX_SAMPLE_COUNT)))).toBe(
      true,
    );
  });

  it('h ≥ D gives the two samples 0 and D', () => {
    const r = run(requestOf(leoScenario({ duration_s: 50, outputStep_s: 60 })));
    expect(segmentTimes(r)).toEqual([[0, 50]]);
  });

  it('a 0.1 s step uses fl(j × 0.1)', () => {
    const r = run(requestOf(leoScenario({ duration_s: 1, outputStep_s: 0.1 })));
    const t = r.segments[0]?.t_s ?? new Float64Array();
    expect(t).toHaveLength(11);
    expect(t[3]).toBe(0.30000000000000004);
    expect(t[8]).toBe(0.8);
    expect(t[10]).toBe(1);
  });
});

describe('first sample copy keeps a −0 component', () => {
  it('segment 0 starts with the initial state bit-for-bit, −0 included', () => {
    const request = cartesianRequest([7000000, -0, 0], [-0, 7546, 0], { duration_s: 600 });
    const result = run(request);
    const segment = result.segments[0];
    if (segment === undefined) {
      throw new Error('no segment');
    }
    const first = sampleOf(segment, 0);
    expect(Object.is(first.r[1], -0)).toBe(true);
    expect(Object.is(first.v[0], -0)).toBe(true);
    expect(bitEqual(first.r, request.initialState.position_m)).toBe(true);
    expect(bitEqual(first.v, request.initialState.velocity_mps)).toBe(true);
  });
});

describe('one maneuver', () => {
  function maneuverRun(t_s: number, deltaV: [number, number, number], D = 6000, h = 60) {
    const request = requestOf(
      leoScenario({ duration_s: D, outputStep_s: h, maneuvers: [maneuver(t_s, deltaV)] }),
    );
    return { request, result: run(request) };
  }

  it('two segments split at an off-grid maneuver time; event filled one-to-one', () => {
    const { request, result } = maneuverRun(1000.5, [1, 2, 3]);
    expect(result.status).toBe('ok');
    expect(segmentTimes(result)).toEqual(
      buildSamplingGrid(6000, 60, [1000.5]).map((s) => [...s.times_s]),
    );
    const before = result.segments[0];
    const event = result.events[0];
    if (before === undefined || event === undefined) {
      throw new Error('missing');
    }
    const last = sampleOf(before, before.t_s.length - 1);
    const applied = applyImpulsiveManeuver(
      last.r as unknown as Vec3,
      last.v as unknown as Vec3,
      [1, 2, 3],
    );
    if (!applied.ok) {
      throw new Error('maneuver');
    }
    expect(event.maneuverId).toBe('burn-1');
    expect(Object.is(event.t_s, request.maneuvers[0]?.t_s)).toBe(true);
    expect(bitEqual(event.deltaV_inertial_mps, applied.maneuver.deltaV_inertial_mps)).toBe(true);
    expect(bitEqual(event.velocityAfter_mps, applied.maneuver.velocityAfter_mps)).toBe(true);
    expect(Object.is(event.deltaV_magnitude_mps, applied.maneuver.deltaV_magnitude_mps)).toBe(true);
  });

  it('post-maneuver samples are propagated from (position, velocityAfter) with Δt = t − m', () => {
    const { result } = maneuverRun(1000.5, [1, 2, 3]);
    const after = result.segments[1];
    const event = result.events[0];
    if (after === undefined || event === undefined) {
      throw new Error('missing');
    }
    for (let k = 1; k < after.t_s.length; k++) {
      const p = propagateKeplerUniversal(
        result.model.constants.mu_m3ps2,
        event.position_m,
        event.velocityAfter_mps,
        (after.t_s[k] ?? NaN) - event.t_s,
      );
      if (!p.ok) {
        throw new Error('propagation');
      }
      expect(bitEqual(sampleOf(after, k).r, p.position_m)).toBe(true);
      expect(bitEqual(sampleOf(after, k).v, p.velocity_mps)).toBe(true);
    }
  });

  it('maneuver on a grid point', () => {
    const { result } = maneuverRun(1200, [0, 1, 0]);
    expect(result.segments[0]?.t_s.at(-1)).toBe(1200);
    expect(result.segments[1]?.t_s[0]).toBe(1200);
    expect(result.segments[1]?.t_s[1]).toBe(1260);
  });

  it('maneuver at 0: segment 0 is [0], the maneuver acts on the initial state', () => {
    const { request, result } = maneuverRun(0, [0, 1, 0]);
    expect(segmentTimes(result)[0]).toEqual([0]);
    expect(bitEqual(result.events[0]?.position_m ?? [], request.initialState.position_m)).toBe(
      true,
    );
    expect(
      bitEqual(result.events[0]?.velocityBefore_mps ?? [], request.initialState.velocity_mps),
    ).toBe(true);
  });

  it('maneuver at −0: sample time −0 in both segments, event t_s −0', () => {
    const { result } = maneuverRun(-0, [0, 1, 0]);
    expect(Object.is(result.segments[0]?.t_s[0], -0)).toBe(true);
    expect(Object.is(result.segments[1]?.t_s[0], -0)).toBe(true);
    expect(Object.is(result.events[0]?.t_s, -0)).toBe(true);
  });

  it('maneuver at D: the last segment is the single sample [D]', () => {
    const { result } = maneuverRun(6000, [0, 1, 0]);
    expect(segmentTimes(result)[1]).toEqual([6000]);
  });

  it('zero Δv still yields one event and two segments', () => {
    const { result } = maneuverRun(3000, [0, 0, 0]);
    expect(result.status).toBe('ok');
    expect(result.events).toHaveLength(1);
    expect(result.segments).toHaveLength(2);
    const e = result.events[0];
    expect(e?.deltaV_magnitude_mps).toBe(0);
    for (let i = 0; i < 3; i++) {
      expect(e?.velocityAfter_mps[i] === e?.velocityBefore_mps[i]).toBe(true);
    }
    expect(result.diagnostics).toEqual([]);
  });
});

describe('determinism (implementer self-check of VT-10; not the VT-10 run)', () => {
  it('two runs of one request are bit-identical', () => {
    const request = requestOf(leoScenario({ maneuvers: [maneuver(2500.25, [10, -20, 5])] }));
    const a = run(request);
    const b = run(request);
    expect(a.segments).toHaveLength(b.segments.length);
    a.segments.forEach((s, n) => {
      const o = b.segments[n];
      if (o === undefined) {
        throw new Error('missing');
      }
      expect(bitEqual(s.t_s, o.t_s)).toBe(true);
      expect(bitEqual(s.position_m, o.position_m)).toBe(true);
      expect(bitEqual(s.velocity_mps, o.velocity_mps)).toBe(true);
    });
    expect(a.events).toEqual(b.events);
    expect(a.diagnostics).toEqual(b.diagnostics);
    expect(a.model).toEqual(b.model);
  });
});

describe('post-maneuver warnings (contracts-v1 §8.3, §11.3)', () => {
  it('ESCAPE_TRAJECTORY for a large prograde burn; propagated anyway, t_s = maneuver time', () => {
    const request = requestOf(leoScenario({ maneuvers: [maneuver(1000, [0, 4000, 0])] }));
    const result = run(request);
    expect(result.status).toBe('ok');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['ESCAPE_TRAJECTORY', 'warning', 1000],
    ]);
    expect(result.segments[1]?.t_s.at(-1)).toBe(6000);
  });

  it('REFERENCE_SPHERE_INTERSECTION when the lowered periapsis is reached within the span', () => {
    const request = requestOf(leoScenario({ maneuvers: [maneuver(1000, [0, -2000, 0])] }));
    const result = run(request);
    expect(result.status).toBe('ok');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['REFERENCE_SPHERE_INTERSECTION', 'warning', 1000],
    ]);
  });

  it('no intersection warning when the span ends before the trajectory gets low', () => {
    const request = requestOf(leoScenario({ maneuvers: [maneuver(5940, [0, -2000, 0])] }));
    const result = run(request);
    expect(result.status).toBe('ok');
    expect(result.diagnostics).toEqual([]);
  });

  it('a small burn raises no warning', () => {
    const result = run(requestOf(leoScenario({ maneuvers: [maneuver(1000, [1, 2, 3])] })));
    expect(result.diagnostics).toEqual([]);
  });
});

describe('failed results and rejected input (contracts-v1 §5.5 R9, §6)', () => {
  it('structurally invalid input yields issues, never a result', () => {
    const outcome = runSimulation({});
    expect(outcome.ok).toBe(false);
    const request = requestOf(leoScenario());
    const bad = runSimulation({ ...request, outputStep_s: 0 });
    expect(bad.ok ? [] : bad.issues.map((i) => [i.code, i.path])).toEqual([
      ['OUTPUT_STEP_NOT_POSITIVE', ['outputStep_s']],
    ]);
  });

  it('engine backstop: SAMPLE_COUNT_EXCEEDED as a failed result with a filled model', () => {
    const request = cartesianRequest([7000000, 0, 0], [0, 7546, 0], {
      duration_s: PROVISIONAL_MAX_SAMPLE_COUNT,
      outputStep_s: 1,
    });
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.segments).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['SAMPLE_COUNT_EXCEEDED', 'error', undefined],
    ]);
    expect(result.model.sampling.duration_s).toBe(PROVISIONAL_MAX_SAMPLE_COUNT);
  });

  it('a non-finite propagated state fails the run with NON_FINITE_STATE at the sample time', () => {
    // Hyperbolic state propagated over 1.7e308 s: the position overflows binary64.
    const D = 1.7e308;
    const request = cartesianRequest([7000000, 0, 0], [0, 20000, 0], {
      duration_s: D,
      outputStep_s: D,
    });
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['NON_FINITE_STATE', 'error', D],
    ]);
  });

  it('D8: a failed intersection check fails the run; earlier warnings are kept in order', () => {
    const D = 1.7e308;
    const request = requestOf(
      leoScenario({ duration_s: D, outputStep_s: D, maneuvers: [maneuver(1000, [0, 4000, 0])] }),
    );
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['ESCAPE_TRAJECTORY', 'warning', 1000],
      ['NON_FINITE_STATE', 'error', 1000],
    ]);
  });

  it('a maneuver on a rectilinear state (not reachable from a scenario) is INTERNAL_ERROR', () => {
    const request = cartesianRequest([7000000, 0, 0], [100, 0, 0], {
      duration_s: 600,
      maneuvers: [maneuver(10, [0, 1, 0])],
    });
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.diagnostics.map((d) => [d.code, d.t_s])).toEqual([['INTERNAL_ERROR', 10]]);
  });
});

describe('rectilinear trajectory reaching the centre (ML-TASK-019, issue #24)', () => {
  const MU = EARTH_CONSTANTS.mu_m3ps2;

  /**
   * Circular equatorial orbit (a = 7e6 m, all angles 0) and a maneuver at t = 0 whose RSW Δv
   * cancels the along-track velocity exactly: the post-maneuver state is at rest, i.e. a radial
   * fall from r = 7e6 m.
   */
  function fallScenario(duration_s: number) {
    const elements = {
      semiMajorAxis_m: 7000000,
      eccentricity: 0,
      inclination_rad: 0,
      raan_rad: 0,
      argPeriapsis_rad: 0,
      trueAnomaly_rad: 0,
    };
    const state = elementsToState(elements, MU);
    if (!state.ok) {
      throw new Error('fixture');
    }
    const speed = state.state.velocity_mps[1];
    const request = requestOf(
      leoScenario({
        initialOrbit: { kind: 'KEPLERIAN', elements },
        duration_s,
        outputStep_s: 60,
        maneuvers: [maneuver(0, [0, -speed, 0])],
      }),
    );
    const fall = propagateKeplerUniversal(MU, request.initialState.position_m, [0, 0, 0], 1e9);
    if (fall.ok || fall.reason !== 'RECTILINEAR_COLLISION') {
      throw new Error('fixture: expected a collision');
    }
    return { request, collisionTime_s: fall.collisionDeltaT_s };
  }

  it('fixture: the maneuver leaves the vehicle exactly at rest on the x axis', () => {
    const { request } = fallScenario(600);
    expect(request.initialState.position_m).toEqual([7000000, 0, 0]);
    const result = run(request);
    expect(result.events[0]?.velocityAfter_mps.map(Math.abs)).toEqual([0, 0, 0]);
  });

  it('span longer than the fall time: failed, exactly [NON_FINITE_STATE at the collision time]', () => {
    const { request, collisionTime_s } = fallScenario(1200);
    // (π/2)·√(r³/(2μ)) ≈ 1030.4 s for r = 7e6 m (kepler-universal.ts module comment R2, (F)).
    expect(collisionTime_s).toBeGreaterThan(1000);
    expect(collisionTime_s).toBeLessThan(1200);
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.segments).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['NON_FINITE_STATE', 'error', collisionTime_s],
    ]);
    const message = result.diagnostics[0]?.message ?? '';
    expect(message).toContain('reaches the centre of the central body');
    expect(message).toContain(collisionTime_s.toPrecision(9));
  });

  it('span shorter than the fall time: ok, with REFERENCE_SPHERE_INTERSECTION (inside at end)', () => {
    const { request, collisionTime_s } = fallScenario(1000);
    expect(collisionTime_s).toBeGreaterThan(1000);
    const result = run(request);
    expect(result.status).toBe('ok');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['REFERENCE_SPHERE_INTERSECTION', 'warning', 0],
    ]);
    expect(result.diagnostics[0]?.message).toContain('INSIDE_AT_END');
    const after = result.segments[1];
    if (after === undefined) {
      throw new Error('missing');
    }
    // Every post-maneuver sample is on the +x half-line, falling (never through the centre).
    for (let k = 1; k < after.t_s.length; k++) {
      const s = sampleOf(after, k);
      expect(s.r[0]).toBeGreaterThan(0);
      expect(s.v[0]).toBeLessThan(0);
      expect([s.r[1], s.r[2]].map(Math.abs)).toEqual([0, 0]);
    }
  });

  it('short span (100 s): ok with no warning', () => {
    const result = run(fallScenario(100).request);
    expect(result.status).toBe('ok');
    expect(result.diagnostics).toEqual([]);
  });

  it('segment 0 (request given in Cartesian form): fails at the collision time', () => {
    const request = cartesianRequest([7000000, 0, 0], [-1000, 0, 0], { duration_s: 1500 });
    const fall = propagateKeplerUniversal(MU, [7000000, 0, 0], [-1000, 0, 0], 1500);
    if (fall.ok || fall.reason !== 'RECTILINEAR_COLLISION') {
      throw new Error('expected a collision');
    }
    const result = run(request);
    expect(result.status).toBe('failed');
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.t_s])).toEqual([
      ['NON_FINITE_STATE', 'error', fall.collisionDeltaT_s],
    ]);
    expect(result.diagnostics[0]?.message).toContain('Segment 0');
  });
});
