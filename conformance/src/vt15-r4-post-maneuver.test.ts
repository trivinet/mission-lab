/**
 * VT-15 post-maneuver orbit, revision-4 rows (ML-FR-006 AC5, FR-010 AC3; ML-TASK-018 part D2), on
 * the NEW dataset versions test-data/reference-cases/vt-15-r4 (tolerances.md §4.1 item 5; the
 * version-1 datasets keep their approved values in vt15-post-maneuver.test.ts).
 * Engine side, evaluated by the test in binary64 from the event: a⁺ (vis-viva), e⁺ (e-vector),
 * ĥ⁺ = (r × v⁺)/‖r × v⁺‖, ψ = atan2(‖ĥ⁻ × ĥ⁺‖, ĥ⁻·ĥ⁺). Reference: the exact maneuver in 320-bit
 * (closed form, plane normal, plane rotation). Rows: |δa⁺|/a⁺, |δe⁺|, δψ_n = ‖ĥ⁺_engine − ĥ⁺_ref‖,
 * |δψ| (§7 VT-15 revision 4). Mode A: at m = 0 the event pre-maneuver state must equal the
 * request's initialState bit-for-bit (§1 precondition row, checked here); at m > 0 only tangential
 * burns at an apsis. All rows asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import {
  eccentricityOf,
  planeNormalOf,
  planeRotationOf,
  semiMajorAxisOf,
} from './support/orbit-test-eval';
import { runRequest } from './support/run';

interface Vt15R4 {
  readonly kind: string;
  readonly inputs: { readonly request: SimulationRequest; readonly maneuverTime_s: number };
  readonly outputs: {
    readonly semiMajorAxisAfter_m: number;
    readonly eccentricityAfter: number;
    readonly planeNormalAfter: V3;
    readonly planeRotation_rad: number;
  };
  readonly tolerance: {
    readonly semiMajorAxis_rel: number;
    readonly eccentricity_abs: number;
    readonly planeNormal_rad: number;
    readonly planeRotation_rad: number;
    readonly assertion: string;
  };
}

const datasets = loadFamily('vt-15-r4').map((d) => ({ file: d.file, data: d.data as Vt15R4 }));
const ratios = new RatioRecorder('VT-15 revision 4 (asserted)');

afterAll(() => {
  console.log(ratios.summary());
});

describe('VT-15 revision-4 rows on the new dataset versions', () => {
  it('covers the fourteen cases', () => {
    expect(datasets).toHaveLength(14);
  });
  it.each(datasets)('$file', ({ file, data }) => {
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    if (data.inputs.maneuverTime_s === 0) {
      expect(bitIdentical(e.position_m, req.initialState.position_m), `${file}: precondition`).toBe(
        true,
      );
      expect(bitIdentical(e.velocityBefore_mps, req.initialState.velocity_mps)).toBe(true);
    } else {
      expect(data.kind).toBe('apsis-tangential');
    }
    const a = semiMajorAxisOf(e.position_m, e.velocityAfter_mps, mu);
    const ecc = eccentricityOf(e.position_m, e.velocityAfter_mps, mu);
    const hAfter = planeNormalOf(e.position_m, e.velocityAfter_mps);
    const psi = planeRotationOf(planeNormalOf(e.position_m, e.velocityBefore_mps), hAfter);
    const o = data.outputs;
    const t = data.tolerance;
    expect(t.assertion).toBe('asserted');
    const rows: [string, number, number][] = [
      [
        '|δa⁺|/a⁺',
        Math.abs(a - o.semiMajorAxisAfter_m) / o.semiMajorAxisAfter_m,
        t.semiMajorAxis_rel,
      ],
      ['|δe⁺|', Math.abs(ecc - o.eccentricityAfter), t.eccentricity_abs],
      ['δψ_n', diffNorm(hAfter, o.planeNormalAfter), t.planeNormal_rad],
      ['|δψ|', Math.abs(psi - o.planeRotation_rad), t.planeRotation_rad],
    ];
    const f: string[] = [];
    for (const [q, obs, tl] of rows) {
      const ratio = ratios.record(q, obs, tl, `${file} (${data.kind})`);
      if (!(obs <= tl)) f.push(`${q}: ${fmt(obs)} > ${fmt(tl)} (×${ratio.toPrecision(3)})`);
    }
    expect(
      f,
      `${file}: engine a⁺ ${String(a)} e⁺ ${String(ecc)} ψ ${String(psi)}; ref a⁺ ${String(o.semiMajorAxisAfter_m)} e⁺ ${String(o.eccentricityAfter)} ψ ${String(o.planeRotation_rad)}`,
    ).toEqual([]);
  });
});
