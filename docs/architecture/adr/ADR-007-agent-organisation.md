# ADR-007 — Agent organisation and model allocation

**Status:** Accepted — owner approval at gate G0, 2026-11-11 · **Resolves:** OD-008

## Context
Owner decisions of 2026-11-11: use Claude Code subagents with the main session as Coordinator;
role definitions versioned in the repository; do not overuse the most expensive model — assign
lighter models wherever that does not compromise the result. There is no deadline.

## Decision

Roles are defined in `.claude/agents/*.md`. The main Claude Code session is the Coordinator.

| Role | Agent file | Model | Why this tier | May write |
|---|---|---|---|---|
| Coordinator | (main session) | session model | Planning, decomposition, integration, owner dialogue | backlog, reports, docs |
| Systems Architect | `systems-architect` | opus | Contract and boundary mistakes are the most expensive to undo | `docs/architecture`, `docs/requirements`, `packages/contracts` |
| Astrodynamics Engineer | `astrodynamics-engineer` | opus | Numerical subtlety; correctness is priority 1 | `packages/astrodynamics`, `packages/simulation` |
| Verification Engineer | `verification-engineer` | opus | Must be at least as capable as the implementer it checks | `verification/`, `test-data/`, `docs/verification`, test files |
| Frontend & Visualization Engineer | `frontend-engineer` | sonnet | Well-trodden stack, fast visual feedback, covered by e2e tests | `apps/web` |
| Documentation & Release | `docs-release` | haiku | Consistency checks, traceability tables, release notes | `docs/` (not ADR decisions), `README`, changelog |

Cost rules:
- The top-tier session model is used only for coordination, never delegated to subagents.
- Mechanical work (file inventory, searches, formatting, link checks) goes to the cheapest tier.
- A role is escalated one tier only after a recorded failure at the lower tier, and the
  escalation is noted in the task report.

Process rules (from ML-SYS-001 §11.8, made concrete):
- One task = one `ML-TASK-NNN` = one branch = one PR. Agents working in parallel use separate
  git worktrees.
- Agents communicate through the task file, the PR description and the task report — not through
  chat history.
- The Verification Engineer receives the requirement, the contract and the ADRs, **not** the
  implementation diff, when deriving references and tolerances.
- Only the owner merges to `main`.

## Consequences
- The independence between implementer and verifier is procedural (separate context, separate
  directories, different algorithms). Both are language models and may share blind spots; ADR-003
  layer 3 (external references) exists for that reason.
- Model names are aliases; the table is revisited when the available models change.
