/**
 * The physical constants the engine puts into every SimulationRequest (ML-TASK-027).
 *
 * `buildSimulationRequest` copies `constants = { mu_m3ps2, referenceRadius_m, source }` from
 * `EARTH_CONSTANTS` of packages/astrodynamics (request.ts, step 5). apps/web may not import
 * packages/astrodynamics (ADR-002), so the same object is re-exported here: the editor (derived
 * quantities) and the 3D scene (Earth radius) read the values without building a request. No value
 * is retyped; values and their source are documented in packages/astrodynamics constants.ts
 * (WGS 84 defining parameters; confirmation in docs/verification/vt-19-constants.md).
 */
import { EARTH_CONSTANTS } from '@mission-lab/astrodynamics';
import type { CentralBodyConstants } from '@mission-lab/astrodynamics';

/**
 * μ [m^3/s^2], reference-sphere radius [m] and citation string of the M1 Earth model; the very
 * object `buildSimulationRequest` copies into `request.constants` (frozen). Frame: scalars, none.
 * The reference radius is a sphere, not the WGS 84 ellipsoid (MODEL_LIMITATIONS).
 */
export const ENGINE_CONSTANTS: CentralBodyConstants = EARTH_CONSTANTS;
