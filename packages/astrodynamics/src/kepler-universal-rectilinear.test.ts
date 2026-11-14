/**
 * Unit tests of the rectilinear-collision rule of the universal-variable propagator
 * (ML-TASK-019; kepler-universal.ts module comment R1–R4; issue #24). Implementer self-checks
 * (behaviour and invariants), NOT reference comparisons (ADR-003).
 *
 * Bounds marked PROVISIONAL are implementer choices with the reasoning given next to them; they
 * are not approved tolerances (docs/verification/tolerances.md is not used here).
 */
import { describe, expect, it } from 'vitest';
import { EARTH_GM_m3ps2 } from './constants';
import {
  isExactlyRectilinear,
  propagateKeplerUniversal,
  rectilinearCollisionTimes,
} from './kepler-universal';
import type { KeplerPropagationResult } from './kepler-universal';
import { crossVec3, dotVec3, normVec3 } from './vector3';
import type { Vec3 } from './vector3';

const MU = EARTH_GM_m3ps2;
const u = 2 ** -53;

type Success = Extract<KeplerPropagationResult, { ok: true }>;
type Collision = Extract<KeplerPropagationResult, { reason: 'RECTILINEAR_COLLISION' }>;

function expectOk(result: KeplerPropagationResult): Success {
  if (!result.ok) {
    throw new Error(`propagation failed: ${result.reason}`);
  }
  return result;
}

function expectCollision(result: KeplerPropagationResult): Collision {
  if (result.ok || result.reason !== 'RECTILINEAR_COLLISION') {
    throw new Error(`expected RECTILINEAR_COLLISION, got ${result.ok ? 'ok' : result.reason}`);
  }
  return result;
}

/** Forward collision time of a state, via a propagation far beyond it. */
function collisionDeltaT(r: Vec3, v: Vec3, direction: 1 | -1): number {
  return expectCollision(propagateKeplerUniversal(MU, r, v, direction * 1e9)).collisionDeltaT_s;
}

function hexOf(x: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

function energy(r: Vec3, v: Vec3): number {
  return dotVec3(v, v) / 2 - MU / normVec3(r);
}

/** Next binary64 below a positive finite x. */
function prevDown(x: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  view.setBigUint64(0, view.getBigUint64(0) - 1n);
  return view.getFloat64(0);
}

// ---------------------------------------------------------------------------------------------
// Regression: the normal path is bit-identical to the code before ML-TASK-019.
// Values captured on commit c1bba42 (origin/main, before any change of this task) with a
// temporary Vitest probe that printed the IEEE-754 bit patterns of propagateKeplerUniversal(MU,
// r, v, dt); the probe was not committed. μ = EARTH_GM_m3ps2 = 3.986004418e14.
// The list includes exactly rectilinear states that do not reach the centre within dt: they must
// still take the unchanged normal path.
// ---------------------------------------------------------------------------------------------
const CAPTURED_C1BBA42: {
  name: string;
  r: Vec3;
  v: Vec3;
  dt: number;
  position: [string, string, string];
  velocity: [string, string, string];
}[] = [
  {
    name: 'LEO ellipse forward',
    r: [7000000, 1000000, -500000],
    v: [-1000, 7400, 1200],
    dt: 3000,
    position: ['c15bbd8e53ace4b5', 'c12839d93b3cdace', '4120f8706fed12c1'],
    velocity: ['4084c79070ba69de', 'c0bc14251ac13061', 'c091c4d4e8a30ef5'],
  },
  {
    name: 'LEO ellipse backward',
    r: [7000000, 1000000, -500000],
    v: [-1000, 7400, 1200],
    dt: -4321.5,
    position: ['c146ea268d464b60', '415899806d485645', '4132f9c09f811123'],
    velocity: ['c0ba73791fa03645', 'c0a7c1c3b6b114d4', '4065add8fde64884'],
  },
  {
    name: 'e~0.99 ellipse through periapsis',
    r: [-42000000, 3000000, 0],
    v: [-50, -800, 10],
    dt: 40000,
    position: ['c18098ca709bc713', 'c14ac50644f09975', '40f236b2d323dd1d'],
    velocity: ['409ee021cc27dad1', 'c08813a7d55b3865', '401f5363ad79718a'],
  },
  {
    name: 'hyperbola',
    r: [7000000, 0, 0],
    v: [0, 15000, 1000],
    dt: 20000,
    position: ['c18f298fa547dbc5', '41a9362852c68271', '416ae46f473a24bd'],
    velocity: ['c0ac47497b61eace', '40c3bd867e1f75c0', '40850e6d5354c1de'],
  },
  {
    name: 'near-rectilinear (h = 7 m^2/s) through its periapsis',
    r: [7000000, 0, 0],
    v: [-1000, 0.000001, 0],
    dt: 1500,
    position: ['415783b35707e575', 'bf41ee44e8946888', '0000000000000000'],
    velocity: ['40afadd03bba801f', '3eaa06a5c1fcd59d', '0000000000000000'],
  },
  {
    name: 'rectilinear inward, before the collision (300 s)',
    r: [7000000, 0, 0],
    v: [-1000, 0, 0],
    dt: 300,
    position: ['415817c64f8ce8be', '0000000000000000', '0000000000000000'],
    velocity: ['c0ac8814930f4031', '0000000000000000', '0000000000000000'],
  },
  {
    name: 'rectilinear inward, before the collision (900 s)',
    r: [7000000, 0, 0],
    v: [-1000, 0, 0],
    dt: 900,
    position: ['412a585180a8dd0e', '0000000000000000', '0000000000000000'],
    velocity: ['c0dbcda95385b883', '8000000000000000', '8000000000000000'],
  },
  {
    name: 'rectilinear outward escape',
    r: [7000000, 0, 0],
    v: [20000, 0, 0],
    dt: 50000,
    position: ['41c99a56ac2e12d2', '0000000000000000', '0000000000000000'],
    velocity: ['40d08b9450481f9c', '0000000000000000', '0000000000000000'],
  },
  {
    name: 'rectilinear outward bounded, falling back',
    r: [0, 7000000, 0],
    v: [0, 3000, 0],
    dt: 1000,
    position: ['0000000000000000', '41582b237b5b941c', '0000000000000000'],
    velocity: ['0000000000000000', 'c0b1e04825ed2650', '0000000000000000'],
  },
  {
    name: 'rectilinear oblique fall from rest, before the collision',
    r: [3000000, 4000000, 12000000],
    v: [0, 0, 0],
    dt: 2000,
    position: ['413a4f4670ef53f4', '41418a2ef5f4e2a3', '415a4f4670ef53f4'],
    velocity: ['c09849d376d03d06', 'c0a03137a48ad35a', 'c0b849d376d03d06'],
  },
];

describe('normal path unchanged (bit patterns captured on c1bba42)', () => {
  for (const c of CAPTURED_C1BBA42) {
    it(c.name, () => {
      const res = expectOk(propagateKeplerUniversal(MU, c.r, c.v, c.dt));
      expect(res.position_m.map(hexOf)).toEqual(c.position);
      expect(res.velocity_mps.map(hexOf)).toEqual(c.velocity);
    });
  }
});

// ---------------------------------------------------------------------------------------------
describe('isExactlyRectilinear (R1)', () => {
  it('v = 0, v ∥ r, v anti-parallel to r, off-axis exact multiples', () => {
    expect(isExactlyRectilinear([7e6, 0, 0], [0, 0, 0])).toBe(true);
    expect(isExactlyRectilinear([7e6, 0, 0], [-1000, 0, 0])).toBe(true);
    expect(isExactlyRectilinear([3e6, 4e6, 12e6], [-300, -400, -1200])).toBe(true);
    expect(isExactlyRectilinear([3e6, 4e6, 12e6], [300, 400, 1200])).toBe(true);
    expect(isExactlyRectilinear([-0, 7e6, 0], [0, -0, -0])).toBe(true);
  });

  it('a tiny non-zero h is not rectilinear', () => {
    expect(isExactlyRectilinear([7e6, 0, 0], [-1000, 1e-6, 0])).toBe(false);
    expect(isExactlyRectilinear([7e6, 0, 0], [-1000, 5e-324, 0])).toBe(false);
  });

  it('computed r × v exactly zero but exact h ≠ 0 (products round equal) is not rectilinear', () => {
    // a = 1 + 2^-52: a·a = 1 + 2^-51 + 2^-104 rounds to 1 + 2^-51 = 1·(1 + 2^-51). Scaled by
    // powers of two (exact): r = 2^23 (a, 1, 0) m, v = −2^10 (1 + 2^-51, a, 0) m/s.
    const a = 1 + 2 ** -52;
    const r: Vec3 = [2 ** 23 * a, 2 ** 23, 0];
    const v: Vec3 = [-(2 ** 10) * (1 + 2 ** -51), -(2 ** 10) * a, 0];
    expect(crossVec3(r, v).map(Math.abs)).toEqual([0, 0, 0]);
    expect(isExactlyRectilinear(r, v)).toBe(false);
    // Hence it is propagated as the (extremely eccentric) conic it is, also far past the time at
    // which the rectilinear motion with the same r, |v| would reach the centre.
    const res = expectOk(propagateKeplerUniversal(MU, r, v, 5000));
    expect(res.position_m.every(Number.isFinite)).toBe(true);
  });

  it('exact comparison also on overflow and in the subnormal range', () => {
    expect(isExactlyRectilinear([1e300, 2e300, 0], [1e300, 2e300, 0])).toBe(true);
    expect(isExactlyRectilinear([1e300, 2e300, 0], [1e300, 2.0000000000000004e300, 0])).toBe(false);
    expect(isExactlyRectilinear([5e-324, 1e-323, 0], [1, 2, 0])).toBe(true);
    expect(isExactlyRectilinear([5e-324, 1e-323, 0], [1, 2.0000000000000004, 0])).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('RECTILINEAR_COLLISION (R2–R4)', () => {
  it('issue #24 reproduction: [7e6, 0, 0] m, [−1000, 0, 0] m/s, Δt = 1500 s fails', () => {
    const res = expectCollision(propagateKeplerUniversal(MU, [7e6, 0, 0], [-1000, 0, 0], 1500));
    expect(res.collisionDeltaT_s).toBeGreaterThan(900); // still falling at 900 s (regression)
    expect(res.collisionDeltaT_s).toBeLessThanOrEqual(1500);
    expect(res.diagnostics.iterations).toBe(0);
    expect(res.diagnostics.timeEquation?.r0_m).toBe(7e6);
  });

  it('fall from rest matches the closed form (F) t = (π/2)·√(r₀³/(2μ))', () => {
    // (F) derived in the module comment (R2) and cross-checked there with the elementary
    // integral. PROVISIONAL bound 64u relative: the implementation evaluates atan2 (π/2), a
    // division, c3(π²) (≤ 7u) and α̂ = 2/r̂₀ (≤ 2u, enters as α^{-3/2}); the test formula takes ~6
    // rounded operations. Measured difference: see the task report.
    for (const r of [
      [7e6, 0, 0],
      [3e6, 4e6, 12e6],
      [0, 0, -4.2164e7],
      [1e5, 0, 0],
    ] as Vec3[]) {
      const r0 = normVec3(r);
      const expected = (Math.PI / 2) * Math.sqrt((r0 * r0 * r0) / (2 * MU));
      const forward = collisionDeltaT(r, [0, 0, 0], 1);
      const backward = collisionDeltaT(r, [0, 0, 0], -1);
      expect(Math.abs(forward - expected)).toBeLessThanOrEqual(64 * u * expected);
      // At rest the past and next passages are symmetric (both T/2): bit-identical magnitudes.
      expect(backward).toBe(-forward);
    }
  });

  it('boundary: Δt = t_c fails, the next binary64 below t_c does not collide', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [-1000, 0, 0];
    const t_c = collisionDeltaT(r, v, 1);
    const at = expectCollision(propagateKeplerUniversal(MU, r, v, t_c));
    expect(at.collisionDeltaT_s).toBe(t_c);
    const before = propagateKeplerUniversal(MU, r, v, prevDown(t_c));
    expect(!before.ok && before.reason === 'RECTILINEAR_COLLISION').toBe(false);
    // Backward boundary of the mirrored state.
    const back = expectCollision(propagateKeplerUniversal(MU, r, [1000, 0, 0], -t_c));
    expect(back.collisionDeltaT_s).toBe(-t_c);
  });

  it('a state just before the collision is propagated on the line, never through it', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [-1000, 0, 0];
    const t_c = collisionDeltaT(r, v, 1);
    for (const fraction of [0.5, 0.9, 0.99, 0.999999]) {
      const res = expectOk(propagateKeplerUniversal(MU, r, v, fraction * t_c));
      expect(res.position_m[0]).toBeGreaterThan(0); // still on the incoming side
      expect(res.velocity_mps[0]).toBeLessThan(0); // still incoming
      expect(Math.abs(res.position_m[1])).toBe(0);
      expect(Math.abs(res.position_m[2])).toBe(0);
    }
  });

  it('negative Δt: an outgoing state reaches its past passage through the centre', () => {
    // Outgoing (σ₀ > 0) backward is the mirror of incoming forward: same t*, bit-identical.
    const r: Vec3 = [7e6, 0, 0];
    const t_in = collisionDeltaT(r, [-1000, 0, 0], 1);
    const t_out_back = collisionDeltaT(r, [1000, 0, 0], -1);
    expect(t_out_back).toBe(-t_in);
    // A negative Δt that does not reach it is propagated (and retraces the incoming motion).
    const res = expectOk(propagateKeplerUniversal(MU, r, [1000, 0, 0], 0.5 * -t_in));
    expect(res.velocity_mps[0]).toBeGreaterThan(0);
    expect(res.position_m[0]).toBeLessThan(7e6);
  });

  it('negative Δt on an incoming bounded state: the past passage is T − t* ago', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [-1000, 0, 0];
    const alpha = 2 / 7e6 - 1e6 / MU;
    const T = (2 * Math.PI) / Math.sqrt(alpha * alpha * alpha * MU);
    const t_star = collisionDeltaT(r, v, 1);
    const back = -collisionDeltaT(r, v, -1);
    // PROVISIONAL: T formed differently here (one sqrt of α³μ); 1e-13 relative is ~ 450u.
    expect(Math.abs(back + t_star - T)).toBeLessThanOrEqual(1e-13 * T);
    // It equals the forward time of the mirrored (outgoing) state.
    expect(back).toBe(collisionDeltaT(r, [1000, 0, 0], 1));
  });

  it('collision times are finite and diagnostics carry no non-finite number', () => {
    const res = expectCollision(
      propagateKeplerUniversal(MU, [3e6, 4e6, 12e6], [-30, -40, -120], 1e7),
    );
    expect(Number.isFinite(res.collisionDeltaT_s)).toBe(true);
    expect(res.diagnostics.universalAnomaly_sqrtm).toBeNull();
    expect(res.diagnostics.timeResidual_s).toBeNull();
    const data = res.diagnostics.timeEquation;
    expect(data === null ? [] : Object.values(data).every(Number.isFinite)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe('rectilinear motion that does not reach the centre is propagated', () => {
  it('outgoing escape (ξ > 0): no forward collision for any Δt; line, energy, monotone radius', () => {
    const r: Vec3 = [7e6, 0, 0];
    const v: Vec3 = [20000, 0, 0];
    const k = rectilinearCollisionTimes(
      2 / 7e6 - 4e8 / MU,
      (7e6 * 20000) / Math.sqrt(MU),
      7e6,
      Math.sqrt(MU),
    );
    expect(k.forward_s).toBeNull();
    expect(k.backward_s).not.toBeNull();
    let previous = 7e6;
    for (const dt of [10, 1e3, 1e5, 1e7]) {
      const res = expectOk(propagateKeplerUniversal(MU, r, v, dt));
      expect(res.position_m[0]).toBeGreaterThan(previous);
      previous = res.position_m[0];
      expect([res.position_m[1], res.position_m[2]].map(Math.abs)).toEqual([0, 0]);
      // PROVISIONAL energy bound: 1e-12 relative to v²/2 + μ/r (well above rounding, far below
      // any physical change).
      const scale = 2e8 + MU / 7e6;
      expect(Math.abs(energy(res.position_m, res.velocity_mps) - energy(r, v))).toBeLessThan(
        1e-12 * scale,
      );
    }
    // Backward it came from the centre.
    expect(collisionDeltaT(r, v, -1)).toBeLessThan(0);
  });

  it('bounded outgoing motion (ξ < 0) matches the radial Kepler equation before it falls back', () => {
    // Independent closed form for radial motion with E measured from a passage through the
    // centre (derived in the module comment R2, α > 0 case): r = a(1 − cos E),
    // t − t_centre = (E − sin E)/n, n = √(μ/a³). The state starts outgoing at E₀ ∈ (0, π).
    const r0 = 7e6;
    const vr = 3000;
    const r: Vec3 = [0, r0, 0];
    const v: Vec3 = [0, vr, 0];
    const a = 1 / (2 / r0 - (vr * vr) / MU);
    const n = Math.sqrt(MU / (a * a * a));
    const E0 = Math.acos(1 - r0 / a);
    const M0 = E0 - Math.sin(E0);
    const t_c = collisionDeltaT(r, v, 1);
    // Time to the next passage: (2π − M0)/n. PROVISIONAL 1e-12 relative (acos near E0 is well
    // conditioned here; ~4500u).
    expect(Math.abs(t_c - (2 * Math.PI - M0) / n)).toBeLessThan(1e-12 * t_c);
    for (const E1 of [1.5, 2.5, Math.PI, 4.0, 5.5]) {
      const dt = (E1 - Math.sin(E1) - M0) / n;
      expect(dt).toBeLessThan(t_c);
      const res = expectOk(propagateKeplerUniversal(MU, r, v, dt));
      const expectedR = a * (1 - Math.cos(E1));
      // PROVISIONAL 1e-10 relative: covers the conditioning of r(t) through dt (|ṙ| δt / r) for
      // the test's own rounding of dt, which is ~1e-15·t.
      expect(Math.abs(res.position_m[1] - expectedR)).toBeLessThan(1e-10 * a);
      expect([res.position_m[0], res.position_m[2]].map(Math.abs)).toEqual([0, 0]);
      if (E1 !== Math.PI) {
        expect(Math.sign(res.velocity_mps[1])).toBe(E1 < Math.PI ? 1 : -1);
      }
    }
    // And beyond the next passage it fails.
    expectCollision(propagateKeplerUniversal(MU, r, v, t_c * 1.0001));
  });

  it('parabolic-energy and hyperbolic incoming motion collide at the computed time', () => {
    const r0 = 7e6;
    for (const speed of [Math.sqrt((2 * MU) / r0), 20000]) {
      const t_c = collisionDeltaT([r0, 0, 0], [-speed, 0, 0], 1);
      expect(t_c).toBeGreaterThan(0);
      // Average speed check: the body arrives faster than at constant initial speed.
      expect(t_c).toBeLessThan(r0 / speed);
      const before = expectOk(propagateKeplerUniversal(MU, [r0, 0, 0], [-speed, 0, 0], 0.5 * t_c));
      expect(before.position_m[0]).toBeGreaterThan(0);
    }
  });
});

describe('rectilinearCollisionTimes (R3) direct', () => {
  const sqrtMu = Math.sqrt(MU);
  it('σ₀ = 0 (rest): both directions T/2; α ≤ 0 outgoing: no forward passage', () => {
    const rest = rectilinearCollisionTimes(2 / 7e6, 0, 7e6, sqrtMu);
    expect(rest.forward_s).toBe(rest.backward_s);
    const parabolicOut = rectilinearCollisionTimes(0, 1, 7e6, sqrtMu);
    expect(parabolicOut.forward_s).toBeNull();
    // α = 0: t* = (2r₀)^{3/2}/(6√μ) (R2: χ* = √(2r₀), c3(0) = 1/6). PROVISIONAL 8u relative.
    const expected = (2 * 7e6 * Math.sqrt(2 * 7e6)) / (6 * sqrtMu);
    expect(Math.abs((parabolicOut.backward_s ?? 0) - expected)).toBeLessThan(8 * u * expected);
  });
  it('α near underflow: a forward bounded time that overflows is reported non-finite', () => {
    const t = rectilinearCollisionTimes(1e-320, 1e3, 7e6, sqrtMu);
    expect(Number.isFinite(t.forward_s)).toBe(false);
    expect(Number.isFinite(t.backward_s)).toBe(true);
  });
});
