/**
 * Arbitrary-precision binary floating point for verification (ML-TASK-011).
 *
 * A value is m × 2^e with a BigInt significand m and an integer exponent e. Every operation
 * rounds its exact result to PREC significant bits (round to nearest, ties to even). With the
 * default PREC = 320 bits the unit round-off is 2^-320 ≈ 4.7e-97, about 80 orders of magnitude
 * below binary64, so the results serve as exact values for every comparison in this workspace.
 *
 * No constant is written from memory: π is computed from Machin's formula
 * π = 16 atan(1/5) − 4 atan(1/239), and every elementary function is evaluated from its Taylor
 * series after an argument reduction that is exact or carried out at higher precision.
 *
 * This module is verification code only. It must not be used by, and does not import, the engine.
 */

export const PREC = 320;

export interface BigFloat {
  readonly m: bigint;
  readonly e: number;
}

const ZERO_BF: BigFloat = { m: 0n, e: 0 };

function bitLength(m: bigint): number {
  const a = m < 0n ? -m : m;
  if (a === 0n) return 0;
  return a.toString(2).length;
}

/** Rounds m × 2^e to `prec` significant bits, round half to even. */
function roundTo(m: bigint, e: number, prec: number): BigFloat {
  if (m === 0n) return ZERO_BF;
  const len = bitLength(m);
  if (len <= prec) return { m, e };
  const shift = len - prec;
  const neg = m < 0n;
  const a = neg ? -m : m;
  const sh = BigInt(shift);
  let q = a >> sh;
  const rem = a - (q << sh);
  const half = 1n << (sh - 1n);
  if (rem > half || (rem === half && (q & 1n) === 1n)) q += 1n;
  return { m: neg ? -q : q, e: e + shift };
}

export function bf(m: bigint, e = 0, prec = PREC): BigFloat {
  return roundTo(m, e, prec);
}

/** Exact conversion of a finite binary64 value. */
export function fromNumber(x: number): BigFloat {
  if (!Number.isFinite(x)) throw new RangeError('fromNumber: non-finite value');
  if (x === 0) return ZERO_BF;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n;
  const expBits = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  let m: bigint;
  let e: number;
  if (expBits === 0) {
    m = frac;
    e = -1074;
  } else {
    m = frac | (1n << 52n);
    e = expBits - 1075;
  }
  return { m: sign === 1n ? -m : m, e };
}

export function fromInt(n: number | bigint): BigFloat {
  return roundTo(BigInt(n), 0, PREC);
}

export function isZero(a: BigFloat): boolean {
  return a.m === 0n;
}

export function neg(a: BigFloat): BigFloat {
  return { m: -a.m, e: a.e };
}

export function abs(a: BigFloat): BigFloat {
  return a.m < 0n ? neg(a) : a;
}

export function sign(a: BigFloat): -1 | 0 | 1 {
  return a.m === 0n ? 0 : a.m < 0n ? -1 : 1;
}

/** Multiplies by 2^k exactly. */
export function ldexp(a: BigFloat, k: number): BigFloat {
  return a.m === 0n ? ZERO_BF : { m: a.m, e: a.e + k };
}

export function add(a: BigFloat, b: BigFloat, prec = PREC): BigFloat {
  if (a.m === 0n) return roundTo(b.m, b.e, prec);
  if (b.m === 0n) return roundTo(a.m, a.e, prec);
  // Exact sum, then one rounding. The exponents used in this workspace differ by at most a few
  // thousand, so the aligned integers stay small enough.
  const e = Math.min(a.e, b.e);
  const ma = a.m << BigInt(a.e - e);
  const mb = b.m << BigInt(b.e - e);
  return roundTo(ma + mb, e, prec);
}

export function sub(a: BigFloat, b: BigFloat, prec = PREC): BigFloat {
  return add(a, neg(b), prec);
}

export function mul(a: BigFloat, b: BigFloat, prec = PREC): BigFloat {
  return roundTo(a.m * b.m, a.e + b.e, prec);
}

export function div(a: BigFloat, b: BigFloat, prec = PREC): BigFloat {
  if (b.m === 0n) throw new RangeError('div: division by zero');
  if (a.m === 0n) return ZERO_BF;
  // Scale the dividend so the integer quotient has at least prec + 2 bits, then round.
  const negative = a.m < 0n !== b.m < 0n;
  const am = a.m < 0n ? -a.m : a.m;
  const bm = b.m < 0n ? -b.m : b.m;
  const shift = Math.max(0, prec + 2 + bitLength(bm) - bitLength(am));
  const num = am << BigInt(shift);
  const q = num / bm;
  const r = num - q * bm;
  // A non-zero remainder becomes a sticky bit below the quotient so rounding stays correct.
  const qs = (q << 1n) + (r === 0n ? 0n : 1n);
  return roundTo(negative ? -qs : qs, a.e - b.e - shift - 1, prec);
}

export function cmp(a: BigFloat, b: BigFloat): -1 | 0 | 1 {
  return sign(sub(a, b, PREC + 64));
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('isqrt of negative');
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(bitLength(n) / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

export function sqrt(a: BigFloat, prec = PREC): BigFloat {
  if (a.m < 0n) throw new RangeError('sqrt of negative');
  if (a.m === 0n) return ZERO_BF;
  let shift = Math.max(0, 2 * (prec + 2) - bitLength(a.m));
  if ((a.e - shift) % 2 !== 0) shift += 1;
  const n = a.m << BigInt(shift);
  const s = isqrt(n);
  const exact = s * s === n;
  return roundTo((s << 1n) + (exact ? 0n : 1n), (a.e - shift) / 2 - 1, prec);
}

/** Correctly rounded conversion to binary64 (normal range; round half to even). */
export function toNumber(a: BigFloat): number {
  if (a.m === 0n) return 0;
  const r = roundTo(a.m, a.e, 53);
  const exp = r.e;
  // Number(r.m) is exact (|r.m| < 2^53); scaling by powers of two is exact in the normal range.
  let v = Number(r.m);
  let k = exp;
  while (k > 1000) {
    v *= 2 ** 1000;
    k -= 1000;
  }
  while (k < -1000) {
    v *= 2 ** -1000;
    k += 1000;
  }
  return v * 2 ** k;
}

/** Floor of log2|a| (exponent of the leading bit). */
export function ilog2(a: BigFloat): number {
  if (a.m === 0n) throw new RangeError('ilog2 of zero');
  return a.e + bitLength(a.m) - 1;
}

// ---------------------------------------------------------------------------------------------
// Elementary functions

const workPrec = PREC + 64;

/** Taylor series of atan for |x| ≤ 1/8, at precision p. */
function atanSeries(x: BigFloat, p: number): BigFloat {
  const x2 = mul(x, x, p);
  let term = x;
  let sum = x;
  for (let k = 1; ; k++) {
    term = neg(mul(term, x2, p));
    const t = div(term, fromInt(2 * k + 1), p);
    if (t.m === 0n || ilog2(abs(t)) < ilog2(abs(sum)) - p - 2) break;
    sum = add(sum, t, p);
  }
  return sum;
}

let piCache: { prec: number; value: BigFloat } | undefined;

/** π to precision p (Machin: π = 16 atan(1/5) − 4 atan(1/239)). */
export function pi(p = PREC): BigFloat {
  if (piCache !== undefined && piCache.prec >= p)
    return roundTo(piCache.value.m, piCache.value.e, p);
  const q = p + 32;
  const a5 = atanSeries(div(fromInt(1), fromInt(5), q), q);
  const a239 = atanSeries(div(fromInt(1), fromInt(239), q), q);
  const value = sub(mul(fromInt(16), a5, q), mul(fromInt(4), a239, q), q);
  piCache = { prec: q, value };
  return roundTo(value.m, value.e, p);
}

/** atan(x) at precision p. */
export function atan(x: BigFloat, p = PREC): BigFloat {
  const q = p + 32;
  if (x.m === 0n) return ZERO_BF;
  const one = fromInt(1);
  if (cmp(abs(x), one) > 0) {
    const half = ldexp(pi(q), -1);
    const r = sub(half, atan(div(one, abs(x), q), q), q);
    return roundTo(sign(x) < 0 ? -r.m : r.m, r.e, p);
  }
  // Halve the angle until |x| ≤ 1/8: atan(x) = 2 atan(x / (1 + √(1 + x²))).
  let y = x;
  let doublings = 0;
  const eighth = ldexp(one, -3);
  while (cmp(abs(y), eighth) > 0) {
    y = div(y, add(one, sqrt(add(one, mul(y, y, q), q), q), q), q);
    doublings += 1;
  }
  const r = ldexp(atanSeries(y, q), doublings);
  return roundTo(r.m, r.e, p);
}

/** atan2(y, x) with the quadrant rules of ECMA-262 Math.atan2 for finite non-zero cases. */
export function atan2(y: BigFloat, x: BigFloat, p = PREC): BigFloat {
  const q = p + 32;
  if (x.m === 0n && y.m === 0n) throw new RangeError('atan2(0, 0) is not used here');
  if (x.m === 0n) {
    const h = ldexp(pi(q), -1);
    return roundTo(y.m > 0n ? h.m : -h.m, h.e, p);
  }
  const base = atan(div(y, x, q), q);
  if (x.m > 0n) return roundTo(base.m, base.e, p);
  const r = y.m >= 0n ? add(base, pi(q), q) : sub(base, pi(q), q);
  return roundTo(r.m, r.e, p);
}

/** Reduces x to r = x − k π/2 with |r| ≤ π/4 (approximately), returning k mod 4 and r. */
function reduceHalfPi(x: BigFloat, p: number): { k: number; r: BigFloat } {
  // Extra precision covers the cancellation of large arguments (up to 2^200 here).
  const extra = Math.max(0, ilogSafe(x)) + 64;
  const q = p + extra;
  const halfPi = ldexp(pi(q), -1);
  const kf = div(x, halfPi, q);
  // Round kf to the nearest integer.
  const k = roundToInteger(kf);
  const r = sub(x, mul(fromBigInt(k, q), halfPi, q), q);
  const k4 = Number(((k % 4n) + 4n) % 4n);
  return { k: k4, r: roundTo(r.m, r.e, p) };
}

function ilogSafe(x: BigFloat): number {
  return x.m === 0n ? 0 : ilog2(abs(x));
}

function fromBigInt(k: bigint, p: number): BigFloat {
  return roundTo(k, 0, p);
}

/** Nearest integer (ties away from zero; ties do not occur for the arguments used). */
export function roundToInteger(a: BigFloat): bigint {
  if (a.m === 0n) return 0n;
  if (a.e >= 0) return a.m << BigInt(a.e);
  const sh = BigInt(-a.e);
  const neg_ = a.m < 0n;
  const abs_ = neg_ ? -a.m : a.m;
  let q = abs_ >> sh;
  const rem = abs_ - (q << sh);
  if (rem << 1n >= 1n << sh) q += 1n;
  return neg_ ? -q : q;
}

/** Floor to an integer. */
export function floorToInteger(a: BigFloat): bigint {
  if (a.e >= 0) return a.m << BigInt(a.e);
  const sh = BigInt(-a.e);
  return a.m >> sh; // arithmetic shift on BigInt is floor division by 2^sh
}

function sinCosSeries(r: BigFloat, p: number): { s: BigFloat; c: BigFloat } {
  const r2 = mul(r, r, p);
  let s = r;
  let term = r;
  for (let k = 1; ; k++) {
    term = neg(div(mul(term, r2, p), fromInt(2 * k * (2 * k + 1)), p));
    if (term.m === 0n || (s.m !== 0n && ilog2(abs(term)) < ilog2(abs(s)) - p - 2)) break;
    s = add(s, term, p);
  }
  let c = fromInt(1);
  term = c;
  for (let k = 1; ; k++) {
    term = neg(div(mul(term, r2, p), fromInt((2 * k - 1) * (2 * k)), p));
    if (term.m === 0n || ilog2(abs(term)) < ilog2(abs(c)) - p - 2) break;
    c = add(c, term, p);
  }
  return { s, c };
}

export function sincos(x: BigFloat, p = PREC): { sin: BigFloat; cos: BigFloat } {
  const q = p + 32;
  if (x.m === 0n) return { sin: ZERO_BF, cos: fromInt(1) };
  const { k, r } = reduceHalfPi(x, q);
  const { s, c } = sinCosSeries(r, q);
  let sn: BigFloat;
  let cs: BigFloat;
  switch (k) {
    case 0:
      sn = s;
      cs = c;
      break;
    case 1:
      sn = c;
      cs = neg(s);
      break;
    case 2:
      sn = neg(s);
      cs = neg(c);
      break;
    default:
      sn = neg(c);
      cs = s;
  }
  return { sin: roundTo(sn.m, sn.e, p), cos: roundTo(cs.m, cs.e, p) };
}

export function sin(x: BigFloat, p = PREC): BigFloat {
  return sincos(x, p).sin;
}

export function cos(x: BigFloat, p = PREC): BigFloat {
  return sincos(x, p).cos;
}

/** exp(x) for |x| ≤ 2^10: Taylor series on x/2^s, then s squarings. */
export function exp(x: BigFloat, p = PREC): BigFloat {
  if (x.m === 0n) return fromInt(1);
  const s = Math.max(0, ilog2(abs(x)) + 8);
  const q = p + 32 + s;
  const y = ldexp(x, -s);
  let sum = fromInt(1);
  let term = sum;
  for (let k = 1; ; k++) {
    term = div(mul(term, y, q), fromInt(k), q);
    if (term.m === 0n || ilog2(abs(term)) < ilog2(abs(sum)) - q - 2) break;
    sum = add(sum, term, q);
  }
  for (let i = 0; i < s; i++) sum = mul(sum, sum, q);
  return roundTo(sum.m, sum.e, p);
}

/** sinh, with the Taylor series for |x| < 1 to avoid cancellation. */
export function sinh(x: BigFloat, p = PREC): BigFloat {
  const q = p + 32;
  if (x.m === 0n) return ZERO_BF;
  if (cmp(abs(x), fromInt(1)) < 0) {
    const x2 = mul(x, x, q);
    let sum = x;
    let term = x;
    for (let k = 1; ; k++) {
      term = div(mul(term, x2, q), fromInt(2 * k * (2 * k + 1)), q);
      if (term.m === 0n || ilog2(abs(term)) < ilog2(abs(sum)) - q - 2) break;
      sum = add(sum, term, q);
    }
    return roundTo(sum.m, sum.e, p);
  }
  const ex = exp(x, q);
  const r = ldexp(sub(ex, div(fromInt(1), ex, q), q), -1);
  return roundTo(r.m, r.e, p);
}

export function cosh(x: BigFloat, p = PREC): BigFloat {
  const q = p + 32;
  const ex = exp(x, q);
  const r = ldexp(add(ex, div(fromInt(1), ex, q), q), -1);
  return roundTo(r.m, r.e, p);
}

/** acos(x) for |x| ≤ 1, via atan2(√(1 − x²), x). */
export function acos(x: BigFloat, p = PREC): BigFloat {
  const q = p + 32;
  const one = fromInt(1);
  const s = sqrt(sub(one, mul(x, x, q), q), q);
  if (s.m === 0n) return x.m > 0n ? ZERO_BF : pi(p);
  const r = atan2(s, x, q);
  return roundTo(r.m, r.e, p);
}

// ---------------------------------------------------------------------------------------------
// Measuring binary64 results

/** Size of one unit in the last place of the binary64 nearest to |a| (normal range). */
export function ulpOf(a: BigFloat): BigFloat {
  const k = Math.max(ilog2(abs(a)), -1022);
  return { m: 1n, e: k - 52 };
}

/** |computed − exact| in units of ulp(exact), as a binary64 number. */
export function ulpError(computed: number, exact: BigFloat): number {
  if (exact.m === 0n) return computed === 0 ? 0 : Number.POSITIVE_INFINITY;
  const d = abs(sub(fromNumber(computed), exact));
  return toNumber(div(d, ulpOf(exact)));
}

/** |computed − exact| / |exact| in units of u = 2^-53, as a binary64 number. */
export function relErrorInU(computed: number, exact: BigFloat): number {
  if (exact.m === 0n) return computed === 0 ? 0 : Number.POSITIVE_INFINITY;
  const d = abs(sub(fromNumber(computed), exact));
  return toNumber(ldexp(div(d, abs(exact)), 53));
}
