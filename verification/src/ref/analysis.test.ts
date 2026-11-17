/**
 * Self-validation of the ML-TASK-036 analysis reference (analysis.ts) before any comparison with
 * the analysis module (task rule: validate references first; every number by two methods).
 *
 *  1. Known elements: states built in 200-bit arithmetic from given elements (hpElementsToState,
 *     rounded once) are mapped back by method (H); the elements must be recovered to the
 *     conditioning of the rounded state (sanity bound 1e-12; a sign, quadrant or formula error
 *     gives O(1)).
 *  2. Method (H) vs method (B) (binary64, the record's canonical e-vector formulation) on the same
 *     states: |B − H| within M × the record's PER-SIDE budget of §8 VI-03 (b) (one side only, as H
 *     is exact to 2⁻²⁰⁰ before its final rounding). This checks H against a different formulation
 *     and checks that the per-side budgets bound a binary64 canonical evaluation.
 *  3. Hyperbolic states: H vs B on the rows that are defined; H's polar e vs the e-vector e in high
 *     precision (two HP formulations).
 *  4. The ADR-008 convention of H vs the earlier validated L2c view (stateToElementView).
 */
import { describe, expect, it } from 'vitest';
import { toV3 } from '../hp/hp-vec';
import { hpElementsToState } from '../hp/hp-kepler';
import { GRID } from '../datasets/cases';
import { CONSTANTS } from '../datasets/build';
import { hyperbolicElementsToState } from '../datasets/build-d3';
import { stateToElementView } from './elements';
import { analysisReference64, analysisReferenceHp, eccentricityEvectorHp } from './analysis';
import { wrapPi, type V3 } from './vec';

const u = 2 ** -53;
const M = 4;
const C = CONSTANTS;
const MU = C.mu_m3ps2;

function stateFrom(el: (typeof GRID)[number]['elements']): { r: V3; v: V3 } {
  const s = hpElementsToState(el, MU);
  return { r: toV3(s.position_m), v: toV3(s.velocity_mps) };
}

const angDiff = (a: number, b: number): number => Math.abs(wrapPi(a - b));

const GENERAL = GRID.filter(
  (g) => g.elements.eccentricity > 1e-3 && g.elements.inclination_rad > 0.01,
);
const ANOMALIES = [0, 0.4, 1.3, 2.5, 3.1, 3.6, 4.9, 6.1];

describe('analysis reference (H): known elements are recovered', () => {
  for (const g of GENERAL) {
    it(g.id, () => {
      for (const nu of ANOMALIES) {
        const el = { ...g.elements, trueAnomaly_rad: nu };
        const { r, v } = stateFrom(el);
        const q = analysisReferenceHp(r, v, C);
        expect(q.convention).toBe('NONE');
        expect(Math.abs(q.semiMajorAxis_m / el.semiMajorAxis_m - 1)).toBeLessThan(1e-12);
        expect(Math.abs(q.eccentricity - el.eccentricity)).toBeLessThan(1e-12);
        expect(Math.abs(q.inclination_rad - el.inclination_rad)).toBeLessThan(1e-12);
        expect(angDiff(q.raan_rad, el.raan_rad)).toBeLessThan(1e-12);
        expect(angDiff(q.argPeriapsis_rad, el.argPeriapsis_rad)).toBeLessThan(1e-12);
        expect(angDiff(q.trueAnomaly_rad, nu)).toBeLessThan(1e-12);
        const a = el.semiMajorAxis_m;
        const e = el.eccentricity;
        expect(Math.abs((q.periapsisRadius_m ?? NaN) / (a * (1 - e)) - 1)).toBeLessThan(1e-12);
        expect(Math.abs((q.apoapsisRadius_m ?? NaN) / (a * (1 + e)) - 1)).toBeLessThan(1e-12);
        const T = 2 * Math.PI * Math.sqrt((a * a * a) / MU);
        expect(Math.abs((q.period_s ?? NaN) / T - 1)).toBeLessThan(1e-12);
        expect(Math.abs(q.specificEnergy_m2ps2 / (-MU / (2 * a)) - 1)).toBeLessThan(1e-12);
        const p = a * (1 - e * e);
        const rr = p / (1 + e * Math.cos(nu));
        expect(Math.abs(q.radius_m / rr - 1)).toBeLessThan(1e-12);
        expect(Math.abs(q.altitude_m - (rr - C.referenceRadius_m))).toBeLessThan(1e-12 * rr);
        expect(Math.abs(q.speed_mps / Math.sqrt(MU * (2 / rr - 1 / a)) - 1)).toBeLessThan(1e-12);
        // Conditioning inputs: κ_h = rv/h ≤ 1/√(1 − e²); κ_E(r) = 4a/r − 1 on an ellipse.
        expect(q.kappaH).toBeLessThanOrEqual(1 / Math.sqrt(1 - e * e) + 1e-12);
        expect(Math.abs(q.kappaE - ((4 * a) / rr - 1))).toBeLessThan(1e-10);
      }
    });
  }
});

/** One-side budgets: M × per-side column of §8 VI-03 (b). */
function checkHvsB(r: V3, v: V3, closed: boolean): string[] {
  const h = analysisReferenceHp(r, v, C);
  const b = analysisReference64(r, v, C);
  const f: string[] = [];
  const chk = (name: string, d: number, tol: number): void => {
    if (!(d <= tol)) f.push(`${name}: ${String(d)} > ${String(tol)}`);
  };
  const sinI = Math.sin(h.inclination_rad);
  chk('radius', Math.abs(b.radius_m - h.radius_m), M * 3 * u * h.radius_m);
  chk('speed', Math.abs(b.speed_mps - h.speed_mps), M * 3 * u * h.speed_mps);
  chk(
    'altitude',
    Math.abs(b.altitude_m - h.altitude_m),
    M * (3 * u * h.radius_m + u * Math.abs(h.altitude_m)),
  );
  chk(
    'energy',
    Math.abs(b.specificEnergy_m2ps2 - h.specificEnergy_m2ps2),
    M * 5 * u * h.energyScale_m2ps2,
  );
  chk(
    'a',
    Math.abs(b.semiMajorAxis_m - h.semiMajorAxis_m),
    M * 5.5 * u * h.kappaE * Math.abs(h.semiMajorAxis_m),
  );
  chk('i', Math.abs(b.inclination_rad - h.inclination_rad), M * (4.3 * h.kappaH + 9.2) * u);
  chk('Ω', angDiff(b.raan_rad, h.raan_rad), M * (6.3 + (4.3 * h.kappaH) / sinI) * u);
  if (closed) {
    const e = h.eccentricity;
    chk('e', Math.abs(b.eccentricity - e), M * 30 * u);
    chk(
      'ω',
      angDiff(b.argPeriapsis_rad, h.argPeriapsis_rad),
      M * (12 + 42.5 / e + (4.3 * h.kappaH) / sinI) * u,
    );
    chk('ν', angDiff(b.trueAnomaly_rad, h.trueAnomaly_rad), M * (12 + 42.5 / e) * u);
  }
  return f;
}

describe('analysis reference: method (H) vs method (B) within M × per-side budget', () => {
  for (const g of GENERAL) {
    it(g.id, () => {
      const f: string[] = [];
      for (let k = 0; k < 64; k++) {
        const nu = (2 * Math.PI * k) / 64 + 0.01;
        const { r, v } = stateFrom({ ...g.elements, trueAnomaly_rad: nu });
        f.push(...checkHvsB(r, v, true).map((x) => `ν=${String(nu)} ${x}`));
      }
      expect(f).toEqual([]);
    });
  }
});

describe('analysis reference on hyperbolic states', () => {
  const cases = [
    { a: -2.0e7, e: 1.2, i: 0.6, raan: 1.0, argp: 2.0 },
    { a: -1.0e7, e: 1.7, i: 2.2, raan: 5.0, argp: 0.5 },
  ];
  for (const c of cases) {
    it(`a = ${String(c.a)}, e = ${String(c.e)}`, () => {
      for (const F of [-1.2, -0.3, 0, 0.5, 1.4]) {
        // Binary64 state from hyperbolic elements (|a|, e, i, Ω, ω, hyperbolic anomaly F).
        const s = hyperbolicElementsToState(-c.a, c.e, c.i, c.raan, c.argp, F);
        const nu = 2 * Math.atan(Math.sqrt((c.e + 1) / (c.e - 1)) * Math.tanh(F / 2));
        const r = s.position_m;
        const v = s.velocity_mps;
        const h = analysisReferenceHp(r, v, C);
        expect(h.closed).toBe(false);
        expect(h.periapsisRadius_m).toBeNull();
        expect(h.apoapsisRadius_m).toBeNull();
        expect(h.period_s).toBeNull();
        expect(Math.abs(h.semiMajorAxis_m / c.a - 1)).toBeLessThan(1e-12);
        expect(Math.abs(h.eccentricity - c.e)).toBeLessThan(1e-12);
        expect(Math.abs(h.inclination_rad - c.i)).toBeLessThan(1e-12);
        expect(angDiff(h.raan_rad, c.raan)).toBeLessThan(1e-12);
        expect(angDiff(h.argPeriapsis_rad, c.argp)).toBeLessThan(1e-12);
        expect(angDiff(h.trueAnomaly_rad, nu)).toBeLessThan(1e-12);
        // Two HP formulations of e (polar vs e-vector) on the same binary64 state.
        expect(Math.abs(eccentricityEvectorHp(r, v, MU) - h.eccentricity)).toBeLessThanOrEqual(
          2 * u * h.eccentricity,
        );
        expect(checkHvsB(r, v, false)).toEqual([]);
      }
    });
  }
});

describe('analysis reference: ADR-008 convention agrees with the validated L2c view', () => {
  const states = GRID.map((g) => ({ id: g.id, ...stateFrom(g.elements) }));
  it.each(states)('$id', ({ r, v }) => {
    const h = analysisReferenceHp(r, v, C);
    const l = stateToElementView({ position_m: r, velocity_mps: v }, MU);
    const conv = l.circular
      ? l.equatorial
        ? 'CIRCULAR_EQUATORIAL'
        : 'CIRCULAR'
      : l.equatorial
        ? 'EQUATORIAL'
        : 'NONE';
    expect(h.convention).toBe(conv);
    expect(Math.abs(h.eccentricity - l.elements.eccentricity)).toBeLessThan(1e-13);
    expect(Math.abs(h.inclination_rad - l.elements.inclination_rad)).toBeLessThan(1e-13);
    // Angles: only those defined under the convention are compared to tight bounds; the L2c view
    // is a binary64 polar evaluation (its own rounding included in the 1e-9 sanity bound, which
    // covers the near-degenerate conditioning ê/e of the C7/C8 cases).
    expect(angDiff(h.raan_rad, l.elements.raan_rad)).toBeLessThan(1e-9);
    expect(angDiff(h.argPeriapsis_rad, l.elements.argPeriapsis_rad)).toBeLessThan(1e-9);
    expect(angDiff(h.trueAnomaly_rad, l.elements.trueAnomaly_rad)).toBeLessThan(1e-9);
  });
});
