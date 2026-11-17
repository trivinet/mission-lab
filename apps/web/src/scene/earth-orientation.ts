/**
 * Earth orientation for the 3D view. ILLUSTRATIVE (ADR-004): the Earth mesh is rotated about
 * inertial +Z by the Earth Rotation Angle that the engine computes
 * (`earthRotationAngle_rad` of `@mission-lab/simulation`; UT1 approximated by UTC, no precession,
 * nutation or polar motion, no leap seconds). This module computes nothing: it asks the engine for
 * the angle and returns it, or `null` when the engine declines (invalid epoch), in which case the
 * Earth is drawn unrotated. No numeric output is derived from this angle; it only turns a picture.
 */
import { earthRotationAngle_rad as engineEarthRotationAngle_rad } from '@mission-lab/simulation';

/** The label shown next to the Earth (ML-FR-007 AC3). */
export const EARTH_ORIENTATION_LABEL = 'Earth orientation: illustrative (ERA only, ADR-004)';

/** ERA in radians, in [0, 2 pi), at `epochIso` plus `t_s` seconds; null if the engine declines. */
export function earthRotationAngle_rad(epochIso: string, t_s: number): number | null {
  const result = engineEarthRotationAngle_rad(epochIso, t_s);
  return result.ok ? result.angle_rad : null;
}
