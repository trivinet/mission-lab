/**
 * VT-15 Post-maneuver orbit (ML-FR-006 AC5, FR-010 AC3), datasets
 * test-data/reference-cases/vt-15 (phase 1). a⁺ and e⁺ are evaluated by the test in binary64
 * from the event's position_m and velocityAfter_mps (vis-viva; e-vector) and compared with the
 * 320-bit closed form. Tangential burns at an apsis: approved §7 VT-15 tolerance. Other burn
 * kinds: no approved tolerance (gap) — printed, not asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { cross3, dot3, norm3, runRequest } from './support/run';

interface Vt15 {
  readonly kind: string;
  readonly inputs: { readonly request: SimulationRequest };
  readonly outputs: {
    readonly semiMajorAxisAfter_m: number;
    readonly eccentricityAfter: number;
    readonly planeRotation_rad: number;
  };
  readonly tolerance: {
    readonly semiMajorAxis_rel: number | null;
    readonly eccentricity_abs: number | null;
  };
}

const datasets = loadFamily('vt-15').map((d) => ({ file: d.file, data: d.data as Vt15 }));
const ratios = new RatioRecorder('VT-15');
const informative: string[] = [];

afterAll(() => {
  console.log(ratios.summary());
  for (const l of informative)
    console.log(`[conformance] VT-15 informative (no approved tolerance): ${l}`);
});

describe('VT-15 post-maneuver a⁺, e⁺ vs closed form', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    const r = e.position_m;
    const v = e.velocityAfter_mps;
    const rn = norm3(r);
    const v2 = dot3(v, v);
    const a = 1 / (2 / rn - v2 / mu);
    const c1 = v2 - mu / rn;
    const rv = dot3(r, v);
    const ev: V3 = [
      (c1 * r[0] - rv * v[0]) / mu,
      (c1 * r[1] - rv * v[1]) / mu,
      (c1 * r[2] - rv * v[2]) / mu,
    ];
    const ecc = norm3(ev);
    const aRef = data.outputs.semiMajorAxisAfter_m;
    const eRef = data.outputs.eccentricityAfter;
    const da = Math.abs(a - aRef) / aRef;
    const de = Math.abs(ecc - eRef);
    const tA = data.tolerance.semiMajorAxis_rel;
    const tE = data.tolerance.eccentricity_abs;
    if (tA === null || tE === null) {
      const vb = e.velocityBefore_mps;
      const h0 = cross3(r, vb);
      const h1 = cross3(r, v);
      const sinRot = norm3(cross3(h0, h1)) / (norm3(h0) * norm3(h1));
      informative.push(
        `${file} (${data.kind}): |δa⁺|/a⁺ ${da.toExponential(3)}, |δe⁺| ${de.toExponential(3)}, |sin δ_engine − sin δ_ref| ${Math.abs(sinRot - Math.sin(data.outputs.planeRotation_rad)).toExponential(3)}`,
      );
      return;
    }
    const rA = ratios.record('a⁺ relative', da, tA, file);
    const rE = ratios.record('e⁺ absolute', de, tE, file);
    expect(
      da <= tA && de <= tE,
      `${file}: a⁺ engine ${String(a)} ref ${String(aRef)} (×${rA.toPrecision(3)}); e⁺ engine ${String(ecc)} ref ${String(eRef)} (×${rE.toPrecision(3)})`,
    ).toBe(true);
  });
});
