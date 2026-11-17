import { buildSimulationRequest } from '@mission-lab/simulation';
import { describe, expect, it } from 'vitest';
import { fromDeg } from '../format/units';
import { createScenarioStore } from '../state/scenario-store';
import type { ScenarioStore } from '../state/scenario-store';
import { ANGLE_KEYS, isAngleKey, normaliseAngles } from './normalise-angles';

/** The runner is never used: normalisation does not run a simulation. */
const neverRun = (): Promise<never> => Promise.reject(new Error('no run expected'));

function storeWith(angles: { raan: number; argp: number; nu: number }): ScenarioStore {
  const store = createScenarioStore(neverRun);
  const { setElement } = store.getState();
  setElement('raan_rad', fromDeg(angles.raan));
  setElement('argPeriapsis_rad', fromDeg(angles.argp));
  setElement('trueAnomaly_rad', fromDeg(angles.nu));
  return store;
}

const TWO_PI = 2 * Math.PI;

function angles(store: ScenarioStore): number[] {
  const e = store.getState().scenario.initialOrbit.elements;
  return [e.raan_rad, e.argPeriapsis_rad, e.trueAnomaly_rad];
}

describe('angle normalisation to [0, 360) deg (ML-FR-002 AC2)', () => {
  it('maps values outside the range into [0, 2 pi) and the scenario then validates', () => {
    // 370 deg -> 10 deg, -10 deg -> 350 deg, 720 deg -> 0 deg; expected values are written out here,
    // not computed by the code under test.
    const store = storeWith({ raan: 370, argp: -10, nu: 720 });
    expect(buildSimulationRequest(store.getState().scenario).ok).toBe(false);
    normaliseAngles(store);
    const [raan, argp, nu] = angles(store);
    expect(raan).toBeCloseTo(fromDeg(10), 12);
    expect(argp).toBeCloseTo(fromDeg(350), 12);
    expect(nu).toBe(0);
    for (const value of [raan, argp, nu]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(TWO_PI);
    }
    expect(buildSimulationRequest(store.getState().scenario).ok).toBe(true);
  });

  it('maps exactly 360 deg to 0 (never 2 pi)', () => {
    const store = storeWith({ raan: 360, argp: 0, nu: 0 });
    normaliseAngles(store);
    expect(angles(store)[0]).toBe(0);
  });

  it('leaves in-range angles untouched and does not stale a current result', () => {
    const store = storeWith({ raan: 30, argp: 40, nu: 50 });
    const before = angles(store);
    const stateBefore = store.getState().resultState;
    normaliseAngles(store);
    expect(angles(store)).toEqual(before);
    expect(store.getState().resultState).toBe(stateBefore);
  });

  it('changes nothing when the rest of the orbit is invalid (the engine declines)', () => {
    const store = storeWith({ raan: 400, argp: 0, nu: 0 });
    store.getState().setElement('eccentricity', 1.5);
    const before = angles(store);
    normaliseAngles(store);
    expect(angles(store)).toEqual(before);
  });

  it('identifies the three angle fields', () => {
    expect(ANGLE_KEYS.every(isAngleKey)).toBe(true);
    expect(isAngleKey('eccentricity')).toBe(false);
  });
});
