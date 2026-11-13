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
