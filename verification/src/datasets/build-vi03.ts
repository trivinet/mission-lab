/**
 * Reference datasets of ML-TASK-036 phase 1: VI-03 (b) (analysis histories, ML-FR-009) and
 * ML-FR-010 AC3 (coast-vs-maneuver comparison table), tolerance record revision 5 (approved by the
 * owner on 2026-11-16) §8 VI-03 (b), §7 VT-15 "FR-010 AC3", §7 VT-12, §7 VT-13.
 * New files only (`vi-03-b/`), committed before any run of the analysis module on them (§4.1).
 *
 * Per case: the scenario (input to buildSimulationRequest / buildCoastRequest), the constants the
 * dataset assumes, and, per result segment (and for the coast run), the §5.2 sample times, the
 * REFERENCE trajectory at those times, the reference quantities of each reference state
 * (analysis.ts method H) and the per-sample tolerances evaluated from them (§4.1 item 2). For a
 * maneuver case also the reference pre- and post-maneuver states and the comparison-table
 * tolerances (before, after, difference; applied Δv).
 *
 * What the conformance test does with it (conformance/src/vi03-analysis.test.ts): the analysis
 * outputs for the ENGINE's states are compared with the reference recomputed by the test from the
 * same engine states (§8 VI-03 (b): "independent recomputation by the test from the same state");
 * the tolerances are those committed here. The reference trajectory is used only to size the
 * tolerances and to classify samples; it is never compared with the engine here.
 *
 * Reference trajectory: initial state from the scenario elements in 200-bit arithmetic
 * (hpElementsToState, rounded once); elliptic arcs by the 200-bit classical Kepler method
 * (hp-kepler.ts), hyperbolic arcs by the 200-bit hyperbolic Kepler method (hyperbolic.ts); the burn
 * applied exactly (320-bit RSW basis, rswToInertialB) to the reference pre-maneuver state.
 *
 * Independence: written without reading packages/astrodynamics or packages/simulation (ADR-003).
 */
import type { Scenario } from '@mission-lab/contracts';
import { add, fromNumber, toNumber } from '../hp/bigfloat';
import { hpElementsToState, hpPrepare, hpPropagate } from '../hp/hp-kepler';
import { toV3 } from '../hp/hp-vec';
import { analysisReferenceHp, type AnalysisReference } from '../ref/analysis';
import type { Elements } from '../ref/elements';
import { samplingGridWithManeuvers } from '../ref/grid';
import { hypPrepare, hypPropagate } from '../ref/hyperbolic';
import { rswToInertialB } from '../ref/rsw';
import type { V3 } from '../ref/vec';
import {
  REASON,
  VI03_QUANTITIES,
  differenceTolerance,
  fr010ClosedTolerances,
  kappaHOfOrbit,
  vi03Tolerances,
  vt12InertialDeltaV,
  vt13Magnitude,
  vt13MagnitudeVsRsw,
  type Tol,
  type Vi03Quantity,
} from '../tol/tolerances-vi03';
import { CONSTANTS, type DatasetFile, type Provenance } from './build';
import { GRID } from './cases';

const MU = CONSTANTS.mu_m3ps2;
const RECORD_VI03 =
  'docs/verification/tolerances.md revision 5 (approved by the owner on 2026-11-16): §8 VI-03 (b), §7 VT-15 (FR-010 AC3 rows), §7 VT-12, §7 VT-13, §10 thresholds';
const STATUS =
  'New dataset (tolerances.md §4.1 item 1), committed before any run of the analysis module on it (ML-TASK-036 phase 1). Not yet reviewed or approved; immutable once approved, corrections create a new version (plan §6).';
const EPOCH = { scale: 'UTC', iso: '2026-01-01T00:00:00.000Z' } as const;

/** −0 → +0 (JSON cannot carry the sign of zero; not significant here). */
function z(x: number): number {
  return x === 0 ? 0 : x;
}
function zv(v: readonly number[]): V3 {
  return [z(v[0] ?? NaN), z(v[1] ?? NaN), z(v[2] ?? NaN)];
}

function el(a: number, e: number, i: number, raan: number, argp: number, nu: number): Elements {
  return {
    semiMajorAxis_m: a,
    eccentricity: e,
    inclination_rad: i,
    raan_rad: raan,
    argPeriapsis_rad: argp,
    trueAnomaly_rad: nu,
  };
}

function gridElements(id: string): Elements {
  const g = GRID.find((x) => x.id === id);
  if (g === undefined) throw new Error(id);
  return g.elements;
}

/**
 * Default scenario values of ML-FR-001 AC1 as documented in apps/web/src/state/default-scenario.ts
 * (a product default, not a reference value): a = 7 000 000 m, e = 0.01, i = π/4, Ω = ω = ν = 0,
 * duration 6000 s, step 60 s.
 */
const DEFAULT_ELEMENTS = el(7_000_000, 0.01, Math.PI / 4, 0, 0, 0);

export interface Vi03Case {
  readonly id: string;
  readonly description: string;
  readonly elements: Elements;
  readonly duration_s: number;
  readonly outputStep_s: number;
  readonly maneuver: { readonly t_s: number; readonly deltaV_mps: V3 } | null;
}

export const VI03_CASES: readonly Vi03Case[] = [
  {
    id: 'default',
    description: 'Default scenario (ML-FR-001 AC1 values), no maneuver',
    elements: DEFAULT_ELEMENTS,
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: null,
  },
  {
    id: 'default-tangential',
    description: 'Default scenario with a tangential burn +100 m/s along S at t = 3000 s',
    elements: DEFAULT_ELEMENTS,
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 3000, deltaV_mps: [0, 100, 0] },
  },
  {
    id: 'default-combined',
    description: 'Default scenario with a non-tangential burn (30, −60, 45) m/s RSW at t = 1500 s',
    elements: DEFAULT_ELEMENTS,
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 1500, deltaV_mps: [30, -60, 45] },
  },
  {
    id: 'c4-normal',
    description:
      'Grid C4 (a = 1.2e7 m, e = 0.4, i = 0.5): inclined eccentric orbit, normal burn −150 m/s W at t = 6000 s',
    elements: gridElements('c4-moderate-inclined'),
    duration_s: 13200,
    outputStep_s: 120,
    maneuver: { t_s: 6000, deltaV_mps: [0, 0, -150] },
  },
  {
    id: 'c5-prograde',
    description:
      'Grid C5 (a = 2.6e7 m, e = 0.74, i = 1.1): Molniya-like orbit, +50 m/s along S at t = 20000 s (near apogee)',
    elements: gridElements('c5-molniya'),
    duration_s: 42000,
    outputStep_s: 300,
    maneuver: { t_s: 20000, deltaV_mps: [0, 50, 0] },
  },
  {
    id: 'default-escape',
    description:
      'Default scenario with +3500 m/s along S at t = 600 s: hyperbolic post-maneuver segment',
    elements: DEFAULT_ELEMENTS,
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 600, deltaV_mps: [0, 3500, 0] },
  },
];

export function scenarioOf(c: Vi03Case): Scenario {
  return {
    schemaVersion: '1.0',
    id: `vi-03-b-${c.id}`,
    name: `VI-03 (b) ${c.id}`,
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: EPOCH,
    initialOrbit: { kind: 'KEPLERIAN', elements: c.elements },
    maneuvers:
      c.maneuver === null
        ? []
        : [{ id: 'm1', t_s: c.maneuver.t_s, frame: 'RSW', deltaV_mps: c.maneuver.deltaV_mps }],
    duration_s: c.duration_s,
    outputStep_s: c.outputStep_s,
  };
}

interface RefState {
  readonly r: V3;
  readonly v: V3;
}

/** Reference arc from a binary64 state at t0, evaluated at each time (elliptic or hyperbolic). */
function propagateArc(s0: RefState, t0: number, times: readonly number[]): RefState[] {
  const q = analysisReferenceHp(s0.r, s0.v, CONSTANTS);
  if (q.closed) {
    const pr = hpPrepare(s0.r, s0.v, MU);
    return times.map((t) => {
      const s = hpPropagate(pr, t - t0);
      return { r: zv(toV3(s.position_m)), v: zv(toV3(s.velocity_mps)) };
    });
  }
  const pr = hypPrepare(s0.r, s0.v, MU);
  return times.map((t) => {
    const s = hypPropagate(pr, t - t0);
    return { r: zv(toV3(s.position_m)), v: zv(toV3(s.velocity_mps)) };
  });
}

const HISTORY_REF_KEYS = [
  ...VI03_QUANTITIES,
  'periapsisRadius_m',
  'apoapsisRadius_m',
  'period_s',
] as const;

function tolOf(q: AnalysisReference): Record<Vi03Quantity, Tol> {
  return vi03Tolerances(q);
}

/** Segment record: times, reference states and quantities, per-sample tolerances. */
function segmentRecord(segmentIndex: number, times: readonly number[], states: RefState[]) {
  const qs = states.map((s) => analysisReferenceHp(s.r, s.v, CONSTANTS));
  const tols = qs.map(tolOf);
  const referenceQuantities: Record<string, (number | null)[]> = {};
  for (const k of HISTORY_REF_KEYS) referenceQuantities[k] = qs.map((q) => q[k]);
  const tolerance: Record<string, (number | null)[]> = {};
  const notAsserted: Record<string, string[]> = {};
  for (const k of VI03_QUANTITIES) {
    tolerance[k] = tols.map((t) => t[k].value);
    const reasons = [...new Set(tols.map((t) => t[k].reason).filter((x) => x !== undefined))];
    if (reasons.length > 0) notAsserted[k] = reasons;
  }
  for (const k of ['periapsisRadius_m', 'apoapsisRadius_m', 'period_s']) {
    notAsserted[k] = [REASON.noHistoryRow];
  }
  return {
    segmentIndex,
    t_s: [...times],
    reference: {
      position_m: states.map((s) => s.r),
      velocity_mps: states.map((s) => s.v),
      closed: qs.map((q) => q.closed),
      convention: qs.map((q) => q.convention),
      kappaE: qs.map((q) => q.kappaE),
      kappaH: qs.map((q) => q.kappaH),
      quantities: referenceQuantities,
    },
    tolerance,
    notAsserted,
  };
}

function toleranceJson(t: Tol): { value: number | null; reason?: string } {
  return t.reason === undefined ? { value: t.value } : { value: t.value, reason: t.reason };
}

const COMPARISON_KEYS = [
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

function comparisonTols(q: AnalysisReference): Record<(typeof COMPARISON_KEYS)[number], Tol> {
  const t = vi03Tolerances(q);
  const c = fr010ClosedTolerances(q, t, q.period_s);
  return {
    semiMajorAxis_m: t.semiMajorAxis_m,
    eccentricity: t.eccentricity,
    inclination_rad: t.inclination_rad,
    raan_rad: t.raan_rad,
    argPeriapsis_rad: t.argPeriapsis_rad,
    periapsisRadius_m: c.periapsisRadius_m,
    apoapsisRadius_m: c.apoapsisRadius_m,
    period_s: c.period_s,
    specificEnergy_m2ps2: t.specificEnergy_m2ps2,
  };
}

function quantitiesJson(q: AnalysisReference): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of HISTORY_REF_KEYS) out[k] = q[k];
  out.convention = q.convention;
  out.closed = q.closed;
  out.kappaE = q.kappaE;
  out.kappaH = q.kappaH;
  return out;
}

export function buildVi03Case(c: Vi03Case): Record<string, unknown> {
  const s0hp = hpElementsToState(c.elements, MU);
  const s0: RefState = { r: zv(toV3(s0hp.position_m)), v: zv(toV3(s0hp.velocity_mps)) };
  const mTimes = c.maneuver === null ? [] : [c.maneuver.t_s];
  const grid = samplingGridWithManeuvers(c.duration_s, c.outputStep_s, mTimes);
  const seg0Times = grid.segments[0] ?? [];
  const seg0 = propagateArc(s0, 0, seg0Times);
  const segments = [segmentRecord(0, seg0Times, seg0)];
  let comparison: Record<string, unknown> | null = null;
  let coast: Record<string, unknown> | null = null;
  if (c.maneuver !== null) {
    const tm = c.maneuver.t_s;
    const pre = propagateArc(s0, 0, [tm])[0];
    if (pre === undefined) throw new Error('pre');
    const dvI = rswToInertialB(pre.r, pre.v, c.maneuver.deltaV_mps);
    const vPost = zv([
      toNumber(add(fromNumber(pre.v[0]), dvI[0])),
      toNumber(add(fromNumber(pre.v[1]), dvI[1])),
      toNumber(add(fromNumber(pre.v[2]), dvI[2])),
    ]);
    const post: RefState = { r: pre.r, v: vPost };
    const seg1Times = grid.segments[1] ?? [];
    segments.push(segmentRecord(1, seg1Times, propagateArc(post, tm, seg1Times)));

    const qb = analysisReferenceHp(pre.r, pre.v, CONSTANTS);
    const qa = analysisReferenceHp(post.r, post.v, CONSTANTS);
    const tb = comparisonTols(qb);
    const ta = comparisonTols(qa);
    const rows: Record<string, unknown> = {};
    for (const k of COMPARISON_KEYS) {
      rows[k] = {
        before: toleranceJson(tb[k]),
        after: toleranceJson(ta[k]),
        difference: toleranceJson(differenceTolerance(tb[k], ta[k])),
      };
    }
    const dv = c.maneuver.deltaV_mps;
    const dvNorm = Math.hypot(dv[0], dv[1], dv[2]);
    const kh = kappaHOfOrbit(qb.eccentricity);
    comparison = {
      maneuverTime_s: tm,
      deltaV_rsw_mps: dv,
      referencePre: { position_m: pre.r, velocity_mps: pre.v },
      referencePost: { position_m: post.r, velocity_mps: post.v },
      referenceDeltaV_inertial_mps: zv(toV3(dvI)),
      before: quantitiesJson(qb),
      after: quantitiesJson(qa),
      tolerance: {
        rows,
        deltaV: {
          kappaH_pre: kh,
          inertial_mps: vt12InertialDeltaV(kh, dvNorm),
          magnitude_mps: vt13Magnitude(dvNorm),
          magnitudeVsRsw_mps: vt13MagnitudeVsRsw(kh, dvNorm),
        },
      },
    };
    // Coast run of the same scenario (buildCoastRequest): one segment over the whole span.
    const coastTimes =
      samplingGridWithManeuvers(c.duration_s, c.outputStep_s, []).segments[0] ?? [];
    coast = { segments: [segmentRecord(0, coastTimes, propagateArc(s0, 0, coastTimes))] };
  }
  return {
    referenceInitialState: { position_m: s0.r, velocity_mps: s0.v },
    segments,
    coast,
    comparison,
  };
}

function producedBy(prov: Provenance): Record<string, unknown> {
  return {
    tool: '@mission-lab/verification (ML-TASK-036), verification/src/datasets/build-vi03.ts',
    references: [
      'Quantities: verification/src/ref/analysis.ts method H (200-bit polar formulation, ADR-008 convention), cross-checked by method B (binary64 e-vector form) in analysis.test.ts',
      'Trajectory: hpElementsToState, hp-kepler.ts (elliptic), hyperbolic.ts (hyperbolic), rswToInertialB (burn), samplingGridWithManeuvers (§5.2 grid)',
      'Tolerances: verification/src/tol/tolerances-vi03.ts (transcription checked in tolerances-vi03.test.ts), evaluated from the reference state of each sample (§4.1 item 2)',
    ],
    codeRevision: prov.codeRevision,
    date: prov.date,
    runtime: prov.runtime,
    independence:
      'packages/astrodynamics and packages/simulation not read and not run (ADR-003); references import nothing from the engine.',
    numberFormat:
      'Every number is the shortest decimal that round-trips to the binary64 value; JSON.parse restores the exact binary64. Signs of zero are not preserved (−0 written as 0).',
  };
}

export function buildVi03Datasets(prov: Provenance): DatasetFile[] {
  return VI03_CASES.map((c) => ({
    path: `test-data/reference-cases/vi-03-b/${c.id}.json`,
    data: {
      id: `vi-03-b/${c.id}`,
      family: 'VI-03 (b) analysis histories; ML-FR-010 AC3 comparison table',
      description: c.description,
      record: RECORD_VI03,
      status: STATUS,
      producedBy: producedBy(prov),
      inputs: {
        scenario: scenarioOf(c),
        constants: CONSTANTS,
      },
      outputs: buildVi03Case(c),
      assertion: {
        histories:
          'Per sample and quantity: |analysis − reference(engine state)| ≤ tolerance (angles modulo 2π, reduced to (−π, π]); null tolerance = not asserted (notAsserted gives the reason).',
        comparison:
          'Before/after/difference per row against the reference from the engine event states; null = not asserted (reason given). Applied Δv: VT-12 normwise vs rswToInertialHp of the event pre-state, VT-13 magnitude.',
      },
    },
  }));
}
