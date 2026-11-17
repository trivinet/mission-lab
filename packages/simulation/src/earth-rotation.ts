/**
 * Earth Rotation Angle for the 3D view (ML-TASK-027, Coordinator scope addition; ADR-004
 * "Earth orientation (display only)").
 *
 * ILLUSTRATIVE AND DISPLAY-ONLY. ADR-004: the Earth mesh is rotated about inertial +Z by the ERA,
 * with UT1 approximated by UTC; precession, nutation and polar motion are ignored; M1 derives no
 * numeric output from it (MODEL_LIMITATIONS: "illustrative only and is not used by the
 * simulation"). Nothing in the engine calls this function.
 *
 * Formula, as ADR-004 writes it (line 21):
 *     ERA = 2π (0.7790572732640 + 1.00273781191135448 · T_u),  T_u = JD(UT1) − 2451545.0
 * Confirmed by docs/verification/vt-19-constants.md §4.3 against IERS Conventions (2010), IERS
 * Technical Note 36, Eq. (5.14), §5.5.3, p. 52, and Table 1.1, p. 18 (string equality). Units: the
 * bracket is in revolutions, T_u in UT1 days; ERA in rad.
 *
 * Time: UT1 ≈ UTC (ADR-004), and UTC is epoch + t_s without leap seconds (TIME_CONVENTION), so
 * JD(UT1) is taken as the Julian date of the leap-second-free time value of `utc-label.ts`.
 * Relation of the ECMAScript time value to the Julian date: Unix time = (JD − 2440587.5) × 86400 s,
 * a count that excludes leap seconds (Wikipedia, "Julian day", section "Variants", row "Unix time";
 * accessed 2026-11-17; a secondary source, not a primary one). Hence
 *     T_u = (time_ms − J2000_ms) / 86 400 000,  J2000_ms = (2451545.0 − 2440587.5) · 86 400 000
 *         = 946 728 000 000 ms,
 * the time value of 2000-01-01T12:00:00.000Z (the same Wikipedia page, lead: JD 2451545 is the
 * day starting at 12:00 UT on 1 January 2000; the unit test checks that Date.parse of that instant
 * gives J2000_ms).
 */
import { normalizeAngle_rad } from '@mission-lab/astrodynamics';
import { epochTimeValue_ms } from './utc-label';

/** ERA at J2000.0 [rev]: 0.7790572732640 (ADR-004; TN36 Table 1.1, Eq. 5.14). */
export const ERA_AT_J2000_rev = 0.779057273264;

/**
 * ERA rate [rev per UT1 day]. ADR-004 and TN36 write 1.00273781191135448 (18 significant digits),
 * which binary64 cannot hold: that decimal parses to the double 1.0027378119113546
 * (0x3ff00b36cdc9f32b; vt-19-constants.md §4.3 notes, difference about 1.2e-16 rev/day). The literal
 * below is the shortest decimal of that same double, so `Number('1.00273781191135448')` equals
 * this constant exactly (asserted by the unit test); it avoids lint `no-loss-of-precision` without
 * changing the value the written coefficient denotes in binary64.
 */
export const ERA_RATE_revpday = 1.0027378119113546;

/** Julian date of J2000.0, 2451545.0 [day] (ADR-004; TN36 Eq. 5.14). */
const JD_J2000_day = 2451545.0;
/** Julian date of the ECMAScript/Unix time origin 1970-01-01T00:00Z, 2440587.5 [day] (see header). */
const JD_UNIX_EPOCH_day = 2440587.5;
/** Milliseconds per day of the leap-second-free time scale: 86 400 s × 1000. */
const MS_PER_DAY = 86_400_000;
/** Time value of J2000.0 [ms] = (2451545.0 − 2440587.5) × 86 400 000; exact in binary64. */
const J2000_TIME_VALUE_ms = (JD_J2000_day - JD_UNIX_EPOCH_day) * MS_PER_DAY;

/** Why `earthRotationAngle_rad` declines. */
export type EarthRotationAngleFailure =
  /** The epoch is not a canonical UTC ISO string (`isCanonicalUtcIso` is false). */
  | 'EPOCH_INVALID'
  /** t_s is NaN or ±Infinity. */
  | 'NON_FINITE_TIME'
  /**
   * The angle was not finite. Defensive: for finite inputs |T_u| ≤ about 2.1e303 days and the
   * bracket times 2π stays below about 1.4e304, so this is not reachable in binary64.
   */
  | 'NON_FINITE_RESULT';

/** Result of `earthRotationAngle_rad`. Never NaN. */
export type EarthRotationAngleResult =
  | { readonly ok: true; readonly angle_rad: number }
  | { readonly ok: false; readonly reason: EarthRotationAngleFailure };

/**
 * Earth Rotation Angle [rad, in [0, 2π)] at the instant epoch + t_s, for orienting the Earth mesh
 * about GCRF +Z. Illustrative and display-only (see module header): UT1 ≈ UTC, no precession,
 * nutation or polar motion; not used by any computation.
 *
 * Inputs: `epochIso`, the scenario epoch (UTC, canonical `YYYY-MM-DDTHH:MM:SS.sssZ`); `t_s`,
 * elapsed SI seconds since the epoch (finite; no leap seconds).
 *
 * Evaluation (fixed):
 * 1. epoch not canonical → EPOCH_INVALID; t_s not finite → NON_FINITE_TIME.
 * 2. T_u = (epoch_ms − J2000_ms) / 86 400 000 + t_s / 86 400   [UT1 day]
 *    (epoch_ms − J2000_ms is an exact integer difference; t_s is not rounded to milliseconds).
 * 3. ERA = 2π · (ERA_AT_J2000_rev + ERA_RATE_revpday · T_u)   (ADR-004, TN36 Eq. 5.14, as written)
 *    with 2π = 2 * Math.PI.
 * 4. Reduced to [0, 2π) by `normalizeAngle_rad` (packages/astrodynamics); non-finite →
 *    NON_FINITE_RESULT.
 *
 * Accuracy: Eq. (5.14) is evaluated as written, not in TN36's split form Eq. (5.15) that
 * vt-19-constants.md §4.3 mentions for limiting rounding. For |T_u| ≈ 1e4 days the bracket is
 * about 1e4 rev, whose binary64 spacing is about 2e-12 rev (≈ 1e-11 rad); immaterial for an
 * illustrative mesh orientation (ADR-004 accepts errors of tenths of a degree).
 *
 * Sources: ADR-004; IERS TN36 Eq. (5.14) via vt-19-constants.md §4.3; Julian-date relation from
 * Wikipedia "Julian day" (see header). Pure; never throws.
 */
export function earthRotationAngle_rad(epochIso: string, t_s: number): EarthRotationAngleResult {
  const epoch_ms = epochTimeValue_ms(epochIso);
  if (epoch_ms === undefined) {
    return { ok: false, reason: 'EPOCH_INVALID' };
  }
  if (!Number.isFinite(t_s)) {
    return { ok: false, reason: 'NON_FINITE_TIME' };
  }
  const tU_day = (epoch_ms - J2000_TIME_VALUE_ms) / MS_PER_DAY + t_s / (MS_PER_DAY / 1000);
  const era = normalizeAngle_rad(2 * Math.PI * (ERA_AT_J2000_rev + ERA_RATE_revpday * tU_day));
  if (!era.ok) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  return { ok: true, angle_rad: era.angle_rad };
}
