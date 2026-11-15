/**
 * Transcription of the revision-5 formulas of docs/verification/tolerances.md (ML-VER-002
 * revision 5, Proposed; ML-TASK-018 part D3, open item O-12). Nothing here is used against the
 * engine until the owner signs revision 5 (§15); the conformance tests that use it are gated
 * (conformance/src/support/rev5-gate.ts).
 *
 * - δt_α,hyp (§6.8, revision 5): the α data error of the universal time equation at fixed χ on a
 *   hyperbolic arc, from the §6.1 expression of ∂F/∂α with cosh/sinh magnitudes.
 * - The extended O-1 acceptance threshold on hyperbolic arcs: ε_t,gen(Δt) + δt_α,hyp(Δt), both
 *   evaluated with the reference-side arc of the exact binary64 input state (§4.1 item 2).
 *
 * Independence: written from the record only; packages/astrodynamics and packages/simulation were
 * not read (ADR-003).
 */
import { U } from './tolerances';
import { hyperbolicAt, hyperbolicBound, type HyperbolicArc } from './tolerances-r4';

/** κ_E(r₀) = 1 + 4|a|/r₀ = (2/r₀ + v₀²/μ)|a|: the α-cancellation factor of the input state. */
export function kappaE0(arc: HyperbolicArc): number {
  return 1 + (4 * arc.aAbs) / arc.r0;
}

/**
 * D(X), X = |x|: the magnitude bound of ∂F/∂α in units of |a|^(5/2) (§6.8 revision 5):
 *   e|sinh F₀|[(cosh X − 1) + X sinh X/2] + (sinh X − X) + (e cosh F₀/2)[(sinh X − X) + X(cosh X − 1)].
 */
export function dAlphaMagnitude(arc: HyperbolicArc, x: number): number {
  const X = Math.abs(x);
  const ch = Math.cosh(X);
  const sh = Math.sinh(X);
  const e = arc.e;
  return (
    e * Math.abs(arc.sinhF0) * (ch - 1 + (X * sh) / 2) +
    (sh - X) +
    ((e * arc.coshF0) / 2) * (sh - X + X * (ch - 1))
  );
}

/** δt_α,hyp(Δt) = 5u κ_E(r₀) D(x(Δt)) / n_h (seconds). */
export function dtAlphaHyp(arc: HyperbolicArc, dt: number): number {
  const { x } = hyperbolicAt(arc, dt);
  return (5 * U * kappaE0(arc) * dAlphaMagnitude(arc, x)) / arc.nH;
}

export interface O1HypThreshold {
  readonly x: number;
  readonly epsTgen_s: number;
  readonly dtAlphaHyp_s: number;
  /** ε_t,gen + δt_α,hyp (s). */
  readonly threshold_s: number;
}

/** Extended O-1 acceptance threshold on a hyperbolic arc at Δt > 0 (§6.8, §12 O-12, revision 5). */
export function o1HypThreshold(arc: HyperbolicArc, dt: number): O1HypThreshold {
  if (!(dt > 0)) throw new RangeError('o1HypThreshold: defined for Δt > 0 only (§6.8)');
  const b = hyperbolicBound(arc, dt);
  const da = (5 * U * kappaE0(arc) * dAlphaMagnitude(arc, b.x)) / arc.nH;
  return { x: b.x, epsTgen_s: b.epsTgen, dtAlphaHyp_s: da, threshold_s: b.epsTgen + da };
}

/**
 * Deterministic grid of the extended O-1 check (§6.8 revision 5): |a| ∈ {7.0e6, 3.0e7} m,
 * e ∈ {1.25, 1.5, 2.5, 5}, F₀ ∈ {−1, 0, 1}, n_h Δt ∈ {0.05, 0.5, 5, 20}; orientation fixed per e
 * index. Every start state satisfies the §7 VT-16 gate (E/(v²/2 + μ/r) ≥ 0.05).
 */
export const O1_HYP_GRID = {
  aAbs_m: [7.0e6, 3.0e7],
  e: [1.25, 1.5, 2.5, 5],
  F0: [-1, 0, 1],
  meanMotionSpan: [0.05, 0.5, 5, 20],
  inclination_rad: [0.4, 1.1, 2.0, 2.9],
  raan_rad: [0.7, 3.3, 5.1, 1.9],
  argPeriapsis_rad: [4.4, 0.2, 2.6, 5.8],
} as const;
