/**
 * VT-16 hyperbolic arc states vs L2b (ML-FR-006 AC6; ML-TASK-018 part D2), NEW dataset versions
 * test-data/reference-cases/vt-16-r4 (tolerances.md §4.1 item 5, §6.8, §7 VT-16 revision 4).
 * L2b is the RK4 reference integrated here from the engine's event state (position_m,
 * velocityAfter_mps) with the committed reference step (§7 VT-16 "Maneuver at m > 0", VT-05
 * post-maneuver rule); per-sample values M·P_E,gen(Δt) + 2E_RK committed with the dataset.
 *
 * INFORMATIVE ONLY, never asserted: the record makes these comparisons rest on open item O-12
 * (§6.8 Scope; §12 O-12: the O-1 check is to be extended to hyperbolic arcs "before the hyperbolic
 * state comparison"), which is open. Ratios are measured and printed. Structural preconditions
 * (status ok, one event, the §5.2 sample times) are still checked.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { integrateRK4 } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { diffNorm, fmt, RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { norm3, runRequest, segmentSamples } from './support/run';

interface Vt16R4 {
  readonly inputs: { readonly request: SimulationRequest; readonly maneuverTime_s: number };
  readonly outputs: {
    readonly startState: { readonly position_m: V3; readonly velocity_mps: V3 };
    readonly t_s: readonly number[];
    readonly dt_s: readonly number[];
    readonly l2b: { readonly outputBase_s: number; readonly referenceStep_s: number };
  };
  readonly tolerance: {
    readonly vsL2b_position_m: readonly number[];
    readonly vsL2b_velocity_mps: readonly number[];
    readonly assertion: string;
  };
}

const datasets = loadFamily('vt-16-r4').map((d) => ({ file: d.file, data: d.data as Vt16R4 }));
const informative = new RatioRecorder('VT-16 hyperbolic vs L2b (INFORMATIVE, not asserted: O-12)');
const notes: string[] = [];

afterAll(() => {
  console.log(informative.summary());
  for (const n of notes) console.log(`[conformance] VT-16 r4: ${n}`);
});

describe('VT-16 hyperbolic arcs vs L2b from the engine event state (informative)', () => {
  it('covers the four arcs inside the validity gate', () => {
    expect(datasets).toHaveLength(4);
  });
  it.each(datasets)('$file', ({ file, data }) => {
    expect(data.tolerance.assertion).toBe('informative');
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const m = data.inputs.maneuverTime_s;
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    const seg = segmentSamples(result, 1);
    expect(seg.map((s) => s.t)).toEqual(data.outputs.t_s);
    const start = { position_m: e.position_m, velocity_mps: e.velocityAfter_mps };
    const ref0 = data.outputs.startState;
    const relR = diffNorm(start.position_m, ref0.position_m) / norm3(ref0.position_m);
    const relV = diffNorm(start.velocity_mps, ref0.velocity_mps) / norm3(ref0.velocity_mps);
    notes.push(
      `${file}: engine event state vs reference start, relative |Δr| ${fmt(relR)}, |Δv⁺| ${fmt(relV)} (E_RK transfer needs ≤ 1e-6: ${relR <= 1e-6 && relV <= 1e-6 ? 'yes' : 'NO'})`,
    );
    const { outputBase_s: base, referenceStep_s: h } = data.outputs.l2b;
    const dtEnd = data.outputs.dt_s[data.outputs.dt_s.length - 1] ?? NaN;
    const rk = integrateRK4(start, mu, h, Math.round(dtEnd / h), Math.round(base / h));
    seg.forEach((s, k) => {
      if (k === 0) return;
      const b = rk[Math.round((s.t - m) / base)];
      if (b === undefined) {
        notes.push(`${file} k=${String(k)}: no RK sample`);
        return;
      }
      const where = `${file} k=${String(k)} t=${String(s.t)}`;
      const dr = diffNorm(s.r, b.position_m);
      const dv = diffNorm(s.v, b.velocity_mps);
      const tr = data.tolerance.vsL2b_position_m[k] ?? NaN;
      const tv = data.tolerance.vsL2b_velocity_mps[k] ?? NaN;
      informative.record('position', dr, tr, where);
      informative.record('velocity', dv, tv, where);
      if (!(dr <= tr) || !(dv <= tv))
        notes.push(
          `INFORMATIVE over bound (not asserted): ${where} |Δr| ${fmt(dr)} / ${fmt(tr)}, |Δv| ${fmt(dv)} / ${fmt(tv)}`,
        );
    });
  });
});
