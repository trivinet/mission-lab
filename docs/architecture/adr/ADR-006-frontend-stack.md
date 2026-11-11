# ADR-006 — Frontend stack and persistence

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-002, OD-007 · **Mitigates:** R-006

## Context
ML-SYS-001 §4.1 proposes React + TypeScript, Three.js (possibly React Three Fiber), Tailwind, and
asks to choose between Next.js and a simpler React/Vite application. With ADR-001 there is no
existing framework to retain.

## Decision
- **Vite + React + TypeScript (strict)**, single-page application, static output.
- **Three.js through React Three Fiber**, stable release line only.
- **Tailwind CSS** with a small in-repo component set.
- **Persistence:** versioned JSON file import/export; optional local-storage autosave of the
  working scenario. No IndexedDB or other browser database in M1.
- **Charting library:** not decided here; chosen by a spike at the start of Phase 3 (OD-006).

Exact versions are selected against current stable releases and pinned in ML-TASK-002.

## Rationale
M1 has one workspace screen, no server-side rendering need, no API routes and no SEO requirement.
Next.js would introduce a server runtime and routing conventions that ARCH-009 tells us not to
adopt without a use case. Vite gives native Web Worker and monorepo support with less surface.
A scenario is a few kilobytes of JSON, so a browser database has nothing to manage.

## Consequences
- Deployable to any static host; the provider is chosen by the owner before Phase 4.
- If a backend is ever justified, it is added as a separate service behind the simulation
  contract, not by migrating the app framework.
- Run history across browser sessions is not kept in M1 (results are reproducible from the saved
  scenario instead).
