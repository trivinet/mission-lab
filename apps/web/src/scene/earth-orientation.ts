/**
 * Earth orientation for the 3D view. ILLUSTRATIVE (ADR-004): the Earth mesh is rotated about
 * inertial +Z by the Earth Rotation Angle
 *
 *   ERA = 2 pi (0.7790572732640 + 1.00273781191135448 T_u),  T_u = JD(UT1) - 2451545.0 (days),
 *
 * with UT1 approximated by UTC; precession, nutation and polar motion are ignored. The
 * coefficients are exactly those written in ADR-004 (IERS Conventions 2010, to be confirmed
 * against the primary source by the Verification Engineer). No numeric output is derived from
 * this angle; it only turns a picture. Ground tracks are out of M1.
 *
 * JD 2451545.0 is J2000.0, 2000-01-01 12:00; T_u is computed as elapsed days since that instant
 * (86 400 s per day) so no Julian-date offset constant is needed. Leap seconds are not handled
 * (ADR-004 consequences).
 */
export const ERA_FRACTION_AT_J2000 = 0.779057273264;
// The literal is written exactly as in ADR-004; binary64 rounds it to the nearest double.
// eslint-disable-next-line no-loss-of-precision
export const ERA_REVOLUTIONS_PER_UT1_DAY = 1.00273781191135448;

const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = 86_400_000;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** The label shown next to the Earth (ML-FR-007 AC3). */
export const EARTH_ORIENTATION_LABEL = 'Earth orientation: illustrative (ERA only, ADR-004)';

/** ERA in radians at `epochIso` plus `t_s` seconds; NaN if `epochIso` does not parse. */
export function earthRotationAngle_rad(epochIso: string, t_s: number): number {
  const days = (Date.parse(epochIso) - J2000_UTC_MS) / MS_PER_DAY + t_s / SECONDS_PER_DAY;
  return 2 * Math.PI * (ERA_FRACTION_AT_J2000 + ERA_REVOLUTIONS_PER_UT1_DAY * days);
}
