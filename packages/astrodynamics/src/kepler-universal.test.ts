/**
 * Unit tests of the universal-variable propagator: self-consistency (L1) by the implementer.
 * These are NOT the VT-05…VT-09 reference comparisons (Verification Engineer, ADR-003).
 *
 * All bounds are PROVISIONAL implementer derivations, to be replaced by the approved tolerance
 * record. u = 2^-53. Two kinds of error are bounded separately:
 *
 * (a) Off-orbit (bounded) rounding of the coefficients and of r = f r0 + g v0, v = ḟ r0 + ġ v0.
 *     A posteriori form: with the term magnitudes of the coefficients at the returned χ
 *       Tf = 1 + |χ²C|/r0, Tg = (|σ0 χ² C| + |r0 χ c1|)/√μ, Tḟ = √μ|χ c1|/(r r0), Tġ = 1 + |χ²C|/r,
 *     δr ≤ KB u (Tf r0 + Tg v0) and δv ≤ KB u (Tḟ r0 + Tġ v0), KB = 32: each coefficient takes
 *     ≤ 12 rounded operations including a Stumpff value (≤ 7u, stumpff.ts), the combination 2
 *     more, ≤ 16 in all; factor 2 margin. The solver residual and the rounding of the Stumpff
 *     argument move the point ALONG the orbit (kepler-universal.ts) and are not in (a).
 * (b) Along-track (phase) error, growing with |Δt|: δt ≤ CT u |Δt| per propagation leg, with
 *     CT = 6 (4/(1 − e) − 1) + 16 for ellipses: the data error of α = 2/r − v²/μ is
 *     ≤ 4u (2/r0 + v0²/μ) = 4u (4a/r0 − 1)/a ≤ 4u (4/(1 − e) − 1) relative, and δn/n = 1.5 δα/α
 *     (6 = 1.5 × 4); 16 covers the solver residual (measured ≤ 7u|Δt|, see the task report),
 *     the argument rounding √(αχ²) (1.5u) and the test's own formation of Δt or T (≤ 6u).
 *     Position error ≤ v_max δt, velocity error ≤ g_max δt (g_max = μ/r_p²).
 */
import { describe, expect, test } from 'vitest';
import { EARTH_GM_m3ps2 } from './constants';
import {
  KEPLER_MAX_ITERATIONS,
  propagateKeplerUniversal,
  propagateKeplerUniversalAt,
} from './kepler-universal';
import type { KeplerPropagationResult } from './kepler-universal';
import { stumpff } from './stumpff';
import { crossVec3, dotVec3, normVec3, subVec3 } from './vector3';
import type { Vec3 } from './vector3';

const u = 2 ** -53;
const MU = EARTH_GM_m3ps2;
const KB = 32;

type Success = Extract<KeplerPropagationResult, { ok: true }>;

function expectOk(result: KeplerPropagationResult): Success {
  if (!result.ok) {
    throw new Error(`propagation failed: ${result.reason}`);
  }
  return result;
}

/**
 * Test-input constructor (not a reference): state at true anomaly nu of a conic with
 * semi-latus rectum p = a(1 − e²) (a < 0 for e > 1), perifocal r = p/(1 + e cos nu) and
 * v = √(μ/p) (−sin nu, e + cos nu), rotated by R3(Ω) R1(i) R3(ω).
 */
function stateFromConic(
  a_m: number,
  e: number,
  i_rad: number,
  raan_rad: number,
  argp_rad: number,
  nu_rad: number,
): { r: Vec3; v: Vec3 } {
  const p = a_m * (1 - e * e);
  const r = p / (1 + e * Math.cos(nu_rad));
  const k = Math.sqrt(MU / p);
  const px = r * Math.cos(nu_rad);
  const py = r * Math.sin(nu_rad);
  const vx = -k * Math.sin(nu_rad);
  const vy = k * (e + Math.cos(nu_rad));
  const cO = Math.cos(raan_rad);
  const sO = Math.sin(raan_rad);
  const cw = Math.cos(argp_rad);
  const sw = Math.sin(argp_rad);
  const ci = Math.cos(i_rad);
  const si = Math.sin(i_rad);
  const m00 = cO * cw - sO * sw * ci;
  const m01 = -cO * sw - sO * cw * ci;
  const m10 = sO * cw + cO * sw * ci;
  const m11 = -sO * sw + cO * cw * ci;
  const m20 = sw * si;
  const m21 = cw * si;
  return {
    r: [m00 * px + m01 * py, m10 * px + m11 * py, m20 * px + m21 * py],
    v: [m00 * vx + m01 * vy, m10 * vx + m11 * vy, m20 * vx + m21 * vy],
  };
}

interface ClosedCase {
  readonly name: string;
  readonly a_m: number;
  readonly e: number;
  readonly i_rad: number;
  readonly nu_rad: number;
}

/** Orbit shapes after verification plan §5 (values chosen here for self-consistency only). */
const CLOSED_CASES: readonly ClosedCase[] = [
  { name: 'circular low, inclined', a_m: 7.0e6, e: 0, i_rad: 0.9, nu_rad: 0.3 },
  { name: 'circular equatorial', a_m: 7.0e6, e: 0, i_rad: 0, nu_rad: 0 },
  { name: 'elliptical equatorial', a_m: 8.0e6, e: 0.1, i_rad: 0, nu_rad: 2.0 },
  { name: 'moderately elliptical, inclined', a_m: 1.0e7, e: 0.3, i_rad: 1.0, nu_rad: 2.5 },
  { name: 'Molniya-like at perigee', a_m: 2.66e7, e: 0.74, i_rad: 1.1, nu_rad: 0 },
  { name: 'Molniya-like at apogee', a_m: 2.66e7, e: 0.74, i_rad: 1.1, nu_rad: Math.PI },
  { name: 'geostationary radius', a_m: 4.2164e7, e: 0, i_rad: 0.001, nu_rad: 1.0 },
  { name: 'retrograde, near-polar', a_m: 7.2e6, e: 0.01, i_rad: 1.745, nu_rad: 4.0 },
];

/** Span multipliers of the period (fractions, many periods, negative). */
const SPANS = [0.1, 0.5, 1, 3.7, 10, -2.3, -10];

function closedScales(c: ClosedCase) {
  const rp = c.a_m * (1 - c.e);
  const vp = Math.sqrt((MU * (1 + c.e)) / rp);
  const period = 2 * Math.PI * Math.sqrt((c.a_m * c.a_m * c.a_m) / MU);
  const ct = 6 * (4 / (1 - c.e) - 1) + 16;
  return { rp, vp, gp: MU / (rp * rp), period, ct };
}

/** Off-orbit rounding scales (a) at the returned χ (see file comment). */
function offOrbitBounds(r0v: Vec3, v0v: Vec3, res: Success): { dr: number; dv: number } {
  const te = res.diagnostics.timeEquation;
  const chi = res.diagnostics.universalAnomaly_sqrtm;
  if (te === null || chi === null) {
    return { dr: 0, dv: 0 };
  }
  const r0 = normVec3(r0v);
  const v0 = normVec3(v0v);
  const c = stumpff(te.alpha_per_m * chi * chi);
  const chi2C = Math.abs(chi * chi * c.c2);
  const chiC1 = Math.abs(chi * c.c1);
  const r = normVec3(res.position_m);
  const tf = 1 + chi2C / r0;
  const tg = (Math.abs(te.sigma0_sqrtm) * chi2C + r0 * chiC1) / te.sqrtMu_m1p5ps;
  const tfd = (te.sqrtMu_m1p5ps * chiC1) / (r * r0);
  const tgd = 1 + chi2C / r;
  return { dr: KB * u * (tf * r0 + tg * v0), dv: KB * u * (tfd * r0 + tgd * v0) };
}

function energy(r: Vec3, v: Vec3): number {
  return dotVec3(v, v) / 2 - MU / normVec3(r);
}

describe('Δt = 0', () => {
  test('returns a bit-identical copy of the input, including signed zeros', () => {
    const r0: Vec3 = [7.0e6, -0, 1.5e-300];
    const v0: Vec3 = [0, 7546.05, -0];
    for (const dt of [0, -0]) {
      const res = expectOk(propagateKeplerUniversal(MU, r0, v0, dt));
      for (let k = 0; k < 3; k += 1) {
        expect(Object.is(res.position_m[k], r0[k])).toBe(true);
        expect(Object.is(res.velocity_mps[k], v0[k])).toBe(true);
      }
      expect(res.position_m).not.toBe(r0);
      expect(res.diagnostics.iterations).toBe(0);
      expect(res.diagnostics.timeResidual_s).toBe(0);
      expect(res.lagrange).toEqual({ f: 1, g_s: 0, fDot_per_s: 0, gDot: 1 });
    }
  });
});

describe('invariants on the closed-orbit grid', () => {
  for (const c of CLOSED_CASES) {
    test(`${c.name}: f ġ − ḟ g = 1, energy and angular momentum conserved`, () => {
      const { r, v } = stateFromConic(c.a_m, c.e, c.i_rad, 0.7, 1.3, c.nu_rad);
      const { period } = closedScales(c);
      const r0 = normVec3(r);
      const v0 = normVec3(v);
      const e0 = energy(r, v);
      const h0 = crossVec3(r, v);
      for (const k of SPANS) {
        const res = expectOk(propagateKeplerUniversal(MU, r, v, k * period));
        const { f, g_s: g, fDot_per_s: fd, gDot: gd } = res.lagrange;
        const { dr, dv } = offOrbitBounds(r, v, res);
        // f ġ − ḟ g, first order: the coefficient errors are those of (a) divided back by r0, v0
        // (δf ≤ dr/r0, δg ≤ dr/v0, δḟ ≤ dv/r0, δġ ≤ dv/v0), so
        // |δ(fġ − ḟg)| ≤ (dr/(r0 v0)) (|ġ| v0 + |ḟ| r0) + (dv/(r0 v0)) (|f| r0 + |g| v0),
        // plus 4u (|fġ| + |ḟg|) for the two products and the subtractions in the test.
        const rr = normVec3(res.position_m);
        const vv = normVec3(res.velocity_mps);
        const wronskBound =
          (dr / (r0 * v0)) * (Math.abs(gd) * v0 + Math.abs(fd) * r0) +
          (dv / (r0 * v0)) * (Math.abs(f) * r0 + Math.abs(g) * v0) +
          4 * u * (Math.abs(f * gd) + Math.abs(fd * g));
        expect(Math.abs(f * gd - fd * g - 1)).toBeLessThanOrEqual(wronskBound);
        // Energy: |Δε| ≤ v δv + (μ/r²) δr + evaluation (8u per energy) + data α (2u(2μ/r0 + v0²)).
        const e1 = energy(res.position_m, res.velocity_mps);
        const energyBound =
          vv * dv +
          (MU / (rr * rr)) * dr +
          8 * u * ((vv * vv) / 2 + MU / rr) +
          8 * u * ((v0 * v0) / 2 + MU / r0) +
          2 * u * ((2 * MU) / r0 + v0 * v0);
        expect(Math.abs(e1 - e0)).toBeLessThanOrEqual(energyBound);
        // Angular momentum vector: |Δh| ≤ δr v + r δv + cross-product rounding 4u (r v + r0 v0).
        const h1 = crossVec3(res.position_m, res.velocity_mps);
        const hBound = dr * vv + rr * dv + 4 * u * (rr * vv + r0 * v0);
        expect(normVec3(subVec3(h1, h0))).toBeLessThanOrEqual(hBound);
        // Diagnostics: converged within the cap at the noise floor.
        expect(res.diagnostics.iterationCapReached).toBe(false);
        expect(res.diagnostics.iterations).toBeLessThanOrEqual(KEPLER_MAX_ITERATIONS);
        const resid = res.diagnostics.timeResidual_s;
        const noise = res.diagnostics.timeResidualNoise_s;
        expect(resid !== null && noise !== null && Math.abs(resid) <= noise).toBe(true);
      }
    });
  }
});

describe('time symmetry, additivity and period closure (closed orbits)', () => {
  for (const c of CLOSED_CASES) {
    test(`${c.name}: forward-backward, additivity, 1 and 10 periods`, () => {
      const { r, v } = stateFromConic(c.a_m, c.e, c.i_rad, 0.7, 1.3, c.nu_rad);
      const { vp, gp, period, ct } = closedScales(c);
      const ra = c.a_m * (1 + c.e);
      const kappa = (1 + c.e) / (1 - c.e);
      // Off-orbit part per leg, a priori: KB u κ r_a (position), KB u κ v_p (velocity).
      const legR = KB * u * kappa * ra;
      const legV = KB * u * kappa * vp;

      // Forward then backward: two legs, phase error 2 CT u |Δt|.
      for (const k of [0.37, 3.7, 10]) {
        const dt = k * period;
        const fwd = expectOk(propagateKeplerUniversal(MU, r, v, dt));
        const back = expectOk(propagateKeplerUniversal(MU, fwd.position_m, fwd.velocity_mps, -dt));
        const phase = 2 * ct * u * Math.abs(dt);
        expect(normVec3(subVec3(back.position_m, r))).toBeLessThanOrEqual(2 * legR + vp * phase);
        expect(normVec3(subVec3(back.velocity_mps, v))).toBeLessThanOrEqual(2 * legV + gp * phase);
      }

      // Additivity: Δt1 then Δt2 versus Δt1 + Δt2 (three legs in total).
      for (const [k1, k2] of [
        [0.3, 0.45],
        [2.2, -0.9],
        [4.1, 5.9],
      ] as const) {
        const dt1 = k1 * period;
        const dt2 = k2 * period;
        const leg1 = expectOk(propagateKeplerUniversal(MU, r, v, dt1));
        const leg2 = expectOk(
          propagateKeplerUniversal(MU, leg1.position_m, leg1.velocity_mps, dt2),
        );
        const direct = expectOk(propagateKeplerUniversal(MU, r, v, dt1 + dt2));
        const phase = ct * u * (Math.abs(dt1) + Math.abs(dt2) + Math.abs(dt1 + dt2));
        expect(normVec3(subVec3(leg2.position_m, direct.position_m))).toBeLessThanOrEqual(
          3 * legR + vp * phase,
        );
        expect(normVec3(subVec3(leg2.velocity_mps, direct.velocity_mps))).toBeLessThanOrEqual(
          3 * legV + gp * phase,
        );
      }

      // Period closure: T = 2π √(a³/μ) from the construction's a; one and ten periods.
      for (const nPeriods of [1, 10]) {
        const res = expectOk(propagateKeplerUniversal(MU, r, v, nPeriods * period));
        const phase = ct * u * Math.abs(nPeriods * period);
        expect(normVec3(subVec3(res.position_m, r))).toBeLessThanOrEqual(legR + vp * phase);
        expect(normVec3(subVec3(res.velocity_mps, v))).toBeLessThanOrEqual(legV + gp * phase);
      }
    });
  }
});

describe('circular orbit closed form (exactly constructed data)', () => {
  // μ = R³ n² with n = 1 rad/s and R, V = R n powers of two: α = 2/R − V²/μ = 1/R, σ0 = 0 and
  // 1 − α r0 = 0 are exact, the time equation reduces to R χ = √μ Δt (exact root), ψ = Δt².
  // Expected r = R (cos Δt, sin Δt, 0), v = V (−sin Δt, cos Δt, 0).
  // Error: angle formation √(Δt²) (≤ 1.5u |Δt|, phase), cos/sin and the reference's own
  // cos/sin (≤ 4u), coefficient and combination roundings (≤ 12u): bound R u (16 + 2|Δt|).
  for (const R of [1, 2 ** 20, 2 ** 22]) {
    test(`R = ${String(R)}`, () => {
      const mu = R * R * R;
      const r0: Vec3 = [R, 0, 0];
      const v0: Vec3 = [0, R, 0];
      for (const dt of [0.5, 1, 1.5707963267948966, 3, 10, 62.83185307179586, -3, -100]) {
        const res = expectOk(propagateKeplerUniversal(mu, r0, v0, dt));
        const expR: Vec3 = [R * Math.cos(dt), R * Math.sin(dt), 0];
        const expV: Vec3 = [-R * Math.sin(dt), R * Math.cos(dt), 0];
        const bound = R * u * (16 + 2 * Math.abs(dt));
        expect(normVec3(subVec3(res.position_m, expR))).toBeLessThanOrEqual(bound);
        expect(normVec3(subVec3(res.velocity_mps, expV))).toBeLessThanOrEqual(bound);
        expect(res.diagnostics.timeResidual_s).toBe(0);
      }
    });
  }
});

describe('Kepler equation constructed in reverse (no solve in the test)', () => {
  // Start at periapsis in the perifocal frame. Ellipse: choose E, Δt = (E − e sin E)/n,
  // r = a (cos E − e, √(1−e²) sin E, 0), v = n a/(1 − e cos E) (−sin E, √(1−e²) cos E, 0)
  // (definition of the eccentric anomaly and dE/dt = n/(1 − e cos E)).
  // Hyperbola (|a| = −a): choose F, Δt = (e sinh F − F)/n, n = √(μ/|a|³),
  // r = |a| (e − cosh F, √(e²−1) sinh F, 0), v = n|a|/(e cosh F − 1) (−sinh F, √(e²−1) cosh F, 0).
  // Bounds: off-orbit KB u κ r_max and KB u κ v_p, phase CT u |Δt| times v_p and g_p.
  const a = 2 ** 23;
  for (const e of [0.25, 0.75]) {
    test(`ellipse e = ${String(e)}`, () => {
      const rp = a * (1 - e);
      const vp = Math.sqrt((MU * (1 + e)) / rp);
      const n = Math.sqrt(MU / (a * a * a));
      const b = Math.sqrt(1 - e * e);
      const kappa = (1 + e) / (1 - e);
      const ct = 6 * (4 / (1 - e) - 1) + 16;
      for (const E of [0.3, 2, Math.PI - 0.1, 6 * Math.PI + 1, -4]) {
        const dt = (E - e * Math.sin(E)) / n;
        const res = expectOk(propagateKeplerUniversal(MU, [rp, 0, 0], [0, vp, 0], dt));
        const expR: Vec3 = [a * (Math.cos(E) - e), a * b * Math.sin(E), 0];
        const k = (n * a) / (1 - e * Math.cos(E));
        const expV: Vec3 = [-k * Math.sin(E), k * b * Math.cos(E), 0];
        const phase = ct * u * Math.abs(dt);
        const posBound = KB * u * kappa * a * (1 + e) + vp * phase;
        const velBound = KB * u * kappa * vp + (MU / (rp * rp)) * phase;
        expect(normVec3(subVec3(res.position_m, expR))).toBeLessThanOrEqual(posBound);
        expect(normVec3(subVec3(res.velocity_mps, expV))).toBeLessThanOrEqual(velBound);
      }
    });
  }
  for (const e of [1.5, 3]) {
    test(`hyperbola e = ${String(e)}`, () => {
      const rp = a * (e - 1);
      const vp = Math.sqrt((MU * (e + 1)) / rp);
      const n = Math.sqrt(MU / (a * a * a));
      const b = Math.sqrt(e * e - 1);
      const kappa = (e + 1) / (e - 1);
      // α data error: 4u (2/r0 + v0²/μ) relative to |α| = 1/|a|: 4u (e + 3)/(e − 1).
      const ct = 6 * ((e + 3) / (e - 1)) + 16;
      for (const F of [0.2, 1, 3, 8, -2.5]) {
        const dt = (e * Math.sinh(F) - F) / n;
        const res = expectOk(propagateKeplerUniversal(MU, [rp, 0, 0], [0, vp, 0], dt));
        const expR: Vec3 = [a * (e - Math.cosh(F)), a * b * Math.sinh(F), 0];
        const k = (n * a) / (e * Math.cosh(F) - 1);
        const expV: Vec3 = [-k * Math.sinh(F), k * b * Math.cosh(F), 0];
        const rmax = normVec3(expR);
        const phase = ct * u * Math.abs(dt);
        const posBound = KB * u * kappa * rmax + vp * phase;
        const velBound = KB * u * kappa * vp + (MU / (rp * rp)) * phase;
        expect(normVec3(subVec3(res.position_m, expR))).toBeLessThanOrEqual(posBound);
        expect(normVec3(subVec3(res.velocity_mps, expV))).toBeLessThanOrEqual(velBound);
        expect(res.diagnostics.iterationCapReached).toBe(false);
      }
    });
  }
});

describe('open and near-parabolic trajectories (smoke)', () => {
  const rp = 7.0e6;
  for (const e of [1 - 1e-6, 1 - 1e-10, 1 + 1e-10, 1 + 1e-6, 1.5]) {
    test(`e = ${String(e)} from periapsis: converges, invariants hold, r increases`, () => {
      const vp = Math.sqrt((MU * (1 + e)) / rp);
      const r: Vec3 = [rp, 0, 0];
      const v: Vec3 = [0, vp, 0];
      const e0 = energy(r, v);
      const h0 = crossVec3(r, v);
      let lastR = rp;
      for (const dt of [600, 6000, 60000, 600000]) {
        const res = expectOk(propagateKeplerUniversal(MU, r, v, dt));
        const { dr, dv } = offOrbitBounds(r, v, res);
        const rr = normVec3(res.position_m);
        const vv = normVec3(res.velocity_mps);
        expect(rr).toBeGreaterThan(lastR);
        lastR = rr;
        const energyBound =
          vv * dv +
          (MU / (rr * rr)) * dr +
          8 * u * ((vv * vv) / 2 + MU / rr) +
          8 * u * ((vp * vp) / 2 + MU / rp) +
          2 * u * ((2 * MU) / rp + vp * vp);
        expect(Math.abs(energy(res.position_m, res.velocity_mps) - e0)).toBeLessThanOrEqual(
          energyBound,
        );
        const h1 = crossVec3(res.position_m, res.velocity_mps);
        expect(normVec3(subVec3(h1, h0))).toBeLessThanOrEqual(
          dr * vv + rr * dv + 4 * u * (rr * vv + rp * vp),
        );
        expect(res.diagnostics.iterationCapReached).toBe(false);
        const resid = res.diagnostics.timeResidual_s;
        const noise = res.diagnostics.timeResidualNoise_s;
        expect(resid !== null && noise !== null && Math.abs(resid) <= noise).toBe(true);
      }
    });
  }

  test('exactly parabolic data (α = 0 exactly): converges and conserves h', () => {
    // μ = 2, r0 = 1, v0 = 2: α = 2/1 − 4/2 = 0 exactly.
    const r: Vec3 = [1, 0, 0];
    const v: Vec3 = [0, 2, 0];
    for (const dt of [0.1, 1, 10, 1000, -5]) {
      const res = expectOk(propagateKeplerUniversal(2, r, v, dt));
      expect(res.diagnostics.timeEquation?.alpha_per_m).toBe(0);
      const { dr, dv } = offOrbitBounds(r, v, res);
      const rr = normVec3(res.position_m);
      const vv = normVec3(res.velocity_mps);
      const h1 = crossVec3(res.position_m, res.velocity_mps);
      expect(normVec3(subVec3(h1, [0, 0, 2]))).toBeLessThanOrEqual(
        dr * vv + rr * dv + 4 * u * (rr * vv + 2),
      );
    }
  });
});

describe('sample independence and determinism', () => {
  test('each requested time is computed independently of the others (bit-identical)', () => {
    const { r, v } = stateFromConic(2.66e7, 0.74, 1.1, 0.7, 1.3, 0.4);
    const times = [60, 3600.5, 43082.0, -1234.5, 86164.09];
    const batch = propagateKeplerUniversalAt(MU, r, v, times);
    const reversed = propagateKeplerUniversalAt(MU, r, v, [...times].reverse());
    times.forEach((dt, k) => {
      const single = propagateKeplerUniversal(MU, r, v, dt);
      expect(batch[k]).toStrictEqual(single);
      expect(reversed[times.length - 1 - k]).toStrictEqual(single);
    });
  });

  test('repeated calls give bit-identical results', () => {
    const { r, v } = stateFromConic(1.0e7, 0.3, 1.0, 0.7, 1.3, 2.5);
    const first = propagateKeplerUniversal(MU, r, v, 123456.789);
    for (let k = 0; k < 3; k += 1) {
      expect(propagateKeplerUniversal(MU, r, v, 123456.789)).toStrictEqual(first);
    }
  });
});

describe('failures are results, never throws or NaN', () => {
  const r: Vec3 = [7.0e6, 0, 0];
  const v: Vec3 = [0, 7546.05, 0];

  test('invalid input', () => {
    const cases: [number, Vec3, Vec3, number][] = [
      [Number.NaN, r, v, 10],
      [0, r, v, 10],
      [-MU, r, v, 10],
      [MU, [Number.NaN, 0, 0], v, 10],
      [MU, r, [0, Number.POSITIVE_INFINITY, 0], 10],
      [MU, [0, 0, 0], v, 10],
      [MU, r, v, Number.NaN],
      [MU, r, v, Number.POSITIVE_INFINITY],
    ];
    for (const [mu, rr, vv, dt] of cases) {
      const res = propagateKeplerUniversal(mu, rr, vv, dt);
      expect(res.ok).toBe(false);
      expect(!res.ok && res.reason).toBe('INVALID_INPUT');
    }
    for (const maxIterations of [0, 1.5, KEPLER_MAX_ITERATIONS + 1]) {
      const res = propagateKeplerUniversal(MU, r, v, 10, { maxIterations });
      expect(!res.ok && res.reason).toBe('INVALID_INPUT');
    }
  });

  test('iteration cap reached → NOT_CONVERGED with the cap flag and finite diagnostics', () => {
    // A hyperbolic case that needs several iterations (measured 4–8) cannot finish in one.
    const vp = Math.sqrt((MU * 2.5) / 7.0e6);
    const res = propagateKeplerUniversal(MU, r, [0, vp, 0], 1.0e6, { maxIterations: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('NOT_CONVERGED');
      expect(res.diagnostics.iterationCapReached).toBe(true);
      expect(res.diagnostics.iterations).toBe(1);
      const resid = res.diagnostics.timeResidual_s;
      expect(resid === null || Number.isFinite(resid)).toBe(true);
    }
  });

  test('a state that overflows binary64 is reported, not returned', () => {
    // e = 1.5 hyperbola: v∞ ≈ 4.3 km/s, so r ≈ v∞ Δt ≈ 4e310 m > Number.MAX_VALUE at Δt = 1e307 s.
    const vp = Math.sqrt((MU * 2.5) / 7.0e6);
    const res = propagateKeplerUniversal(MU, r, [0, vp, 0], 1.0e307);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(['NON_FINITE_STATE', 'NOT_CONVERGED']).toContain(res.reason);
      for (const value of [
        res.diagnostics.timeResidual_s,
        res.diagnostics.timeResidualNoise_s,
        res.diagnostics.universalAnomaly_sqrtm,
      ]) {
        expect(value === null || Number.isFinite(value)).toBe(true);
      }
    }
  });
});
