# ADR-008 — Degenerate classical elements and the angular accuracy target

**Status:** Accepted — owner decisions, 2026-11-12 and 2026-11-13 (values and retrograde convention added) (decisions 1 and 2 of that date, taken after the
review of the tolerance record, PR #12) · **Refines:** architecture §3 "Classical elements" row,
contracts-v1.md §3 (owner decision 4 of 2026-11-11) · **Affects:** ML-FR-002 AC3, ML-FR-003 AC2,
ML-FR-009, VT-03, VT-04

## Context

The Cartesian state is the authoritative representation; classical elements are a derived view
(architecture §3). For circular orbits the argument of periapsis is undefined, for equatorial
orbits the node is undefined, and for both the true anomaly loses its reference (ML-SYS-001 §5.3
requires a documented convention). Architecture §3 fixes which angles are assigned (circular:
ω := 0, ν := argument of latitude; equatorial: Ω := 0, ω := longitude of periapsis; both:
ν := true longitude), and owner decision 4 of 2026-11-11 restricts the convention to
state→elements, with the circular/equatorial thresholds taken from the tolerance record.

Two points were left open and were raised by the review of the tolerance record (PR #12, items
O-3 and O-6):

1. Whether e and i themselves are set to zero below the thresholds ("snapping"), or reported as
   computed.
2. What fixes the accuracy required of derived angles. Without a stated target, the de facto
   target would be whatever precision the UI displays, which couples a numerical requirement to a
   formatting choice that has not been made.

## Options

For point 1:

- **A. Report e and i as computed; the convention assigns only the undefined angles.**
- **B. Below the thresholds, set e := 0 and/or i := 0 and then apply the convention.** Rejected:
  the reported elements then no longer describe the state; e(t) and i(t) histories show steps
  where a value crosses a threshold; a state → elements → state round trip introduces an error of
  the order of the threshold in e or i that is an artefact of the view, not of the physics; and a
  threshold value would change reported data, not only labelling.
- **C. Report an alternative (non-singular, e.g. equinoctial) element set instead of the
  classical one near degeneracy.** Not chosen for M1: ML-SYS-001 §5.3 allows it, but ML-FR-002
  and ML-FR-009 are written for the classical set, and an alternative set is a capability beyond
  the approved M1 scope. The door stays open: the Cartesian state remains authoritative, so a
  later element view can be added without changing the contract.

For point 2:

- **A. An owner-approved angular accuracy target, independent of display formatting.**
- **B. Derive the accuracy from the displayed precision.** Rejected: display precision is a UI
  choice that may change without any change to the physics, and it is not defined yet.

## Decision

**1. Degenerate-element convention (owner decision, 2026-11-12).**

- Eccentricity and inclination are always reported as computed from the state. They are never set
  to zero, at any threshold.
- Near-circular and/or near-equatorial is detected with the thresholds of the tolerance record
  (§Thresholds below). When detected, the convention assigns only the angles that are undefined,
  exactly as in architecture §3; every other element is the computed value.
- The convention applies only to state→elements. Element→Cartesian uses the given elements with
  the regular map, with no special-casing (owner decision 4 of 2026-11-11, contracts-v1.md §3).
- The Cartesian state remains authoritative; elements are a derived view and are never fed back
  into the engine as a substitute for the state.
- The rotation formulas and the angle extraction are physics, specified with a cited source by
  ML-TASK-014 in `packages/astrodynamics`. This ADR gives no formula.

**2. Angular accuracy target (owner decision, 2026-11-12).** The accuracy required of derived
angles (i, Ω, ω, ν and the substitute angles of the convention) is set by an owner-approved
angular accuracy target. The target is independent of how the UI formats or rounds angles for
display.

**Thresholds and target value (owner decision, 2026-11-13, approved with the tolerance record,
`docs/verification/tolerances.md` §15).** Angular accuracy target: 1e-5 rad. Circular and
equatorial thresholds: 1e-5 each (eccentricity; and the smaller of i and π − i, in rad). Detection
uses a strict comparison (value below the threshold), plus the exactly degenerate state. Changing
these values follows the tolerance record's change rule.

**3. Retrograde equatorial orbits (owner decision, 2026-11-13).** When the orbit is equatorial and
retrograde (inclination near π), the substitute angles (longitude of periapsis, true longitude)
are measured from the inertial +x axis in the sense of motion, that is, positive about the
angular-momentum direction. With this choice the reported elements, with the node angle set to
zero, reproduce the state through the regular element→Cartesian map without a reflection. The
engine (ML-TASK-014) and the independent reference (ML-TASK-011) each adopted this convention
separately before it was approved; this decision makes it normative. Prograde equatorial orbits
are unchanged (architecture §3).

## Rationale

- Option 1A keeps every reported number a function of the state alone: e and i are defined for
  every non-rectilinear state, including the degenerate ones, so only the angles are genuinely
  undefined and only they need a convention. (How accurately e and i are extracted near zero is
  an implementation and tolerance matter for ML-TASK-014 and the tolerance record, not a reason
  to replace them.)
- Thresholds then affect only which angles are relabelled, not the reported magnitudes, which
  limits the consequence of choosing a threshold value.
- A separate accuracy target lets the tolerance record derive angle tolerances from a float64
  error analysis (ADR-003, verification plan §4) without waiting for, or being changed by, UI
  formatting decisions.

## Consequences

- **VT-04 (degenerate elements).** Below a threshold, a state → elements → state round trip under
  the convention differs from the original state by a term that comes from the convention (the
  assigned angle replaces a computed one while e or i is small but non-zero), not from rounding
  alone. VT-04 near-degenerate checks are therefore bounded by that convention term, derived in the
  tolerance record, in addition to the rounding budget. Exactly circular or exactly equatorial
  states have no such term.
- **VT-03 and the angle rows of other families** use the approved angular accuracy target, not a
  display resolution.
- **ML-FR-009 (histories).** e(t) and i(t) histories have no steps caused by the convention,
  because those values are never replaced. Angle histories (Ω, ω, ν) can change definition where
  an orbit crosses a threshold; in M1 that can happen only at the maneuver, since e and i are
  constant on a two-body coast. ML-FR-002 AC3 already requires the UI to state which elements are
  undefined and which convention is applied.
- **ML-FR-003 AC2** is amended to say that the round trip holds under this convention and that
  e and i are never zeroed (m1-requirements.md, amendment of 2026-11-12).
- **ML-TASK-014** implements the detection with the approved thresholds and does not set e or i
  to zero; its task contract should cite this ADR.
- **Display precision** remains undefined and is an open item of the requirements, not of this ADR.
