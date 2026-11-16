/**
 * Approved detection thresholds of the degenerate-element convention (ML-TASK-027;
 * ML-FR-002 AC3).
 *
 * Source of the values (read for this task, 2026-11-16):
 * - docs/architecture/adr/ADR-008, "Thresholds and target value (owner decision, 2026-11-13,
 *   approved with the tolerance record)": circular and equatorial thresholds 1e-5 each
 *   (eccentricity; and the smaller of i and π − i, in rad); detection uses a strict comparison
 *   (value below the threshold), plus the exactly degenerate state.
 * - docs/verification/tolerances.md §15 "Approval", row "Thresholds ε_e, ε_i (§10)": approved,
 *   ε_e = ε_i = 1e-5; e and i never set to zero. Derivation and span validity in §10 (the
 *   angular accuracy target δθ = 1e-5 rad is met up to about 105 periods in the worst case).
 *
 * Changing these values follows the tolerance record's change rule (ADR-008); this module only
 * carries them. The comparison itself is done by `stateToElements` (packages/astrodynamics).
 */
import type { DegeneracyThresholds } from '@mission-lab/astrodynamics';

/**
 * ε_e [-] and ε_i [rad] of ADR-008 / tolerances.md §10, §15 (see module header).
 *
 * - circularEccentricity = 1e-5: circular when e < 1e-5 (strict) or e is exactly 0.
 * - equatorialInclination_rad = 1e-5 rad: equatorial when min(i, π − i) < 1e-5 rad (strict) or
 *   the node vector is exactly zero. min(i, π − i) makes the retrograde equatorial case (i near π)
 *   equatorial as well (ADR-008 decision 3).
 *
 * Frame: i is measured from the +z axis of the inertial frame (GCRF in M1, ADR-004). Frozen.
 */
export const DEGENERACY_THRESHOLDS: DegeneracyThresholds = Object.freeze({
  circularEccentricity: 1e-5,
  equatorialInclination_rad: 1e-5,
});
