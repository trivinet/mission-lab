/**
 * Comparison logic of the VI-03 (b) / ML-FR-010 AC3 conformance test (ML-TASK-036). Test-side only:
 * it computes no tolerance (all come from the committed vi-03-b datasets) and calls the analysis
 * module nowhere; the caller passes the module's outputs in. Kept separate so that the logic is
 * itself tested before any run of the analysis module (vi03.test.ts, synthetic inputs).
 *
 * Reference: analysisReferenceHp from @mission-lab/verification, evaluated by the test on the
 * ENGINE's state of each sample / event (§8 VI-03 (b): "independent recomputation by the test from
 * the same state"). Angles (Ω, ω, ν) are compared modulo 2π: the difference is reduced to (−π, π].
 */
import type { SegmentHistory, ManeuverComparison } from '@mission-lab/simulation';
import { analysisReferenceHp, rswToInertialHp, wrapPi } from '@mission-lab/verification';
import type { AnalysisReference } from '@mission-lab/verification';
import { RatioRecorder, diffNorm, fmt } from './compare';
import type { V3 } from './datasets';

/** Test-side binary64 norm (the VT-13 budget counts it). Local so that this file loads no engine code. */
export function norm3(a: readonly number[]): number {
  const x = a[0] ?? NaN;
  const y = a[1] ?? NaN;
  const z = a[2] ?? NaN;
  return Math.sqrt(x * x + y * y + z * z);
}

export const VI03_ROWS = [
  'radius_m',
  'altitude_m',
  'speed_mps',
  'specificEnergy_m2ps2',
  'semiMajorAxis_m',
  'eccentricity',
  'inclination_rad',
  'raan_rad',
  'argPeriapsis_rad',
  'trueAnomaly_rad',
] as const;
export type Vi03Row = (typeof VI03_ROWS)[number];

export const ANGLE_ROWS: ReadonlySet<string> = new Set([
  'raan_rad',
  'argPeriapsis_rad',
  'trueAnomaly_rad',
]);

export const COMPARISON_ROWS = [
  'semiMajorAxis_m',
  'eccentricity',
  'inclination_rad',
  'raan_rad',
  'argPeriapsis_rad',
  'periapsisRadius_m',
  'apoapsisRadius_m',
  'period_s',
  'specificEnergy_m2ps2',
] as const;
type ComparisonKey = (typeof COMPARISON_ROWS)[number];

export interface ConstantsJson {
  readonly mu_m3ps2: number;
  readonly referenceRadius_m: number;
}

export interface DatasetSegment {
  readonly segmentIndex: number;
  readonly t_s: readonly number[];
  readonly reference: {
    readonly closed: readonly boolean[];
    readonly convention: readonly string[];
  };
  readonly tolerance: Record<Vi03Row, readonly (number | null)[]>;
}

interface TolJson {
  readonly value: number | null;
  readonly reason?: string;
}

export interface DatasetComparison {
  readonly maneuverTime_s: number;
  readonly deltaV_rsw_mps: V3;
  readonly before: { readonly closed: boolean; readonly convention: string };
  readonly after: { readonly closed: boolean; readonly convention: string };
  readonly tolerance: {
    readonly rows: Record<
      ComparisonKey,
      { readonly before: TolJson; readonly after: TolJson; readonly difference: TolJson }
    >;
    readonly deltaV: {
      readonly inertial_mps: number;
      readonly magnitude_mps: number;
      readonly magnitudeVsRsw_mps: number;
    };
  };
}

/** Engine samples of one result segment (columnar, contracts-v1 §5). */
export interface EngineSegment {
  readonly t_s: ArrayLike<number>;
  readonly position_m: ArrayLike<number>;
  readonly velocity_mps: ArrayLike<number>;
}

/** Largest |difference| per informative (not asserted) quantity, for the run report. */
export class InfoRecorder {
  readonly entries = new Map<string, { max: number; where: string; count: number }>();
  record(quantity: string, diff: number, where: string): void {
    const e = this.entries.get(quantity) ?? { max: -1, where: '', count: 0 };
    e.count += 1;
    if (diff > e.max || Number.isNaN(diff)) {
      e.max = diff;
      e.where = where;
    }
    this.entries.set(quantity, e);
  }
  summary(title: string): string {
    const lines = [`[conformance] ${title}: informative (not asserted), max |difference|`];
    for (const [q, e] of [...this.entries.entries()].sort()) {
      lines.push(`  ${q}: max ${e.max.toPrecision(4)} at ${e.where}; ${String(e.count)} values`);
    }
    return lines.join('\n');
  }
}

function diffOf(row: string, module: number, reference: number): number {
  return ANGLE_ROWS.has(row) ? Math.abs(wrapPi(module - reference)) : Math.abs(module - reference);
}

function seriesValues(h: SegmentHistory, q: string): readonly (number | null)[] {
  const s = h.series.find((x) => x.quantity === q);
  if (s === undefined) throw new Error(`no series ${q}`);
  return s.values;
}

function stateAt(e: EngineSegment, j: number): { r: V3; v: V3 } {
  const p = e.position_m;
  const v = e.velocity_mps;
  return {
    r: [p[3 * j] ?? NaN, p[3 * j + 1] ?? NaN, p[3 * j + 2] ?? NaN],
    v: [v[3 * j] ?? NaN, v[3 * j + 1] ?? NaN, v[3 * j + 2] ?? NaN],
  };
}

/**
 * VI-03 (b) on one segment. Returns the failures (empty = pass). Asserted: every row whose
 * committed tolerance is non-null; the per-sample convention (discrete); r_a and T null exactly on
 * open samples ('NOT_CLOSED_ORBIT') and r_p, r_a, T non-null on closed samples. Preconditions
 * (exact): engine t_s = dataset t_s, every series t_s = engine t_s (bit-identical copies).
 */
export function checkSegmentHistories(
  where: string,
  h: SegmentHistory,
  engine: EngineSegment,
  ds: DatasetSegment,
  constants: ConstantsJson,
  rec: RatioRecorder,
  info: InfoRecorder,
): string[] {
  const f: string[] = [];
  const n = ds.t_s.length;
  if (engine.t_s.length !== n)
    return [`${where}: ${String(engine.t_s.length)} samples, dataset ${String(n)}`];
  for (let j = 0; j < n; j++) {
    if (!Object.is(engine.t_s[j], ds.t_s[j]))
      return [`${where}: engine t_s[${String(j)}] differs from the dataset`];
  }
  if (h.segmentIndex !== ds.segmentIndex)
    f.push(`${where}: segmentIndex ${String(h.segmentIndex)}`);
  for (const s of h.series) {
    if (s.t_s.length !== n || s.t_s.some((t, j) => !Object.is(t, engine.t_s[j]))) {
      f.push(`${where}: series ${s.quantity} t_s is not a bit-identical copy`);
    }
  }
  for (let j = 0; j < n; j++) {
    const { r, v } = stateAt(engine, j);
    const ref: AnalysisReference = analysisReferenceHp(r, v, constants);
    const at = `${where} t=${String(ds.t_s[j])}`;
    for (const q of VI03_ROWS) {
      const tol = ds.tolerance[q][j];
      const m = seriesValues(h, q)[j];
      if (tol === null || tol === undefined) {
        if (typeof m === 'number') info.record(`${q} (open orbit)`, diffOf(q, m, ref[q]), at);
        continue;
      }
      if (typeof m !== 'number') {
        f.push(`${at} ${q}: module value is null, asserted row`);
        continue;
      }
      const d = diffOf(q, m, ref[q]);
      const ratio = rec.record(q, d, tol, at);
      if (!(d <= tol)) {
        f.push(
          `${at} ${q}: module ${String(m)} ref ${String(ref[q])} |Δ| ${fmt(d)} > ${fmt(tol)} (×${ratio.toPrecision(3)})`,
        );
      }
    }
    // Discrete: classification (no sample of the datasets is near a threshold).
    if (h.convention[j] !== ds.reference.convention[j]) {
      f.push(
        `${at}: convention ${String(h.convention[j])}, reference ${String(ds.reference.convention[j])}`,
      );
    }
    // Definedness of r_p, r_a, T (values themselves: no VI-03 (b) row, informative).
    const closed = ds.reference.closed[j] ?? true;
    for (const q of ['periapsisRadius_m', 'apoapsisRadius_m', 'period_s'] as const) {
      const m = seriesValues(h, q)[j];
      const rv = ref[q];
      if (closed) {
        if (typeof m !== 'number') f.push(`${at} ${q}: null on a closed orbit`);
        else if (rv !== null)
          info.record(`${q} (history, relative)`, Math.abs(m - rv) / Math.abs(rv), at);
      } else if (q !== 'periapsisRadius_m') {
        if (m !== null) f.push(`${at} ${q}: defined on an open orbit`);
        if (h.closedOrbitFailure[j] !== 'NOT_CLOSED_ORBIT') {
          f.push(`${at}: closedOrbitFailure ${String(h.closedOrbitFailure[j])}`);
        }
      } else if (typeof m === 'number' && rv !== null) {
        info.record('periapsisRadius_m (open orbit)', Math.abs(m - rv), at);
      }
    }
  }
  return f;
}

/** Reference value of a comparison row (r_p, r_a, T null on an open orbit). */
function refRow(q: AnalysisReference, k: ComparisonKey): number | null {
  return q[k];
}

/**
 * FR-010 AC3 on one maneuver comparison: before/after/difference against the reference from the
 * engine's R8 event states, and the applied Δv (VT-12, VT-13; copies exact).
 */
export function checkManeuverComparison(
  where: string,
  mc: ManeuverComparison,
  event: {
    readonly maneuverId: string;
    readonly t_s: number;
    readonly position_m: V3;
    readonly velocityBefore_mps: V3;
    readonly velocityAfter_mps: V3;
    readonly deltaV_inertial_mps: V3;
    readonly deltaV_magnitude_mps: number;
  },
  requestDeltaV_rsw: V3,
  ds: DatasetComparison,
  constants: ConstantsJson,
  rec: RatioRecorder,
  info: InfoRecorder,
): string[] {
  const f: string[] = [];
  if (mc.maneuverId !== event.maneuverId) f.push(`${where}: maneuverId`);
  if (!Object.is(mc.t_s, event.t_s) || !Object.is(mc.t_s, ds.maneuverTime_s))
    f.push(`${where}: t_s`);
  const qb = analysisReferenceHp(event.position_m, event.velocityBefore_mps, constants);
  const qa = analysisReferenceHp(event.position_m, event.velocityAfter_mps, constants);
  if (mc.before.convention !== ds.before.convention)
    f.push(`${where}: before convention ${String(mc.before.convention)}`);
  if (mc.after.convention !== ds.after.convention)
    f.push(`${where}: after convention ${String(mc.after.convention)}`);
  if (mc.rows.length !== COMPARISON_ROWS.length) f.push(`${where}: ${String(mc.rows.length)} rows`);
  for (const k of COMPARISON_ROWS) {
    const row = mc.rows.find((x) => x.quantity === k);
    if (row === undefined) {
      f.push(`${where}: no row ${k}`);
      continue;
    }
    const t = ds.tolerance.rows[k];
    const rb = refRow(qb, k);
    const ra = refRow(qa, k);
    const rd = rb === null || ra === null ? null : ANGLE_ROWS.has(k) ? wrapPi(ra - rb) : ra - rb;
    const parts: [string, number | null, number | null, TolJson][] = [
      ['before', row.before, rb, t.before],
      ['after', row.after, ra, t.after],
      ['difference', row.difference, rd, t.difference],
    ];
    for (const [part, m, r, tol] of parts) {
      const at = `${where} ${k}.${part}`;
      if (tol.value === null) {
        if (typeof m === 'number' && r !== null)
          info.record(`${k}.${part}`, diffOf(k, m, r), where);
        continue;
      }
      if (typeof m !== 'number' || r === null) {
        f.push(`${at}: module ${String(m)} reference ${String(r)}, asserted row`);
        continue;
      }
      const d = diffOf(k, m, r);
      const ratio = rec.record(`${k}.${part}`, d, tol.value, where);
      if (!(d <= tol.value)) {
        f.push(
          `${at}: module ${String(m)} ref ${String(r)} |Δ| ${fmt(d)} > ${fmt(tol.value)} (×${ratio.toPrecision(3)})`,
        );
      }
    }
    // Open post-maneuver orbit: apoapsis and period do not exist (asserted, discrete).
    if (!ds.after.closed && (k === 'apoapsisRadius_m' || k === 'period_s')) {
      if (row.after !== null || row.absent.after !== 'NOT_CLOSED_ORBIT') {
        f.push(
          `${where} ${k}.after: ${String(row.after)} (${String(row.absent.after)}) on an open orbit`,
        );
      }
      if (row.difference !== null) f.push(`${where} ${k}.difference defined on an open orbit`);
    }
  }
  // Applied Δv: copies (exact) and values (VT-12, VT-13).
  const d = mc.deltaV;
  for (let i = 0; i < 3; i++) {
    if (!Object.is(d.inertial_mps[i], event.deltaV_inertial_mps[i]))
      f.push(`${where}: Δv inertial not the event copy`);
    if (!Object.is(d.rsw_mps[i], requestDeltaV_rsw[i]))
      f.push(`${where}: Δv RSW not the request copy`);
  }
  if (!Object.is(d.magnitude_mps, event.deltaV_magnitude_mps))
    f.push(`${where}: |Δv| not the event copy`);
  const refI = rswToInertialHp(event.position_m, event.velocityBefore_mps, requestDeltaV_rsw);
  const dI = diffNorm([d.inertial_mps[0], d.inertial_mps[1], d.inertial_mps[2]], refI);
  const tI = ds.tolerance.deltaV.inertial_mps;
  rec.record('deltaV.inertial (VT-12)', dI, tI, where);
  if (!(dI <= tI)) f.push(`${where}: Δv inertial ‖Δ‖ ${fmt(dI)} > ${fmt(tI)}`);
  const dM = Math.abs(
    d.magnitude_mps - norm3([d.inertial_mps[0], d.inertial_mps[1], d.inertial_mps[2]]),
  );
  const tM = ds.tolerance.deltaV.magnitude_mps;
  rec.record('deltaV.magnitude (VT-13)', dM, tM, where);
  if (!(dM <= tM)) f.push(`${where}: |Δv| vs ‖Δv_I‖ ${fmt(dM)} > ${fmt(tM)}`);
  const dR = Math.abs(d.magnitude_mps - norm3(requestDeltaV_rsw));
  const tR = ds.tolerance.deltaV.magnitudeVsRsw_mps;
  rec.record('deltaV.magnitude vs ‖Δv_RSW‖ (VT-13)', dR, tR, where);
  if (!(dR <= tR)) f.push(`${where}: |Δv| vs ‖Δv_RSW‖ ${fmt(dR)} > ${fmt(tR)}`);
  return f;
}
