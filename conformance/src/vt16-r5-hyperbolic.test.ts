/**
 * Revision-5 hyperbolic conformance (tolerances.md revision 5 §4.1 item 6, §6.8, §7 VT-16, §9.3.1,
 * §9.3.2 item 6; ML-TASK-018 part D3). GATED: runs only with ML_CONFORMANCE_REV5=1 and once the
 * record's header records the owner's approval of revision 5 (support/rev5-gate.ts). Committed in
 * phase 1 before any engine run on these cases.
 *
 * One file on purpose (review N2): the asserted state rows depend on the extended O-1 check in
 * code. Vitest runs the tests of one file in order, so suite 1 (O-1) completes before suites 2–3,
 * and every test of suites 2–3 fails unless every O-1 case ran and passed in this same run
 * (§4.1 item 6 (c)). Condition (b), selfcheck.py --repro --restart on both restart directories, is
 * a Python step that cannot be checked here; the run counts only if it passed too (record §4.1
 * item 6, conformance/l3-restart-r5/README.md).
 *
 * 1. Extended O-1 check (§6.8, O-12): for every case of test-data/reference-cases/o1-hyp-r5 the
 *    engine's χ̂ (`diagnostics.universalAnomaly_sqrtm` of the public `propagateKeplerUniversal`,
 *    called directly, not through runSimulation) goes into the universal time equation evaluated in
 *    320-bit from the exact binary64 input (`o1HypResidual`); pass when |t(χ̂) − Δt| ≤ the committed
 *    threshold ε_t,gen + δt_α,hyp.
 * 2. L2 (`vt-16-r4`, four arcs): engine segment 1 vs RK4 (L2b) from the engine's event state with
 *    the committed reference step; ‖Δr‖ ≤ M·P_E,gen + 2E_RK, ‖Δv‖ ≤ M·V_E,gen + 2E_RK; first sample
 *    exact (R8); the dataset's E_RK transfer condition (event state within 1e-6 relative of the
 *    reference start) asserted.
 * 3. L3 (`l3-r4-vt-16`, hyperbolic segment 1 of c1-escape-prograde and c3-midrun-escape): engine
 *    segment 1 vs an Orekit arc restarted from the engine's event state (§9.3.2 items 2 and 6): c3
 *    from conformance/l3-restart (run 3), c1 from conformance/l3-restart-r5 (phase 2); 3M·P_E,gen,
 *    3M·V_E,gen; first sample exact; a restarted arc is used only if its recorded start state equals
 *    the engine's current event state bit-for-bit.
 *
 * No value in suites 2–3 is new: the tolerances were committed with vt-16-r4 and l3-r4-vt-16 before
 * conformance run 3 (976380b), unchanged; their stored `assertion` and `comparedWith` fields are
 * superseded by §4.1 item 6 (the files are not changed).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { propagateKeplerUniversal } from '@mission-lab/astrodynamics';
import type { SimulationRequest, SimulationResult } from '@mission-lab/contracts';
import { MARGIN, U, decodeValue, integrateRK4, o1HypResidual } from '@mission-lab/verification';
import { afterAll, describe, expect, it } from 'vitest';
import { bitIdentical, diffNorm, fmt, fmtV, RatioRecorder } from './support/compare';
import { REFERENCE_CASES_DIR, loadFamily, type V3 } from './support/datasets';
import { L3_RESTART_DIR, loadL3, numArray, obj, withRequestId } from './support/l3';
import { rev5Enabled } from './support/rev5-gate';
import { norm3, runRequest, segmentSamples } from './support/run';

const enabled = rev5Enabled();

// ---------------------------------------------------------------------------------------------
// Inputs (no engine)

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

const O1_DIR = join(REFERENCE_CASES_DIR, 'o1-hyp-r5');
const o1Cases = readdirSync(O1_DIR)
  .filter((n) => n.endsWith('.json'))
  .sort()
  .map((n) => JSON.parse(readFileSync(join(O1_DIR, n), 'utf8')) as HypFile)
  .flatMap((f) => f.cases.map((c) => ({ ...c, file: f.id, mu: f.inputs.constants.mu_m3ps2 })));

/** Orekit arcs restarted for revision 5 (§9.3.2 item 6). */
const L3_RESTART_R5_DIR = join(L3_RESTART_DIR, '..', 'l3-restart-r5');

interface Seg {
  readonly t_s: readonly number[];
  readonly position_m: readonly V3[];
  readonly velocity_mps: readonly V3[];
}

interface Vt16R4 {
  readonly inputs: { readonly request: SimulationRequest; readonly maneuverTime_s: number };
  readonly outputs: {
    readonly startState: { readonly position_m: V3; readonly velocity_mps: V3 };
    readonly t_s: readonly number[];
    readonly dt_s: readonly number[];
    readonly l2b: { readonly outputBase_s: number; readonly referenceStep_s: number };
  };
  readonly tolerance: {
    readonly vsL2b_position_m: readonly number[];
    readonly vsL2b_velocity_mps: readonly number[];
    readonly assertion: string;
  };
}

interface L3Vt16 {
  readonly inputs: {
    readonly requestBody: Omit<SimulationRequest, 'requestId'>;
    readonly maneuverTime_s: number;
    readonly elements: { readonly eccentricity: number };
  };
  readonly outputs: { readonly event: { readonly deltaV_inertial_mps: V3 } };
}

interface Restart {
  readonly inputs: {
    readonly l3Dataset: string;
    readonly maneuverTime_s: number;
    readonly position_m: V3;
    readonly velocityAfter_mps: V3;
  };
  readonly outputs: Seg;
}

const l2 = loadFamily('vt-16-r4').map((d) => ({ file: d.file, data: d.data as Vt16R4 }));
const l3 = loadL3<L3Vt16>('vt-16').filter(
  (c) => obj(obj(c.tol.tolerance).segment1).kind === 'hyperbolic',
);

const o1Ratios = new RatioRecorder('O-1 hyperbolic (revision 5, gated)');
const rec = new RatioRecorder('VT-16 hyperbolic states (revision 5, ASSERTED, gated)');

afterAll(() => {
  if (enabled) {
    console.log(o1Ratios.summary());
    console.log(rec.summary());
  }
});

describe('revision-5 hyperbolic inputs (no engine)', () => {
  it('o1-hyp-r5: the six arcs and the 144-case grid', () => {
    expect(o1Cases.length).toBe(6 + 144);
  });
  it('four L2 arcs and two L3 hyperbolic arcs, stored as informative (superseded by §4.1 item 6)', () => {
    expect(l2).toHaveLength(4);
    expect(l3.map((c) => c.caseId)).toEqual(['c1-escape-prograde', 'c3-midrun-escape']);
    for (const d of l2) expect(d.data.tolerance.assertion).toBe('informative');
    for (const c of l3) expect(obj(obj(c.tol.tolerance).segment1).assertion).toBe('informative');
  });
});

// ---------------------------------------------------------------------------------------------
// 1. Extended O-1 check (O-12). Its outcome is the precondition of suites 2 and 3.

const o1Status = { ran: 0, failed: 0 };

/** §4.1 item 6 (c): every O-1 case ran and passed in this run. */
function expectO1Passed(): void {
  expect(
    o1Status.ran === o1Cases.length && o1Status.failed === 0,
    `precondition §4.1 item 6 (c): extended O-1 check must pass in the same run (ran ${String(o1Status.ran)}/${String(o1Cases.length)}, failed ${String(o1Status.failed)})`,
  ).toBe(true);
}

describe.skipIf(!enabled)('1. O-1 on hyperbolic arcs (revision 5, GATED)', () => {
  it.each(o1Cases)(
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
        const quantity = c.file.endsWith('/grid') ? 'grid' : 'VT-16 arcs';
        const q = o1Ratios.record(quantity, res, thr, where);
        if (!(res <= thr)) {
          failures.push(
            `${where}: r0 ${fmtV(c.startState.position_m)} v0 ${fmtV(c.startState.velocity_mps)} χ̂ ${String(chi)}: |t(χ̂) − Δt| ${fmt(res)} s > ε_t,gen + δt_α,hyp ${fmt(thr)} s (×${q.toPrecision(3)})`,
          );
        }
      });
      o1Status.ran += 1;
      if (failures.length > 0) o1Status.failed += 1;
      expect(failures).toEqual([]);
    },
    300_000,
  );
});

// ---------------------------------------------------------------------------------------------
// 2–3. Asserted hyperbolic state rows

function compareSeg(
  label: string,
  engine: { t: number; r: V3; v: V3 }[],
  ref: (k: number) => { r: V3; v: V3 } | undefined,
  tolR: readonly number[],
  tolV: readonly number[],
): string[] {
  const f: string[] = [];
  engine.forEach((s, k) => {
    const b = ref(k);
    if (b === undefined) {
      f.push(`${label} k=${String(k)}: missing reference`);
      return;
    }
    const tr = tolR[k] ?? NaN;
    const tv = tolV[k] ?? NaN;
    if (k === 0) {
      if (tr !== 0 || tv !== 0) f.push(`${label} k=0: first sample must be exact`);
      if (!(bitIdentical(s.r, b.r) && bitIdentical(s.v, b.v)))
        f.push(`${label} k=0: exact first sample differs`);
      return;
    }
    const where = `${label} k=${String(k)} t=${String(s.t)}`;
    const dr = diffNorm(s.r, b.r);
    const dv = diffNorm(s.v, b.v);
    const layer = label.split(' ')[0] ?? '';
    const qr = rec.record(`${layer} position`, dr, tr, where);
    const qv = rec.record(`${layer} velocity`, dv, tv, where);
    if (!(dr <= tr) || !(dv <= tv))
      f.push(
        `${where}: |Δr| ${fmt(dr)} tol ${fmt(tr)} (×${qr.toPrecision(3)}), |Δv| ${fmt(dv)} tol ${fmt(tv)} (×${qv.toPrecision(3)}); engine r ${fmtV(s.r)} ref r ${fmtV(b.r)}`,
      );
  });
  return f;
}

describe.skipIf(!enabled)('2. VT-16 hyperbolic arcs vs L2b (revision 5, ASSERTED, GATED)', () => {
  it.each(l2)('$file', ({ file, data }) => {
    const req = data.inputs.request;
    const mu = req.constants.mu_m3ps2;
    const m = data.inputs.maneuverTime_s;
    const result = runRequest(req);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    const seg = segmentSamples(result, 1);
    expect(seg.map((s) => s.t)).toEqual(data.outputs.t_s);
    const start = { position_m: e.position_m, velocity_mps: e.velocityAfter_mps };
    const ref0 = data.outputs.startState;
    const relR = diffNorm(start.position_m, ref0.position_m) / norm3(ref0.position_m);
    const relV = diffNorm(start.velocity_mps, ref0.velocity_mps) / norm3(ref0.velocity_mps);
    expect(relR <= 1e-6 && relV <= 1e-6, `${file}: E_RK transfer condition`).toBe(true);
    const { outputBase_s: base, referenceStep_s: h } = data.outputs.l2b;
    const dtEnd = data.outputs.dt_s[data.outputs.dt_s.length - 1] ?? NaN;
    const rk = integrateRK4(start, mu, h, Math.round(dtEnd / h), Math.round(base / h));
    const f = compareSeg(
      `L2 ${file}`,
      seg,
      (k) => {
        const s = seg[k];
        if (s === undefined) return undefined;
        if (k === 0) return { r: start.position_m, v: start.velocity_mps };
        const b = rk[Math.round((s.t - m) / base)];
        return b === undefined ? undefined : { r: b.position_m, v: b.velocity_mps };
      },
      data.tolerance.vsL2b_position_m,
      data.tolerance.vsL2b_velocity_mps,
    );
    expectO1Passed();
    expect(f, file).toEqual([]);
  });
});

const results = new Map<string, SimulationResult>();
function resultOf(file: string, body: Omit<SimulationRequest, 'requestId'>): SimulationResult {
  const cached = results.get(file);
  if (cached !== undefined) return cached;
  const r = runRequest(withRequestId(body));
  results.set(file, r);
  return r;
}

// Writer mode (phase 2 only, behind the gate): engine event state of c1-escape-prograde (m = 0)
// for verification/l3-d2/restart.py, run through conformance/l3-restart-r5/restart_r5.py.
if (enabled && process.env.ML_WRITE_R5_EVENT_STATES === '1') {
  const out = l3
    .filter((c) => c.caseId === 'c1-escape-prograde')
    .map((c) => {
      const r = resultOf(c.file, c.data.inputs.requestBody);
      const e = r.events[0];
      if (e === undefined) throw new Error('no event');
      const tol1 = obj(obj(c.tol.tolerance).segment1);
      return {
        case: c.caseId,
        l3Dataset: c.file,
        maneuverTime_s: e.t_s,
        position_m: e.position_m,
        velocityAfter_mps: e.velocityAfter_mps,
        t_s: numArray(tol1.t_s),
      };
    });
  const engineRevision = execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  mkdirSync(L3_RESTART_R5_DIR, { recursive: true });
  writeFileSync(
    join(L3_RESTART_R5_DIR, 'engine-event-states.json'),
    `${JSON.stringify({ engineRevision, cases: out }, null, 2)}\n`,
    'utf8',
  );
}

describe.skipIf(!enabled)('3. L3 VT-16 hyperbolic segment 1 (revision 5, ASSERTED, GATED)', () => {
  it.each(l3)('$file', ({ file, caseId, data, tol }) => {
    const s1 = obj(obj(tol.tolerance).segment1);
    const result = resultOf(file, data.inputs.requestBody);
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ok');
    const e = result.events[0];
    if (e === undefined) throw new Error('no event');
    if (caseId === 'c1-escape-prograde') {
      // Review N4: the premise of §9.3.2 item 6 for the m = 0 arc. (i) The engine's pre-maneuver
      // event state is the request's initialState bit-for-bit (§1 precondition row). (ii) Engine and
      // Orekit Δv_I differ by at most the approved L3 VT-12 row (§9.3.1),
      // 3M(12κ_h + 25)u‖Δv_RSW‖ = 12(12κ_h + 25)u‖Δv_RSW‖, κ_h = 1/√(1 − e²) of the grid case
      // (reference side; 1.972e-10 m/s for this case, recorded in §9.3.2 item 6).
      const init = data.inputs.requestBody.initialState;
      expect(
        bitIdentical(e.position_m, init.position_m) &&
          bitIdentical(e.velocityBefore_mps, init.velocity_mps),
        `${file}: engine pre-maneuver event state differs from initialState`,
      ).toBe(true);
      const man = data.inputs.requestBody.maneuvers[0];
      if (man === undefined) throw new Error('maneuver');
      const ecc = data.inputs.elements.eccentricity;
      const kappaH = 1 / Math.sqrt(1 - ecc * ecc);
      const dvTol = 3 * MARGIN * (12 * kappaH + 25) * U * norm3(man.deltaV_mps);
      const dDv = diffNorm(e.deltaV_inertial_mps, data.outputs.event.deltaV_inertial_mps);
      rec.record('L3 c1 Δv_I engine − Orekit', dDv, dvTol, file);
      expect(
        dDv,
        `${file}: ‖Δv_I,engine − Δv_I,Orekit‖ ${fmt(dDv)} > ${fmt(dvTol)}`,
      ).toBeLessThanOrEqual(dvTol);
    }
    const dir = caseId === 'c1-escape-prograde' ? L3_RESTART_R5_DIR : L3_RESTART_DIR;
    const path = join(dir, `${caseId}.json`);
    expect(existsSync(path), `${file}: restarted Orekit arc missing (${path}); run phase 2`).toBe(
      true,
    );
    const rs = decodeValue(JSON.parse(readFileSync(path, 'utf8'))) as Restart;
    expect(rs.inputs.l3Dataset).toBe(file);
    expect(
      Object.is(rs.inputs.maneuverTime_s, e.t_s) &&
        bitIdentical(rs.inputs.position_m, e.position_m) &&
        bitIdentical(rs.inputs.velocityAfter_mps, e.velocityAfter_mps),
      `${file}: restarted arc was produced from another event state (stale); regenerate`,
    ).toBe(true);
    const ts = numArray(s1.t_s);
    const seg = segmentSamples(result, 1);
    expect(seg.map((s) => s.t)).toEqual(ts);
    expect(rs.outputs.t_s).toEqual(ts);
    const f = compareSeg(
      `L3 ${file}`,
      seg,
      (k) => {
        const r = rs.outputs.position_m[k];
        const v = rs.outputs.velocity_mps[k];
        return r === undefined || v === undefined ? undefined : { r, v };
      },
      numArray(s1.position_m),
      numArray(s1.velocity_mps),
    );
    expectO1Passed();
    expect(f, file).toEqual([]);
  });
});
