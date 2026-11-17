import { buildSimulationRequest } from '@mission-lab/simulation';
import type { Scenario, ValidationIssue } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { newScenario } from '../state/default-scenario';
import { FIELD, fieldKeyOf, issuesForField, maneuverDeltaVKey, maneuverTimeKey } from './issue-map';

function issuesOf(scenario: Scenario): readonly ValidationIssue[] {
  const built = buildSimulationRequest(scenario);
  return built.ok ? [] : built.issues;
}

function withElements(patch: Partial<Scenario['initialOrbit']['elements']>): Scenario {
  const s = newScenario();
  return {
    ...s,
    initialOrbit: { ...s.initialOrbit, elements: { ...s.initialOrbit.elements, ...patch } },
  };
}

const maneuver = {
  id: 'm1',
  t_s: 100,
  frame: 'RSW',
  deltaV_mps: [0, 10, 0],
} as const;

describe('engine validation issue -> editor field (real engine validation)', () => {
  it.each<[string, Scenario, string, string]>([
    [
      'a <= 0',
      withElements({ semiMajorAxis_m: -1 }),
      FIELD.semiMajorAxis,
      'SEMI_MAJOR_AXIS_NOT_POSITIVE',
    ],
    [
      'non-finite a',
      withElements({ semiMajorAxis_m: Number.NaN }),
      FIELD.semiMajorAxis,
      'NON_FINITE_NUMBER',
    ],
    [
      'e < 0',
      withElements({ eccentricity: -0.1 }),
      FIELD.eccentricity,
      'ECCENTRICITY_OUT_OF_RANGE',
    ],
    ['e >= 1', withElements({ eccentricity: 1 }), FIELD.eccentricity, 'ECCENTRICITY_OUT_OF_RANGE'],
    [
      'i > 180 deg',
      withElements({ inclination_rad: 4 }),
      FIELD.inclination,
      'INCLINATION_OUT_OF_RANGE',
    ],
    [
      'i < 0',
      withElements({ inclination_rad: -0.1 }),
      FIELD.inclination,
      'INCLINATION_OUT_OF_RANGE',
    ],
    ['raan out of range', withElements({ raan_rad: 7 }), FIELD.raan, 'ANGLE_OUT_OF_RANGE'],
    [
      'argp out of range',
      withElements({ argPeriapsis_rad: -1 }),
      FIELD.argPeriapsis,
      'ANGLE_OUT_OF_RANGE',
    ],
    [
      'nu out of range',
      withElements({ trueAnomaly_rad: 7 }),
      FIELD.trueAnomaly,
      'ANGLE_OUT_OF_RANGE',
    ],
    [
      'perigee below reference radius',
      withElements({ semiMajorAxis_m: 6_000_000 }),
      FIELD.orbit,
      'PERIGEE_BELOW_REFERENCE_RADIUS',
    ],
    ['duration <= 0', { ...newScenario(), duration_s: 0 }, FIELD.duration, 'DURATION_NOT_POSITIVE'],
    [
      'step <= 0',
      { ...newScenario(), outputStep_s: 0 },
      FIELD.outputStep,
      'OUTPUT_STEP_NOT_POSITIVE',
    ],
    [
      'bad epoch',
      { ...newScenario(), epoch: { scale: 'UTC', iso: '2026-01-01' } },
      FIELD.epoch,
      'EPOCH_INVALID',
    ],
    [
      'maneuver time past duration',
      { ...newScenario(), maneuvers: [{ ...maneuver, t_s: 7000 }] },
      maneuverTimeKey(0),
      'MANEUVER_TIME_OUT_OF_RANGE',
    ],
    [
      'negative maneuver time',
      { ...newScenario(), maneuvers: [{ ...maneuver, t_s: -1 }] },
      maneuverTimeKey(0),
      'MANEUVER_TIME_OUT_OF_RANGE',
    ],
    [
      'non-finite maneuver dv',
      { ...newScenario(), maneuvers: [{ ...maneuver, deltaV_mps: [0, Number.NaN, 0] }] },
      maneuverDeltaVKey(0, 1),
      'NON_FINITE_NUMBER',
    ],
    [
      'second maneuver',
      { ...newScenario(), maneuvers: [maneuver, { ...maneuver, id: 'm2' }] },
      FIELD.maneuverList,
      'MANEUVER_COUNT_EXCEEDED',
    ],
  ])('%s', (_name, scenario, key, code) => {
    const issues = issuesOf(scenario);
    const here = issuesForField(issues, key);
    expect(here.map((i) => i.code)).toContain(code);
    // Every issue of this scenario has a key the editor displays.
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(fieldKeyOf(issue)).toBeTruthy();
    }
  });

  it('a valid default scenario has no issues', () => {
    expect(issuesOf(newScenario())).toEqual([]);
  });

  it('a vector-level issue is shown at each component and a component issue only at itself', () => {
    const vectorIssue: ValidationIssue = {
      code: 'TYPE_MISMATCH',
      path: ['maneuvers', 0, 'deltaV_mps'],
      message: 'x',
    };
    expect(issuesForField([vectorIssue], maneuverDeltaVKey(0, 2))).toEqual([vectorIssue]);
    const component: ValidationIssue = { ...vectorIssue, path: ['maneuvers', 0, 'deltaV_mps', 1] };
    expect(issuesForField([component], maneuverDeltaVKey(0, 0))).toEqual([]);
    expect(issuesForField([component], maneuverDeltaVKey(0, 1))).toEqual([component]);
  });
});
