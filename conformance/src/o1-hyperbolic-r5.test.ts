/**
 * Extended O-1 solver acceptance check on hyperbolic arcs (tolerances.md revision 5 §6.8, §12 O-12;
 * ML-TASK-018 part D3). GATED: runs only with ML_CONFORMANCE_REV5=1 and once the record's status
 * line records the owner's approval of revision 5 (support/rev5-gate.ts). Committed in phase 1
 * before any engine run on these cases.
 *
 * For every case of test-data/reference-cases/o1-hyp-r5 (six VT-16 hyperbolic arcs, every Δt > 0;
 * a 96-case grid) the engine's χ̂ (`diagnostics.universalAnomaly_sqrtm` of the public
 * `propagateKeplerUniversal`, as in o1-solver-residual.test.ts) is put into the universal time
 * equation evaluated in 320-bit arithmetic from the exact binary64 input (`o1HypResidual`); pass
 * when |t(χ̂) − Δt| ≤ the committed threshold ε_t,gen + δt_α,hyp (reference side, never formed
 * from engine output).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { propagateKeplerUniversal } from '@mission-lab/astrodynamics';
import { o1HypResidual } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { fmt, fmtV, RatioRecorder } from './support/compare';
import { REFERENCE_CASES_DIR, type V3 } from './support/datasets';
import { rev5Enabled } from './support/rev5-gate';

interface HypCase {
  readonly label: string;
  readonly startState: { readonly position_m: V3; readonly velocity_mps: V3 };
  readonly dt_s: readonly number[];
  readonly threshold_s: readonly number[];
}

interface HypFile {
  readonly id: string;
  readonly inputs: { readonly constants: { readonly mu_m3ps2: number } };
  readonly cases: readonly HypCase[];
}

const DIR = join(REFERENCE_CASES_DIR, 'o1-hyp-r5');
const files: HypFile[] = readdirSync(DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => JSON.parse(readFileSync(join(DIR, n), 'utf8')) as HypFile);
const cases = files.flatMap((f) =>
  f.cases.map((c) => ({ ...c, file: f.id, mu: f.inputs.constants.mu_m3ps2 })),
);

const enabled = rev5Enabled();
const ratios = new RatioRecorder('O-1 hyperbolic (revision 5, gated)');

afterAll(() => {
  if (enabled) console.log(ratios.summary());
});

describe('O-1 hyperbolic dataset (no engine)', () => {
  it('has the six arcs and the 96-case grid', () => {
    expect(cases.length).toBe(102);
  });
});

describe.skipIf(!enabled)('O-1 on hyperbolic arcs (revision 5, GATED)', () => {
  it.each(cases)(
    '$file $label',
    (c) => {
      const failures: string[] = [];
      c.dt_s.forEach((dt, k) => {
        const where = `${c.file} ${c.label} k=${String(k)} Δt=${String(dt)}`;
        const r = propagateKeplerUniversal(
          c.mu,
          c.startState.position_m,
          c.startState.velocity_mps,
          dt,
        );
        if (!r.ok) {
          failures.push(`${where}: engine returned ${r.reason}`);
          return;
        }
        const chi = r.diagnostics.universalAnomaly_sqrtm;
        if (chi === null) {
          failures.push(`${where}: engine reports no χ̂`);
          return;
        }
        const res = o1HypResidual(
          {
            mu_m3ps2: c.mu,
            position_m: c.startState.position_m,
            velocity_mps: c.startState.velocity_mps,
          },
          dt,
          chi,
        );
        const thr = c.threshold_s[k] ?? NaN;
        const q = ratios.record(c.label.startsWith('a=') ? 'grid' : 'VT-16 arcs', res, thr, where);
        if (!(res <= thr)) {
          failures.push(
            `${where}: r0 ${fmtV(c.startState.position_m)} v0 ${fmtV(c.startState.velocity_mps)} χ̂ ${String(chi)}: |t(χ̂) − Δt| ${fmt(res)} s > ε_t,gen + δt_α,hyp ${fmt(thr)} s (×${q.toPrecision(3)})`,
          );
        }
      });
      expect(failures).toEqual([]);
    },
    300_000,
  );
});
