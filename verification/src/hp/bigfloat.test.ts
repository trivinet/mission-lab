import { describe, expect, it } from 'vitest';
import {
  abs,
  acos,
  add,
  atan,
  atan2,
  cos,
  cosh,
  div,
  exp,
  fromInt,
  fromNumber,
  ilog2,
  mul,
  pi,
  sin,
  sincos,
  sinh,
  sqrt,
  sub,
  toNumber,
  type BigFloat,
} from './bigfloat';

/** |x| ≤ 2^k (or x = 0). */
function below(x: BigFloat, k: number): boolean {
  return x.m === 0n || ilog2(abs(x)) < k;
}

// Deterministic pseudo-random doubles (xorshift); no Math.random so the tests are reproducible.
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

describe('BigFloat arithmetic (self-validation of the high-precision evaluator)', () => {
  it('converts binary64 values exactly in both directions', () => {
    const r = rng(1);
    for (let i = 0; i < 2000; i++) {
      const x = (r() - 0.5) * 10 ** Math.floor(r() * 40 - 20);
      expect(Object.is(toNumber(fromNumber(x)), x)).toBe(true);
    }
    expect(toNumber(fromNumber(Number.MAX_VALUE))).toBe(Number.MAX_VALUE);
    expect(toNumber(fromNumber(2 ** -1022))).toBe(2 ** -1022);
  });

  it('rounds to nearest, ties to even, when converting to binary64', () => {
    // 1 + 2^-53 is a tie between 1 and 1 + 2^-52: ties to even gives 1.
    expect(toNumber(add(fromInt(1), fromNumber(2 ** -53)))).toBe(1);
    // 1 + 3·2^-53 is a tie between 1 + 2^-52 and 1 + 2^-51: even is 1 + 2^-51.
    expect(toNumber(add(fromInt(1), fromNumber(3 * 2 ** -53)))).toBe(1 + 2 ** -51);
    // Just above the tie rounds up.
    expect(toNumber(add(fromInt(1), add(fromNumber(2 ** -53), fromNumber(2 ** -200))))).toBe(
      1 + 2 ** -52,
    );
  });

  it('agrees with binary64 on exactly representable results', () => {
    const r = rng(2);
    for (let i = 0; i < 500; i++) {
      const a = Math.floor(r() * 2 ** 26);
      const b = Math.floor(r() * 2 ** 26) + 1;
      expect(toNumber(mul(fromNumber(a), fromNumber(b)))).toBe(a * b);
      expect(toNumber(add(fromNumber(a), fromNumber(b)))).toBe(a + b);
      // Correctly rounded division and square root are IEEE 754 requirements, so they must match.
      expect(toNumber(div(fromNumber(a), fromNumber(b)))).toBe(a / b);
    }
  });

  it('computes division and square root to working precision', () => {
    const third = div(fromInt(1), fromInt(3));
    expect(below(sub(mul(third, fromInt(3)), fromInt(1)), -315)).toBe(true);
    const s2 = sqrt(fromInt(2));
    expect(below(sub(mul(s2, s2), fromInt(2)), -315)).toBe(true);
    expect(toNumber(sqrt(fromInt(49)))).toBe(7);
  });

  it('computes π consistently with Math.PI and with atan(1)', () => {
    // ECMA-262 defines Math.PI as the Number value for π, i.e. the binary64 nearest to π.
    expect(toNumber(pi())).toBe(Math.PI);
    expect(below(sub(mul(fromInt(4), atan(fromInt(1))), pi()), -315)).toBe(true);
    expect(below(sin(pi()), -310)).toBe(true);
    expect(below(add(cos(pi()), fromInt(1)), -315)).toBe(true);
  });

  it('satisfies trigonometric identities at small and large arguments', () => {
    for (const x of [1e-30, 0.1, 1, 3, 100, 12345.678, 1e6, 2 ** 60]) {
      const { sin: s, cos: c } = sincos(fromNumber(x));
      expect(below(sub(add(mul(s, s), mul(c, c)), fromInt(1)), -300)).toBe(true);
      // sin(2x) = 2 sin x cos x
      const s2 = sin(mul(fromInt(2), fromNumber(x)));
      expect(below(sub(s2, mul(fromInt(2), mul(s, c))), -290)).toBe(true);
    }
    // sin of the binary64 nearest to π equals π − fl(π) to high relative accuracy.
    const d = sub(pi(), fromNumber(Math.PI));
    const s = sin(fromNumber(Math.PI));
    expect(below(sub(s, d), ilog2(abs(d)) - 100)).toBe(true);
  });

  it('inverts tangent and cosine', () => {
    for (const x of [-7.5, -1, -0.3, 1e-12, 0.5, 2, 1e8]) {
      const a = atan(fromNumber(x));
      const { sin: s, cos: c } = sincos(a);
      // tan has relative condition number (1 + x²)/|x| ≈ |x| for large |x|.
      const cond = Math.ceil(Math.log2(Math.max(1, Math.abs(x))));
      expect(below(sub(div(s, c), fromNumber(x)), ilog2(abs(fromNumber(x))) - 300 + cond)).toBe(
        true,
      );
    }
    for (const x of [-1, -0.999999, -0.2, 0, 0.7, 0.9999999999]) {
      const a = acos(fromNumber(x));
      expect(below(sub(cos(a), fromNumber(x)), -290)).toBe(true);
    }
    // atan2 quadrants
    const q2 = atan2(fromNumber(1), fromNumber(-1));
    expect(below(sub(q2, mul(div(fromInt(3), fromInt(4)), pi())), -310)).toBe(true);
    const q3 = atan2(fromNumber(-1), fromNumber(-1));
    expect(below(add(q3, mul(div(fromInt(3), fromInt(4)), pi())), -310)).toBe(true);
  });

  it('computes exp, sinh and cosh consistently', () => {
    // ECMA-262 defines Math.E as the Number value for e.
    expect(toNumber(exp(fromInt(1)))).toBe(Math.E);
    for (const x of [-20, -1, 1e-20, 0.5, 3, 40]) {
      const X = fromNumber(x);
      expect(below(sub(mul(exp(X), exp(sub(fromInt(0), X))), fromInt(1)), -300)).toBe(true);
      const c = cosh(X);
      const s = sinh(X);
      expect(below(sub(sub(mul(c, c), mul(s, s)), fromInt(1)), ilog2(mul(c, c)) - 300)).toBe(true);
    }
  });
});
