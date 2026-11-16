import type { Scenario } from '@mission-lab/contracts';

/**
 * The default scenario of `newScenario()` (ML-FR-001 AC1).
 *
 * PRODUCT DEFAULT, NOT A PHYSICAL REFERENCE. These values only give a new scenario something that
 * runs without further input; the owner confirms them at review (ML-TASK-021 report). They are
 * not constants of nature and no test compares them with a reference value. The gravitational
 * parameter and the reference radius are not set here: the engine supplies its own when it builds
 * the request.
 *
 * Units are SI (state stays in SI; display conversion is the formatting module's job):
 * - epoch:               2026-01-01T00:00:00.000Z, UTC
 * - semiMajorAxis_m:     7 000 000 m
 * - eccentricity:        0.01, dimensionless
 * - inclination_rad:     π / 4 rad (45 deg)
 * - raan_rad:            0 rad
 * - argPeriapsis_rad:    0 rad
 * - trueAnomaly_rad:     0 rad
 * - maneuvers:           none
 * - duration_s:          6000 s
 * - outputStep_s:        60 s (101 samples)
 */
export const DEFAULT_SCENARIO_VALUES = {
  name: 'New scenario',
  epochIso: '2026-01-01T00:00:00.000Z',
  semiMajorAxis_m: 7_000_000,
  eccentricity: 0.01,
  inclination_rad: Math.PI / 4,
  raan_rad: 0,
  argPeriapsis_rad: 0,
  trueAnomaly_rad: 0,
  duration_s: 6000,
  outputStep_s: 60,
} as const;

/** A fresh, valid default scenario with a new identifier (ML-FR-001 AC1). */
export function newScenario(): Scenario {
  const d = DEFAULT_SCENARIO_VALUES;
  return {
    schemaVersion: '1.0',
    id: crypto.randomUUID(),
    name: d.name,
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: { scale: 'UTC', iso: d.epochIso },
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: d.semiMajorAxis_m,
        eccentricity: d.eccentricity,
        inclination_rad: d.inclination_rad,
        raan_rad: d.raan_rad,
        argPeriapsis_rad: d.argPeriapsis_rad,
        trueAnomaly_rad: d.trueAnomaly_rad,
      },
    },
    maneuvers: [],
    duration_s: d.duration_s,
    outputStep_s: d.outputStep_s,
  };
}
