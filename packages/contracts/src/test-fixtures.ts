/**
 * Structurally valid contract objects for the tests of this package.
 *
 * Every number here is an arbitrary placeholder chosen only to satisfy the structural rules. None
 * is a physical constant or a reference value, and no trajectory here is physically consistent.
 */
import type { Scenario } from './scenario';
import type { SimulationRequest } from './request';
import type { SimulationResult } from './result';

export function validScenario(): Scenario {
  return {
    schemaVersion: '1.0',
    id: 'scenario-1',
    name: 'Structural fixture',
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: { scale: 'UTC', iso: '2030-01-02T03:04:05.678Z' },
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7000000,
        eccentricity: 0.1,
        inclination_rad: 0.5,
        raan_rad: 1,
        argPeriapsis_rad: 2,
        trueAnomaly_rad: 3,
      },
    },
    maneuvers: [{ id: 'm1', t_s: 100, frame: 'RSW', deltaV_mps: [1, 2, 3] }],
    duration_s: 1000,
    outputStep_s: 10,
  };
}

export function validRequest(): SimulationRequest {
  return {
    requestId: `sha256:${'0'.repeat(64)}`,
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
}

/** Two segments split at t_s = 100 by one event. */
export function validResult(): SimulationResult {
  return {
    requestId: `sha256:${'0'.repeat(64)}`,
    model: {
      engineVersion: '0.1.0',
      centralBody: 'EARTH',
      dynamicsModel: 'TWO_BODY',
      propagator: 'KEPLER_UNIVERSAL_VARIABLE',
      maneuverModel: 'IMPULSIVE',
      frame: 'GCRF',
      epoch: { scale: 'UTC', iso: '2030-01-02T03:04:05.678Z' },
      timeConvention: 'placeholder',
      sampling: { duration_s: 1000, outputStep_s: 10 },
      constants: { mu_m3ps2: 1, referenceRadius_m: 0.5, source: 'placeholder' },
      limitations: ['placeholder'],
    },
    segments: [
      {
        index: 0,
        t_s: new Float64Array([0, 50, 100]),
        position_m: new Float64Array(9).fill(1),
        velocity_mps: new Float64Array(9).fill(2),
      },
      {
        index: 1,
        t_s: new Float64Array([100, 1000]),
        position_m: new Float64Array(6).fill(1),
        velocity_mps: new Float64Array(6).fill(3),
      },
    ],
    events: [
      {
        maneuverId: 'm1',
        t_s: 100,
        position_m: [1, 1, 1],
        velocityBefore_mps: [2, 2, 2],
        velocityAfter_mps: [3, 3, 3],
        deltaV_inertial_mps: [1, 1, 1],
        deltaV_magnitude_mps: 1.5,
      },
    ],
    diagnostics: [
      { severity: 'warning', code: 'ESCAPE_TRAJECTORY', message: 'placeholder', t_s: 100 },
    ],
    status: 'ok',
  };
}
