# Gate G4 — Release Review Decision

**Date prepared:** 2026-11-17 · **Prepared by:** Documentation and Release agent (ML-TASK-043) ·
**Decision owner:** Product Owner
**Status:** **Proposed.** Not approved. Nothing is tagged, released or published by this document.

Gate G4, from the [verification plan](../verification/m1-verification-plan.md) §8: "Full suite
green on the release commit; performance record; owner walkthrough of §14". The 13 steps of §14
are in [ML-SYS-001](../product/ML-SYS-001.md), section 14, which also says the release is not
accepted unless the numerical verification suite passes.

Live site: <https://trivinet.github.io/mission-lab/> (workflow `.github/workflows/pages.yml`,
ML-TASK-042). The site answered HTTP 200 when this document was prepared. Which commit it serves
was not checked here.

## A. Full suite on the release-candidate branch

Measured by the author on branch `release/v1.0.0-prep` at commit `b4f29a4` (version 1.0.0 in all
packages, documentation clean-up; the only code-path differences from `main` dc2aa7a are the version fields and constants and one docstring line in `verification/l3-d2/restart.py`), Windows 11,
Node 24.22.2, pnpm 12.16.1. Ports 4173 and 4174 had no listener before and after the browser run.
This is a local run, not CI.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0; 106 files, **1989 tests passed**, 0 failed (6 Vitest projects) |
| `pnpm vitest run --project conformance` | 28 files, **636 tests passed** (included in the 1989) |
| `pnpm build` | exit 0 |
| `pnpm format:check` | exit 0 |
| `pnpm check:boundaries` | exit 0; 28 of 28 fixtures reported |
| `pnpm test:e2e` (Chromium) | exit 0; **98 passed**, one run |

The counts equal those in the [ML-TASK-044 report](../backlog/tasks/ML-TASK-044.yaml) (1989 tests,
28 of 28 fixtures, 98 browser tests). The three-run repeat of the browser tests was done by
ML-TASK-044 (98 / 98 / 98), not repeated here. Not run here: `pnpm perf:envelope`, `pnpm audit`.
CI on the final release commit has not been seen by the author; the owner should confirm it is green.

`pnpm audit --audit-level high` exits 1 (D-10, dev tooling only), as the
[release notes](release-notes-v1.0.0.md) section 3 states. The audit job in CI is informational.

Scientific evidence is unchanged since the gates and is not re-run as a separate activity:
[G1 verification report](../verification/G1-verification-report.md),
[conformance runs 1 to 5](../verification/conformance-run-5.md) (run 5 is the latest), the
[G1](G1-review.md), [G2](G2-review.md) and [G3](G3-review.md) reviews, and the
[traceability matrix](../verification/traceability-matrix.md) (Draft, not reviewed by the
Verification Engineer).

## B. Performance record

[performance-envelope.md](../verification/performance-envelope.md): the record of 2026-11-17
(sections 1 to 7) and the release-candidate re-measurement after ML-TASK-044 (section 8). On one
machine, software WebGL, not quiesced. At the limit of 1,000,000 samples: worker time about 4.0 s
(engine 1.5 s plus analysis 2.5 s), click to first frame 5.3 s, largest main-thread block 613 ms,
main-page JS heap 115 MB, playback frame 377 ms. The 250,000 soft warning and the 1,000,000 limit
are unchanged; section 8.5 reads them as still decided and leaves the owner to re-confirm. The
before and after figures are in section 8.3 of that document.

## C. Release-readiness review and known limits

[release-readiness-review.md](../verification/release-readiness-review.md) (ML-TASK-040). Findings
fixed by ML-TASK-044: D-1, D-2, D-3, D-6, D-7, D-9. Accepted by the owner for M1: D-4, D-5, D-8,
D-10 ([status.json](../status/status.json), activity log). The full list of limits is in
[release-notes-v1.0.0.md](release-notes-v1.0.0.md) section 3. Gaps in the traceability matrix that
the owner has not yet accepted, fixed or deferred are listed there too (no direct test of the
ML-FR-003 AC3 declaration, no end-to-end test of the error state, no review record for ML-NFR-002,
no secret scan).

## D. Owner walkthrough of ML-SYS-001 section 14

To be done by the owner on the live site. The automated counterpart is
`apps/web/e2e/acceptance.spec.ts`, mapped in [ve-01-acceptance.md](../verification/ve-01-acceptance.md);
it is a flow test, not numerical verification. The scenario used there is a = 8000 km, e = 0.1,
i = 51.6 deg, RAAN 30 deg, argp 60 deg, nu 10 deg; 5400 s at 60 s; one maneuver at t = 2400 s,
RSW delta-v [0, 100, 0] m/s. The owner may use it or any other valid scenario. The "what to look
for" column is taken from that mapping.

| Done | # | Step (ML-SYS-001 §14) | What to look for |
|---|---|---|---|
| [ ] | 1 | Create an Earth-centred elliptical or circular orbit | Entered elements shown with units; scenario name in the toolbar; unsaved indicator on |
| [ ] | 2 | Inspect its orbital elements | Derived panel: perigee and apogee match r_p = a(1-e), r_a = a(1+e); period; specific energy with units |
| [ ] | 3 | Propagate the orbit for a selected duration | Run gives state current and the expected number of samples; no diagnostics |
| [ ] | 4 | Visualise the unmodified trajectory | 3D view with one trajectory segment and no maneuver marker; timeline visible |
| [ ] | 5 | Define an impulsive RSW maneuver | Time and R, S, W inputs; RSW note visible; the previous result becomes stale |
| [ ] | 6 | Execute the maneuver | Run gives current, one maneuver event, total delta-v shown |
| [ ] | 7 | Visualise the resulting trajectory and the maneuver location | Two segments; a marker at the end of the first segment |
| [ ] | 8 | Inspect changes in orbital parameters | Plots with the maneuver time marked; comparison table with before, after and difference |
| [ ] | 9 | Compare both simulations | Coast run drawn beside the maneuvered run in the scene and the plots; coast run named in the legend |
| [ ] | 10 | Save the scenario to a versioned JSON file | A `.scenario.json` file downloads; unsaved indicator goes off |
| [ ] | 11 | Reload the scenario | New scenario clears the workspace; loading the file restores every field |
| [ ] | 12 | Confirm reproducibility of the result | Run again: same plots and scene; saving again gives identical file text |
| [ ] | 13 | Inspect the recorded physical model, reference frame and calculation metadata | Model panel rows filled; frame GCRF; limitations listed; "Not qualified for operational use" visible |

Observations (free text, to be filled by the owner):

## E. Decision requested

1. Approve gate G4 on the evidence above and on the walkthrough, with the limits in C. The
   Coordinator then creates the tag `v1.0.0` and the GitHub release; the author did neither.
2. Confirm that CI is green on the release commit.
3. Re-confirm the sample limits (250,000 soft, 1,000,000 hard) against the numbers in B, or ask
   for a change.
4. Accept, fix or defer the unaccepted traceability gaps named in C.
5. Note that [release-notes-v1.0.0.md](release-notes-v1.0.0.md) stays "Release candidate" until
   G4 is approved.
