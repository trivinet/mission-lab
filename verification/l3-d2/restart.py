"""Orekit arcs restarted from the engine's event state (ML-TASK-018 part D2; tolerances.md §9.3.2).

For an L3 case with a maneuver at m > 0, the states after the burn are compared with an Orekit arc
restarted from the engine's event state (position_m, velocityAfter_mps), with the same propagator
call as the datasets of test-data/l3-orekit (KeplerianPropagator on a CartesianOrbit, mu explicit,
GCRF; verification/l3/generate.py `propagate`), at the segment-1 sample times (§9.3.2 item 2).

This script does not run the engine. It reads the engine event states that the conformance test
conformance/src/l3-vt16-escape-intersection.test.ts writes in writer mode (ML_WRITE_L3_EVENT_STATES=1) into
conformance/l3-restart/engine-event-states.json, and writes one Orekit arc per case next to it.
The comparison code and the tolerances (test-data/reference-cases/l3-r4-vt-16, evaluated from
Orekit's own event state, §9.3.2 item 3) are committed before this script is run (§4.1).

It uses verification/l3/l3lib.py and generate.py unchanged (ML-TASK-012 owns them).

Usage (repository root, the pinned environment of verification/l3/README.md):

    python -B verification/l3-d2/restart.py --code-revision <commit of this script> --date YYYY-MM-DD
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "l3"))

import generate  # noqa: E402
import l3lib  # noqa: E402

OUT_SUBDIR = Path("conformance") / "l3-restart"
EVENTS = "engine-event-states.json"
SCRIPT = "verification/l3-d2/restart.py"


def decode(x):
    """Inverse of the {"$number": ...} encoding (test-data/reference-cases/README.md)."""
    if isinstance(x, dict):
        if set(x.keys()) == {"$number"}:
            return {"-0": -0.0, "NaN": float("nan"), "Infinity": float("inf"), "-Infinity": float("-inf")}[x["$number"]]
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    return x


def main(argv=None):
    l3lib.ensure_utf8_stdout()
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--code-revision", required=True)
    ap.add_argument("--date", required=True)
    args = ap.parse_args(argv)
    out_dir = l3lib.REPO_ROOT / OUT_SUBDIR
    events = decode(json.loads((out_dir / EVENTS).read_text(encoding="utf-8")))
    ok = l3lib.Ok()
    env = l3lib.environment()
    count = 0
    for c in events["cases"]:
        m = float(c["maneuverTime_s"])
        r0 = [float(x) for x in c["position_m"]]
        v0 = [float(x) for x in c["velocityAfter_mps"]]
        times = [float(t) for t in c["t_s"]]
        rs, vs = generate.propagate(ok, r0, v0, m, times)
        data = {
            "id": f"l3-restart/{c['case']}",
            "description": (
                "Orekit arc restarted from the engine's event state (tolerances.md §9.3.2 item 2) "
                "for " + c["l3Dataset"] + "; used only by the conformance comparison of the states "
                "after the burn. Depends on the engine only through the event state recorded in "
                "inputs, which the test checks bit-for-bit against the engine before using this arc."
            ),
            "producedBy": {
                "tool": "Orekit "
                + env["orekitJar"]
                + ", "
                + env["hipparchusJar"]
                + " through orekit_jpype "
                + env["orekitJpype"]
                + ", JPype1 "
                + env["jpype1"],
                "script": SCRIPT,
                "codeRevision": args.code_revision,
                "date": args.date,
                "runtime": f"Python {env['python']}; JDK {env['jdk']}; {env['os']}",
                "orekitApi": (
                    "KeplerianPropagator(CartesianOrbit(PV(r0, v0), GCRF, epoch.shiftedBy(m), mu), "
                    "FrameAlignedProvider(GCRF), mu).propagate(epoch.shiftedBy(t_s)); "
                    "verification/l3/generate.py propagate (unchanged)"
                ),
                "frameAndTime": "As test-data/l3-orekit (GCRF, TAI-labelled epoch, epoch.shiftedBy(t_s)).",
            },
            "inputs": {
                "l3Dataset": c["l3Dataset"],
                "engineRevision": events["engineRevision"],
                "maneuverTime_s": m,
                "position_m": r0,
                "velocityAfter_mps": v0,
            },
            "outputs": {"t_s": times, "position_m": rs, "velocity_mps": vs},
        }
        rel = OUT_SUBDIR / f"{c['case']}.json"
        l3lib.write_bytes(l3lib.REPO_ROOT / rel, l3lib.render_json(data, rel.as_posix()))
        count += 1
    print(f"wrote {count} restarted arcs to {out_dir}")


if __name__ == "__main__":
    main()
