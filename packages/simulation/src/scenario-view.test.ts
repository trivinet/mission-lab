/**
 * Unit tests of describeScenarioOrbit (ML-TASK-027). Plumbing and behaviour only: the physics is
 * verified at G1 by the reference families (VT-02…VT-04); here derived values are compared with
 * the astrodynamics functions' own output, never with reference numbers.
 */
import {
  EARTH_CONSTANTS,
  closedOrbitQuantities,
  elementsToState,
  normalizeAngle_rad,
  stateToElements,
} from '@mission-lab/astrodynamics';
import type { KeplerianElements } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { DEGENERACY_THRESHOLDS } from './degeneracy-thresholds';
import { describeScenarioOrbit } from './scenario-view';
import type { DescribeScenarioOrbitResult, ScenarioOrbitView } from './scenario-view';

/**
 * Elements of the editor's default scenario, copied from apps/web/src/state/default-scenario.ts
 * (DEFAULT_SCENARIO_VALUES; a product default, not a reference). Copied because this package may
 * not import apps/web.
 */
const DEFAULT_ELEMENTS: KeplerianElements = {
  semiMajorAxis_m: 7_000_000,
  eccentricity: 0.01,
  inclination_rad: Math.PI / 4,
  raan_rad: 0,
  argPeriapsis_rad: 0,
  trueAnomaly_rad: 0,
};

/** A non-degenerate test orbit (arbitrary input, not a reference case). */
const GENERIC: KeplerianElements = {
  semiMajorAxis_m: 7_200_000,
  eccentricity: 0.02,
  inclination_rad: 0.9,
  raan_rad: 1,
  argPeriapsis_rad: 2,
  trueAnomaly_rad: 0.5,
};

const EPS_E = DEGENERACY_THRESHOLDS.circularEccentricity;
const EPS_I = DEGENERACY_THRESHOLDS.equatorialInclination_rad;

function viewOf(result: DescribeScenarioOrbitResult): ScenarioOrbitView {
  if (!result.ok) {
    throw new Error(`describeScenarioOrbit failed: ${result.reason}`);
  }
  return result.view;
}

function describe_(overrides: Partial<KeplerianElements>): ScenarioOrbitView {
  return viewOf(describeScenarioOrbit({ ...GENERIC, ...overrides }, EARTH_CONSTANTS));
}

describe('describeScenarioOrbit: derived quantities (plumbing, default scenario)', () => {
  it('equals closedOrbitQuantities, with altitudes above the reference radius', () => {
    const view = viewOf(describeScenarioOrbit(DEFAULT_ELEMENTS, EARTH_CONSTANTS));
    const q = closedOrbitQuantities(
      DEFAULT_ELEMENTS.semiMajorAxis_m,
      DEFAULT_ELEMENTS.eccentricity,
      EARTH_CONSTANTS.mu_m3ps2,
    );
    if (!q.ok) throw new Error(q.reason);
    const R = EARTH_CONSTANTS.referenceRadius_m;
    expect(view.derived).toStrictEqual({
      perigeeRadius_m: q.quantities.periapsisRadius_m,
      apogeeRadius_m: q.quantities.apoapsisRadius_m,
      perigeeAltitude_m: q.quantities.periapsisRadius_m - R,
      apogeeAltitude_m: q.quantities.apoapsisRadius_m - R,
      period_s: q.quantities.period_s,
      specificEnergy_m2ps2: q.quantities.specificEnergy_m2ps2,
      meanMotion_radps: q.quantities.meanMotion_radps,
      specificAngularMomentum_m2ps: q.quantities.specificAngularMomentum_m2ps,
    });
    expect(view.degeneracy.convention).toBe('NONE');
  });

  it('reports the elements of stateToElements(elementsToState(...)) with the thresholds', () => {
    const view = viewOf(describeScenarioOrbit(GENERIC, EARTH_CONSTANTS));
    const state = elementsToState(GENERIC, EARTH_CONSTANTS.mu_m3ps2);
    if (!state.ok) throw new Error(state.reason);
    const expected = stateToElements(state.state, EARTH_CONSTANTS.mu_m3ps2, DEGENERACY_THRESHOLDS);
    if (!expected.ok) throw new Error(expected.reason);
    expect(view.degeneracy.reportedElements).toStrictEqual(expected.elements);
    expect(view.degeneracy.convention).toBe(expected.convention);
  });
});

describe('describeScenarioOrbit: angle normalisation', () => {
  it('maps negative, ≥ 2π and −0 angles with normalizeAngle_rad', () => {
    const view = describe_({ raan_rad: -1, argPeriapsis_rad: 2 * Math.PI, trueAnomaly_rad: 7 });
    const expected = [-1, 2 * Math.PI, 7].map((x) => {
      const n = normalizeAngle_rad(x);
      if (!n.ok) throw new Error(n.reason);
      return n.angle_rad;
    });
    expect(view.normalizedAngles).toStrictEqual({
      raan_rad: expected[0],
      argPeriapsis_rad: expected[1],
      trueAnomaly_rad: expected[2],
    });
    expect(view.normalizedAngles.argPeriapsis_rad).toBe(0);
    for (const value of Object.values(view.normalizedAngles)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 * Math.PI);
    }
    const negZero = describe_({ raan_rad: -0 });
    expect(Object.is(negZero.normalizedAngles.raan_rad, 0)).toBe(true);
  });

  it('leaves in-range angles unchanged', () => {
    const view = describe_({});
    expect(view.normalizedAngles).toStrictEqual({
      raan_rad: GENERIC.raan_rad,
      argPeriapsis_rad: GENERIC.argPeriapsis_rad,
      trueAnomaly_rad: GENERIC.trueAnomaly_rad,
    });
  });

  it('gives the same view for an angle and the angle + 2π', () => {
    const a = describe_({ trueAnomaly_rad: 0.5 });
    const b = describe_({ trueAnomaly_rad: 0.5 + 2 * Math.PI });
    expect(b.degeneracy.convention).toBe(a.degeneracy.convention);
    expect(b.normalizedAngles.trueAnomaly_rad).toBeCloseTo(0.5, 14);
  });
});

describe('describeScenarioOrbit: degenerate classification (ADR-008)', () => {
  it('NONE: all elements defined', () => {
    const d = describe_({}).degeneracy;
    expect(d).toMatchObject({
      convention: 'NONE',
      circular: false,
      equatorial: false,
      undefinedElements: [],
      raanMeaning: 'RAAN',
      argPeriapsisMeaning: 'ARGUMENT_OF_PERIAPSIS',
      trueAnomalyMeaning: 'TRUE_ANOMALY',
    });
  });

  it('CIRCULAR at e = 0: ω undefined and assigned 0, ν is the argument of latitude', () => {
    const d = describe_({ eccentricity: 0 }).degeneracy;
    expect(d).toMatchObject({
      convention: 'CIRCULAR',
      circular: true,
      equatorial: false,
      undefinedElements: ['argPeriapsis_rad'],
      raanMeaning: 'RAAN',
      argPeriapsisMeaning: 'ASSIGNED_ZERO',
      trueAnomalyMeaning: 'ARGUMENT_OF_LATITUDE',
    });
    expect(d.reportedElements.argPeriapsis_rad).toBe(0);
  });

  it('EQUATORIAL at i = 0: Ω undefined and assigned 0, ω is the longitude of periapsis', () => {
    const d = describe_({ inclination_rad: 0 }).degeneracy;
    expect(d).toMatchObject({
      convention: 'EQUATORIAL',
      circular: false,
      equatorial: true,
      undefinedElements: ['raan_rad'],
      raanMeaning: 'ASSIGNED_ZERO',
      argPeriapsisMeaning: 'LONGITUDE_OF_PERIAPSIS',
      trueAnomalyMeaning: 'TRUE_ANOMALY',
    });
    expect(d.reportedElements.raan_rad).toBe(0);
  });

  it('EQUATORIAL for the retrograde equatorial case i = π', () => {
    const d = describe_({ inclination_rad: Math.PI }).degeneracy;
    expect(d.convention).toBe('EQUATORIAL');
    expect(d.undefinedElements).toStrictEqual(['raan_rad']);
  });

  it('CIRCULAR_EQUATORIAL at e = 0, i = 0 and at e = 0, i = π', () => {
    for (const inclination_rad of [0, Math.PI]) {
      const d = describe_({ eccentricity: 0, inclination_rad }).degeneracy;
      expect(d).toMatchObject({
        convention: 'CIRCULAR_EQUATORIAL',
        circular: true,
        equatorial: true,
        undefinedElements: ['raan_rad', 'argPeriapsis_rad'],
        raanMeaning: 'ASSIGNED_ZERO',
        argPeriapsisMeaning: 'ASSIGNED_ZERO',
        trueAnomalyMeaning: 'TRUE_LONGITUDE',
      });
      expect(d.reportedElements.raan_rad).toBe(0);
      expect(d.reportedElements.argPeriapsis_rad).toBe(0);
    }
  });

  // Offsets of ±1 % of the threshold: far larger than the rounding of the state round trip
  // (tolerances.md §10: about 1e-13 in e and 7e-14 rad in i at N = 0), so the side is unambiguous.
  it('e just below / just above ε_e', () => {
    expect(describe_({ eccentricity: EPS_E * 0.99 }).degeneracy.convention).toBe('CIRCULAR');
    expect(describe_({ eccentricity: EPS_E * 1.01 }).degeneracy.convention).toBe('NONE');
  });

  it('i just below / just above ε_i (prograde)', () => {
    expect(describe_({ inclination_rad: EPS_I * 0.99 }).degeneracy.convention).toBe('EQUATORIAL');
    expect(describe_({ inclination_rad: EPS_I * 1.01 }).degeneracy.convention).toBe('NONE');
  });

  it('π − i just below / just above ε_i (retrograde)', () => {
    expect(describe_({ inclination_rad: Math.PI - EPS_I * 0.99 }).degeneracy.convention).toBe(
      'EQUATORIAL',
    );
    expect(describe_({ inclination_rad: Math.PI - EPS_I * 1.01 }).degeneracy.convention).toBe(
      'NONE',
    );
  });

  it('both just below: CIRCULAR_EQUATORIAL; e and i reported as computed, not zero', () => {
    const d = describe_({ eccentricity: EPS_E * 0.5, inclination_rad: EPS_I * 0.5 }).degeneracy;
    expect(d.convention).toBe('CIRCULAR_EQUATORIAL');
    expect(d.reportedElements.eccentricity).toBeGreaterThan(0);
    expect(d.reportedElements.inclination_rad).toBeGreaterThan(0);
  });
});

describe('describeScenarioOrbit: invalid input returns a typed failure', () => {
  const cases: [string, Partial<KeplerianElements>, Partial<typeof EARTH_CONSTANTS>, string][] = [
    ['NaN a', { semiMajorAxis_m: Number.NaN }, {}, 'NON_FINITE_INPUT'],
    ['infinite Ω', { raan_rad: Number.POSITIVE_INFINITY }, {}, 'NON_FINITE_INPUT'],
    ['NaN ν', { trueAnomaly_rad: Number.NaN }, {}, 'NON_FINITE_INPUT'],
    ['a ≤ 0', { semiMajorAxis_m: -1 }, {}, 'SEMI_MAJOR_AXIS_NOT_POSITIVE'],
    ['e = 1', { eccentricity: 1 }, {}, 'ECCENTRICITY_OUT_OF_RANGE'],
    ['e < 0', { eccentricity: -0.1 }, {}, 'ECCENTRICITY_OUT_OF_RANGE'],
    ['i > π', { inclination_rad: 4 }, {}, 'INCLINATION_OUT_OF_RANGE'],
    ['μ = 0', {}, { mu_m3ps2: 0 }, 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'],
    ['μ NaN', {}, { mu_m3ps2: Number.NaN }, 'NON_FINITE_INPUT'],
    ['R = 0', {}, { referenceRadius_m: 0 }, 'REFERENCE_RADIUS_NOT_POSITIVE'],
    ['R infinite', {}, { referenceRadius_m: Number.POSITIVE_INFINITY }, 'NON_FINITE_INPUT'],
  ];
  for (const [label, elementOverrides, constantOverrides, reason] of cases) {
    it(label, () => {
      const result = describeScenarioOrbit(
        { ...GENERIC, ...elementOverrides },
        { ...EARTH_CONSTANTS, ...constantOverrides },
      );
      expect(result).toStrictEqual({ ok: false, reason });
    });
  }
});

describe('describeScenarioOrbit: purity', () => {
  it('does not mutate its inputs and is deterministic', () => {
    const elements = Object.freeze({ ...GENERIC, raan_rad: -1 });
    const constants = Object.freeze({ ...EARTH_CONSTANTS });
    const first = describeScenarioOrbit(elements, constants);
    const second = describeScenarioOrbit(elements, constants);
    expect(elements).toStrictEqual({ ...GENERIC, raan_rad: -1 });
    expect(second).toStrictEqual(first);
  });
});
