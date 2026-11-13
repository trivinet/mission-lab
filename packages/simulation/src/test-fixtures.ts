/**
 * Shared helpers for the unit tests of this package (not exported from the package).
 *
 * The orbits below are arbitrary test inputs in a realistic Earth range, chosen only to exercise
 * the runner; they are not reference cases and carry no reference values.
 */
import { EARTH_CONSTANTS } from '@mission-lab/astrodynamics';
import { validateSimulationResult } from '@mission-lab/contracts';
import type {
  ImpulsiveManeuver,
  Scenario,
  SimulationRequest,
  SimulationResult,
} from '@mission-lab/contracts';
import { expect } from 'vitest';
import { buildSimulationRequest, computeRequestId } from './request';
import { runSimulation } from './run';

/** A near-circular low orbit, 6000 s at 60 s, no maneuver. */
export function leoScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    schemaVersion: '1.0',
    id: 'test-scenario',
    name: 'Runner test',
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: { scale: 'UTC', iso: '2030-01-01T00:00:00.000Z' },
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7000000,
        eccentricity: 0.01,
        inclination_rad: 0.9,
        raan_rad: 1,
        argPeriapsis_rad: 2,
        trueAnomaly_rad: 0.5,
      },
    },
    maneuvers: [],
    duration_s: 6000,
    outputStep_s: 60,
    ...overrides,
  };
}

export function maneuver(t_s: number, deltaV_mps: [number, number, number]): ImpulsiveManeuver {
  return { id: 'burn-1', t_s, frame: 'RSW', deltaV_mps };
}

/** buildSimulationRequest, asserting success. */
export function requestOf(scenario: Scenario): SimulationRequest {
  const built = buildSimulationRequest(scenario);
  if (!built.ok) {
    throw new Error(`fixture scenario rejected: ${JSON.stringify(built.issues)}`);
  }
  return built.value;
}

/**
 * A request given directly in Cartesian form (not built from a scenario), with the Earth
 * constants and a correct requestId.
 */
export function cartesianRequest(
  position_m: [number, number, number],
  velocity_mps: [number, number, number],
  options: {
    duration_s?: number;
    outputStep_s?: number;
    maneuvers?: ImpulsiveManeuver[];
  } = {},
): SimulationRequest {
  const withoutId: Omit<SimulationRequest, 'requestId'> = {
    schemaVersion: '1.0',
    centralBody: 'EARTH',
    constants: {
      mu_m3ps2: EARTH_CONSTANTS.mu_m3ps2,
      referenceRadius_m: EARTH_CONSTANTS.referenceRadius_m,
      source: EARTH_CONSTANTS.source,
    },
    dynamicsModel: 'TWO_BODY',
    frame: 'GCRF',
    epoch: { scale: 'UTC', iso: '2030-01-01T00:00:00.000Z' },
    initialState: { position_m, velocity_mps },
    maneuvers: options.maneuvers ?? [],
    duration_s: options.duration_s ?? 6000,
    outputStep_s: options.outputStep_s ?? 60,
  };
  return { requestId: computeRequestId(withoutId), ...withoutId };
}

/** runSimulation, asserting a result (not issues) that passes validateSimulationResult. */
export function runOk(request: SimulationRequest): SimulationResult {
  const outcome = runSimulation(request);
  if (!outcome.ok) {
    throw new Error(`request rejected: ${JSON.stringify(outcome.issues)}`);
  }
  const check = validateSimulationResult(outcome.value);
  expect(check.ok ? [] : check.issues).toEqual([]);
  return outcome.value;
}

/** Sample k of a segment as [position, velocity]. */
export function sampleOf(
  segment: SimulationResult['segments'][number],
  k: number,
): { r: number[]; v: number[] } {
  return {
    r: Array.from(segment.position_m.subarray(3 * k, 3 * k + 3)),
    v: Array.from(segment.velocity_mps.subarray(3 * k, 3 * k + 3)),
  };
}

/** Element-wise Object.is equality of two number sequences. */
export function bitEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }
  return true;
}
