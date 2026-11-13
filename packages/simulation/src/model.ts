/**
 * Result model metadata (contracts-v1 §5.4; ML-FR-012 AC1–AC2; ML-SYS-001 §5.7).
 */
import { PACKAGE_VERSION as ASTRODYNAMICS_VERSION } from '@mission-lab/astrodynamics';
import type { ResultModel, SimulationRequest } from '@mission-lab/contracts';
import { PROVISIONAL_MAX_SAMPLE_COUNT } from './limits';

/**
 * `model.timeConvention` (contracts-v1 §5.4; ADR-004; proposed-architecture §3 "Epoch",
 * "Simulation time", "UTC labels").
 */
export const TIME_CONVENTION =
  'Epoch given in UTC (ISO 8601, millisecond precision). Every t_s is elapsed SI seconds since ' +
  'that epoch (binary64). Displayed UTC timestamps are epoch + t_s without leap-second handling.';

/**
 * `model.limitations` (contracts-v1 §5.4 guidance; ML-SYS-001 §5.7; proposed-architecture §3;
 * ADR-004). Each entry restates an approved model choice; none introduces a new one.
 */
export const MODEL_LIMITATIONS: readonly string[] = Object.freeze([
  'Point-mass two-body dynamics about the Earth only: no J2 or higher gravity harmonics, ' +
    'atmospheric drag, third-body or solar radiation pressure perturbations.',
  'Analytical Kepler propagation (universal variable); each sample is computed from its ' +
    "segment's initial state.",
  'Impulsive maneuvers only: instantaneous velocity change, position unchanged, no mass model; ' +
    'at most one maneuver per scenario in M1.',
  'Single inertial frame GCRF; no other frame is accepted or produced.',
  'Altitude and surface checks use a reference sphere of radius constants.referenceRadius_m, not ' +
    'the Earth ellipsoid; altitude is not geodetic altitude.',
  'UTC labels are epoch + elapsed seconds without leap-second handling.',
  'Any Earth orientation shown in the 3D view is illustrative only and is not used by the ' +
    'simulation (no Earth rotation model in M1).',
  `At most ${String(PROVISIONAL_MAX_SAMPLE_COUNT)} samples per run (provisional limit, to be ` +
    'measured in Phase 2).',
  'Not qualified for operational spacecraft navigation.',
]);

/**
 * The ResultModel of a run of `request` (contracts-v1 §5.4). `constants`, `sampling` and `epoch`
 * are copied from the request field by field (bit-identical numbers, same strings; VI-01).
 * `engineVersion` is the version of packages/astrodynamics (its PACKAGE_VERSION).
 */
export function buildResultModel(request: SimulationRequest): ResultModel {
  return {
    engineVersion: ASTRODYNAMICS_VERSION,
    centralBody: request.centralBody,
    dynamicsModel: request.dynamicsModel,
    propagator: 'KEPLER_UNIVERSAL_VARIABLE',
    maneuverModel: 'IMPULSIVE',
    frame: request.frame,
    epoch: { scale: request.epoch.scale, iso: request.epoch.iso },
    timeConvention: TIME_CONVENTION,
    sampling: { duration_s: request.duration_s, outputStep_s: request.outputStep_s },
    constants: {
      mu_m3ps2: request.constants.mu_m3ps2,
      referenceRadius_m: request.constants.referenceRadius_m,
      source: request.constants.source,
    },
    limitations: [...MODEL_LIMITATIONS],
  };
}
