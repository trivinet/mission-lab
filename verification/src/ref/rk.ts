/**
 * L2b reference: fixed-step Runge–Kutta integration of the two-body equations of motion
 * (verification plan §2, method (b); tolerance record §9.2).
 *
 *   ṙ = v,  v̇ = −μ r/‖r‖³
 *
 * Method: the classical fourth-order Runge–Kutta method (p = 4; stages at 0, h/2, h/2, h with
 * weights 1/6, 1/3, 1/3, 1/6). The state update is accumulated with compensated (Kahan)
 * summation, as §9.2 recommends, so round-off does not grow with the number of steps.
 * The step h is fixed for the whole run; output times are integer multiples of h, so no
 * interpolation is involved and every output time is exact.
 *
 * Its own error is estimated per output time by step halving (h, h/2, h/4; §9.2):
 * d₁ = ‖y_h − y_{h/2}‖, d₂ = ‖y_{h/2} − y_{h/4}‖; asymptotic regime when 2^(p−1) ≤ d₁/d₂ ≤
 * 2^(p+1); then E_RK := d₂, otherwise E_RK := max(d₁, d₂) and the sample is flagged.
 * The reference value is y_{h/4}.
 */
import type { State } from './elements';

export const RK_ORDER = 4;

type Y = Float64Array; // [x, y, z, vx, vy, vz]

function deriv(mu: number, y: Y, out: Y): void {
  const x = y[0] ?? 0;
  const yy = y[1] ?? 0;
  const z = y[2] ?? 0;
  const r2 = x * x + yy * yy + z * z;
  const r = Math.sqrt(r2);
  const k = -mu / (r2 * r);
  out[0] = y[3] ?? 0;
  out[1] = y[4] ?? 0;
  out[2] = y[5] ?? 0;
  out[3] = k * x;
  out[4] = k * yy;
  out[5] = k * z;
}

/**
 * Integrates with fixed step h for nSteps steps and returns the state after every `every`
 * steps, starting with the initial state (index 0). nSteps must be a multiple of `every`.
 */
export function integrateRK4(
  s0: State,
  mu_m3ps2: number,
  h: number,
  nSteps: number,
  every: number,
): State[] {
  if (nSteps % every !== 0) throw new RangeError('nSteps must be a multiple of every');
  const y = Float64Array.from([...s0.position_m, ...s0.velocity_mps]);
  const c = new Float64Array(6); // Kahan compensation
  const k1 = new Float64Array(6);
  const k2 = new Float64Array(6);
  const k3 = new Float64Array(6);
  const k4 = new Float64Array(6);
  const tmp = new Float64Array(6);
  const out: State[] = [snapshot(y)];
  const h2 = h / 2;
  const h6 = h / 6;
  for (let step = 1; step <= nSteps; step++) {
    deriv(mu_m3ps2, y, k1);
    for (let j = 0; j < 6; j++) tmp[j] = (y[j] ?? 0) + h2 * (k1[j] ?? 0);
    deriv(mu_m3ps2, tmp, k2);
    for (let j = 0; j < 6; j++) tmp[j] = (y[j] ?? 0) + h2 * (k2[j] ?? 0);
    deriv(mu_m3ps2, tmp, k3);
    for (let j = 0; j < 6; j++) tmp[j] = (y[j] ?? 0) + h * (k3[j] ?? 0);
    deriv(mu_m3ps2, tmp, k4);
    for (let j = 0; j < 6; j++) {
      const incr = h6 * ((k1[j] ?? 0) + 2 * (k2[j] ?? 0) + 2 * (k3[j] ?? 0) + (k4[j] ?? 0));
      const yj = y[j] ?? 0;
      const corrected = incr - (c[j] ?? 0);
      const t = yj + corrected;
      c[j] = t - yj - corrected;
      y[j] = t;
    }
    if (step % every === 0) out.push(snapshot(y));
  }
  return out;
}

function snapshot(y: Y): State {
  return {
    position_m: [y[0] ?? 0, y[1] ?? 0, y[2] ?? 0],
    velocity_mps: [y[3] ?? 0, y[4] ?? 0, y[5] ?? 0],
  };
}

function dist3(a: readonly number[], b: readonly number[]): number {
  const dx = (a[0] ?? 0) - (b[0] ?? 0);
  const dy = (a[1] ?? 0) - (b[1] ?? 0);
  const dz = (a[2] ?? 0) - (b[2] ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface HalvingSample {
  /** Reference state (step h/4). */
  readonly state: State;
  readonly d1_r: number;
  readonly d2_r: number;
  readonly d1_v: number;
  readonly d2_v: number;
  /** E_RK for position (m) and velocity (m/s), per §9.2. */
  readonly eRk_r: number;
  readonly eRk_v: number;
  /** True when both ratio tests 2^(p−1) ≤ d₁/d₂ ≤ 2^(p+1) passed (asymptotic regime). */
  readonly asymptotic_r: boolean;
  readonly asymptotic_v: boolean;
}

/**
 * Runs the integration with steps h, h/2 and h/4 over `nOut` output intervals of length
 * h·stepsPerOutput, and evaluates the §9.2 step-halving estimate at every output time
 * (the initial time is included as index 0 with zero error).
 */
export function rk4WithHalving(
  s0: State,
  mu_m3ps2: number,
  h: number,
  stepsPerOutput: number,
  nOut: number,
): HalvingSample[] {
  const a = integrateRK4(s0, mu_m3ps2, h, nOut * stepsPerOutput, stepsPerOutput);
  const b = integrateRK4(s0, mu_m3ps2, h / 2, nOut * stepsPerOutput * 2, stepsPerOutput * 2);
  const c = integrateRK4(s0, mu_m3ps2, h / 4, nOut * stepsPerOutput * 4, stepsPerOutput * 4);
  const lo = 2 ** (RK_ORDER - 1);
  const hi = 2 ** (RK_ORDER + 1);
  const result: HalvingSample[] = [];
  for (let k = 0; k <= nOut; k++) {
    const ya = a[k];
    const yb = b[k];
    const yc = c[k];
    if (ya === undefined || yb === undefined || yc === undefined) throw new Error('index');
    const d1r = dist3(ya.position_m, yb.position_m);
    const d2r = dist3(yb.position_m, yc.position_m);
    const d1v = dist3(ya.velocity_mps, yb.velocity_mps);
    const d2v = dist3(yb.velocity_mps, yc.velocity_mps);
    const okR = d2r > 0 && d1r / d2r >= lo && d1r / d2r <= hi;
    const okV = d2v > 0 && d1v / d2v >= lo && d1v / d2v <= hi;
    result.push({
      state: yc,
      d1_r: d1r,
      d2_r: d2r,
      d1_v: d1v,
      d2_v: d2v,
      eRk_r: okR ? d2r : Math.max(d1r, d2r),
      eRk_v: okV ? d2v : Math.max(d1v, d2v),
      asymptotic_r: okR,
      asymptotic_v: okV,
    });
  }
  return result;
}
