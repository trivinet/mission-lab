/**
 * VT-05 Circular and elliptical propagation (ML-FR-004 AC1) — engine `propagateKeplerUniversal`
 * from the request's initial state to each dataset time t_s (Δt = t_s − 0, one independent call
 * per sample, as ADR-005 / tolerances.md §6.1 model it), against L2a and L2b with the per-sample
 * tolerances stored in each dataset (`tolerance.vsL2a`, `tolerance.vsL2b`; §7 VT-05). Sample 0
 * (t_s = 0) is compared exactly (Object.is per component) with the initial state
 * (contracts-v1.md §5.2 revision 3; tolerances.md §1 O-10).
 *
 * The contract's sampling runner (ML-TASK-017) does not exist yet; the sample times are taken
 * from the dataset (`outputs.t_s`), not from an engine-side grid.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { propagateKeplerUniversal } from '@mission-lab/astrodynamics';
import { loadFamily, type V3, type Vt05Dataset } from './support/datasets';
import { bitIdentical, diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';

const datasets = loadFamily('vt-05').map((d) => ({ file: d.file, data: d.data as Vt05Dataset }));
const ratios = new RatioRecorder('VT-05');

afterAll(() => {
  console.log(ratios.summary());
});

interface EngineSample {
  readonly ok: boolean;
  readonly reason?: string;
  readonly position_m: V3;
  readonly velocity_mps: V3;
}

const cache = new Map<string, EngineSample[]>();

function engineSamples(data: Vt05Dataset): EngineSample[] {
  const cached = cache.get(data.id);
  if (cached !== undefined) return cached;
  const { constants, initialState } = data.inputs.request;
  const samples = data.outputs.t_s.map((t): EngineSample => {
    const r = propagateKeplerUniversal(
      constants.mu_m3ps2,
      initialState.position_m,
      initialState.velocity_mps,
      t,
    );
    return r.ok
      ? { ok: true, position_m: r.position_m, velocity_mps: r.velocity_mps }
      : { ok: false, reason: r.reason, position_m: [NaN, NaN, NaN], velocity_mps: [NaN, NaN, NaN] };
  });
  cache.set(data.id, samples);
  return samples;
}

describe('VT-05 sample 0 is the initial state (exact)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const s0 = engineSamples(data)[0];
    const init = data.inputs.request.initialState;
    expect(data.outputs.t_s[0]).toBe(0);
    expect(s0?.ok, `${file}: sample 0 failed: ${s0?.reason ?? ''}`).toBe(true);
    if (s0 === undefined) return;
    const report =
      `${file}: expected ${fmtV(init.position_m)} ${fmtV(init.velocity_mps)}, ` +
      `actual ${fmtV(s0.position_m)} ${fmtV(s0.velocity_mps)}`;
    expect(bitIdentical(s0.position_m, init.position_m), report).toBe(true);
    expect(bitIdentical(s0.velocity_mps, init.velocity_mps), report).toBe(true);
  });
});

for (const ref of ['l2a', 'l2b'] as const) {
  const tolKey = ref === 'l2a' ? 'vsL2a' : 'vsL2b';
  describe(`VT-05 vs ${ref.toUpperCase()} (per-sample stored tolerance)`, () => {
    it.each(datasets)('$file', ({ file, data }) => {
      const samples = engineSamples(data);
      const reference = data.outputs[ref];
      const tol = data.tolerance[tolKey];
      const failures: string[] = [];
      for (let k = 1; k < data.outputs.t_s.length; k++) {
        const s = samples[k];
        const t = data.outputs.t_s[k] ?? NaN;
        const rRef = reference.position_m[k];
        const vRef = reference.velocity_mps[k];
        const tolR = tol.position_m[k];
        const tolV = tol.velocity_mps[k];
        if (
          s === undefined ||
          rRef === undefined ||
          vRef === undefined ||
          tolR === undefined ||
          tolV === undefined
        ) {
          failures.push(`k=${String(k)}: missing data`);
          continue;
        }
        if (!s.ok) {
          failures.push(`k=${String(k)} t=${String(t)}: engine failed ${s.reason ?? ''}`);
          continue;
        }
        const dr = diffNorm(s.position_m, rRef);
        const dv = diffNorm(s.velocity_mps, vRef);
        const where = `${file} k=${String(k)} t=${String(t)}`;
        const ratioR = ratios.record(`${ref} position`, dr, tolR, where);
        const ratioV = ratios.record(`${ref} velocity`, dv, tolV, where);
        if (!(dr <= tolR) || !(dv <= tolV)) {
          failures.push(
            `k=${String(k)} t=${String(t)} s: |Δr| ${fmt(dr)} m tol ${fmt(tolR)} (×${ratioR.toPrecision(3)}); ` +
              `|Δv| ${fmt(dv)} m/s tol ${fmt(tolV)} (×${ratioV.toPrecision(3)}); ` +
              `engine r ${fmtV(s.position_m)} ref r ${fmtV(rRef)}`,
          );
        }
      }
      expect(failures, `${file}: ${String(failures.length)} samples over tolerance`).toEqual([]);
    });
  });
}
