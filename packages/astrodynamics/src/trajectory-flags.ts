/**
 * Post-maneuver trajectory classification for the runtime warnings ESCAPE_TRAJECTORY and
 * REFERENCE_SPHERE_INTERSECTION (ML-TASK-016; ML-FR-006 AC6; contracts-v1 §8.3; tolerance record
 * open item O-5).
 *
 * STATUS: DESIGN PROPOSAL. The approved documents leave the detection semantics open (contracts-v1
 * §8.3 last paragraph; tolerances.md VT-16 and O-5). This module implements the reading stated
 * below; every choice marked [Dn] is listed for owner approval in docs/backlog/tasks/ML-TASK-016.yaml.
 *
 * Units SI (m, s, m/s, m^3/s^2, m^2/s^2). Frame: r and v in one inertial frame (GCRF in M1); all
 * outputs are scalars and frame-independent. Pure functions; no throw; never NaN or ±Infinity in
 * a success. Both are ANALYTICAL: they use conic invariants and closed-form anomaly relations, not
 * the samples of a trajectory.
 *
 * ---------------------------------------------------------------------------------------------
 * Derivations (from the definitions; notation as elements.ts D1–D6 and kepler-universal.ts D1–D5)
 * T1  Energy integral ξ = v·v/2 − μ/|r| (elements.ts D4). With h = |r × v| and the eccentricity
 *     vector of elements.ts D2, |e|² = 1 + 2ξh²/μ² (square D2 and use |r × v|² = r²v² − (r·v)²).
 *     Hence for h ≠ 0: e ≥ 1 ⇔ ξ ≥ 0, i.e. "open conic" (contracts-v1 §8.3: "e ≥ 1") is the sign
 *     of the energy. For h = 0 (rectilinear) the formula gives e = 1 for every energy; such a state
 *     escapes only if ξ ≥ 0 (motion along a line with ξ < 0 is bounded: |r| ≤ μ/|ξ|). [D1] uses ξ.
 * T2  Periapsis radius (elements.ts D3, D6): r_p = p/(1 + e), p = h²/μ, e = |e_vec| with
 *     e_vec = ((v·v − μ/|r|) r − (r·v) v)/μ (elements.ts D2). Valid for every conic; for h = 0 it
 *     gives r_p = 0 (the line passes through the centre).
 * T3  Radius along the conic in the universal anomaly χ (kepler-universal.ts D2, D3):
 *       r(χ) = r₀ c0(ψ) + σ₀ χ c1(ψ) + χ² c2(ψ),  ψ = αχ²,  σ₀ = r·v/√μ,  α = 2/r₀ − v²/μ,
 *     and its derivative σ(χ) = dr/dχ = σ₀ c0 + (1 − α r₀) χ c1 (differentiate with
 *     kepler-universal.ts D3; consistent with σ' = 1 − α r of D2). dt/dχ = r/√μ > 0, so t is an
 *     increasing function of χ, and t(χ) = (σ₀ χ² c2 + (1 − α r₀) χ³ c3 + r₀ χ)/√μ (D4).
 *     The minima of r(χ) are the periapsis passages: zeros of σ where σ increases.
 *     - α > 0, k = √α: c0 = cos kχ, χ c1 = sin(kχ)/k. With e sin E₀ = σ₀ k and e cos E₀ = 1 − α r₀
 *       (E₀ the eccentric anomaly at t = 0; check: r(0) = (1 − e cos E₀)/α = r₀), T3 becomes
 *       r = (1 − e cos(E₀ + kχ))/α and σ = (e/k) sin(E₀ + kχ). Periapsis at E₀ + kχ ≡ 0 (mod 2π).
 *       With E₀ = atan2(σ₀k, 1 − αr₀) ∈ (−π, π], the next passage (χ > 0) is
 *       χ_p = −E₀/k if E₀ < 0, else (2π − E₀)/k.
 *     - α < 0, k = √(−α): c0 = cosh kχ, χ c1 = sinh(kχ)/k; σ is strictly increasing (σ' = 1 − αr
 *       > 0), so there is a future periapsis iff σ₀ < 0, at tanh(kχ_p) = −σ₀k/(1 − αr₀), i.e.
 *       χ_p = atanh(−σ₀k/(1 − αr₀))/k.
 *     - α = 0: σ = σ₀ + (1 − αr₀)χ; future periapsis iff σ₀ < 0, at χ_p = −σ₀/(1 − αr₀).
 *     t_p = t(χ_p) is then explicit (no root solve).
 * T4  min over t ∈ [0, D] of r(t) is attained at t = 0, t = D, or at a periapsis passage inside
 *     (0, D] (r is smooth and its interior minima are periapses). Every periapsis has radius r_p
 *     (T2), and the first one (t_p of T3) is the earliest. Hence
 *       ∃ t ∈ [0, D]: r(t) ≤ R  ⇔  r₀ ≤ R  ∨  r(D) ≤ R  ∨  (t_p ≤ D ∧ r_p ≤ R).
 *     This covers: already inside at start; moving toward periapsis (crossing before or after D);
 *     moving away from periapsis on a closed orbit (the next periapsis may or may not fall in the
 *     span; later revolutions repeat the same r_p, so the first passage decides); open orbits
 *     (at most one periapsis passage, none if σ₀ ≥ 0).
 * Sources: derived here from the definitions above (elements.ts D2–D6, kepler-universal.ts D1–D5,
 * whose cross-checks are listed in those files). No new source was opened for this module; the
 * eccentric-anomaly relations r = a(1 − e cos E) etc. are standard textbook material (e.g. Vallado,
 * Curtis) but were NOT opened here: not confirmed. They are not needed as authority: T3 is checked
 * in the comment by substitution.
 *
 * ---------------------------------------------------------------------------------------------
 * ENERGY ROUNDING (used by `classifyEscape`). Evaluation (same order as stateIntegrals):
 *   n̂ = normVec3(r);  Â = dotVec3(v, v)/2;  B̂ = μ/n̂;  ξ̂ = Â − B̂.
 * With u = 2^-53 (first order; tolerances.md §2 B1–B4; assumption A2: Math.sqrt correctly
 * rounded; no underflow or overflow in Â, B̂):
 *   Â = (v²/2)(1 + θ₃)  (sum of three non-negative squares; /2 exact),  |θ₃| ≤ 3u
 *   n̂ = |r|(1 + θ), |θ| ≤ 3u (B4);  B̂ = (μ/|r|)(1 + θ'), |θ'| ≤ 4u
 *   |ξ̂ − ξ| ≤ 3uA + 4uB + u|ξ̂| ≤ 4uA + 5uB ≤ 5u(A + B)    (A = v²/2, B = μ/|r|, exact values).
 * The code uses η = 6u (Â + B̂): the extra 1u (factor 6/5) covers the second-order terms, the
 * difference between computed and exact A, B, and the two roundings in forming η. Hence
 * (under A2 and without underflow) ξ̂ < −η ⇒ ξ < 0 and ξ̂ > η ⇒ ξ > 0, where ξ is the EXACT energy
 * of the given binary64 state and μ. η is not a tuning epsilon: it is the derived evaluation-error
 * bound of the formula, and it is returned so a caller or test can see it.
 *
 * What the flags do NOT account for: the error of the state itself (propagation and maneuver
 * rounding, of the order of the VT-05…VT-15 tolerances, which are far larger than η). The flags
 * classify the state they are given.
 */

import { propagateKeplerUniversal } from './kepler-universal';
import type { KeplerPropagationFailure } from './kepler-universal';
import { stumpff } from './stumpff';
import { crossVec3, dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

const UNIT_ROUNDOFF = 2 ** -53;

/**
 * Factor of the energy evaluation-error bound η = ESCAPE_ENERGY_BOUND_FACTOR · u · (v²/2 + μ/|r|)
 * (derived in the module comment: 5u first order, +1u for second-order terms and the evaluation of
 * η itself). Not a tolerance; changing it requires re-deriving the bound.
 */
export const ESCAPE_ENERGY_BOUND_FACTOR = 6;

function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

// ---------------------------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------------------------

/**
 * Conic regime of a state from the sign of its specific energy:
 * - 'CLOSED': ξ̂ < −η, so the exact energy is negative (ellipse, or bounded rectilinear motion);
 * - 'OPEN': ξ̂ > η, so the exact energy is positive (hyperbola);
 * - 'NEAR_PARABOLIC': |ξ̂| ≤ η, the sign of the exact energy is not decided by the binary64
 *   evaluation (this includes the exactly parabolic case ξ = 0).
 */
export type ConicRegime = 'CLOSED' | 'OPEN' | 'NEAR_PARABOLIC';

/** Result data of `classifyEscape`. */
export interface EscapeClassification {
  /** ξ̂ = v·v/2 − μ/|r| [m^2/s^2] (same evaluation as stateIntegrals). */
  readonly specificEnergy_m2ps2: number;
  /** η = 6u (v·v/2 + μ/|r|) [m^2/s^2]: derived bound on |ξ̂ − ξ| (module comment). */
  readonly energyRoundingBound_m2ps2: number;
  readonly regime: ConicRegime;
  /**
   * The ESCAPE_TRAJECTORY flag: true unless the conic is provably closed (regime !== 'CLOSED').
   * [D2] A state whose energy sign is undecidable in binary64 is flagged (conservative).
   */
  readonly escape: boolean;
}

/** Why `classifyEscape` declines. */
export type EscapeClassificationFailure =
  /** A component or μ is NaN or ±Infinity. */
  | 'NON_FINITE_INPUT'
  /** μ ≤ 0. */
  | 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE'
  /** r = 0. */
  | 'ZERO_POSITION'
  /** Overflow in v·v, μ/|r| or the bound. */
  | 'NON_FINITE_RESULT';

/** Result of `classifyEscape`. */
export type EscapeClassificationResult =
  | { readonly ok: true; readonly classification: EscapeClassification }
  | { readonly ok: false; readonly reason: EscapeClassificationFailure };

/**
 * Escape classification of a state (ML-FR-006 AC6 "escapes (e ≥ 1)"; contracts-v1 §8.3
 * ESCAPE_TRAJECTORY "post-maneuver conic is open (e ≥ 1)").
 *
 * @param position_m r [m], inertial frame.
 * @param velocity_mps v [m/s], same frame.
 * @param mu_m3ps2 μ [m^3/s^2], > 0.
 * @returns regime, flag, ξ̂ and its evaluation-error bound η, or a failure. Never throws.
 *
 * Criterion [D1]: the sign of the specific energy ξ (T1: e ≥ 1 ⇔ ξ ≥ 0 for h ≠ 0; for h = 0 the
 * energy, not e = 1, decides). Decision rule [D2]: escape = !(ξ̂ < −η) with η the derived bound
 * (module comment), i.e. the flag is set unless the exact energy of the given state is provably
 * negative. It does not depend on the time span or on the reference radius.
 *
 * Evaluation order (fixed): n = normVec3(r); A = dotVec3(v, v) / 2; B = μ / n; ξ = A − B;
 * η = (6 * u) * (A + B).
 */
export function classifyEscape(
  position_m: Vec3,
  velocity_mps: Vec3,
  mu_m3ps2: number,
): EscapeClassificationResult {
  if (!isFiniteVec3(position_m) || !isFiniteVec3(velocity_mps) || !Number.isFinite(mu_m3ps2)) {
    return { ok: false, reason: 'NON_FINITE_INPUT' };
  }
  if (!(mu_m3ps2 > 0)) {
    return { ok: false, reason: 'GRAVITATIONAL_PARAMETER_NOT_POSITIVE' };
  }
  const rn = normVec3(position_m);
  if (rn === 0) {
    return { ok: false, reason: 'ZERO_POSITION' };
  }
  const kinetic = dotVec3(velocity_mps, velocity_mps) / 2;
  const potential = mu_m3ps2 / rn;
  const specificEnergy_m2ps2 = kinetic - potential;
  const energyRoundingBound_m2ps2 =
    ESCAPE_ENERGY_BOUND_FACTOR * UNIT_ROUNDOFF * (kinetic + potential);
  if (!Number.isFinite(specificEnergy_m2ps2) || !Number.isFinite(energyRoundingBound_m2ps2)) {
    return { ok: false, reason: 'NON_FINITE_RESULT' };
  }
  let regime: ConicRegime;
  if (specificEnergy_m2ps2 < -energyRoundingBound_m2ps2) {
    regime = 'CLOSED';
  } else if (specificEnergy_m2ps2 > energyRoundingBound_m2ps2) {
    regime = 'OPEN';
  } else {
    regime = 'NEAR_PARABOLIC';
  }
  return {
    ok: true,
    classification: {
      specificEnergy_m2ps2,
      energyRoundingBound_m2ps2,
      regime,
      escape: regime !== 'CLOSED',
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Reference-sphere intersection
// ---------------------------------------------------------------------------------------------

/** Which branch of T4 established the intersection (first one that holds, in this order). */
export type ReferenceSphereIntersectionReason =
  /** |r(0)| ≤ R. */
  | 'INSIDE_AT_START'
  /** A periapsis passage at t_p ∈ (0, D] with r_p ≤ R. */
  | 'PERIAPSIS_BELOW_REFERENCE_IN_SPAN'
  /** |r(D)| ≤ R (the radius crossed R on the way to a periapsis after D). */
  | 'INSIDE_AT_END';

/** Result data of `detectReferenceSphereIntersection`. */
export interface ReferenceSphereIntersection {
  /** The REFERENCE_SPHERE_INTERSECTION flag: some t ∈ [0, D] has |r(t)| ≤ R (T4). */
  readonly intersects: boolean;
  /** First branch of T4 that holds, or null when `intersects` is false. */
  readonly reason: ReferenceSphereIntersectionReason | null;
  /** r_p = p/(1 + e) [m] (T2). 0 for a rectilinear state. */
  readonly periapsisRadius_m: number;
  /**
   * t_p [s] from the start of the span to the next periapsis passage (T3), or null when there is
   * none (open conic moving outward) or its time overflows binary64 (closed orbit of enormous
   * period moving outward); in both cases it is later than any finite span. A state exactly at
   * periapsis reports the NEXT passage (one period later for a closed orbit, null for an open one).
   */
  readonly timeToPeriapsis_s: number | null;
  /** |r(0)| [m] (normVec3 of the input position). */
  readonly radiusAtStart_m: number;
  /**
   * |r(D)| [m]: normVec3 of propagateKeplerUniversal(μ, r, v, D).position_m, i.e. the same value a
   * segment's last sample at Δt = D has when it is produced by that call.
   */
  readonly radiusAtEnd_m: number;
}

/** Why `detectReferenceSphereIntersection` declines. */
export type ReferenceSphereIntersectionFailure =
  /**
   * Non-finite input, μ ≤ 0, R ≤ 0, D < 0 (−0 is accepted as 0), or r = 0.
   */
  | 'INVALID_INPUT'
  /** The propagation to D failed; `propagationFailure` gives the propagator's reason (for
   *  'RECTILINEAR_COLLISION' also `collisionDeltaT_s`). */
  | 'PROPAGATION_FAILED'
  /**
   * r_p or the time of an existing future periapsis passage is not finite (overflow; for an open
   * conic moving inward only when the state is extremely far out on the asymptote, where
   * tanh(kχ_p) rounds to 1), or a computed t_p < 0 for an existing passage (excluded in exact
   * arithmetic). Reported instead of guessing.
   */
  | 'NON_FINITE_RESULT';

/** Result of `detectReferenceSphereIntersection`. */
export type ReferenceSphereIntersectionResult =
  | { readonly ok: true; readonly intersection: ReferenceSphereIntersection }
  | {
      readonly ok: false;
      readonly reason: ReferenceSphereIntersectionFailure;
      readonly propagationFailure: KeplerPropagationFailure | null;
      /**
       * Present only when propagationFailure is 'RECTILINEAR_COLLISION': the propagator's
       * collisionDeltaT_s, the elapsed time from the start of the span to the passage through the
       * centre (0 < value ≤ D), s.
       */
      readonly collisionDeltaT_s?: number;
    };

function fail(
  reason: ReferenceSphereIntersectionFailure,
  propagationFailure: KeplerPropagationFailure | null = null,
): ReferenceSphereIntersectionResult {
  return { ok: false, reason, propagationFailure };
}

/**
 * Periapsis radius r_p = p/(1 + e) (T2).
 * Order: h = crossVec3(r, v); p = dotVec3(h, h)/μ; c = dotVec3(v, v) − μ/n; s = dotVec3(r, v);
 * e_vec[i] = (c * r[i] − s * v[i])/μ; e = normVec3(e_vec); r_p = p/(1 + e).
 */
function periapsisRadius(r: Vec3, v: Vec3, rn: number, mu: number): number {
  const h = crossVec3(r, v);
  const p = dotVec3(h, h) / mu;
  const c = dotVec3(v, v) - mu / rn;
  const s = dotVec3(r, v);
  const eVec: Vec3 = [
    (c * r[0] - s * v[0]) / mu,
    (c * r[1] - s * v[1]) / mu,
    (c * r[2] - s * v[2]) / mu,
  ];
  return p / (1 + normVec3(eVec));
}

/** Outcome of the next-periapsis computation (T3). */
type PeriapsisTime =
  | { readonly kind: 'time'; readonly t_s: number }
  | { readonly kind: 'none' }
  | { readonly kind: 'non-finite' };

/**
 * Time from the state to the next periapsis passage (T3).
 * Data (same order as propagateKeplerUniversal): sqrtMu = √μ; v2 = dotVec3(v, v);
 * alpha = 2/n − v2/μ; sigma0 = dotVec3(r, v)/sqrtMu; q = (n*v2)/μ − 1  (= 1 − α r₀).
 * χ_p per T3 (k = √|α|; k = 0 is treated as α = 0); then with chi2 = χ_p², c = stumpff(α chi2):
 * t_p = ((sigma0*(chi2*c2) + q*((chi2*χ_p)*c3)) + n*χ_p)/sqrtMu.
 */
function timeToNextPeriapsis(r: Vec3, v: Vec3, rn: number, mu: number): PeriapsisTime {
  const sqrtMu = Math.sqrt(mu);
  const v2 = dotVec3(v, v);
  const alpha = 2 / rn - v2 / mu;
  const sigma0 = dotVec3(r, v) / sqrtMu;
  const q = (rn * v2) / mu - 1;
  const k = Math.sqrt(Math.abs(alpha));

  let chiP: number;
  let mayBeAbsent = false;
  if (alpha > 0 && k > 0) {
    const e0 = Math.atan2(sigma0 * k, q);
    // e0 < 0: moving toward periapsis; otherwise past it (or at an apsis) — next one after 2π.
    // A −0 σ₀ gives e0 ∈ {−0, −π}; both lead to the same χ_p as +0 (2π/k resp. π/k).
    chiP = e0 < 0 ? -e0 / k : (2 * Math.PI - e0) / k;
    mayBeAbsent = !(e0 < 0);
  } else if (sigma0 < 0) {
    chiP = alpha < 0 && k > 0 ? Math.atanh(-(sigma0 * k) / q) / k : -sigma0 / q;
  } else {
    return { kind: 'none' };
  }
  const chi2 = chiP * chiP;
  const c = stumpff(alpha * chi2);
  const t_s = (sigma0 * (chi2 * c.c2) + q * (chi2 * chiP * c.c3) + rn * chiP) / sqrtMu;
  if (!Number.isFinite(t_s) || !(t_s >= 0)) {
    // Overflow on an outward-moving closed orbit of enormous period: later than any finite span.
    return mayBeAbsent ? { kind: 'none' } : { kind: 'non-finite' };
  }
  return { kind: 'time', t_s };
}

/**
 * Does the two-body trajectory of (r, v) reach |r| ≤ R at some time in [0, D]?
 * (ML-FR-006 AC6; contracts-v1 §8.3 REFERENCE_SPHERE_INTERSECTION.)
 *
 * @param position_m r [m] at the start of the span, inertial frame.
 * @param velocity_mps v [m/s] at the start of the span, same frame.
 * @param mu_m3ps2 μ [m^3/s^2], > 0.
 * @param referenceRadius_m R [m], > 0 (the request's constants.referenceRadius_m).
 * @param span_s D [s] ≥ 0, the length of the arc after the start (for the post-maneuver segment:
 *   pass exactly the Δt used for its last sample, so INSIDE_AT_END agrees bit-for-bit with it).
 * @returns The flag with its reason, r_p, t_p, |r(0)| and |r(D)|; or a failure. Never throws.
 *
 * Criterion [D3]–[D6] (T4): intersects ⇔ |r(0)| ≤ R ∨ (t_p ≤ D ∧ r_p ≤ R) ∨ |r(D)| ≤ R, each
 * evaluated in binary64 with inclusive comparisons:
 * - start exactly on the sphere (|r(0)| = R) counts as intersecting [D4];
 * - a tangent orbit (r_p = R) counts as intersecting if its periapsis passage is in the span [D4];
 * - a periapsis passage exactly at D counts (t_p ≤ D) [D4];
 * - no rounding band is applied to r_p or t_p: within their evaluation error the outcome follows the
 *   computed values [D5] (the VT-16 case-selection margins keep test cases ≥ 1e-6 R away);
 * - the first crossing time (|r| = R) is NOT computed [D6]; only the flag, r_p and t_p.
 * Closed orbits: only the first periapsis matters (all have the same r_p). Open orbits: at most one
 * periapsis passage, none if moving outward. Rectilinear states: r_p = 0; if the motion reaches
 * the centre within [0, D] the propagation to D fails with 'RECTILINEAR_COLLISION' (ML-TASK-019)
 * and this function returns PROPAGATION_FAILED with that reason and collisionDeltaT_s; otherwise
 * the flag is evaluated as for any other state.
 *
 * Evaluation: n = normVec3(r); r_p and t_p as documented on the helpers above (T2, T3);
 * end = propagateKeplerUniversal(μ, r, v, D) (a copy for D = ±0); |r(D)| = normVec3(end.position).
 */
export function detectReferenceSphereIntersection(
  position_m: Vec3,
  velocity_mps: Vec3,
  mu_m3ps2: number,
  referenceRadius_m: number,
  span_s: number,
): ReferenceSphereIntersectionResult {
  const valid =
    isFiniteVec3(position_m) &&
    isFiniteVec3(velocity_mps) &&
    Number.isFinite(mu_m3ps2) &&
    mu_m3ps2 > 0 &&
    Number.isFinite(referenceRadius_m) &&
    referenceRadius_m > 0 &&
    Number.isFinite(span_s) &&
    span_s >= 0;
  if (!valid) {
    return fail('INVALID_INPUT');
  }
  const radiusAtStart_m = normVec3(position_m);
  if (radiusAtStart_m === 0 || !Number.isFinite(radiusAtStart_m)) {
    return fail('INVALID_INPUT');
  }

  const periapsisRadius_m = periapsisRadius(position_m, velocity_mps, radiusAtStart_m, mu_m3ps2);
  if (!Number.isFinite(periapsisRadius_m)) {
    return fail('NON_FINITE_RESULT');
  }
  const periapsis = timeToNextPeriapsis(position_m, velocity_mps, radiusAtStart_m, mu_m3ps2);
  if (periapsis.kind === 'non-finite') {
    return fail('NON_FINITE_RESULT');
  }
  const timeToPeriapsis_s = periapsis.kind === 'time' ? periapsis.t_s : null;

  const end = propagateKeplerUniversal(mu_m3ps2, position_m, velocity_mps, span_s);
  if (!end.ok) {
    if (end.reason === 'RECTILINEAR_COLLISION') {
      return {
        ok: false,
        reason: 'PROPAGATION_FAILED',
        propagationFailure: end.reason,
        collisionDeltaT_s: end.collisionDeltaT_s,
      };
    }
    return fail('PROPAGATION_FAILED', end.reason);
  }
  const radiusAtEnd_m = normVec3(end.position_m);

  let reason: ReferenceSphereIntersectionReason | null = null;
  if (radiusAtStart_m <= referenceRadius_m) {
    reason = 'INSIDE_AT_START';
  } else if (
    timeToPeriapsis_s !== null &&
    timeToPeriapsis_s <= span_s &&
    periapsisRadius_m <= referenceRadius_m
  ) {
    reason = 'PERIAPSIS_BELOW_REFERENCE_IN_SPAN';
  } else if (radiusAtEnd_m <= referenceRadius_m) {
    reason = 'INSIDE_AT_END';
  }
  return {
    ok: true,
    intersection: {
      intersects: reason !== null,
      reason,
      periapsisRadius_m,
      timeToPeriapsis_s,
      radiusAtStart_m,
      radiusAtEnd_m,
    },
  };
}
