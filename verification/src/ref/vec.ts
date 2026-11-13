/**
 * Minimal 3-vector and 3×3 matrix helpers for the verification references (ML-TASK-011).
 *
 * Written for this workspace; the engine's vector module is neither imported nor consulted
 * (ADR-003). Plain binary64 arithmetic in the order written, no fused operations.
 */

export type V3 = readonly [number, number, number];
/** Row-major 3×3 matrix. */
export type M3 = readonly [V3, V3, V3];

export function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function norm(a: V3): number {
  return Math.sqrt(dot(a, a));
}

export function scale(s: number, a: V3): V3 {
  return [s * a[0], s * a[1], s * a[2]];
}

export function addV(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subV(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Euclidean norm of a − b. */
export function dist(a: V3, b: V3): number {
  return norm(subV(a, b));
}

export function matVec(m: M3, v: V3): V3 {
  return [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
}

export function matMul(a: M3, b: M3): M3 {
  const col = (j: 0 | 1 | 2): V3 => [b[0][j], b[1][j], b[2][j]];
  const c0 = col(0);
  const c1 = col(1);
  const c2 = col(2);
  return [
    [dot(a[0], c0), dot(a[0], c1), dot(a[0], c2)],
    [dot(a[1], c0), dot(a[1], c1), dot(a[1], c2)],
    [dot(a[2], c0), dot(a[2], c1), dot(a[2], c2)],
  ];
}

export function transpose(m: M3): M3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/**
 * Active rotation by angle θ about the z axis (a vector is rotated counter-clockwise when viewed
 * from +z). Equals the transpose of the passive (frame) rotation often written R3(θ).
 */
export function rotZ(theta: number): M3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/** Active rotation by angle θ about the x axis. */
export function rotX(theta: number): M3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

const TWO_PI = 2 * Math.PI;

/** Reduces an angle to [0, 2π) (2π meaning the binary64 value 2 * Math.PI). */
export function wrapTwoPi(x: number): number {
  let y = x % TWO_PI;
  if (y < 0) y += TWO_PI;
  if (y >= TWO_PI) y = 0;
  return y;
}

/** Reduces an angle difference to (−π, π]. */
export function wrapPi(x: number): number {
  let y = wrapTwoPi(x);
  if (y > Math.PI) y -= TWO_PI;
  return y;
}
