# ADR-003 — Independent scientific verification

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-009 (method; numeric values fixed at G1)

## Context
A plausible-looking orbit is not evidence (R-003). The implementer must not also be the judge
(ML-SYS-001 §11.6, §8.4).

## Decision
Every scientific function is accepted only against evidence from three layers, detailed in the
[verification plan](../../verification/m1-verification-plan.md):

1. **Invariants and closed forms** — energy, angular momentum, period, vis-viva, round trips.
2. **Independent implementation** — written by the Verification Engineer in `verification/`
   using a *different algorithm* from the engine (classical-element Kepler equation, and a
   fixed-step high-order numerical integrator), without reading the engine's source.
3. **External references** — published worked examples with citation, and at least one dataset
   from an established external tool (Orekit or GMAT) with tool version and configuration
   recorded.

Tolerances are derived by the Verification Engineer from floating-point error analysis *before*
seeing the engine's results, and approved by the owner.

Process separation: reference-producing code in `verification/` may not import
`packages/astrodynamics`; the Astrodynamics Engineer may not edit `verification/` or
`test-data/reference-cases/`; neither may change an approved tolerance without owner approval.

## Rationale
Layer 1 catches gross errors cheaply. Layer 2 catches errors that conserve invariants (wrong
angle convention, wrong rotation order). Layer 3 guards against both agents sharing one
misconception, since both are language models.

## Consequences
- Layer 3 needs an external tool run at least once (Python + Orekit, or GMAT). This requires
  owner action to install or to accept an alternative. Until then layer 3 rests on cited textbook
  examples only, and that limitation is stated in the verification report.
- Verification costs roughly as much effort as implementation. This is accepted.
