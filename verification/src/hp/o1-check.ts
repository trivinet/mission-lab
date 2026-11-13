/**
 * High-precision evaluator for the O-1 solver acceptance check (tolerance record §6.1, §12 O-1).
 *
 * Given the exact binary64 inputs (μ, r₀, v₀, Δt) and a candidate universal anomaly χ̂ returned
 * by a solver, it evaluates the universal-variable time equation
 *
 *   √μ t(χ) = σ₀ χ² C(ψ) + (1 − α r₀) χ³ S(ψ) + r₀ χ,   ψ = α χ²,
 *   σ₀ = r₀·v₀/√μ,   α = 2/r₀ − v₀²/μ,   r₀ = ‖r₀‖
 *
 * entirely in BigFloat arithmetic (default 320 bits), with α, σ₀ and r₀ also formed in high
 * precision from the exact binary64 inputs (§12 O-1, revision 3), and returns |t(χ̂) − Δt| and
 * the acceptance threshold ε_t(Δt) + δt_α(Δt) (§6.1). Stumpff functions: C(ψ) = (1 − cos√ψ)/ψ,
 * S(ψ) = (√ψ − sin√ψ)/ψ^(3/2) for ψ > 1; (cosh√−ψ − 1)/(−ψ), (sinh√−ψ − √−ψ)/(−ψ)^(3/2) for
 * ψ < −1; their Taylor series Σ(−ψ)^k/(2k + 2)!, Σ(−ψ)^k/(2k + 3)! for |ψ| ≤ 1.
 *
 * The threshold is defined for elliptic arcs only (α > 0, as in §6.1); for α ≤ 0 the residual
 * is still returned and the threshold is NaN (VT-16 budgets are per dataset, not derived here).
 *
 * This task does NOT run it against the engine (ML-TASK-011 scope); ML-TASK-015/018 use it.
 */
import { epsT, dtAlpha, scales } from '../tol/tolerances';
import {
  abs,
  add,
  cmp,
  cos,
  cosh,
  div,
  fromInt,
  fromNumber,
  ilog2,
  mul,
  neg,
  sin,
  sinh,
  sqrt,
  sub,
  toNumber,
  type BigFloat,
} from './bigfloat';

type N3 = readonly [number, number, number];

const P = 320;

/** C(ψ), S(ψ) to working precision. */
export function stumpff(psi: BigFloat, p = P): { C: BigFloat; S: BigFloat } {
  const one = fromInt(1);
  if (cmp(abs(psi), one) <= 0) {
    // Series: C = Σ (−ψ)^k/(2k+2)!, S = Σ (−ψ)^k/(2k+3)!
    let C = fromInt(0);
    let S = fromInt(0);
    let termC = div(one, fromInt(2), p); // k = 0: 1/2!
    let termS = div(one, fromInt(6), p); // k = 0: 1/3!
    for (let k = 0; k < 400; k++) {
      C = add(C, termC, p);
      S = add(S, termS, p);
      const m = neg(psi);
      termC = div(mul(termC, m, p), fromInt((2 * k + 3) * (2 * k + 4)), p);
      termS = div(mul(termS, m, p), fromInt((2 * k + 4) * (2 * k + 5)), p);
      if (termC.m === 0n || ilog2(abs(termC)) < -p - 8) break;
    }
    return { C, S };
  }
  if (psi.m > 0n) {
    const s = sqrt(psi, p);
    const C = div(sub(one, cos(s, p), p), psi, p);
    const S = div(sub(s, sin(s, p), p), mul(psi, s, p), p);
    return { C, S };
  }
  const mpsi = neg(psi);
  const s = sqrt(mpsi, p);
  const C = div(sub(cosh(s, p), one, p), mpsi, p);
  const S = div(sub(sinh(s, p), s, p), mul(mpsi, s, p), p);
  return { C, S };
}

export interface UvInputs {
  readonly mu_m3ps2: number;
  readonly position_m: N3;
  readonly velocity_mps: N3;
}

interface UvData {
  readonly sqrtMu: BigFloat;
  readonly r0: BigFloat;
  readonly sigma0: BigFloat;
  readonly alpha: BigFloat;
}

function data(inp: UvInputs, p = P): UvData {
  const r = inp.position_m.map(fromNumber);
  const v = inp.velocity_mps.map(fromNumber);
  const mu = fromNumber(inp.mu_m3ps2);
  const dot = (a: BigFloat[], b: BigFloat[]): BigFloat =>
    add(
      add(
        mul(a[0] ?? fromInt(0), b[0] ?? fromInt(0), p),
        mul(a[1] ?? fromInt(0), b[1] ?? fromInt(0), p),
        p,
      ),
      mul(a[2] ?? fromInt(0), b[2] ?? fromInt(0), p),
      p,
    );
  const sqrtMu = sqrt(mu, p);
  const r0 = sqrt(dot(r, r), p);
  const sigma0 = div(dot(r, v), sqrtMu, p);
  const alpha = sub(div(fromInt(2), r0, p), div(dot(v, v), mu, p), p);
  return { sqrtMu, r0, sigma0, alpha };
}

/** t(χ) in seconds, in high precision. */
export function timeOfChi(inp: UvInputs, chi: number, p = P): BigFloat {
  const d = data(inp, p);
  const x = fromNumber(chi);
  const x2 = mul(x, x, p);
  const psi = mul(d.alpha, x2, p);
  const { C, S } = stumpff(psi, p);
  const t1 = mul(mul(d.sigma0, x2, p), C, p);
  const t2 = mul(mul(sub(fromInt(1), mul(d.alpha, d.r0, p), p), mul(x2, x, p), p), S, p);
  const t3 = mul(d.r0, x, p);
  return div(add(add(t1, t2, p), t3, p), d.sqrtMu, p);
}

export interface O1Result {
  /** |t(χ̂) − Δt| in seconds. */
  readonly residual_s: number;
  /** ε_t(Δt) + δt_α(Δt) in seconds (NaN when α ≤ 0). */
  readonly threshold_s: number;
  readonly epsT_s: number;
  readonly dtAlpha_s: number;
  /** Semi-major axis, eccentricity and κ = 4a/r₀ − 1 of the exact input (reference side). */
  readonly a_m: number;
  readonly e: number;
  readonly kappa: number;
  readonly pass: boolean;
}

/**
 * O-1 acceptance check of one candidate χ̂. κ in δt_α is 4a/r₀ − 1 of the exact input, which
 * §6.1 allows in place of κ_E (it is never larger).
 */
export function o1Check(inp: UvInputs, dt_s: number, chiHat: number): O1Result {
  const t = timeOfChi(inp, chiHat);
  const residual = toNumber(abs(sub(t, fromNumber(dt_s))));
  const d = data(inp);
  if (d.alpha.m <= 0n) {
    return {
      residual_s: residual,
      threshold_s: Number.NaN,
      epsT_s: Number.NaN,
      dtAlpha_s: Number.NaN,
      a_m: Number.NaN,
      e: Number.NaN,
      kappa: Number.NaN,
      pass: false,
    };
  }
  const a = div(fromInt(1), d.alpha);
  // e from p = h²/μ and a: e² = 1 − p/a, h² = r²v² − (r·v)² = μ(r0² (2/r0 − α) − σ0²)... formed
  // directly: e² = (1 − r0/a)² + σ0²/a.
  const one = fromInt(1);
  const ra = sub(one, div(d.r0, a));
  const e2 = add(mul(ra, ra), div(mul(d.sigma0, d.sigma0), a));
  const e = toNumber(sqrt(e2));
  const aN = toNumber(a);
  const kappa = toNumber(sub(div(mul(fromInt(4), a), d.r0), one));
  const sc = scales(inp.mu_m3ps2, aN, e);
  const et = epsT(sc, dt_s);
  const da = dtAlpha(sc, dt_s, kappa);
  const threshold = et + da;
  return {
    residual_s: residual,
    threshold_s: threshold,
    epsT_s: et,
    dtAlpha_s: da,
    a_m: aN,
    e,
    kappa,
    pass: residual <= threshold,
  };
}
