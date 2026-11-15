/**
 * Reference datasets of ML-TASK-018 part C (verification plan §6) for the families not covered by
 * ML-TASK-011: VT-01, VT-06/07, VT-09, VT-11/12/13, VT-14, VT-15, VT-16, VT-18 and VI-01.
 * Pure: the caller supplies provenance and the requestId function (datasets.test.ts writes and
 * checks the files).
 *
 * Independence: written without reading packages/astrodynamics or packages/simulation (ADR-003);
 * imports only the verification references and @mission-lab/contracts types.
 * Every tolerance is an approved formula of docs/verification/tolerances.md (revision 3) evaluated
 * at the dataset's own scale with reference-side inputs (§4.1 item 2), committed with the dataset
 * before any engine run (§4.1 item 1). Where the record has no tolerance the dataset says so and
 * no pass/fail value is given.
 */
import type {
  CartesianState,
  ImpulsiveManeuver,
  KeplerianElements,
  Scenario,
  SimulationRequest,
} from '@mission-lab/contracts';
import { hpPrepare, hpPropagate } from '../hp/hp-kepler';
import { toV3 } from '../hp/hp-vec';
import { elementsToState } from '../ref/elements';
import { samplingGridWithManeuvers } from '../ref/grid';
import {
  classifyVt16,
  conicOfState,
  postManeuverClosedForm,
  type ConicSummary,
} from '../ref/maneuver';
import { RK_ORDER, rk4WithHalving } from '../ref/rk';
import { rswToInertialHp } from '../ref/rsw';
import type { V3 } from '../ref/vec';
import {
  E_RK_TARGET_REL,
  MARGIN,
  U,
  pE,
  scales,
  vE,
  vt05L2a,
  vt06,
  vt07,
  vt11,
  vt12,
  vt13,
  vt14,
  vt15,
  VT01_CROSS_ORTHOGONALITY,
  VT01_NORM,
  VT01_TRIPLE_PRODUCT,
  VT01_UNIT,
  type Scales,
} from '../tol/tolerances';
import { CONSTANTS, type DatasetFile, type Provenance, type RequestIdFn } from './build';
import { BELOW_TWO_PI, GRID, type GridCase } from './cases';
import { rkPlan } from './plan';

const MU = CONSTANTS.mu_m3ps2;
const R_REF = CONSTANTS.referenceRadius_m;
const EPOCH = { scale: 'UTC', iso: '2026-01-01T00:00:00.000Z' } as const;
const RECORD = 'docs/verification/tolerances.md revision 3 (approved by the owner 2026-11-13)';
const CONTRACT = 'docs/architecture/contracts-v1.md revision 4';
const STATUS =
  'Committed before any engine run on it (tolerances.md §4.1 item 1; ML-TASK-018 part C phase 1). Not yet reviewed or approved; immutable once approved, corrections create a new version (plan §6).';

function z(x: number): number {
  return x === 0 ? 0 : x;
}

function v3(v: readonly number[]): V3 {
  return [z(v[0] ?? 0), z(v[1] ?? 0), z(v[2] ?? 0)];
}

function stateOf(s: {
  position_m: readonly number[];
  velocity_mps: readonly number[];
}): CartesianState {
  return { position_m: v3(s.position_m), velocity_mps: v3(s.velocity_mps) };
}

function gridCase(id: string): GridCase {
  const g = GRID.find((c) => c.id === id);
  if (g === undefined) throw new Error(`grid case ${id}`);
  return g;
}

function withAnomaly(el: KeplerianElements, nu: number): KeplerianElements {
  return { ...el, trueAnomaly_rad: nu };
}

function stateFromElements(el: KeplerianElements): CartesianState {
  return stateOf(elementsToState(el, MU));
}

function scaleOf(el: KeplerianElements): Scales {
  return scales(MU, el.semiMajorAxis_m, el.eccentricity);
}

function maneuver(id: string, t_s: number, dv: V3): ImpulsiveManeuver {
  return { id, t_s, frame: 'RSW', deltaV_mps: v3(dv) };
}

function request(
  state: CartesianState,
  duration_s: number,
  outputStep_s: number,
  maneuvers: ImpulsiveManeuver[],
  requestIdOf: RequestIdFn,
): SimulationRequest {
  const body: Omit<SimulationRequest, 'requestId'> = {
    schemaVersion: '1.0',
    centralBody: 'EARTH',
    constants: CONSTANTS,
    dynamicsModel: 'TWO_BODY',
    frame: 'GCRF',
    epoch: EPOCH,
    initialState: state,
    maneuvers,
    duration_s,
    outputStep_s,
  };
  return { requestId: requestIdOf(body), ...body };
}

function producedBy(prov: Provenance, references: string[]): Record<string, unknown> {
  return {
    tool: '@mission-lab/verification (ML-TASK-018 part C), verification/src/datasets/build-c.ts',
    references,
    codeRevision: prov.codeRevision,
    date: prov.date,
    runtime: prov.runtime,
    independence:
      'packages/astrodynamics and packages/simulation not read and not run (ADR-003); references import nothing from the engine.',
    numberFormat:
      'Every number is the shortest decimal that round-trips to the binary64 value; JSON.parse restores the exact binary64. Signs of zero are not preserved (−0 written as 0) except where a value is encoded as {"$number": "-0"}.',
  };
}

function model(): Record<string, unknown> {
  return {
    dynamics: 'TWO_BODY: point-mass two-body, Earth-centred (ML-SYS-001 §5.1)',
    centralBody: 'EARTH',
    frame: 'GCRF (all vectors)',
    mu_m3ps2: MU,
    referenceRadius_m: R_REF,
    constantsSource: CONSTANTS.source,
    units: 'SI: m, m/s, s, rad, m³/s²',
    time: 't_s: elapsed SI seconds from the epoch (contracts-v1.md §2)',
  };
}

function scaleInputs(s: Scales): Record<string, number> {
  return {
    mu_m3ps2: s.mu,
    a_m: s.a,
    e: s.e,
    r_a_m: s.ra,
    v_p_mps: s.vp,
    g_p_mps2: s.gp,
    n_radps: s.n,
    T_s: s.T,
    kappa_E: s.kappaE,
    kappa_h: s.kappaH,
    u: U,
    M: MARGIN,
  };
}

const REQUEST_ID_NOTE =
  'requestId = "sha256:" + hex(SHA-256(UTF-8(canonicalRequestPayload(request)))) per contracts-v1.md §7.1, computed with @mission-lab/contracts canonicalRequestPayload and Node crypto SHA-256 (test code only).';

// =============================================================================================
// VT-01 vector utilities (L1)

function xorshift(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function vt01File(prov: Provenance): DatasetFile {
  const rand = xorshift(20261114);
  const vec = (): V3 => {
    const mag = 10 ** (-3 + 11 * rand());
    return [(rand() - 0.5) * 2 * mag, (rand() - 0.5) * 2 * mag, (rand() - 0.5) * 2 * mag];
  };
  const triples: { a: V3; b: V3; c: V3 }[] = [];
  for (let k = 0; k < 200; k++) triples.push({ a: vec(), b: vec(), c: vec() });
  return {
    path: 'test-data/reference-cases/vt-01/vectors.json',
    data: {
      id: 'vt-01/vectors',
      version: 1,
      family: 'VT-01 Vector/matrix utilities (L1)',
      description:
        'Pseudo-random vector triples (xorshift32, seed 20261114, magnitudes 1e-3…1e8 per vector, independent signs) for the identity checks of tolerances.md §7 VT-01, and the exact special inputs of §1.',
      status: STATUS,
      inputs: { triples },
      exactCases: {
        crossUnit: { a: [1, 0, 0], b: [0, 1, 0], expected: [0, 0, 1] },
        norms: [
          { x: [2, 3, 6], expected: 7 },
          { x: [1, 4, 8], expected: 9 },
        ],
        powerOfTwoScaling: {
          x: [3.5, -1.25, 1e-3],
          factors: [2, 0.5, 1024, 2 ** -20],
          rule: 'scale(k, x) === [k·x0, k·x1, k·x2] exactly for k a power of two (no overflow/underflow)',
        },
        source: `${RECORD} §1 "Special inputs to vector utilities" (exact; norms require a correctly rounded square root, assumption A2)`,
      },
      model: { note: 'No physics: dimensionless vector identities.' },
      producedBy: producedBy(prov, ['L1 identities (no reference implementation needed)']),
      method: {
        quantities:
          '(a) |a·(a × b)| and |b·(a × b)| / (‖a‖²‖b‖ resp. ‖a‖‖b‖²); (b) |a·(b × c) − b·(c × a)| / (‖a‖‖b‖‖c‖); (c) |‖x‖_engine − ‖x‖_test| / ‖x‖_test; (d) |‖x/‖x‖‖ − 1| (norm of the engine unit vector evaluated by the test)',
      },
      tolerance: {
        record: `${RECORD} §7 VT-01`,
        crossOrthogonality_rel: VT01_CROSS_ORTHOGONALITY,
        tripleProduct_rel: VT01_TRIPLE_PRODUCT,
        norm_rel: VT01_NORM,
        unit_abs: VT01_UNIT,
        formula: '(a) 4(2√2 + 3)u; (b) 8(2√2 + 3)u; (c) 24u; (d) 28u',
        layers: 'L1',
      },
    },
  };
}

// =============================================================================================
// VT-06 / VT-07 energy and angular momentum (L1), coast runs over the grid

function vt0607File(g: GridCase, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const el = g.elements;
  const state = stateFromElements(el);
  const sc = scaleOf(el);
  const plan = rkPlan(g.id, sc.T);
  const req = request(state, plan.duration_s, plan.outputStep_s, [], requestIdOf);
  const grid = samplingGridWithManeuvers(plan.duration_s, plan.outputStep_s, []);
  return {
    path: `test-data/reference-cases/vt-06-07/${g.id}.json`,
    data: {
      id: `vt-06-07/${g.id}`,
      version: 1,
      family: 'VT-06 Energy conservation and VT-07 angular momentum conservation (ML-FR-004 AC2)',
      description: `${g.description}. Coast run of the VT-05 request (same request and requestId), every sample.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: { request: req, requestIdNote: REQUEST_ID_NOTE, gridElements: el },
      model: model(),
      producedBy: producedBy(prov, ['L1 invariants (formulas evaluated by the test)']),
      method: {
        energy:
          'E = v²/2 − μ/r evaluated by the test in binary64 for every sample; quantity |E_k − E₀|/|E₀| with E₀ of sample 0',
        angularMomentum:
          'h = r × v evaluated by the test; quantity ‖h_k − h₀‖/‖h₀‖ (vector, normwise relative)',
        sampleTimes: '§5.2 grid of the request (expected t_s below, independent construction)',
      },
      outputs: { t_s: grid.times },
      tolerance: {
        record: `${RECORD} §7 VT-06, VT-07 (Δt = t_s, scales of the grid elements)`,
        energyFormula: 'τ_E(Δt) = M[10uκ_E + τ_E,eng(Δt)]',
        angularMomentumFormula:
          'τ_h(Δt) = M[6uκ_h + (P_b v_p + r_a V_b + (v_p² + 2(1 + e) r_a g_p)(δt_res + δt_g))/h]',
        evaluatedAt: scaleInputs(sc),
        energy_rel: grid.times.map((t) => vt06(sc, t)),
        angularMomentum_rel: grid.times.map((t) => vt07(sc, t)),
        layers: 'L1',
      },
    },
  };
}

// =============================================================================================
// VT-09 sampling independence (exact) and VT-10 determinism (exact)

interface Vt09Spec {
  readonly id: string;
  readonly orbit: string;
  readonly duration_s: number;
  readonly steps: readonly number[];
  readonly maneuver?: { t_s: number; dv: V3 };
}

const VT09: readonly Vt09Spec[] = [
  { id: 'c1-coast', orbit: 'c1-circular-inclined', duration_s: 6000, steps: [60, 40, 25] },
  { id: 'c4-coast', orbit: 'c4-moderate-inclined', duration_s: 30000, steps: [600, 400, 250] },
  { id: 'c5-coast', orbit: 'c5-molniya', duration_s: 120000, steps: [1200, 800, 500] },
  { id: 'c6-coast', orbit: 'c6-geo-radius', duration_s: 172800, steps: [3600, 2400, 1500] },
  {
    id: 'c3-maneuver-off-grid',
    orbit: 'c3-elliptical-equatorial',
    duration_s: 12000,
    steps: [60, 40, 25],
    maneuver: { t_s: 4321.25, dv: [10, -20, 5] },
  },
];

function vt09File(sp: Vt09Spec, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const g = gridCase(sp.orbit);
  const state = stateFromElements(g.elements);
  const ms = sp.maneuver === undefined ? [] : [maneuver('m1', sp.maneuver.t_s, sp.maneuver.dv)];
  const requests = sp.steps.map((h) => request(state, sp.duration_s, h, ms, requestIdOf));
  const grids = sp.steps.map((h) =>
    samplingGridWithManeuvers(
      sp.duration_s,
      h,
      ms.map((m) => m.t_s),
    ),
  );
  const common = (grids[0]?.times ?? []).filter((t) =>
    grids.every((gr) => gr.times.some((x) => Object.is(x, t))),
  );
  return {
    path: `test-data/reference-cases/vt-09/${sp.id}.json`,
    data: {
      id: `vt-09/${sp.id}`,
      version: 1,
      family: 'VT-09 Sampling independence (ML-FR-004 AC4); requests also used for VT-10',
      description: `${g.description}. Same request with ${String(sp.steps.length)} output steps (${sp.steps.join(', ')} s); states compared at bit-identical common t_s.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: { requests, requestIdNote: REQUEST_ID_NOTE, gridElements: g.elements },
      model: model(),
      producedBy: producedBy(prov, ['§5.2 grid (independent construction, ref/grid.ts)']),
      method: {
        rule: 'Exact (Object.is per component) at every t_s present bit-identically in all runs, including the maneuver event fields, as instructed for ML-TASK-018 part C under open item O-4 (tolerances.md §1, §7 VT-09).',
      },
      outputs: { commonTimes_s: common },
      tolerance: {
        record: `${RECORD} §1, §7 VT-09, VT-10`,
        vt09: 'exact (Object.is) — conditional on O-4 (a sample is a function of segment initial state, segment start time, t_s and constants only); the fallback tolerance of §7 VT-09 is not used here',
        vt10: 'exact: repeated runs of one request bit-identical in every field, including typed-array contents and requestId',
        layers: 'L1 (VT-09); none (VT-10)',
      },
    },
  };
}

// =============================================================================================
// VT-11 / VT-12 / VT-13 maneuver frame, inertial Δv and impulsive change

const VT12_ORBITS = [
  'c1-circular-inclined',
  'c3-elliptical-equatorial',
  'c4-moderate-inclined',
  'c5-molniya',
  'c7-near-polar-retrograde',
  'c8-angle-boundaries-b',
] as const;

const VT12_KINDS: readonly { kind: string; dv: V3 }[] = [
  { kind: 'axis-R', dv: [1, 0, 0] },
  { kind: 'axis-S', dv: [0, 1, 0] },
  { kind: 'axis-W', dv: [0, 0, 1] },
  { kind: 'radial', dv: [50, 0, 0] },
  { kind: 'along-track', dv: [0, 100, 0] },
  { kind: 'cross-track', dv: [0, 0, -75] },
  { kind: 'combined', dv: [12.5, -40, 30.25] },
];

function vt12File(
  orbit: string,
  when: 't0' | 'tmid',
  prov: Provenance,
  requestIdOf: RequestIdFn,
): DatasetFile {
  const g = gridCase(orbit);
  const state = stateFromElements(g.elements);
  const sc = scaleOf(g.elements);
  const m = when === 't0' ? 0 : Math.round(0.37 * sc.T * 8) / 8;
  const D = m + 600;
  const cases = VT12_KINDS.map(({ kind, dv }) => {
    const req = request(state, D, 60, [maneuver('m1', m, dv)], requestIdOf);
    const entry: Record<string, unknown> = { kind, deltaV_rsw_mps: dv, request: req };
    if (when === 't0') {
      entry.referenceDeltaV_inertial_mps = rswToInertialHp(
        state.position_m,
        state.velocity_mps,
        dv,
      );
    } else {
      // Informative only: the reference Δv at the 200-bit L2a state at m (the comparison value is
      // computed by the test from the engine's event state with the committed reference).
      const hp = hpPrepare(state.position_m, state.velocity_mps, MU);
      const s = hpPropagate(hp, m);
      entry.informativeDeltaV_inertial_mps_atL2aState = rswToInertialHp(
        toV3(s.position_m),
        toV3(s.velocity_mps),
        dv,
      );
    }
    return entry;
  });
  const t11 = vt11(sc.kappaH);
  const t13 = vt13(sc.kappaH);
  return {
    path: `test-data/reference-cases/vt-12/${g.id}-${when}.json`,
    data: {
      id: `vt-12/${g.id}-${when}`,
      version: 1,
      family:
        'VT-12 Maneuver frame transformation (ML-FR-006 AC2), with VT-11 RSW basis (AC1) and VT-13 impulsive change (AC3) on the same runs',
      description: `${g.description}. One maneuver at t_s = ${String(m)} s (${when === 't0' ? 'pre-maneuver state = request.initialState exactly (contract §5.2, R8)' : 'off the 60 s grid; pre-maneuver state = engine event state'}), seven Δv variants including the three unit axes (VT-11 basis extraction).`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: {
        cases,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: g.elements,
        maneuverTime_s: m,
      },
      model: model(),
      producedBy: producedBy(prov, ['L2c RSW reference (ref/rsw.ts, 320-bit, projection form)']),
      method: {
        reference:
          'Δv_I = ΔvR·R + ΔvS·S + ΔvW·W with R = r/‖r‖, v⊥ = v − (v·R)R, S = v⊥/‖v⊥‖, W = R × S (projection form, mathematically equal to contract §2), evaluated in 320-bit arithmetic from the exact binary64 pre-maneuver state and rounded once to binary64.',
        preManeuverState:
          when === 't0'
            ? 'request.initialState (bit-identical to the event state by contract §5.2 first-sample rule and R8; the test checks this before using the stored reference)'
            : 'the engine event position_m and velocityBefore_mps (no propagation error enters; tolerances.md §7 VT-11); the test evaluates the committed reference function there',
        basisExtraction:
          'VT-11: with Δv_RSW = unit axis k, Δv_I = 1·e_k + 0·(others) is exactly the k-th basis vector for any evaluation as a sum of products; used only if the engine does not export the basis.',
      },
      referenceAccuracy: {
        deltaV:
          '≤ ½ ulp per component (one rounding of a 320-bit value); self-test ref/rsw.test.ts',
      },
      tolerance: {
        record: `${RECORD} §7 VT-11, VT-12, VT-13 (κ_h of the grid elements)`,
        kappa_h: sc.kappaH,
        vt11: {
          orthonormality_and_handedness: t11.orthonormality,
          rParallel: t11.rParallel,
          wParallel: t11.wParallel,
          formula: 'M(2ε_S + 3u) = 4(12κ_h + 25)u; R ∥ r: 32u; W ∥ r × v: 4(12κ_h + 8)u',
        },
        vt12: {
          relative: vt12(sc.kappaH),
          formula: '‖ΔΔv_I‖ ≤ 8(12κ_h + 25)u·‖Δv_RSW‖',
        },
        vt13: {
          increment:
            'exact: velocityAfter_mps[i] Object.is velocityBefore_mps[i] + deltaV_inertial_mps[i] (R12)',
          continuity:
            'exact: event t_s, position_m, velocityBefore/After vs the adjacent segment samples (R8)',
          magnitude_rel: t13.magnitude,
          rotationNorm_rel: t13.rotationNorm,
          formula:
            '|deltaV_magnitude_mps − ‖deltaV_inertial_mps‖_test| ≤ 24u‖Δv‖; |‖deltaV_inertial_mps‖ − ‖Δv_RSW‖| ≤ 4(12κ_h + 31)u‖Δv‖',
        },
        layers: 'VT-11 L1; VT-12 L2c; VT-13 L1',
      },
    },
  };
}

// =============================================================================================
// VT-14 zero-magnitude maneuver (L1), e = 0 only for the trajectory comparison (O-11)

interface Vt14Spec {
  readonly orbit: string;
  readonly offGrid: boolean;
}

const VT14: readonly Vt14Spec[] = [
  { orbit: 'c1-circular-inclined', offGrid: false },
  { orbit: 'c1-circular-inclined', offGrid: true },
  { orbit: 'c2-circular-equatorial', offGrid: false },
  { orbit: 'c6-geo-radius', offGrid: true },
  { orbit: 'c4-moderate-inclined', offGrid: false },
  { orbit: 'c5-molniya', offGrid: true },
];

function vt14File(sp: Vt14Spec, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const g = gridCase(sp.orbit);
  const state = stateFromElements(g.elements);
  const sc = scaleOf(g.elements);
  const plan = rkPlan(g.id, sc.T);
  const H = plan.outputStep_s;
  const m = sp.offGrid ? 16 * H + 0.375 * H : 16 * H;
  const coast = request(state, plan.duration_s, H, [], requestIdOf);
  const zero = request(state, plan.duration_s, H, [maneuver('m1', m, [0, 0, 0])], requestIdOf);
  const grid = samplingGridWithManeuvers(plan.duration_s, H, [m]);
  const after = (grid.segments[1] ?? []).filter((t) => t > m);
  const evaluated = sc.e === 0;
  const tol = evaluated ? after.map((t) => vt14(sc, m, t)) : [];
  return {
    path: `test-data/reference-cases/vt-14/${g.id}-${sp.offGrid ? 'off-grid' : 'on-grid'}.json`,
    data: {
      id: `vt-14/${g.id}-${sp.offGrid ? 'off-grid' : 'on-grid'}`,
      version: 1,
      family: 'VT-14 Zero-magnitude maneuver (ML-FR-006 AC4)',
      description: `${g.description}. Zero Δv at m = ${String(m)} s vs the coast run, ≈ 10 periods.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: {
        coastRequest: coast,
        zeroDeltaVRequest: zero,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: g.elements,
        maneuverTime_s: m,
      },
      model: model(),
      producedBy: producedBy(prov, ['L1 (the coast run of the same engine)']),
      method: {
        exactParts:
          'deltaV_inertial_mps components === 0 (±0 allowed); velocityAfter_mps[i] === velocityBefore_mps[i] (tolerances.md §1; contract §11.3 D7)',
        segment0:
          'Samples t ≤ m of the zero-Δv run vs the coast run at the same t_s: exact (Object.is) under O-4, the same premise as VT-09 (both propagate the same initial state to the same t_s).',
        afterManeuver: evaluated
          ? 'Samples t > m vs the coast run at bit-identical t_s: ‖Δr‖, ‖Δv‖ within the §7 VT-14 formula evaluated per sample.'
          : 'e > 0: no approved transport factor K(e) (open item O-11); the trajectory comparison after m has no tolerance and is NOT evaluated (gap). Only the exact parts and segment 0 are checked.',
      },
      outputs: { afterManeuver_t_s: after },
      tolerance: {
        record: `${RECORD} §7 VT-14 (K_r = 14, K_v = 9, e = 0 only; O-11)`,
        evaluated,
        formula:
          '‖Δr‖ ≤ M[P_E(t) + v_p(uC_t L_m + δt_res(m)) + P_E(t − m) + (3/2)τ_E,eng(m) v_p (t − m) + K_r P_off(m) + K_v V_off(m)/n]; velocity with g_p, V_E, K_r V_off(m) + K_v n P_off(m)',
        evaluatedAt: { ...scaleInputs(sc), m_s: m },
        position_m: tol.map((x) => x.position_m),
        velocity_mps: tol.map((x) => x.velocity_mps),
        gap: evaluated ? null : 'O-11: K_r(e), K_v(e) for e > 0 not derived; no tolerance.',
        layers: 'L1',
      },
    },
  };
}

// =============================================================================================
// VT-15 post-maneuver orbit (L1, closed form)

interface Vt15Spec {
  readonly id: string;
  readonly orbit: string;
  readonly nu: number;
  readonly dv: V3 | 'circularise';
  readonly atPeriod: boolean;
  /** 'apsis-tangential' has an approved tolerance; others are informative closed forms (gap). */
  readonly kind: 'apsis-tangential' | 'normal' | 'radial' | 'combined';
}

const VT15: readonly Vt15Spec[] = [
  {
    id: 'c4-perigee-prograde',
    orbit: 'c4-moderate-inclined',
    nu: 0,
    dv: [0, 100, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c4-perigee-retrograde',
    orbit: 'c4-moderate-inclined',
    nu: 0,
    dv: [0, -100, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c4-perigee-prograde-after-1T',
    orbit: 'c4-moderate-inclined',
    nu: 0,
    dv: [0, 100, 0],
    atPeriod: true,
    kind: 'apsis-tangential',
  },
  {
    id: 'c4-apogee-prograde',
    orbit: 'c4-moderate-inclined',
    nu: Math.PI,
    dv: [0, 100, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c4-apogee-prograde-after-1T',
    orbit: 'c4-moderate-inclined',
    nu: Math.PI,
    dv: [0, 100, 0],
    atPeriod: true,
    kind: 'apsis-tangential',
  },
  {
    id: 'c5-perigee-prograde',
    orbit: 'c5-molniya',
    nu: 0,
    dv: [0, 50, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c5-apogee-raise-perigee',
    orbit: 'c5-molniya',
    nu: Math.PI,
    dv: [0, 200, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c3-apogee-circularise',
    orbit: 'c3-elliptical-equatorial',
    nu: Math.PI,
    dv: 'circularise',
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c1-circular-prograde',
    orbit: 'c1-circular-inclined',
    nu: 0.3,
    dv: [0, 100, 0],
    atPeriod: false,
    kind: 'apsis-tangential',
  },
  {
    id: 'c1-circular-prograde-after-1T',
    orbit: 'c1-circular-inclined',
    nu: 0.3,
    dv: [0, 100, 0],
    atPeriod: true,
    kind: 'apsis-tangential',
  },
  {
    id: 'c1-normal',
    orbit: 'c1-circular-inclined',
    nu: 0.3,
    dv: [0, 0, 200],
    atPeriod: false,
    kind: 'normal',
  },
  {
    id: 'c4-perigee-normal',
    orbit: 'c4-moderate-inclined',
    nu: 0,
    dv: [0, 0, -150],
    atPeriod: false,
    kind: 'normal',
  },
  {
    id: 'c4-radial',
    orbit: 'c4-moderate-inclined',
    nu: 1.0,
    dv: [80, 0, 0],
    atPeriod: false,
    kind: 'radial',
  },
  {
    id: 'c4-combined',
    orbit: 'c4-moderate-inclined',
    nu: 1.0,
    dv: [30, -60, 45],
    atPeriod: false,
    kind: 'combined',
  },
];

function vt15File(sp: Vt15Spec, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const g = gridCase(sp.orbit);
  const el = withAnomaly(g.elements, sp.nu);
  const state = stateFromElements(el);
  const sPre = scaleOf(el);
  const pre = conicOfState(MU, state.position_m, state.velocity_mps);
  let dv: V3;
  if (sp.dv === 'circularise') {
    // Δv along S that makes v_s⁺ = √(μ/r) at the burn radius (apoapsis): e⁺ ≈ 0.
    const cf0 = postManeuverClosedForm(MU, state.position_m, state.velocity_mps, [0, 0, 0]);
    dv = [0, Math.sqrt(MU / pre.radius_m) - cf0.vTransverse_mps, 0];
  } else {
    dv = sp.dv;
  }
  const m = sp.atPeriod ? sPre.T : 0;
  const D = m + 600;
  const req = request(state, D, 60, [maneuver('m1', m, dv)], requestIdOf);
  // Closed form from the exact binary64 initial state. For m = T the burn point is the same apsis
  // one period later; the engine's phase error there changes r and v_s only to second order
  // (tolerances.md §7 VT-15 error model).
  const cf = postManeuverClosedForm(MU, state.position_m, state.velocity_mps, dv);
  const approved = sp.kind === 'apsis-tangential';
  const tol = approved ? vt15(sPre, m, cf.semiMajorAxis_m, cf.radius_m) : null;
  return {
    path: `test-data/reference-cases/vt-15/${sp.id}.json`,
    data: {
      id: `vt-15/${sp.id}`,
      version: 1,
      family: 'VT-15 Post-maneuver orbit (ML-FR-006 AC5, ML-FR-010 AC3)',
      description: `${g.description}, ν₀ = ${String(sp.nu)} rad; ${sp.kind} burn Δv_RSW = [${dv.join(', ')}] m/s at t_s = ${String(m)} s.`,
      gridCase: g.recordCase,
      kind: sp.kind,
      status: STATUS,
      inputs: { request: req, requestIdNote: REQUEST_ID_NOTE, elements: el, maneuverTime_s: m },
      model: model(),
      producedBy: producedBy(prov, ['Closed form in RSW coordinates (ref/maneuver.ts, 320-bit)']),
      method: {
        closedForm:
          'Exact RSW maneuver on the exact binary64 initial state: v_r = r·v/r, v_s = ‖r × v‖/r; E⁺ = ((v_r + ΔvR)² + (v_s + ΔvS)² + ΔvW²)/2 − μ/r; h⁺ = r√((v_s + ΔvS)² + ΔvW²); a⁺ = −μ/(2E⁺); e⁺ = √(1 + 2E⁺h⁺²/μ²); plane rotation δ = atan2(|ΔvW|, v_s + ΔvS). For a tangential burn at an apsis this is the vis-viva form a⁺ = 1/(2/r − (v + Δv)²/μ), e⁺ = |1 − r/a⁺| of tolerances.md §7 VT-15.',
        engineSide:
          'a⁺ = 1/(2/r − v⁺²/μ) and e⁺ = ‖[(v⁺² − μ/r) r − (r·v⁺) v⁺]/μ‖ evaluated by the test in binary64 from the event position_m and velocityAfter_mps.',
      },
      outputs: {
        preManeuver: pre,
        burnRadius_m: cf.radius_m,
        semiMajorAxisAfter_m: cf.semiMajorAxis_m,
        eccentricityAfter: cf.eccentricity,
        energyAfter_Jpkg: cf.energy_Jpkg,
        periapsisRadiusAfter_m: cf.periapsisRadius_m,
        planeRotation_rad: cf.planeRotation_rad,
      },
      referenceAccuracy: {
        closedForm:
          '320-bit evaluation, rounded once: ≤ 1 ulp; for m = T the apsis approximation is second order in the phase error (record §7 VT-15).',
      },
      tolerance: approved
        ? {
            record: `${RECORD} §7 VT-15`,
            formula:
              '|δa⁺|/a⁺ ≤ M[τ_E,eng(m)·a⁺/a⁻ + 11u(4a⁺/r − 1)]; |δe⁺| ≤ M[(r/a⁺)(|δa⁺|/a⁺)/M + 60u]',
            evaluatedAt: {
              ...scaleInputs(sPre),
              m_s: m,
              aPlus_m: cf.semiMajorAxis_m,
              r_m: cf.radius_m,
            },
            semiMajorAxis_rel: tol?.aRelative ?? null,
            eccentricity_abs: tol?.eAbsolute ?? null,
            layers: 'L1 (closed form)',
          }
        : {
            record: `${RECORD} §7 VT-15`,
            semiMajorAxis_rel: null,
            eccentricity_abs: null,
            gap: 'No approved tolerance: the §7 VT-15 a⁺/e⁺ formula is derived for a tangential burn at an apsis only (its error model neglects first-order direction and phase terms that a non-tangential burn has); no tolerance for the plane-rotation angle. Closed form given for information; the engine comparison is reported, not asserted.',
            layers: 'L1 (closed form) — informative only',
          },
    },
  };
}

// =============================================================================================
// VT-16 escape / reference-sphere intersection

interface Vt16Spec {
  readonly id: string;
  readonly description: string;
  readonly orbit?: string;
  /** Custom initial state (exactly parabolic construction). */
  readonly custom?: 'parabolic';
  readonly m: number | 'D';
  readonly dv: V3 | { energyFraction: number } | { periapsisRadius_m: number };
  readonly duration: number | { timeToSphereFactor: number };
  readonly expect: { escape: boolean; intersection: boolean };
  readonly compareStates?: boolean;
}

const VT16: readonly Vt16Spec[] = [
  {
    id: 'bound-no-warning',
    description: 'Small prograde burn: bound, perigee far above the sphere',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [0, 100, 0],
    duration: 6000,
    expect: { escape: false, intersection: false },
  },
  {
    id: 'escape-clear',
    description: 'Large prograde burn: hyperbolic, departing from periapsis',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [0, 4000, 0],
    duration: 6000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'just-bound',
    description: 'E⁺ = −1e-3·(v²/2 + μ/r): bound side of the energy boundary',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: { energyFraction: -1e-3 },
    duration: 6000,
    expect: { escape: false, intersection: false },
  },
  {
    id: 'just-unbound',
    description: 'E⁺ = +1e-3·(v²/2 + μ/r): unbound side of the energy boundary',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: { energyFraction: 1e-3 },
    duration: 6000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'exactly-parabolic',
    description:
      'Post-maneuver state exactly parabolic by construction (r = μ·2⁻²⁵ m, v⁺ = 8192 m/s ⊥ r): near-parabolic class, flagged like an escape (§11.3 D2)',
    custom: 'parabolic',
    m: 0,
    dv: [0, 2400, 0],
    duration: 6000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'subsurface-within-span',
    description: 'Retro burn −400 m/s: sub-surface periapsis reached within the span',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [0, -400, 0],
    duration: 6000,
    expect: { escape: false, intersection: true },
    compareStates: true,
  },
  {
    id: 'subsurface-before-crossing',
    description: 'Same burn, span ends at 0.9× the time to the sphere: not flagged',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [0, -400, 0],
    duration: { timeToSphereFactor: 0.9 },
    expect: { escape: false, intersection: false },
  },
  {
    id: 'subsurface-after-crossing',
    description: 'Same burn, span ends at 1.1× the time to the sphere: flagged',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [0, -400, 0],
    duration: { timeToSphereFactor: 1.1 },
    expect: { escape: false, intersection: true },
  },
  {
    id: 'periapsis-just-above',
    description: 'Periapsis radius R_ref·(1 + 1e-4) (≈ 638 m above): never reaches the sphere',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: { periapsisRadius_m: R_REF * (1 + 1e-4) },
    duration: 6000,
    expect: { escape: false, intersection: false },
  },
  {
    id: 'periapsis-just-below',
    description:
      'Periapsis radius R_ref·(1 − 1e-4): reaches the sphere near periapsis within the span',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: { periapsisRadius_m: R_REF * (1 - 1e-4) },
    duration: 6000,
    expect: { escape: false, intersection: true },
    compareStates: true,
  },
  {
    id: 'hyperbolic-inbound',
    description: 'Hyperbolic, moving inward, periapsis below the sphere: escape and intersection',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [-6000, 2000, 0],
    duration: 6000,
    expect: { escape: true, intersection: true },
  },
  {
    id: 'hyperbolic-outbound',
    description:
      'Hyperbolic, moving outward, virtual periapsis below the sphere already passed: escape only',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [6000, 2000, 0],
    duration: 6000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'elliptic-outbound-long',
    description:
      'Bound, moving outward, periapsis below the sphere, span covers apoapsis and descent: flagged',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [1500, -1200, 0],
    duration: 6000,
    expect: { escape: false, intersection: true },
    compareStates: true,
  },
  {
    id: 'elliptic-outbound-short',
    description: 'Same burn, span ends at 0.5× the time to the sphere: not flagged',
    orbit: 'c1-circular-inclined',
    m: 0,
    dv: [1500, -1200, 0],
    duration: { timeToSphereFactor: 0.5 },
    expect: { escape: false, intersection: false },
  },
  {
    id: 'c4-midrun-retro',
    description:
      'C4 orbit, retro burn −1500 m/s off-grid at t = 3000.5 s, span 1.2× time to sphere',
    orbit: 'c4-moderate-inclined',
    m: 3000.5,
    dv: [0, -1500, 0],
    duration: { timeToSphereFactor: 1.2 },
    expect: { escape: false, intersection: true },
  },
  {
    id: 'c3-midrun-escape',
    description: 'C3 orbit, prograde +5000 m/s at t = 5000 s (grid point)',
    orbit: 'c3-elliptical-equatorial',
    m: 5000,
    dv: [0, 5000, 0],
    duration: 9000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'at-end-escape',
    description:
      'Maneuver at t = D: escape energy flagged although the span after it is a single instant',
    orbit: 'c1-circular-inclined',
    m: 'D',
    dv: [0, 4000, 0],
    duration: 6000,
    expect: { escape: true, intersection: false },
  },
  {
    id: 'at-end-subsurface',
    description:
      'Maneuver at t = D with sub-surface periapsis: not reached within the (zero-length) span',
    orbit: 'c1-circular-inclined',
    m: 'D',
    dv: [0, -400, 0],
    duration: 6000,
    expect: { escape: false, intersection: false },
  },
];

function vt16File(sp: Vt16Spec, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  let state: CartesianState;
  let el: KeplerianElements | null = null;
  if (sp.custom === 'parabolic') {
    state = { position_m: [MU * 2 ** -25, 0, 0], velocity_mps: [0, 5792, 0] };
  } else {
    const g = gridCase(sp.orbit ?? '');
    el = g.elements;
    state = stateFromElements(el);
  }
  // Pre-maneuver state at m (reference side): exact initial state for m = 0, otherwise the
  // 200-bit L2a state (engine's differs by ≈ P_E(m), far below every case margin).
  const preAt = (m: number): CartesianState => {
    if (m === 0) return state;
    const hp = hpPrepare(state.position_m, state.velocity_mps, MU);
    const s = hpPropagate(hp, m);
    return { position_m: toV3(s.position_m), velocity_mps: toV3(s.velocity_mps) };
  };
  const nominalD = typeof sp.duration === 'number' ? sp.duration : 6000;
  const m0 = sp.m === 'D' ? nominalD : sp.m;
  const pre = preAt(m0);
  const preConic = conicOfState(MU, pre.position_m, pre.velocity_mps);
  let dv: V3;
  const spec = sp.dv;
  if ('energyFraction' in spec) {
    const f = spec.energyFraction;
    const r = preConic.radius_m;
    const vTarget = Math.sqrt(((2 * MU) / r) * ((1 + f) / (1 - f)));
    const cf0 = postManeuverClosedForm(MU, pre.position_m, pre.velocity_mps, [0, 0, 0]);
    dv = [0, vTarget - cf0.vTransverse_mps, 0];
  } else if ('periapsisRadius_m' in spec) {
    // Burn at an apsis of a circular orbit (v_r ≈ 0): apoapsis r, periapsis target.
    const r = preConic.radius_m;
    const aT = (r + spec.periapsisRadius_m) / 2;
    const vT = Math.sqrt(MU * (2 / r - 1 / aT));
    const cf0 = postManeuverClosedForm(MU, pre.position_m, pre.velocity_mps, [0, 0, 0]);
    dv = [0, vT - cf0.vTransverse_mps, 0];
  } else {
    dv = spec;
  }
  const cf = postManeuverClosedForm(MU, pre.position_m, pre.velocity_mps, dv);
  const post: ConicSummary = cf;
  let D: number;
  if (typeof sp.duration === 'number') {
    D = sp.duration;
  } else {
    const probe = classifyVt16(MU, R_REF, post, Infinity);
    D = m0 + Math.round(probe.timeToSphere_s * sp.duration.timeToSphereFactor);
  }
  const m = sp.m === 'D' ? D : sp.m;
  const span = D - m;
  const cls = classifyVt16(MU, R_REF, post, span);
  // Case-selection margins (tolerances.md §7 VT-16; time margin chosen here, ≥ 5 %).
  const nearParabolic = sp.custom === 'parabolic';
  if (
    cls.escape !== sp.expect.escape ||
    cls.referenceSphereIntersection !== sp.expect.intersection
  ) {
    throw new Error(`VT-16 ${sp.id}: designed expectation not met by the reference classification`);
  }
  if (!nearParabolic && !(cls.energyMargin >= 1e-6))
    throw new Error(`VT-16 ${sp.id}: energy margin`);
  if (
    post.periapsisRadius_m <= R_REF * (1 + 1e-6) &&
    post.periapsisRadius_m >= R_REF * (1 - 1e-6)
  ) {
    throw new Error(`VT-16 ${sp.id}: periapsis within 1e-6 of R_ref`);
  }
  if (Number.isFinite(cls.timeToSphere_s) && span > 0 && !(cls.timeMargin >= 0.05)) {
    throw new Error(`VT-16 ${sp.id}: time margin`);
  }
  const req = request(state, D, 60, [maneuver('m1', m, dv)], requestIdOf);
  const expectedCodes = [
    ...(sp.expect.escape ? ['ESCAPE_TRAJECTORY'] : []),
    ...(sp.expect.intersection ? ['REFERENCE_SPHERE_INTERSECTION'] : []),
  ];
  let stateComparison: Record<string, unknown> | null = null;
  if (sp.compareStates === true) {
    stateComparison = vt16StateComparison(state, dv, D, sp.id);
  }
  return {
    path: `test-data/reference-cases/vt-16/${sp.id}.json`,
    data: {
      id: `vt-16/${sp.id}`,
      version: 1,
      family: 'VT-16 Escape / reference-sphere intersection (ML-FR-006 AC6)',
      description: sp.description,
      status: STATUS,
      inputs: {
        request: req,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: el,
        maneuverTime_s: m,
        initialStateNote:
          sp.custom === 'parabolic'
            ? 'Request-level initial state (not from elements): r = (μ·2⁻²⁵, 0, 0) m, v = (0, 5792, 0) m/s, a bound orbit with periapsis ≈ 1.187e7 m. With the exact RSW axes of this axis-aligned state, v⁺ = (0, 8192, 0) and v⁺²·r = 2μ exactly: zero energy.'
            : 'L2c element → state of gridElements',
      },
      model: model(),
      producedBy: producedBy(prov, [
        'ref/maneuver.ts (320-bit closed form, analytic crossing time)',
        'L2a/L2b for the state comparison',
      ]),
      method: {
        semantics: `${CONTRACT} §8.3, §11.3 D1–D5, §11.4 P2 (t_s = maneuver time), P6 (post-maneuver segment only)`,
        escapeRule:
          'ESCAPE_TRAJECTORY iff the post-maneuver specific energy is not negative beyond its rounding uncertainty (D1, D2). Cases are ≥ 1e-6·(v²/2 + μ/r) from zero (record §7 VT-16 case-selection margin) except the exactly-parabolic case, which is in the near-parabolic class by construction.',
        intersectionRule:
          'REFERENCE_SPHERE_INTERSECTION iff the radius is ≤ R_ref at some time in [m, D], inclusive (D3, D4), decided from the post-maneuver conic: r_p⁺ ≤ R_ref and the analytic time to first reach R_ref (Kepler / hyperbolic Kepler equation) ≤ D − m. Cases: |r_p⁺ − R_ref| ≥ 1e-6 R_ref (record) and |t_c − (D − m)| ≥ 5 % of the span (chosen here).',
        preManeuverState:
          m === 0
            ? 'request.initialState (exact)'
            : 'L2a in 200-bit arithmetic at m (hp-kepler.ts); the engine state differs by ≈ P_E(m) ≪ margins',
        deltaV: dv,
      },
      outputs: {
        expectedWarningCodes: expectedCodes,
        expectedDiagnosticTime_s: m,
        expectedStatus: 'ok',
        postManeuver: post,
        margins: {
          energy: cls.energyMargin,
          periapsisRadius: cls.radiusMargin,
          timeToSphere_s: Number.isFinite(cls.timeToSphere_s) ? cls.timeToSphere_s : null,
          timeMargin: Number.isFinite(cls.timeMargin) ? cls.timeMargin : null,
        },
        stateComparison,
      },
      tolerance: {
        record: `${RECORD} §7 VT-16, §7 VT-05 (post-maneuver segments)`,
        warnings:
          'exact (set of warning codes, each with t_s = maneuver time; no error diagnostic, status ok)',
        states:
          stateComparison === null
            ? 'Not compared for this case. Hyperbolic arcs: the record gives only a recipe (componentwise §6.1 sums on the arc, §7 VT-16), not evaluated in this task — gap.'
            : 'Per sample in outputs.stateComparison (elliptic post-maneuver arc: §6.3 formula at the post-maneuver scales, VT-05 post-maneuver rule)',
        layers: 'Warnings: L2 (independent analytic classification). States: L2a, L2b.',
      },
    },
  };
}

/**
 * Elliptic sub-surface arcs, maneuver at t = 0: per-sample tolerances for the post-maneuver
 * segment vs L2a and L2b started at the engine's event state (tolerances.md §7 VT-05,
 * "post-maneuver segments: the reference starts from the engine's event state … Δt = t − m").
 * Scales of the post-maneuver orbit from the reference closed form (§4.1 item 2). E_RK by step
 * halving from the reference post-maneuver state fl(v⁻ + Δv_I,ref); it applies to the engine's
 * event state, which differs by ≤ the VT-12 bound (≈ 1e-14 relative of Δv), a negligible change of
 * the truncation error (checked by the test: event state within 1e-9 m/s of this start).
 */
function vt16StateComparison(
  state: CartesianState,
  dv: V3,
  D: number,
  id: string,
): Record<string, unknown> {
  const dvI = rswToInertialHp(state.position_m, state.velocity_mps, dv);
  const v0: V3 = [
    state.velocity_mps[0] + dvI[0],
    state.velocity_mps[1] + dvI[1],
    state.velocity_mps[2] + dvI[2],
  ];
  const post = conicOfState(MU, state.position_m, v0);
  const sPost = scales(MU, post.semiMajorAxis_m, post.eccentricity);
  const startScale = Math.abs(post.energy_Jpkg) / post.energyScale_Jpkg; // record: valid only if ≥ 0.1
  if (!(startScale >= 0.1)) throw new Error(`VT-16 ${id}: |E| < 0.1 scale, formula not valid`);
  const h = 60;
  if (D % h !== 0) throw new Error(`VT-16 ${id}: D must be a multiple of the output step`);
  const nOut = D / h;
  let chosen: { spo: number; rk: ReturnType<typeof rk4WithHalving> } | null = null;
  // Step rule (reference-only survey, ML-TASK-018 part C): the finest step 60 s/spo, spo in
  // {64, 32, 16, 8, 4}, for which every output time is in the §9.2 asymptotic regime and
  // E_RK ≤ 1e-10 r_max. Finer steps become round-off dominated at 60 s output intervals.
  for (const spo of [64, 32, 16, 8, 4]) {
    const rk = rk4WithHalving(
      { position_m: state.position_m, velocity_mps: v0 },
      MU,
      h / spo,
      spo,
      nOut,
    );
    const ok = rk
      .slice(1)
      .every((s) => s.asymptotic_r && s.asymptotic_v && s.eRk_r <= E_RK_TARGET_REL * sPost.ra);
    if (ok) {
      chosen = { spo, rk };
      break;
    }
  }
  if (chosen === null) throw new Error(`VT-16 ${id}: no RK step met the §9.2 rule`);
  const t = Array.from({ length: nOut + 1 }, (_, k) => k * h);
  const rk = chosen.rk;
  return {
    startState: { position_m: state.position_m, velocity_mps: v0 },
    startStateNote:
      'Reference post-maneuver state fl(v⁻ + Δv_I,ref) at t = 0. The test starts L2a and L2b at the engine event state (position_m, velocityAfter_mps).',
    postScales: scaleInputs(sPost),
    energyOverScaleAtStart: startScale,
    t_s: t,
    l2b: {
      algorithm: `Classical RK4 (p = ${String(RK_ORDER)}), Kahan-compensated, fixed step; step halving h, h/2, h/4 (§9.2)`,
      rkStep_s: h / chosen.spo,
      referenceStep_s: h / chosen.spo / 4,
      stepsPerOutputCoarsest: chosen.spo,
      eRk_r_m: rk.map((s, k) => (k === 0 ? 0 : s.eRk_r)),
      eRk_v_mps: rk.map((s, k) => (k === 0 ? 0 : s.eRk_v)),
      allAsymptotic: true,
      position_m: rk.map((s) => v3(s.state.position_m)),
      velocity_mps: rk.map((s) => v3(s.state.velocity_mps)),
    },
    tolerance: {
      formula:
        'vs L2a: ‖Δr‖ ≤ M[P_E(Δt) + P_A(Δt)], ‖Δv‖ ≤ M[V_E(Δt) + V_A(Δt)]; vs L2b: ‖Δr‖ ≤ M·P_E(Δt) + 2E_RK,r, ‖Δv‖ ≤ M·V_E(Δt) + 2E_RK,v; Δt = t − m, scales of the post-maneuver orbit',
      vsL2a_position_m: t.map((x) => (x === 0 ? 0 : vt05L2a(sPost, x).position_m)),
      vsL2a_velocity_mps: t.map((x) => (x === 0 ? 0 : vt05L2a(sPost, x).velocity_mps)),
      vsL2b_position_m: t.map((x, k) =>
        x === 0 ? 0 : MARGIN * pE(sPost, x) + 2 * (rk[k]?.eRk_r ?? NaN),
      ),
      vsL2b_velocity_mps: t.map((x, k) =>
        x === 0 ? 0 : MARGIN * vE(sPost, x) + 2 * (rk[k]?.eRk_v ?? NaN),
      ),
      sample0: 'exact: first sample of the post-maneuver segment = event state (R8)',
    },
  };
}

// =============================================================================================
// VT-18 invalid input handling (exact codes and paths)

type JsonPath = (string | number)[];
type Encoded =
  number | string | boolean | null | { $number: string } | unknown[] | Record<string, unknown>;

interface Mutation {
  readonly op: 'set' | 'delete';
  readonly path: JsonPath;
  readonly value?: Encoded;
}

interface Vt18Case {
  readonly id: string;
  readonly description: string;
  readonly mutations: readonly Mutation[];
  /** Replaces the whole input (used for a non-object input). */
  readonly replaceInput?: Encoded;
  readonly layer: 'structural' | 'semantic' | 'accepted';
  readonly expected: readonly { code: string; path: JsonPath }[];
  /** Accepted cases with a huge grid are validated but not run. */
  readonly run?: boolean;
}

const num = (s: 'NaN' | 'Infinity' | '-Infinity' | '-0'): { $number: string } => ({ $number: s });

function baseScenario(): Scenario {
  return {
    schemaVersion: '1.0',
    id: 'vt18-base',
    name: 'VT-18 base scenario',
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: EPOCH,
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7.0e6,
        eccentricity: 0.001,
        inclination_rad: 0.9,
        raan_rad: 1.2,
        argPeriapsis_rad: 0.5,
        trueAnomaly_rad: 0.3,
      },
    },
    maneuvers: [{ id: 'm1', t_s: 1000, frame: 'RSW', deltaV_mps: [0, 10, 0] }],
    duration_s: 6000,
    outputStep_s: 60,
  };
}

const EL = ['initialOrbit', 'elements'];
const M0 = ['maneuvers', 0];
const set = (path: JsonPath, value: Encoded): Mutation => ({ op: 'set', path, value });
const del = (path: JsonPath): Mutation => ({ op: 'delete', path });

const VT18: readonly Vt18Case[] = [
  {
    id: 'schema-version-other',
    description: 'schemaVersion "1.1"',
    mutations: [set(['schemaVersion'], '1.1')],
    layer: 'structural',
    expected: [{ code: 'SCHEMA_VERSION_UNSUPPORTED', path: ['schemaVersion'] }],
  },
  {
    id: 'schema-version-missing',
    description: 'schemaVersion missing (other errors present are not reported)',
    mutations: [del(['schemaVersion']), set(['duration_s'], -1)],
    layer: 'structural',
    expected: [{ code: 'SCHEMA_VERSION_UNSUPPORTED', path: ['schemaVersion'] }],
  },
  {
    id: 'not-an-object',
    description: 'Input is a string',
    mutations: [],
    replaceInput: 'scenario',
    layer: 'structural',
    expected: [{ code: 'TYPE_MISMATCH', path: [] }],
  },
  {
    id: 'id-empty',
    description: 'Scenario id ""',
    mutations: [set(['id'], '')],
    layer: 'structural',
    expected: [{ code: 'ID_EMPTY', path: ['id'] }],
  },
  {
    id: 'name-not-string',
    description: 'name is a number',
    mutations: [set(['name'], 5)],
    layer: 'structural',
    expected: [{ code: 'TYPE_MISMATCH', path: ['name'] }],
  },
  {
    id: 'central-body',
    description: 'centralBody "MOON"',
    mutations: [set(['centralBody'], 'MOON')],
    layer: 'structural',
    expected: [{ code: 'UNSUPPORTED_VALUE', path: ['centralBody'] }],
  },
  {
    id: 'frame',
    description: 'frame "EME2000"',
    mutations: [set(['frame'], 'EME2000')],
    layer: 'structural',
    expected: [{ code: 'UNSUPPORTED_VALUE', path: ['frame'] }],
  },
  {
    id: 'epoch-scale',
    description: 'epoch.scale "TAI"',
    mutations: [set(['epoch', 'scale'], 'TAI')],
    layer: 'structural',
    expected: [{ code: 'UNSUPPORTED_VALUE', path: ['epoch', 'scale'] }],
  },
  {
    id: 'epoch-feb-30',
    description: 'epoch 2026-02-30 (not a calendar day)',
    mutations: [set(['epoch', 'iso'], '2026-02-30T00:00:00.000Z')],
    layer: 'structural',
    expected: [{ code: 'EPOCH_INVALID', path: ['epoch', 'iso'] }],
  },
  {
    id: 'epoch-leap-second',
    description: 'epoch second 60',
    mutations: [set(['epoch', 'iso'], '2026-12-31T23:59:60.000Z')],
    layer: 'structural',
    expected: [{ code: 'EPOCH_INVALID', path: ['epoch', 'iso'] }],
  },
  {
    id: 'epoch-no-millis',
    description: 'epoch without the 3 fractional digits',
    mutations: [set(['epoch', 'iso'], '2026-01-01T00:00:00Z')],
    layer: 'structural',
    expected: [{ code: 'EPOCH_INVALID', path: ['epoch', 'iso'] }],
  },
  {
    id: 'orbit-kind',
    description: 'initialOrbit.kind "CARTESIAN"',
    mutations: [set(['initialOrbit', 'kind'], 'CARTESIAN')],
    layer: 'structural',
    expected: [{ code: 'UNSUPPORTED_VALUE', path: ['initialOrbit', 'kind'] }],
  },
  {
    id: 'a-zero',
    description: 'a = 0',
    mutations: [set([...EL, 'semiMajorAxis_m'], 0)],
    layer: 'structural',
    expected: [{ code: 'SEMI_MAJOR_AXIS_NOT_POSITIVE', path: [...EL, 'semiMajorAxis_m'] }],
  },
  {
    id: 'a-negative-zero',
    description: 'a = −0 (fails every > 0 rule, contract §2)',
    mutations: [set([...EL, 'semiMajorAxis_m'], num('-0'))],
    layer: 'structural',
    expected: [{ code: 'SEMI_MAJOR_AXIS_NOT_POSITIVE', path: [...EL, 'semiMajorAxis_m'] }],
  },
  {
    id: 'a-negative',
    description: 'a = −7e6',
    mutations: [set([...EL, 'semiMajorAxis_m'], -7e6)],
    layer: 'structural',
    expected: [{ code: 'SEMI_MAJOR_AXIS_NOT_POSITIVE', path: [...EL, 'semiMajorAxis_m'] }],
  },
  {
    id: 'a-nan',
    description: 'a = NaN',
    mutations: [set([...EL, 'semiMajorAxis_m'], num('NaN'))],
    layer: 'structural',
    expected: [{ code: 'NON_FINITE_NUMBER', path: [...EL, 'semiMajorAxis_m'] }],
  },
  {
    id: 'e-one',
    description: 'e = 1 (closed orbits only)',
    mutations: [set([...EL, 'eccentricity'], 1)],
    layer: 'structural',
    expected: [{ code: 'ECCENTRICITY_OUT_OF_RANGE', path: [...EL, 'eccentricity'] }],
  },
  {
    id: 'e-negative',
    description: 'e = −1e-300',
    mutations: [set([...EL, 'eccentricity'], -1e-300)],
    layer: 'structural',
    expected: [{ code: 'ECCENTRICITY_OUT_OF_RANGE', path: [...EL, 'eccentricity'] }],
  },
  {
    id: 'i-above-pi',
    description: 'i = next binary64 above Math.PI',
    mutations: [set([...EL, 'inclination_rad'], 3.1415926535897936)],
    layer: 'structural',
    expected: [{ code: 'INCLINATION_OUT_OF_RANGE', path: [...EL, 'inclination_rad'] }],
  },
  {
    id: 'i-negative',
    description: 'i = −1e-300',
    mutations: [set([...EL, 'inclination_rad'], -1e-300)],
    layer: 'structural',
    expected: [{ code: 'INCLINATION_OUT_OF_RANGE', path: [...EL, 'inclination_rad'] }],
  },
  {
    id: 'raan-two-pi',
    description: 'Ω = 2 * Math.PI',
    mutations: [set([...EL, 'raan_rad'], 2 * Math.PI)],
    layer: 'structural',
    expected: [{ code: 'ANGLE_OUT_OF_RANGE', path: [...EL, 'raan_rad'] }],
  },
  {
    id: 'argp-negative',
    description: 'ω = −1e-300',
    mutations: [set([...EL, 'argPeriapsis_rad'], -1e-300)],
    layer: 'structural',
    expected: [{ code: 'ANGLE_OUT_OF_RANGE', path: [...EL, 'argPeriapsis_rad'] }],
  },
  {
    id: 'nu-seven',
    description: 'ν = 7 rad',
    mutations: [set([...EL, 'trueAnomaly_rad'], 7)],
    layer: 'structural',
    expected: [{ code: 'ANGLE_OUT_OF_RANGE', path: [...EL, 'trueAnomaly_rad'] }],
  },
  {
    id: 'duration-infinite',
    description: 'duration_s = +∞ (type error suppresses the cross-field rule)',
    mutations: [set(['duration_s'], num('Infinity'))],
    layer: 'structural',
    expected: [{ code: 'NON_FINITE_NUMBER', path: ['duration_s'] }],
  },
  {
    id: 'dv-minus-infinity',
    description: 'Δv component −∞',
    mutations: [set([...M0, 'deltaV_mps', 1], num('-Infinity'))],
    layer: 'structural',
    expected: [{ code: 'NON_FINITE_NUMBER', path: [...M0, 'deltaV_mps', 1] }],
  },
  {
    id: 'duration-zero',
    description:
      'duration_s = 0 (maneuver at 1000 s also out of range: range failures do not suppress cross-field rules)',
    mutations: [set(['duration_s'], 0)],
    layer: 'structural',
    expected: [
      { code: 'DURATION_NOT_POSITIVE', path: ['duration_s'] },
      { code: 'MANEUVER_TIME_OUT_OF_RANGE', path: [...M0, 't_s'] },
    ],
  },
  {
    id: 'duration-negative-zero',
    description: 'duration_s = −0',
    mutations: [set(['duration_s'], num('-0'))],
    layer: 'structural',
    expected: [
      { code: 'DURATION_NOT_POSITIVE', path: ['duration_s'] },
      { code: 'MANEUVER_TIME_OUT_OF_RANGE', path: [...M0, 't_s'] },
    ],
  },
  {
    id: 'step-zero',
    description: 'outputStep_s = 0',
    mutations: [set(['outputStep_s'], 0)],
    layer: 'structural',
    expected: [{ code: 'OUTPUT_STEP_NOT_POSITIVE', path: ['outputStep_s'] }],
  },
  {
    id: 'step-negative',
    description: 'outputStep_s = −60',
    mutations: [set(['outputStep_s'], -60)],
    layer: 'structural',
    expected: [{ code: 'OUTPUT_STEP_NOT_POSITIVE', path: ['outputStep_s'] }],
  },
  {
    id: 'maneuver-time-negative',
    description: 'maneuver t_s = −1',
    mutations: [set([...M0, 't_s'], -1)],
    layer: 'structural',
    expected: [{ code: 'MANEUVER_TIME_OUT_OF_RANGE', path: [...M0, 't_s'] }],
  },
  {
    id: 'maneuver-time-after-end',
    description: 'maneuver t_s = next binary64 above duration_s',
    mutations: [set([...M0, 't_s'], 6000.000000000001)],
    layer: 'structural',
    expected: [{ code: 'MANEUVER_TIME_OUT_OF_RANGE', path: [...M0, 't_s'] }],
  },
  {
    id: 'maneuver-frame',
    description: 'maneuver frame "GCRF"',
    mutations: [set([...M0, 'frame'], 'GCRF')],
    layer: 'structural',
    expected: [{ code: 'UNSUPPORTED_VALUE', path: [...M0, 'frame'] }],
  },
  {
    id: 'maneuver-dv-length',
    description: 'Δv with 2 components',
    mutations: [set([...M0, 'deltaV_mps'], [0, 10])],
    layer: 'structural',
    expected: [{ code: 'TYPE_MISMATCH', path: [...M0, 'deltaV_mps'] }],
  },
  {
    id: 'maneuver-id-empty',
    description: 'maneuver id ""',
    mutations: [set([...M0, 'id'], '')],
    layer: 'structural',
    expected: [{ code: 'ID_EMPTY', path: [...M0, 'id'] }],
  },
  {
    id: 'two-maneuvers',
    description: 'second maneuver (M1 limit)',
    mutations: [
      set(['maneuvers', 1], { id: 'm2', t_s: 2000, frame: 'RSW', deltaV_mps: [0, 5, 0] }),
    ],
    layer: 'structural',
    expected: [{ code: 'MANEUVER_COUNT_EXCEEDED', path: ['maneuvers'] }],
  },
  {
    id: 'two-maneuvers-same-id',
    description: 'second maneuver with the same id',
    mutations: [
      set(['maneuvers', 1], { id: 'm1', t_s: 2000, frame: 'RSW', deltaV_mps: [0, 5, 0] }),
    ],
    layer: 'structural',
    expected: [
      { code: 'MANEUVER_COUNT_EXCEEDED', path: ['maneuvers'] },
      { code: 'ID_DUPLICATE', path: ['maneuvers', 1, 'id'] },
    ],
  },
  {
    id: 'unknown-top-level',
    description: 'unknown field "extra"',
    mutations: [set(['extra'], 1)],
    layer: 'structural',
    expected: [{ code: 'UNKNOWN_FIELD', path: ['extra'] }],
  },
  {
    id: 'unknown-in-elements',
    description: 'unknown field in elements',
    mutations: [set([...EL, 'meanAnomaly_rad'], 0.1)],
    layer: 'structural',
    expected: [{ code: 'UNKNOWN_FIELD', path: [...EL, 'meanAnomaly_rad'] }],
  },
  {
    id: 'missing-duration',
    description: 'duration_s missing',
    mutations: [del(['duration_s'])],
    layer: 'structural',
    expected: [{ code: 'TYPE_MISMATCH', path: ['duration_s'] }],
  },
  {
    id: 'maneuvers-null',
    description: 'maneuvers null',
    mutations: [set(['maneuvers'], null)],
    layer: 'structural',
    expected: [{ code: 'TYPE_MISMATCH', path: ['maneuvers'] }],
  },
  {
    id: 'perigee-at-reference-radius',
    description: 'a = R_ref, e = 0: a(1 − e) = R_ref exactly, not above',
    mutations: [set([...EL, 'semiMajorAxis_m'], R_REF), set([...EL, 'eccentricity'], 0)],
    layer: 'semantic',
    expected: [{ code: 'PERIGEE_BELOW_REFERENCE_RADIUS', path: EL }],
  },
  {
    id: 'perigee-below',
    description: 'a = 7e6, e = 0.1: perigee 6.3e6 m',
    mutations: [set([...EL, 'eccentricity'], 0.1)],
    layer: 'semantic',
    expected: [{ code: 'PERIGEE_BELOW_REFERENCE_RADIUS', path: EL }],
  },
  {
    id: 'sample-count-1000001',
    description: 'D = 1e6 s, h = 1 s, no maneuver: 1 000 001 samples (limit 1 000 000, §11.4 P1)',
    mutations: [set(['maneuvers'], []), set(['duration_s'], 1e6), set(['outputStep_s'], 1)],
    layer: 'semantic',
    expected: [{ code: 'SAMPLE_COUNT_EXCEEDED', path: ['outputStep_s'] }],
  },
  {
    id: 'sample-count-with-maneuver',
    description:
      'D = 999 999 s, h = 1 s, maneuver at 500 000 s (counted in both segments): 1 000 001 samples',
    mutations: [set(['duration_s'], 999999), set(['outputStep_s'], 1), set([...M0, 't_s'], 500000)],
    layer: 'semantic',
    expected: [{ code: 'SAMPLE_COUNT_EXCEEDED', path: ['outputStep_s'] }],
  },
  {
    id: 'accepted-base',
    description: 'base scenario',
    mutations: [],
    layer: 'accepted',
    expected: [],
    run: true,
  },
  {
    id: 'accepted-perigee-1m-above',
    description: 'a = R_ref + 1 m, e = 0',
    mutations: [set([...EL, 'semiMajorAxis_m'], R_REF + 1), set([...EL, 'eccentricity'], 0)],
    layer: 'accepted',
    expected: [],
    run: true,
  },
  {
    id: 'accepted-sample-count-limit',
    description:
      'D = 999 999 s, h = 1 s, no maneuver: exactly 1 000 000 samples (validated, not run)',
    mutations: [set(['maneuvers'], []), set(['duration_s'], 999999), set(['outputStep_s'], 1)],
    layer: 'accepted',
    expected: [],
    run: false,
  },
  {
    id: 'accepted-boundaries',
    description: 'i = Math.PI, Ω just below 2π, e = −0, ν = −0, maneuver at t_s = duration_s',
    mutations: [
      set([...EL, 'inclination_rad'], Math.PI),
      set([...EL, 'raan_rad'], BELOW_TWO_PI),
      set([...EL, 'eccentricity'], num('-0')),
      set([...EL, 'trueAnomaly_rad'], num('-0')),
      set([...M0, 't_s'], 6000),
    ],
    layer: 'accepted',
    expected: [],
    run: true,
  },
];

function vt18File(prov: Provenance): DatasetFile {
  return {
    path: 'test-data/reference-cases/vt-18/invalid-inputs.json',
    data: {
      id: 'vt-18/invalid-inputs',
      version: 1,
      family: 'VT-18 Invalid input handling (ML-FR-002 AC2, ML-FR-005 AC2, ML-FR-011 AC3)',
      description:
        'One mutation of a valid base scenario per invalid-input class, with the expected issues (code and path) decided from the contract text; accepted controls at the boundaries.',
      status: STATUS,
      inputs: {
        baseScenario: baseScenario(),
        encoding:
          'A value {"$number": "NaN" | "Infinity" | "-Infinity" | "-0"} stands for that binary64 value (JSON cannot carry it). Mutations are applied in order to a deep copy of baseScenario: "set" assigns at the path (creating array slots), "delete" removes the key.',
        cases: VT18,
      },
      model: {
        note: 'No physics except the semantic rules (reference radius 6 378 137 m, sample-count limit 1 000 000 of §11.4 P1).',
      },
      producedBy: producedBy(prov, [`${CONTRACT} §2, §3, §6, §6.1, §8.1, §8.2, §11.4 P1`]),
      method: {
        structural:
          'validateScenario (packages/contracts): the issue multiset {code, path} must equal expected exactly (all independent violations reported, §6).',
        semantic:
          'Only for structurally valid inputs: the semantic function of packages/simulation (§3) must return exactly the expected {code, path}.',
        noResult:
          'A rejected scenario never yields a request or a SimulationResult (§3, §6 engine boundary).',
        boundaryRule:
          'Boundary inputs are exactly evaluable in binary64 (record §1 VT-18: a = R_ref, e = 0; next binary64 above π; 2π as 2 * Math.PI); no input within a few ulps of a rule whose evaluation could round.',
      },
      outputs: { expectedPerCase: 'see inputs.cases[].expected' },
      tolerance: {
        record: `${RECORD} §1 VT-18`,
        rule: 'exact (discrete codes and paths)',
        layers: 'none (contract conformance)',
      },
    },
  };
}

// =============================================================================================
// VI-01 request → result structure, P3 −0 rule, failed-result shape

interface Vi01Spec {
  readonly id: string;
  readonly description: string;
  readonly duration_s: number;
  readonly outputStep_s: number;
  readonly maneuver?: { t_s: number; dv: V3 };
}

const VI01_ELEMENTS: KeplerianElements = {
  semiMajorAxis_m: 7.2e6,
  eccentricity: 0.01,
  inclination_rad: 0.9,
  raan_rad: 1.2,
  argPeriapsis_rad: 0.5,
  trueAnomaly_rad: 0.3,
};

const VI01: readonly Vi01Spec[] = [
  {
    id: 'no-maneuver',
    description: 'Coast, D a multiple of h',
    duration_s: 6000,
    outputStep_s: 60,
  },
  {
    id: 'maneuver-on-grid',
    description: 'Maneuver mid-run on a grid point',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 3000, dv: [5, 10, -3] },
  },
  {
    id: 'maneuver-off-grid',
    description: 'Maneuver mid-run off the grid',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 3001.5, dv: [5, 10, -3] },
  },
  {
    id: 'maneuver-at-zero',
    description: 'Maneuver at t = 0: segment 0 is the single sample [0]',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 0, dv: [5, 10, -3] },
  },
  {
    id: 'maneuver-at-end',
    description: 'Maneuver at t = D: last segment is the single sample [D]',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 6000, dv: [5, 10, -3] },
  },
  {
    id: 'zero-dv',
    description: 'Zero Δv mid-run: still one event and two segments',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 3000, dv: [0, 0, 0] },
  },
  {
    id: 'step-exceeds-duration',
    description: 'h ≥ D: samples 0, m, D only',
    duration_s: 100,
    outputStep_s: 250,
    maneuver: { t_s: 50, dv: [1, 0, 0] },
  },
  {
    id: 'non-dyadic-step',
    description: 'h = 0.1 s: candidates fl(j × 0.1), never accumulated',
    duration_s: 100,
    outputStep_s: 0.1,
    maneuver: { t_s: 33.3, dv: [0, 1, 0] },
  },
  {
    id: 'maneuver-one-ulp-after-grid-point',
    description: 'Maneuver at the next binary64 above 3000: both samples kept',
    duration_s: 6000,
    outputStep_s: 60,
    maneuver: { t_s: 3000.0000000000005, dv: [0, 2, 0] },
  },
  {
    id: 'duration-not-multiple',
    description: 'D = 6000.5 not a multiple of h; maneuver between the last candidate and D',
    duration_s: 6000.5,
    outputStep_s: 60,
    maneuver: { t_s: 6000.25, dv: [0, 0, 3] },
  },
];

function vi01Scenario(sp: Vi01Spec): Scenario {
  return {
    schemaVersion: '1.0',
    id: `vi01-${sp.id}`,
    name: sp.description,
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: EPOCH,
    initialOrbit: { kind: 'KEPLERIAN', elements: VI01_ELEMENTS },
    maneuvers: sp.maneuver === undefined ? [] : [maneuver('m1', sp.maneuver.t_s, sp.maneuver.dv)],
    duration_s: sp.duration_s,
    outputStep_s: sp.outputStep_s,
  };
}

function vi01File(prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const scenarios = VI01.map((sp) => {
    const sc = vi01Scenario(sp);
    const grid = samplingGridWithManeuvers(
      sp.duration_s,
      sp.outputStep_s,
      sp.maneuver === undefined ? [] : [sp.maneuver.t_s],
    );
    return {
      id: sp.id,
      description: sp.description,
      scenario: sc,
      expected: {
        status: 'ok',
        runtimeDiagnosticCodes: [],
        segmentTimes_s: grid.segments,
        events: sp.maneuver === undefined ? [] : [{ maneuverId: 'm1', t_s: sp.maneuver.t_s }],
      },
    };
  });
  // Rectilinear collision (failed-result shape): circular orbit, maneuver at t = 0 cancelling the
  // tangential velocity exactly (axis-aligned state, so the RSW axes are exact).
  const r0 = 7.0e6;
  const vc = Math.sqrt(MU / r0);
  const fall = (Math.PI / 2) * Math.sqrt((r0 * r0 * r0) / (2 * MU));
  const rect = request(
    { position_m: [r0, 0, 0], velocity_mps: [0, vc, 0] },
    2000,
    100,
    [maneuver('m1', 0, [0, -vc, 0])],
    requestIdOf,
  );
  // Request with a maneuver at −0 (P3 normalises −0 only in the scenario→request builder; a request
  // given directly keeps it: §5.2 grid sample −0).
  const negZeroBase = request(
    stateFromElements(VI01_ELEMENTS),
    600,
    60,
    [maneuver('m1', 0, [0, 1, 0])],
    requestIdOf,
  );
  // −0 scenario pairs (P3): every zero field of this scenario can carry −0.
  const zeroScenario: Scenario = {
    schemaVersion: '1.0',
    id: 'vi01-negative-zero',
    name: 'P3 −0 normalisation',
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: EPOCH,
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7.0e6,
        eccentricity: 0,
        inclination_rad: 0,
        raan_rad: 0,
        argPeriapsis_rad: 0,
        trueAnomaly_rad: 0,
      },
    },
    maneuvers: [{ id: 'm1', t_s: 0, frame: 'RSW', deltaV_mps: [0, 10, 0] }],
    duration_s: 600,
    outputStep_s: 60,
  };
  const negZeroVariants = [
    { id: 'eccentricity', path: [...EL, 'eccentricity'] },
    { id: 'inclination', path: [...EL, 'inclination_rad'] },
    { id: 'raan', path: [...EL, 'raan_rad'] },
    { id: 'argPeriapsis', path: [...EL, 'argPeriapsis_rad'] },
    { id: 'trueAnomaly', path: [...EL, 'trueAnomaly_rad'] },
    { id: 'maneuverTime', path: [...M0, 't_s'] },
    { id: 'deltaV-R', path: [...M0, 'deltaV_mps', 0] },
    { id: 'deltaV-W', path: [...M0, 'deltaV_mps', 2] },
  ];
  return {
    path: 'test-data/reference-cases/vi-01/structure.json',
    data: {
      id: 'vi-01/structure',
      version: 1,
      family: 'VI-01 Request → result structure (contracts-v1.md §13); P3 −0 rule; VT-10 inputs',
      description:
        'Scenarios covering no maneuver, maneuver mid-run on and off the grid, at t = 0, at t = D, zero Δv, h ≥ D, non-dyadic h, one-ulp separation, D not a multiple of h; a request with a maneuver at −0; the rectilinear-collision request (failed-result shape); −0 scenario variants (P3).',
      status: STATUS,
      inputs: {
        scenarios,
        negativeZeroManeuverRequest: {
          base: negZeroBase,
          note: 'The test sets maneuvers[0].t_s = −0 and recomputes the requestId with the contract payload (−0 is encoded as 8000000000000000). Expected §5.2 grid: segment 0 = [−0], segment 1 starts with −0.',
          expectedSegmentTimes_s: samplingGridWithManeuvers(600, 60, [-0]).segments,
        },
        rectilinearCollision: {
          request: rect,
          requestIdNote: REQUEST_ID_NOTE,
          fallTime_s: fall,
          fallTimeFormula: '(π/2)·√(r0³/(2μ)) (radial free fall from rest at r0 to the centre)',
          expected: {
            status: 'failed',
            errorDiagnostics: [{ code: 'NON_FINITE_STATE', severity: 'error' }],
            segments: 0,
            events: 0,
            note: 'As specified for ML-TASK-018 part C (ML-TASK-019 collision fix). The pre-maneuver state is axis aligned, so R = x̂, S = ŷ, W = ẑ exactly and v⁺ = 0 exactly for any evaluation of the RSW sum; the fall to r = 0 happens at fallTime_s < duration_s.',
          },
        },
        negativeZeroScenarios: {
          base: zeroScenario,
          variants: negZeroVariants,
          allAtOnce: true,
          expected:
            'Every variant (−0 at the path, and all at once) yields the same requestId as the base (contract §11.4 P3) and a request whose canonical payload equals the base one.',
        },
      },
      model: model(),
      producedBy: producedBy(prov, ['§5.2 grid (ref/grid.ts, independent construction)']),
      method: {
        checks: `${CONTRACT} §13: validateSimulationResult (R1–R13); result.model.constants bit-identical to request.constants (numbers Object.is, source ===); model.sampling and model.epoch equal to the request; sample times equal to the independent §5.2 grid (Object.is, per segment); events maneuverId and t_s equal to the maneuver's; first sample of segment 0 bit-identical to request.initialState; typed arrays own their ArrayBuffer (byteOffset 0, whole buffer, not shared, not SharedArrayBuffer); failed result: no segments, no events, the expected error diagnostic.`,
        runtimeDiagnostics:
          'Benign scenarios (bound, perigee ≥ 7.128e6 m, Δv ≤ 12 m/s): no warning or error expected.',
      },
      outputs: { expected: 'per scenario in inputs.scenarios[].expected' },
      tolerance: {
        record: `${RECORD} §1, §8 VI-01`,
        rule: 'exact',
        layers: 'none (contract conformance)',
      },
    },
  };
}

// =============================================================================================

export function buildPartCDatasets(prov: Provenance, requestIdOf: RequestIdFn): DatasetFile[] {
  const files: DatasetFile[] = [vt01File(prov)];
  for (const g of GRID) files.push(vt0607File(g, prov, requestIdOf));
  for (const sp of VT09) files.push(vt09File(sp, prov, requestIdOf));
  for (const o of VT12_ORBITS) {
    files.push(vt12File(o, 't0', prov, requestIdOf));
    files.push(vt12File(o, 'tmid', prov, requestIdOf));
  }
  for (const sp of VT14) files.push(vt14File(sp, prov, requestIdOf));
  for (const sp of VT15) files.push(vt15File(sp, prov, requestIdOf));
  for (const sp of VT16) files.push(vt16File(sp, prov, requestIdOf));
  files.push(vt18File(prov));
  files.push(vi01File(prov, requestIdOf));
  return files;
}
