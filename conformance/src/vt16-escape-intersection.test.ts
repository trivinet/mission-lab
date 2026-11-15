/**
 * VT-16 Escape / reference-sphere intersection (ML-FR-006 AC6), datasets
 * test-data/reference-cases/vt-16 (phase 1).
 * - Warnings (exact): the set of warning codes equals the independently decided set (contract
 *   §8.3, §11.3 D1–D5, §11.4 P2/P6), each with t_s = maneuver time; status ok; no error.
 * - States (elliptic sub-surface arcs, maneuver at t = 0): post-maneuver samples vs L2a and L2b
 *   started at the engine's event state (record §7 VT-05 post-maneuver rule), per-sample committed
 *   tolerances. Hyperbolic arcs: no evaluated tolerance (gap), not compared.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { integrateRK4, prepareL2a, propagateL2a } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { norm3, runRequest, segmentSamples } from './support/run';

interface StateComparison {
  readonly startState: { readonly position_m: V3; readonly velocity_mps: V3 };
  readonly t_s: readonly number[];
  readonly l2b: { readonly referenceStep_s: number };
  readonly tolerance: {
    readonly vsL2a_position_m: readonly number[];
    readonly vsL2a_velocity_mps: readonly number[];
    readonly vsL2b_position_m: readonly number[];
    readonly vsL2b_velocity_mps: readonly number[];
  };
}

interface Vt16 {
  readonly inputs: { readonly request: SimulationRequest; readonly maneuverTime_s: number };
  readonly outputs: {
    readonly expectedWarningCodes: readonly string[];
    readonly expectedDiagnosticTime_s: number;
    readonly stateComparison: StateComparison | null;
  };
}

const datasets = loadFamily('vt-16').map((d) => ({ file: d.file, data: d.data as Vt16 }));
const ratios = new RatioRecorder('VT-16');

afterAll(() => {
  console.log(ratios.summary());
});

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('VT-16 warnings (exact set, t_s = maneuver time)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const result = runRequest(data.inputs.request);
    const diag = result.diagnostics.map((d) => ({
      code: d.code,
      severity: d.severity,
      t_s: d.t_s,
    }));
    expect(result.status, `${file}: ${JSON.stringify(diag)}`).toBe('ok');
    const codes = result.diagnostics.map((d) => d.code).sort();
    expect(codes, `${file}: diagnostics ${JSON.stringify(diag)}`).toEqual(
      [...data.outputs.expectedWarningCodes].sort(),
    );
    for (const d of result.diagnostics) {
      expect(d.severity).toBe('warning');
      expect(
        Object.is(d.t_s, data.outputs.expectedDiagnosticTime_s),
        `${file}: ${d.code} t_s`,
      ).toBe(true);
    }
  });
});

const withStates = datasets.filter((d) => d.data.outputs.stateComparison !== null);

describe('VT-16 sub-surface elliptic arcs vs L2a / L2b from the event state', () => {
  it.each(withStates)('$file', ({ file, data }) => {
    const sc = data.outputs.stateComparison;
    if (sc === null) return;
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const result = runRequest(req);
    expect(result.status).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    const start = { position_m: e.position_m, velocity_mps: e.velocityAfter_mps };
    // The committed E_RK was measured from the reference start state; it applies to the event
    // state only if the two are this close (VT-12-level difference).
    expect(norm3(sub(start.position_m, sc.startState.position_m))).toBe(0);
    expect(norm3(sub(start.velocity_mps, sc.startState.velocity_mps))).toBeLessThan(1e-9);
    const seg = segmentSamples(result, 1);
    expect(seg.map((s) => s.t)).toEqual(sc.t_s);
    const l2a = prepareL2a(start, mu);
    const hRef = sc.l2b.referenceStep_s;
    const D = req.duration_s;
    const every = Math.round(60 / hRef);
    const rk = integrateRK4(start, mu, hRef, Math.round(D / hRef), every);
    const f: string[] = [];
    seg.forEach((s, k) => {
      if (k === 0) return;
      const a = propagateL2a(l2a, s.t - data.inputs.maneuverTime_s).state;
      const b = rk[k];
      if (b === undefined) {
        f.push(`k=${String(k)} no RK sample`);
        return;
      }
      const where = `${file} k=${String(k)} t=${String(s.t)}`;
      const checks: [string, number, number][] = [
        ['vs L2a position', norm3(sub(s.r, a.position_m)), sc.tolerance.vsL2a_position_m[k] ?? NaN],
        [
          'vs L2a velocity',
          norm3(sub(s.v, a.velocity_mps)),
          sc.tolerance.vsL2a_velocity_mps[k] ?? NaN,
        ],
        ['vs L2b position', norm3(sub(s.r, b.position_m)), sc.tolerance.vsL2b_position_m[k] ?? NaN],
        [
          'vs L2b velocity',
          norm3(sub(s.v, b.velocity_mps)),
          sc.tolerance.vsL2b_velocity_mps[k] ?? NaN,
        ],
      ];
      for (const [q, obs, tol] of checks) {
        const ratio = ratios.record(q, obs, tol, where);
        if (!(obs <= tol))
          f.push(
            `${where} ${q}: ${obs.toExponential(3)} > ${tol.toExponential(3)} (×${ratio.toPrecision(3)})`,
          );
      }
    });
    expect(f, file).toEqual([]);
  });
});
