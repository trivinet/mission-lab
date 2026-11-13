/**
 * Unit tests of the Stumpff functions (self-consistency, L1 by the implementer).
 *
 * u = 2^-53. Bounds are PROVISIONAL implementer derivations (stumpff.ts module comment); they
 * assume Math.sin/cos/sinh/cosh within 1 ulp (≤ 2u relative) and are to be replaced by the
 * approved tolerance record.
 */
import { describe, expect, test } from 'vitest';
import {
  STUMPFF_SERIES_SWITCH,
  stumpff,
  stumpffC,
  stumpffClosed,
  stumpffCSeries,
  stumpffS,
  stumpffSSeries,
} from './stumpff';

const u = 2 ** -53;

/** Next representable binary64 value towards -Infinity (finite, non-zero x only). */
function nextDown(x: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, x > 0 ? bits - 1n : bits + 1n);
  return view.getFloat64(0);
}

/** Next representable binary64 value towards +Infinity (finite, non-zero x only). */
function nextUp(x: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  view.setBigUint64(0, x > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

describe('values at psi = 0', () => {
  test('C(0) = 1/2 and S(0) = fl(1/6) exactly, for +0 and -0', () => {
    for (const zero of [0, -0]) {
      expect(stumpffC(zero)).toBe(0.5);
      expect(stumpffS(zero)).toBe(1 / 6);
      const all = stumpff(zero);
      expect(all.c0).toBe(1);
      expect(all.c1).toBe(1);
    }
  });

  test('series near 0 matches the two-term expansion on both sides', () => {
    // C = 1/2 - psi/24 + R with |R| <= psi^2/720 (alternating / small-ratio tail);
    // S = 1/6 - psi/120 + R with |R| <= psi^2/5040. Plus the rounding of the series
    // (<= 4u relative, module comment) and of the expansion itself (<= 2u relative).
    for (const psi of [2 ** -30, -(2 ** -30), 1e-10, -1e-10, 1e-3, -1e-3, 0.1, -0.1]) {
      const cExp = 0.5 - psi / 24;
      const sExp = 1 / 6 - psi / 120;
      expect(Math.abs(stumpffC(psi) - cExp)).toBeLessThanOrEqual(
        ((psi * psi) / 720) * 1.01 + 6 * u * 0.5,
      );
      expect(Math.abs(stumpffS(psi) - sExp)).toBeLessThanOrEqual(
        ((psi * psi) / 5040) * 1.01 + 6 * u * (1 / 6),
      );
    }
  });
});

describe('switch-over between series and closed form at |psi| = 4', () => {
  // Derived bound (module comment): series <= 4u, closed form <= 6.5u relative at |psi| = 4,
  // so |series - closed| <= 10.5u |value|; 11u used.
  const switchBound = 11 * u;

  test('series and closed form agree at psi = +4 and -4', () => {
    for (const psi of [STUMPFF_SERIES_SWITCH, -STUMPFF_SERIES_SWITCH]) {
      const closed = stumpffClosed(psi);
      const cSeries = stumpffCSeries(psi);
      const sSeries = stumpffSSeries(psi);
      expect(Math.abs(cSeries - closed.c2)).toBeLessThanOrEqual(switchBound * Math.abs(closed.c2));
      expect(Math.abs(sSeries - closed.c3)).toBeLessThanOrEqual(switchBound * Math.abs(closed.c3));
    }
  });

  test('public functions are continuous across the switch from both sides', () => {
    // Neighbouring arguments psi_in (series) and psi_out (closed). Additional term: the true
    // change of the function, |c'| * |psi_out - psi_in|, with |C'|, |S'| < 0.1 on |psi| <= 4
    // (term-by-term sums of the derivative series at |psi| = 4: < 0.06 and < 0.01).
    const pairs: [number, number][] = [
      [nextDown(4), 4],
      [nextUp(-4), -4],
      [nextDown(4), nextUp(4)],
      [nextUp(-4), nextDown(-4)],
    ];
    for (const [inside, outside] of pairs) {
      expect(Math.abs(inside)).toBeLessThan(STUMPFF_SERIES_SWITCH);
      expect(Math.abs(outside)).toBeGreaterThanOrEqual(STUMPFF_SERIES_SWITCH);
      const step = Math.abs(outside - inside);
      for (const fn of [stumpffC, stumpffS]) {
        const a = fn(inside);
        const b = fn(outside);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(switchBound * Math.abs(b) + 0.1 * step);
      }
    }
  });
});

describe('identities with circular and hyperbolic functions', () => {
  test('series region agrees with the closed forms (1 - cos x)/psi and (x - sin x)/(psi x)', () => {
    // Series error <= 4u relative. Closed-form error, derived per point with 1-ulp elementary
    // functions: S: (2u|sin x| + u|x - sin x|)/|x - sin x| + 3u (sqrt, product, division);
    // C: (2u|cos x| + u|1 - cos x|)/|1 - cos x| + 2u; same with sinh/cosh for psi < 0.
    for (const psi of [0.25, 0.5, 1, 2, 3, 3.9, -0.25, -0.5, -1, -2, -3, -3.9]) {
      const closed = stumpffClosed(psi);
      let trig: number;
      let numerC: number;
      let trigS: number;
      let numerS: number;
      if (psi > 0) {
        const x = Math.sqrt(psi);
        trig = Math.abs(Math.cos(x));
        numerC = Math.abs(1 - Math.cos(x));
        trigS = Math.abs(Math.sin(x));
        numerS = Math.abs(x - Math.sin(x));
      } else {
        const y = Math.sqrt(-psi);
        trig = Math.cosh(y);
        numerC = Math.cosh(y) - 1;
        trigS = Math.sinh(y);
        numerS = Math.sinh(y) - y;
      }
      const boundC = 4 * u + (2 * u * trig + u * numerC) / numerC + 2 * u;
      const boundS = 4 * u + (2 * u * trigS + u * numerS) / numerS + 3 * u;
      expect(Math.abs(stumpffC(psi) - closed.c2)).toBeLessThanOrEqual(boundC * closed.c2);
      expect(Math.abs(stumpffS(psi) - closed.c3)).toBeLessThanOrEqual(boundS * closed.c3);
    }
  });

  test('c0 = 1 - psi C and c1 = 1 - psi S agree with cos/sinc (and cosh/sinhc) everywhere', () => {
    // Series side: c0 = 1 - psi*C with |psi C| <= 1.42 and C within 4u: absolute error
    // <= 1.42*5u + u; the reference cos(sqrt(psi)) adds 2u (1 ulp) plus the sqrt rounding
    // times |sin| (<= u/2 * x <= u). Total <= 12u absolute (|c0| <= 1 for psi >= 0); for psi < 0
    // the same relative to cosh(y) <= 3.8. Closed side: identical expressions, exact.
    for (const psi of [-3.9, -2, -0.5, -1e-8, 1e-8, 0.5, 2, 3.9, 4, 25, 400, -4, -25, -400]) {
      const v = stumpff(psi);
      let c0Ref: number;
      let c1Ref: number;
      if (psi > 0) {
        const x = Math.sqrt(psi);
        c0Ref = Math.cos(x);
        c1Ref = Math.sin(x) / x;
      } else {
        const y = Math.sqrt(-psi);
        c0Ref = Math.cosh(y);
        c1Ref = Math.sinh(y) / y;
      }
      const scale0 = Math.max(1, Math.abs(c0Ref));
      const scale1 = Math.max(1, Math.abs(c1Ref));
      expect(Math.abs(v.c0 - c0Ref)).toBeLessThanOrEqual(12 * u * scale0);
      expect(Math.abs(v.c1 - c1Ref)).toBeLessThanOrEqual(12 * u * scale1);
    }
  });

  test('double-angle identities c0(4 psi) = 2 c0(psi)^2 - 1 and c1(4 psi) = c0(psi) c1(psi)', () => {
    // cos 2x = 2cos^2 x - 1 and sin 2x / (2x) = cos x * sin x / x. Each c value has absolute
    // error <= 12u (previous test) plus the argument rounding (sqrt of psi: u/2 relative,
    // i.e. <= x u/2 absolute in the angle, doubled in 4 psi). Bound: c0: 12u + 4*12u + 3u +
    // 2x u; c1: 12u + 2*12u + 2u + 2x u. Rounded up to (70 + 2x) u. psi > 0 only (|c| <= 1).
    for (const psi of [0.3, 1, 1.5, 3.9, 4, 10, 100, 2500]) {
      const x = Math.sqrt(psi);
      const a = stumpff(psi);
      const b = stumpff(4 * psi);
      const bound = (70 + 2 * x) * u;
      expect(Math.abs(b.c0 - (2 * a.c0 * a.c0 - 1))).toBeLessThanOrEqual(bound);
      expect(Math.abs(b.c1 - a.c0 * a.c1)).toBeLessThanOrEqual(bound);
    }
  });
});

describe('domain edges', () => {
  test('NaN propagates', () => {
    const v = stumpff(Number.NaN);
    expect(Number.isNaN(v.c0) && Number.isNaN(v.c1)).toBe(true);
    expect(Number.isNaN(v.c2) && Number.isNaN(v.c3)).toBe(true);
  });

  test('hyperbolic overflow gives +Infinity, never NaN, as documented', () => {
    const v = stumpff(-1e6);
    expect(v.c0).toBe(Number.POSITIVE_INFINITY);
    expect(v.c1).toBe(Number.POSITIVE_INFINITY);
    expect(v.c2).toBe(Number.POSITIVE_INFINITY);
    expect(v.c3).toBe(Number.POSITIVE_INFINITY);
  });

  test('large positive psi stays finite and bounded: |C| <= 2/psi, |S| <= (x + 1)/(psi x)', () => {
    for (const psi of [1e4, 1e8, 1e12]) {
      const x = Math.sqrt(psi);
      expect(Math.abs(stumpffC(psi))).toBeLessThanOrEqual((2 / psi) * (1 + 4 * u));
      expect(Math.abs(stumpffS(psi))).toBeLessThanOrEqual(((x + 1) / (psi * x)) * (1 + 4 * u));
    }
  });
});
