/**
 * VT-16 vs L3 Orekit (ML-FR-006 AC6; ML-TASK-018 part D2), test-data/l3-orekit/vt-16 with the
 * revision-4 values of test-data/reference-cases/l3-r4-vt-16 (tolerances.md §9.3, §9.3.1, §9.3.2).
 * - Warnings (asserted, exact): the set of warning codes stored in the Orekit file, t_s = m.
 * - Segment 0 (asserted): vs Orekit's own segment 0, 3M·P_E(t), 3M·V_E(t); t_s bit-identical,
 *   t_s = 0 exact (§9.3.2 item 1).
 * - Segment 1, elliptic (c4-midrun-retro-subsurface, asserted): vs an Orekit arc restarted from the
 *   engine's event state (§9.3.2 item 2), 3M·P_E(t − m) at Orekit's post-maneuver (a⁺, e⁺).
 * - Segment 1, hyperbolic (c1-escape-prograde, c3-midrun-escape): informative only. The L3 VT-16
 *   hyperbolic rows are usable only after O-13 (§9.3.1, §15), which is open (the selfcheck change it
 *   needs is outside this task's paths); the engine bound also rests on O-12 (open). Measured and
 *   printed, never asserted.
 *
 * Restarted arcs: conformance/l3-restart/<case>.json, produced by verification/l3-d2/restart.py from
 * the engine event states this file writes when ML_WRITE_L3_EVENT_STATES=1 (phase 2 of D2). Before
 * a restarted arc is used, its recorded start state must equal the engine's current event state
 * bit-for-bit; otherwise the arc is stale and the test fails.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { decodeValue } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';
import type { V3 } from './support/datasets';
import { L3_RESTART_DIR, loadL3, numArray, obj, withRequestId } from './support/l3';
import { runRequest, segmentSamples } from './support/run';

interface Seg {
  readonly t_s: readonly number[];
  readonly position_m: readonly V3[];
  readonly velocity_mps: readonly V3[];
}

interface L3Vt16 {
  readonly kind: string;
  readonly inputs: {
    readonly requestBody: Omit<SimulationRequest, 'requestId'>;
    readonly maneuverTime_s: number;
  };
  readonly outputs: { readonly segments: readonly Seg[] };
}

interface Restart {
  readonly inputs: {
    readonly l3Dataset: string;
    readonly maneuverTime_s: number;
    readonly position_m: V3;
    readonly velocityAfter_mps: V3;
  };
  readonly outputs: Seg;
}

const cases = loadL3<L3Vt16>('vt-16');
const asserted = new RatioRecorder('L3 VT-16 (asserted)');
const informative = new RatioRecorder(
  'L3 VT-16 hyperbolic segment 1 (INFORMATIVE, not asserted: O-13, O-12)',
);
const notes: string[] = [];

const results = new Map<string, SimulationResult>();
function resultOf(file: string, body: Omit<SimulationRequest, 'requestId'>): SimulationResult {
  const cached = results.get(file);
  if (cached !== undefined) return cached;
  const r = runRequest(withRequestId(body));
  results.set(file, r);
  return r;
}

afterAll(() => {
  console.log(asserted.summary());
  console.log(informative.summary());
  for (const n of notes) console.log(`[conformance] L3 VT-16: ${n}`);
});

// Writer mode (D2 phase 2): record the engine event states of the m > 0 cases for restart.py.
if (process.env.ML_WRITE_L3_EVENT_STATES === '1') {
  const out = cases
    .filter((c) => c.data.inputs.maneuverTime_s > 0)
    .map((c) => {
      const r = resultOf(c.file, c.data.inputs.requestBody);
      const e = r.events[0];
      if (e === undefined) throw new Error('no event');
      return {
        case: c.caseId,
        l3Dataset: c.file,
        maneuverTime_s: e.t_s,
        position_m: e.position_m,
        velocityAfter_mps: e.velocityAfter_mps,
        t_s: c.data.outputs.segments[1]?.t_s ?? [],
      };
    });
  const engineRevision = execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  mkdirSync(L3_RESTART_DIR, { recursive: true });
  writeFileSync(
    join(L3_RESTART_DIR, 'engine-event-states.json'),
    `${JSON.stringify({ engineRevision, cases: out }, null, 2)}\n`,
    'utf8',
  );
}

function compareSegment(
  label: string,
  engine: { t: number; r: V3; v: V3 }[],
  ref: Seg,
  tolR: readonly number[],
  tolV: readonly number[],
  rec: RatioRecorder,
): string[] {
  const f: string[] = [];
  if (engine.length !== ref.t_s.length)
    return [`${label}: sample count ${String(engine.length)} vs ${String(ref.t_s.length)}`];
  engine.forEach((s, k) => {
    if (!Object.is(s.t, ref.t_s[k]))
      f.push(`${label} k=${String(k)}: t_s ${String(s.t)} vs ${String(ref.t_s[k])}`);
    const rr = ref.position_m[k];
    const vr = ref.velocity_mps[k];
    if (rr === undefined || vr === undefined) {
      f.push(`${label} k=${String(k)}: missing reference`);
      return;
    }
    const dr = diffNorm(s.r, rr);
    const dv = diffNorm(s.v, vr);
    const tr = tolR[k] ?? NaN;
    const tv = tolV[k] ?? NaN;
    if (tr === 0) {
      // Exact sample (t_s = 0 or the segment's first sample = event state).
      if (!(bitIdentical(s.r, rr) && bitIdentical(s.v, vr)))
        f.push(`${label} k=${String(k)}: exact sample differs`);
      return;
    }
    const where = `${label} k=${String(k)} t=${String(s.t)}`;
    const qr = rec.record('position', dr, tr, where);
    const qv = rec.record('velocity', dv, tv, where);
    if (!(dr <= tr) || !(dv <= tv)) {
      f.push(
        `${where}: |Δr| ${fmt(dr)} tol ${fmt(tr)} (×${qr.toPrecision(3)}), |Δv| ${fmt(dv)} tol ${fmt(tv)} (×${qv.toPrecision(3)}); engine r ${fmtV(s.r)} ref r ${fmtV(rr)}`,
      );
    }
  });
  return f;
}

describe('L3 VT-16 warnings (exact)', () => {
  it('covers the three cases', () => {
    expect(cases).toHaveLength(3);
  });
  it.each(cases)('$file', ({ file, data, tol }) => {
    const w = obj(obj(tol.tolerance).warnings);
    const result = resultOf(file, data.inputs.requestBody);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    expect(result.diagnostics.map((d) => d.code).sort(), file).toEqual(
      [...(w.expectedCodes as string[])].sort(),
    );
    for (const d of result.diagnostics) {
      expect(d.severity).toBe('warning');
      expect(Object.is(d.t_s, data.inputs.maneuverTime_s), `${file} ${d.code} t_s`).toBe(true);
    }
  });
});

describe('L3 VT-16 segment 0 vs Orekit segment 0 (asserted)', () => {
  it.each(cases)('$file', ({ file, data, tol }) => {
    const s0 = obj(obj(tol.tolerance).segment0);
    const ref = data.outputs.segments[0];
    if (ref === undefined) throw new Error('segment 0');
    const result = resultOf(file, data.inputs.requestBody);
    const f = compareSegment(
      `${file} seg0`,
      segmentSamples(result, 0),
      ref,
      numArray(s0.position_m),
      numArray(s0.velocity_mps),
      asserted,
    );
    expect(f, file).toEqual([]);
  });
});

describe('L3 VT-16 segment 1', () => {
  it.each(cases)('$file', ({ file, caseId, data, tol }) => {
    const s1 = obj(obj(tol.tolerance).segment1);
    const isAsserted = s1.assertion === 'asserted';
    const m = data.inputs.maneuverTime_s;
    const result = resultOf(file, data.inputs.requestBody);
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    let ref: Seg;
    if (m > 0) {
      const path = join(L3_RESTART_DIR, `${caseId}.json`);
      expect(
        existsSync(path),
        `${file}: restarted Orekit arc missing (${path}); run D2 phase 2`,
      ).toBe(true);
      const rs = decodeValue(JSON.parse(readFileSync(path, 'utf8'))) as Restart;
      expect(rs.inputs.l3Dataset).toBe(file);
      expect(
        Object.is(rs.inputs.maneuverTime_s, e.t_s) &&
          bitIdentical(rs.inputs.position_m, e.position_m) &&
          bitIdentical(rs.inputs.velocityAfter_mps, e.velocityAfter_mps),
        `${file}: restarted arc was produced from another event state (stale); regenerate`,
      ).toBe(true);
      ref = rs.outputs;
    } else {
      const own = data.outputs.segments[1];
      if (own === undefined) throw new Error('segment 1');
      ref = own;
      const o0r = own.position_m[0];
      const o0v = own.velocity_mps[0];
      if (o0r !== undefined && o0v !== undefined) {
        notes.push(
          `${file}: m = 0, Orekit's own segment 1; event-state difference engine − Orekit |Δr| ${fmt(diffNorm(e.position_m, o0r))} m, |Δv⁺| ${fmt(diffNorm(e.velocityAfter_mps, o0v))} m/s`,
        );
      }
    }
    const f = compareSegment(
      `${file} seg1`,
      segmentSamples(result, 1),
      ref,
      numArray(s1.position_m),
      numArray(s1.velocity_mps),
      isAsserted ? asserted : informative,
    );
    if (isAsserted) {
      expect(f, file).toEqual([]);
    } else {
      for (const x of f) notes.push(`INFORMATIVE over bound (not asserted): ${x}`);
    }
  });
});
