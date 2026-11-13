/**
 * Two-body (Kepler) propagation of a Cartesian state with the universal variable χ, Stumpff
 * functions and Lagrange coefficients f, g, ḟ, ġ (ADR-005, option B).
 *
 * Frame and units: position in m, velocity in m/s, both in the same inertial frame (GCRF in
 * M1, ADR-004; the function itself is frame-agnostic and returns the state in the input frame).
 * Time in s (any sign). μ in m³/s². χ in m^½ (suffix `_sqrtm`), α in 1/m (suffix `_per_m`).
 *
 * =============================================================================================
 * Derivation (from the two-body equation; every step can be checked by differentiation).
 * Notation: r = |r_vec|, v = |v_vec|, ' = d/dχ, c_k = c_k(αχ²) (Stumpff functions, stumpff.ts).
 *
 * (D1) Two-body equation: d²r_vec/dt² = −μ r_vec / r³. Energy v²/2 − μ/r is constant, hence
 *      α := 2/r − v²/μ is constant (α = 1/a for a conic with semi-major axis a; α > 0 ellipse,
 *      α = 0 parabola, α < 0 hyperbola).
 * (D2) Universal anomaly: dχ/dt = √μ / r, χ(t₀) = 0. With σ := r_vec·v_vec/√μ:
 *        r' = σ (scalar),  σ' = (r/√μ)(v² − μ/r)/√μ = 1 − α r   (using v² = μ(2/r − α)),
 *      so r'' + α r = 1 with r(0) = r₀, r'(0) = σ₀.
 * (D3) Series identity: d/dχ [χ^k c_k(αχ²)] = χ^{k−1} c_{k−1}(αχ²) for k ≥ 1 (differentiate the
 *      series Σ (−α)^n χ^{k+2n}/(k+2n)! term by term), and c0' = −α χ c1.
 *      Hence r(χ) = r₀ c0 + σ₀ χ c1 + χ² c2 solves (D2) with the right initial values.
 * (D4) Time equation: dt/dχ = r/√μ, integrated with (D3):
 *        √μ Δt = r₀ χ c1 + σ₀ χ² c2 + χ³ c3,
 *      and with c1 = 1 − ψ c3 (ψ = αχ², recurrence ψ c_{k+2} = 1/k! − c_k):
 *        √μ Δt = σ₀ χ² C(ψ) + (1 − α r₀) χ³ S(ψ) + r₀ χ          (universal Kepler equation)
 *      Its derivative is F'(χ) = r(χ) = (1 − α r₀) χ² C + σ₀ χ c1 + r₀ > 0.
 * (D5) Vector equation: r_vec' = r v_vec/√μ, r_vec'' = σ v_vec/√μ − r_vec/r, and one more
 *      derivative (using (D1), (D2)) gives r_vec''' + α r_vec' = 0. Its solution with
 *      r_vec(0) = r0_vec, r_vec'(0) = r₀ v0_vec/√μ, r_vec''(0) = σ₀ v0_vec/√μ − r0_vec/r₀ is
 *        r_vec = f r0_vec + g v0_vec,
 *        f = 1 − χ² C / r₀,      g = (σ₀ χ² C + r₀ χ c1) / √μ.
 *      Velocity v_vec = (√μ/r) r_vec' with f' = −χ c1/r₀, g' = (r₀ c0 + σ₀ χ c1)/√μ:
 *        ḟ = −√μ χ c1 / (r r₀),   ġ = (r₀ c0 + σ₀ χ c1)/r = 1 − χ² C / r   (by (D3)).
 *      Angular momentum r_vec × v_vec = (f ġ − ḟ g) r0_vec × v0_vec is conserved, so f ġ − ḟ g = 1.
 *
 * Cross-check against sources opened on 2026-11-12:
 * - B. Weber, *Orbital Mechanics & Astrodynamics*, "Orbit Independent Solution: The Universal
 *   Anomaly", https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/universal-variables.html
 *   Eq. 251 (r and v in terms of χ: f = 1 − χ²C/r₀, g = Δt − χ³S/√μ, ḟ = χ√μ(αχ²S − 1)/(r r₀),
 *   ġ = 1 − χ²C/r), Eq. 252 (universal Kepler equation, identical to (D4) with
 *   σ₀ = r₀ v_r0/√μ), Eqs. 262 and 266 (Newton function and derivative, identical to (D4)),
 *   Eq. 267 (initial guess χ₀ = √μ |α| Δt, attributed to Curtis).
 * - Wikipedia, "Universal variable formulation", https://en.wikipedia.org/wiki/Universal_variable_formulation
 *   (variable s with ds/dt = 1/r, i.e. χ = √μ s, and its α ≡ μ/a): third-order equation
 *   d³r_vec/ds³ + α dr_vec/ds = 0 and f, g, ḟ, ġ in terms of c1, c2, c3 — consistent with (D5)
 *   after the change of variable (its μ s³ c3 equals χ³ c3/√μ with its argument αs² = χ²/a).
 * - Not opened (not confirmed): Vallado, *Fundamentals of Astrodynamics and Applications*,
 *   KEPLER algorithm; Curtis, *Orbital Mechanics for Engineering Students*, ch. 3; Bate, Mueller
 *   & White, ch. 4 (named in ADR-005).
 *
 * Two deliberate, algebraically equivalent forms (equal when χ solves (D4) exactly):
 * - g is formed as (σ₀ χ² C + r₀ χ c1)/√μ (D5) rather than Weber's Δt − χ³S/√μ. The textbook
 *   form subtracts two quantities of size |Δt| to get a bounded g, so its absolute rounding grows
 *   with |Δt| and its solver residual moves the point off the orbit along v₀. The form used here
 *   is the state at exactly the universal anomaly χ̂ returned by the solver (a point on the orbit
 *   at time t(χ̂)), so the solver residual is a pure along-track time shift.
 * - ḟ uses −χ c1 instead of χ(ψS − 1), which is the same by the recurrence but avoids the
 *   cancellation 1 − ψS for large ψ.
 * - 1 − α r₀ is formed as r₀ v₀²/μ − 1 (identical by the definition of α in (D1)).
 *
 * =============================================================================================
 * Root solve for χ (safeguarded Newton; ADR-005: "Newton with a bracketing fallback").
 *
 * F(χ) = σ₀ χ² C + (1 − α r₀) χ³ S + r₀ χ − √μ Δt is strictly increasing (F' = r > 0 unless the
 * trajectory is rectilinear and passes through the centre), with F(0) = −√μ Δt. So the root has
 * the sign of Δt and is unique.
 *
 * 1. Initial guess. α > 0: χ₀ = √μ α Δt (Weber Eq. 267, Curtis); this equals √a·ΔM and, since
 *    χ = √μ ∫ dt/r lies between √μ Δt/r_a and √μ Δt/r_p, the root is within a factor
 *    a/r_p = 1/(1 − e) of the guess. α ≤ 0: χ₀ = √μ Δt / r₀ (the first-order solution of (D4)),
 *    reduced if needed so that |α| χ₀² ≤ 1, to start the hyperbolic search below overflow.
 *    If the guess is 0 or not finite (underflow/overflow), √μ Δt / r₀ is used.
 * 2. Bracket. 0 is one end (F(0) has the sign opposite to Δt). The guess is doubled until F
 *    changes sign or is not finite (a non-finite F happens only for very large |χ| on open
 *    orbits, where cosh/sinh overflow; it is treated as lying beyond the root). At most
 *    MAX_BRACKET_EXPANSIONS doublings (the binary64 exponent range spans fewer than 2100
 *    doublings).
 * 3. Iterate: Newton step χ − F/F' from the latest finite point; if it falls outside the open
 *    bracket (or is not finite) a bisection step is taken instead. The bracket is updated from
 *    the sign of every evaluation, so it always contains the root and shrinks.
 *
 * STOPPING CRITERION. At each evaluated χ the code also forms a running estimate of the
 * rounding noise of the computed F (an estimate of the error with which F is evaluated, in units
 * of √μ·s):
 *
 *     η(χ) = 8u (|T1| + |T2| + |T3| + |√μ Δt|) + 2u |χ| |F'(χ)|,
 *     T1 = σ₀ χ² C,  T2 = (1 − α r₀) χ³ S,  T3 = r₀ χ,  u = 2^-53.
 *
 * The first part bounds the evaluation error of the sum: each term is the product of data with
 * at most ~3 rounded operations and a Stumpff value with a relative error ≤ ~7u (stumpff.ts), so
 * ≈ 8u per term; this also covers the error of the rounded Stumpff argument √(αχ²), whose effect
 * is at most ~4.5u·e·a^{3/2}·X (X the change in eccentric anomaly) and so ≤ ~4.5u|√μΔt| +
 * 4.5u|T3|. The second part is the change of F across the spacing of binary64 numbers at χ
 * (|F'|·u|χ|, doubled): no representable χ can be expected to do better.
 *   - The solve is CONVERGED as soon as |F̂(χ)| ≤ η(χ) (the residual is at the noise floor of
 *     the computed time equation), or F̂ = 0, or the bracket has collapsed to within 4u|χ|
 *     (the root is located to the resolution of χ).
 *   - After convergence, Newton steps continue ("polishing") only while they strictly reduce
 *     |F̂|, at most MAX_POLISH_STEPS times; the best point seen is returned. The returned residual
 *     is therefore at the rounding-noise floor, not at η.
 *   - Not converged within MAX_ITERATIONS iterations (or a step that cannot move χ before
 *     convergence) → failure 'NOT_CONVERGED' with iterationCapReached set accordingly.
 * No fixed absolute tolerance (such as 1e-8) is used anywhere.
 *
 * MAX_ITERATIONS = 100: a bracket of relative width ≤ 1 is reduced to 4u|χ| by at most 52
 * bisections; Newton steps that stay inside the bracket only shorten that. The polishing steps are
 * counted in the same cap.
 *
 * Diagnostics returned on success and failure: iterations used, bracket expansions, whether the
 * cap was hit, the computed final time residual F̂(χ̂)/√μ (s) and the noise estimate η/√μ (s),
 * and the data (α̂, σ̂₀, r̂₀, 1 − α̂r̂₀) with which an external check can re-evaluate the exact time
 * equation at χ̂.
 *
 * Fixed evaluation order: every expression is written with explicit parentheses where the order
 * is not left-to-right; ECMAScript has no fused multiply-add, so results are bit-reproducible.
 * No state is kept between calls; each call depends only on its arguments (no warm start).
 */

import { dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';
import { stumpff } from './stumpff';
import type { StumpffValues } from './stumpff';

const UNIT_ROUNDOFF = 2 ** -53;

/** Default and maximum allowed iteration cap of the χ solve (see module comment). */
export const KEPLER_MAX_ITERATIONS = 100;

/** Maximum doublings of the guess while bracketing the root (binary64 exponent range). */
export const KEPLER_MAX_BRACKET_EXPANSIONS = 2100;

/** Maximum Newton steps after convergence that are kept only if they reduce |F̂|. */
export const KEPLER_MAX_POLISH_STEPS = 3;

/** Why a propagation returned no state. */
export type KeplerPropagationFailure =
  /** μ not finite and > 0, a non-finite state component, r₀ = 0, a non-finite Δt, or an invalid
   *  iteration cap. Validation upstream is expected to prevent this. */
  | 'INVALID_INPUT'
  /** The χ solve did not reach its stopping criterion (maps to PROPAGATOR_NOT_CONVERGED). */
  | 'NOT_CONVERGED'
  /** The solve converged but the state or a coefficient is not finite (maps to NON_FINITE_STATE). */
  | 'NON_FINITE_STATE';

/** Data of the time equation, as computed from the initial state (all finite on success). */
export interface KeplerTimeEquationData {
  /** α̂ = 2/r̂₀ − v̂₀²/μ, 1/m. */
  readonly alpha_per_m: number;
  /** σ̂₀ = (r0_vec · v0_vec)/√μ, m^½. */
  readonly sigma0_sqrtm: number;
  /** r̂₀ = |r0_vec|, m. */
  readonly r0_m: number;
  /** (1 − α r₀)^ computed as r̂₀ v̂₀²/μ − 1, dimensionless. */
  readonly oneMinusAlphaR0: number;
  /** fl(√μ), m^{3/2}/s. */
  readonly sqrtMu_m1p5ps: number;
}

/** Convergence diagnostics of the χ solve. Numbers are finite, or null when they are not. */
export interface KeplerSolveDiagnostics {
  /** Newton/bisection iterations performed after bracketing (0 for Δt = 0). */
  readonly iterations: number;
  /** Doublings of the initial guess needed to bracket the root. */
  readonly bracketExpansions: number;
  /** True if the iteration cap ended the solve. */
  readonly iterationCapReached: boolean;
  /** Returned universal anomaly χ̂, m^½ (null if not finite). */
  readonly universalAnomaly_sqrtm: number | null;
  /** Computed residual of the time equation at χ̂, F̂(χ̂)/√μ, s (signed; null if not finite). */
  readonly timeResidual_s: number | null;
  /** Noise estimate η(χ̂)/√μ used by the stopping criterion, s (null if not finite). */
  readonly timeResidualNoise_s: number | null;
  /** Data of the time equation (null for Δt = 0 copies and invalid input). */
  readonly timeEquation: KeplerTimeEquationData | null;
}

/** Lagrange coefficients at the returned χ̂. */
export interface LagrangeCoefficients {
  /** f, dimensionless. */
  readonly f: number;
  /** g, s. */
  readonly g_s: number;
  /** ḟ, 1/s. */
  readonly fDot_per_s: number;
  /** ġ, dimensionless. */
  readonly gDot: number;
}

/** Result of `propagateKeplerUniversal`. A success never contains a non-finite number. */
export type KeplerPropagationResult =
  | {
      readonly ok: true;
      /** Position at t₀ + Δt, m, input frame. */
      readonly position_m: Vec3;
      /** Velocity at t₀ + Δt, m/s, input frame. */
      readonly velocity_mps: Vec3;
      /** Lagrange coefficients used (f = ġ = 1, g = ḟ = 0 for the Δt = 0 copy). */
      readonly lagrange: LagrangeCoefficients;
      readonly diagnostics: KeplerSolveDiagnostics;
    }
  | {
      readonly ok: false;
      readonly reason: KeplerPropagationFailure;
      readonly diagnostics: KeplerSolveDiagnostics;
    };

/** Options of `propagateKeplerUniversal`. */
export interface KeplerPropagationOptions {
  /** Iteration cap, an integer in [1, KEPLER_MAX_ITERATIONS]. Default KEPLER_MAX_ITERATIONS. */
  readonly maxIterations?: number;
}

interface TimeEquationContext {
  readonly alpha: number;
  readonly sigma0: number;
  readonly r0: number;
  readonly oneMinusAlphaR0: number;
  readonly sqrtMuDt: number;
}

interface Evaluation {
  readonly chi: number;
  readonly chi2: number;
  /** F̂(χ), √μ·s (m^{3/2}). */
  readonly value: number;
  /** F̂'(χ) = r(χ), m. */
  readonly derivative: number;
  /** η(χ), m^{3/2}. */
  readonly noise: number;
  readonly c: StumpffValues;
}

/**
 * Evaluates F(χ), F'(χ) and the noise estimate η(χ) (module comment).
 * Order: chi2 = chi*chi; psi = alpha*chi2; chi3 = chi2*chi;
 * t1 = sigma0*(chi2*c2); t2 = oneMinusAlphaR0*(chi3*c3); t3 = r0*chi;
 * value = ((t1 + t2) + t3) - sqrtMuDt;
 * derivative = (oneMinusAlphaR0*(chi2*c2) + sigma0*(chi*c1)) + r0.
 */
function evaluateTimeEquation(chi: number, ctx: TimeEquationContext): Evaluation {
  const chi2 = chi * chi;
  const psi = ctx.alpha * chi2;
  const chi3 = chi2 * chi;
  const c = stumpff(psi);
  const t1 = ctx.sigma0 * (chi2 * c.c2);
  const t2 = ctx.oneMinusAlphaR0 * (chi3 * c.c3);
  const t3 = ctx.r0 * chi;
  const value = t1 + t2 + t3 - ctx.sqrtMuDt;
  const derivative = ctx.oneMinusAlphaR0 * (chi2 * c.c2) + ctx.sigma0 * (chi * c.c1) + ctx.r0;
  const termSum = Math.abs(t1) + Math.abs(t2) + Math.abs(t3) + Math.abs(ctx.sqrtMuDt);
  const noise =
    8 * UNIT_ROUNDOFF * termSum + 2 * UNIT_ROUNDOFF * Math.abs(chi) * Math.abs(derivative);
  return { chi, chi2, value, derivative, noise, c };
}

function finiteOrNull(x: number): number | null {
  return Number.isFinite(x) ? x : null;
}

function isFiniteVec3(a: Vec3): boolean {
  return Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);
}

interface SolveOutcome {
  readonly converged: boolean;
  readonly best: Evaluation | null;
  readonly iterations: number;
  readonly bracketExpansions: number;
  readonly iterationCapReached: boolean;
}

/** True when an evaluation lies on the far side of the root (in the direction of Δt). */
function isBeyondRoot(e: Evaluation, positive: boolean): boolean {
  // NaN and ±Infinity are treated as beyond the root (module comment, step 2).
  if (!Number.isFinite(e.value)) {
    return true;
  }
  return positive ? e.value >= 0 : e.value <= 0;
}

function initialGuess(ctx: TimeEquationContext, sqrtMu: number, deltaT_s: number): number {
  const linear = ctx.sqrtMuDt / ctx.r0;
  if (ctx.alpha > 0) {
    const curtis = sqrtMu * ctx.alpha * deltaT_s;
    return curtis !== 0 && Number.isFinite(curtis) ? curtis : linear;
  }
  const absAlpha = Math.abs(ctx.alpha);
  if (absAlpha * (linear * linear) > 1) {
    const limit = 1 / Math.sqrt(absAlpha);
    return linear > 0 ? limit : -limit;
  }
  return linear;
}

function solveUniversalAnomaly(
  ctx: TimeEquationContext,
  sqrtMu: number,
  deltaT_s: number,
  maxIterations: number,
): SolveOutcome {
  const positive = deltaT_s > 0;
  // Bracket [lo, hi] with F(lo) < 0 < F(hi) (in the sense of isBeyondRoot); 0 is the near end.
  let lo = 0;
  let hi = 0;
  let best: Evaluation = evaluateTimeEquation(0, ctx);

  let x = initialGuess(ctx, sqrtMu, deltaT_s);
  let expansions = 0;
  let bracketed = false;
  while (!bracketed) {
    if (!Number.isFinite(x) || expansions > KEPLER_MAX_BRACKET_EXPANSIONS) {
      return {
        converged: false,
        best: Number.isFinite(best.value) ? best : null,
        iterations: 0,
        bracketExpansions: expansions,
        iterationCapReached: false,
      };
    }
    const e = evaluateTimeEquation(x, ctx);
    if (Number.isFinite(e.value) && Math.abs(e.value) < Math.abs(best.value)) {
      best = e;
    }
    if (isBeyondRoot(e, positive)) {
      if (positive) {
        hi = x;
      } else {
        lo = x;
      }
      bracketed = true;
    } else {
      if (positive) {
        lo = x;
      } else {
        hi = x;
      }
      x = 2 * x;
      expansions += 1;
    }
  }

  // Start from the finite point with the smallest residual.
  let latest: Evaluation = best;
  let converged = Math.abs(best.value) <= best.noise;
  let iterations = 0;
  let polishSteps = 0;
  let capReached = false;

  for (;;) {
    if (best.value === 0) {
      converged = true;
      break;
    }
    if (converged && polishSteps >= KEPLER_MAX_POLISH_STEPS) {
      break;
    }
    if (iterations >= maxIterations) {
      capReached = true;
      break;
    }
    const newton = latest.chi - latest.value / latest.derivative;
    let next = newton;
    if (!(next > lo && next < hi)) {
      if (converged) {
        // Polishing uses Newton steps only; a step leaving the bracket cannot improve.
        break;
      }
      next = lo + 0.5 * (hi - lo);
    }
    if (next === latest.chi) {
      break;
    }
    iterations += 1;
    const e = evaluateTimeEquation(next, ctx);
    if (isBeyondRoot(e, positive)) {
      hi = positive ? next : hi;
      lo = positive ? lo : next;
    } else {
      lo = positive ? next : lo;
      hi = positive ? hi : next;
    }
    if (!Number.isFinite(e.value)) {
      continue;
    }
    latest = e;
    if (converged) {
      polishSteps += 1;
      if (Math.abs(e.value) < Math.abs(best.value)) {
        best = e;
      } else {
        break;
      }
      continue;
    }
    if (Math.abs(e.value) < Math.abs(best.value)) {
      best = e;
    }
    if (Math.abs(best.value) <= best.noise) {
      converged = true;
      latest = best;
      continue;
    }
    const width = hi - lo;
    const scale = Math.max(Math.abs(lo), Math.abs(hi));
    if (width <= 4 * UNIT_ROUNDOFF * scale) {
      converged = true;
      break;
    }
  }

  return {
    converged,
    best,
    iterations,
    bracketExpansions: expansions,
    iterationCapReached: capReached && !converged,
  };
}

function emptyDiagnostics(timeEquation: KeplerTimeEquationData | null): KeplerSolveDiagnostics {
  return {
    iterations: 0,
    bracketExpansions: 0,
    iterationCapReached: false,
    universalAnomaly_sqrtm: null,
    timeResidual_s: null,
    timeResidualNoise_s: null,
    timeEquation,
  };
}

/**
 * Propagates a two-body state by Δt with the universal-variable formulation (ADR-005).
 *
 * @param mu_m3ps2 Gravitational parameter μ, m³/s², finite and > 0.
 * @param position_m Initial position r0_vec, m, inertial frame (any frame; output uses the same).
 * @param velocity_mps Initial velocity v0_vec, m/s, same frame.
 * @param deltaT_s Elapsed time Δt = t − t₀, s, any finite sign.
 * @param options Optional iteration cap (default KEPLER_MAX_ITERATIONS).
 * @returns The state at t₀ + Δt with the Lagrange coefficients and solve diagnostics, or a
 *   failure ('INVALID_INPUT' | 'NOT_CONVERGED' | 'NON_FINITE_STATE'). Never throws, never returns
 *   a non-finite number in a success.
 *
 * Behaviour:
 * - Δt = ±0: returns a copy of the input state, component by component (bit-identical, sign of
 *   zero included), with f = ġ = 1, g = ḟ = 0 and zero iterations. No equation is evaluated
 *   (contracts-v1 §5.2, revision 3).
 * - Otherwise: computed from (μ, r0_vec, v0_vec, Δt) only, with no state between calls, so the
 *   result for a given Δt does not depend on which other times are requested.
 * - Valid for elliptic, parabolic and hyperbolic energy. Rectilinear (r0_vec × v0_vec = 0)
 *   trajectories are computed by the same formulas; a state at or through r = 0 gives
 *   'NON_FINITE_STATE' or 'NOT_CONVERGED'.
 *
 * Evaluation order of the state (fixed):
 *   f = 1 - (chi2*C)/r0;  g = (sigma0*(chi2*C) + r0*(chi*c1)) / sqrtMu;
 *   position[i] = f*r0vec[i] + g*v0vec[i];  r = normVec3(position);
 *   fDot = -(sqrtMu*(chi*c1)) / (r*r0);  gDot = 1 - (chi2*C)/r;
 *   velocity[i] = fDot*r0vec[i] + gDot*v0vec[i].
 * Data: r0 = normVec3(r0vec); v0sq = dotVec3(v0vec, v0vec); alpha = 2/r0 - v0sq/mu;
 *   sigma0 = dotVec3(r0vec, v0vec)/sqrtMu; oneMinusAlphaR0 = (r0*v0sq)/mu - 1;
 *   sqrtMu = sqrt(mu); sqrtMuDt = sqrtMu*deltaT.
 * Sources and derivation: module comment ((D1)–(D5); Weber Eqs. 251–252, 262, 266, 267).
 */
export function propagateKeplerUniversal(
  mu_m3ps2: number,
  position_m: Vec3,
  velocity_mps: Vec3,
  deltaT_s: number,
  options?: KeplerPropagationOptions,
): KeplerPropagationResult {
  const maxIterations = options?.maxIterations ?? KEPLER_MAX_ITERATIONS;
  const inputValid =
    Number.isFinite(mu_m3ps2) &&
    mu_m3ps2 > 0 &&
    isFiniteVec3(position_m) &&
    isFiniteVec3(velocity_mps) &&
    Number.isFinite(deltaT_s) &&
    Number.isInteger(maxIterations) &&
    maxIterations >= 1 &&
    maxIterations <= KEPLER_MAX_ITERATIONS;
  if (!inputValid) {
    return { ok: false, reason: 'INVALID_INPUT', diagnostics: emptyDiagnostics(null) };
  }
  const r0 = normVec3(position_m);
  if (r0 === 0 || !Number.isFinite(r0)) {
    return { ok: false, reason: 'INVALID_INPUT', diagnostics: emptyDiagnostics(null) };
  }

  if (deltaT_s === 0) {
    return {
      ok: true,
      position_m: [position_m[0], position_m[1], position_m[2]],
      velocity_mps: [velocity_mps[0], velocity_mps[1], velocity_mps[2]],
      lagrange: { f: 1, g_s: 0, fDot_per_s: 0, gDot: 1 },
      diagnostics: { ...emptyDiagnostics(null), universalAnomaly_sqrtm: 0, timeResidual_s: 0 },
    };
  }

  const sqrtMu = Math.sqrt(mu_m3ps2);
  const v0sq = dotVec3(velocity_mps, velocity_mps);
  const alpha = 2 / r0 - v0sq / mu_m3ps2;
  const sigma0 = dotVec3(position_m, velocity_mps) / sqrtMu;
  const oneMinusAlphaR0 = (r0 * v0sq) / mu_m3ps2 - 1;
  const sqrtMuDt = sqrtMu * deltaT_s;
  const data: KeplerTimeEquationData = {
    alpha_per_m: alpha,
    sigma0_sqrtm: sigma0,
    r0_m: r0,
    oneMinusAlphaR0,
    sqrtMu_m1p5ps: sqrtMu,
  };
  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(sigma0) ||
    !Number.isFinite(oneMinusAlphaR0) ||
    !Number.isFinite(sqrtMuDt)
  ) {
    return { ok: false, reason: 'NON_FINITE_STATE', diagnostics: emptyDiagnostics(null) };
  }
  const ctx: TimeEquationContext = { alpha, sigma0, r0, oneMinusAlphaR0, sqrtMuDt };

  const outcome = solveUniversalAnomaly(ctx, sqrtMu, deltaT_s, maxIterations);
  const best = outcome.best;
  const diagnostics: KeplerSolveDiagnostics = {
    iterations: outcome.iterations,
    bracketExpansions: outcome.bracketExpansions,
    iterationCapReached: outcome.iterationCapReached,
    universalAnomaly_sqrtm: best === null ? null : finiteOrNull(best.chi),
    timeResidual_s: best === null ? null : finiteOrNull(best.value / sqrtMu),
    timeResidualNoise_s: best === null ? null : finiteOrNull(best.noise / sqrtMu),
    timeEquation: data,
  };
  if (!outcome.converged || best === null) {
    return { ok: false, reason: 'NOT_CONVERGED', diagnostics };
  }

  const chi = best.chi;
  const chi2C = best.chi2 * best.c.c2;
  const chiC1 = chi * best.c.c1;
  const f = 1 - chi2C / r0;
  const g = (sigma0 * chi2C + r0 * chiC1) / sqrtMu;
  const position: Vec3 = [
    f * position_m[0] + g * velocity_mps[0],
    f * position_m[1] + g * velocity_mps[1],
    f * position_m[2] + g * velocity_mps[2],
  ];
  const r = normVec3(position);
  const fDot = -(sqrtMu * chiC1) / (r * r0);
  const gDot = 1 - chi2C / r;
  const velocity: Vec3 = [
    fDot * position_m[0] + gDot * velocity_mps[0],
    fDot * position_m[1] + gDot * velocity_mps[1],
    fDot * position_m[2] + gDot * velocity_mps[2],
  ];
  if (
    !isFiniteVec3(position) ||
    !isFiniteVec3(velocity) ||
    !Number.isFinite(f) ||
    !Number.isFinite(g) ||
    !Number.isFinite(fDot) ||
    !Number.isFinite(gDot) ||
    diagnostics.timeResidual_s === null ||
    diagnostics.timeResidualNoise_s === null
  ) {
    return { ok: false, reason: 'NON_FINITE_STATE', diagnostics };
  }
  return {
    ok: true,
    position_m: position,
    velocity_mps: velocity,
    lagrange: { f, g_s: g, fDot_per_s: fDot, gDot },
    diagnostics,
  };
}

/**
 * Propagates one initial state to several elapsed times, each computed independently from the
 * initial state by `propagateKeplerUniversal` (no warm start, so element k of the output does
 * not depend on the other requested times). Units, frame and sources as
 * `propagateKeplerUniversal`. Not the contract's sampling grid (ML-TASK-017).
 *
 * @param deltaTs_s Elapsed times Δt_k = t_k − t₀, s, in any order.
 * @returns One result per requested time, in the same order.
 */
export function propagateKeplerUniversalAt(
  mu_m3ps2: number,
  position_m: Vec3,
  velocity_mps: Vec3,
  deltaTs_s: readonly number[],
  options?: KeplerPropagationOptions,
): KeplerPropagationResult[] {
  return deltaTs_s.map((deltaT_s) =>
    propagateKeplerUniversal(mu_m3ps2, position_m, velocity_mps, deltaT_s, options),
  );
}
