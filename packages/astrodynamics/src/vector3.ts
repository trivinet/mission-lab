/**
 * 3-vector and 3x3-matrix arithmetic on plain tuples.
 *
 * Semantics common to every function in this module:
 * - Frame-agnostic. All operands of one call must be expressed in the same frame (and, for
 *   matrices, the matrix must map from the frame of its operand to the intended output frame).
 *   No function checks or converts frames; the caller owns that (AGENTS.md: never mix frames
 *   implicitly).
 * - Unit-agnostic. Results carry the algebraic unit of the operation: add/subtract need equal
 *   units; scale multiplies by the scalar's unit; dot and cross give the product of units; norm
 *   gives the operand's unit; normalize gives a dimensionless unit vector.
 * - Pure: inputs are never mutated; every call returns a new tuple.
 * - IEEE 754 binary64 semantics, with the evaluation order stated per function. ECMAScript has
 *   no fused multiply-add, so each written `*`, `+`, `-` and `/` is one correctly rounded
 *   operation and results are bit-reproducible for a given evaluation order. The sign of zero
 *   follows IEEE 754 and is not normalised.
 * - Non-finite inputs propagate per IEEE 754 (NaN/Infinity in, NaN/Infinity out). These are
 *   low-level primitives; validating finiteness before data leaves the engine is the caller's
 *   job (coding-standards §3). The one operation with a domain error intrinsic to it,
 *   `normalizeVec3`, returns a tagged result instead of NaN.
 *
 * Source: elementary linear algebra (component definitions of the Euclidean dot and cross
 * product and of the matrix product in a right-handed Cartesian basis). No algorithm beyond the
 * definitions is used, except the power-of-two rescaling in `normVec3`, documented there.
 */

/** A 3-vector (x, y, z). Unit and frame are those of the quantity it holds. */
export type Vec3 = readonly [number, number, number];

/**
 * A 3x3 matrix stored as three rows: `m[i][j]` is row i, column j. A matrix maps a column vector
 * v to m v (see `mulMat3Vec3`).
 */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

/** a + b, component-wise: [a0 + b0, a1 + b1, a2 + b2]. One rounding per component. */
export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** a - b, component-wise: [a0 - b0, a1 - b1, a2 - b2]. One rounding per component. */
export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** s * a, component-wise: [s * a0, s * a1, s * a2]. One rounding per component. */
export function scaleVec3(s: number, a: Vec3): Vec3 {
  return [s * a[0], s * a[1], s * a[2]];
}

/**
 * Euclidean dot product a . b.
 *
 * Evaluation order (fixed): (a0 * b0 + a1 * b1) + a2 * b2 — three multiplications and two
 * additions, left to right. Symmetric bit-for-bit: dotVec3(a, b) === dotVec3(b, a).
 */
export function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Cross product a x b in a right-handed basis:
 * [a1 * b2 - a2 * b1, a2 * b0 - a0 * b2, a0 * b1 - a1 * b0].
 *
 * Each component is two multiplications and one subtraction, evaluated exactly as written.
 * Consequences of this order (exact, not approximate): crossVec3(a, a) is the zero vector, and
 * crossVec3(a, b) equals -crossVec3(b, a) component-wise (up to the sign of zero).
 */
export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Thresholds and exact power-of-two scale factors for `normVec3`. All are powers of two, so
// multiplying by them is exact unless the product leaves the normal range.
const NORM_SUM_UPPER = 2 ** 1000;
const NORM_SUM_LOWER = 2 ** -1000;
const SCALE_DOWN = 2 ** -600;
const SCALE_UP = 2 ** 600;

function sumOfSquares(x: number, y: number, z: number): number {
  return x * x + y * y + z * z;
}

/**
 * Euclidean norm |a|, same unit as a.
 *
 * Evaluation (fixed):
 * 1. s = (a0 * a0 + a1 * a1) + a2 * a2.
 * 2. If 2^-1000 <= s <= 2^1000 (the "normal path", which covers every magnitude M1 uses, e.g.
 *    positions ~1e7 m, velocities ~1e4 m/s): return Math.sqrt(s).
 *    That is 3 multiplications, 2 additions and 1 square root: 6 correctly rounded operations.
 * 3. Otherwise, unless s is NaN or the vector is zero: rescale by an exact power of two
 *    (2^-600 if s > 2^1000, including s = +Infinity from overflow; 2^600 if s < 2^-1000, including
 *    s = 0 from underflow of a non-zero vector), apply step 1 and Math.sqrt to the scaled
 *    vector, then multiply back by the inverse power of two.
 *
 * Why not `Math.hypot`: ECMAScript leaves its algorithm implementation-defined, so its rounding
 * (and the tolerance it implies) is not fixed by the source. Why not the naive formula alone: it
 * overflows to Infinity for components above ~1.3e154 and underflows to 0 for components below
 * ~1e-162, although the true norm is representable. The rescaling is exact (powers of two), so
 * the fallback has the same 6-operation rounding as the normal path, with two exceptions that do
 * not change the bound at binary64 precision: (i) when scaling down, components that leave the
 * normal range are smaller than 2^-920 times the largest component; (ii) when scaling up, the
 * final multiplication by 2^-600 can produce a subnormal result, which adds one rounding there.
 * On the normal path, squares of small components may be subnormal; their absolute error is at
 * most 2^-1075, i.e. at most 2^-75 relative to s, below the binary64 unit roundoff 2^-53.
 *
 * Special values: |[±0, ±0, ±0]| = +0. Any NaN component gives NaN. Any infinite component (and no
 * NaN) gives +Infinity. A finite vector whose true norm exceeds Number.MAX_VALUE gives +Infinity.
 *
 * Note: Math.sqrt is assumed correctly rounded (IEEE 754 requires it and engines use the hardware
 * instruction); the ECMAScript text itself does not state it. Not verified in this task.
 */
export function normVec3(a: Vec3): number {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const s = sumOfSquares(x, y, z);
  if (s >= NORM_SUM_LOWER && s <= NORM_SUM_UPPER) {
    return Math.sqrt(s);
  }
  if (Number.isNaN(s) || (x === 0 && y === 0 && z === 0)) {
    // NaN propagates; the zero vector has norm +0 (s is +0 because squares of ±0 are +0).
    return Math.sqrt(s);
  }
  if (s > NORM_SUM_UPPER) {
    const xs = x * SCALE_DOWN;
    const ys = y * SCALE_DOWN;
    const zs = z * SCALE_DOWN;
    return Math.sqrt(sumOfSquares(xs, ys, zs)) * SCALE_UP;
  }
  const xs = x * SCALE_UP;
  const ys = y * SCALE_UP;
  const zs = z * SCALE_UP;
  return Math.sqrt(sumOfSquares(xs, ys, zs)) * SCALE_DOWN;
}

/** Reasons `normalizeVec3` can fail. */
export type NormalizeVec3Failure =
  /** All components are ±0: the direction is undefined. */
  | 'ZERO_VECTOR'
  /** A component is NaN or infinite, or the norm overflows: no finite unit vector exists. */
  | 'NON_FINITE_NORM';

/** Result of `normalizeVec3`: a unit vector, or the reason there is none. Never NaN. */
export type NormalizeVec3Result =
  | { readonly ok: true; readonly unit: Vec3 }
  | { readonly ok: false; readonly reason: NormalizeVec3Failure };

/**
 * Unit vector a / |a| (dimensionless, same frame as a).
 *
 * Evaluation: n = normVec3(a); unit = [a0 / n, a1 / n, a2 / n] (one division per component).
 *
 * Domain: a must be finite and non-zero. Outside it the function does not return NaN and does
 * not throw (coding-standards §3: a non-finite value is never data); it returns
 * `{ ok: false, reason }`:
 * - 'ZERO_VECTOR' when every component is ±0 (n = 0);
 * - 'NON_FINITE_NORM' when n is NaN or +Infinity (non-finite input, or overflow of the norm of
 *   a finite vector, which needs components near Number.MAX_VALUE).
 * Any finite non-zero vector, including subnormal ones, yields a finite unit vector, because the
 * norm in that case is finite, positive and not smaller than the largest |component|.
 * The caller maps the failure to its own diagnostic.
 */
export function normalizeVec3(a: Vec3): NormalizeVec3Result {
  const n = normVec3(a);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: 'NON_FINITE_NORM' };
  }
  if (n === 0) {
    return { ok: false, reason: 'ZERO_VECTOR' };
  }
  return { ok: true, unit: [a[0] / n, a[1] / n, a[2] / n] };
}

/**
 * Matrix-vector product m v (v as a column vector).
 *
 * Component i is dotVec3(m[i], v), i.e. (m[i][0] * v0 + m[i][1] * v1) + m[i][2] * v2, bit-for-bit.
 * Frames: if m maps frame A to frame B, v must be in A and the result is in B.
 */
export function mulMat3Vec3(m: Mat3, v: Vec3): Vec3 {
  return [dotVec3(m[0], v), dotVec3(m[1], v), dotVec3(m[2], v)];
}

/** Transpose mᵀ: result[i][j] = m[j][i]. Exact (values are only moved). */
export function transposeMat3(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

function productEntry(a: Mat3, b: Mat3, i: 0 | 1 | 2, j: 0 | 1 | 2): number {
  const row = a[i];
  return row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j];
}

/**
 * Matrix product a b.
 *
 * Entry (i, j) = (a[i][0] * b[0][j] + a[i][1] * b[1][j]) + a[i][2] * b[2][j], left to right
 * (same order as dotVec3 of row i of a with column j of b). Frames: if b maps A to B and a maps
 * B to C, the product maps A to C.
 */
export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  return [
    [productEntry(a, b, 0, 0), productEntry(a, b, 0, 1), productEntry(a, b, 0, 2)],
    [productEntry(a, b, 1, 0), productEntry(a, b, 1, 1), productEntry(a, b, 1, 2)],
    [productEntry(a, b, 2, 0), productEntry(a, b, 2, 1), productEntry(a, b, 2, 2)],
  ];
}
