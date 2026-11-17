/**
 * Reference-side checks of the ML-TASK-036 dataset vi-03-b (no engine, no analysis module):
 *  - sample times are the independent §5.2 grid (samplingGridWithManeuvers), per segment;
 *  - every stored reference quantity is checked a second time by an independent method: method B
 *    (binary64, e-vector form, analysis.ts) from the stored reference state, within M × the
 *    per-side budget of §8 VI-03 (b) (H is the stored value); on open states e by the second HP
 *    formulation (e-vector) to 2u;
 *  - the reference trajectory is checked against an independent binary64 propagation (L2a for
 *    elliptic arcs) to a sanity bound (it only sizes tolerances; 1e-3 m changes no tolerance
 *    digit that matters);
 *  - no sample lies within a factor 2 of a §10 threshold, every sample is classified NONE, and
 *    every asserted tolerance is positive and finite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analysisReference64, eccentricityEvectorHp } from '../ref/analysis';
import { samplingGridWithManeuvers } from '../ref/grid';
import { prepareL2a, propagateL2a } from '../ref/kepler';
import { wrapPi, type V3 } from '../ref/vec';
import { nearThreshold } from '../tol/tolerances-vi03';
import { CONSTANTS } from './build';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIR = join(ROOT, 'test-data', 'reference-cases', 'vi-03-b');
const u = 2 ** -53;
const M = 4;
const MU = CONSTANTS.mu_m3ps2;

interface Segment {
  segmentIndex: number;
  t_s: number[];
  reference: {
    position_m: V3[];
    velocity_mps: V3[];
    closed: boolean[];
    convention: string[];
    kappaE: number[];
    kappaH: number[];
    quantities: Record<string, (number | null)[]>;
  };
  tolerance: Record<string, (number | null)[]>;
}

interface Dataset {
  inputs: {
    scenario: {
      duration_s: number;
      outputStep_s: number;
      maneuvers: { t_s: number }[];
    };
  };
  outputs: {
    referenceInitialState: { position_m: V3; velocity_mps: V3 };
    segments: Segment[];
    coast: { segments: Segment[] } | null;
    comparison: {
      referencePre: { position_m: V3; velocity_mps: V3 };
      referencePost: { position_m: V3; velocity_mps: V3 };
    } | null;
  };
}

const files = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => ({ name: n, data: JSON.parse(readFileSync(join(DIR, n), 'utf8')) as Dataset }));

function checkSegment(name: string, s: Segment): string[] {
  const f: string[] = [];
  const q = s.reference.quantities;
  const at = (k: string, j: number): number => q[k]?.[j] ?? NaN;
  s.t_s.forEach((_, j) => {
    const r = s.reference.position_m[j] ?? [NaN, NaN, NaN];
    const v = s.reference.velocity_mps[j] ?? [NaN, NaN, NaN];
    const b = analysisReference64(r, v, CONSTANTS);
    const closed = s.reference.closed[j] ?? false;
    const kE = s.reference.kappaE[j] ?? NaN;
    const kH = s.reference.kappaH[j] ?? NaN;
    const e = at('eccentricity', j);
    const inc = at('inclination_rad', j);
    const sinI = Math.sin(inc);
    const chk = (k: string, d: number, tol: number): void => {
      if (!(d <= tol))
        f.push(
          `${name} seg ${String(s.segmentIndex)} j=${String(j)} ${k}: ${String(d)} > ${String(tol)}`,
        );
    };
    chk('radius', Math.abs(b.radius_m - at('radius_m', j)), M * 3 * u * b.radius_m);
    chk('speed', Math.abs(b.speed_mps - at('speed_mps', j)), M * 3 * u * b.speed_mps);
    chk(
      'altitude',
      Math.abs(b.altitude_m - at('altitude_m', j)),
      M * (3 * u * b.radius_m + u * Math.abs(b.altitude_m)),
    );
    const scale = (b.speed_mps * b.speed_mps) / 2 + MU / b.radius_m;
    chk(
      'energy',
      Math.abs(b.specificEnergy_m2ps2 - at('specificEnergy_m2ps2', j)),
      M * 5 * u * scale,
    );
    chk(
      'a',
      Math.abs(b.semiMajorAxis_m - at('semiMajorAxis_m', j)),
      M * 5.5 * u * kE * Math.abs(b.semiMajorAxis_m),
    );
    chk('i', Math.abs(b.inclination_rad - inc), M * (4.3 * kH + 9.2) * u);
    chk('Ω', Math.abs(wrapPi(b.raan_rad - at('raan_rad', j))), M * (6.3 + (4.3 * kH) / sinI) * u);
    if (closed) {
      chk('e', Math.abs(b.eccentricity - e), M * 30 * u);
      chk(
        'ω',
        Math.abs(wrapPi(b.argPeriapsis_rad - at('argPeriapsis_rad', j))),
        M * (12 + 42.5 / e + (4.3 * kH) / sinI) * u,
      );
      chk(
        'ν',
        Math.abs(wrapPi(b.trueAnomaly_rad - at('trueAnomaly_rad', j))),
        M * (12 + 42.5 / e) * u,
      );
      // FR-010 AC3 rows (two-side formula as a bound for one binary64 side).
      const da = M * 11 * u * kE * b.semiMajorAxis_m;
      const de = M * 60 * u;
      chk(
        'r_p',
        Math.abs((b.periapsisRadius_m ?? NaN) - at('periapsisRadius_m', j)),
        da * (1 - e) + b.semiMajorAxis_m * de,
      );
      chk(
        'r_a',
        Math.abs((b.apoapsisRadius_m ?? NaN) - at('apoapsisRadius_m', j)),
        da * (1 + e) + b.semiMajorAxis_m * de,
      );
      chk(
        'T',
        Math.abs((b.period_s ?? NaN) - at('period_s', j)),
        at('period_s', j) * (1.5 * (da / b.semiMajorAxis_m) + 6 * u),
      );
    } else {
      chk('e (HP e-vector)', Math.abs(eccentricityEvectorHp(r, v, MU) - e), 2 * u * e);
      chk('e (binary64, sanity)', Math.abs(b.eccentricity - e), 1e-12);
      for (const k of ['periapsisRadius_m', 'apoapsisRadius_m', 'period_s']) {
        if (q[k]?.[j] !== null) f.push(`${name} j=${String(j)} ${k} not null on an open orbit`);
      }
    }
    if (nearThreshold(e, Math.min(inc, Math.PI - inc)))
      f.push(`${name} j=${String(j)} near threshold`);
    if (s.reference.convention[j] !== 'NONE') f.push(`${name} j=${String(j)} convention`);
    for (const [k, col] of Object.entries(s.tolerance)) {
      const t = col[j];
      if (t !== null && t !== undefined && !(t > 0 && Number.isFinite(t)))
        f.push(`${name} ${k} tol ${String(t)}`);
    }
  });
  return f;
}

function l2aCheck(s0: { position_m: V3; velocity_mps: V3 }, t0: number, s: Segment): number {
  const p = prepareL2a(s0, MU);
  let worst = 0;
  s.t_s.forEach((t, j) => {
    const x = propagateL2a(p, t - t0).state.position_m;
    const y = s.reference.position_m[j] ?? [NaN, NaN, NaN];
    worst = Math.max(worst, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]));
  });
  return worst;
}

describe('dataset vi-03-b (reference side)', () => {
  it('has the six cases', () => {
    expect(files.map((f) => f.name)).toEqual([
      'c4-normal.json',
      'c5-prograde.json',
      'default-combined.json',
      'default-escape.json',
      'default-tangential.json',
      'default.json',
    ]);
  });

  it.each(files)(
    '$name: grid, two-method reference values, classification, trajectory',
    ({ name, data }) => {
      const sc = data.inputs.scenario;
      const mTimes = sc.maneuvers.map((m) => m.t_s);
      const grid = samplingGridWithManeuvers(sc.duration_s, sc.outputStep_s, mTimes);
      expect(data.outputs.segments.map((s) => s.t_s)).toEqual(grid.segments);
      const f: string[] = [];
      for (const s of data.outputs.segments) f.push(...checkSegment(name, s));
      const coast = data.outputs.coast;
      if (mTimes.length > 0) {
        expect(coast).not.toBeNull();
        const cs = coast?.segments ?? [];
        expect(cs.map((s) => s.t_s)).toEqual(
          samplingGridWithManeuvers(sc.duration_s, sc.outputStep_s, []).segments,
        );
        for (const s of cs) f.push(...checkSegment(`${name} coast`, s));
      }
      expect(f).toEqual([]);
      const s0 = data.outputs.referenceInitialState;
      const seg0 = data.outputs.segments[0];
      if (seg0 === undefined) throw new Error('segment 0');
      expect(l2aCheck(s0, 0, seg0)).toBeLessThan(1e-3);
      const cmp = data.outputs.comparison;
      const seg1 = data.outputs.segments[1];
      if (cmp !== null && seg1 !== undefined && (seg1.reference.closed[0] ?? false)) {
        expect(l2aCheck(cmp.referencePost, mTimes[0] ?? NaN, seg1)).toBeLessThan(1e-3);
      }
    },
  );
});
