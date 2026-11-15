/**
 * Reference datasets of ML-TASK-018 part D2 (tolerance record revision 4, approved by the owner on
 * 2026-11-15). Three groups, all NEW files (the run-2 datasets are not touched; §4.1 item 5):
 *
 *  1. `vt-15-r4/` — new versions of the fourteen L2 VT-15 cases carrying the revision-4 values of
 *     §7 VT-15 (corrected tangential formula, non-tangential a⁺/e⁺, plane-normal and
 *     plane-rotation rows). Same requests as version 1.
 *  2. `vt-16-r4/` — new versions of the four L2 hyperbolic VT-16 arcs inside the §7 VT-16 validity
 *     gate (escape-clear, hyperbolic-inbound, hyperbolic-outbound, c3-midrun-escape) with an L2b
 *     (RK4) trajectory, its step-halving E_RK (§9.2), a validation of L2b against an independent
 *     high-precision hyperbolic propagation, and the §6.8 per-sample values M·P_E,gen + 2E_RK.
 *  3. `l3-r4-<family>/` — the revision-4 L3 tolerances (§9.3, §9.3.1, §9.3.2) for the Orekit datasets of
 *     test-data/l3-orekit/, evaluated from the reference side of those files (§4.1 item 2) and
 *     committed before any engine comparison with them (§4.1 item 1; record item C-8: the values
 *     stored inside the Orekit files are not used).
 *
 * Independence: written without reading packages/astrodynamics or packages/simulation (ADR-003);
 * imports only verification references and @mission-lab/contracts types.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CartesianState } from '@mission-lab/contracts';
import { add, sqrt, toNumber } from '../hp/bigfloat';
import { hpPrepare, hpPropagate, hpDist } from '../hp/hp-kepler';
import { b3, crossB, dotB, normB, toV3, unitB, type B3 } from '../hp/hp-vec';
import { samplingGridWithManeuvers } from '../ref/grid';
import { hypPrepare, hypPropagate } from '../ref/hyperbolic';
import { conicOfState, postManeuverClosedForm } from '../ref/maneuver';
import { RK_ORDER, rk4WithHalving } from '../ref/rk';
import { rswToInertialB, rswToInertialHp } from '../ref/rsw';
import type { V3 } from '../ref/vec';
import { E_RK_TARGET_REL, MARGIN, U, scales, type Scales } from '../tol/tolerances';
import {
  L3_FACTOR,
  VT16_VALIDITY_GATE,
  hyperbolicBound,
  prepareHyperbolicArc,
  propagationL3,
  vt02L3,
  vt12L3,
  vt15L3,
  vt15R4,
  type BurnKind,
  type HyperbolicArc,
  type Vt15Inputs,
} from '../tol/tolerances-r4';
import { CONSTANTS, type DatasetFile, type Provenance, type RequestIdFn } from './build';
import {
  REQUEST_ID_NOTE,
  VT15,
  VT16,
  gridCase,
  maneuver,
  model,
  request,
  scaleInputs,
  scaleOf,
  stateFromElements,
  v3,
  withAnomaly,
  type Vt15Spec,
} from './build-c';
import { decodeValue } from './encoding';

const MU = CONSTANTS.mu_m3ps2;
export const RECORD_R4 =
  'docs/verification/tolerances.md revision 4 (approved by the owner 2026-11-15)';
const STATUS =
  'New dataset version (tolerances.md §4.1 item 5), committed before any engine run on it (§4.1 item 1; ML-TASK-018 part D2 phase 1). Not yet reviewed or approved; immutable once approved, corrections create a new version (plan §6).';

function producedBy(prov: Provenance, references: string[]): Record<string, unknown> {
  return {
    tool: '@mission-lab/verification (ML-TASK-018 part D2), verification/src/datasets/build-d2.ts',
    references,
    codeRevision: prov.codeRevision,
    date: prov.date,
    runtime: prov.runtime,
    independence:
      'packages/astrodynamics and packages/simulation not read and not run (ADR-003); references import nothing from the engine.',
    numberFormat:
      'Every number is the shortest decimal that round-trips to the binary64 value; JSON.parse restores the exact binary64. Signs of zero are not preserved (−0 written as 0).',
  };
}

function norm3(a: readonly number[]): number {
  return Math.hypot(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
}

/** Post-maneuver velocity vector of the exact RSW maneuver, 320-bit (B3), from (r, v⁻, Δv_RSW). */
function exactVPlusB(r: V3, v: V3, dv: V3): B3 {
  const dvI = rswToInertialB(r, v, dv);
  const vb = b3(v);
  return [add(vb[0], dvI[0]), add(vb[1], dvI[1]), add(vb[2], dvI[2])];
}

// =============================================================================================
// 1. VT-15 new versions (§7 VT-15 revision 4)

export interface Vt15R4Case {
  readonly spec: Vt15Spec;
  readonly state: CartesianState;
  readonly dv: V3;
  readonly m: number;
  readonly inputs: Vt15Inputs;
  readonly planeNormalAfter: V3;
  readonly planeRotation_rad: number;
  readonly cf: ReturnType<typeof postManeuverClosedForm>;
}

/** Reference-side inputs of a VT-15 case (shared by the builder and the transcription test). */
export function vt15R4Case(sp: Vt15Spec): Vt15R4Case {
  const g = gridCase(sp.orbit);
  const el = withAnomaly(g.elements, sp.nu);
  const state = stateFromElements(el);
  const sPre = scaleOf(el);
  let dv: V3;
  if (sp.dv === 'circularise') {
    const pre = conicOfState(MU, state.position_m, state.velocity_mps);
    const cf0 = postManeuverClosedForm(MU, state.position_m, state.velocity_mps, [0, 0, 0]);
    dv = [0, Math.sqrt(MU / pre.radius_m) - cf0.vTransverse_mps, 0];
  } else {
    dv = sp.dv;
  }
  const m = sp.atPeriod ? sPre.T : 0;
  const cf = postManeuverClosedForm(MU, state.position_m, state.velocity_mps, dv);
  const vPlusB = exactVPlusB(state.position_m, state.velocity_mps, dv);
  const hPlusB = crossB(b3(state.position_m), vPlusB);
  const inputs: Vt15Inputs = {
    sPre,
    kind: sp.kind,
    m,
    dv: norm3(dv),
    aPlus: cf.semiMajorAxis_m,
    ePlus: cf.eccentricity,
    r: cf.radius_m,
    vPlus: toNumber(normB(vPlusB)),
    hPlus: cf.angularMomentum_m2ps,
    mu: MU,
  };
  return {
    spec: sp,
    state,
    dv,
    m,
    inputs,
    planeNormalAfter: toV3(unitB(hPlusB)),
    planeRotation_rad: cf.planeRotation_rad,
    cf,
  };
}

function vt15R4File(sp: Vt15Spec, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const c = vt15R4Case(sp);
  const g = gridCase(sp.orbit);
  const req = request(c.state, c.m + 600, 60, [maneuver('m1', c.m, c.dv)], requestIdOf);
  const tol = vt15R4(c.inputs);
  const tangential = sp.kind === 'apsis-tangential';
  return {
    path: `test-data/reference-cases/vt-15-r4/${sp.id}.json`,
    data: {
      id: `vt-15-r4/${sp.id}`,
      version: 2,
      previousVersion:
        'vt-15/' +
        sp.id +
        ' version 1 (test-data/reference-cases/vt-15, run in conformance run 2; keeps its approved values, tolerances.md §4.1 item 5 (ii))',
      family: 'VT-15 Post-maneuver orbit (ML-FR-006 AC5, ML-FR-010 AC3)',
      description: `${g.description}, ν₀ = ${String(sp.nu)} rad; ${sp.kind} burn Δv_RSW = [${c.dv.join(', ')}] m/s at t_s = ${String(c.m)} s.`,
      gridCase: g.recordCase,
      kind: sp.kind,
      status: STATUS,
      inputs: {
        request: req,
        requestIdNote: REQUEST_ID_NOTE,
        elements: withAnomaly(g.elements, sp.nu),
        maneuverTime_s: c.m,
      },
      model: model(),
      producedBy: producedBy(prov, [
        'Closed form in RSW coordinates (ref/maneuver.ts, 320-bit)',
        'Exact post-maneuver plane normal (ref/rsw.ts projection-form basis, 320-bit, rounded once)',
      ]),
      method: {
        comparisonMode:
          c.m === 0
            ? 'A at m = 0: the reference applies the burn exactly to the request initialState, which the engine pre-maneuver state must equal bit-for-bit (tolerances.md §1 precondition row; checked by the test).'
            : 'A at m > 0, allowed only for a tangential burn at an apsis (§7 VT-15, review B1): reference from the exact initial state (the same apsis one period later; phase error second order), tilt term added to the plane rows.',
        closedForm:
          'a⁺, e⁺, plane rotation δ = atan2(|ΔvW|, v_s + ΔvS) from the exact RSW maneuver (as version 1). Plane normal ĥ⁺_ref = (r × v⁺)/‖r × v⁺‖ with v⁺ = v⁻ + ΔvR R + ΔvS S + ΔvW W, all in 320-bit, rounded once per component.',
        engineSide:
          'Test, binary64, from the event: a⁺ = 1/(2/r − v⁺²/μ); e⁺ = ‖[(v⁺² − μ/r) r − (r·v⁺) v⁺]/μ‖; ĥ = (r × v)/‖r × v‖ from (position_m, velocityAfter_mps) and (position_m, velocityBefore_mps); ψ = atan2(‖ĥ⁻ × ĥ⁺‖, ĥ⁻·ĥ⁺) (atan2 form required, §7 VT-15).',
      },
      outputs: {
        burnRadius_m: c.cf.radius_m,
        semiMajorAxisAfter_m: c.cf.semiMajorAxis_m,
        eccentricityAfter: c.cf.eccentricity,
        speedAfter_mps: c.inputs.vPlus,
        angularMomentumAfter_m2ps: c.inputs.hPlus,
        planeNormalAfter: c.planeNormalAfter,
        planeRotation_rad: c.planeRotation_rad,
      },
      referenceAccuracy: {
        closedForm:
          '320-bit evaluation, rounded once: ≤ 1 ulp per value, below the binary64 reference share counted in every row (§7 VT-15).',
      },
      tolerance: {
        record: `${RECORD_R4} §7 VT-15 (revision 4, P-2), "new version" column`,
        formula: tangential
          ? '|δa⁺|/a⁺ ≤ M[[m > 0]τ_E,eng(m)a⁺/a⁻ + 11u(4a⁺/r − 1) + max(0, 24a⁺v⁺Δv/μ − 1)u]; |δe⁺| ≤ M[(r/a⁺)(|δa⁺|/a⁺)/M + 60u], or for e⁺ < 1e-6 the general formula M[(4rv⁺/μ)((12κ_h⁻ + 25)u‖Δv‖ + uv⁺) + 60u]; δψ_n ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14) + [m > 0]2(P_b v⁺ + rV_b)/h⁺]; |δψ| ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14) + 12uκ_h⁻ + 32u + [m > 0]2(P_b v⁺ + rV_b)/h⁺]'
          : '|δa⁺|/a⁺ ≤ M[11u(4a⁺/r − 1) + 2a⁺v⁺(12κ_h⁻ + 25)u‖Δv‖/μ]; |δe⁺| ≤ M[(4rv⁺/μ)((12κ_h⁻ + 25)u‖Δv‖ + uv⁺) + 60u]; δψ_n ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14)]; |δψ| ≤ M[κ_h⁺u(2(12κ_h⁻ + 25)‖Δv‖/v⁺ + 14) + 12uκ_h⁻ + 32u]',
        evaluatedAt: {
          ...scaleInputs(c.inputs.sPre),
          m_s: c.m,
          deltaV_mps: c.inputs.dv,
          aPlus_m: c.inputs.aPlus,
          ePlus: c.inputs.ePlus,
          r_m: c.inputs.r,
          vPlus_mps: c.inputs.vPlus,
          hPlus_m2ps: c.inputs.hPlus,
          kappa_hPlus: tol.kappaHPlus,
        },
        semiMajorAxis_rel: tol.aRelative,
        eccentricity_abs: tol.eAbsolute,
        eccentricityFormula: tol.eFormula,
        planeNormal_rad: tol.planeNormal_rad,
        planeRotation_rad: tol.planeRotation_rad,
        layers: 'L1 closed form (exact maneuver, 320-bit)',
        assertion: 'asserted',
      },
    },
  };
}

// =============================================================================================
// 2. VT-16 hyperbolic arcs, new versions with L2b (§6.8, §7 VT-16 revision 4)

export const VT16_R4_IDS = [
  'escape-clear',
  'hyperbolic-inbound',
  'hyperbolic-outbound',
  'c3-midrun-escape',
] as const;

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

export interface Vt16R4Case {
  readonly id: string;
  readonly state: CartesianState;
  readonly pre: CartesianState;
  readonly dv: V3;
  readonly m: number;
  readonly D: number;
  readonly start: CartesianState;
  readonly t: readonly number[];
  readonly arc: HyperbolicArc;
}

/** Reference-side post-maneuver state and arc of an L2 hyperbolic VT-16 case. */
export function vt16R4Case(id: string): Vt16R4Case {
  const sp = VT16.find((s) => s.id === id);
  if (sp === undefined || typeof sp.duration !== 'number' || typeof sp.m !== 'number') {
    throw new Error(`VT-16 r4 ${id}: unexpected spec`);
  }
  if (!Array.isArray(sp.dv)) throw new Error(`VT-16 r4 ${id}: Δv must be explicit`);
  const dv = sp.dv as V3;
  const g = gridCase(sp.orbit ?? '');
  const state = stateFromElements(g.elements);
  const m = sp.m;
  const D = sp.duration;
  let pre: CartesianState = state;
  if (m !== 0) {
    // Reference pre-maneuver state at m: L2a in 200-bit arithmetic (as version 1).
    const hp = hpPrepare(state.position_m, state.velocity_mps, MU);
    const s = hpPropagate(hp, m);
    pre = { position_m: toV3(s.position_m), velocity_mps: toV3(s.velocity_mps) };
  }
  const dvI = rswToInertialHp(pre.position_m, pre.velocity_mps, dv);
  const start: CartesianState = {
    position_m: pre.position_m,
    velocity_mps: [
      pre.velocity_mps[0] + dvI[0],
      pre.velocity_mps[1] + dvI[1],
      pre.velocity_mps[2] + dvI[2],
    ],
  };
  const grid = samplingGridWithManeuvers(D, 60, [m]);
  const t = grid.segments[1];
  if (t === undefined) throw new Error('segment 1');
  const dtEnd = (t[t.length - 1] ?? NaN) - m;
  const arc = prepareHyperbolicArc(MU, start.position_m, start.velocity_mps, dtEnd);
  return { id, state, pre, dv, m, D, start, t, arc };
}

function arcRecord(arc: HyperbolicArc): Record<string, number | boolean> {
  return {
    energy_Jpkg: arc.energy,
    energyOverScaleAtStart: arc.energyRatio,
    aAbs_m: arc.aAbs,
    e: arc.e,
    p_m: arc.p,
    n_h_radps: arc.nH,
    sinhF0: arc.sinhF0,
    coshF0: arc.coshF0,
    q0: arc.q0,
    cosPhi0: arc.cosPhi0,
    dtEnd_s: arc.dtEnd,
    xEnd: arc.xEnd,
    rEnd_m: arc.rEnd,
    periapsisPassed: arc.periapsisPassed,
    r_min_m: arc.rMin,
    r_max_m: arc.rMax,
    v_max_mps: arc.vMax,
    g_max_mps2: arc.gMax,
    kappa_E: arc.kappaE,
    K_b_m: arc.Kb,
    K_bv_mps: arc.Kbv,
    P_bgen_m: arc.pBgen,
    V_bgen_mps: arc.vBgen,
    u: U,
    M: MARGIN,
  };
}

const O12_NOTE =
  'Informative, not asserted: §6.8 (Scope) states that ε_t,gen assumes the engine solve ends at the noise level on hyperbolic arcs, which is not verified (open item O-12), and §12 O-12 places the extension of the O-1 check to these arcs "before the hyperbolic state comparison". O-12 is open, so the comparison is measured and reported only (ML-TASK-018 part D2 instruction; see conformance-run-3.md).';

function vt16R4File(id: string, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const c = vt16R4Case(id);
  const arc = c.arc;
  if (!(arc.energyRatio >= VT16_VALIDITY_GATE)) {
    throw new Error(`VT-16 r4 ${id}: outside the validity gate`);
  }
  const req = request(c.state, c.D, 60, [maneuver('m1', c.m, c.dv)], requestIdOf);
  const dts = c.t.map((x) => x - c.m);
  if (!dts.every((d) => Number.isInteger(d))) throw new Error('integer Δt expected');
  const base = dts.slice(1).reduce((acc, d) => gcdInt(acc, d), 0);
  const nOut = arc.dtEnd / base;
  // Step rule (as part C, §9.2): the finest step base/spo, spo ∈ {64, 32, 16, 8, 4}, for which every
  // compared time is in the asymptotic regime and E_RK ≤ 1e-10 r_max.
  let chosen: { spo: number; rk: ReturnType<typeof rk4WithHalving> } | null = null;
  for (const spo of [64, 32, 16, 8, 4]) {
    const rk = rk4WithHalving(c.start, MU, base / spo, spo, nOut);
    const ok = dts.slice(1).every((d) => {
      const s = rk[d / base];
      return (
        s !== undefined && s.asymptotic_r && s.asymptotic_v && s.eRk_r <= E_RK_TARGET_REL * arc.rMax
      );
    });
    if (ok) {
      chosen = { spo, rk };
      break;
    }
  }
  if (chosen === null) throw new Error(`VT-16 r4 ${id}: no RK step met the §9.2 rule`);
  const rkAt = dts.map((d) => {
    const s = chosen.rk[d / base];
    if (s === undefined) throw new Error('rk index');
    return s;
  });
  // Validation of L2b by the independent high-precision hyperbolic propagation.
  const hyp = hypPrepare(c.start.position_m, c.start.velocity_mps, MU);
  const measR: number[] = [];
  const measV: number[] = [];
  dts.forEach((d, k) => {
    if (k === 0) {
      measR.push(0);
      measV.push(0);
      return;
    }
    const h = hypPropagate(hyp, d);
    const s = rkAt[k];
    if (s === undefined) throw new Error('rk');
    measR.push(hpDist(s.state.position_m, h.position_m));
    measV.push(hpDist(s.state.velocity_mps, h.velocity_mps));
  });
  const bounds = dts.map((d) => hyperbolicBound(arc, d));
  const eR = rkAt.map((s, k) => (k === 0 ? 0 : s.eRk_r));
  const eV = rkAt.map((s, k) => (k === 0 ? 0 : s.eRk_v));
  const sp = VT16.find((s) => s.id === id);
  return {
    path: `test-data/reference-cases/vt-16-r4/${id}.json`,
    data: {
      id: `vt-16-r4/${id}`,
      version: 2,
      previousVersion: `vt-16/${id} version 1 (warnings only; stateComparison null; run in conformance run 2, informative for the new rows, tolerances.md §4.1 item 5 (iii))`,
      family: 'VT-16 Escape / surface intersection (ML-FR-006 AC6): hyperbolic arc states',
      description: sp?.description ?? id,
      status: STATUS,
      inputs: {
        request: req,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: gridCase(sp?.orbit ?? '').elements,
        maneuverTime_s: c.m,
        deltaV_rsw_mps: c.dv,
      },
      model: model(),
      producedBy: producedBy(prov, [
        'L2b: classical RK4 with Kahan summation, step halving (ref/rk.ts)',
        'Validation: classical hyperbolic-anomaly perifocal propagation in 200-bit (ref/hyperbolic.ts)',
        'Pre-maneuver state at m > 0: L2a in 200-bit (hp/hp-kepler.ts)',
      ]),
      method: {
        startState:
          c.m === 0
            ? 'Reference post-maneuver state: request initialState position, velocity fl(v⁻ + Δv_I,ref) with Δv_I,ref the 320-bit projection-form value rounded once (R12 form). The test starts L2b at the engine event state (position_m, velocityAfter_mps), which differs from this by the VT-12 level only.'
            : 'Reference post-maneuver state: 200-bit L2a state at m and fl(v⁻ + Δv_I,ref). The test starts L2b at the engine event state (position_m, velocityAfter_mps) (§7 VT-16 "Maneuver at m > 0", VT-05 post-maneuver rule); E_RK measured from this reference start applies to it because the two start states differ by ≈ P_E(m) (relative ≲ 1e-12), a negligible change of the truncation error (checked by the test: relative difference ≤ 1e-6).',
        sampling: `Segment 1 of the contracts-v1.md §5.2 grid (ref/grid.ts): t_s from m to D; Δt = t − m. Output base ${String(base)} s.`,
        perSampleConvention:
          '§6.8 (review N4): arc-wide r_max, r_min, v_max, g_max, κ_E over the propagated arc [m, D]; x, r(t), Δt and the Δt-dependent terms per sample.',
      },
      outputs: {
        startState: { position_m: v3(c.start.position_m), velocity_mps: v3(c.start.velocity_mps) },
        arc: arcRecord(arc),
        t_s: c.t,
        dt_s: dts,
        l2b: {
          algorithm: `Classical RK4 (p = ${String(RK_ORDER)}), Kahan-compensated, fixed step; step halving h, h/2, h/4 (§9.2)`,
          outputBase_s: base,
          stepsPerOutputCoarsest: chosen.spo,
          rkStep_s: base / chosen.spo,
          referenceStep_s: base / chosen.spo / 4,
          eRk_r_m: eR,
          eRk_v_mps: eV,
          allAsymptotic: true,
          eRkTarget_m: E_RK_TARGET_REL * arc.rMax,
          position_m: rkAt.map((s) => v3(s.state.position_m)),
          velocity_mps: rkAt.map((s) => v3(s.state.velocity_mps)),
        },
        perSample: {
          x: bounds.map((b) => b.x),
          r_m: bounds.map((b) => b.r),
          epsTgen_s: bounds.map((b) => b.epsTgen),
          dtGgen_s: bounds.map((b) => b.dtGgen),
          dtPh_s: bounds.map((b) => b.dtPh),
        },
      },
      referenceAccuracy: {
        l2b: 'E_RK per sample (§9.2, undivided d₂); every compared time asymptotic; E_RK ≤ 1e-10 r_max (target met, no loosening).',
        validation:
          '‖L2b − hyperbolic 200-bit‖ per sample (measured_r_m, measured_v_mps), required ≤ 2E_RK (checked by datasets-d2.test.ts).',
        measured_r_m: measR,
        measured_v_mps: measV,
      },
      tolerance: {
        record: `${RECORD_R4} §6.8, §7 VT-16 (revision 4, P-3; validity gate 0.05 approved 2026-11-15)`,
        formula:
          '‖Δr‖ ≤ M·P_E,gen(Δt) + 2E_RK,r, ‖Δv‖ ≤ M·V_E,gen(Δt) + 2E_RK,v; first sample of the segment exact (R8)',
        engineBound_position_m: bounds.map((b, k) => (k === 0 ? 0 : MARGIN * b.pEgen)),
        engineBound_velocity_mps: bounds.map((b, k) => (k === 0 ? 0 : MARGIN * b.vEgen)),
        vsL2b_position_m: bounds.map((b, k) =>
          k === 0 ? 0 : MARGIN * b.pEgen + 2 * (eR[k] ?? NaN),
        ),
        vsL2b_velocity_mps: bounds.map((b, k) =>
          k === 0 ? 0 : MARGIN * b.vEgen + 2 * (eV[k] ?? NaN),
        ),
        sample0: 'exact: first sample of the post-maneuver segment = event state (R8)',
        layers: 'L2b (RK4), validated against a 200-bit hyperbolic-anomaly propagation',
        assertion: 'informative',
        assertionReason: O12_NOTE,
      },
    },
  };
}

// =============================================================================================
// 3. L3 tolerances of revision 4 for test-data/l3-orekit (§9.3, §9.3.1, §9.3.2)

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const L3_DIR = join(ROOT, 'test-data', 'l3-orekit');

interface L3Head {
  readonly id: string;
  readonly version: number;
  readonly producedBy: { readonly codeRevision: string };
}

/** Reads one Orekit dataset (special numbers decoded). */
export function readL3(family: string, file: string): Record<string, unknown> & L3Head {
  const text = readFileSync(join(L3_DIR, family, file), 'utf8');
  return decodeValue(JSON.parse(text)) as Record<string, unknown> & L3Head;
}

export function listL3(family: string): string[] {
  return readdirSync(join(L3_DIR, family))
    .filter((n) => n.endsWith('.json'))
    .sort();
}

type Obj = Record<string, unknown>;
const o = (x: unknown): Obj => x as Obj;
const n = (x: unknown): number => x as number;
const vec = (x: unknown): V3 => x as V3;
const nums = (x: unknown): number[] => x as number[];

function l3Source(d: L3Head, family: string, file: string): Record<string, unknown> {
  return {
    dataset: d.id,
    version: d.version,
    path: `test-data/l3-orekit/${family}/${file}`,
    generatorRevision: d.producedBy.codeRevision,
    storedTolerances:
      'Not used: the tolerances stored in the Orekit file are not the approved L3 rows (tolerances.md §13 C-8); the values below govern.',
  };
}

function gridScales(d: Obj): Scales {
  const el = o(o(d.inputs).elements);
  return scales(MU, n(el.semiMajorAxis_m), n(el.eccentricity));
}

function l3File(
  family: string,
  file: string,
  prov: Provenance,
  body: Record<string, unknown>,
): DatasetFile {
  const d = readL3(family, file);
  const caseId = file.replace(/^l3-orekit-/, '').replace(/\.json$/, '');
  return {
    path: `test-data/reference-cases/l3-r4-${family}/${caseId}.json`,
    data: {
      id: `l3-r4-${family}/${caseId}`,
      version: 1,
      family: `L3 Orekit comparison, ${family.toUpperCase()} (tolerances.md §9.3, §9.3.1, §9.3.2)`,
      status:
        'Evaluated L3 tolerances, committed before any engine comparison with the Orekit dataset (tolerances.md §4.1 item 1; §9.3.2 item 3). Not yet reviewed or approved.',
      inputs: { l3: l3Source(d, family, file) },
      producedBy: producedBy(prov, [
        'Formulas of tolerances.md revision 4 transcribed in verification/src/tol/tolerances-r4.ts; inputs from the reference side of the Orekit dataset (§4.1 item 2)',
      ]),
      ...body,
    },
  };
}

function l3Vt02(file: string, prov: Provenance): DatasetFile {
  const d = readL3('vt-02', file);
  const s = gridScales(d);
  const t = vt02L3(s);
  return l3File('vt-02', file, prov, {
    tolerance: {
      record: `${RECORD_R4} §9.3.1 VT-02 L3`,
      formula: '‖Δr‖ ≤ 3M·η_r(e)·u·r_a, ‖Δv‖ ≤ 3M·η_v(e)·u·v_p (grid a, e)',
      evaluatedAt: scaleInputs(s),
      position_m: t.position_m,
      velocity_mps: t.velocity_mps,
      assertion: 'asserted',
    },
  });
}

function l3Vt05(file: string, prov: Provenance): DatasetFile {
  const d = readL3('vt-05', file);
  const s = gridScales(d);
  const ts = nums(o(d.outputs).t_s);
  return l3File('vt-05', file, prov, {
    tolerance: {
      record: `${RECORD_R4} §9.3 (VT-05 L3, approved row unchanged)`,
      formula: '‖Δr‖ ≤ 3M·P_E(Δt), ‖Δv‖ ≤ 3M·V_E(Δt), Δt = t_s (grid a, e); t_s = 0 exact (§1)',
      evaluatedAt: scaleInputs(s),
      t_s: ts,
      position_m: ts.map((t) => (t === 0 ? 0 : propagationL3(s, t).position_m)),
      velocity_mps: ts.map((t) => (t === 0 ? 0 : propagationL3(s, t).velocity_mps)),
      sample0: 'exact (Object.is) vs the request initialState (contracts-v1.md §5.2 revision 3)',
      assertion: 'asserted',
    },
  });
}

function l3Vt12(file: string, prov: Provenance): DatasetFile {
  const d = readL3('vt-12', file);
  const s = gridScales(d);
  const req = o(o(d.inputs).requestBody);
  const mans = req.maneuvers as Obj[];
  const m0 = mans[0];
  if (m0 === undefined || n(m0.t_s) !== 0) throw new Error('VT-12 L3: m = 0 expected');
  const dv = norm3(vec(m0.deltaV_mps));
  const rel = vt12L3(s.kappaH);
  return l3File('vt-12', file, prov, {
    tolerance: {
      record: `${RECORD_R4} §9.3.1 VT-12 L3`,
      formula:
        '‖ΔΔv_I‖ ≤ 12(12κ_h + 25)u‖Δv_RSW‖, κ_h = 1/√(1 − e²) of the grid case; valid for m = 0 (event pre-maneuver state = initialState bit-for-bit, checked by the test)',
      evaluatedAt: { kappa_h: s.kappaH, deltaV_rsw_norm_mps: dv, u: U, M: MARGIN },
      relative: rel,
      deltaV_inertial_mps: rel * dv,
      assertion: 'asserted',
    },
  });
}

/** Reference-side VT-15 L3 inputs from the Orekit event state (§9.3.1). */
export function l3Vt15Inputs(d: Obj): Vt15Inputs {
  const s = gridScales(d);
  const req = o(o(d.inputs).requestBody);
  const m0 = (req.maneuvers as Obj[])[0];
  if (m0 === undefined) throw new Error('maneuver');
  const ev = o(o(d.outputs).event);
  const r = vec(ev.position_m);
  const vPlus = vec(ev.velocityAfter_mps);
  const post = conicOfState(MU, r, vPlus);
  const vp = toNumber(sqrt(dotB(b3(vPlus), b3(vPlus))));
  return {
    sPre: s,
    kind: d.kind as BurnKind,
    m: n(m0.t_s),
    dv: norm3(vec(m0.deltaV_mps)),
    aPlus: post.semiMajorAxis_m,
    ePlus: post.eccentricity,
    r: post.radius_m,
    vPlus: vp,
    hPlus: post.angularMomentum_m2ps,
    mu: MU,
  };
}

function l3Vt15(file: string, prov: Provenance): DatasetFile {
  const d = readL3('vt-15', file);
  const x = l3Vt15Inputs(d);
  const t = vt15L3(x);
  return l3File('vt-15', file, prov, {
    kind: d.kind,
    tolerance: {
      record: `${RECORD_R4} §9.3.1 VT-15 L3`,
      formula:
        '3M·X_a, 3M·X_e, 3M·X_n, 3M·X_ψ with the per-side bounds of §9.3.1 (each side from its own post-maneuver state; at m = T tangential at an apsis, each tool uses its own event state, τ_E,eng(T) entering three times)',
      evaluatedAt: {
        ...scaleInputs(x.sPre),
        m_s: x.m,
        deltaV_mps: x.dv,
        aPlus_m: x.aPlus,
        ePlus: x.ePlus,
        r_m: x.r,
        vPlus_mps: x.vPlus,
        hPlus_m2ps: x.hPlus,
        kappa_hPlus: t.kappaHPlus,
        source: 'Orekit event state (position_m, velocityAfter_mps), conic in 320-bit',
      },
      semiMajorAxis_rel: t.aRelative,
      eccentricity_abs: t.eAbsolute,
      eccentricityFormula: t.eFormula,
      planeNormal_rad: t.planeNormal_rad,
      planeRotation_rad: t.planeRotation_rad,
      orekitSide:
        "a⁺, e⁺: Orekit's getters (outputs.elementsAfter); ĥ⁺, ĥ⁻ and ψ: evaluated by the test in binary64 from Orekit's event state, like the engine side",
      assertion: 'asserted',
    },
  });
}

function propagationArrays(s: Scales, ts: readonly number[], t0: number): Obj {
  return {
    position_m: ts.map((t) => (t === t0 ? 0 : propagationL3(s, t - t0).position_m)),
    velocity_mps: ts.map((t) => (t === t0 ? 0 : propagationL3(s, t - t0).velocity_mps)),
  };
}

function l3Vt16(file: string, prov: Provenance): DatasetFile {
  const d = readL3('vt-16', file);
  const out = o(d.outputs);
  const segs = out.segments as Obj[];
  const seg0 = nums(o(segs[0]).t_s);
  const seg1 = nums(o(segs[1]).t_s);
  const req = o(o(d.inputs).requestBody);
  const m = n(o((req.maneuvers as Obj[])[0]).t_s);
  const sPre = gridScales(d);
  const ev = o(out.event);
  const r = vec(ev.position_m);
  const vPlus = vec(ev.velocityAfter_mps);
  const post = conicOfState(MU, r, vPlus);
  const expected = o(out.expectedWarnings);
  const codes = [
    ...(expected.ESCAPE_TRAJECTORY === true ? ['ESCAPE_TRAJECTORY'] : []),
    ...(expected.REFERENCE_SPHERE_INTERSECTION === true ? ['REFERENCE_SPHERE_INTERSECTION'] : []),
  ];
  let segment1: Obj;
  if (post.energy_Jpkg < 0) {
    const sPost = scales(MU, post.semiMajorAxis_m, post.eccentricity);
    segment1 = {
      kind: 'elliptic',
      record: `${RECORD_R4} §9.3.1 (VT-16 L3, elliptic segment after the burn), §9.3.2 items 2–3`,
      formula:
        '3M·P_E(t − m), 3M·V_E(t − m) at the post-maneuver (a⁺, e⁺) from Orekit’s own event state; compared with an Orekit arc restarted from the engine event state (KeplerianPropagator on a CartesianOrbit, μ explicit, GCRF); first sample exact (R8)',
      evaluatedAt: scaleInputs(sPost),
      t_s: seg1,
      ...propagationArrays(sPost, seg1, m),
      comparedWith:
        m > 0
          ? 'Orekit restarted from the engine event state (§9.3.2 item 2)'
          : "Orekit's own segment 1",
      assertion: 'asserted',
    };
  } else {
    const arc = prepareHyperbolicArc(MU, r, vPlus, (seg1[seg1.length - 1] ?? NaN) - m);
    const b = seg1.map((t) => hyperbolicBound(arc, t - m));
    segment1 = {
      kind: 'hyperbolic',
      record: `${RECORD_R4} §9.3.1 (VT-16 L3, hyperbolic arcs), §6.8, §9.3.2`,
      formula:
        '‖Δr‖ ≤ 3M·P_E,gen(Δt), ‖Δv‖ ≤ 3M·V_E,gen(Δt) (§6.8, arc-wide factors from Orekit’s own event state); first sample exact (R8)',
      evaluatedAt: arcRecord(arc),
      t_s: seg1,
      position_m: b.map((x, k) => (k === 0 ? 0 : L3_FACTOR * x.pEgen)),
      velocity_mps: b.map((x, k) => (k === 0 ? 0 : L3_FACTOR * x.vEgen)),
      comparedWith:
        m > 0
          ? 'Orekit restarted from the engine event state (§9.3.2 item 2)'
          : "Orekit's own segment 1 (m = 0; the event pre-maneuver state equals initialState)",
      assertion: 'informative',
      assertionReason:
        'L3 VT-16 hyperbolic rows are usable only after O-13 (§9.3.1 precondition, §15: "usable only after O-13"); O-13 needs a change to verification/l3/selfcheck.py, outside ML-TASK-018 D2 paths, and is open. The engine bound also rests on O-12 (open). Measured and reported only.',
    };
  }
  return l3File('vt-16', file, prov, {
    kind: d.kind,
    tolerance: {
      warnings: {
        record: 'contracts-v1.md §8.3, §11.3 D1–D6 (expectation stored in the Orekit file)',
        expectedCodes: codes,
        expectedTime_s: m,
        assertion: 'asserted (exact set, t_s = maneuver time)',
      },
      segment0: {
        record: `${RECORD_R4} §9.3, §9.3.2 item 1`,
        formula:
          "3M·P_E(t), 3M·V_E(t) at the grid (a, e), vs Orekit's own segment 0; t_s = 0 exact",
        evaluatedAt: scaleInputs(sPre),
        t_s: seg0,
        ...propagationArrays(sPre, seg0, 0),
        assertion: 'asserted',
      },
      segment1,
    },
  });
}

// =============================================================================================

export function buildPartD2Datasets(prov: Provenance, requestIdOf: RequestIdFn): DatasetFile[] {
  const files: DatasetFile[] = [];
  for (const sp of VT15) files.push(vt15R4File(sp, prov, requestIdOf));
  for (const id of VT16_R4_IDS) files.push(vt16R4File(id, prov, requestIdOf));
  for (const f of listL3('vt-02')) files.push(l3Vt02(f, prov));
  for (const f of listL3('vt-05')) files.push(l3Vt05(f, prov));
  for (const f of listL3('vt-12')) files.push(l3Vt12(f, prov));
  for (const f of listL3('vt-15')) files.push(l3Vt15(f, prov));
  for (const f of listL3('vt-16')) files.push(l3Vt16(f, prov));
  return files;
}

/** Re-export for tests: the exact post-maneuver velocity (320-bit) of an RSW maneuver. */
export function exactPostVelocity(r: V3, v: V3, dv: V3): V3 {
  return toV3(exactVPlusB(r, v, dv));
}

/** Plane normal of a binary64 state, 320-bit, rounded once. */
export function planeNormalHp(r: V3, v: V3): V3 {
  return toV3(unitB(crossB(b3(r), b3(v))));
}
