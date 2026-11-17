/**
 * Self-test of the VI-03 (b) / FR-010 AC3 comparison logic (support/vi03.ts) on SYNTHETIC inputs
 * (ML-TASK-036 phase 1): no engine run and no analysis-module call. A stand-in "module output" is
 * built from the reference itself on the dataset's reference states; the logic must pass it, and
 * must catch a value perturbed beyond its tolerance, a null in an asserted row, a wrong convention,
 * a non-copied t_s, a defined apoapsis on an open orbit and a wrong Δv. An angle shifted by 2π must
 * pass (modulo comparison).
 */
import type { ManeuverComparison, SegmentHistory } from '@mission-lab/simulation';
import { analysisReferenceHp, type AnalysisReference } from '@mission-lab/verification';
import { describe, expect, it } from 'vitest';
import { RatioRecorder } from './compare';
import { loadFamily, type V3 } from './datasets';
import {
  COMPARISON_ROWS,
  InfoRecorder,
  checkManeuverComparison,
  checkSegmentHistories,
  norm3,
  type ConstantsJson,
  type DatasetComparison,
  type DatasetSegment,
  type EngineSegment,
} from './vi03';

interface Ds {
  inputs: { constants: ConstantsJson };
  outputs: {
    segments: (DatasetSegment & { reference: { position_m: V3[]; velocity_mps: V3[] } })[];
    comparison:
      | (DatasetComparison & {
          referencePre: { position_m: V3; velocity_mps: V3 };
          referencePost: { position_m: V3; velocity_mps: V3 };
          referenceDeltaV_inertial_mps: V3;
        })
      | null;
  };
}

const sets = loadFamily('vi-03-b').map((d) => ({ file: d.file, data: d.data as Ds }));
const HQ = [
  'radius_m',
  'altitude_m',
  'speed_mps',
  'trueAnomaly_rad',
  'semiMajorAxis_m',
  'eccentricity',
  'inclination_rad',
  'raan_rad',
  'argPeriapsis_rad',
  'specificEnergy_m2ps2',
  'periapsisRadius_m',
  'apoapsisRadius_m',
  'period_s',
] as const;

function engineOf(seg: Ds['outputs']['segments'][number]): EngineSegment {
  return {
    t_s: Float64Array.from(seg.t_s),
    position_m: Float64Array.from(seg.reference.position_m.flat()),
    velocity_mps: Float64Array.from(seg.reference.velocity_mps.flat()),
  };
}

function fakeHistory(seg: Ds['outputs']['segments'][number], c: ConstantsJson): SegmentHistory {
  const refs = seg.t_s.map((_, j) =>
    analysisReferenceHp(
      seg.reference.position_m[j] ?? [NaN, NaN, NaN],
      seg.reference.velocity_mps[j] ?? [NaN, NaN, NaN],
      c,
    ),
  );
  const series = HQ.map((q) => ({
    quantity: q,
    unit: 'm' as const,
    segmentIndex: seg.segmentIndex,
    t_s: [...seg.t_s],
    values: refs.map((r) => r[q]),
  }));
  return {
    segmentIndex: seg.segmentIndex,
    t_s: [...seg.t_s],
    series,
    convention: refs.map((r) => r.convention),
    conic: refs.map(() => null),
    elementsFailure: refs.map(() => null),
    specificEnergyFailure: refs.map(() => null),
    closedOrbitFailure: refs.map((r) => (r.closed ? null : 'NOT_CLOSED_ORBIT')),
  };
}

function mutate(
  h: SegmentHistory,
  q: string,
  j: number,
  f: (x: number | null) => number | null,
): SegmentHistory {
  return {
    ...h,
    series: h.series.map((s) =>
      s.quantity === q ? { ...s, values: s.values.map((x, k) => (k === j ? f(x) : x)) } : s,
    ),
  };
}

const run = (
  h: SegmentHistory,
  e: EngineSegment,
  seg: DatasetSegment,
  c: ConstantsJson,
): string[] =>
  checkSegmentHistories('t', h, e, seg, c, new RatioRecorder('self-test'), new InfoRecorder());

describe('VI-03 (b) comparison logic on synthetic inputs (no engine, no analysis module)', () => {
  it('loads the six datasets', () => {
    expect(sets).toHaveLength(6);
  });

  it.each(sets)('$file: reference-as-module passes; perturbations are caught', ({ data }) => {
    const c = data.inputs.constants;
    for (const seg of data.outputs.segments) {
      const e = engineOf(seg);
      const h = fakeHistory(seg, c);
      expect(run(h, e, seg, c)).toEqual([]);
      const j = Math.floor(seg.t_s.length / 2);
      // An angle shifted by exactly 2π passes (modulo comparison).
      expect(
        run(
          mutate(h, 'inclination_rad', j, (x) => x),
          e,
          seg,
          c,
        ),
      ).toEqual([]);
      const tolR = seg.tolerance.raan_rad[j] ?? NaN;
      expect(
        run(
          mutate(h, 'raan_rad', j, (x) => (x ?? 0) + 2 * Math.PI),
          e,
          seg,
          c,
        ),
      ).toEqual([]);
      // Perturbations beyond the tolerance are failures.
      for (const q of [
        'radius_m',
        'semiMajorAxis_m',
        'inclination_rad',
        'specificEnergy_m2ps2',
      ] as const) {
        const tol = seg.tolerance[q][j] ?? NaN;
        expect(
          run(
            mutate(h, q, j, (x) => (x ?? 0) + 3 * tol),
            e,
            seg,
            c,
          ).length,
        ).toBe(1);
        expect(
          run(
            mutate(h, q, j, (x) => (x ?? 0) + 0.5 * tol),
            e,
            seg,
            c,
          ),
        ).toEqual([]);
      }
      expect(
        run(
          mutate(h, 'raan_rad', j, (x) => (x ?? 0) + 3 * tolR),
          e,
          seg,
          c,
        ).length,
      ).toBe(1);
      expect(
        run(
          mutate(h, 'radius_m', j, () => null),
          e,
          seg,
          c,
        ).length,
      ).toBe(1);
      // Wrong convention, non-copied t_s, engine grid different from the dataset.
      const conv = [...h.convention];
      conv[j] = 'CIRCULAR';
      expect(run({ ...h, convention: conv }, e, seg, c).length).toBe(1);
      const badT = {
        ...h,
        series: h.series.map((s, k) => (k === 0 ? { ...s, t_s: s.t_s.map((t) => t + 1) } : s)),
      };
      expect(run(badT, e, seg, c).length).toBe(1);
      const e2 = { ...e, t_s: Float64Array.from(seg.t_s.map((t, k) => (k === 1 ? t + 1e-9 : t))) };
      expect(run(h, e2, seg, c).length).toBe(1);
      // Open-orbit samples: a defined apoapsis is a failure; e is not asserted.
      const open = seg.reference.closed.findIndex((x) => !x);
      if (open >= 0) {
        expect(seg.tolerance.eccentricity[open]).toBeNull();
        expect(
          run(
            mutate(h, 'apoapsisRadius_m', open, () => 1),
            e,
            seg,
            c,
          ).length,
        ).toBe(1);
        expect(
          run(
            mutate(h, 'eccentricity', open, (x) => (x ?? 0) + 1),
            e,
            seg,
            c,
          ),
        ).toEqual([]);
      } else {
        expect(
          run(
            mutate(h, 'period_s', j, () => null),
            e,
            seg,
            c,
          ).length,
        ).toBe(1);
      }
    }
  });

  const withCmp = sets.filter((s) => s.data.outputs.comparison !== null);
  it.each(withCmp)('$file: comparison logic', ({ data }) => {
    const c = data.inputs.constants;
    const cmp = data.outputs.comparison;
    if (cmp === null) throw new Error('comparison');
    const pre = cmp.referencePre;
    const post = cmp.referencePost;
    const dvI = cmp.referenceDeltaV_inertial_mps;
    const event = {
      maneuverId: 'm1',
      t_s: cmp.maneuverTime_s,
      position_m: pre.position_m,
      velocityBefore_mps: pre.velocity_mps,
      velocityAfter_mps: post.velocity_mps,
      deltaV_inertial_mps: dvI,
      deltaV_magnitude_mps: norm3(dvI),
    };
    const qb = analysisReferenceHp(pre.position_m, pre.velocity_mps, c);
    const qa = analysisReferenceHp(post.position_m, post.velocity_mps, c);
    const val = (q: AnalysisReference, k: (typeof COMPARISON_ROWS)[number]): number | null => q[k];
    const rows = COMPARISON_ROWS.map((k) => {
      const b = val(qb, k);
      const a = val(qa, k);
      return {
        quantity: k,
        unit: 'm',
        before: b,
        after: a,
        difference: a === null || b === null ? null : a - b,
        absent: a === null ? { after: 'NOT_CLOSED_ORBIT', difference: 'OPERAND_UNAVAILABLE' } : {},
      };
    });
    const mc = {
      maneuverId: 'm1',
      t_s: cmp.maneuverTime_s,
      before: { convention: qb.convention, conic: null },
      after: { convention: qa.convention, conic: null },
      rows,
      deltaV: { inertial_mps: dvI, rsw_mps: cmp.deltaV_rsw_mps, magnitude_mps: norm3(dvI) },
    } as unknown as ManeuverComparison;
    const go = (m: ManeuverComparison, ev = event): string[] =>
      checkManeuverComparison(
        't',
        m,
        ev,
        cmp.deltaV_rsw_mps,
        cmp,
        c,
        new RatioRecorder('x'),
        new InfoRecorder(),
      );
    expect(go(mc)).toEqual([]);
    const tA = cmp.tolerance.rows.semiMajorAxis_m.after.value ?? NaN;
    const bad = {
      ...mc,
      rows: mc.rows.map((r) =>
        r.quantity === 'semiMajorAxis_m' ? { ...r, after: (r.after ?? 0) + 3 * tA } : r,
      ),
    } as ManeuverComparison;
    // after fails (the stand-in difference row is left unchanged, so it still passes).
    expect(go(bad).length).toBe(1);
    const badDiff = {
      ...mc,
      rows: mc.rows.map((r) =>
        r.quantity === 'semiMajorAxis_m' ? { ...r, difference: (r.difference ?? 0) + 3 * tA } : r,
      ),
    } as ManeuverComparison;
    expect(go(badDiff).length).toBe(1);
    const badDv = {
      ...mc,
      deltaV: { ...mc.deltaV, inertial_mps: [dvI[0] + 1e-6, dvI[1], dvI[2]] },
    } as unknown as ManeuverComparison;
    expect(go(badDv).length).toBeGreaterThanOrEqual(2); // not the event copy + VT-12 value
    if (!cmp.after.closed) {
      const badT = {
        ...mc,
        rows: mc.rows.map((r) => (r.quantity === 'period_s' ? { ...r, after: 1, absent: {} } : r)),
      } as unknown as ManeuverComparison;
      expect(go(badT).length).toBeGreaterThanOrEqual(1);
    }
  });
});
