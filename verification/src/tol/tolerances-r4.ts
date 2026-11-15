/**
 * Transcription of the revision-4 formulas of docs/verification/tolerances.md (ML-VER-002
 * revision 4, approved by the owner on 2026-11-15; ML-TASK-018 part D2). Each function names its
 * section. Nothing here is new: the formulas are evaluated mechanically at a dataset's own scale
 * with reference-side inputs (§4.1 item 2). tolerances-r4.test.ts checks the transcription against
 * every evaluated number printed in revision 4 (§6.8, §7 VT-15, §9.3.1).
 *
 * Independence: written from the record only; packages/astrodynamics and packages/simulation were
 * not read (ADR-003).
 */
import { MARGIN, U, pB, pE, tauEEng, vB, vE, type Scales } from './tolerances';

/** Margined per-side L3 factor 3M of §9.3 / §9.3.1. */
export const L3_FACTOR = 3 * MARGIN;

/** e⁺ below which the general e⁺ formula replaces the tangential one (§7 VT-15, review N1). */
export const E_PLUS_GENERAL_BELOW = 1e-6;

// ---------------------------------------------------------------------------------------------
// §7 VT-15 revision 4 (P-2)

/** Burn kinds of §7 VT-15. 'apsis-tangential' = burn along ±S at an apsis. */
export type BurnKind = 'apsis-tangential' | 'normal' | 'radial' | 'combined';

/** Reference-side inputs of one VT-15 case (all from the reference post-maneuver state). */
export interface Vt15Inputs {
  /** Scales of the pre-maneuver orbit (grid case): a⁻, e⁻, κ_h⁻ = 1/√(1 − e⁻²), P_b, V_b. */
  readonly sPre: Scales;
  readonly kind: BurnKind;
  /** Maneuver time m (s); term (i) and the tilt term enter only for m > 0. */
  readonly m: number;
  /** ‖Δv_RSW‖ (m/s). */
  readonly dv: number;
  /** Post-maneuver semi-major axis a⁺, eccentricity e⁺ (reference). */
  readonly aPlus: number;
  readonly ePlus: number;
  /** Burn radius r, post-maneuver speed v⁺ and angular momentum h⁺ at the burn point. */
  readonly r: number;
  readonly vPlus: number;
  readonly hPlus: number;
  readonly mu: number;
}

export interface Vt15R4Tol {
  /** |δa⁺|/a⁺. */
  readonly aRelative: number;
  /** |δe⁺| (absolute). */
  readonly eAbsolute: number;
  /** Which e⁺ formula applied. */
  readonly eFormula: 'tangential' | 'general';
  /** Plane-normal error δψ_n = ‖ĥ⁺_engine − ĥ⁺_ref‖ (rad). */
  readonly planeNormal_rad: number;
  /** Plane-rotation angle error |δψ| (rad). */
  readonly planeRotation_rad: number;
  /** κ_h⁺ = r v⁺/h⁺ used. */
  readonly kappaHPlus: number;
}

function kappaHPre(sPre: Scales): number {
  return sPre.kappaH;
}

/** ε_Δv/u = 12κ_h⁻ + 25 (VT-12 per-side budget, §7 VT-15 term (iv)). */
function dirCoef(sPre: Scales): number {
  return 12 * kappaHPre(sPre) + 25;
}

/** Tilt of the engine's pre-maneuver plane, 2(P_b v⁺ + r V_b)/h⁺ (§7 VT-15, mode A, m > 0). */
function tilt(x: Vt15Inputs): number {
  return x.m > 0 ? (2 * (pB(x.sPre) * x.vPlus + x.r * vB(x.sPre))) / x.hPlus : 0;
}

/** General e⁺ per-side state term (4rv⁺/μ)((12κ_h⁻ + 25)u‖Δv‖ + u v⁺) (§7 VT-15). */
function eGeneralTerm(x: Vt15Inputs): number {
  return ((4 * x.r * x.vPlus) / x.mu) * (dirCoef(x.sPre) * U * x.dv + U * x.vPlus);
}

/**
 * §7 VT-15 revision 4, L2 (engine vs exact closed form), "new version" column. Mode A at m = 0, or
 * at m > 0 for tangential burns at an apsis only (the caller must not pass other burns at m > 0).
 */
export function vt15R4(x: Vt15Inputs): Vt15R4Tol {
  if (x.m > 0 && x.kind !== 'apsis-tangential') {
    throw new RangeError('VT-15: mode A at m > 0 only for tangential burns at an apsis (§7)');
  }
  const kHp = (x.r * x.vPlus) / x.hPlus;
  const s = x.sPre;
  let aRel: number;
  if (x.kind === 'apsis-tangential') {
    const termI = x.m > 0 ? tauEEng(s, x.m) * (x.aPlus / s.a) : 0;
    const extra = Math.max(0, (24 * x.aPlus * x.vPlus * x.dv) / x.mu - 1) * U;
    aRel = MARGIN * (termI + 11 * U * ((4 * x.aPlus) / x.r - 1) + extra);
  } else {
    aRel =
      MARGIN *
      (11 * U * ((4 * x.aPlus) / x.r - 1) + (2 * x.aPlus * x.vPlus * dirCoef(s) * U * x.dv) / x.mu);
  }
  const general = x.kind !== 'apsis-tangential' || x.ePlus < E_PLUS_GENERAL_BELOW;
  const eAbs = general
    ? MARGIN * (eGeneralTerm(x) + 60 * U)
    : MARGIN * (((x.r / x.aPlus) * aRel) / MARGIN + 60 * U);
  const stateN = kHp * U * ((2 * dirCoef(s) * x.dv) / x.vPlus + 14);
  return {
    aRelative: aRel,
    eAbsolute: eAbs,
    eFormula: general ? 'general' : 'tangential',
    planeNormal_rad: MARGIN * (stateN + tilt(x)),
    planeRotation_rad: MARGIN * (stateN + 12 * U * kappaHPre(s) + 32 * U + tilt(x)),
    kappaHPlus: kHp,
  };
}

/**
 * §9.3.1 VT-15 L3 rows: tolerances 3M·X_a, 3M·X_e, 3M·X_n, 3M·X_ψ (Orekit's post-maneuver a⁺, e⁺
 * and plane vs the engine's, each from its own post-maneuver state).
 */
export function vt15L3(x: Vt15Inputs): Vt15R4Tol {
  const kHp = (x.r * x.vPlus) / x.hPlus;
  const s = x.sPre;
  const tangential = x.kind === 'apsis-tangential';
  const termI = x.m > 0 ? tauEEng(s, x.m) * (x.aPlus / s.a) : 0;
  const dirA = tangential
    ? Math.max(0, (24 * x.aPlus * x.vPlus * x.dv) / x.mu - 1) * U
    : (2 * x.aPlus * x.vPlus * dirCoef(s) * U * x.dv) / x.mu;
  const xA = termI + 6 * U * ((4 * x.aPlus) / x.r - 1) + dirA;
  const general = !tangential || x.ePlus < E_PLUS_GENERAL_BELOW;
  const xE = general ? eGeneralTerm(x) + 30 * U : (x.r / x.aPlus) * xA + 30 * U;
  const xN = kHp * U * ((2 * dirCoef(s) * x.dv) / x.vPlus + 8) + tilt(x);
  const xPsi = xN + 6 * U * kappaHPre(s) + 16 * U;
  return {
    aRelative: L3_FACTOR * xA,
    eAbsolute: L3_FACTOR * xE,
    eFormula: general ? 'general' : 'tangential',
    planeNormal_rad: L3_FACTOR * xN,
    planeRotation_rad: L3_FACTOR * xPsi,
    kappaHPlus: kHp,
  };
}

// ---------------------------------------------------------------------------------------------
// §9.3 / §9.3.1 other L3 rows

/** §9.3.1 VT-02 L3: ‖Δr‖ ≤ 3M·η_r(e)·u·r_a, ‖Δv‖ ≤ 3M·η_v(e)·u·v_p. */
export function vt02L3(s: Scales): { position_m: number; velocity_mps: number } {
  const e = s.e;
  const etaR = 31 + 2 / (1 - e * e) + (1 + 3 * e) / (1 - e);
  const etaV = 25 + 1 / (1 - e * e) + 7 / (1 + e);
  return {
    position_m: L3_FACTOR * etaR * U * s.ra,
    velocity_mps: L3_FACTOR * etaV * U * s.vp,
  };
}

/** §9.3.1 VT-12 L3: ‖ΔΔv_I‖ ≤ 12(12κ_h + 25)u‖Δv_RSW‖; returns the relative factor. */
export function vt12L3(kappaH: number): number {
  return L3_FACTOR * (12 * kappaH + 25) * U;
}

/** §9.3 L3 propagation row: ‖Δr‖ ≤ 3M·P_E(Δt), ‖Δv‖ ≤ 3M·V_E(Δt). */
export function propagationL3(s: Scales, dt: number): { position_m: number; velocity_mps: number } {
  return { position_m: L3_FACTOR * pE(s, dt), velocity_mps: L3_FACTOR * vE(s, dt) };
}

// ---------------------------------------------------------------------------------------------
// §6.8 hyperbolic arcs (P-3)

/** Arc-wide data of a hyperbolic arc (§6.8 "Parametrisation", "Conditioning factors"). */
export interface HyperbolicArc {
  readonly mu: number;
  readonly r0: number;
  readonly v0: number;
  readonly energy: number;
  /** E/(v₀²/2 + μ/r₀) at the start of the arc (validity gate of §7 VT-16). */
  readonly energyRatio: number;
  readonly aAbs: number;
  readonly e: number;
  readonly p: number;
  readonly nH: number;
  readonly q0: number;
  readonly sinhF0: number;
  readonly coshF0: number;
  readonly F0: number;
  readonly cosPhi0: number;
  /** Δt of the last sample of the arc (s). */
  readonly dtEnd: number;
  readonly xEnd: number;
  readonly rEnd: number;
  readonly periapsisPassed: boolean;
  readonly rMin: number;
  readonly rMax: number;
  readonly vMax: number;
  readonly gMax: number;
  readonly kappaE: number;
  readonly Kb: number;
  readonly Kbv: number;
  /** P_b,gen, V_b,gen (§6.8 "Engine bound"). */
  readonly pBgen: number;
  readonly vBgen: number;
  /** P_b,gen in the |a| form (10κ_E|a| instead of 10κ_E r_max), for the record's comparison. */
  readonly pBgenAbsAForm: number;
}

/** Solves e sinh F − F = Mh for F (Newton, binary64; used for tolerance evaluation only). */
export function solveHyperbolicKepler(Mh: number, e: number): number {
  let F = Math.asinh(Mh / e);
  for (let it = 0; it < 100; it++) {
    const f = e * Math.sinh(F) - F - Mh;
    const step = f / (e * Math.cosh(F) - 1);
    F -= step;
    if (Math.abs(step) <= 4e-16 * Math.max(1, Math.abs(F))) return F;
  }
  throw new Error('solveHyperbolicKepler: no convergence');
}

function dot(a: readonly number[], b: readonly number[]): number {
  return (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0);
}

/** x = F − F₀ and r at Δt on the arc. */
export function hyperbolicAt(arc: HyperbolicArc, dt: number): { x: number; r: number } {
  const Mh = arc.e * arc.sinhF0 - arc.F0 + arc.nH * dt;
  const F = solveHyperbolicKepler(Mh, arc.e);
  return { x: F - arc.F0, r: arc.aAbs * (arc.e * Math.cosh(F) - 1) };
}

/**
 * Prepares the arc-wide factors of §6.8 from the reference post-maneuver state (r₀, v₀) and the Δt
 * of the arc's last sample. Throws if the state is not hyperbolic.
 */
export function prepareHyperbolicArc(
  mu: number,
  position_m: readonly number[],
  velocity_mps: readonly number[],
  dtEnd: number,
): HyperbolicArc {
  const r0 = Math.sqrt(dot(position_m, position_m));
  const v2 = dot(velocity_mps, velocity_mps);
  const v0 = Math.sqrt(v2);
  const rv = dot(position_m, velocity_mps);
  const energy = v2 / 2 - mu / r0;
  if (!(energy > 0)) throw new RangeError('prepareHyperbolicArc: E ≤ 0');
  const hx =
    (position_m[1] ?? 0) * (velocity_mps[2] ?? 0) - (position_m[2] ?? 0) * (velocity_mps[1] ?? 0);
  const hy =
    (position_m[2] ?? 0) * (velocity_mps[0] ?? 0) - (position_m[0] ?? 0) * (velocity_mps[2] ?? 0);
  const hz =
    (position_m[0] ?? 0) * (velocity_mps[1] ?? 0) - (position_m[1] ?? 0) * (velocity_mps[0] ?? 0);
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const aAbs = mu / (2 * energy);
  const e = Math.sqrt(1 + (2 * energy * h * h) / (mu * mu));
  const p = (h * h) / mu;
  const nH = Math.sqrt(mu / (aAbs * aAbs * aAbs));
  const sigma0 = rv / Math.sqrt(mu);
  const coshF0 = (1 + r0 / aAbs) / e;
  const sinhF0 = sigma0 / (Math.sqrt(aAbs) * e);
  const F0 = Math.asinh(sinhF0);
  const q0 = (r0 * v0) / Math.sqrt(mu * aAbs);
  const cosPhi0 = h / (r0 * v0);
  const partial = {
    mu,
    r0,
    v0,
    energy,
    energyRatio: energy / (v2 / 2 + mu / r0),
    aAbs,
    e,
    p,
    nH,
    q0,
    sinhF0,
    coshF0,
    F0,
    cosPhi0,
    dtEnd,
  };
  const end = hyperbolicAt({ ...partial } as HyperbolicArc, dtEnd);
  const Fend = F0 + end.x;
  const periapsisPassed = F0 < 0 && Fend >= 0;
  const rMin = periapsisPassed ? aAbs * (e - 1) : Math.min(r0, end.r);
  const rMax = Math.max(r0, end.r);
  const vMax = Math.sqrt(mu * (2 / rMin + 1 / aAbs));
  const gMax = mu / (rMin * rMin);
  const kappaE = 1 + (4 * aAbs) / rMin;
  const Kb = r0 * (1 + (2 * rMax) / p) + rMax / cosPhi0 + rMax;
  const Kbv = 2 * vMax + 2 * (1 + (2 * r0) / p) * v0;
  return {
    ...partial,
    xEnd: end.x,
    rEnd: end.r,
    periapsisPassed,
    rMin,
    rMax,
    vMax,
    gMax,
    kappaE,
    Kb,
    Kbv,
    pBgen: U * (20 * Kb + 10 * kappaE * rMax + 2 * aAbs),
    vBgen: U * (20 * Kbv + 5 * kappaE * vMax + (2 * aAbs * v0) / rMin),
    pBgenAbsAForm: U * (20 * Kb + 10 * kappaE * aAbs + 2 * aAbs),
  };
}

export interface HyperbolicSampleBound {
  readonly x: number;
  readonly r: number;
  /** S_eval (units of u |a|^(3/2)). */
  readonly sEval: number;
  /** ε_t,gen, δt_g,gen, δt_ph (s). */
  readonly epsTgen: number;
  readonly dtGgen: number;
  readonly dtPh: number;
  /** Unmargined engine bounds P_E,gen, V_E,gen. */
  readonly pEgen: number;
  readonly vEgen: number;
}

/** §6.8 time-equation rows, ε_t,gen, δt_g,gen, δt_ph and P_E,gen, V_E,gen at Δt (arc-wide factors). */
export function hyperbolicBound(arc: HyperbolicArc, dt: number): HyperbolicSampleBound {
  const { x, r } = hyperbolicAt(arc, dt);
  const ch = Math.cosh(x);
  const sh = Math.sinh(x);
  const cm1 = ch - 1;
  const smx = sh - x;
  const e = arc.e;
  const sF = Math.abs(arc.sinhF0);
  const ra = arc.r0 / arc.aAbs;
  const t1 = e * arc.sinhF0 * cm1;
  const t2 = e * arc.coshF0 * smx;
  const t3 = ra * x;
  const rows = [
    (3 * arc.q0 + 2 * e * sF) * cm1,
    e * sF * (2.5 * x * sh + 2 * ch + 8 * cm1),
    (4 * ra + e * arc.coshF0) * smx,
    e * arc.coshF0 * (2.5 * x * cm1 + 2 * sh + 11.5 * smx),
    4 * ra * x,
    2 * (Math.abs(t1) + Math.abs(t2) + Math.abs(t3)),
    2 * arc.nH * dt,
  ];
  const sEval = rows.reduce((acc, v) => acc + v, 0);
  const epsTgen = (U * (2 * sEval + (r / arc.aAbs) * x)) / arc.nH;
  const dtGgen = (U * (2.5 * x * cm1 + 2 * sh + 12.5 * smx)) / arc.nH;
  const dtPh = U * (7.5 * arc.kappaE * dt + dt + (2.5 * x * arc.rMax) / (arc.aAbs * arc.nH));
  const pEgen = arc.pBgen + arc.vMax * (dtPh + 2 * epsTgen + dtGgen);
  const vEgen =
    arc.vBgen +
    arc.gMax * (dtPh + epsTgen) +
    ((2 * arc.vMax * arc.vMax) / arc.rMin) * (epsTgen + dtGgen);
  return { x, r, sEval, epsTgen, dtGgen, dtPh, pEgen, vEgen };
}

/** §7 VT-16 validity gate (owner decision 2026-11-15): E/(v²/2 + μ/r) ≥ 0.05 at the start. */
export const VT16_VALIDITY_GATE = 0.05;
