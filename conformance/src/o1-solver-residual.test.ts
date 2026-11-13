/**
 * O-1 solver acceptance check (tolerances.md §6.1, §12 O-1, evidence route (1) "black-box
 * residual check"): for each propagation, the χ̂ the engine reports in its diagnostics
 * (`diagnostics.universalAnomaly_sqrtm`) is put into the universal-variable time equation
 * evaluated in 320-bit arithmetic from the exact binary64 inputs (`o1Check`, verification
 * library); pass when |t(χ̂) − Δt| ≤ ε_t(Δt) + δt_α(Δt), the threshold being formed from the exact
 * input (reference side), never from engine output.
 *
 * Cases: (a) every sample k ≥ 1 of the nine VT-05 datasets; (b) a deterministic grid within the
 * range O-1 states (e up to 0.95, |Δt| up to 100 periods, negative Δt): a ∈ {7.0e6, 2.6e7,
 * 4.2e7} m, e ∈ {0, 0.01, 0.3, 0.6, 0.8, 0.95}, ν₀ ∈ {0.3, 3.0} rad, Δt/T ∈ {±0.37, ±3.3, ±41.7,
 * ±100}; i, Ω, ω fixed per e index (below). Initial states from the L2c element → state map
 * (verification library), μ = 3.986004418e14 m³/s² (the datasets' constant). Fixed before the
 * engine was first run against it (ML-TASK-018 part B).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { propagateKeplerUniversal } from '@mission-lab/astrodynamics';
import { o1Check, referenceElementsToState } from '@mission-lab/verification';
import { loadFamily, type V3, type Vt05Dataset } from './support/datasets';
import { fmt, fmtV, RatioRecorder } from './support/compare';

const ratios = new RatioRecorder('O-1');

afterAll(() => {
  console.log(ratios.summary());
});

interface Case {
  readonly label: string;
  readonly mu: number;
  readonly position_m: V3;
  readonly velocity_mps: V3;
  readonly dt_s: number;
}

/** Runs the engine and the O-1 check on each case; returns failure descriptions. */
function runCases(cases: readonly Case[], quantity: string): string[] {
  const failures: string[] = [];
  for (const c of cases) {
    const r = propagateKeplerUniversal(c.mu, c.position_m, c.velocity_mps, c.dt_s);
    if (!r.ok) {
      failures.push(`${c.label}: engine returned ${r.reason}`);
      continue;
    }
    const chi = r.diagnostics.universalAnomaly_sqrtm;
    if (chi === null) {
      failures.push(`${c.label}: engine reports no χ̂`);
      continue;
    }
    const check = o1Check(
      { mu_m3ps2: c.mu, position_m: c.position_m, velocity_mps: c.velocity_mps },
      c.dt_s,
      chi,
    );
    const ratio = ratios.record(quantity, check.residual_s, check.threshold_s, c.label);
    if (!check.pass) {
      failures.push(
        `${c.label}: r0 ${fmtV(c.position_m)} v0 ${fmtV(c.velocity_mps)} Δt ${String(c.dt_s)} ` +
          `χ̂ ${String(chi)}: |t(χ̂) − Δt| ${fmt(check.residual_s)} s > ε_t + δt_α ` +
          `${fmt(check.threshold_s)} s (×${ratio.toPrecision(3)}; a ${fmt(check.a_m)}, e ${check.e.toFixed(4)})`,
      );
    }
  }
  return failures;
}

const vt05 = loadFamily('vt-05').map((d) => ({ file: d.file, data: d.data as Vt05Dataset }));

describe('O-1 on the VT-05 grid (every sample k ≥ 1)', () => {
  it.each(vt05)(
    '$file',
    ({ file, data }) => {
      const { constants, initialState } = data.inputs.request;
      const cases: Case[] = data.outputs.t_s.slice(1).map((t, j) => ({
        label: `${file} k=${String(j + 1)} t=${String(t)}`,
        mu: constants.mu_m3ps2,
        position_m: initialState.position_m,
        velocity_mps: initialState.velocity_mps,
        dt_s: t,
      }));
      const failures = runCases(cases, `VT-05 grid ${data.gridCase}`);
      expect(failures, `${file}: ${String(failures.length)} O-1 failures`).toEqual([]);
    },
    300_000,
  );
});

const MU = 398600441800000;
const SEMI_MAJOR_AXES = [7.0e6, 2.6e7, 4.2e7] as const;
const ECCENTRICITIES = [0, 0.01, 0.3, 0.6, 0.8, 0.95] as const;
const INCLINATIONS = [0.1, 0.7, 1.3, 1.9, 2.5, 3.0] as const;
const RAANS = [1.2, 4.0, 0.5, 2.9, 5.5, 3.6] as const;
const ARGPS = [2.1, 0.4, 5.0, 3.3, 1.7, 6.0] as const;
const TRUE_ANOMALIES = [0.3, 3.0] as const;
const SPANS_IN_PERIODS = [0.37, -0.37, 3.3, -3.3, 41.7, -41.7, 100, -100] as const;

const extraGroups = SEMI_MAJOR_AXES.flatMap((a) =>
  ECCENTRICITIES.map((e, ei) => ({ a, e, ei, label: `a=${a.toExponential(1)} e=${String(e)}` })),
);

describe('O-1 on additional orbits (deterministic grid, e ≤ 0.95, |Δt| ≤ 100T)', () => {
  it.each(extraGroups)(
    '$label',
    ({ a, e, ei, label }) => {
      const T = 2 * Math.PI * Math.sqrt((a * a * a) / MU);
      const cases: Case[] = [];
      for (const nu of TRUE_ANOMALIES) {
        const state = referenceElementsToState(
          {
            semiMajorAxis_m: a,
            eccentricity: e,
            inclination_rad: INCLINATIONS[ei] ?? NaN,
            raan_rad: RAANS[ei] ?? NaN,
            argPeriapsis_rad: ARGPS[ei] ?? NaN,
            trueAnomaly_rad: nu,
          },
          MU,
        );
        for (const k of SPANS_IN_PERIODS) {
          cases.push({
            label: `${label} ν0=${String(nu)} Δt=${String(k)}T`,
            mu: MU,
            position_m: state.position_m,
            velocity_mps: state.velocity_mps,
            dt_s: k * T,
          });
        }
      }
      const failures = runCases(cases, `additional e=${String(e)}`);
      expect(failures, `${label}: ${String(failures.length)} O-1 failures`).toEqual([]);
    },
    300_000,
  );
});
