export const PACKAGE_NAME = '@mission-lab/verification';
export const PACKAGE_VERSION = '0.0.0';

// Public surface for the conformance workspace (ADR-009). Re-exports only; no behaviour change.
// The engine is never imported here (ADR-003).

/** O-1 solver acceptance check (tolerances.md §6.1, §12 O-1), 320-bit evaluation. */
export { o1Check, timeOfChi } from './hp/o1-check';
export type { O1Result, UvInputs } from './hp/o1-check';

/** L2c element → state map (reference, regular map), used to generate O-1 input states. */
export { elementsToState as referenceElementsToState } from './ref/elements';
export type { Elements as ReferenceElements, State as ReferenceState } from './ref/elements';

/** Angle reduction to (−π, π] used for angle comparisons (tolerances.md §8 VI-03(b)). */
export { wrapPi } from './ref/vec';

/** Scales of the tolerance record (§4), for reporting O-1 case parameters. */
export { scales } from './tol/tolerances';
export type { Scales } from './tol/tolerances';
