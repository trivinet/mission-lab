/**
 * Transcription of the approved tolerance formulas of docs/verification/tolerances.md
 * (ML-VER-002 revision 3, approved by the owner on 2026-11-13). Each function names its section.
 *
 * Nothing here is new: the formulas are evaluated mechanically at a dataset's own scale, as §4
 * requires ("a dataset at another scale uses the formula re-evaluated at its own scale"), with
 * every conditioning input taken from the reference side (§4.1 item 2). The transcription is
 * checked against every evaluated number printed in the record (tolerances.test.ts).
 */

/** Unit round-off of binary64, u = 2^-53 (§2). */
export const U = 2 ** -53;
/** Margin factor (§3). */
export const MARGIN = 4;
/** Stumpff/Lagrange bounded-term coefficient (§6.2). */
export const C_B = 20;

/** Derived scales of §4 for an orbit (a, e) under μ. */
export interface Scales {
  readonly mu: number;
  readonly a: number;
  readonly e: number;
  readonly rp: number;
  readonly ra: number;
  readonly n: number;
  readonly T: number;
  readonly vp: number;
  readonly gp: number;
  readonly h: number;
  readonly energy: number;
  readonly kappaH: number;
  readonly kappaE: number;
  readonly kappaB: number;
  readonly kappaBV: number;
  readonly Ct: number;
}

export function scales(mu: number, a: number, e: number): Scales {
  const rp = a * (1 - e);
  const ra = a * (1 + e);
  const n = Math.sqrt(mu / (a * a * a));
  const kappaH = 1 / Math.sqrt(1 - e * e);
  const kappaE = 4 / (1 - e) - 1;
  return {
    mu,
    a,
    e,
    rp,
    ra,
    n,
    T: (2 * Math.PI) / n,
    vp: Math.sqrt((mu / a) * ((1 + e) / (1 - e))),
    gp: mu / (rp * rp),
    h: Math.sqrt(mu * a * (1 - e * e)),
    energy: mu / (2 * a),
    kappaH,
    kappaE,
    kappaB: 2 + 2 / (1 - e) + kappaH,
    kappaBV: 4 + 4 / (1 - e),
    Ct: 7.5 * kappaE + 4,
  };
}

/** L = |Δt| + 1/n (§6.3). */
export function spanL(s: Scales, dt: number): number {
  return Math.abs(dt) + 1 / s.n;
}

// ---------------------------------------------------------------------------------------------
// VT-02 (§7)

/** Position normwise relative budget η_r(e) (§7 VT-02), in units of u. */
export function etaR(e: number): number {
  return 31 + 2 / (1 - e * e) + (1 + 3 * e) / (1 - e);
}

/** Velocity budget η_v(e) relative to v_p (§7 VT-02), in units of u. */
export function etaV(e: number): number {
  return 25 + 1 / (1 - e * e) + 7 / (1 + e);
}

export interface PosVelTol {
  readonly position_m: number;
  readonly velocity_mps: number;
}

/** VT-02: ‖Δr‖ ≤ M·2η_r(e)·u·r_a, ‖Δv‖ ≤ M·2η_v(e)·u·v_p. */
export function vt02(s: Scales): PosVelTol {
  return {
    position_m: MARGIN * 2 * etaR(s.e) * U * s.ra,
    velocity_mps: MARGIN * 2 * etaV(s.e) * U * s.vp,
  };
}

// ---------------------------------------------------------------------------------------------
// VT-03 (§7)

export function bRt(s: Scales): number {
  const e = s.e;
  return (
    5 * s.kappaE + 90 / (1 - e) + (6 * s.kappaH + 55) + 31 + 2 / (1 - e * e) + (1 + 3 * e) / (1 - e)
  );
}

export function bVt(s: Scales): number {
  const e = s.e;
  return 2.5 * s.kappaE + 90 / (1 - e) + (6 * s.kappaH + 55) + 25 + 1 / (1 - e * e) + 7 / (1 + e);
}

/** VT-03: ‖Δr‖ ≤ M·B_rt·u·r_a, ‖Δv‖ ≤ M·B_vt·u·v_p. */
export function vt03(s: Scales): PosVelTol {
  return {
    position_m: MARGIN * bRt(s) * U * s.ra,
    velocity_mps: MARGIN * bVt(s) * U * s.vp,
  };
}

// ---------------------------------------------------------------------------------------------
// VT-04 (§7)

/** Computed-e bound of an exactly circular state, ê ≤ 30u (§7 VT-04(a)). */
export const E_HAT_EXACT_CIRCULAR = 30 * U;

/** Computed i' bound of an i = Math.PI input, î' ≤ (6κ_h + 2)u (§7 VT-04(a)). */
export function iHatExactRetrograde(s: Scales): number {
  return (6 * s.kappaH + 2) * U;
}

/**
 * VT-04: VT-03 plus the convention term (no margin on the convention term):
 * ‖Δr‖ ≤ M B_rt u r_a + r_a(2e_c/(1 − e_c) + 4 sin(i_c/2)),
 * ‖Δv‖ ≤ M B_vt u v_p + v_p(2√2 e_c/(1 + e_c) + 4 sin(i_c/2)).
 * e_c, i_c: the eccentricity / i' entering the convention term (0 when the convention for that
 * element does not apply). For exactly degenerate inputs they are the bounds ê, î' of VT-04(a);
 * for near-degenerate inputs the reference-side e and i' (VT-04(b)).
 */
export function vt04(s: Scales, eConv: number, iConv: number): PosVelTol {
  const base = vt03(s);
  const iTerm = 4 * Math.sin(iConv / 2);
  return {
    position_m: base.position_m + s.ra * ((2 * eConv) / (1 - eConv) + iTerm),
    velocity_mps: base.velocity_mps + s.vp * ((2 * Math.SQRT2 * eConv) / (1 + eConv) + iTerm),
  };
}

// ---------------------------------------------------------------------------------------------
// Propagation budgets (§6)

/** Solver residual budget ε_t(Δt) = u[(25 + 65e)|Δt| + (12 + 114e + 130e²)/n] (§6.1), seconds. */
export function epsT(s: Scales, dt: number): number {
  const e = s.e;
  return U * ((25 + 65 * e) * Math.abs(dt) + (12 + 114 * e + 130 * e * e) / s.n);
}

/** Time-equation evaluation noise δt_eval = u[(12 + 32e)|Δt| + (6 + 56e + 64e²)/n] (§6.1). */
export function dtEval(s: Scales, dt: number): number {
  const e = s.e;
  return U * ((12 + 32 * e) * Math.abs(dt) + (6 + 56 * e + 64 * e * e) / s.n);
}

/** g-formation noise δt_g = u[17.5|Δt| + (2 + 35e)/n] (§6.1). */
export function dtG(s: Scales, dt: number): number {
  return U * (17.5 * Math.abs(dt) + (2 + 35 * s.e) / s.n);
}

/**
 * α data error at fixed χ, δt_α = 5uκ[(1 + 2e)|Δt| + (4e + 4e²)/n] (§6.1). κ defaults to κ_E;
 * §6.1 allows the smaller 4a/r₀ − 1 of the case's exact initial state.
 */
export function dtAlpha(s: Scales, dt: number, kappa = s.kappaE): number {
  const e = s.e;
  return 5 * U * kappa * ((1 + 2 * e) * Math.abs(dt) + (4 * e + 4 * e * e) / s.n);
}

/** O-1 acceptance threshold ε_t + δt_α (§6.1, §12), seconds. */
export function o1Threshold(s: Scales, dt: number, kappa = s.kappaE): number {
  return epsT(s, dt) + dtAlpha(s, dt, kappa);
}

/** Bounded engine terms P_b, V_b (§6.3). */
export function pB(s: Scales): number {
  return U * (C_B * s.kappaB * s.ra + 10 * s.kappaE * s.a);
}

export function vB(s: Scales): number {
  return U * (C_B * s.kappaBV + 5 * s.kappaE) * s.vp;
}

/** Engine bound P_E(Δt), V_E(Δt), unmargined (§6.3). */
export function pE(s: Scales, dt: number): number {
  const L = spanL(s, dt);
  return pB(s) + s.vp * (U * s.Ct * L + 2 * epsT(s, dt) + dtG(s, dt));
}

export function vE(s: Scales, dt: number): number {
  const L = spanL(s, dt);
  const res = epsT(s, dt);
  return vB(s) + s.gp * (U * s.Ct * L + res + 2 * (1 + s.e) * (res + dtG(s, dt)));
}

/** L2a time budget δt_A = u[(9 + e)|Δt| + (22π + 10√((1 + e)/(1 − e)) + 16e)/n] (§6.4). */
export function dtA(s: Scales, dt: number): number {
  const e = s.e;
  const bA = 22 * Math.PI + 10 * Math.sqrt((1 + e) / (1 - e)) + 16 * e;
  return U * ((9 + e) * Math.abs(dt) + bA / s.n);
}

/** L2a reference bound P_A(Δt), V_A(Δt), unmargined (§6.4). */
export function pA(s: Scales, dt: number): number {
  const L = spanL(s, dt);
  return U * bRt(s) * s.ra + s.vp * (7.5 * s.kappaE * U * L + dtA(s, dt));
}

export function vA(s: Scales, dt: number): number {
  const L = spanL(s, dt);
  return U * bVt(s) * s.vp + s.gp * (7.5 * s.kappaE * U * L + dtA(s, dt));
}

/** VT-05 vs L2a: ‖Δr‖ ≤ M[P_E + P_A], ‖Δv‖ ≤ M[V_E + V_A] (§7 VT-05). */
export function vt05L2a(s: Scales, dt: number): PosVelTol {
  return {
    position_m: MARGIN * (pE(s, dt) + pA(s, dt)),
    velocity_mps: MARGIN * (vE(s, dt) + vA(s, dt)),
  };
}

/** VT-05 vs L2b: ‖Δr‖ ≤ M P_E + 2E_RK,r, ‖Δv‖ ≤ M V_E + 2E_RK,v (§7 VT-05). */
export function vt05L2b(s: Scales, dt: number, eRkR: number, eRkV: number): PosVelTol {
  return {
    position_m: MARGIN * pE(s, dt) + 2 * eRkR,
    velocity_mps: MARGIN * vE(s, dt) + 2 * eRkV,
  };
}

/**
 * Reference-vs-reference bound L2a vs L2b used by §9.1 to validate L2a:
 * ‖Δr‖ ≤ M P_A + 2E_RK,r, ‖Δv‖ ≤ M V_A + 2E_RK,v.
 */
export function l2aVsL2b(s: Scales, dt: number, eRkR: number, eRkV: number): PosVelTol {
  return {
    position_m: MARGIN * pA(s, dt) + 2 * eRkR,
    velocity_mps: MARGIN * vA(s, dt) + 2 * eRkV,
  };
}

/** VT-08: ‖Δr‖ ≤ M[P_E(NT) + u(7.5κ_E + 6) v_p NT], velocity with g_p (§7 VT-08). */
export function vt08(s: Scales, spanNT: number): PosVelTol {
  const k = U * (7.5 * s.kappaE + 6) * spanNT;
  return {
    position_m: MARGIN * (pE(s, spanNT) + k * s.vp),
    velocity_mps: MARGIN * (vE(s, spanNT) + k * s.gp),
  };
}

/** Engine bound at Δt = 0 (§7 VT-05; applies only if O-10 were not adopted). */
export function vt05AtZero(s: Scales): PosVelTol {
  return { position_m: MARGIN * pE(s, 0), velocity_mps: MARGIN * vE(s, 0) };
}

/**
 * State→elements comparison rows of §8 VI-03(b), used here for the element view of VT-03/VT-04
 * (no propagation enters). Values in units of the quantity (e dimensionless, angles rad).
 */
export function elementRows(
  kappaH: number,
  e: number,
  sinI: number,
): { e: number; i: number; raan: number | null; argp: number | null; nu: number | null } {
  const two = MARGIN * 2 * U;
  return {
    e: MARGIN * 60 * U,
    i: two * (4.3 * kappaH + 9.2),
    raan: sinI > 0 ? two * (6.3 + (4.3 * kappaH) / sinI) : null,
    argp: e > 0 && sinI > 0 ? two * (12 + 42.5 / e + (4.3 * kappaH) / sinI) : null,
    nu: e > 0 ? two * (12 + 42.5 / e) : null,
  };
}

/** §9.2 target for the RK reference: E_RK ≤ 1e-10 r_max. */
export const E_RK_TARGET_REL = 1e-10;

// ---------------------------------------------------------------------------------------------
// ML-TASK-018 part C: the remaining families of §7. Transcription only, same rules as above.

/** VT-01 (§7): (a) 4(2√2 + 3)u ≈ 23.3u × ‖a‖²‖b‖ for |a·(a × b)| and |b·(a × b)|. */
export const VT01_CROSS_ORTHOGONALITY = MARGIN * (2 * Math.SQRT2 + 3) * U;
/** VT-01 (§7): (b) 4·2(2√2 + 3)u ≈ 46.6u × ‖a‖‖b‖‖c‖ for a·(b × c) − b·(c × a). */
export const VT01_TRIPLE_PRODUCT = MARGIN * 2 * (2 * Math.SQRT2 + 3) * U;
/** VT-01 (§7): (c) 4·6u = 24u relative, engine norm vs the test's own norm. */
export const VT01_NORM = MARGIN * 6 * U;
/** VT-01 (§7): (d) 4·7u = 28u, |‖x/‖x‖‖ − 1|. */
export const VT01_UNIT = MARGIN * 7 * U;

/**
 * Engine part of VT-06 (§7 VT-06), unmargined, used again by VT-14 and VT-15:
 * τ_E,eng(Δt) = (v_p V_b + g_p P_b)/|E| + (3 + 2e)(v_p g_p/|E|)(δt_res + δt_g), δt_res = ε_t.
 */
export function tauEEng(s: Scales, dt: number): number {
  const bounded = (s.vp * vB(s) + s.gp * pB(s)) / s.energy;
  const offOrbit = (3 + 2 * s.e) * ((s.vp * s.gp) / s.energy) * (epsT(s, dt) + dtG(s, dt));
  return bounded + offOrbit;
}

/** VT-06 (§7): τ_E(Δt) = M[10uκ_E + τ_E,eng(Δt)], relative energy deviation. */
export function vt06(s: Scales, dt: number): number {
  return MARGIN * (10 * U * s.kappaE + tauEEng(s, dt));
}

/**
 * VT-07 (§7): τ_h(Δt) = M[6uκ_h + (P_b v_p + r_a V_b + (v_p² + 2(1 + e) r_a g_p)(δt_res + δt_g))/h],
 * normwise relative deviation of the angular-momentum vector.
 */
export function vt07(s: Scales, dt: number): number {
  const off = (s.vp * s.vp + 2 * (1 + s.e) * s.ra * s.gp) * (epsT(s, dt) + dtG(s, dt));
  return MARGIN * (6 * U * s.kappaH + (pB(s) * s.vp + s.ra * vB(s) + off) / s.h);
}

export interface Vt11Tol {
  /** max |(BᵀB − I)_jk| and ‖R × S − W‖: M(2ε_S + 3u) = 4(12κ_h + 25)u. */
  readonly orthonormality: number;
  /** ‖R − r/‖r‖‖: M·2ε_R = 32u. */
  readonly rParallel: number;
  /** ‖W − (r × v)/‖r × v‖‖: M·2ε_W = 4(12κ_h + 8)u. */
  readonly wParallel: number;
}

/** VT-11 (§7), κ_h of the pre-maneuver orbit (reference side). */
export function vt11(kappaH: number): Vt11Tol {
  return {
    orthonormality: MARGIN * (12 * kappaH + 25) * U,
    rParallel: MARGIN * 8 * U,
    wParallel: MARGIN * (12 * kappaH + 8) * U,
  };
}

/** VT-12 (§7): ‖ΔΔv_I‖ ≤ 8(12κ_h + 25)u ‖Δv_RSW‖ (relative factor returned). */
export function vt12(kappaH: number): number {
  return MARGIN * 2 * (12 * kappaH + 25) * U;
}

export interface Vt13Tol {
  /** |deltaV_magnitude_mps − test's ‖deltaV_inertial_mps‖| ≤ 24u‖Δv‖ (relative factor). */
  readonly magnitude: number;
  /** |‖deltaV_inertial_mps‖ − ‖Δv_RSW‖| ≤ 4(12κ_h + 31)u‖Δv‖ (relative factor). */
  readonly rotationNorm: number;
}

/** VT-13 (§7). */
export function vt13(kappaH: number): Vt13Tol {
  return { magnitude: MARGIN * 6 * U, rotationNorm: MARGIN * (12 * kappaH + 31) * U };
}

/** Clohessy–Wiltshire transport factors of §7 VT-14, valid for e = 0 only (O-11). */
export const VT14_K_R = 14;
export const VT14_K_V = 9;

/**
 * VT-14 (§7), e = 0 only (O-11): maneuvered (zero Δv at m) vs coast run at t > m.
 * ‖Δr‖ ≤ M[P_E(t) + v_p(uC_t L_m + δt_res(m)) + P_E(t − m) + (3/2)τ_E,eng(m) v_p (t − m)
 *          + K_r P_off(m) + K_v V_off(m)/n];
 * velocity: v_p → g_p in the time-like terms, P_E → V_E, transport K_r V_off(m) + K_v n P_off(m).
 * P_off(m) = P_b + v_p δt_off(m), V_off(m) = V_b + 2(1 + e) g_p δt_off(m), δt_off = δt_res + δt_g.
 */
export function vt14(s: Scales, m: number, t: number): PosVelTol {
  if (s.e !== 0) throw new RangeError('VT-14 transport factors are derived for e = 0 only (O-11)');
  const Lm = spanL(s, m);
  const res = epsT(s, m);
  const off = res + dtG(s, m);
  const pOff = pB(s) + s.vp * off;
  const vOff = vB(s) + 2 * (1 + s.e) * s.gp * off;
  const tau = tauEEng(s, m);
  const phaseR = s.vp * (U * s.Ct * Lm + res);
  const phaseV = s.gp * (U * s.Ct * Lm + res);
  return {
    position_m:
      MARGIN *
      (pE(s, t) +
        phaseR +
        pE(s, t - m) +
        1.5 * tau * s.vp * (t - m) +
        VT14_K_R * pOff +
        (VT14_K_V * vOff) / s.n),
    velocity_mps:
      MARGIN *
      (vE(s, t) +
        phaseV +
        vE(s, t - m) +
        1.5 * tau * s.gp * (t - m) +
        VT14_K_R * vOff +
        VT14_K_V * s.n * pOff),
  };
}

export interface Vt15Tol {
  /** |δa⁺|/a⁺ ≤ M[τ_E,eng(m)·a⁺/a⁻ + 11u(4a⁺/r − 1)]. */
  readonly aRelative: number;
  /** |δe⁺| ≤ M[(r/a⁺)(|δa⁺|/a⁺)/M + 60u] with |δa⁺|/a⁺ the margined a⁺ tolerance. */
  readonly eAbsolute: number;
}

/**
 * VT-15 (§7), tangential burn at an apsis. sPre: scales of the pre-maneuver orbit; m: maneuver
 * time (Δt of the pre-maneuver propagation); aPlus: closed-form a⁺; r: burn radius.
 */
export function vt15(sPre: Scales, m: number, aPlus: number, r: number): Vt15Tol {
  const aRel = MARGIN * (tauEEng(sPre, m) * (aPlus / sPre.a) + 11 * U * ((4 * aPlus) / r - 1));
  return { aRelative: aRel, eAbsolute: MARGIN * (((r / aPlus) * aRel) / MARGIN + 60 * U) };
}
