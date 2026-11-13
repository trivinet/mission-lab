/**
 * Sampling and RK step plan of the VT-05 datasets (ML-TASK-011).
 *
 * Output step H = round(T/16) seconds (an integer, so every grid time j·H of contracts-v1.md
 * §5.2 is exact in binary64), 160 output intervals, duration D = 160·H ≈ 10 periods. The RK step
 * is H/2^k with k chosen per case (power of two, so RK step times are exact multiples): the
 * coarsest step for which the §9.2 ratio test holds at every output time with E_RK well below
 * the §9.2 target, found by a step-size survey before any dataset was written (report §4).
 */

export interface RkPlan {
  readonly outputStep_s: number;
  readonly nOut: number;
  readonly duration_s: number;
  /** RK steps of the coarsest run (step h) per output interval. */
  readonly stepsPerOutput: number;
  /** Coarsest RK step h; the runs use h, h/2, h/4 and the reference is the h/4 run. */
  readonly rkStep_s: number;
}

const STEPS_PER_OUTPUT: Readonly<Record<string, number>> = {
  'c3-elliptical-equatorial': 512,
  'c4-moderate-inclined': 512,
  'c5-molniya': 2048,
};

export const N_OUT = 160;

export function rkPlan(caseId: string, period_s: number): RkPlan {
  const H = Math.round(period_s / 16);
  const spo = STEPS_PER_OUTPUT[caseId] ?? 256;
  return {
    outputStep_s: H,
    nOut: N_OUT,
    duration_s: N_OUT * H,
    stepsPerOutput: spo,
    rkStep_s: H / spo,
  };
}
