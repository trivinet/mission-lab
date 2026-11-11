# ADR-002 — Decoupled TypeScript engine and package boundaries

**Status:** Accepted — owner approval at gate G0, 2026-11-11

## Context
The physics must be verifiable without a browser (ARCH-007) and be the only source of physical
states (ARCH-002). Agents need ownership boundaries that prevent conflicting edits (R-005).

## Options
A. Single application with a `src/physics` folder.
B. pnpm monorepo with separate packages and enforced one-way dependencies.
C. Python scientific backend.

## Decision
Option B, with this layout:

- `packages/astrodynamics` — pure physics, zero runtime dependencies.
- `packages/contracts` — shared types and runtime schemas.
- `packages/simulation` — run orchestration, analysis, persistence format.
- `apps/web` — UI, 3D scene, worker host.
- `verification/` — independent reference code and datasets.

`packages/visualization` from the original proposal is deferred until a second consumer exists.

## Rationale
Package manifests and lint rules make an illegal import a build failure rather than a review
comment. M1 dynamics are analytical and cheap, so a backend (C) would add latency and
infrastructure for no capability. The engine sits behind `SimulationRequest → SimulationResult`,
so a WebAssembly or remote engine can replace it later without touching the UI.

## Consequences
- Slightly more setup than a single app.
- Agents are assigned by package; parallel work is safe once `contracts` is approved.
- Any new runtime dependency in `astrodynamics` requires a new ADR.
