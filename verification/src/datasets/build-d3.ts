/**
 * Reference dataset of ML-TASK-018 part D3 phase 1 (tolerance record revision 5, Proposed): the
 * extended O-1 acceptance check on hyperbolic arcs (open item O-12; §6.8 and §12 of revision 5).
 * All files are NEW (`o1-hyp-r5/`); no existing dataset is touched. Committed before any engine run
 * on them (§4.1 item 1); the conformance test that uses them is gated until the owner signs
 * revision 5 (conformance/src/support/rev5-gate.ts).
 *
 * Content per case: the exact binary64 input state (reference side), the Δt > 0 of every compared
 * sample, and per sample x = F − F₀, ε_t,gen, δt_α,hyp and the threshold ε_t,gen + δt_α,hyp.
 *  - Six VT-16 hyperbolic arcs: the four L2 arcs of vt-16-r4 (reference post-maneuver state
 *    `outputs.startState`, Δt of segment 1) and the two L3 hyperbolic arcs (Orekit's own event state
 *    of test-data/l3-orekit/vt-16, Δt of Orekit's segment 1).
 *  - A deterministic grid (O1_HYP_GRID + O1_HYP_GRID_NEAR_GATE, tolerances-r5.ts): 144 states built in binary64 from
 *    hyperbolic elements; the binary64 state is the input, whatever rounding the construction did.
 *
 * Independence: written without reading packages/astrodynamics or packages/simulation (ADR-003).
 */
import { U } from '../tol/tolerances';
import { VT16_VALIDITY_GATE, prepareHyperbolicArc, type HyperbolicArc } from '../tol/tolerances-r4';
import {
  O1_HYP_GRID,
  O1_HYP_GRID_NEAR_GATE,
  anomalyForRadius,
  kappaE0,
  o1HypThreshold,
} from '../tol/tolerances-r5';
import type { V3 } from '../ref/vec';
import { CONSTANTS, type DatasetFile, type Provenance } from './build';
import { v3 } from './build-c';
import { VT16_R4_IDS, readL3, vt16R4Case } from './build-d2';

const MU = CONSTANTS.mu_m3ps2;
export const RECORD_R5 =
  'docs/verification/tolerances.md revision 5 (Proposed, awaiting owner approval; ML-TASK-018 part D3)';
const STATUS =
  'New dataset (tolerances.md §4.1 item 1), committed before any engine run on it (ML-TASK-018 part D3 phase 1). Gated: not compared with the engine before the owner signs revision 5. Not yet reviewed or approved; immutable once approved, corrections create a new version (plan §6).';

function producedBy(prov: Provenance): Record<string, unknown> {
  return {
    tool: '@mission-lab/verification (ML-TASK-018 part D3), verification/src/datasets/build-d3.ts',
    references: [
      'Thresholds: tolerances.md revision 5 §6.8 (ε_t,gen of revision 4, δt_α,hyp of revision 5) transcribed in verification/src/tol/tolerances-r4.ts and tolerances-r5.ts, evaluated in binary64 from the exact input state (§4.1 item 2)',
      'Residual (in the conformance test): verification/src/hp/o1-check-hyp.ts, the universal time equation in 320-bit at the engine χ̂',
    ],
    codeRevision: prov.codeRevision,
    date: prov.date,
    runtime: prov.runtime,
    independence:
      'packages/astrodynamics and packages/simulation not read and not run (ADR-003); references import nothing from the engine.',
    numberFormat:
      'Every number is the shortest decimal that round-trips to the binary64 value; JSON.parse restores the exact binary64. Signs of zero are not preserved (−0 written as 0).',
  };
}

export interface O1HypCase {
  readonly label: string;
  readonly source: string;
  readonly position_m: V3;
  readonly velocity_mps: V3;
  /** Δt > 0 of every compared sample (s). */
  readonly dt_s: readonly number[];
}

/** Per-sample threshold columns of one case. */
export function thresholdColumns(c: O1HypCase): {
  arc: HyperbolicArc;
  x: number[];
  epsTgen_s: number[];
  dtAlphaHyp_s: number[];
  threshold_s: number[];
} {
  const dtEnd = c.dt_s[c.dt_s.length - 1] ?? NaN;
  const arc = prepareHyperbolicArc(MU, c.position_m, c.velocity_mps, dtEnd);
  if (!(arc.energyRatio >= VT16_VALIDITY_GATE)) {
    throw new Error(`O-1 hyp ${c.label}: outside the §7 VT-16 validity gate`);
  }
  const t = c.dt_s.map((dt) => o1HypThreshold(arc, dt));
  return {
    arc,
    x: t.map((s) => s.x),
    epsTgen_s: t.map((s) => s.epsTgen_s),
    dtAlphaHyp_s: t.map((s) => s.dtAlphaHyp_s),
    threshold_s: t.map((s) => s.threshold_s),
  };
}

/** The six VT-16 hyperbolic arcs (reference-side start states). */
export function o1HypArcCases(): O1HypCase[] {
  const out: O1HypCase[] = [];
  for (const id of VT16_R4_IDS) {
    const c = vt16R4Case(id);
    out.push({
      label: `l2-${id}`,
      source: `test-data/reference-cases/vt-16-r4/${id}.json: reference post-maneuver state outputs.startState; Δt = t − m of segment 1 (k ≥ 1)`,
      position_m: v3(c.start.position_m),
      velocity_mps: v3(c.start.velocity_mps),
      dt_s: c.t.map((t) => t - c.m).filter((d) => d > 0),
    });
  }
  for (const id of ['c1-escape-prograde', 'c3-midrun-escape']) {
    const d = readL3('vt-16', `l3-orekit-${id}.json`);
    const out1 = d.outputs as {
      event: { position_m: V3; velocityAfter_mps: V3 };
      segments: { t_s: number[] }[];
    };
    const body = (d.inputs as { requestBody: { maneuvers: { t_s: number }[] } }).requestBody;
    const m = body.maneuvers[0]?.t_s ?? NaN;
    const seg1 = out1.segments[1];
    if (seg1 === undefined) throw new Error('segment 1');
    out.push({
      label: `l3-${id}`,
      source: `test-data/l3-orekit/vt-16/l3-orekit-${id}.json: Orekit's own event state (position_m, velocityAfter_mps); Δt = t − m of Orekit's segment 1 (k ≥ 1)`,
      position_m: v3(out1.event.position_m),
      velocity_mps: v3(out1.event.velocityAfter_mps),
      dt_s: seg1.t_s.map((t) => t - m).filter((x) => x > 0),
    });
  }
  return out;
}

/** Binary64 state from hyperbolic elements (|a|, e, i, Ω, ω, F) — perifocal form. */
export function hyperbolicElementsToState(
  aAbs: number,
  e: number,
  inc: number,
  raan: number,
  argp: number,
  F: number,
): { position_m: V3; velocity_mps: V3 } {
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cw = Math.cos(argp);
  const sw = Math.sin(argp);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const P: V3 = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q: V3 = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const ch = Math.cosh(F);
  const sh = Math.sinh(F);
  const b = Math.sqrt(e * e - 1);
  const xp = aAbs * (e - ch);
  const yp = aAbs * b * sh;
  const k = Math.sqrt(MU / aAbs) / (e * ch - 1);
  const vxp = -k * sh;
  const vyp = k * b * ch;
  return {
    position_m: [xp * P[0] + yp * Q[0], xp * P[1] + yp * Q[1], xp * P[2] + yp * Q[2]],
    velocity_mps: [vxp * P[0] + vyp * Q[0], vxp * P[1] + vyp * Q[1], vxp * P[2] + vyp * Q[2]],
  };
}

export interface O1HypGridCase extends O1HypCase {
  readonly elements: {
    readonly aAbs_m: number;
    readonly e: number;
    readonly inclination_rad: number;
    readonly raan_rad: number;
    readonly argPeriapsis_rad: number;
    readonly F0: number;
  };
}

/** The 144 grid cases of O1_HYP_GRID and O1_HYP_GRID_NEAR_GATE (one Δt per case). */
export function o1HypGridCases(): O1HypGridCase[] {
  const g = O1_HYP_GRID;
  const out: O1HypGridCase[] = [];
  for (const aAbs of g.aAbs_m) {
    g.e.forEach((e, ei) => {
      const inc = g.inclination_rad[ei] ?? NaN;
      const raan = g.raan_rad[ei] ?? NaN;
      const argp = g.argPeriapsis_rad[ei] ?? NaN;
      for (const F0 of g.F0) {
        const s = hyperbolicElementsToState(aAbs, e, inc, raan, argp, F0);
        const nH = Math.sqrt(MU / (aAbs * aAbs * aAbs));
        for (const span of g.meanMotionSpan) {
          out.push({
            label: `a=${aAbs.toExponential(1)} e=${String(e)} F0=${String(F0)} nΔt=${String(span)}`,
            source:
              'O1_HYP_GRID (tolerances-r5.ts); state from hyperbolicElementsToState in binary64',
            elements: {
              aAbs_m: aAbs,
              e,
              inclination_rad: inc,
              raan_rad: raan,
              argPeriapsis_rad: argp,
              F0,
            },
            position_m: v3(s.position_m),
            velocity_mps: v3(s.velocity_mps),
            dt_s: [span / nH],
          });
        }
      }
    });
  }
  // Near-gate supplement (review N1): e ∈ {1.1, 1.17} at r₀/|a| = 0.22 inbound and outbound, and
  // e = 1.1 at F₀ = ±1.
  const ng = O1_HYP_GRID_NEAR_GATE;
  for (const aAbs of ng.aAbs_m) {
    const nH = Math.sqrt(MU / (aAbs * aAbs * aAbs));
    for (const st of ng.starts) {
      const f = 'rOverA' in st ? anomalyForRadius(st.e, st.rOverA) : st.F0abs;
      for (const F0 of [-f, f]) {
        const s = hyperbolicElementsToState(
          aAbs,
          st.e,
          st.inclination_rad,
          st.raan_rad,
          st.argPeriapsis_rad,
          F0,
        );
        for (const span of ng.meanMotionSpan) {
          out.push({
            label: `near-gate a=${aAbs.toExponential(1)} e=${String(st.e)} F0=${F0.toPrecision(6)} nΔt=${String(span)}`,
            source:
              'O1_HYP_GRID_NEAR_GATE (tolerances-r5.ts; review N1); state from hyperbolicElementsToState in binary64',
            elements: {
              aAbs_m: aAbs,
              e: st.e,
              inclination_rad: st.inclination_rad,
              raan_rad: st.raan_rad,
              argPeriapsis_rad: st.argPeriapsis_rad,
              F0,
            },
            position_m: v3(s.position_m),
            velocity_mps: v3(s.velocity_mps),
            dt_s: [span / nH],
          });
        }
      }
    }
  }
  return out;
}

function arcSummary(arc: HyperbolicArc): Record<string, number | boolean> {
  return {
    energyOverScaleAtStart: arc.energyRatio,
    aAbs_m: arc.aAbs,
    e: arc.e,
    n_h_radps: arc.nH,
    sinhF0: arc.sinhF0,
    coshF0: arc.coshF0,
    kappa_E_r0: kappaE0(arc),
    kappa_E_arc: arc.kappaE,
    r_min_m: arc.rMin,
    r_max_m: arc.rMax,
    periapsisPassed: arc.periapsisPassed,
    u: U,
  };
}

const FORMULA =
  'Pass when |t(χ̂) − Δt| ≤ ε_t,gen(Δt) + δt_α,hyp(Δt), t(χ̂) the universal time equation evaluated in high precision at the engine χ̂ with α, σ₀, r₀ formed in high precision from the exact binary64 input (§6.1 O-1 route (1), extended to E > 0 by revision 5 §6.8). ε_t,gen of §6.8 (revision 4); δt_α,hyp = 5u κ_E(r₀) D(x)/n_h, κ_E(r₀) = 1 + 4|a|/r₀, D(X) = e|sinh F₀|[(cosh X − 1) + X sinh X/2] + (sinh X − X) + (e cosh F₀/2)[(sinh X − X) + X(cosh X − 1)] (revision 5). No margin factor (as the elliptic O-1 threshold).';

function caseRecord(c: O1HypCase): Record<string, unknown> {
  const t = thresholdColumns(c);
  return {
    label: c.label,
    source: c.source,
    startState: { position_m: c.position_m, velocity_mps: c.velocity_mps },
    arc: arcSummary(t.arc),
    dt_s: c.dt_s,
    x: t.x,
    epsTgen_s: t.epsTgen_s,
    dtAlphaHyp_s: t.dtAlphaHyp_s,
    threshold_s: t.threshold_s,
  };
}

export function buildPartD3Datasets(prov: Provenance): DatasetFile[] {
  const files: DatasetFile[] = [];
  for (const c of o1HypArcCases()) {
    files.push({
      path: `test-data/reference-cases/o1-hyp-r5/${c.label}.json`,
      data: {
        id: `o1-hyp-r5/${c.label}`,
        version: 1,
        family: 'O-1 solver acceptance check, extended to hyperbolic arcs (open item O-12)',
        description: `Universal-variable solver residual on the VT-16 hyperbolic arc ${c.label}: every compared sample with Δt > 0.`,
        status: STATUS,
        inputs: { constants: CONSTANTS, source: c.source },
        producedBy: producedBy(prov),
        cases: [caseRecord(c)],
        tolerance: {
          record: `${RECORD_R5} §6.8 "Extended O-1 check", §12 O-12`,
          formula: FORMULA,
          assertion: 'gated: asserted only after the owner signs revision 5 (§15)',
        },
      },
    });
  }
  const grid = o1HypGridCases();
  files.push({
    path: 'test-data/reference-cases/o1-hyp-r5/grid.json',
    data: {
      id: 'o1-hyp-r5/grid',
      version: 1,
      family: 'O-1 solver acceptance check, extended to hyperbolic arcs (open item O-12)',
      description: `Deterministic grid of ${String(grid.length)} hyperbolic start states and spans (revision 5 §6.8): |a| ∈ {7.0e6, 3.0e7} m, e ∈ {1.25, 1.5, 2.5, 5}, F₀ ∈ {−1, 0, 1}, n_h Δt ∈ {0.05, 0.5, 5, 20}; plus the near-gate supplement (review N1): e ∈ {1.1, 1.17} starting at r₀/|a| = 0.22 (gate ratio ≈ 0.052) inbound and outbound, and e = 1.1 at F₀ = ±1, same |a| and spans; all inside the §7 VT-16 validity gate; Δt > 0 only.`,
      status: STATUS,
      inputs: {
        constants: CONSTANTS,
        source: 'O1_HYP_GRID and O1_HYP_GRID_NEAR_GATE, verification/src/tol/tolerances-r5.ts',
      },
      producedBy: producedBy(prov),
      cases: grid.map((c) => ({ ...caseRecord(c), elements: c.elements })),
      tolerance: {
        record: `${RECORD_R5} §6.8 "Extended O-1 check", §12 O-12`,
        formula: FORMULA,
        assertion: 'gated: asserted only after the owner signs revision 5 (§15)',
      },
    },
  });
  return files;
}
