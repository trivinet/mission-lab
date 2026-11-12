/**
 * VT-01 (L1, identities) unit tests for vector3.ts.
 *
 * Bound policy. Exact cases use `toBe` (Object.is: distinguishes +0 and -0). Inexact identities
 * use a bound derived in the test from the standard model of IEEE 754 binary64 arithmetic with
 * round-to-nearest: every +, -, *, /, sqrt satisfies fl(x op y) = (x op y)(1 + d), |d| <= u,
 * u = 2^-53, as long as no underflow or overflow occurs (all sample magnitudes below stay far
 * from both). Accumulated factors are bounded by gamma(k) = k u / (1 - k u) for k rounding
 * factors. Each bound states its derivation (first order, then a stated allowance for the
 * second-order terms).
 *
 * PROVISIONAL: these bounds are the implementer's, written for the unit tests only. The official
 * tolerance record is derived independently in ML-TASK-010 and replaces them for VT-01.
 */
import { describe, expect, it } from 'vitest';
import {
  addVec3,
  crossVec3,
  dotVec3,
  mulMat3,
  mulMat3Vec3,
  normalizeVec3,
  normVec3,
  scaleVec3,
  subVec3,
  transposeMat3,
} from './vector3';
import type { Mat3, Vec3 } from './vector3';

const U = 2 ** -53;
const gamma = (k: number): number => (k * U) / (1 - k * U);
// The bounds are themselves evaluated in binary64 with at most ~20 operations, i.e. a relative
// error below gamma(20) ~ 2.2e-15. MARGIN = 1 + 2^-40 (~1 + 9.1e-13) dominates that.
const MARGIN = 1 + 2 ** -40;

/** Test vectors: orbit-like magnitudes (m, m/s) and non-round mantissas; all finite, non-zero. */
const SAMPLES: readonly Vec3[] = [
  [6778137.0, 0, 0],
  [-4012345.678, 5123456.789, 2345678.901],
  [7612.345, -1234.567, 89.012],
  [0.1, 0.2, 0.3],
  [1e-3, -7.5e3, 3.3e2],
  [-2.5, 1e8, -3.7e-2],
  [1, 1e-8, -1e8],
];

function expectVecBits(actual: Vec3, expected: Vec3): void {
  expect(actual[0]).toBe(expected[0]);
  expect(actual[1]).toBe(expected[1]);
  expect(actual[2]).toBe(expected[2]);
}

function absVec(a: Vec3): Vec3 {
  return [Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2])];
}

/** t_i = |a_j b_k| + |a_k b_j| for (i, j, k) cyclic: magnitude of the two products in (a x b)_i. */
function crossTerms(a: Vec3, b: Vec3): Vec3 {
  return [
    Math.abs(a[1] * b[2]) + Math.abs(a[2] * b[1]),
    Math.abs(a[2] * b[0]) + Math.abs(a[0] * b[2]),
    Math.abs(a[0] * b[1]) + Math.abs(a[1] * b[0]),
  ];
}

const I3: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

describe('VT-01 exact small-integer cases', () => {
  it('add, subtract, scale', () => {
    expectVecBits(addVec3([1, 2, 3], [4, -5, 6]), [5, -3, 9]);
    expectVecBits(subVec3([1, 2, 3], [4, -5, 6]), [-3, 7, -3]);
    expectVecBits(scaleVec3(-2, [1, 2, 3]), [-2, -4, -6]);
  });

  it('dot', () => {
    expect(dotVec3([1, 2, 3], [4, -5, 6])).toBe(12);
  });

  it('cross of the basis vectors is right-handed', () => {
    expectVecBits(crossVec3([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    expectVecBits(crossVec3([0, 1, 0], [0, 0, 1]), [1, 0, 0]);
    expectVecBits(crossVec3([0, 0, 1], [1, 0, 0]), [0, 1, 0]);
  });

  it('cross of general integer vectors', () => {
    expectVecBits(crossVec3([1, 2, 3], [4, 5, 6]), [-3, 6, -3]);
  });

  it('norm of Pythagorean quadruples', () => {
    expect(normVec3([3, 4, 0])).toBe(5);
    expect(normVec3([2, 3, 6])).toBe(7);
    expect(normVec3([-2, -3, -6])).toBe(7);
    expect(normVec3([1, 4, 8])).toBe(9);
  });

  it('normalize of an axis-aligned vector', () => {
    const r = normalizeVec3([0, -5, 0]);
    expect(r.ok).toBe(true);
    if (r.ok) expectVecBits(r.unit, [0, -1, 0]);
  });

  it('scalar triple product equals the determinant', () => {
    // det [[1,2,3],[4,5,6],[7,8,10]] = 1(50-48) - 2(40-42) + 3(32-35) = -3
    expect(dotVec3([1, 2, 3], crossVec3([4, 5, 6], [7, 8, 10]))).toBe(-3);
  });

  it('matrix-vector and matrix-matrix products', () => {
    const a: Mat3 = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
    ];
    const b: Mat3 = [
      [2, 0, 1],
      [1, 3, -1],
      [0, 1, 4],
    ];
    expectVecBits(mulMat3Vec3(a, [1, -1, 2]), [5, 11, 19]);
    const ab = mulMat3(a, b);
    expectVecBits(ab[0], [4, 9, 11]);
    expectVecBits(ab[1], [13, 21, 23]);
    expectVecBits(ab[2], [22, 34, 39]);
  });
});

describe('VT-01 exact identities on non-integer samples', () => {
  it('dot is symmetric bit-for-bit', () => {
    for (const a of SAMPLES) for (const b of SAMPLES) expect(dotVec3(a, b)).toBe(dotVec3(b, a));
  });

  it('a x a is exactly zero', () => {
    for (const a of SAMPLES) {
      const c = crossVec3(a, a);
      expect(c[0] === 0 && c[1] === 0 && c[2] === 0).toBe(true);
    }
  });

  it('cross is anticommutative: (a x b)_i = -(b x a)_i (=== so that +0 equals -0)', () => {
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const ab = crossVec3(a, b);
        const ba = crossVec3(b, a);
        expect(ab[0] === -ba[0] && ab[1] === -ba[1] && ab[2] === -ba[2]).toBe(true);
      }
    }
  });

  it('parallel vectors with power-of-two ratio have exactly zero cross product', () => {
    // b = 2^k a is exact, so a_j b_k and a_k b_j are the same rounded number times 2^k.
    for (const a of SAMPLES) {
      for (const s of [2, -0.5, 1024]) {
        const c = crossVec3(a, scaleVec3(s, a));
        expect(c[0] === 0 && c[1] === 0 && c[2] === 0).toBe(true);
      }
    }
  });

  it('transpose is an involution (bit-exact, including -0)', () => {
    const m: Mat3 = [
      [-0, 0.1, -2.5e7],
      [3.3e-9, 0, 7],
      [Number.MIN_VALUE, -Number.MAX_VALUE, 1 / 3],
    ];
    const tt = transposeMat3(transposeMat3(m));
    for (let i = 0; i < 3; i += 1) {
      const row = tt[i as 0 | 1 | 2];
      const ref = m[i as 0 | 1 | 2];
      expectVecBits(row, ref);
    }
    expect(transposeMat3(m)[0][1]).toBe(3.3e-9);
  });

  it('(A B)^T equals B^T A^T bit-for-bit (same products, same order)', () => {
    const a: Mat3 = [SAMPLES[1] ?? I3[0], SAMPLES[2] ?? I3[1], SAMPLES[3] ?? I3[2]];
    const b: Mat3 = [SAMPLES[4] ?? I3[0], SAMPLES[5] ?? I3[1], SAMPLES[6] ?? I3[2]];
    const lhs = transposeMat3(mulMat3(a, b));
    const rhs = mulMat3(transposeMat3(b), transposeMat3(a));
    expectVecBits(lhs[0], rhs[0]);
    expectVecBits(lhs[1], rhs[1]);
    expectVecBits(lhs[2], rhs[2]);
  });

  it('identity matrix leaves non-zero-signed vectors unchanged', () => {
    for (const v of SAMPLES) {
      const w = mulMat3Vec3(I3, v);
      // === rather than toBe: 1*x + 0 + 0 turns -0 into +0 (no -0 in SAMPLES, kept general).
      expect(w[0] === v[0] && w[1] === v[1] && w[2] === v[2]).toBe(true);
    }
  });

  it('norm commutes exactly with power-of-two scaling, across the rescaling paths', () => {
    // Multiplying by 2^k is exact for these samples (no subnormal or overflow), and normVec3's
    // fallback rescales by exact powers of two, so normal and fallback paths must agree bit-for-bit.
    for (const v of SAMPLES) {
      const n = normVec3(v);
      for (const k of [-700, -300, 300, 700]) {
        expect(normVec3(scaleVec3(2 ** k, v))).toBe(n * 2 ** k);
      }
    }
  });
});

describe('VT-01 identities with derived rounding bounds (provisional, see header)', () => {
  it('a x b is orthogonal to a and to b', () => {
    // c = fl(a x b), c* exact. Per component: two products and a subtraction,
    // |c_i - c*_i| <= gamma(2) t_i, t_i = |a_j b_k| + |a_k b_j|.
    // a . c* = 0 exactly, so |fl(a . c)| <= gamma(3) sum|a_i c_i| + gamma(2) sum|a_i| t_i.
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const c = crossVec3(a, b);
        const t = crossTerms(a, b);
        for (const x of [a, b]) {
          const bound =
            (gamma(3) * dotVec3(absVec(x), absVec(c)) + gamma(2) * dotVec3(absVec(x), t)) * MARGIN;
          expect(Math.abs(dotVec3(x, c))).toBeLessThanOrEqual(bound);
        }
      }
    }
  });

  it('parallel vectors with a non-power-of-two ratio give a near-zero cross product', () => {
    // b = fl(3a): b_k = 3 a_k (1 + d_k), |d_k| <= u. Exact (a x b)_i = 3 a_j a_k (d_k - d_j), so
    // |(a x b)_i| <= 2u * 3|a_j a_k|, while t_i = |a_j b_k| + |a_k b_j| >= 2 * 3|a_j a_k| (1 - u);
    // hence |(a x b)_i| <= u t_i / (1 - u). The computation adds gamma(2) t_i.
    // Bound: (gamma(2) + u / (1 - u)) t_i, with t_i computed from a and b.
    for (const a of SAMPLES) {
      const b = scaleVec3(3, a);
      const c = crossVec3(a, b);
      const t = crossTerms(a, b);
      for (let i = 0; i < 3; i += 1) {
        const k = i as 0 | 1 | 2;
        const bound = (gamma(2) + U / (1 - U)) * t[k] * MARGIN;
        expect(Math.abs(c[k])).toBeLessThanOrEqual(bound);
      }
    }
  });

  it('Lagrange identity |a x b|^2 + (a . b)^2 = |a|^2 |b|^2', () => {
    // A = |a|, B = |b|, S = A^2 B^2. First-order error of each computed term vs its exact value:
    //   (a.b)^2 : dot error gamma(3) AB, squared: 2*3u S, plus the squaring rounding u S  -> 7u S
    //   |a x b|^2 via dot(c, c): ||c - c*|| <= gamma(2) ||t|| <= 2u sqrt(3) AB (t_i <= AB by
    //            Cauchy-Schwarz), so | ||c||^2 - ||c*||^2 | <= 2 * 2 sqrt(3) u S, plus dot
    //            rounding 3u S                                                     -> 9.93u S
    //   LHS addition                                                               -> 1u S
    //   |a|^2 |b|^2: two dots (3u each) and one product (u)                        -> 7u S
    // Total first order 24.93u S. Bound 32u S: the margin covers the O(u^2) terms (< 1e-30 S).
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const c = crossVec3(a, b);
        const d = dotVec3(a, b);
        const lhs = dotVec3(c, c) + d * d;
        const rhs = dotVec3(a, a) * dotVec3(b, b);
        const bound = 32 * U * rhs * MARGIN;
        expect(Math.abs(lhs - rhs)).toBeLessThanOrEqual(bound);
      }
    }
  });

  it('scalar triple product is invariant under cyclic permutation', () => {
    // P = |a||b||c|. fl(a . fl(b x c)) differs from det[a,b,c] by at most
    // gamma(3) |a| ||fl(b x c)|| + |a| ||fl(b x c) - b x c|| <= (3u + 2 sqrt(3) u) P = 6.47u P
    // (first order; ||t|| <= sqrt(3) |b||c|). Two such values differ by <= 12.93u P. Bound 16u P
    // (margin for the O(u^2) terms and for the |.| evaluation).
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        for (const c of SAMPLES) {
          const t1 = dotVec3(a, crossVec3(b, c));
          const t2 = dotVec3(b, crossVec3(c, a));
          const t3 = dotVec3(c, crossVec3(a, b));
          const p = normVec3(a) * normVec3(b) * normVec3(c);
          const bound = 16 * U * p * MARGIN;
          expect(Math.abs(t1 - t2)).toBeLessThanOrEqual(bound);
          expect(Math.abs(t2 - t3)).toBeLessThanOrEqual(bound);
        }
      }
    }
  });

  it('normalized vector has unit norm', () => {
    // n = |a|(1 + e), |e| <= gamma(4) (3 products, 2 sums -> gamma(3) on s; sqrt halves the
    // relative error of s and adds one rounding). Each component a_i / n adds one rounding, so the
    // exact norm of the result is 1 * prod of 5 factors; the outer norm adds 4 more:
    // |normVec3(unit) - 1| <= gamma(9).
    for (const a of SAMPLES) {
      const r = normalizeVec3(a);
      expect(r.ok).toBe(true);
      if (r.ok) expect(Math.abs(normVec3(r.unit) - 1)).toBeLessThanOrEqual(gamma(9) * MARGIN);
    }
  });

  it('a rotation (orthogonal matrix) preserves the norm', () => {
    // Rz has entries 0.6, 0.8, 0, 1. The literals 0.6, 0.8 carry representation error <= u
    // relative, so Rz_hat = Rz + E, |E| <= u|Rz|; every row of |Rz| has unit 2-norm.
    // Component error of fl(Rz_hat v) vs Rz v: (gamma(3)(1 + u) + u) |v| ~ 4u |v|; vector: 4 sqrt(3) u
    // |v| = 6.93u |v|; the final norm adds gamma(4) ~ 4u. First order 10.93u |v|; bound 16u |v|.
    const rz: Mat3 = [
      [0.6, -0.8, 0],
      [0.8, 0.6, 0],
      [0, 0, 1],
    ];
    for (const v of SAMPLES) {
      const n = normVec3(v);
      expect(Math.abs(normVec3(mulMat3Vec3(rz, v)) - n)).toBeLessThanOrEqual(16 * U * n * MARGIN);
    }
  });

  it('product of two rotations is orthogonal and preserves the norm', () => {
    // P_hat = fl(Rz_hat Rx_hat). Entrywise |P_hat - Rz Rx| <= (2u + gamma(3)) (|Rz||Rx|)_ij ~ 5u,
    // since rows/columns of |Rz|, |Rx| have unit 2-norm.
    // (P_hat P_hat^T - I)_ij: 2 * 5u * sqrt(3) (perturbation) + gamma(3) (rounding) ~ 20.3u;
    // bound 24u.
    // ||fl(P_hat v)|| - |v|: ||Delta P||_F |v| <= 15u |v|; matvec rounding sqrt(3) gamma(3) |v|
    // ~ 5.2u |v|; final norm gamma(4) ~ 4u |v|. First order 24.2u |v|; bound 32u |v|.
    const rz: Mat3 = [
      [0.6, -0.8, 0],
      [0.8, 0.6, 0],
      [0, 0, 1],
    ];
    const rx: Mat3 = [
      [1, 0, 0],
      [0, 0.8, -0.6],
      [0, 0.6, 0.8],
    ];
    const p = mulMat3(rz, rx);
    const ppt = mulMat3(p, transposeMat3(p));
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const value = ppt[i as 0 | 1 | 2][j as 0 | 1 | 2];
        const target = i === j ? 1 : 0;
        expect(Math.abs(value - target)).toBeLessThanOrEqual(24 * U * MARGIN);
      }
    }
    for (const v of SAMPLES) {
      const n = normVec3(v);
      expect(Math.abs(normVec3(mulMat3Vec3(p, v)) - n)).toBeLessThanOrEqual(32 * U * n * MARGIN);
    }
  });
});

describe('VT-01 edge cases', () => {
  it('signed zeros follow IEEE 754 and are not normalised', () => {
    expectVecBits(addVec3([-0, -0, -0], [-0, -0, -0]), [-0, -0, -0]);
    expectVecBits(addVec3([-0, 0, -0], [0, -0, 0]), [0, 0, 0]);
    expectVecBits(scaleVec3(-1, [0, 0, 0]), [-0, -0, -0]);
    expectVecBits(subVec3([0, 0, 0], [0, 0, 0]), [0, 0, 0]);
  });

  it('norm of the zero vector is +0, for either sign of zero', () => {
    expect(normVec3([0, 0, 0])).toBe(0);
    expect(normVec3([-0, -0, -0])).toBe(0);
    expect(normVec3([-0, 0, -0])).toBe(0);
  });

  it('normalize of a zero vector fails with ZERO_VECTOR and no NaN', () => {
    expect(normalizeVec3([0, 0, 0])).toEqual({ ok: false, reason: 'ZERO_VECTOR' });
    expect(normalizeVec3([-0, -0, -0])).toEqual({ ok: false, reason: 'ZERO_VECTOR' });
  });

  it('normalize of non-finite input or overflowing norm fails with NON_FINITE_NORM', () => {
    const failure = { ok: false, reason: 'NON_FINITE_NORM' };
    expect(normalizeVec3([Number.NaN, 0, 0])).toEqual(failure);
    expect(normalizeVec3([Number.POSITIVE_INFINITY, 0, 0])).toEqual(failure);
    expect(normalizeVec3([1, Number.NEGATIVE_INFINITY, Number.NaN])).toEqual(failure);
    const m = Number.MAX_VALUE;
    expect(normalizeVec3([m, m, m])).toEqual(failure);
  });

  it('norm propagates non-finite input', () => {
    expect(normVec3([Number.NaN, 1, 2])).toBeNaN();
    expect(normVec3([Number.NEGATIVE_INFINITY, 1, 2])).toBe(Number.POSITIVE_INFINITY);
    const m = Number.MAX_VALUE;
    expect(normVec3([m, m, m])).toBe(Number.POSITIVE_INFINITY); // true norm sqrt(3) MAX overflows
  });

  it('norm of very large components does not overflow when the result is representable', () => {
    expect(normVec3([3 * 2 ** 600, 4 * 2 ** 600, 0])).toBe(5 * 2 ** 600);
    expect(normVec3([2 ** 600, 2 ** 600, 2 ** 600])).toBe(Math.sqrt(3) * 2 ** 600);
    // MAX_VALUE: scaled to MAX 2^-600, one square and one sqrt -> relative error <= gamma(2).
    const m = Number.MAX_VALUE;
    const n = normVec3([m, 0, -0]);
    expect(Number.isFinite(n)).toBe(true);
    expect(Math.abs(n - m)).toBeLessThanOrEqual(gamma(2) * m);
  });

  it('norm of very small components does not underflow to zero', () => {
    expect(normVec3([3 * 2 ** -600, 4 * 2 ** -600, 0])).toBe(5 * 2 ** -600);
    expect(normVec3([Number.MIN_VALUE, 0, 0])).toBe(Number.MIN_VALUE);
    expect(normVec3([0, -Number.MIN_VALUE, 0])).toBe(Number.MIN_VALUE);
  });

  it('normalize works for subnormal and huge finite vectors', () => {
    const tiny = normalizeVec3([0, 0, -Number.MIN_VALUE]);
    expect(tiny.ok).toBe(true);
    if (tiny.ok) expectVecBits(tiny.unit, [0, 0, -1]);
    const huge = normalizeVec3([3 * 2 ** 600, 0, 4 * 2 ** 600]);
    expect(huge.ok).toBe(true);
    if (huge.ok) expectVecBits(huge.unit, [0.6, 0, 0.8]);
  });

  it('does not mutate its inputs', () => {
    const a: Vec3 = Object.freeze([1, 2, 3] as const);
    const b: Vec3 = Object.freeze([4, 5, 6] as const);
    const m: Mat3 = Object.freeze([a, b, a] as const);
    addVec3(a, b);
    subVec3(a, b);
    scaleVec3(2, a);
    crossVec3(a, b);
    normalizeVec3(a);
    mulMat3Vec3(m, a);
    mulMat3(m, m);
    transposeMat3(m);
    expectVecBits(a, [1, 2, 3]);
    expectVecBits(b, [4, 5, 6]);
  });
});
