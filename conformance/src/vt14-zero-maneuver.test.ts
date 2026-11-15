/**
 * VT-14 Zero-magnitude maneuver (ML-FR-006 AC4), datasets test-data/reference-cases/vt-14
 * (phase 1): exact parts (Δv_I = ±0, v⁺ === v⁻), segment 0 identical to the coast run (O-4
 * premise, as VT-09), and for e = 0 the samples after m vs the coast run within the §7 VT-14
 * formula evaluated per sample. For e > 0 the trajectory after m has no approved tolerance
 * (open item O-11): observed differences are printed, not asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { bitsKey, norm3, runRequest, segmentSamples, samplesOf, type Sample } from './support/run';

interface Vt14 {
  readonly inputs: {
    readonly coastRequest: SimulationRequest;
    readonly zeroDeltaVRequest: SimulationRequest;
    readonly maneuverTime_s: number;
  };
  readonly outputs: { readonly afterManeuver_t_s: readonly number[] };
  readonly tolerance: {
    readonly evaluated: boolean;
    readonly position_m: readonly number[];
    readonly velocity_mps: readonly number[];
  };
}

const datasets = loadFamily('vt-14').map((d) => ({ file: d.file, data: d.data as Vt14 }));
const ratios = new RatioRecorder('VT-14');
const informative: string[] = [];

afterAll(() => {
  console.log(ratios.summary());
  for (const line of informative)
    console.log(`[conformance] VT-14 informative (no tolerance, O-11): ${line}`);
});

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('VT-14 zero-Δv run vs coast run', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const coast = runRequest(data.inputs.coastRequest);
    const zero = runRequest(data.inputs.zeroDeltaVRequest);
    expect(coast.status).toBe('ok');
    expect(zero.status, JSON.stringify(zero.diagnostics)).toBe('ok');
    const e = zero.events[0];
    if (e === undefined) throw new Error('no event');
    const f: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (e.deltaV_inertial_mps[i] !== 0)
        f.push(`Δv_I[${String(i)}] = ${String(e.deltaV_inertial_mps[i])}`);
      if (e.velocityAfter_mps[i] !== e.velocityBefore_mps[i]) f.push(`v⁺[${String(i)}] !== v⁻`);
    }
    if (e.deltaV_magnitude_mps !== 0) f.push(`magnitude ${String(e.deltaV_magnitude_mps)}`);
    expect(zero.segments.length).toBe(2);
    const coastByT = new Map<string, Sample>();
    for (const s of samplesOf(coast)) coastByT.set(bitsKey(s.t), s);
    for (const s of segmentSamples(zero, 0)) {
      const c = coastByT.get(bitsKey(s.t));
      if (c === undefined) continue;
      for (let i = 0; i < 3; i++) {
        if (!Object.is(s.r[i], c.r[i]) || !Object.is(s.v[i], c.v[i])) {
          f.push(`segment 0 t=${String(s.t)} differs from coast (O-4 premise)`);
          break;
        }
      }
    }
    const after = segmentSamples(zero, 1).filter((s) => s.t > data.inputs.maneuverTime_s);
    expect(after.map((s) => s.t)).toEqual(data.outputs.afterManeuver_t_s);
    let worstR = 0;
    let worstV = 0;
    after.forEach((s, k) => {
      const c = coastByT.get(bitsKey(s.t));
      if (c === undefined) return;
      const dr = norm3(sub(s.r, c.r));
      const dv = norm3(sub(s.v, c.v));
      worstR = Math.max(worstR, dr);
      worstV = Math.max(worstV, dv);
      if (data.tolerance.evaluated) {
        const tr = data.tolerance.position_m[k] ?? NaN;
        const tv = data.tolerance.velocity_mps[k] ?? NaN;
        const where = `${file} t=${String(s.t)}`;
        ratios.record('position', dr, tr, where);
        ratios.record('velocity', dv, tv, where);
        if (!(dr <= tr) || !(dv <= tv)) {
          f.push(
            `${where}: |Δr| ${dr.toExponential(3)} (tol ${tr.toExponential(3)}), |Δv| ${dv.toExponential(3)} (tol ${tv.toExponential(3)})`,
          );
        }
      }
    });
    if (!data.tolerance.evaluated) {
      informative.push(
        `${file}: max |Δr| ${worstR.toExponential(3)} m, max |Δv| ${worstV.toExponential(3)} m/s over ${String(after.length)} samples`,
      );
    }
    expect(f, file).toEqual([]);
  });
});
