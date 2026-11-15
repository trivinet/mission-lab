/**
 * Reference-side checks of the ML-TASK-018 part D3 dataset o1-hyp-r5 (tolerance record revision 5,
 * §6.8 "Extended O-1 check"; no engine involved):
 * - the six arc cases start from the reference post-maneuver states of vt-16-r4 (outputs.startState)
 *   and from Orekit's event states of test-data/l3-orekit/vt-16, with the Δt > 0 of their samples;
 * - every case lies inside the §7 VT-16 validity gate; Δt > 0 only;
 * - threshold = ε_t,gen + δt_α,hyp ≥ ε_t,gen, non-decreasing along each arc.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VT16_VALIDITY_GATE } from '../tol/tolerances-r4';
import { readL3 } from './build-d2';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIR = join(ROOT, 'test-data', 'reference-cases', 'o1-hyp-r5');

interface Case {
  readonly label: string;
  readonly startState: { readonly position_m: number[]; readonly velocity_mps: number[] };
  readonly arc: { readonly energyOverScaleAtStart: number };
  readonly dt_s: number[];
  readonly epsTgen_s: number[];
  readonly dtAlphaHyp_s: number[];
  readonly threshold_s: number[];
}

const files = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => ({
    name: n,
    data: JSON.parse(readFileSync(join(DIR, n), 'utf8')) as { cases: Case[] },
  }));

describe('part D3 dataset o1-hyp-r5', () => {
  it('has six arc files and one grid file of 96 cases', () => {
    expect(files.map((f) => f.name)).toEqual([
      'grid.json',
      'l2-c3-midrun-escape.json',
      'l2-escape-clear.json',
      'l2-hyperbolic-inbound.json',
      'l2-hyperbolic-outbound.json',
      'l3-c1-escape-prograde.json',
      'l3-c3-midrun-escape.json',
    ]);
    expect(files[0]?.data.cases.length).toBe(96);
  });

  it('L2 arcs start at the vt-16-r4 reference start state with its Δt > 0', () => {
    for (const id of [
      'c3-midrun-escape',
      'escape-clear',
      'hyperbolic-inbound',
      'hyperbolic-outbound',
    ]) {
      const c = files.find((f) => f.name === `l2-${id}.json`)?.data.cases[0];
      const ref = JSON.parse(
        readFileSync(join(ROOT, 'test-data', 'reference-cases', 'vt-16-r4', `${id}.json`), 'utf8'),
      ) as { outputs: { startState: Case['startState']; dt_s: number[] } };
      expect(c?.startState).toEqual(ref.outputs.startState);
      expect(c?.dt_s).toEqual(ref.outputs.dt_s.filter((d) => d > 0));
    }
  });

  it("L3 arcs start at Orekit's event state with Orekit's segment-1 Δt > 0", () => {
    for (const id of ['c1-escape-prograde', 'c3-midrun-escape']) {
      const c = files.find((f) => f.name === `l3-${id}.json`)?.data.cases[0];
      const d = readL3('vt-16', `l3-orekit-${id}.json`) as unknown as {
        inputs: { requestBody: { maneuvers: { t_s: number }[] } };
        outputs: {
          event: { position_m: number[]; velocityAfter_mps: number[] };
          segments: { t_s: number[] }[];
        };
      };
      const m = d.inputs.requestBody.maneuvers[0]?.t_s ?? NaN;
      expect(c?.startState.position_m).toEqual(d.outputs.event.position_m);
      expect(c?.startState.velocity_mps).toEqual(d.outputs.event.velocityAfter_mps);
      expect(c?.dt_s).toEqual(
        (d.outputs.segments[1]?.t_s ?? []).map((t) => t - m).filter((x) => x > 0),
      );
    }
  });

  it('every case is inside the validity gate; thresholds ≥ ε_t,gen and non-decreasing', () => {
    for (const f of files) {
      for (const c of f.data.cases) {
        expect(c.arc.energyOverScaleAtStart, c.label).toBeGreaterThanOrEqual(VT16_VALIDITY_GATE);
        c.dt_s.forEach((dt, k) => {
          expect(dt).toBeGreaterThan(0);
          const thr = c.threshold_s[k] ?? NaN;
          expect(thr).toBe((c.epsTgen_s[k] ?? NaN) + (c.dtAlphaHyp_s[k] ?? NaN));
          expect(thr).toBeGreaterThanOrEqual(c.epsTgen_s[k] ?? NaN);
          if (k > 0) expect(thr).toBeGreaterThanOrEqual(c.threshold_s[k - 1] ?? NaN);
        });
      }
    }
  });
});
