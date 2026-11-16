# Restarted Orekit arc for L3 `c1-escape-prograde` (revision 5)

Tolerance record revision 5 §9.3.2 item 6 (ML-TASK-018 part D3): the hyperbolic segment 1 of
`test-data/l3-orekit/vt-16/l3-orekit-c1-escape-prograde.json` (maneuver at m = 0) is compared with an
Orekit arc restarted from the engine's event state, like the m > 0 arcs in `../l3-restart/`.

This directory holds no arc in phase 1: nothing here may be produced before the owner signs
revision 5, because producing it runs the engine. Phase 2, from the repository root, after the
record's header records the approval (the gate, `conformance/src/support/rev5-gate.ts`, refuses
otherwise):

```sh
# 1. engine event state of c1 (writer mode of the gated test file; its c1 test fails here because
#    the restarted arc does not exist yet — expected, this step only records the event state)
ML_WRITE_R5_EVENT_STATES=1 pnpm vitest run --project conformance src/vt16-r5-hyperbolic.test.ts
# 2. Orekit restart (pinned Orekit venv; verification/l3-d2/restart.py unchanged)
python -B conformance/l3-restart-r5/restart_r5.py --code-revision <commit> --date <YYYY-MM-DD>
# 3. A6′ check: L3 datasets and BOTH restart directories (tolerances.md §4.1 item 6 (b))
python -B verification/l3/selfcheck.py --repro --restart conformance/l3-restart
python -B verification/l3/selfcheck.py --restart conformance/l3-restart-r5
# 4. the comparisons (extended O-1 check first, then the asserted state rows, one file)
pnpm vitest run --project conformance
```

**The phase-2 run counts as evidence only if all three pass** (tolerances.md §4.1 item 6): both
selfcheck commands of step 3 (exit 0) — condition (b) — and, in step 4, the extended O-1 check —
condition (c) — together with the asserted state rows. Condition (c) is enforced in code: the O-1
suite and the asserted suites are in one file (`conformance/src/vt16-r5-hyperbolic.test.ts`), and
every asserted test fails unless every O-1 case ran and passed in the same run. Condition (b) is a
Python step and is not enforced in code; the phase-2 report must show its output.

**Switch removed (2026-11-16).** The owner accepted the phase-2 run report (conformance-run-4.md)
on 2026-11-16, so the switch `ML_CONFORMANCE_REV5` and the `describe.skipIf(!enabled)` lock were
removed: the tests run in every normal `pnpm test` and in CI, and the commands above no longer need
the variable (step 1 still needs `ML_WRITE_R5_EVENT_STATES=1` to rewrite the event state). The
record lock stays; it accepts any header that records revision 5 as approved, including a later
revision while it is proposed ("Revision 5 was approved by the owner on YYYY-MM-DD"; tolerances.md
§4.1 item 6).