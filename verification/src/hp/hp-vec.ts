/**
 * 3-vector helpers in BigFloat arithmetic (ML-TASK-018 part C). Verification code only; the engine
 * is neither imported nor consulted (ADR-003).
 */
import { add, div, fromNumber, mul, sqrt, sub, toNumber, PREC, type BigFloat } from './bigfloat';

export type B3 = readonly [BigFloat, BigFloat, BigFloat];

export function b3(v: readonly number[]): B3 {
  return [fromNumber(v[0] ?? NaN), fromNumber(v[1] ?? NaN), fromNumber(v[2] ?? NaN)];
}

export function toV3(v: B3): [number, number, number] {
  return [toNumber(v[0]), toNumber(v[1]), toNumber(v[2])];
}

export function dotB(a: B3, b: B3, p = PREC): BigFloat {
  return add(add(mul(a[0], b[0], p), mul(a[1], b[1], p), p), mul(a[2], b[2], p), p);
}

export function crossB(a: B3, b: B3, p = PREC): B3 {
  return [
    sub(mul(a[1], b[2], p), mul(a[2], b[1], p), p),
    sub(mul(a[2], b[0], p), mul(a[0], b[2], p), p),
    sub(mul(a[0], b[1], p), mul(a[1], b[0], p), p),
  ];
}

export function normB(a: B3, p = PREC): BigFloat {
  return sqrt(dotB(a, a, p), p);
}

export function scaleB(s: BigFloat, a: B3, p = PREC): B3 {
  return [mul(s, a[0], p), mul(s, a[1], p), mul(s, a[2], p)];
}

export function addB(a: B3, b: B3, p = PREC): B3 {
  return [add(a[0], b[0], p), add(a[1], b[1], p), add(a[2], b[2], p)];
}

export function subB(a: B3, b: B3, p = PREC): B3 {
  return [sub(a[0], b[0], p), sub(a[1], b[1], p), sub(a[2], b[2], p)];
}

export function unitB(a: B3, p = PREC): B3 {
  const n = normB(a, p);
  return [div(a[0], n, p), div(a[1], n, p), div(a[2], n, p)];
}

/** ‖a − b‖ in high precision, returned as binary64. */
export function distB(a: B3, b: B3): number {
  return toNumber(normB(subB(a, b)));
}
