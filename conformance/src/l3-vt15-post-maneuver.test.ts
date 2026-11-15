/**
 * VT-15 post-maneuver orbit vs L3 Orekit (ML-FR-006 AC5, FR-010 AC3; ML-TASK-018 part D2).
 * `runSimulation` on each Orekit request; Orekit's post-maneuver a⁺, e⁺ (its KeplerianOrbit getters,
 * outputs.elementsAfter) and plane (ĥ⁺ and the rotation angle ψ, evaluated by the test from
 * Orekit's event state) against the engine's (a⁺, e⁺, ĥ⁺, ψ evaluated by the test from the engine
 * event), each side from its own post-maneuver state (tolerances.md §9.3.1 VT-15 L3 rows, values in
 * test-data/reference-cases/l3-r4-vt-15). m = 0: the engine pre-maneuver state must equal
 * initialState bit-for-bit (precondition). m = T (tangential at an apsis only): each tool's own
 * event state, no restart (§9.3.1, §9.3.2 item 4). Asserted.
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, RatioRecorder } from './support/compare';
import type { ElementsJson, V3 } from './support/datasets';
import { loadL3, num, obj, withRequestId } from './support/l3';
import {
  eccentricityOf,
  planeNormalOf,
  planeRotationOf,
  semiMajorAxisOf,
} from './support/orbit-test-eval';
import { runRequest } from './support/run';

interface L3Vt15 {
  readonly kind: string;
  readonly inputs: {
    readonly requestBody: Omit<SimulationRequest, 'requestId'>;
    readonly maneuverTime_s: number;
  };
  readonly outputs: {
    readonly event: {
      readonly position_m: V3;
      readonly velocityBefore_mps: V3;
      readonly velocityAfter_mps: V3;
    };
    readonly elementsAfter: ElementsJson;
  };
}

const cases = loadL3<L3Vt15>('vt-15');
const ratios = new RatioRecorder('L3 VT-15 (asserted)');

afterAll(() => {
  console.log(ratios.summary());
});

describe('L3 VT-15 post-maneuver a⁺, e⁺ and plane vs Orekit', () => {
  it('covers the fourteen cases', () => {
    expect(cases).toHaveLength(14);
  });
  it.each(cases)('$file', ({ file, data, tol }) => {
    const t = obj(tol.tolerance);
    const req = withRequestId(data.inputs.requestBody);
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
      expect(data.kind, `${file}: m > 0 only for tangential burns at an apsis`).toBe(
        'apsis-tangential',
      );
    }
    const ev = data.outputs.event;
    const aE = semiMajorAxisOf(e.position_m, e.velocityAfter_mps, mu);
    const eE = eccentricityOf(e.position_m, e.velocityAfter_mps, mu);
    const hE = planeNormalOf(e.position_m, e.velocityAfter_mps);
    const psiE = planeRotationOf(planeNormalOf(e.position_m, e.velocityBefore_mps), hE);
    const aO = data.outputs.elementsAfter.semiMajorAxis_m;
    const eO = data.outputs.elementsAfter.eccentricity;
    const hO = planeNormalOf(ev.position_m, ev.velocityAfter_mps);
    const psiO = planeRotationOf(planeNormalOf(ev.position_m, ev.velocityBefore_mps), hO);
    const rows: [string, number, number][] = [
      ['|δa⁺|/a⁺', Math.abs(aE - aO) / aO, num(t.semiMajorAxis_rel)],
      ['|δe⁺|', Math.abs(eE - eO), num(t.eccentricity_abs)],
      ['δψ_n', diffNorm(hE, hO), num(t.planeNormal_rad)],
      ['|δψ|', Math.abs(psiE - psiO), num(t.planeRotation_rad)],
    ];
    const f: string[] = [];
    for (const [q, obs, tl] of rows) {
      const ratio = ratios.record(q, obs, tl, `${file} (${data.kind})`);
      if (!(obs <= tl)) f.push(`${q}: ${fmt(obs)} > ${fmt(tl)} (×${ratio.toPrecision(3)})`);
    }
    expect(
      f,
      `${file}: engine a⁺ ${String(aE)} e⁺ ${String(eE)} ψ ${String(psiE)}; Orekit a⁺ ${String(aO)} e⁺ ${String(eO)} ψ ${String(psiO)}`,
    ).toEqual([]);
  });
});
