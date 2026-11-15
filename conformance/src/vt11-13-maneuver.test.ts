/**
 * VT-11 RSW basis (FR-006 AC1), VT-12 inertial Δv (AC2, L2c) and VT-13 impulsive change (AC3) on
 * real runSimulation runs, datasets test-data/reference-cases/vt-12 (phase 1).
 * - VT-12: deltaV_inertial_mps vs the 320-bit projection-form reference, evaluated at the event's
 *   pre-maneuver state (stored value for t = 0 after checking the event state is the initial
 *   state; the committed reference function otherwise). Tolerance 8(12κ_h + 25)u‖Δv_RSW‖.
 * - VT-13: R12 increment and R8 continuity exact (Object.is); magnitude 24u; rotation 4(12κ_h+31)u.
 * - VT-11: the engine's exported rswBasis at (event position_m, velocityBefore_mps).
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { rswBasis } from '@mission-lab/astrodynamics';
import { rswToInertialHp } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { cross3, dot3, norm3, runRequest, segmentSamples } from './support/run';

interface Vt12Case {
  readonly kind: string;
  readonly deltaV_rsw_mps: V3;
  readonly request: SimulationRequest;
  readonly referenceDeltaV_inertial_mps?: V3;
}

interface Vt12 {
  readonly inputs: { readonly cases: readonly Vt12Case[] };
  readonly tolerance: {
    readonly vt11: {
      readonly orthonormality_and_handedness: number;
      readonly rParallel: number;
      readonly wParallel: number;
    };
    readonly vt12: { readonly relative: number };
    readonly vt13: { readonly magnitude_rel: number; readonly rotationNorm_rel: number };
  };
}

const datasets = loadFamily('vt-12').map((d) => ({ file: d.file, data: d.data as Vt12 }));
const ratios = new RatioRecorder('VT-11/12/13');
const axisNotes: string[] = [];

afterAll(() => {
  console.log(ratios.summary());
  console.log(
    `[conformance] VT-11 axis-Δv cross-check (informative): ${axisNotes.length === 0 ? 'every unit-axis Δv_I equals the exported rswBasis vector bit-for-bit' : axisNotes.join('; ')}`,
  );
});

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cases = datasets.flatMap(({ file, data }) =>
  data.inputs.cases.map((c) => ({ name: `${file} ${c.kind}`, file, data, c })),
);

describe('VT-11 / VT-12 / VT-13 on runSimulation results', () => {
  it.each(cases)('$name', ({ name, data, c }) => {
    const result = runRequest(c.request);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    const f: string[] = [];
    const dvRsw = c.deltaV_rsw_mps;
    const dvNorm = norm3(dvRsw);
    const dvI = e.deltaV_inertial_mps;

    // VT-13 exact parts: R12 and R8.
    for (let i = 0; i < 3; i++) {
      const sum = (e.velocityBefore_mps[i] ?? NaN) + (dvI[i] ?? NaN);
      if (!Object.is(e.velocityAfter_mps[i], sum)) f.push(`R12 component ${String(i)}`);
    }
    const seg0 = segmentSamples(result, 0);
    const seg1 = segmentSamples(result, 1);
    const last = seg0[seg0.length - 1];
    const firstAfter = seg1[0];
    if (last === undefined || firstAfter === undefined) {
      f.push('missing boundary samples');
    } else {
      if (!Object.is(last.t, e.t_s) || !Object.is(firstAfter.t, e.t_s)) f.push('R8 t_s');
      for (let i = 0; i < 3; i++) {
        if (
          !Object.is(last.r[i], e.position_m[i]) ||
          !Object.is(firstAfter.r[i], e.position_m[i])
        ) {
          f.push(`R8 position ${String(i)}`);
        }
        if (!Object.is(last.v[i], e.velocityBefore_mps[i]))
          f.push(`R8 velocityBefore ${String(i)}`);
        if (!Object.is(firstAfter.v[i], e.velocityAfter_mps[i]))
          f.push(`R8 velocityAfter ${String(i)}`);
      }
    }
    if (!Object.is(e.t_s, c.request.maneuvers[0]?.t_s)) f.push('event t_s ≠ maneuver t_s');

    // VT-12: reference at the event's pre-maneuver state.
    const r = e.position_m;
    const v = e.velocityBefore_mps;
    let ref: V3;
    if (c.referenceDeltaV_inertial_mps !== undefined) {
      const init = c.request.initialState;
      const same = [0, 1, 2].every(
        (i) => Object.is(r[i], init.position_m[i]) && Object.is(v[i], init.velocity_mps[i]),
      );
      if (!same) f.push('t = 0 event state is not request.initialState (contract §5.2, R8)');
      ref = same ? c.referenceDeltaV_inertial_mps : rswToInertialHp(r, v, dvRsw);
    } else {
      ref = rswToInertialHp(r, v, dvRsw);
    }
    const err12 = norm3(sub(dvI, ref));
    const tol12 = data.tolerance.vt12.relative * dvNorm;
    ratios.record('VT-12 Δv_I vs L2c', err12, tol12, name);
    if (!(err12 <= tol12)) f.push(`VT-12 |ΔΔv| ${String(err12)} > ${String(tol12)}`);

    // VT-13 magnitude and rotation-norm checks.
    const nI = norm3(dvI);
    const errMag = Math.abs(e.deltaV_magnitude_mps - nI);
    const tolMag = data.tolerance.vt13.magnitude_rel * dvNorm;
    ratios.record('VT-13 magnitude', errMag, tolMag, name);
    if (!(errMag <= tolMag)) f.push(`VT-13 magnitude ${String(errMag)} > ${String(tolMag)}`);
    const errRot = Math.abs(nI - dvNorm);
    const tolRot = data.tolerance.vt13.rotationNorm_rel * dvNorm;
    ratios.record('VT-13 ‖Δv_I‖ vs ‖Δv_RSW‖', errRot, tolRot, name);
    if (!(errRot <= tolRot)) f.push(`VT-13 rotation norm ${String(errRot)} > ${String(tolRot)}`);

    // VT-11: exported basis at the event state.
    const b = rswBasis(r, v);
    if (!b.ok) {
      f.push(`rswBasis failed: ${b.reason}`);
    } else {
      const R = b.basis.radial;
      const S = b.basis.alongTrack;
      const W = b.basis.crossTrack;
      const cols = [R, S, W];
      let orth = 0;
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          const cj = cols[j];
          const ck = cols[k];
          if (cj === undefined || ck === undefined) continue;
          orth = Math.max(orth, Math.abs(dot3(cj, ck) - (j === k ? 1 : 0)));
        }
      }
      const hand = norm3(sub(cross3(R, S), W));
      const rn = norm3(r);
      const rPar = norm3(sub(R, [r[0] / rn, r[1] / rn, r[2] / rn]));
      const h = cross3(r, v);
      const hn = norm3(h);
      const wPar = norm3(sub(W, [h[0] / hn, h[1] / hn, h[2] / hn]));
      const t11 = data.tolerance.vt11;
      ratios.record('VT-11 orthonormality', orth, t11.orthonormality_and_handedness, name);
      ratios.record('VT-11 handedness', hand, t11.orthonormality_and_handedness, name);
      ratios.record('VT-11 R ∥ r', rPar, t11.rParallel, name);
      ratios.record('VT-11 W ∥ r × v', wPar, t11.wParallel, name);
      if (!(orth <= t11.orthonormality_and_handedness))
        f.push(`VT-11 orthonormality ${String(orth)}`);
      if (!(hand <= t11.orthonormality_and_handedness)) f.push(`VT-11 handedness ${String(hand)}`);
      if (!(rPar <= t11.rParallel)) f.push(`VT-11 R ∥ r ${String(rPar)}`);
      if (!(wPar <= t11.wParallel)) f.push(`VT-11 W ∥ r×v ${String(wPar)}`);
      const axis =
        c.kind === 'axis-R' ? R : c.kind === 'axis-S' ? S : c.kind === 'axis-W' ? W : null;
      if (axis !== null && ![0, 1, 2].every((i) => dvI[i] === axis[i])) {
        axisNotes.push(`${name}: Δv_I ≠ exported basis vector`);
      }
    }
    expect(f, name).toEqual([]);
  });
});
