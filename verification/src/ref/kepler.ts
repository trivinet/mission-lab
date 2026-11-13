/**
 * L2a reference: two-body propagation by classical elements and Kepler's equation in eccentric
 * anomaly (verification plan §2, method (a); tolerance record §6.4). Not universal variables.
 *
 * Steps (elliptic orbits only, 0 ≤ e < 1):
 *  1. (a, e, i, Ω, ω, ν₀) from the initial state with the L2c raw extraction (no convention).
 *  2. E₀ = atan2(√(1 − e²) sin ν₀, e + cos ν₀); M₀ = E₀ − e sin E₀, reduced to [0, 2π).
 *  3. n = √(μ/a³); M = M₀ + nΔt (not reduced further).
 *  4. Solve E − e sin E = M by safeguarded Newton (below).
 *  5. Perifocal state from E directly: x = a(cos E − e), y = a√(1 − e²) sin E,
 *     ẋ = −a n sin E/(1 − e cos E), ẏ = a n √(1 − e²) cos E/(1 − e cos E);
 *     rotated by Q = Rz(Ω)Rx(i)Rz(ω) (explicit matrix product, as L2c).
 *
 * Kepler solver and stopping criterion. f(E) = E − e sin E − M is strictly increasing
 * (f′ = 1 − e cos E ≥ 1 − e > 0) and its root lies in [M − e, M + e]. Newton iterates from
 * E = M + e sin M, clamped to the bracket; the bracket is shrunk with the sign of f at every
 * iterate and a Newton step leaving it is replaced by bisection. Iteration stops when the last
 * Newton correction satisfies |ΔE| ≤ 4u·max(1, |M|) (u = 2⁻⁵³), when f(E) = 0, or when the
 * bracket has no interior binary64 value; at most 100 iterations (never reached on the grid;
 * exceeding it throws). The iterate with the smallest computed |f| is returned.
 * Error bound (confirmed in kepler.test.ts by evaluating the residual of the returned E in
 * 320-bit arithmetic): see docs/verification/l2-references-report.md §3.
 */
import { stateToElementsRaw, perifocalToInertial, type State } from './elements';
import { matVec, wrapTwoPi } from './vec';

const U = 2 ** -53;

export interface KeplerSolution {
  readonly E: number;
  readonly iterations: number;
}

/** Solves E − e sin E = M for 0 ≤ e < 1 (criterion in the module comment). */
export function solveKepler(M: number, e: number): KeplerSolution {
  let lo = M - e;
  let hi = M + e;
  let E = M + e * Math.sin(M);
  if (E < lo) E = lo;
  if (E > hi) E = hi;
  let bestE = E;
  let bestF = Number.POSITIVE_INFINITY;
  const stepTol = 4 * U * Math.max(1, Math.abs(M));
  for (let it = 1; it <= 100; it++) {
    const f = E - e * Math.sin(E) - M;
    if (Math.abs(f) < bestF) {
      bestF = Math.abs(f);
      bestE = E;
    }
    if (f === 0) return { E, iterations: it };
    if (f > 0) hi = E;
    else lo = E;
    const step = f / (1 - e * Math.cos(E));
    let next = E - step;
    if (!(next > lo && next < hi)) next = lo + (hi - lo) / 2;
    if (next === E || next <= lo || next >= hi) {
      // No representable point strictly inside the bracket remains.
      const fn = next - e * Math.sin(next) - M;
      if (Math.abs(fn) < bestF) bestE = next;
      return { E: bestE, iterations: it };
    }
    const delta = Math.abs(next - E);
    E = next;
    if (delta <= stepTol) {
      const fn = E - e * Math.sin(E) - M;
      if (Math.abs(fn) < bestF) bestE = E;
      return { E: bestE, iterations: it + 1 };
    }
  }
  throw new Error(`solveKepler: no convergence for M=${String(M)}, e=${String(e)}`);
}

/** Intermediate quantities of one L2a propagation, exposed for validation. */
export interface L2aTrace {
  readonly a: number;
  readonly e: number;
  readonly n: number;
  readonly M0: number;
  readonly M: number;
  readonly E: number;
  readonly iterations: number;
}

export interface L2aPrepared {
  readonly mu: number;
  readonly a: number;
  readonly e: number;
  readonly n: number;
  readonly M0: number;
  readonly sqrt1me2: number;
  readonly q: ReturnType<typeof perifocalToInertial>;
}

/** Steps 1–3 that depend only on the initial state. */
export function prepareL2a(s0: State, mu_m3ps2: number): L2aPrepared {
  const el = stateToElementsRaw(s0, mu_m3ps2);
  const a = el.semiMajorAxis_m;
  const e = el.eccentricity;
  if (!(a > 0) || !(e < 1)) throw new RangeError('L2a: elliptic orbits only');
  const nu = el.trueAnomaly_rad;
  const sqrt1me2 = Math.sqrt(1 - e * e);
  const E0 = Math.atan2(sqrt1me2 * Math.sin(nu), e + Math.cos(nu));
  const M0 = wrapTwoPi(E0 - e * Math.sin(E0));
  const n = Math.sqrt(mu_m3ps2 / (a * a * a));
  return {
    mu: mu_m3ps2,
    a,
    e,
    n,
    M0,
    sqrt1me2,
    q: perifocalToInertial(el.raan_rad, el.inclination_rad, el.argPeriapsis_rad),
  };
}

/** L2a state at Δt (seconds) after the initial state. */
export function propagateL2a(p: L2aPrepared, dt_s: number): { state: State; trace: L2aTrace } {
  const M = p.M0 + p.n * dt_s;
  const { E, iterations } = solveKepler(M, p.e);
  const cE = Math.cos(E);
  const sE = Math.sin(E);
  const denom = 1 - p.e * cE;
  const an = p.a * p.n;
  const rPf: [number, number, number] = [p.a * (cE - p.e), p.a * p.sqrt1me2 * sE, 0];
  const vPf: [number, number, number] = [(-an * sE) / denom, (an * p.sqrt1me2 * cE) / denom, 0];
  return {
    state: { position_m: matVec(p.q, rPf), velocity_mps: matVec(p.q, vPf) },
    trace: { a: p.a, e: p.e, n: p.n, M0: p.M0, M, E, iterations },
  };
}
