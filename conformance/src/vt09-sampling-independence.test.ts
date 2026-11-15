/**
 * VT-09 Sampling independence (ML-FR-004 AC4), exact: the same request with three output steps;
 * at every t_s present bit-identically in all runs (per segment), position and velocity are
 * Object.is-identical, and so are the maneuver events (tolerances.md §1, §7 VT-09 under O-4;
 * datasets test-data/reference-cases/vt-09, committed in phase 1).
 */
import type { SimulationRequest } from '@mission-lab/contracts';
import { describe, expect, it } from 'vitest';
import { loadFamily } from './support/datasets';
import { bitsKey, firstBitDifference, runRequest, samplesOf, type Sample } from './support/run';

interface Vt09 {
  readonly id: string;
  readonly inputs: { readonly requests: readonly SimulationRequest[] };
  readonly outputs: { readonly commonTimes_s: readonly number[] };
}

const datasets = loadFamily('vt-09').map((d) => ({ file: d.file, data: d.data as Vt09 }));

describe('VT-09 sampling independence (exact, Object.is at common t_s)', () => {
  it.each(datasets)('$file', ({ file, data }) => {
    const results = data.inputs.requests.map((r) => runRequest(r));
    results.forEach((r) => {
      expect(r.status, `${file}: ${JSON.stringify(r.diagnostics)}`).toBe('ok');
    });
    const maps = results.map((r) => {
      const m = new Map<string, Sample>();
      for (const s of samplesOf(r)) m.set(`${String(s.segment)}:${bitsKey(s.t)}`, s);
      return m;
    });
    const [first, ...rest] = maps;
    if (first === undefined) throw new Error('no runs');
    const failures: string[] = [];
    let common = 0;
    const commonTimes = new Set<string>();
    for (const [key, s] of first) {
      const others = rest.map((m) => m.get(key));
      if (others.some((o) => o === undefined)) continue;
      common++;
      commonTimes.add(bitsKey(s.t));
      others.forEach((o, i) => {
        if (o === undefined) return;
        const d = firstBitDifference([s.r, s.v], [o.r, o.v]);
        if (d !== null) {
          failures.push(
            `t=${String(s.t)} seg ${String(s.segment)} step #0 vs #${String(i + 1)}: ${d}`,
          );
        }
      });
    }
    // Every common time of the independent §5.2 grids is present in the runs.
    for (const t of data.outputs.commonTimes_s) {
      expect(commonTimes.has(bitsKey(t)), `${file}: common time ${String(t)} missing`).toBe(true);
    }
    expect(common).toBeGreaterThanOrEqual(data.outputs.commonTimes_s.length);
    for (let i = 1; i < results.length; i++) {
      const d = firstBitDifference(results[0]?.events, results[i]?.events);
      if (d !== null) failures.push(`events step #0 vs #${String(i)}: ${d}`);
    }
    console.log(
      `[conformance] VT-09 ${file}: ${String(common)} common samples compared, ${String(failures.length)} differ`,
    );
    expect(failures, file).toEqual([]);
  });
});
