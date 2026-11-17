/**
 * VI-03 (b) (ML-FR-009, analysis histories) and ML-FR-010 AC3 (coast-vs-maneuver comparison table)
 * against independent references (ML-TASK-036; tolerance record revision 5, approved 2026-11-16:
 * §8 VI-03 (b), §7 VT-15 FR-010 AC3 rows, §7 VT-12, §7 VT-13).
 *
 * Per dataset of test-data/reference-cases/vi-03-b (committed before any run of the analysis module
 * on it, §4.1): the scenario is built with buildSimulationRequest and its coast twin with
 * buildCoastRequest (the UI path), both are run, computeHistories is applied to both results and
 * compareCoastAndManeuver to the pair. Each history value and table value is compared with the
 * reference recomputed by the test (analysisReferenceHp) from the SAME engine state, under the
 * per-sample tolerance committed in the dataset (evaluated from the reference trajectory, §4.1
 * item 2). Every row with a committed tolerance is asserted; rows the record does not cover carry a
 * null tolerance with the reason and are reported as informative (support/vi03.ts).
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import {
  buildCoastRequest,
  buildSimulationRequest,
  compareCoastAndManeuver,
  computeHistories,
} from '@mission-lab/simulation';
import { afterAll, describe, expect, it } from 'vitest';
import { RatioRecorder } from './support/compare';
import { loadFamily, type V3 } from './support/datasets';
import { runRequest } from './support/run';
import {
  InfoRecorder,
  checkManeuverComparison,
  checkSegmentHistories,
  type ConstantsJson,
  type DatasetComparison,
  type DatasetSegment,
} from './support/vi03';

interface Vi03Dataset {
  readonly inputs: { readonly scenario: unknown; readonly constants: ConstantsJson };
  readonly outputs: {
    readonly segments: readonly DatasetSegment[];
    readonly coast: { readonly segments: readonly DatasetSegment[] } | null;
    readonly comparison: DatasetComparison | null;
  };
}

const datasets = loadFamily('vi-03-b').map((d) => ({ file: d.file, data: d.data as Vi03Dataset }));
const histRatios = new RatioRecorder('VI-03 (b) histories (asserted)');
const cmpRatios = new RatioRecorder('FR-010 AC3 comparison table (asserted)');
const info = new InfoRecorder();

afterAll(() => {
  console.log(histRatios.summary());
  console.log(cmpRatios.summary());
  console.log(info.summary('VI-03 (b) / FR-010 AC3'));
});

function requestOf(
  scenario: unknown,
  build: (x: unknown) => ReturnType<typeof buildSimulationRequest>,
): SimulationRequest {
  const r = build(scenario);
  if (!r.ok) throw new Error(`request not built: ${JSON.stringify(r.issues)}`);
  return r.value;
}

function historyFailures(
  file: string,
  label: string,
  request: SimulationRequest,
  segments: readonly DatasetSegment[],
  constants: ConstantsJson,
): { failures: string[]; result: ReturnType<typeof runRequest> } {
  const result = runRequest(request);
  if (result.status !== 'ok')
    throw new Error(`${file} ${label}: ${JSON.stringify(result.diagnostics)}`);
  const h = computeHistories(result);
  if (!h.ok) return { failures: [`${file} ${label}: computeHistories failed ${h.reason}`], result };
  const f: string[] = [];
  if (
    h.histories.segments.length !== segments.length ||
    result.segments.length !== segments.length
  ) {
    f.push(
      `${file} ${label}: ${String(h.histories.segments.length)} history segments, ${String(result.segments.length)} result segments, dataset ${String(segments.length)}`,
    );
    return { failures: f, result };
  }
  segments.forEach((ds, n) => {
    const hs = h.histories.segments[n];
    const es = result.segments[n];
    if (hs === undefined || es === undefined) return;
    f.push(
      ...checkSegmentHistories(
        `${file} ${label} seg ${String(n)}`,
        hs,
        es,
        ds,
        constants,
        histRatios,
        info,
      ),
    );
  });
  return { failures: f, result };
}

describe('VI-03 (b) and ML-FR-010 AC3 on vi-03-b', () => {
  it('covers the six cases', () => {
    expect(datasets).toHaveLength(6);
  });

  it.each(datasets)('$file', ({ file, data }) => {
    const c = data.inputs.constants;
    const request = requestOf(data.inputs.scenario, buildSimulationRequest);
    // The dataset's tolerances assume these constants (precondition, exact).
    expect(Object.is(request.constants.mu_m3ps2, c.mu_m3ps2)).toBe(true);
    expect(Object.is(request.constants.referenceRadius_m, c.referenceRadius_m)).toBe(true);

    const own = historyFailures(file, 'scenario run', request, data.outputs.segments, c);
    const f = [...own.failures];

    const cmp = data.outputs.comparison;
    const coastDs = data.outputs.coast;
    if (cmp !== null && coastDs !== null) {
      const coastRequest = requestOf(data.inputs.scenario, buildCoastRequest);
      const coast = historyFailures(file, 'coast run', coastRequest, coastDs.segments, c);
      f.push(...coast.failures);
      const res = compareCoastAndManeuver(coast.result, own.result, request);
      if (!res.ok) {
        f.push(`${file}: compareCoastAndManeuver failed ${res.reason}`);
      } else {
        const ev = own.result.events[0];
        const mc = res.comparison.maneuvers[0];
        const m = request.maneuvers[0];
        expect(res.comparison.maneuvers).toHaveLength(1);
        if (ev === undefined || mc === undefined || m === undefined) throw new Error('event');
        const v3 = (x: readonly number[]): V3 => [x[0] ?? NaN, x[1] ?? NaN, x[2] ?? NaN];
        f.push(
          ...checkManeuverComparison(
            file,
            mc,
            {
              maneuverId: ev.maneuverId,
              t_s: ev.t_s,
              position_m: v3(ev.position_m),
              velocityBefore_mps: v3(ev.velocityBefore_mps),
              velocityAfter_mps: v3(ev.velocityAfter_mps),
              deltaV_inertial_mps: v3(ev.deltaV_inertial_mps),
              deltaV_magnitude_mps: ev.deltaV_magnitude_mps,
            },
            v3(m.deltaV_mps),
            cmp,
            c,
            cmpRatios,
            info,
          ),
        );
      }
    }
    expect(f.slice(0, 20), `${String(f.length)} failures`).toEqual([]);
  });
});
