# ADR-005 — Universal-variable Kepler propagator

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-004

## Context
M1 needs an authoritative analytical two-body propagator (ML-SYS-001 §5.5) that behaves well for
circular and equatorial orbits (§5.3) and after an arbitrary impulsive maneuver.

## Options
A. Classical elements: convert to elements, advance mean anomaly, solve Kepler's equation,
   convert back.
B. Universal variables: solve the universal Kepler equation with Stumpff functions and advance
   the Cartesian state with Lagrange f and g coefficients (e.g. Vallado, *Fundamentals of
   Astrodynamics and Applications*, "KEPLER" algorithm; Bate, Mueller & White, ch. 4).
C. Numerical integration (RK family).

## Decision
Option B as the engine's propagator. Each output sample is computed directly from the segment's
initial state at Δt = t − t₀.

## Rationale
- B works on the Cartesian state, so it has no singularity at e = 0 or i = 0 and needs no special
  cases for degenerate elements.
- B covers elliptic, parabolic and hyperbolic motion with one formulation, so a maneuver that
  produces escape is still propagated correctly and can be flagged rather than failing.
- Propagating every sample from the segment start means error does not grow with the number of
  output samples, and the output step is purely a sampling choice (§5.5).
- A and C are kept as the **Verification Engineer's independent methods** (ADR-003), so the
  reference shares no algorithm with the engine.

## Consequences
- Requires a robust scalar root solve (Newton with a bracketing fallback) and series evaluation
  of the Stumpff functions near zero; iteration limits and convergence failure are reported as
  diagnostics, never as silent output.
- The algorithm is transcribed from the cited source by the implementer, with equation references
  in code comments; constants and formulas are not written from memory.
- Numerical propagation (ML-FR-015) will enter later behind the same propagator interface.
