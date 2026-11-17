/**
 * Helpers for the analysis unit tests (not exported from the package).
 *
 * The scenarios are arbitrary test inputs; `defaultLikeScenario` copies the element values of the
 * web app's product default (apps/web/src/state/default-scenario.ts, which this package may not
 * import). None of them is a reference case and no test here holds a reference value.
 */
import type { Scenario, SimulationResult } from '@mission-lab/contracts';
import { leoScenario } from '../test-fixtures';

/** The product default's orbit (a = 7e6 m, e = 0.01, i = π/4, Ω = ω = ν = 0), 6000 s at 60 s. */
export function defaultLikeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return leoScenario({
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7_000_000,
        eccentricity: 0.01,
        inclination_rad: Math.PI / 4,
        raan_rad: 0,
        argPeriapsis_rad: 0,
        trueAnomaly_rad: 0,
      },
    },
    ...overrides,
  });
}

/** [position, velocity] of sample k of a segment, as tuples. */
export function stateAt(
  segment: SimulationResult['segments'][number],
  k: number,
): { r: [number, number, number]; v: [number, number, number] } {
  const p = segment.position_m;
  const v = segment.velocity_mps;
  const at = (a: Float64Array, i: number): number => {
    const x = a[i];
    if (x === undefined) {
      throw new Error(`index ${String(i)} out of range`);
    }
    return x;
  };
  return {
    r: [at(p, 3 * k), at(p, 3 * k + 1), at(p, 3 * k + 2)],
    v: [at(v, 3 * k), at(v, 3 * k + 1), at(v, 3 * k + 2)],
  };
}
