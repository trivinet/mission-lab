/**
 * High-precision hyperbolic two-body propagation in classical form (ML-TASK-018 part D2).
 * Purpose: validate the L2b (RK4) reference of the hyperbolic VT-16 arcs (tolerances.md §6.8,
 * §7 VT-16, §9.2) by an independent closed-form method. It is not a comparison reference for the
 * engine (the record defines hyperbolic arcs against L2b only; §7 VT-16).
 *
 * Method (elementary; stated here so it can be checked). From the binary64 state (r₀, v₀), in
 * BigFloat arithmetic (200 bits):
 *   E = v²/2 − μ/r > 0, |a| = μ/(2E), e-vector ε = [(v² − μ/r) r − (r·v) v]/μ, e = ‖ε‖,
 *   P = ε/e (towards periapsis), Q = ĥ × P, n = √(μ/|a|³),
 *   sinh F₀ = (r·v)/(e√(μ|a|)), M = e sinh F − F, M(Δt) = M₀ + nΔt,
 *   position = |a|(e − cosh F) P + |a|√(e² − 1) sinh F Q,
 *   velocity = (√(μ|a|)/r)(−sinh F P + √(e² − 1) cosh F Q),  r = |a|(e cosh F − 1).
 * The hyperbolic Kepler equation is solved by Newton iteration to working precision. This is the
 * classical-anomaly perifocal method, not the universal-variable Lagrange-coefficient method of
 * ADR-005; packages/astrodynamics was not read (ADR-003).
 */
import {
  abs,
  add,
  cosh,
  div,
  fromInt,
  fromNumber,
  ilog2,
  mul,
  neg,
  sinh,
  sqrt,
  sub,
  toNumber,
  type BigFloat,
} from '../hp/bigfloat';
import type { B3 } from '../hp/hp-vec';

const P_BITS = 200;
const B = (x: number): BigFloat => fromNumber(x);

function dotP(a: B3, b: B3): BigFloat {
  return add(
    add(mul(a[0], b[0], P_BITS), mul(a[1], b[1], P_BITS), P_BITS),
    mul(a[2], b[2], P_BITS),
    P_BITS,
  );
}

function crossP(a: B3, b: B3): B3 {
  return [
    sub(mul(a[1], b[2], P_BITS), mul(a[2], b[1], P_BITS), P_BITS),
    sub(mul(a[2], b[0], P_BITS), mul(a[0], b[2], P_BITS), P_BITS),
    sub(mul(a[0], b[1], P_BITS), mul(a[1], b[0], P_BITS), P_BITS),
  ];
}

function lin(ca: BigFloat, a: B3, cb: BigFloat, b: B3): B3 {
  return [
    add(mul(ca, a[0], P_BITS), mul(cb, b[0], P_BITS), P_BITS),
    add(mul(ca, a[1], P_BITS), mul(cb, b[1], P_BITS), P_BITS),
    add(mul(ca, a[2], P_BITS), mul(cb, b[2], P_BITS), P_BITS),
  ];
}

function scaleP(s: BigFloat, a: B3): B3 {
  return [mul(s, a[0], P_BITS), mul(s, a[1], P_BITS), mul(s, a[2], P_BITS)];
}

function converged(step: BigFloat, x: BigFloat): boolean {
  return step.m === 0n || ilog2(abs(step)) < -P_BITS + 8 + Math.max(0, ilog2(abs(x)));
}

export interface HypPrepared {
  readonly mu: BigFloat;
  readonly aAbs: BigFloat;
  readonly e: BigFloat;
  readonly sqrtE2m1: BigFloat;
  readonly n: BigFloat;
  readonly M0: BigFloat;
  readonly F0: BigFloat;
  readonly P: B3;
  readonly Q: B3;
  /** Binary64 copies for the Newton start values. */
  readonly e64: number;
  readonly n64: number;
  readonly M064: number;
}

export function hypPrepare(
  position_m: readonly number[],
  velocity_mps: readonly number[],
  mu_m3ps2: number,
): HypPrepared {
  const r: B3 = [B(position_m[0] ?? 0), B(position_m[1] ?? 0), B(position_m[2] ?? 0)];
  const v: B3 = [B(velocity_mps[0] ?? 0), B(velocity_mps[1] ?? 0), B(velocity_mps[2] ?? 0)];
  const mu = B(mu_m3ps2);
  const one = fromInt(1);
  const rmag = sqrt(dotP(r, r), P_BITS);
  const v2 = dotP(v, v);
  const rv = dotP(r, v);
  const energy = sub(div(v2, fromInt(2), P_BITS), div(mu, rmag, P_BITS), P_BITS);
  if (energy.m <= 0n) throw new RangeError('hypPrepare: not hyperbolic');
  const aAbs = div(mu, mul(fromInt(2), energy, P_BITS), P_BITS);
  const c1 = sub(v2, div(mu, rmag, P_BITS), P_BITS);
  const ev = scaleP(div(one, mu, P_BITS), lin(c1, r, neg(rv), v));
  const e = sqrt(dotP(ev, ev), P_BITS);
  const P = scaleP(div(one, e, P_BITS), ev);
  const h = crossP(r, v);
  const hHat = scaleP(div(one, sqrt(dotP(h, h), P_BITS), P_BITS), h);
  const Q = crossP(hHat, P);
  const sqrtE2m1 = sqrt(sub(mul(e, e, P_BITS), one, P_BITS), P_BITS);
  const n = sqrt(div(mu, mul(aAbs, mul(aAbs, aAbs, P_BITS), P_BITS), P_BITS), P_BITS);
  const s0 = div(rv, mul(e, sqrt(mul(mu, aAbs, P_BITS), P_BITS), P_BITS), P_BITS);
  // F₀ = asinh(s0) by Newton on sinh F − s0 = 0.
  let F0 = B(Math.asinh(toNumber(s0)));
  for (let it = 0; it < 200; it++) {
    const step = div(sub(sinh(F0, P_BITS), s0, P_BITS), cosh(F0, P_BITS), P_BITS);
    F0 = sub(F0, step, P_BITS);
    if (converged(step, F0)) break;
    if (it === 199) throw new Error('hypPrepare: asinh no convergence');
  }
  const M0 = sub(mul(e, sinh(F0, P_BITS), P_BITS), F0, P_BITS);
  return {
    mu,
    aAbs,
    e,
    sqrtE2m1,
    n,
    M0,
    F0,
    P,
    Q,
    e64: toNumber(e),
    n64: toNumber(n),
    M064: toNumber(M0),
  };
}

/** Solves e sinh F − F = M to working precision (Newton from a binary64 start). */
export function hypSolveKepler(pr: HypPrepared, M: BigFloat): BigFloat {
  const e64 = pr.e64;
  const m64 = toNumber(M);
  let f64 = Math.asinh(m64 / e64);
  for (let it = 0; it < 100; it++) {
    const step = (e64 * Math.sinh(f64) - f64 - m64) / (e64 * Math.cosh(f64) - 1);
    f64 -= step;
    if (Math.abs(step) < 1e-15 * Math.max(1, Math.abs(f64))) break;
  }
  let F = B(f64);
  const one = fromInt(1);
  for (let it = 0; it < 200; it++) {
    const f = sub(sub(mul(pr.e, sinh(F, P_BITS), P_BITS), F, P_BITS), M, P_BITS);
    const step = div(f, sub(mul(pr.e, cosh(F, P_BITS), P_BITS), one, P_BITS), P_BITS);
    F = sub(F, step, P_BITS);
    if (converged(step, F)) return F;
  }
  throw new Error('hypSolveKepler: no convergence');
}

export interface HypState {
  readonly position_m: B3;
  readonly velocity_mps: B3;
  readonly F: BigFloat;
  readonly r: BigFloat;
}

/** State at the exact binary64 Δt (seconds), to working precision. */
export function hypPropagate(pr: HypPrepared, dt_s: number): HypState {
  const M = add(pr.M0, mul(pr.n, B(dt_s), P_BITS), P_BITS);
  const F = hypSolveKepler(pr, M);
  const ch = cosh(F, P_BITS);
  const sh = sinh(F, P_BITS);
  const x = mul(pr.aAbs, sub(pr.e, ch, P_BITS), P_BITS);
  const y = mul(mul(pr.aAbs, pr.sqrtE2m1, P_BITS), sh, P_BITS);
  const r = mul(pr.aAbs, sub(mul(pr.e, ch, P_BITS), fromInt(1), P_BITS), P_BITS);
  const k = div(sqrt(mul(pr.mu, pr.aAbs, P_BITS), P_BITS), r, P_BITS);
  const vx = neg(mul(k, sh, P_BITS));
  const vy = mul(mul(k, pr.sqrtE2m1, P_BITS), ch, P_BITS);
  return { position_m: lin(x, pr.P, y, pr.Q), velocity_mps: lin(vx, pr.P, vy, pr.Q), F, r };
}

/** F − F₀ (binary64) at Δt. */
export function hypDeltaF(pr: HypPrepared, dt_s: number): number {
  const M = add(pr.M0, mul(pr.n, B(dt_s), P_BITS), P_BITS);
  return toNumber(sub(hypSolveKepler(pr, M), pr.F0, P_BITS));
}
