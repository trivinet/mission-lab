# Gate G0 — Baseline Review Package

**Date:** 2026-11-11 · **Prepared by:** Coordinator · **Decision owner:** Product Owner
**Status:** **APPROVED** by the owner on 2026-11-11 ("lo apruebo todo"). D-1…D-9 accepted as
recommended. Still to be chosen by the owner before G1: which option of D-5 (external reference
source). D-6 executed on 2026-11-11 (repository moved out of the synced folder).

Owner direction recorded with the approval: escape, impact, interplanetary, deep-space and
launch/landing capabilities are wanted in later releases. Added to the roadmap in ML-SYS-001
v0.2 (§A.2); M1 scope is unchanged.

## A. Current state

- Satellite Viewer was audited read-only (source inspection and `npm audit`; not built or run).
  It is a JavaScript Next.js TLE/SGP4 tracker on Google Maps and ArcGIS with a cron/blob backend.
  **No code is reusable** for Mission Lab. → [legacy-assessment.md](../architecture/legacy-assessment.md)
- This repository contains documents and agent definitions only. No code, no dependencies.
- Local environment: git and Node 22 present; pnpm, GitHub CLI and Python absent; git identity
  not configured (nothing is committed yet).

## B. Recommended architecture

Static browser-only SPA; pnpm monorepo; pure TypeScript physics package with zero dependencies;
simulation contract between engine and UI; separate `verification/` workspace.
→ [proposed-architecture.md](../architecture/proposed-architecture.md), ADR-001…ADR-007.

## C. M1 scope

14 functional requirements with acceptance criteria, explicit out-of-scope list.
→ [m1-requirements.md](../requirements/m1-requirements.md)

## D. Verification baseline

Three evidence layers, 19 numerical test families, tolerance derivation policy.
→ [m1-verification-plan.md](../verification/m1-verification-plan.md)

## E. Roadmap

→ [backlog.md](../backlog/backlog.md)

## F. Decisions requiring owner approval

| # | Decision | Recommendation | Where |
|---|---|---|---|
| D-1 | Greenfield repository; Satellite Viewer untouched | Approve | ADR-001 |
| D-2 | Architecture, package layout, frontend stack, JSON-only persistence | Approve | ADR-002, ADR-006 |
| D-3 | Frame `GCRF`, UTC epoch + elapsed seconds, illustrative Earth rotation, **no ground tracks in M1** | Approve | ADR-004 |
| D-4 | Universal-variable propagator; closed orbits only at input; post-maneuver escape/impact propagated and flagged | Approve | ADR-005, review F-05 |
| D-5 | External reference source for verification layer 3: (a) install Python + Orekit, (b) install GMAT, (c) owner supplies a textbook (Vallado / Curtis) for cited worked examples, (d) proceed with layers 1–2 only and record the gap | (a) or (c); at least one before G1 | ADR-003 |
| D-6 | Repository location: it currently sits inside a OneDrive-synced folder, which tends to lock files and slow installs once `node_modules` exists | Move to a non-synced path (e.g. `C:\dev\mission-lab`) before ML-TASK-003 | backlog R-010 |
| D-7 | Agent roles and model allocation | Approve | ADR-007 |
| D-8 | The 18 amendments to ML-SYS-001 (→ v0.2) | Approve | [ML-SYS-001-review.md](../product/ML-SYS-001-review.md) |
| D-9 | Licence for the public repository | MIT, unless the owner prefers otherwise | — |

## Owner actions needed to proceed (not decisions)

1. Git identity for commits. For a public repository the GitHub *noreply* address avoids
   exposing a personal e-mail.
2. Create the public GitHub repository `mission-lab` (empty, no README) and install and sign in
   to the GitHub CLI, so that issues, PRs, CI and branch protection can be managed from here.
3. Check the token entry in Satellite Viewer's `next.config.js` (legacy finding L-08).
