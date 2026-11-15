# Restarted Orekit arc for L3 `c1-escape-prograde` (revision 5)

Tolerance record revision 5 §9.3.2 item 6 (ML-TASK-018 part D3): the hyperbolic segment 1 of
`test-data/l3-orekit/vt-16/l3-orekit-c1-escape-prograde.json` (maneuver at m = 0) is compared with an
Orekit arc restarted from the engine's event state, like the m > 0 arcs in `../l3-restart/`.

This directory is empty in phase 1: nothing here may be produced before the owner signs revision 5,
because producing it runs the engine. Phase 2, from the repository root, after the record's status
line records the approval (the gate, `conformance/src/support/rev5-gate.ts`, refuses otherwise):

```sh
# 1. engine event state of c1 (writer mode of the gated test)
ML_CONFORMANCE_REV5=1 ML_WRITE_R5_EVENT_STATES=1 pnpm vitest run --project conformance src/vt16-r5-hyperbolic-asserted.test.ts
# 2. Orekit restart (pinned Orekit venv; verification/l3-d2/restart.py unchanged)
python -B conformance/l3-restart-r5/restart_r5.py --code-revision <commit> --date <YYYY-MM-DD>
# 3. A6′ check of the restarted arcs (tolerances.md §4.1 item 6 (b))
python -B verification/l3/selfcheck.py --repro --restart conformance/l3-restart
python -B verification/l3/selfcheck.py --restart conformance/l3-restart-r5
# 4. the gated comparisons
ML_CONFORMANCE_REV5=1 pnpm vitest run --project conformance
```

Step 1 writes `engine-event-states.json` (and fails in step 4 on purpose until step 2 has produced
`c1-escape-prograde.json`, whose recorded start state must equal the engine event state bit-for-bit).
