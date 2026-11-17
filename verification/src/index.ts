export const PACKAGE_NAME = '@mission-lab/verification';
export const PACKAGE_VERSION = '1.0.0';

// Public surface for the conformance workspace (ADR-009). Re-exports only; no behaviour change.
// The engine is never imported here (ADR-003).

/** O-1 solver acceptance check (tolerances.md §6.1, §12 O-1), 320-bit evaluation. */
export { o1Check, timeOfChi } from './hp/o1-check';
export type { O1Result, UvInputs } from './hp/o1-check';

/** Extended O-1 check on hyperbolic arcs (tolerances.md revision 5 §6.8, O-12): 320-bit residual. */
export { o1HypResidual } from './hp/o1-check-hyp';

/** L2c element → state map (reference, regular map), used to generate O-1 input states. */
export { elementsToState as referenceElementsToState } from './ref/elements';
export type { Elements as ReferenceElements, State as ReferenceState } from './ref/elements';

/** Angle reduction to (−π, π] used for angle comparisons (tolerances.md §8 VI-03(b)). */
export { wrapPi } from './ref/vec';

/** Scales of the tolerance record (§4), for reporting O-1 case parameters. */
export { scales } from './tol/tolerances';
export type { Scales } from './tol/tolerances';

// ML-TASK-018 part C (re-exports of committed references; no behaviour change).

/** L2c RSW reference: 320-bit projection-form basis and inertial Δv rounded once. */
export {
  rswBasisProjection,
  rswBasisHpRounded,
  rswToInertialHp,
  velocityAfterR12,
} from './ref/rsw';
export type { RswBasis } from './ref/rsw';

/** Post-maneuver closed forms and the VT-16 classification. */
export { classifyVt16, conicOfState, postManeuverClosedForm, timeToRadius } from './ref/maneuver';
export type { ConicSummary, PostManeuverClosedForm } from './ref/maneuver';

/** Independent §5.2 sampling grid. */
export { samplingGridWithManeuvers, sampleCountLarge } from './ref/grid';
export type { GridResult } from './ref/grid';

/** L2a (classical elements + Kepler) and L2b (RK4) references, for post-maneuver segments. */
export { prepareL2a, propagateL2a } from './ref/kepler';
export { integrateRK4 } from './ref/rk';
export { cross, dot, norm, dist } from './ref/vec';
export type { V3 } from './ref/vec';

/** Approved tolerance formulas used at test time with reference-side scales. */
export { MARGIN, U, pE, vE, vt05L2a } from './tol/tolerances';

/** Special-number encoding and mutation lists of the VT-18 / VI-01 datasets. */
export { applyMutations, decodeValue } from './datasets/encoding';
export type { Mutation } from './datasets/encoding';

// ML-TASK-036 (VI-03 (b), FR-010 AC3; re-exports of committed references; no behaviour change).

/** Independent analysis reference of one state (200-bit polar formulation, ADR-008 convention). */
export { analysisReferenceHp, normHp } from './ref/analysis';
export type { AnalysisReference, ReferenceConvention } from './ref/analysis';
