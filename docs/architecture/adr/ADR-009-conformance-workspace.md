# ADR-009 — Conformance workspace for engine-versus-reference runs

**Status:** Accepted — owner decision, 2026-11-13 · **Refines:** ADR-002 (package layout and
one-way dependencies), ADR-003 (process separation) · **Affects:** ML-TASK-018, `eslint.config.js`,
`pnpm-workspace.yaml`, `vitest.config.ts`, coding-standards §6

## Context

ADR-003 requires every scientific function to be accepted against independent references, and it
keeps the reference side blind to the engine: code in `verification/` may not import
`packages/astrodynamics` (or `packages/simulation`), and `eslint.config.js` enforces this with
`boundaries/dependencies` (`verification` may import `contracts` only; proven by
`tools/boundary-fixtures/verification/*`).

The comparison itself — feeding the reference datasets of `test-data/reference-cases/` to the
engine and evaluating the result against the stored tolerances, and running the O-1 solver check
(`o1Check`, tolerances.md §12) on the χ̂ the engine reports — needs code that imports **both** the
engine and the verification library. No approved place could do that:

- `verification/` must stay unable to see the engine (ADR-003); allowing it would remove the
  lint-enforced guarantee that reference code is written without the engine.
- `packages/astrodynamics` and `packages/simulation` may not import `verification/` (ADR-002) and
  are owned by the Astrodynamics Engineer, who may not be the judge of their own conformance.
- `apps/web` may import neither the engine package directly nor `verification/`.

## Options

- **A. A new workspace `conformance/`** that may import `astrodynamics`, `simulation`, `contracts`
  and `verification`, and that nothing may import. It contains tests only and has no runtime
  exports.
- **B. Relax the `verification/` rule** so that test files inside `verification/` may import the
  engine. Rejected: the boundary would then depend on a file-name pattern inside one workspace;
  reference modules and engine-calling tests would share a package, its imports and its
  type-checking, so an accidental import of the engine into reference code would no longer be a
  lint failure; and ADR-003's process separation would rest on review alone.
- **C. Comparisons inside the engine packages.** Rejected: the implementation under test would
  host its own acceptance (AGENTS.md: the implementation is never the sole reference for its own
  verification), and the engine would gain a dependency on `verification/`.

## Decision

Option A (owner decision, 2026-11-13: "a new workspace `conformance/` allowed to import the
engine, the contracts and the verification code, with nothing importing it, recorded as ADR-009").

- `conformance/` is a pnpm workspace, package `@mission-lab/conformance`, `private`, with no
  `exports` and no runtime code: only `src/**/*.test.ts` files and test helpers.
- It depends (`workspace:*`) on `@mission-lab/astrodynamics`, `@mission-lab/simulation`,
  `@mission-lab/contracts` and `@mission-lab/verification`. It adds no third-party dependency.
- `eslint.config.js` declares the element `conformance`, allowed to import `astrodynamics`,
  `simulation`, `contracts` and `verification`. **No element may import `conformance`.** The
  existing rules are unchanged; in particular `verification` still may import `contracts` only.
- The same non-web rules apply to `conformance/` as to the other non-web workspaces (no UI
  libraries, no browser globals).
- Boundary fixtures under `tools/boundary-fixtures/` prove that `verification`, `astrodynamics`
  and `web` importing `conformance` is rejected, and that `conformance` importing `astrodynamics`,
  `verification` and `contracts` lints clean.
- Ownership: the Verification Engineer owns `conformance/`; the Astrodynamics Engineer may not
  edit it. (ADR-007's write-permission table is to be updated to say so; see Consequences.)
- Rules for its content: tolerances and reference values are taken from the datasets and the
  approved tolerance record only; a tolerance is never re-evaluated from engine output
  (tolerances.md §4.1); a failing comparison stays failing and is reported (AGENTS.md).

## Rationale

- The reference side stays provably blind to the engine: the lint rule that forbids
  `verification → astrodynamics` is not weakened, and the new code that sees both sides sits in a
  separate package whose only purpose is the comparison.
- "Nothing imports `conformance`" keeps it a leaf: no engine, reference or application code can
  come to depend on test-only code, and the workspace can be dropped or replaced without touching
  any other package.

## Consequences

- One more workspace and one more Vitest project (`conformance`); `pnpm test` runs it.
- The verification library may need to export helpers (dataset-independent evaluators such as
  `o1Check`) for `conformance/` to use; such exports must not change behaviour.
- Coding standards §6 (package boundary table) and ADR-007 (write permissions) should list
  `conformance/`; those documents are outside ML-TASK-018's affected paths and are left to the
  docs-release role.
- A conformance failure is an engine, reference or dataset finding to be reported; it is never
  resolved inside `conformance/` by changing a tolerance or skipping a test.
