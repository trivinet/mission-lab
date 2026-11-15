/**
 * Validation of the extended O-1 reference on hyperbolic arcs (tolerance record revision 5, §6.8;
 * ML-TASK-018 part D3), before any engine run on it. No engine involved.
 *
 * 1. The closed form of ∂F/∂α on a hyperbola (revision 5 §6.8) equals a 320-bit central finite
 *    difference of F(χ; α) at fixed χ, σ₀, r₀; and |∂F/∂α| ≤ |a|^(5/2) D(X) (the magnitude bound
 *    used in δt_α,hyp).
 * 2. At the correctly rounded root χ* (from the independent 200-bit hyperbolic-anomaly propagation,
 *    ref/hyperbolic.ts: χ* = √|a|(F − F₀)), the 320-bit residual |t(χ*) − Δt| is within the
 *    representation spacing (r/√μ)·u·|χ*| (so the evaluator itself adds no error at that level),
 *    and therefore within the threshold of the committed dataset.
 * 3. Detection power: χ* (1 + 1e-9) fails the threshold on every sample.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hypPrepare, hypPropagate } from '../ref/hyperbolic';
import { U } from '../tol/tolerances';
import { prepareHyperbolicArc } from '../tol/tolerances-r4';
import { dAlphaMagnitude } from '../tol/tolerances-r5';
import {
  add,
  div,
  fromInt,
  fromNumber,
  ldexp,
  mul,
  sqrt,
  sub,
  toNumber,
  cosh,
  sinh,
  abs,
  type BigFloat,
} from './bigfloat';
import { stumpff } from './o1-check';
import { o1HypResidual } from './o1-check-hyp';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIR = join(ROOT, 'test-data', 'reference-cases', 'o1-hyp-r5');
const MU = 3.986004418e14;

interface HypCase {
  readonly label: string;
  readonly startState: {
    readonly position_m: [number, number, number];
    readonly velocity_mps: [number, number, number];
  };
  readonly dt_s: number[];
  readonly x: number[];
  readonly threshold_s: number[];
}

const cases: HypCase[] = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .flatMap((n) => (JSON.parse(readFileSync(join(DIR, n), 'utf8')) as { cases: HypCase[] }).cases);

const P = 320;

/** F(χ; α) = σ₀χ²C(αχ²) + (1 − αr₀)χ³S(αχ²) + r₀χ in 320-bit. */
function F(alpha: BigFloat, chi: BigFloat, sigma0: BigFloat, r0: BigFloat): BigFloat {
  const x2 = mul(chi, chi, P);
  const { C, S } = stumpff(mul(alpha, x2, P), P);
  const t1 = mul(mul(sigma0, x2, P), C, P);
  const t2 = mul(mul(sub(fromInt(1), mul(alpha, r0, P), P), mul(x2, chi, P), P), S, P);
  return add(add(t1, t2, P), mul(r0, chi, P), P);
}

describe('O-1 hyperbolic reference (revision 5): dataset coverage', () => {
  it('covers the six VT-16 hyperbolic arcs and the 144-case grid', () => {
    expect(cases.length).toBe(6 + 144);
    for (const c of cases) {
      expect(c.dt_s.every((d) => d > 0)).toBe(true);
      expect(c.threshold_s.length).toBe(c.dt_s.length);
    }
  });
});

describe('∂F/∂α on a hyperbola: closed form vs 320-bit finite difference', () => {
  const picks = cases.filter((c) => c.label.startsWith('l2-') || c.label.startsWith('l3-'));
  it.each(picks)('$label', (c) => {
    const { position_m: r, velocity_mps: v } = c.startState;
    const dtEnd = c.dt_s[c.dt_s.length - 1] ?? NaN;
    const arc = prepareHyperbolicArc(MU, r, v, dtEnd);
    const rB = r.map(fromNumber);
    const vB = v.map(fromNumber);
    const dot = (a: BigFloat[], b: BigFloat[]): BigFloat =>
      add(
        add(
          mul(a[0] ?? fromInt(0), b[0] ?? fromInt(0), P),
          mul(a[1] ?? fromInt(0), b[1] ?? fromInt(0), P),
          P,
        ),
        mul(a[2] ?? fromInt(0), b[2] ?? fromInt(0), P),
        P,
      );
    const muB = fromNumber(MU);
    const r0 = sqrt(dot(rB, rB), P);
    const sigma0 = div(dot(rB, vB), sqrt(muB, P), P);
    const alpha = sub(div(fromInt(2), r0, P), div(dot(vB, vB), muB, P), P);
    const aAbs = div(fromInt(-1), alpha, P);
    for (const k of [0, Math.floor(c.dt_s.length / 2), c.dt_s.length - 1]) {
      const x = c.x[k] ?? NaN;
      const chi = mul(sqrt(aAbs, P), fromNumber(x), P);
      const h = ldexp(abs(alpha), -100);
      const fd = div(
        sub(F(add(alpha, h, P), chi, sigma0, r0), F(sub(alpha, h, P), chi, sigma0, r0), P),
        mul(fromInt(2), h, P),
        P,
      );
      // Closed form (revision 5 §6.8):
      // |a|^(5/2){e sinh F₀[(cosh x − 1) − x sinh x/2] + (sinh x − x) + (e cosh F₀/2)[(sinh x − x) − x(cosh x − 1)]}
      const xb = fromNumber(x);
      const ch = cosh(xb, P);
      const sh = sinh(xb, P);
      const one = fromInt(1);
      const e = arc.e;
      const G =
        e * arc.sinhF0 * (toNumber(sub(ch, one, P)) - (x * toNumber(sh)) / 2) +
        toNumber(sub(sh, xb, P)) +
        ((e * arc.coshF0) / 2) * (toNumber(sub(sh, xb, P)) - x * toNumber(sub(ch, one, P)));
      const scale = Math.pow(toNumber(aAbs), 2.5);
      const closed = scale * G;
      const fdN = toNumber(fd);
      expect(Math.abs(fdN - closed) / Math.abs(fdN), `${c.label} k=${String(k)}`).toBeLessThan(
        1e-12,
      );
      expect(Math.abs(fdN), `${c.label} k=${String(k)} magnitude bound`).toBeLessThanOrEqual(
        scale * dAlphaMagnitude(arc, x),
      );
    }
  });
});

describe('residual at the correctly rounded root is within spacing; perturbed root fails', () => {
  it.each(cases)(
    '$label',
    (c) => {
      const { position_m: r, velocity_mps: v } = c.startState;
      const hp = hypPrepare(r, v, MU);
      const sqrtA = sqrt(hp.aAbs, 200);
      const inp = { mu_m3ps2: MU, position_m: r, velocity_mps: v };
      c.dt_s.forEach((dt, k) => {
        const s = hypPropagate(hp, dt);
        const chiStar = toNumber(mul(sqrtA, sub(s.F, hp.F0, 200), 200));
        const res = o1HypResidual(inp, dt, chiStar);
        const spacing = (toNumber(s.r) / Math.sqrt(MU)) * U * Math.abs(chiStar);
        const thr = c.threshold_s[k] ?? NaN;
        expect(res, `${c.label} k=${String(k)} spacing`).toBeLessThanOrEqual(
          spacing * 1.001 + 1e-30,
        );
        expect(res, `${c.label} k=${String(k)} threshold`).toBeLessThanOrEqual(thr);
        const resBad = o1HypResidual(inp, dt, chiStar * (1 + 1e-9));
        expect(resBad, `${c.label} k=${String(k)} detection`).toBeGreaterThan(thr);
      });
    },
    120_000,
  );
});
