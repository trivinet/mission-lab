/**
 * The L2a algorithm (classical elements + Kepler's equation in eccentric anomaly) evaluated in
 * BigFloat arithmetic (default 200 bits), from the exact binary64 initial state.
 *
 * Purpose: measure the actual rounding error of the binary64 L2a reference (tolerance record
 * §6.4, §9.1) and of the L2b reference at selected times. It is the same algorithm as L2a, so it
 * says nothing about algorithmic errors; those are cross-checked by L2b (a different algorithm).
 * Verification code only; it does not import or call the engine.
 */
import {
  add,
  atan2,
  div,
  fromNumber,
  ilog2,
  abs,
  mul,
  neg,
  sincos,
  sqrt,
  sub,
  toNumber,
  fromInt,
  type BigFloat,
} from './bigfloat';

type B3 = readonly [BigFloat, BigFloat, BigFloat];

export interface HpState {
  readonly position_m: B3;
  readonly velocity_mps: B3;
}

export interface HpPrepared {
  readonly p: number;
  readonly mu: BigFloat;
  readonly a: BigFloat;
  readonly e: BigFloat;
  readonly n: BigFloat;
  readonly M0: BigFloat;
  readonly sqrt1me2: BigFloat;
  /** Unit vectors to periapsis (P) and 90° ahead in the direction of motion (Q). */
  readonly P: B3;
  readonly Q: B3;
}

function dotB(a: B3, b: B3, p: number): BigFloat {
  return add(add(mul(a[0], b[0], p), mul(a[1], b[1], p), p), mul(a[2], b[2], p), p);
}

function crossB(a: B3, b: B3, p: number): B3 {
  return [
    sub(mul(a[1], b[2], p), mul(a[2], b[1], p), p),
    sub(mul(a[2], b[0], p), mul(a[0], b[2], p), p),
    sub(mul(a[0], b[1], p), mul(a[1], b[0], p), p),
  ];
}

function lin(ca: BigFloat, a: B3, cb: BigFloat, b: B3, p: number): B3 {
  return [
    add(mul(ca, a[0], p), mul(cb, b[0], p), p),
    add(mul(ca, a[1], p), mul(cb, b[1], p), p),
    add(mul(ca, a[2], p), mul(cb, b[2], p), p),
  ];
}

const B = (x: number): BigFloat => fromNumber(x);

export function hpPrepare(
  position_m: readonly number[],
  velocity_mps: readonly number[],
  mu_m3ps2: number,
  p = 200,
): HpPrepared {
  const r: B3 = [B(position_m[0] ?? 0), B(position_m[1] ?? 0), B(position_m[2] ?? 0)];
  const v: B3 = [B(velocity_mps[0] ?? 0), B(velocity_mps[1] ?? 0), B(velocity_mps[2] ?? 0)];
  const mu = B(mu_m3ps2);
  const one = fromInt(1);
  const h = crossB(r, v, p);
  const hmag = sqrt(dotB(h, h, p), p);
  const hxy = sqrt(add(mul(h[0], h[0], p), mul(h[1], h[1], p), p), p);
  let nHat: B3;
  let mHat: B3;
  if (hxy.m === 0n) {
    nHat = [one, fromInt(0), fromInt(0)];
    mHat = [fromInt(0), h[2].m < 0n ? neg(one) : one, fromInt(0)];
  } else {
    nHat = [div(neg(h[1]), hxy, p), div(h[0], hxy, p), fromInt(0)];
    const d = mul(hmag, hxy, p);
    mHat = [
      div(neg(mul(h[2], h[0], p)), d, p),
      div(neg(mul(h[2], h[1], p)), d, p),
      div(mul(hxy, hxy, p), d, p),
    ];
  }
  const u = atan2(dotB(r, mHat, p), dotB(r, nHat, p), p);
  const rmag = sqrt(dotB(r, r, p), p);
  const v2 = dotB(v, v, p);
  const ecos = sub(div(mul(hmag, hmag, p), mul(mu, rmag, p), p), one, p);
  const esin = div(mul(hmag, dotB(r, v, p), p), mul(mu, rmag, p), p);
  const e = sqrt(add(mul(ecos, ecos, p), mul(esin, esin, p), p), p);
  const nu = e.m === 0n ? fromInt(0) : atan2(esin, ecos, p);
  const w = sub(u, nu, p);
  const a = div(one, sub(div(fromInt(2), rmag, p), div(v2, mu, p), p), p);
  const sqrt1me2 = sqrt(sub(one, mul(e, e, p), p), p);
  const { sin: sn, cos: cn } = sincos(nu, p);
  const E0 = atan2(mul(sqrt1me2, sn, p), add(e, cn, p), p);
  const M0 = sub(E0, mul(e, sincos(E0, p).sin, p), p);
  const n = sqrt(div(mu, mul(a, mul(a, a, p), p), p), p);
  const { sin: sw, cos: cw } = sincos(w, p);
  const P = lin(cw, nHat, sw, mHat, p);
  const Q = lin(neg(sw), nHat, cw, mHat, p);
  return { p, mu, a, e, n, M0, sqrt1me2, P, Q };
}

/** Exact-to-working-precision solution of E − e sin E = M (Newton, quadratic convergence). */
export function hpSolveKepler(M: BigFloat, e: BigFloat, p: number): BigFloat {
  let E = add(M, mul(e, sincos(M, p).sin, p), p);
  for (let it = 0; it < 200; it++) {
    const { sin: s, cos: c } = sincos(E, p);
    const f = sub(sub(E, mul(e, s, p), p), M, p);
    const step = div(f, sub(fromInt(1), mul(e, c, p), p), p);
    E = sub(E, step, p);
    if (step.m === 0n || ilog2(abs(step)) < -p + 8 + Math.max(0, ilog2(abs(E)))) return E;
  }
  throw new Error('hpSolveKepler: no convergence');
}

/** State at exact binary64 Δt (seconds), to working precision. */
export function hpPropagate(pr: HpPrepared, dt_s: number): HpState {
  const p = pr.p;
  const M = add(pr.M0, mul(pr.n, B(dt_s), p), p);
  const E = hpSolveKepler(M, pr.e, p);
  const { sin: sE, cos: cE } = sincos(E, p);
  const x = mul(pr.a, sub(cE, pr.e, p), p);
  const y = mul(mul(pr.a, pr.sqrt1me2, p), sE, p);
  const an = mul(pr.a, pr.n, p);
  const den = sub(fromInt(1), mul(pr.e, cE, p), p);
  const vx = div(neg(mul(an, sE, p)), den, p);
  const vy = div(mul(mul(an, pr.sqrt1me2, p), cE, p), den, p);
  return { position_m: lin(x, pr.P, y, pr.Q, p), velocity_mps: lin(vx, pr.P, vy, pr.Q, p) };
}

/** ‖b64 − hp‖ evaluated in high precision, returned as binary64. */
export function hpDist(a: readonly number[], b: B3): number {
  const d0 = sub(B(a[0] ?? 0), b[0]);
  const d1 = sub(B(a[1] ?? 0), b[1]);
  const d2 = sub(B(a[2] ?? 0), b[2]);
  return toNumber(sqrt(add(add(mul(d0, d0), mul(d1, d1)), mul(d2, d2))));
}

/**
 * Exact residual |E − e sin E − M| (radians of mean anomaly) of binary64 E, e, M, where
 * M is given as the exact value M0 + n·Δt of the binary64 operands M0, n, Δt (so the rounding
 * of the binary64 M itself is part of the measured residual).
 */
export function keplerResidual(E: number, e: number, M0: number, n: number, dt: number): number {
  const p = 200;
  const M = add(B(M0), mul(B(n), B(dt), p), p);
  const f = sub(sub(B(E), mul(B(e), sincos(B(E), p).sin, p), p), M, p);
  return toNumber(abs(f));
}

/**
 * Element → state in BigFloat arithmetic with the closed-form perifocal unit vectors
 * P = (cΩcω − sΩsω ci, sΩcω + cΩsω ci, sω si), Q = (−cΩsω − sΩcω ci, −sΩsω + cΩcω ci, cω si),
 * i.e. the columns of Rz(Ω)Rx(i)Rz(ω) multiplied out by hand. A different evaluation path from
 * the binary64 L2c matrix product, used to measure L2c's own error (tolerance record §7 VT-02).
 */
export function hpElementsToState(
  el: {
    readonly semiMajorAxis_m: number;
    readonly eccentricity: number;
    readonly inclination_rad: number;
    readonly raan_rad: number;
    readonly argPeriapsis_rad: number;
    readonly trueAnomaly_rad: number;
  },
  mu_m3ps2: number,
  p = 200,
): HpState {
  const one = fromInt(1);
  const a = B(el.semiMajorAxis_m);
  const e = B(el.eccentricity);
  const mu = B(mu_m3ps2);
  const { sin: sO, cos: cO } = sincos(B(el.raan_rad), p);
  const { sin: si, cos: ci } = sincos(B(el.inclination_rad), p);
  const { sin: sw, cos: cw } = sincos(B(el.argPeriapsis_rad), p);
  const { sin: sn, cos: cn } = sincos(B(el.trueAnomaly_rad), p);
  const P: B3 = [
    sub(mul(cO, cw, p), mul(mul(sO, sw, p), ci, p), p),
    add(mul(sO, cw, p), mul(mul(cO, sw, p), ci, p), p),
    mul(sw, si, p),
  ];
  const Q: B3 = [
    sub(neg(mul(cO, sw, p)), mul(mul(sO, cw, p), ci, p), p),
    add(neg(mul(sO, sw, p)), mul(mul(cO, cw, p), ci, p), p),
    mul(cw, si, p),
  ];
  const sl = mul(a, sub(one, mul(e, e, p), p), p);
  const r = div(sl, add(one, mul(e, cn, p), p), p);
  const k = sqrt(div(mu, sl, p), p);
  return {
    position_m: lin(mul(r, cn, p), P, mul(r, sn, p), Q, p),
    velocity_mps: lin(neg(mul(k, sn, p)), P, mul(k, add(e, cn, p), p), Q, p),
  };
}
