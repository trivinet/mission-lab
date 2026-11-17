/**
 * Transcription of the approved tolerance rows used by ML-TASK-036 (tolerance record revision 5,
 * approved by the owner on 2026-11-16). Nothing here is new; each function names its row.
 *
 *  - §8 VI-03 (b) table: per-sample tolerances of the analysis quantities of one state, M = 4,
 *    two sides, with κ_E(r) = (v²/2 + μ/r)/|ξ| and κ_h = r v/h evaluated from the REFERENCE state
 *    (§4.1 item 2); "Samples with e or i′ within a factor 2 of a threshold of §10 are excluded".
 *  - §7 VT-15 "FR-010 AC3 comparison table": r_{p,a}: |δr| ≤ |δa|(1 ± e) + a|δe|;
 *    δT/T ≤ (3/2)|δa|/a + 6u; differences: sum of both operands' tolerances (absolute).
 *  - §7 VT-12 (inertial Δv) and VT-13 (Δv magnitude) for the applied-Δv rows of the table.
 *
 * Where the record is silent the function returns null with a reason; no value is invented
 * (conformance-run-5.md §3 lists these places):
 *  - e, ω, ν on an open (hyperbolic) state: the e-vector budget (30u per side) is derived for
 *    bound orbits only (§7 VT-03 "terms of size ≤ 2, 1, 2 (vis-viva)"; §7 VT-15 rev. 4: "valid for
 *    bound post-maneuver orbits, v²r/μ < 2").
 *  - Ω on an equatorial state, ω and ν on a circular state (convention-assigned; rows "only if").
 *  - r_p, r_a, T as HISTORIES: the VI-03 (b) table has no row; the FR-010 AC3 rows are written for
 *    the comparison table only.
 *  - r_p, r_a, T on an open state (r_a and T do not exist; the record has no hyperbolic r_p row).
 */
import { MARGIN as M, U as u } from './tolerances';

export const EPS_E = 1e-5;
export const EPS_I = 1e-5;

/** Reference-side inputs of one state (from the reference trajectory, §4.1 item 2). */
export interface Vi03Inputs {
  readonly radius_m: number;
  readonly altitude_m: number;
  readonly speed_mps: number;
  readonly semiMajorAxis_m: number;
  readonly eccentricity: number;
  readonly inclination_rad: number;
  readonly iPrime_rad: number;
  readonly kappaE: number;
  readonly kappaH: number;
  readonly energyScale_m2ps2: number;
  readonly closed: boolean;
}

export type Vi03Quantity =
  | 'radius_m'
  | 'altitude_m'
  | 'speed_mps'
  | 'specificEnergy_m2ps2'
  | 'semiMajorAxis_m'
  | 'eccentricity'
  | 'inclination_rad'
  | 'raan_rad'
  | 'argPeriapsis_rad'
  | 'trueAnomaly_rad';

export const VI03_QUANTITIES: readonly Vi03Quantity[] = [
  'radius_m',
  'altitude_m',
  'speed_mps',
  'specificEnergy_m2ps2',
  'semiMajorAxis_m',
  'eccentricity',
  'inclination_rad',
  'raan_rad',
  'argPeriapsis_rad',
  'trueAnomaly_rad',
];

/** Absolute tolerance (same unit as the quantity; rad for angles, compared modulo 2π) or null. */
export interface Tol {
  readonly value: number | null;
  /** Why value is null (absent when asserted). */
  readonly reason?: string;
}

export const REASON = {
  nearThreshold:
    'Sample excluded: e or i′ within a factor 2 of a §10 threshold (§8 VI-03 (b); classification may differ)',
  openE:
    'Record silent: the e-vector budget (30u per side) is derived for bound orbits only (§7 VT-03; §7 VT-15 rev. 4 "valid for bound post-maneuver orbits")',
  equatorial: 'Ω row applies only if not equatorial (§8 VI-03 (b)); Ω := 0 by convention',
  circular: 'ω and ν rows apply only if not circular (§8 VI-03 (b)); assigned by convention',
  noHistoryRow:
    'Record silent: §8 VI-03 (b) has no row for r_p, r_a, T histories (FR-010 AC3 rows cover the comparison table only)',
  open: 'Not defined on an open orbit (r_a, T) / no record row for a hyperbolic r_p',
  operand: 'Difference not asserted: an operand is not asserted',
} as const;

/** True when e or i′ is within a factor 2 of its threshold (both bounds inclusive). */
export function nearThreshold(e: number, iPrime: number): boolean {
  const near = (x: number, eps: number): boolean => x >= eps / 2 && x <= 2 * eps;
  return near(e, EPS_E) || near(iPrime, EPS_I);
}

/** §8 VI-03 (b) table, all ten rows, for one reference state. */
export function vi03Tolerances(s: Vi03Inputs): Record<Vi03Quantity, Tol> {
  if (nearThreshold(s.eccentricity, s.iPrime_rad)) {
    const x: Tol = { value: null, reason: REASON.nearThreshold };
    return {
      radius_m: x,
      altitude_m: x,
      speed_mps: x,
      specificEnergy_m2ps2: x,
      semiMajorAxis_m: x,
      eccentricity: x,
      inclination_rad: x,
      raan_rad: x,
      argPeriapsis_rad: x,
      trueAnomaly_rad: x,
    };
  }
  const circular = s.eccentricity < EPS_E;
  const equatorial = s.iPrime_rad < EPS_I;
  const sinI = Math.sin(s.inclination_rad);
  const e = s.eccentricity;
  const kh = s.kappaH;
  return {
    radius_m: { value: M * 6 * u * s.radius_m },
    altitude_m: { value: M * (6 * u * s.radius_m + 2 * u * Math.abs(s.altitude_m)) },
    speed_mps: { value: M * 6 * u * s.speed_mps },
    specificEnergy_m2ps2: { value: M * 10 * u * s.energyScale_m2ps2 },
    semiMajorAxis_m: { value: M * 11 * u * s.kappaE * Math.abs(s.semiMajorAxis_m) },
    eccentricity: s.closed ? { value: M * 60 * u } : { value: null, reason: REASON.openE },
    inclination_rad: { value: M * 2 * (4.3 * kh + 9.2) * u },
    raan_rad: equatorial
      ? { value: null, reason: REASON.equatorial }
      : { value: M * 2 * (6.3 + (4.3 * kh) / sinI) * u },
    argPeriapsis_rad: !s.closed
      ? { value: null, reason: REASON.openE }
      : circular
        ? { value: null, reason: REASON.circular }
        : { value: M * 2 * (12 + 42.5 / e + (equatorial ? 0 : (4.3 * kh) / sinI)) * u },
    trueAnomaly_rad: !s.closed
      ? { value: null, reason: REASON.openE }
      : circular
        ? { value: null, reason: REASON.circular }
        : { value: M * 2 * (12 + 42.5 / e) * u },
  };
}

/** §7 VT-15 FR-010 AC3 rows: r_p, r_a, T from the a and e tolerances of the same state. */
export function fr010ClosedTolerances(
  s: Vi03Inputs,
  t: Record<Vi03Quantity, Tol>,
  period_s: number | null,
): { periapsisRadius_m: Tol; apoapsisRadius_m: Tol; period_s: Tol } {
  const da = t.semiMajorAxis_m.value;
  const de = t.eccentricity.value;
  if (!s.closed || period_s === null) {
    const x: Tol = { value: null, reason: REASON.open };
    return { periapsisRadius_m: x, apoapsisRadius_m: x, period_s: x };
  }
  if (da === null || de === null) {
    const x: Tol = {
      value: null,
      reason: t.semiMajorAxis_m.reason ?? t.eccentricity.reason ?? REASON.operand,
    };
    return { periapsisRadius_m: x, apoapsisRadius_m: x, period_s: x };
  }
  const a = s.semiMajorAxis_m;
  const e = s.eccentricity;
  return {
    periapsisRadius_m: { value: da * (1 - e) + a * de },
    apoapsisRadius_m: { value: da * (1 + e) + a * de },
    period_s: { value: period_s * ((3 / 2) * (da / a) + 6 * u) },
  };
}

/** §7 VT-15 FR-010 AC3: difference after − before, absolute, sum of both operands' tolerances. */
export function differenceTolerance(before: Tol, after: Tol): Tol {
  if (before.value === null || after.value === null) {
    return { value: null, reason: REASON.operand };
  }
  return { value: before.value + after.value };
}

/** κ_h⁻ = 1/√(1 − e⁻²) of the pre-maneuver orbit (§7 VT-12 / VT-15 rev. 4 evaluation). */
export function kappaHOfOrbit(e: number): number {
  return 1 / Math.sqrt(1 - e * e);
}

/** §7 VT-12: ‖ΔΔv_I‖ ≤ M·2·(12κ_h + 25)u‖Δv_RSW‖ (normwise, m/s). */
export function vt12InertialDeltaV(kappaH: number, dvRswNorm_mps: number): number {
  return M * 2 * (12 * kappaH + 25) * u * dvRswNorm_mps;
}

/** §7 VT-13: |deltaV_magnitude_mps − ‖deltaV_inertial_mps‖_test| ≤ M·6u‖Δv‖ (m/s). */
export function vt13Magnitude(dvNorm_mps: number): number {
  return M * 6 * u * dvNorm_mps;
}

/** §7 VT-13 physics cross-check: |‖Δv_I‖ − ‖Δv_RSW‖| ≤ M(12κ_h + 25 + 6)u‖Δv‖ (m/s). */
export function vt13MagnitudeVsRsw(kappaH: number, dvNorm_mps: number): number {
  return M * (12 * kappaH + 31) * u * dvNorm_mps;
}
