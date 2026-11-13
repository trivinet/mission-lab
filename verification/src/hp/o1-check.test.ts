/**
 * Tests of the O-1 high-precision evaluator on cases where the exact χ is known by construction.
 * The engine is not run (ML-TASK-011 scope).
 */
import { describe, expect, it } from 'vitest';
import { GRID } from '../datasets/cases';
import { elementsToState } from '../ref/elements';
import { o1Threshold, scales } from '../tol/tolerances';
import {
  abs,
  add,
  div,
  fromInt,
  fromNumber,
  ilog2,
  mul,
  sincos,
  sqrt,
  sub,
  toNumber,
  type BigFloat,
} from './bigfloat';
import { hpPrepare } from './hp-kepler';
import { o1Check, stumpff, timeOfChi } from './o1-check';

const MU = 3.986004418e14;

function relBelow(x: BigFloat, ref: BigFloat, k: number): boolean {
  const d = sub(x, ref);
  return d.m === 0n || ilog2(abs(d)) - ilog2(abs(ref)) < k;
}

describe('Stumpff functions', () => {
  it('series and closed forms agree across |ψ| = 1', () => {
    for (const psi of [0.999999, 1.000001, -0.999999, -1.000001]) {
      // Evaluate at ψ and compare with the other branch's value at the same ψ by continuity:
      // C and S are smooth, so values at ψ and at ψ(1 ± 2e-6) differ by O(1e-6) only. A wrong
      // branch formula would differ by O(1).
      const a = stumpff(fromNumber(psi));
      const b = stumpff(fromNumber(psi > 0 ? 1 : -1));
      expect(Math.abs(toNumber(sub(a.C, b.C)))).toBeLessThan(1e-6);
      expect(Math.abs(toNumber(sub(a.S, b.S)))).toBeLessThan(1e-6);
    }
    const z = stumpff(fromInt(0));
    expect(toNumber(z.C)).toBe(0.5);
    expect(toNumber(z.S)).toBe(1 / 6);
  });
});

describe('O-1 evaluator: time equation in high precision', () => {
  it('reproduces t(χ) = χ for the unit circular orbit (μ = 1, r₀ = 1, v₀ = 1, α r₀ = 1, σ₀ = 0)', () => {
    const inp = { mu_m3ps2: 1, position_m: [1, 0, 0], velocity_mps: [0, 1, 0] } as const;
    for (const chi of [0, 1e-9, 0.5, 3, 40.25, 1000.125]) {
      expect(toNumber(timeOfChi(inp, chi))).toBe(chi);
      expect(o1Check(inp, chi, chi).residual_s).toBe(0);
    }
    // A Δt one ulp away gives a residual of exactly one ulp.
    const chi = 40.25;
    const dt = chi + 2 ** -47; // ulp(40.25) = 2^-47
    expect(o1Check(inp, dt, chi).residual_s).toBe(2 ** -47);
  });

  it('agrees with the Kepler time of flight for an exact elliptic periapsis state', () => {
    // μ = 1, r₀ = (1, 0, 0), v₀ = (0, 1.25, 0): α = 2 − 1.5625 = 0.4375 = 7/16 exactly,
    // a = 16/7, e = 1 − r_p/a = 9/16, σ₀ = 0, E₀ = 0. By Kepler, √μ t = a^(3/2)(x − e sin x)
    // with x = ΔE = χ/√a.
    const inp = { mu_m3ps2: 1, position_m: [1, 0, 0], velocity_mps: [0, 1.25, 0] } as const;
    const a = div(fromInt(16), fromInt(7));
    const e = div(fromInt(9), fromInt(16));
    const sqrtA = sqrt(a);
    for (const chi of [1e-6, 0.3, 2, 7.5, 31, 300]) {
      const x = div(fromNumber(chi), sqrtA);
      const kepler = mul(mul(a, sqrtA), sub(x, mul(e, sincos(x).sin)));
      expect(relBelow(timeOfChi(inp, chi), kepler, -300)).toBe(true);
    }
  });

  it('agrees with the Kepler time of flight on the grid states (general E₀ ≠ 0)', () => {
    // For χ̂ binary64, x = χ̂/√a, the exact flight time is a^(3/2)[x − e sin(E₀ + x) + e sin E₀]/√μ
    // (Kepler's equation), with a, e, E₀ of the exact input formed in 200-bit arithmetic.
    for (const g of GRID) {
      const s0 = elementsToState(g.elements, MU);
      const inp = { mu_m3ps2: MU, position_m: s0.position_m, velocity_mps: s0.velocity_mps };
      const hp = hpPrepare(s0.position_m, s0.velocity_mps, MU, 300);
      // E₀ from M₀ = E₀ − e sin E₀ is not stored; recompute E₀ by solving with the HP solver
      // is unnecessary: n Δt = ΔM = M(E₀ + x) − M₀ with M(E) = E − e sin E.
      const sqrtA = sqrt(hp.a, 300);
      for (const dE of [0.25, 3.7, 25.1, 62.9]) {
        const chi = toNumber(mul(sqrtA, fromNumber(dE), 300));
        const x = div(fromNumber(chi), sqrtA, 300);
        // E₀: solve M₀ = E₀ − e sin E₀ in high precision.
        const E0 = keplerE(hp.M0, hp.e);
        const E1 = add(E0, x, 300);
        const dM = sub(sub(E1, mul(hp.e, sincos(E1, 300).sin, 300), 300), hp.M0, 300);
        const tK = div(dM, hp.n, 300);
        expect(relBelow(timeOfChi(inp, chi), tK, -150), g.id).toBe(true);
      }
    }
    function keplerE(M: BigFloat, e: BigFloat): BigFloat {
      let E = M;
      for (let i = 0; i < 100; i++) {
        const { sin: s, cos: c } = sincos(E, 300);
        const step = div(
          sub(sub(E, mul(e, s, 300), 300), M, 300),
          sub(fromInt(1), mul(e, c, 300), 300),
          300,
        );
        E = sub(E, step, 300);
        if (step.m === 0n || ilog2(abs(step)) < -290) break;
      }
      return E;
    }
  });

  it('measures the residual of a perturbed χ̂ as k ulp × dt/dχ', () => {
    // dt/dχ = r/√μ, with r the radius at χ; for the unit circular orbit r = 1, so a χ̂ off by
    // k ulps has residual k ulps of χ exactly.
    const inp = { mu_m3ps2: 1, position_m: [1, 0, 0], velocity_mps: [0, 1, 0] } as const;
    const chi = 3;
    const ulp = 2 ** -51; // ulp(3)
    for (const k of [1, 5, 100]) {
      expect(o1Check(inp, chi, chi + k * ulp).residual_s).toBe(k * ulp);
    }
  });

  it('accepts the exact root and rejects a χ̂ far outside the budget (grid, Δt = 10T)', () => {
    for (const g of GRID) {
      const s0 = elementsToState(g.elements, MU);
      const inp = { mu_m3ps2: MU, position_m: s0.position_m, velocity_mps: s0.velocity_mps };
      const sc = scales(MU, g.elements.semiMajorAxis_m, g.elements.eccentricity);
      // Build Δt from a chosen χ̂ (exact t(χ̂) rounded once to binary64): residual ≤ ½ ulp(Δt).
      const hp = hpPrepare(s0.position_m, s0.velocity_mps, MU);
      const chi = toNumber(mul(sqrt(hp.a), fromNumber(20 * Math.PI)));
      const dt = toNumber(timeOfChi(inp, chi));
      const ok = o1Check(inp, dt, chi);
      const halfUlp = 2 ** (Math.floor(Math.log2(dt)) - 53);
      expect(ok.residual_s, g.id).toBeLessThanOrEqual(halfUlp);
      expect(ok.pass).toBe(true);
      // Threshold uses the exact input's a, e (reference side) and κ = 4a/r₀ − 1 ≤ κ_E.
      expect(ok.kappa).toBeLessThanOrEqual(sc.kappaE * (1 + 1e-9));
      expect(Math.abs(ok.a_m / sc.a - 1)).toBeLessThan(1e-12);
      expect(ok.threshold_s).toBeLessThanOrEqual(o1Threshold(sc, dt) * (1 + 1e-9));
      // A χ̂ shifted by 1e-9 relative is a gross solver error: rejected.
      const bad = o1Check(inp, dt, chi * (1 + 1e-9));
      expect(bad.pass).toBe(false);
    }
  });
});
