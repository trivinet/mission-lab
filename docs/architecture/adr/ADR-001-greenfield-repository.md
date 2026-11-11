# ADR-001 — Greenfield repository; Satellite Viewer is not reused

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-001 · **Closes risk:** R-001

## Context
ML-SYS-001 required assessing the owner's earlier Satellite Viewer before choosing between reuse,
refactor and reimplementation. The assessment is in
[legacy-assessment.md](../legacy-assessment.md).

## Options
A. Build Mission Lab inside Satellite Viewer.
B. Refactor Satellite Viewer incrementally into the target architecture.
C. New repository; Satellite Viewer left untouched as a separate project.

## Decision
Option C.

## Rationale
Satellite Viewer is a JavaScript Next.js site that tracks real satellites with SGP4 through
`tle.js`, renders with Google Maps and ArcGIS, and depends on a cron/blob backend. It contains no
element conversion, propagator, maneuver model, Three.js scene, TypeScript or tests. No module
satisfies ARCH-001/002/007, so options A and B cost a full rewrite plus the burden of the old
stack, data files and dependency advisories.

## Consequences
- Mission Lab starts with no inherited constraints and no inherited debt.
- Satellite Viewer remains deployed and is not modified by this project.
- Real-object (TLE) import, if ever wanted, is specified as a new capability, not ported.
- The M0 deliverable "baseline working application" becomes a new empty application shell.
