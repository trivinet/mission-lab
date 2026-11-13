import { EARTH_CONSTANTS, elementsToState } from '@mission-lab/astrodynamics';
import {
  REQUEST_ID_PATTERN,
  canonicalRequestPayload,
  validateSimulationRequest,
} from '@mission-lab/contracts';
import type { Scenario, SimulationRequest } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';
import { buildSimulationRequest, computeRequestId, deriveRequestId } from './request';
import { validateScenarioSemantics } from './semantic-validation';
import { bitEqual, leoScenario, maneuver, requestOf } from './test-fixtures';

function withElements(
  elements: Partial<Scenario['initialOrbit']['elements']>,
  overrides: Partial<Scenario> = {},
): Scenario {
  const base = leoScenario(overrides);
  return {
    ...base,
    initialOrbit: { kind: 'KEPLERIAN', elements: { ...base.initialOrbit.elements, ...elements } },
  };
}

describe('semantic validation (contracts-v1 §3)', () => {
  it('accepts the fixture scenario', () => {
    expect(validateScenarioSemantics(leoScenario())).toEqual([]);
  });

  it('perigee exactly on the reference radius is rejected (a = R, e = 0: a(1 − e) = R exactly)', () => {
    const issues = validateScenarioSemantics(
      withElements({ semiMajorAxis_m: EARTH_CONSTANTS.referenceRadius_m, eccentricity: 0 }),
    );
    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['PERIGEE_BELOW_REFERENCE_RADIUS', ['initialOrbit', 'elements']],
    ]);
  });

  it('perigee one metre above the reference radius is accepted', () => {
    expect(
      validateScenarioSemantics(
        withElements({ semiMajorAxis_m: EARTH_CONSTANTS.referenceRadius_m + 1, eccentricity: 0 }),
      ),
    ).toEqual([]);
  });

  it('perigee below the reference radius with an apogee above it is rejected', () => {
    // a(1 − e) = 8e6 × 0.25 = 2e6 m (exact in binary64).
    const issues = validateScenarioSemantics(
      withElements({ semiMajorAxis_m: 8e6, eccentricity: 0.75 }),
    );
    expect(issues.map((i) => i.code)).toEqual(['PERIGEE_BELOW_REFERENCE_RADIUS']);
  });

  it('sample count at the limit is accepted, one above is rejected at ["outputStep_s"]', () => {
    // h = 1: candidates 0 … D − 1 plus D, i.e. D + 1 samples.
    const atLimit = leoScenario({ duration_s: PROVISIONAL_MAX_SAMPLE_COUNT - 1, outputStep_s: 1 });
    expect(validateScenarioSemantics(atLimit)).toEqual([]);
    const above = leoScenario({ duration_s: PROVISIONAL_MAX_SAMPLE_COUNT, outputStep_s: 1 });
    expect(validateScenarioSemantics(above).map((i) => [i.code, i.path])).toEqual([
      ['SAMPLE_COUNT_EXCEEDED', ['outputStep_s']],
    ]);
  });

  it('the maneuver samples count: an off-grid maneuver adds two samples', () => {
    const scenario = leoScenario({
      duration_s: PROVISIONAL_MAX_SAMPLE_COUNT - 3,
      outputStep_s: 1,
      maneuvers: [maneuver(10.5, [0, 1, 0])],
    });
    expect(validateScenarioSemantics(scenario)).toEqual([]);
    const over = { ...scenario, duration_s: PROVISIONAL_MAX_SAMPLE_COUNT - 2 };
    expect(validateScenarioSemantics(over).map((i) => i.code)).toEqual(['SAMPLE_COUNT_EXCEEDED']);
  });

  it('reports both issues in schema field order', () => {
    const scenario = withElements(
      { semiMajorAxis_m: 6e6, eccentricity: 0 },
      { duration_s: 1e9, outputStep_s: 1 },
    );
    expect(validateScenarioSemantics(scenario).map((i) => i.code)).toEqual([
      'PERIGEE_BELOW_REFERENCE_RADIUS',
      'SAMPLE_COUNT_EXCEEDED',
    ]);
  });

  it('a huge grid is rejected without enumerating it', () => {
    const scenario = leoScenario({ duration_s: 1e300, outputStep_s: 1e-300 });
    expect(validateScenarioSemantics(scenario).map((i) => i.code)).toEqual([
      'SAMPLE_COUNT_EXCEEDED',
    ]);
  });
});

describe('buildSimulationRequest (contracts-v1 §4)', () => {
  it('builds a valid request from the scenario, the engine conversion and constants', () => {
    const scenario = leoScenario({ maneuvers: [maneuver(1000, [1, 2, 3])] });
    const request = requestOf(scenario);
    expect(validateSimulationRequest(request).ok).toBe(true);
    expect(request.constants).toEqual({
      mu_m3ps2: EARTH_CONSTANTS.mu_m3ps2,
      referenceRadius_m: EARTH_CONSTANTS.referenceRadius_m,
      source: EARTH_CONSTANTS.source,
    });
    const state = elementsToState(scenario.initialOrbit.elements, EARTH_CONSTANTS.mu_m3ps2);
    if (!state.ok) {
      throw new Error('fixture');
    }
    expect(bitEqual(request.initialState.position_m, state.state.position_m)).toBe(true);
    expect(bitEqual(request.initialState.velocity_mps, state.state.velocity_mps)).toBe(true);
    expect(request.epoch).toEqual(scenario.epoch);
    expect(request.maneuvers).toEqual(scenario.maneuvers);
    expect(request.duration_s).toBe(scenario.duration_s);
    expect(request.outputStep_s).toBe(scenario.outputStep_s);
    expect(request.dynamicsModel).toBe('TWO_BODY');
    expect(request.frame).toBe('GCRF');
    expect(request.centralBody).toBe('EARTH');
  });

  it('returns structural issues unchanged', () => {
    const outcome = buildSimulationRequest({ ...leoScenario(), schemaVersion: '2.0' });
    expect(outcome.ok ? [] : outcome.issues.map((i) => i.code)).toEqual([
      'SCHEMA_VERSION_UNSUPPORTED',
    ]);
    const bad = buildSimulationRequest(leoScenario({ duration_s: 0 }));
    expect(bad.ok ? [] : bad.issues.map((i) => [i.code, i.path])).toEqual([
      ['DURATION_NOT_POSITIVE', ['duration_s']],
    ]);
  });

  it('returns semantic issues and builds no request', () => {
    const outcome = buildSimulationRequest(withElements({ semiMajorAxis_m: 6e6 }));
    expect(outcome.ok ? [] : outcome.issues.map((i) => i.code)).toEqual([
      'PERIGEE_BELOW_REFERENCE_RADIUS',
    ]);
  });

  it('an overflowing Cartesian state is reported as an issue, not thrown', () => {
    const outcome = buildSimulationRequest(
      withElements({ semiMajorAxis_m: 1.7e308, eccentricity: 0.9, trueAnomaly_rad: 3 }),
    );
    expect(outcome.ok ? [] : outcome.issues.map((i) => [i.code, i.path])).toEqual([
      ['NON_FINITE_NUMBER', ['initialOrbit', 'elements']],
    ]);
  });

  it('keeps −0 inputs unchanged (contracts-v1 §12 NQ-1 not decided)', () => {
    const request = requestOf(leoScenario({ maneuvers: [maneuver(-0, [-0, 1, 0])] }));
    expect(Object.is(request.maneuvers[0]?.t_s, -0)).toBe(true);
    expect(Object.is(request.maneuvers[0]?.deltaV_mps[0], -0)).toBe(true);
  });
});

describe('requestId (contracts-v1 §7)', () => {
  it('has the sha256:<64 hex> format and is the hash of the canonical payload', () => {
    const request = requestOf(leoScenario());
    expect(REQUEST_ID_PATTERN.test(request.requestId)).toBe(true);
    const { requestId, ...rest } = request;
    expect(computeRequestId(rest)).toBe(requestId);
  });

  it('hashes the contract §7.2 example payload as SHA-256 of its UTF-8 text', () => {
    const example: Omit<SimulationRequest, 'requestId'> = {
      schemaVersion: '1.0',
      centralBody: 'EARTH',
      constants: { mu_m3ps2: 1, referenceRadius_m: 0.5, source: 'placeholder' },
      dynamicsModel: 'TWO_BODY',
      frame: 'GCRF',
      epoch: { scale: 'UTC', iso: '2030-01-02T03:04:05.678Z' },
      initialState: { position_m: [1, 2, 3], velocity_mps: [4, 5, 6] },
      maneuvers: [{ id: 'm1', t_s: 100, frame: 'RSW', deltaV_mps: [1, 2, 3] }],
      duration_s: 1000,
      outputStep_s: 10,
    };
    // The payload text printed in contracts-v1 §7.2.
    const payload =
      '{"centralBody":"EARTH","constants":{"mu_m3ps2":3ff0000000000000,"referenceRadius_m":3fe0000000000000,"source":"placeholder"},"duration_s":408f400000000000,"dynamicsModel":"TWO_BODY","epoch":{"iso":"2030-01-02T03:04:05.678Z","scale":"UTC"},"frame":"GCRF","initialState":{"position_m":[3ff0000000000000,4000000000000000,4008000000000000],"velocity_mps":[4010000000000000,4014000000000000,4018000000000000]},"maneuvers":[{"deltaV_mps":[3ff0000000000000,4000000000000000,4008000000000000],"frame":"RSW","id":"m1","t_s":4059000000000000}],"outputStep_s":4024000000000000,"schemaVersion":"1.0"}';
    expect(canonicalRequestPayload(example)).toBe(payload);
    const proc = (globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } })
      .process;
    const crypto = proc.getBuiltinModule('node:crypto') as {
      createHash(a: 'sha256'): { update(s: string): { digest(e: 'hex'): string } };
    };
    expect(computeRequestId(example)).toBe(
      `sha256:${crypto.createHash('sha256').update(payload).digest('hex')}`,
    );
  });

  it('is stable: equal scenarios give equal ids; deriveRequestId agrees with the request', () => {
    const a = requestOf(leoScenario({ maneuvers: [maneuver(100, [1, 2, 3])] }));
    const b = requestOf(leoScenario({ maneuvers: [maneuver(100, [1, 2, 3])] }));
    expect(a.requestId).toBe(b.requestId);
    const derived = deriveRequestId(leoScenario({ maneuvers: [maneuver(100, [1, 2, 3])] }));
    expect(derived).toEqual({ ok: true, value: a.requestId });
  });

  it('does not depend on scenario fields that are not in the request (id, name)', () => {
    const a = requestOf(leoScenario());
    const b = requestOf(leoScenario({ id: 'other', name: 'Other name' }));
    expect(b.requestId).toBe(a.requestId);
  });

  it('deriveRequestId returns the issues of an invalid scenario', () => {
    const derived = deriveRequestId(leoScenario({ outputStep_s: -1 }));
    expect(derived.ok ? [] : derived.issues.map((i) => i.code)).toEqual([
      'OUTPUT_STEP_NOT_POSITIVE',
    ]);
  });

  it('changes when any request field changes', () => {
    const base = requestOf(leoScenario({ maneuvers: [maneuver(100, [1, 2, 3])] }));
    const { requestId, ...rest } = base;
    const next = (x: number): number => {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, x);
      view.setBigUint64(0, view.getBigUint64(0) + 1n);
      return view.getFloat64(0);
    };
    const m0 = rest.maneuvers[0];
    if (m0 === undefined) {
      throw new Error('fixture');
    }
    const [px, py, pz] = rest.initialState.position_m;
    const [vx, vy, vz] = rest.initialState.velocity_mps;
    const variants: Omit<SimulationRequest, 'requestId'>[] = [
      { ...rest, constants: { ...rest.constants, mu_m3ps2: next(rest.constants.mu_m3ps2) } },
      {
        ...rest,
        constants: { ...rest.constants, referenceRadius_m: next(rest.constants.referenceRadius_m) },
      },
      { ...rest, constants: { ...rest.constants, source: `${rest.constants.source} ` } },
      { ...rest, epoch: { scale: 'UTC', iso: '2030-01-01T00:00:00.001Z' } },
      { ...rest, initialState: { ...rest.initialState, position_m: [next(px), py, pz] } },
      { ...rest, initialState: { ...rest.initialState, velocity_mps: [vx, vy, next(vz)] } },
      { ...rest, maneuvers: [{ ...m0, id: 'burn-2' }] },
      { ...rest, maneuvers: [{ ...m0, t_s: next(m0.t_s) }] },
      { ...rest, maneuvers: [{ ...m0, deltaV_mps: [1, next(2), 3] }] },
      { ...rest, maneuvers: [] },
      { ...rest, duration_s: next(rest.duration_s) },
      { ...rest, outputStep_s: next(rest.outputStep_s) },
    ];
    const ids = variants.map(computeRequestId);
    expect(new Set([requestId, ...ids]).size).toBe(variants.length + 1);
  });

  it('distinguishes −0 from +0 (owner decision 8)', () => {
    const plus = requestOf(leoScenario({ maneuvers: [maneuver(0, [0, 1, 0])] }));
    const minus = requestOf(leoScenario({ maneuvers: [maneuver(0, [-0, 1, 0])] }));
    expect(minus.requestId).not.toBe(plus.requestId);
  });
});
