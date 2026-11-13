/**
 * Measurement for assumptions A2 and A3 of the tolerance record (§2; open item O-9):
 * A2 — Math.sqrt correctly rounded; A3 — Math.sin/cos/atan2/acos/sinh/cosh with relative error
 * ≤ c_f·u, c_f = 2, at the argument classes of the test grid.
 *
 * Each binary64 result is compared with the 320-bit BigFloat value at the same binary64 argument.
 * This is a sample measurement on the Node version running the tests (engines: 24.22.2), not a
 * proof for all arguments. The worst observed errors are printed and asserted against the
 * record's assumption; a failure is a finding to report (re-evaluation under §4.1), never a
 * reason to change the bound here.
 */
import { describe, expect, it } from 'vitest';
import {
  acos,
  atan2,
  cos,
  cosh,
  fromNumber,
  relErrorInU,
  sin,
  sinh,
  sqrt,
  toNumber,
  ulpError,
  type BigFloat,
} from './bigfloat';

const C_F = 2; // tolerance record B7 / A3

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

interface Worst {
  relU: number;
  ulp: number;
  arg: string;
}

function track(w: Worst, computed: number, exact: BigFloat, arg: string): void {
  const rel = relErrorInU(computed, exact);
  const ulp = ulpError(computed, exact);
  if (rel > w.relU) {
    w.relU = rel;
    w.arg = arg;
  }
  if (ulp > w.ulp) w.ulp = ulp;
}

const fresh = (): Worst => ({ relU: 0, ulp: 0, arg: '' });

function report(name: string, w: Worst): string {
  return `${name}: max rel error ${w.relU.toFixed(3)}u, max ${w.ulp.toFixed(3)} ulp (at ${w.arg})`;
}

describe('A2/A3: accuracy of Math functions on this Node version (sample measurement)', () => {
  it('sin and cos stay within c_f·u relative at every argument class', () => {
    const r = rng(31);
    const classes: Record<string, number[]> = {
      'near 0': [],
      '[-10, 10]': [],
      'near k·π/2': [Math.PI, 2 * Math.PI, Math.PI / 2, (3 * Math.PI) / 2, -Math.PI],
      '|x| ≤ 1000 (multi-revolution)': [],
      '|x| ≤ 1e6': [],
    };
    for (let i = 0; i < 400; i++) {
      classes['near 0']?.push((r() < 0.5 ? -1 : 1) * 10 ** (-300 * r()));
      classes['[-10, 10]']?.push((r() - 0.5) * 20);
      const k = Math.floor(r() * 9) - 4;
      classes['near k·π/2']?.push((k * Math.PI) / 2 + (r() - 0.5) * 10 ** (-16 * r()));
      classes['|x| ≤ 1000 (multi-revolution)']?.push((r() - 0.5) * 2000);
      classes['|x| ≤ 1e6']?.push((r() - 0.5) * 2e6);
    }
    const lines: string[] = [];
    for (const [cls, xs] of Object.entries(classes)) {
      const ws = fresh();
      const wc = fresh();
      for (const x of xs) {
        const X = fromNumber(x);
        track(ws, Math.sin(x), sin(X), String(x));
        track(wc, Math.cos(x), cos(X), String(x));
      }
      lines.push(report(`sin ${cls}`, ws), report(`cos ${cls}`, wc));
      expect(ws.relU, cls).toBeLessThanOrEqual(C_F);
      expect(wc.relU, cls).toBeLessThanOrEqual(C_F);
    }
    console.log(lines.join('\n'));
  });

  it('atan2 (all quadrants, wide magnitude ratios) and acos (incl. near ±1)', () => {
    const r = rng(32);
    const wa = fresh();
    for (let i = 0; i < 1000; i++) {
      const y = (r() - 0.5) * 10 ** (12 * r() - 6);
      const x = (r() - 0.5) * 10 ** (12 * r() - 6);
      track(
        wa,
        Math.atan2(y, x),
        atan2(fromNumber(y), fromNumber(x)),
        `${String(y)}, ${String(x)}`,
      );
    }
    const wq = fresh();
    for (let i = 0; i < 700; i++) {
      const x =
        i % 2 === 1
          ? r() * 2 - 1
          : r() < 0.5
            ? 1 - 2 ** -53 * Math.floor(r() * 1e6)
            : -1 + 2 ** -53 * Math.floor(r() * 1e6);
      track(wq, Math.acos(x), acos(fromNumber(x)), String(x));
    }
    console.log([report('atan2', wa), report('acos', wq)].join('\n'));
    expect(wa.relU).toBeLessThanOrEqual(C_F);
    expect(wq.relU).toBeLessThanOrEqual(C_F);
  });

  it('sinh and cosh (hyperbolic Stumpff branch)', () => {
    const r = rng(33);
    const wh = fresh();
    const wc = fresh();
    for (let i = 0; i < 500; i++) {
      const x = i % 2 === 1 ? (r() - 0.5) * 100 : (r() - 0.5) * 10 ** (-10 * r());
      const X = fromNumber(x);
      track(wh, Math.sinh(x), sinh(X), String(x));
      track(wc, Math.cosh(x), cosh(X), String(x));
    }
    console.log([report('sinh', wh), report('cosh', wc)].join('\n'));
    expect(wh.relU).toBeLessThanOrEqual(C_F);
    expect(wc.relU).toBeLessThanOrEqual(C_F);
  });

  it('sqrt is correctly rounded on the sample (A2)', () => {
    const r = rng(34);
    let mismatches = 0;
    for (let i = 0; i < 1000; i++) {
      const x = 10 ** (40 * r() - 20) * (1 + r());
      if (toNumber(sqrt(fromNumber(x))) !== Math.sqrt(x)) mismatches += 1;
    }
    expect(mismatches).toBe(0);
  });
});
