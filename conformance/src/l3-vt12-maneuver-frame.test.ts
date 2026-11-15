/**
 * VT-12 RSW → inertial Δv vs L3 Orekit (ML-FR-006 AC2; ML-TASK-018 part D2). `runSimulation` on each
 * Orekit request; the event's deltaV_inertial_mps against Orekit's QSW-frame Δv
 * (test-data/l3-orekit/vt-12) with the revision-4 row of tolerances.md §9.3.1:
 * ‖ΔΔv_I‖ ≤ 12(12κ_h + 25)u‖Δv_RSW‖ (test-data/reference-cases/l3-r4-vt-12). The row is valid
 * only when the engine's pre-maneuver state equals Orekit's bit-for-bit: every case has m = 0 and
 * the event pre-maneuver state is checked against initialState with Object.is (§1 precondition).
 * Asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';
import type { V3 } from './support/datasets';
import { loadL3, num, obj, withRequestId } from './support/l3';
import { runRequest } from './support/run';

interface L3Maneuver {
  readonly kind: string;
  readonly inputs: {
    readonly requestBody: Omit<SimulationRequest, 'requestId'>;
    readonly maneuverTime_s: number;
  };
  readonly outputs: {
    readonly event: {
      readonly t_s: number;
      readonly position_m: V3;
      readonly velocityBefore_mps: V3;
      readonly deltaV_inertial_mps: V3;
      readonly velocityAfter_mps: V3;
    };
  };
}

const cases = loadL3<L3Maneuver>('vt-12');
const ratios = new RatioRecorder('L3 VT-12 (asserted)');

afterAll(() => {
  console.log(ratios.summary());
});

describe('L3 VT-12 inertial Δv vs Orekit QSW', () => {
  it('covers the eight cases', () => {
    expect(cases).toHaveLength(8);
  });
  it.each(cases)('$file', ({ file, data, tol }) => {
    const t = obj(tol.tolerance);
    const tolDv = num(t.deltaV_inertial_mps);
    const req = withRequestId(data.inputs.requestBody);
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    expect(data.inputs.maneuverTime_s).toBe(0);
    expect(bitIdentical(e.position_m, req.initialState.position_m), `${file}: precondition r`).toBe(
      true,
    );
    expect(
      bitIdentical(e.velocityBefore_mps, req.initialState.velocity_mps),
      `${file}: precondition v⁻`,
    ).toBe(true);
    const d = diffNorm(e.deltaV_inertial_mps, data.outputs.event.deltaV_inertial_mps);
    const q = ratios.record('‖ΔΔv_I‖', d, tolDv, `${file} (${data.kind})`);
    expect(
      d <= tolDv,
      `${file}: engine Δv_I ${fmtV(e.deltaV_inertial_mps)} Orekit ${fmtV(data.outputs.event.deltaV_inertial_mps)} |Δ| ${fmt(d)} tol ${fmt(tolDv)} (×${q.toPrecision(3)})`,
    ).toBe(true);
  });
});
