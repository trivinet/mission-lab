"""Orekit arc restarted from the engine's event state for L3 c1-escape-prograde (m = 0, hyperbolic
after the burn): tolerances.md revision 5 §9.3.2 item 6 (ML-TASK-018 part D3, phase 2 only).

This driver runs verification/l3-d2/restart.py UNCHANGED, pointed at this directory: it reads
conformance/l3-restart-r5/engine-event-states.json (written by the gated test
conformance/src/vt16-r5-hyperbolic.test.ts with ML_WRITE_R5_EVENT_STATES=1) and writes
conformance/l3-restart-r5/c1-escape-prograde.json. It does not run the engine.

Usage (repository root, the pinned Orekit environment of verification/l3/README.md):

    python -B conformance/l3-restart-r5/restart_r5.py --code-revision <commit> --date YYYY-MM-DD
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "verification" / "l3-d2"))

import restart  # noqa: E402

restart.OUT_SUBDIR = Path("conformance") / "l3-restart-r5"

if __name__ == "__main__":
    restart.main()
