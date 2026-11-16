# Procedure: stale restarted Orekit arcs

**Date:** 2026-11-16 · **Author:** Documentation and Release agent · **Status:** Proposed (written
from the G1 follow-up C in [G1-review.md](../releases/G1-review.md); not reviewed by the
Verification Engineer). Every command below is copied or derived from an existing script
docstring or README; none is new.

## 1. Question answered

An engine change moves an event state (position or velocity after the burn, or the event time) by
one bit. The restarted Orekit arcs were produced from the old event state, so the L3 VT-16
segment-1 tests fail. CI has no Orekit and cannot regenerate the arcs (G1 report §5, risk 1).
What do you do?

## 2. Stale arc or engine defect

The comparison test checks the arc's recorded start state against the engine's current event state
before it compares any number. The start state is `inputs.maneuverTime_s`, `inputs.position_m`
and `inputs.velocityAfter_mps` of the restarted arc file. The check is bit-identical
(`Object.is` on the time, `bitIdentical` on the vectors).

A **stale arc** shows this failure, and nothing else, before any tolerance comparison:

```
<l3 dataset file>: restarted arc was produced from another event state (stale); regenerate
```

It comes from `conformance/src/vt16-r5-hyperbolic.test.ts` (cases `c3-midrun-escape` and
`c1-escape-prograde`) and from `conformance/src/l3-vt16-escape-intersection.test.ts` (case
`c4-midrun-retro-subsurface`). If the arc file is missing the message is instead
`restarted Orekit arc missing`.

A **real engine defect** passes the start check and fails a tolerance comparison (a ratio above 1
against an approved tolerance). Do not regenerate arcs to make such a failure go away. A
tolerance failure on an arc whose start state matches is an engine finding.

Both cases can occur in one PR. Regenerate only when the start-state check fails, then rerun the
tests: any tolerance failure that remains is an engine finding.

Confirm the engine change moved the event state on purpose. A change that was meant to leave the
numbers alone and moves an event state is itself a defect to examine before regenerating.

## 3. Regeneration

Who: the Verification Engineer, in the pinned Orekit environment of
[`verification/l3/README.md`](../../verification/l3/README.md) (Python 3.13, JDK 21,
orekit_jpype 13.1.9.0, requirements pinned in `verification/l3/requirements.txt`). All commands
run from the repository root, on the engine commit that moved the event state.

Two directories hold restarted arcs:

| Directory | Cases | Event-state writer |
|---|---|---|
| `conformance/l3-restart` | `c3-midrun-escape`, `c4-midrun-retro-subsurface` | `conformance/src/l3-vt16-escape-intersection.test.ts` with `ML_WRITE_L3_EVENT_STATES=1` |
| `conformance/l3-restart-r5` | `c1-escape-prograde` | `conformance/src/vt16-r5-hyperbolic.test.ts` with `ML_WRITE_R5_EVENT_STATES=1` |

Step 1: write the engine event states. Each writer rewrites `engine-event-states.json` in its
directory and records the engine revision (`git rev-parse --short=12 HEAD`). The r5 command is
the one in `conformance/l3-restart-r5/README.md`. The first command has the same form; no
committed document spells it out (ML-TASK-018's report records it as
`ML_WRITE_L3_EVENT_STATES=1 vitest l3-vt16`), so the Verification Engineer should confirm it.
The test run itself fails on the stale arcs; that is expected, this step only records event
states.

```sh
ML_WRITE_L3_EVENT_STATES=1 pnpm vitest run --project conformance src/l3-vt16-escape-intersection.test.ts
ML_WRITE_R5_EVENT_STATES=1 pnpm vitest run --project conformance src/vt16-r5-hyperbolic.test.ts
```

Step 2: restart in Orekit. `--code-revision` is a commit that contains the script, as in the
script docstrings. `restart_r5.py` runs `restart.py` unchanged against the r5 directory. Neither
script runs the engine.

```sh
python -B verification/l3-d2/restart.py --code-revision <commit> --date <YYYY-MM-DD>
python -B conformance/l3-restart-r5/restart_r5.py --code-revision <commit> --date <YYYY-MM-DD>
```

Step 3: A6′ check on the L3 datasets and both restart directories (the commands of
`conformance/l3-restart-r5/README.md` step 3). Both must exit 0.

```sh
python -B verification/l3/selfcheck.py --repro --restart conformance/l3-restart
python -B verification/l3/selfcheck.py --restart conformance/l3-restart-r5
```

Step 4: the comparisons.

```sh
pnpm vitest run --project conformance
```

All of step 3 and step 4 must pass. Step 3 is a Python step and CI does not run it, so the PR
description must show its output.

## 4. Review and approval

The regenerated arcs are a new version of approved evidence: the arcs were part of the L3 runs
accepted by the owner (conformance runs 3 and 4; [G1-review.md](../releases/G1-review.md)
decision 4 says a later change to approved evidence is a new version that needs its own
approval, verification plan §6).

- The PR of the engine change states that event states moved, which arc files were regenerated,
  and that the regenerated arcs need review and owner approval.
- The Verification Engineer's output of step 3 and the engine revision recorded in
  `engine-event-states.json` go in the same PR or in a run report.
- The owner approves the regenerated arcs. Only the owner merges.
- The regenerated files are not edited by hand. The test also needs the event-state files to
  match the engine at the merged commit, so regenerate on the final engine commit, not on an
  earlier one.

## 5. What this procedure does not cover

- Regeneration in CI: there is no Orekit there, and none is proposed here.
- A change to `verification/l3/generate.py`, `l3lib.py` or `cases.py`: that invalidates the L3
  datasets themselves and is covered by `selfcheck.py --repro`, not by this procedure.
- Tolerance values: never changed here (AGENTS.md).

## 6. Inconsistency noted

The docstring of `verification/l3-d2/restart.py` (line 9) names the writer test
`conformance/src/l3-vt16.test.ts`. That file does not exist; the writer is in
`l3-vt16-escape-intersection.test.ts`. Code is not changed by this task.
