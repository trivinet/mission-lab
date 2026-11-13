/**
 * Builds the ML-TASK-011 reference datasets (verification plan §6) for VT-02, VT-03, VT-04,
 * VT-05 and VT-08 from the L2 references. Pure: no file or network access; the caller supplies
 * the provenance and the requestId function (datasets.test.ts writes and checks the files).
 *
 * Every tolerance in a dataset is the approved formula of docs/verification/tolerances.md
 * (revision 3, approved 2026-11-13) evaluated at the dataset's own scale with reference-side
 * inputs (§4.1 item 2), and is committed with the dataset before any engine run (§4.1 item 1).
 */
import type {
  CartesianState,
  KeplerianElements,
  PhysicalConstants,
  SimulationRequest,
} from '@mission-lab/contracts';
import { hpDist, hpElementsToState, hpPrepare, hpPropagate } from '../hp/hp-kepler';
import {
  elementsToState,
  stateToElementView,
  stateToElementsRaw,
  EPS_E,
  EPS_I,
} from '../ref/elements';
import { prepareL2a, propagateL2a } from '../ref/kepler';
import { RK_ORDER, rk4WithHalving } from '../ref/rk';
import type { V3 } from '../ref/vec';
import {
  E_HAT_EXACT_CIRCULAR,
  E_RK_TARGET_REL,
  MARGIN,
  U,
  bRt,
  bVt,
  elementRows,
  etaR,
  etaV,
  iHatExactRetrograde,
  pA,
  scales,
  vA,
  vt02,
  vt03,
  vt04,
  vt05L2a,
  vt05L2b,
  vt08,
  type Scales,
} from '../tol/tolerances';
import { DEGENERATE, GRID, type GridCase } from './cases';
import { rkPlan } from './plan';

/**
 * Constants as dataset inputs, exactly as written in docs/architecture/proposed-architecture.md
 * §3: μ = 3.986004418 × 10¹⁴ m³/s², reference radius 6 378 137 m (WGS 84 values as proposed
 * there; primary-source check VT-19: docs/verification/l2-references-report.md §6).
 */
export const CONSTANTS: PhysicalConstants = {
  mu_m3ps2: 3.986004418e14,
  referenceRadius_m: 6378137,
  source:
    'WGS 84 values as written in docs/architecture/proposed-architecture.md §3 (ML-TASK-011 dataset input; VT-19 primary-source status in docs/verification/l2-references-report.md)',
};

const MU = CONSTANTS.mu_m3ps2;
const EPOCH = { scale: 'UTC', iso: '2026-01-01T00:00:00.000Z' } as const;
const RECORD = 'docs/verification/tolerances.md revision 3 (approved by the owner 2026-11-13)';
const STATUS =
  'Committed before any engine run on it (tolerances.md §4.1 item 1). Not yet reviewed or approved; immutable once approved, corrections create a new version (plan §6).';

export interface Provenance {
  /** Commit of the reference code that produced the dataset. */
  readonly codeRevision: string;
  readonly date: string;
  readonly runtime: string;
}

export interface DatasetFile {
  /** Path relative to the repository root. */
  readonly path: string;
  readonly data: Record<string, unknown>;
}

export type RequestIdFn = (request: Omit<SimulationRequest, 'requestId'>) => string;

/** −0 → +0: JSON cannot carry the sign of zero; zero signs are not significant here. */
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

function elementsJson(el: KeplerianElements): KeplerianElements {
  return {
    semiMajorAxis_m: z(el.semiMajorAxis_m),
    eccentricity: z(el.eccentricity),
    inclination_rad: z(el.inclination_rad),
    raan_rad: z(el.raan_rad),
    argPeriapsis_rad: z(el.argPeriapsis_rad),
    trueAnomaly_rad: z(el.trueAnomaly_rad),
  };
}

function model(): Record<string, unknown> {
  return {
    dynamics: 'TWO_BODY: point-mass two-body, Earth-centred (ML-SYS-001 §5.1)',
    centralBody: 'EARTH',
    frame: 'GCRF (all vectors and angles)',
    mu_m3ps2: CONSTANTS.mu_m3ps2,
    referenceRadius_m: CONSTANTS.referenceRadius_m,
    constantsSource: CONSTANTS.source,
    units: 'SI: m, m/s, s, rad, m³/s²',
    time: 't_s / Δt: elapsed SI seconds from the epoch (contracts-v1.md §2)',
  };
}

function producedBy(prov: Provenance, references: string[]): Record<string, unknown> {
  return {
    tool: '@mission-lab/verification (ML-TASK-011), verification/src/datasets/build.ts',
    references,
    codeRevision: prov.codeRevision,
    date: prov.date,
    runtime: prov.runtime,
    independence:
      'Engine source (packages/astrodynamics) not read and engine not run (ADR-003); references import nothing from the engine.',
    numberFormat:
      'Every number is the shortest decimal that round-trips to the binary64 value (ECMA-262 Number::toString); JSON.parse restores the exact binary64. Signs of zero are not preserved (−0 written as 0).',
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

const L2C_METHOD = {
  reference: 'L2c (verification/src/ref/elements.ts)',
  elementToState:
    'Regular map, no special cases (contracts-v1.md §3): p = a(1 − e²), r = p/(1 + e cos ν), perifocal r = r(cos ν, sin ν, 0), v = √(μ/p)(−sin ν, e + cos ν, 0), rotated by Q = Rz(Ω)·Rx(i)·Rz(ω) formed as explicit products of the three active elementary rotation matrices.',
  stateToElements:
    'In-plane polar formulation: h = r × v; i = atan2(√(h_x² + h_y²), h_z); Ω = atan2(h_x, −h_y); u = atan2(r·m̂, r·n̂) with n̂ = ẑ × h/|ẑ × h|, m̂ = ĥ × n̂; e cos ν = h²/(μr) − 1, e sin ν = h(r·v)/(μr); e = √(…); ν = atan2(e sin ν, e cos ν); ω = u − ν; a = 1/(2/r − v²/μ). atan2 only, no acos.',
};

const CONVENTION = {
  rule: 'ADR-008 / architecture §3: circular (e < ε_e): ω := 0, ν := argument of latitude; equatorial (i < ε_i or π − i < ε_i): Ω := 0, ω := longitude of periapsis; both: Ω := 0, ω := 0, ν := true longitude. e and i are always the computed values.',
  thresholds: { epsilon_e: EPS_E, epsilon_i: EPS_I, source: `${RECORD} §15` },
  substituteAngles:
    'OPEN CONVENTION (not fixed by any approved document; chosen by this reference, flagged for the Coordinator): substitute angles are measured from +x positively in the sense of motion, i.e. right-handed about the angular momentum ĥ. Prograde: ϖ = Ω + ω, λ = Ω + u (counter-clockwise seen from +z). Retrograde (i near π): ϖ = ω − Ω, λ = u − Ω (clockwise seen from +z). With this choice the regular element→state map with Ω = 0 (and ω = 0) reproduces the state of an exactly equatorial orbit, including i = π. When h_x = h_y = 0 exactly the node axis is +x.',
};

// ---------------------------------------------------------------------------------------------
// VT-02

function vt02File(g: GridCase, prov: Provenance): DatasetFile {
  const el = g.elements;
  const s = elementsToState(el, MU);
  const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
  const tol = vt02(sc);
  const hp = hpElementsToState(el, MU);
  return {
    path: `test-data/reference-cases/vt-02/${g.id}.json`,
    data: {
      id: `vt-02/${g.id}`,
      version: 1,
      family: 'VT-02 Elements → Cartesian (ML-FR-003 AC1)',
      description: g.description,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: { constants: CONSTANTS, elements: elementsJson(el) },
      model: model(),
      producedBy: producedBy(prov, ['L2c']),
      method: { ...L2C_METHOD, used: 'elementToState' },
      outputs: stateOf(s),
      referenceAccuracy: {
        bound:
          'Same budget as the engine side (tolerances.md §7 VT-02): ‖δr‖ ≤ η_r(e)·u·r_a, ‖δv‖ ≤ η_v(e)·u·v_p',
        bound_position_m: etaR(sc.e) * U * sc.ra,
        bound_velocity_mps: etaV(sc.e) * U * sc.vp,
        measured_position_m: hpDist(s.position_m, hp.position_m),
        measured_velocity_mps: hpDist(s.velocity_mps, hp.velocity_mps),
        measuredAgainst:
          'The same map in 200-bit arithmetic with closed-form perifocal unit vectors (verification/src/hp/hp-kepler.ts hpElementsToState), from the same binary64 inputs.',
      },
      tolerance: {
        record: `${RECORD} §7 VT-02`,
        measure: 'Euclidean norm of the difference, position and velocity separately',
        formula:
          '‖Δr‖ ≤ M·2η_r(e)·u·r_a, ‖Δv‖ ≤ M·2η_v(e)·u·v_p; η_r(e) = 31 + 2/(1 − e²) + (1 + 3e)/(1 − e), η_v(e) = 25 + 1/(1 − e²) + 7/(1 + e)',
        evaluatedAt: { ...scaleInputs(sc), eta_r: etaR(sc.e), eta_v: etaV(sc.e) },
        position_m: tol.position_m,
        velocity_mps: tol.velocity_mps,
        layers: 'L2c (algorithmic independence partial, open item O-7; L3 Orekit in ML-TASK-012)',
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// VT-03

function rawJson(s: CartesianState): Record<string, unknown> {
  const raw = stateToElementsRaw(s, MU);
  const view = stateToElementView(s, MU);
  return {
    elementsRegular: elementsJson(raw),
    argumentOfLatitude_rad: raw.argLatitude_rad,
    nodeUndefined: raw.nodeUndefined,
    elementView: elementsJson(view.elements),
    classification: {
      circular: view.circular,
      equatorial: view.equatorial,
      retrograde: view.retrograde,
    },
  };
}

function vt03File(g: GridCase, prov: Provenance): DatasetFile {
  const el = g.elements;
  const state = stateOf(elementsToState(el, MU));
  const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
  const tol = vt03(sc);
  const sinI = Math.sin(el.inclination_rad);
  const rows = elementRows(sc.kappaH, el.eccentricity, sinI);
  return {
    path: `test-data/reference-cases/vt-03/${g.id}.json`,
    data: {
      id: `vt-03/${g.id}`,
      version: 1,
      family: 'VT-03 Round trip state → elements → state (ML-FR-003 AC2)',
      description: `${g.description}. Input state produced by L2c from the grid elements.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: { constants: CONSTANTS, state, gridElements: elementsJson(el) },
      model: model(),
      producedBy: producedBy(prov, ['L1 (original state)', 'L2c']),
      method: {
        roundTrip: 'L1: the expected round-trip state is the input state itself (exact).',
        referenceElements: L2C_METHOD.stateToElements,
        convention: CONVENTION,
      },
      outputs: {
        roundTripExpected: state,
        referenceElements: rawJson(state),
      },
      referenceAccuracy: {
        roundTrip: 'Exact (the input state; tolerances.md §7 VT-03 "Reference accuracy: L1").',
        referenceElements:
          'L2c extraction, validated by its own round trip within this tolerance (verification/src/ref/elements.test.ts). Informative for VI-03-type element comparisons.',
      },
      tolerance: {
        record: `${RECORD} §7 VT-03`,
        measure:
          'Euclidean norm of the difference between the round-trip state and the input state',
        formula:
          '‖Δr‖ ≤ M·B_rt(e)·u·r_a, ‖Δv‖ ≤ M·B_vt(e)·u·v_p; B_rt = 5κ_E + 90/(1 − e) + (6κ_h + 55) + 31 + 2/(1 − e²) + (1 + 3e)/(1 − e); B_vt = 2.5κ_E + 90/(1 − e) + (6κ_h + 55) + 25 + 1/(1 − e²) + 7/(1 + e)',
        evaluatedAt: { ...scaleInputs(sc), B_rt: bRt(sc), B_vt: bVt(sc) },
        position_m: tol.position_m,
        velocity_mps: tol.velocity_mps,
        elementRows: {
          source: `${RECORD} §8 VI-03(b) rows (two-sided, M = 4), at κ_h, e, sin i of the grid elements; null where the element is undefined or the row does not apply`,
          eccentricity: rows.e,
          inclination_rad: rows.i,
          raan_rad: rows.raan,
          argPeriapsis_rad: rows.argp,
          trueAnomaly_rad: rows.nu,
        },
        layers: 'L1 (round trip); L2c for the element values',
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// VT-04

function vt04File(c: (typeof DEGENERATE)[number], prov: Provenance): DatasetFile {
  const el = c.elements;
  const state = stateOf(elementsToState(el, MU));
  const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
  const view = stateToElementView(state, MU);
  const iPrime = Math.min(el.inclination_rad, Math.PI - el.inclination_rad);
  let eConv = 0;
  let eConvWhy = 'not circular: no e convention term';
  if (view.circular) {
    if (el.eccentricity === 0) {
      eConv = E_HAT_EXACT_CIRCULAR;
      eConvWhy = 'exactly circular input: ê ≤ 30u (§7 VT-04(a))';
    } else {
      eConv = el.eccentricity;
      eConvWhy = 'near-circular input below ε_e: e of the input elements (§7 VT-04(b))';
    }
  }
  let iConv = 0;
  let iConvWhy = 'not equatorial: no i convention term';
  if (view.equatorial) {
    if (el.inclination_rad === 0) {
      iConvWhy = 'i = 0 exactly: computed i′ = 0 exactly (h_x = h_y = 0), term 0 (§7 VT-04(a))';
    } else if (el.inclination_rad === Math.PI) {
      iConv = iHatExactRetrograde(sc);
      iConvWhy = 'i = Math.PI: î′ ≤ (6κ_h + 2)u (§7 VT-04(a))';
    } else {
      iConv = iPrime;
      iConvWhy = 'near-equatorial input below ε_i: i′ = min(i, π − i) of the input (§7 VT-04(b))';
    }
  }
  const tol = vt04(sc, eConv, iConv);
  const rows = elementRows(sc.kappaH, el.eccentricity, Math.sin(el.inclination_rad));
  return {
    path: `test-data/reference-cases/vt-04/${c.id}.json`,
    data: {
      id: `vt-04/${c.id}`,
      version: 1,
      family: 'VT-04 Degenerate elements (ML-FR-002 AC3, ML-FR-003 AC2; ADR-008)',
      description: c.description,
      gridCase: c.recordCase,
      kind: c.kind,
      status: STATUS,
      inputs: { constants: CONSTANTS, elements: elementsJson(el), state },
      model: model(),
      producedBy: producedBy(prov, ['L1 (original state)', 'L2c (element view with convention)']),
      method: {
        stateFromElements: L2C_METHOD.elementToState,
        elementView: L2C_METHOD.stateToElements,
        convention: CONVENTION,
      },
      outputs: {
        classification: {
          circular: view.circular,
          equatorial: view.equatorial,
          retrograde: view.retrograde,
        },
        elementView: elementsJson(view.elements),
        roundTripExpected: state,
      },
      referenceAccuracy: {
        classification:
          'Discrete; cases are outside the factor-2 band around each threshold (§7 VT-04).',
        roundTrip: 'Exact (the input state).',
        elementView:
          'L2c; validated by its own VT-04 round trip (verification/src/ref/elements.test.ts).',
      },
      tolerance: {
        record: `${RECORD} §7 VT-04`,
        classification: 'exact (discrete)',
        measure:
          'Euclidean norm of the difference between the round-trip state (elements view → regular map) and the input state',
        formula:
          '‖Δr‖ ≤ M·B_rt·u·r_a + r_a(2e_c/(1 − e_c) + 4 sin(i_c/2)), ‖Δv‖ ≤ M·B_vt·u·v_p + v_p(2√2 e_c/(1 + e_c) + 4 sin(i_c/2)); convention term without margin',
        evaluatedAt: {
          ...scaleInputs(sc),
          B_rt: bRt(sc),
          B_vt: bVt(sc),
          e_c: eConv,
          e_c_reason: eConvWhy,
          i_c_rad: iConv,
          i_c_reason: iConvWhy,
        },
        position_m: tol.position_m,
        velocity_mps: tol.velocity_mps,
        eccentricity_abs: rows.e,
        inclination_abs_rad: rows.i,
        elementRowsSource: `${RECORD} §8 VI-03(b) rows for e and i (computed values, never zeroed)`,
        substituteAngles:
          'No approved tolerance for Ω, ω, ν under the convention (ϖ, λ, u). Not derived by the record; listed as a needed addition in docs/verification/l2-references-report.md.',
        layers: 'L1 (round trip); L2c (convention, element view)',
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sampling grid (contracts-v1.md §5.2, no maneuvers)

export function samplingGrid(duration_s: number, step_s: number): number[] {
  const times: number[] = [];
  for (let j = 0; ; j++) {
    const t = j * step_s;
    if (!(t < duration_s)) break;
    times.push(t);
  }
  times.push(duration_s);
  return times;
}

function request(
  state: CartesianState,
  duration_s: number,
  outputStep_s: number,
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
    maneuvers: [],
    duration_s,
    outputStep_s,
  };
  return { requestId: requestIdOf(body), ...body };
}

const REQUEST_ID_NOTE =
  'requestId = "sha256:" + hex(SHA-256(UTF-8(canonicalRequestPayload(request)))) per contracts-v1.md §7.1, computed with @mission-lab/contracts canonicalRequestPayload and Node crypto SHA-256 (test code only). The engine-side hash (ML-TASK-017) is not implemented yet; these values can serve its differential test.';

const L2A_METHOD = {
  reference: 'L2a (verification/src/ref/kepler.ts)',
  algorithm:
    'Classical elements from the initial state (L2c raw extraction), E₀ = atan2(√(1 − e²) sin ν₀, e + cos ν₀), M₀ = E₀ − e sin E₀ ∈ [0, 2π), n = √(μ/a³), M = M₀ + nΔt, Kepler equation E − e sin E = M by bracketed Newton, perifocal state from E, rotated by Rz(Ω)Rx(i)Rz(ω). Not universal variables.',
  stoppingCriterion:
    'Newton correction |ΔE| ≤ 4u·max(1, |M|), or f(E) = 0, or no binary64 point left inside the bracket [M − e, M + e] (shrunk with the sign of f; steps leaving it replaced by bisection); at most 100 iterations; the iterate with the smallest computed |f| is returned.',
};

const L2B_METHOD = {
  reference: 'L2b (verification/src/ref/rk.ts)',
  algorithm: `Classical fourth-order Runge–Kutta (order p = ${String(RK_ORDER)}), fixed step, Kahan-compensated state update, on ṙ = v, v̇ = −μr/‖r‖³ in GCRF Cartesian coordinates.`,
  stepHalving:
    'Runs with h, h/2, h/4; d₁ = ‖y_h − y_{h/2}‖, d₂ = ‖y_{h/2} − y_{h/4}‖ per output time; asymptotic if 2^(p−1) ≤ d₁/d₂ ≤ 2^(p+1), then E_RK = d₂, else E_RK = max(d₁, d₂) (tolerances.md §9.2). Reference value: the h/4 run.',
};

// ---------------------------------------------------------------------------------------------
// VT-05

function vt05File(g: GridCase, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const el = g.elements;
  const state = stateOf(elementsToState(el, MU));
  const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
  const plan = rkPlan(g.id, sc.T);
  const req = request(state, plan.duration_s, plan.outputStep_s, requestIdOf);
  const times = samplingGrid(plan.duration_s, plan.outputStep_s);
  times.forEach((t, k) => {
    if (t !== k * plan.outputStep_s) throw new Error('sampling grid is not exact');
  });
  const l2a = prepareL2a(state, MU);
  const rk = rk4WithHalving(state, MU, plan.rkStep_s, plan.stepsPerOutput, plan.nOut);
  const hp = hpPrepare(state.position_m, state.velocity_mps, MU);
  const a = { position_m: [] as V3[], velocity_mps: [] as V3[], keplerIterations: [] as number[] };
  const b = {
    position_m: [] as V3[],
    velocity_mps: [] as V3[],
    d1_r_m: [] as number[],
    d2_r_m: [] as number[],
    d1_v_mps: [] as number[],
    d2_v_mps: [] as number[],
    eRk_r_m: [] as number[],
    eRk_v_mps: [] as number[],
    asymptotic: [] as boolean[],
  };
  const acc = {
    l2a_bound_r_m: [] as number[],
    l2a_bound_v_mps: [] as number[],
    l2a_measured_r_m: [] as number[],
    l2a_measured_v_mps: [] as number[],
    l2b_measured_r_m: [] as number[],
    l2b_measured_v_mps: [] as number[],
  };
  const tolA = { position_m: [] as number[], velocity_mps: [] as number[] };
  const tolB = { position_m: [] as number[], velocity_mps: [] as number[] };
  times.forEach((t, k) => {
    const smp = rk[k];
    if (smp === undefined) throw new Error('rk index');
    const exactStart = k === 0;
    const sa = exactStart ? state : propagateL2a(l2a, t).state;
    const iters = exactStart ? 0 : propagateL2a(l2a, t).trace.iterations;
    a.position_m.push(v3(sa.position_m));
    a.velocity_mps.push(v3(sa.velocity_mps));
    a.keplerIterations.push(iters);
    b.position_m.push(v3(smp.state.position_m));
    b.velocity_mps.push(v3(smp.state.velocity_mps));
    b.d1_r_m.push(smp.d1_r);
    b.d2_r_m.push(smp.d2_r);
    b.d1_v_mps.push(smp.d1_v);
    b.d2_v_mps.push(smp.d2_v);
    b.eRk_r_m.push(exactStart ? 0 : smp.eRk_r);
    b.eRk_v_mps.push(exactStart ? 0 : smp.eRk_v);
    b.asymptotic.push(exactStart ? true : smp.asymptotic_r && smp.asymptotic_v);
    const x = hpPropagate(hp, t);
    acc.l2a_bound_r_m.push(exactStart ? 0 : pA(sc, t));
    acc.l2a_bound_v_mps.push(exactStart ? 0 : vA(sc, t));
    acc.l2a_measured_r_m.push(exactStart ? 0 : hpDist(sa.position_m, x.position_m));
    acc.l2a_measured_v_mps.push(exactStart ? 0 : hpDist(sa.velocity_mps, x.velocity_mps));
    acc.l2b_measured_r_m.push(exactStart ? 0 : hpDist(smp.state.position_m, x.position_m));
    acc.l2b_measured_v_mps.push(exactStart ? 0 : hpDist(smp.state.velocity_mps, x.velocity_mps));
    if (exactStart) {
      tolA.position_m.push(0);
      tolA.velocity_mps.push(0);
      tolB.position_m.push(0);
      tolB.velocity_mps.push(0);
    } else {
      const ta = vt05L2a(sc, t);
      const tb = vt05L2b(sc, t, smp.eRk_r, smp.eRk_v);
      tolA.position_m.push(ta.position_m);
      tolA.velocity_mps.push(ta.velocity_mps);
      tolB.position_m.push(tb.position_m);
      tolB.velocity_mps.push(tb.velocity_mps);
    }
  });
  const maxERk = Math.max(...b.eRk_r_m);
  return {
    path: `test-data/reference-cases/vt-05/${g.id}.json`,
    data: {
      id: `vt-05/${g.id}`,
      version: 1,
      family: 'VT-05 Circular and elliptical propagation (ML-FR-004 AC1)',
      description: `${g.description}. Coast of ${String(plan.nOut)} output steps of ${String(plan.outputStep_s)} s (≈ ${(plan.duration_s / sc.T).toFixed(3)} periods), fractional and multi-period times.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: {
        request: req,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: elementsJson(el),
        initialStateFrom: 'L2c element → state of gridElements',
      },
      model: model(),
      producedBy: producedBy(prov, ['L2a', 'L2b', 'L2c (initial state)']),
      method: {
        l2a: L2A_METHOD,
        l2b: {
          ...L2B_METHOD,
          rkStep_s: plan.rkStep_s,
          referenceStep_s: plan.rkStep_s / 4,
          stepsPerOutputCoarsest: plan.stepsPerOutput,
        },
        firstSample:
          'Index 0 (t_s = 0) is the initial state itself: contracts-v1.md §5.2 revision 3 requires the first sample to be bit-identical to request.initialState (exact; tolerance 0, tolerances.md §1 O-10 adopted).',
      },
      outputs: {
        t_s: times,
        l2a: a,
        l2b: b,
      },
      referenceAccuracy: {
        l2a: {
          bound: `P_A(Δt), V_A(Δt) of ${RECORD} §6.4 (unmargined)`,
          bound_r_m: acc.l2a_bound_r_m,
          bound_v_mps: acc.l2a_bound_v_mps,
          measured_r_m: acc.l2a_measured_r_m,
          measured_v_mps: acc.l2a_measured_v_mps,
          measuredAgainst:
            'The L2a algorithm evaluated in 200-bit arithmetic from the same binary64 initial state (verification/src/hp/hp-kepler.ts). Measures rounding error only; algorithmic error is cross-checked by L2b.',
        },
        l2b: {
          estimate: 'E_RK per output time (outputs.l2b.eRk_*), §9.2',
          target: `E_RK ≤ ${String(E_RK_TARGET_REL)}·r_max (§9.2); max E_RK,r here ${maxERk.toExponential(3)} m = ${(maxERk / sc.ra).toExponential(3)}·r_a`,
          allAsymptotic: b.asymptotic.every(Boolean),
          measured_r_m: acc.l2b_measured_r_m,
          measured_v_mps: acc.l2b_measured_v_mps,
          measuredAgainst: 'Same 200-bit L2a evaluation as above.',
        },
      },
      tolerance: {
        record: `${RECORD} §7 VT-05, §6.3, §6.4`,
        measure:
          'Euclidean norm of the difference at each bit-identical t_s, position and velocity separately',
        vsL2a: {
          formula: '‖Δr‖ ≤ M[P_E(Δt) + P_A(Δt)], ‖Δv‖ ≤ M[V_E(Δt) + V_A(Δt)] (§6.3, §6.4)',
          position_m: tolA.position_m,
          velocity_mps: tolA.velocity_mps,
        },
        vsL2b: {
          formula:
            '‖Δr‖ ≤ M·P_E(Δt) + 2E_RK,r(Δt), ‖Δv‖ ≤ M·V_E(Δt) + 2E_RK,v(Δt) (§7 VT-05, E_RK of this dataset)',
          position_m: tolB.position_m,
          velocity_mps: tolB.velocity_mps,
        },
        evaluatedAt: { ...scaleInputs(sc), B_rt: bRt(sc), B_vt: bVt(sc), C_t: sc.Ct },
        sample0: 'exact (Object.is per component, contracts-v1.md §5.2 revision 3)',
        layers: 'L2a, L2b (L3 Orekit: ML-TASK-012)',
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// VT-08

function vt08File(g: GridCase, N: number, prov: Provenance, requestIdOf: RequestIdFn): DatasetFile {
  const el = g.elements;
  const state = stateOf(elementsToState(el, MU));
  const sc = scales(MU, el.semiMajorAxis_m, el.eccentricity);
  // Period computed "by the test" from the initial state (§7 VT-08): a from vis-viva.
  const r = Math.sqrt(
    state.position_m[0] * state.position_m[0] +
      state.position_m[1] * state.position_m[1] +
      state.position_m[2] * state.position_m[2],
  );
  const v2 =
    state.velocity_mps[0] * state.velocity_mps[0] +
    state.velocity_mps[1] * state.velocity_mps[1] +
    state.velocity_mps[2] * state.velocity_mps[2];
  const aVis = 1 / (2 / r - v2 / MU);
  const T = 2 * Math.PI * Math.sqrt((aVis * aVis * aVis) / MU);
  const D = N * T;
  const req = request(state, D, D, requestIdOf);
  const l2a = propagateL2a(prepareL2a(state, MU), D).state;
  const tol = vt08(sc, D);
  return {
    path: `test-data/reference-cases/vt-08/${g.id}-n${String(N)}.json`,
    data: {
      id: `vt-08/${g.id}-n${String(N)}`,
      version: 1,
      family: 'VT-08 Full-period closure (ML-FR-004 AC3)',
      description: `${g.description}. State after N = ${String(N)} period(s) vs the initial state.`,
      gridCase: g.recordCase,
      status: STATUS,
      inputs: {
        request: req,
        requestIdNote: REQUEST_ID_NOTE,
        gridElements: elementsJson(el),
        periods: N,
        period: {
          formula:
            'a = 1/(2/‖r₀‖ − ‖v₀‖²/μ); T = 2 * Math.PI * Math.sqrt((a * a * a) / μ); duration_s = N * T (binary64, in this order); outputStep_s = duration_s so the samples are [0, duration_s]',
          a_m: aVis,
          T_s: T,
        },
      },
      model: model(),
      producedBy: producedBy(prov, ['L1 (initial state)', 'L2a (informative)']),
      method: {
        closure: 'L1: the expected state at t_s = duration_s is the initial state.',
        l2aInformative: L2A_METHOD,
      },
      outputs: {
        finalExpected: state,
        l2aAtDuration: stateOf(l2a),
      },
      referenceAccuracy: {
        closure: 'Exact (initial state); the period-computation error is in the tolerance formula.',
        l2aAtDuration: { bound_r_m: pA(sc, D), bound_v_mps: vA(sc, D) },
      },
      tolerance: {
        record: `${RECORD} §7 VT-08`,
        measure: 'Euclidean norm of (state at t_s = duration_s) − initialState',
        formula:
          '‖Δr‖ ≤ M[P_E(NT) + u(7.5κ_E + 6)·v_p·NT], ‖Δv‖ ≤ M[V_E(NT) + u(7.5κ_E + 6)·g_p·NT]',
        evaluatedAt: { ...scaleInputs(sc), C_t: sc.Ct, NT_s: D },
        position_m: tol.position_m,
        velocity_mps: tol.velocity_mps,
        layers: 'L1',
      },
    },
  };
}

export function buildAllDatasets(prov: Provenance, requestIdOf: RequestIdFn): DatasetFile[] {
  const files: DatasetFile[] = [];
  for (const g of GRID) files.push(vt02File(g, prov));
  for (const g of GRID) files.push(vt03File(g, prov));
  for (const c of DEGENERATE) files.push(vt04File(c, prov));
  for (const g of GRID) files.push(vt05File(g, prov, requestIdOf));
  for (const g of GRID) {
    files.push(vt08File(g, 1, prov, requestIdOf));
    files.push(vt08File(g, 10, prov, requestIdOf));
  }
  return files;
}
