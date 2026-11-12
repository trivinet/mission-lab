# Mission Lab — Engineering Team Instructions

Applies to every AI agent working in this repository. The human owner is the Product Owner and
Technical Lead; agents execute bounded, verifiable work under their direction.

## Sources of authority (highest first)

1. Explicit instructions and approved decisions from the owner.
2. Approved requirements and architecture: `docs/product/ML-SYS-001.md`,
   `docs/requirements/`, `docs/architecture/`.
3. Approved ADRs (`docs/architecture/adr/`) and contracts (`packages/contracts`).
4. Repository engineering conventions.
5. The individual task contract.

If two sources conflict, stop and report the conflict. Do not pick one silently.
A document marked *Proposed* is not yet authority.

## Current state

Gate G0 was approved by the owner on 2026-11-11. Phase 0b (scaffold, CI, contracts v1.0) was completed on 2026-11-12 and Phase 1 is in progress; see
`docs/status/status.json` and `docs/backlog/backlog.md`. Phase 1 feature work starts only on
tasks marked *ready*. Each later gate (G1–G4) needs owner approval before the next phase.

## Non-negotiable rules

- Implement only the approved scope of your task; touch only its `affected_paths`.
- Do not change architecture, scientific assumptions, scope or tolerances. Propose an ADR.
- Do not invent physical constants, conventions, units or reference values. Cite a source, and
  never write reference numbers from memory.
- Never mix reference frames or time scales implicitly. Physical field names carry unit suffixes
  (`_m`, `_mps`, `_s`, `_rad`).
- Simulation code never imports UI, rendering or browser APIs. The renderer never computes
  physics.
- Visual plausibility is not evidence of correctness.
- Never weaken, skip or delete a test to make a change pass.
- The implementation under test is never the sole reference for its own verification.
- No secrets, credentials or third-party confidential material in the repository.
- No backend, database or external service without an approved requirement.
- No deployment, publication or other external action without owner authorisation.
- Never claim a test, review, reference comparison or delegation happened unless it did.
  Separate clearly: done and verified / done but not verified / proposed.

## Workflow

One task = one `ML-TASK-NNN` = one branch (`<type>/ml-task-NNN-slug`) = one pull request.
Only the owner merges to `main`.

1. Read the task contract and the inputs it lists.
2. Confirm it is ready (requirements, interfaces and acceptance criteria exist). If not, report.
3. Plan, implement, run the relevant checks.
4. Fill in the task report (`docs/agents/task-template.yaml`, `report:` section).
5. Open the PR with summary and verification evidence. Stop.

If blocked, report the exact blocker and its impact instead of working around it.

## Roles

Defined in `.claude/agents/`. Model allocation and write permissions: ADR-007.
The Verification Engineer works without reading the implementation when deriving references and
tolerances.
