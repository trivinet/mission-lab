/**
 * The test's own binary64 evaluations of post-maneuver quantities (tolerances.md §7 VT-15
 * revision 4: "evaluated by the test"; their rounding is counted in the record's budgets). Used by
 * the VT-15 conformance tests (L2 new versions and L3). No reference value is computed here.
 */
import type { V3 } from './datasets';
import { cross3, dot3, norm3 } from './run';

/** a = 1/(2/r − v²/μ) (vis-viva). */
export function semiMajorAxisOf(r: V3, v: V3, mu: number): number {
  return 1 / (2 / norm3(r) - dot3(v, v) / mu);
}

/** e = ‖[(v² − μ/r) r − (r·v) v]/μ‖. */
export function eccentricityOf(r: V3, v: V3, mu: number): number {
  const c1 = dot3(v, v) - mu / norm3(r);
  const rv = dot3(r, v);
  return norm3([
    (c1 * r[0] - rv * v[0]) / mu,
    (c1 * r[1] - rv * v[1]) / mu,
    (c1 * r[2] - rv * v[2]) / mu,
  ]);
}

/** ĥ = (r × v)/‖r × v‖. */
export function planeNormalOf(r: V3, v: V3): V3 {
  const h = cross3(r, v);
  const n = norm3(h);
  return [h[0] / n, h[1] / n, h[2] / n];
}

/** ψ = atan2(‖ĥ⁻ × ĥ⁺‖, ĥ⁻·ĥ⁺) (the atan2 form the record requires, §7 VT-15). */
export function planeRotationOf(hBefore: V3, hAfter: V3): number {
  return Math.atan2(norm3(cross3(hBefore, hAfter)), dot3(hBefore, hAfter));
}
