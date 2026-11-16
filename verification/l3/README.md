# L3 Orekit reference datasets (ML-TASK-012 part B)

Evidence layer L3 of the [verification plan](../../docs/verification/m1-verification-plan.md) §2
(ADR-003): reference datasets produced by an external tool, Orekit, independent of both the engine
and the Verification Engineer's own L2 code. Owner decision D-5 chose Orekit; the owner approved
installing Python, a JDK and Orekit for this task.

## Environment (pinned)

| Component | Version used for the committed datasets |
|---|---|
| Python | 3.13.17 (CPython, Windows x64) |
| JDK | Eclipse Temurin 21.0.13 (HotSpot 64-bit), found through `JAVA_HOME` |
| orekit_jpype | 13.1.9.0 (bundles `orekit-13.1.9.jar` and Hipparchus 4.0.3 jars) |
| JPype1 | 1.7.1 |
| Python packages | exactly [`requirements.txt`](requirements.txt) |
| Node.js / Prettier | the repository's (Node 24, Prettier as pinned in `package.json`), used only to format the JSON |

Each dataset records the versions actually found at run time in `producedBy`.

Create the environment (any directory outside the repository; nothing is installed into it):

```sh
python3.13 -m venv <venv>
<venv>/bin/python -m pip install -r verification/l3/requirements.txt   # Windows: <venv>\Scripts\python.exe
# A JDK 21 must be installed and JAVA_HOME must point to it.
pnpm install --frozen-lockfile                                          # Prettier, for formatting
```

**No orekit-data is used.** The scripts use only the GCRF frame (the root of Orekit's frame tree)
and the TAI time scale, which Orekit defines without data files; no leap-second table, EOP or
ephemeris is loaded.

## Scripts

| File | Purpose |
|---|---|
| `cases.py` | Grid (plan §5) and maneuver case definitions |
| `l3lib.py` | Orekit access, conventions, tolerance-record formulas, lossless JSON writer |
| `generate.py` | Writes every dataset |
| `selfcheck.py` | Validates the datasets before use; `--repro` adds the reproducibility check; `--restart DIR` also checks Orekit arcs restarted from engine event states (e.g. `conformance/l3-restart`) |

Hyperbolic segments are checked pass/fail against the A6′ hyperbolic criterion of
`docs/verification/tolerances.md` revision 5 §9.3.1 (open item O-13; ML-TASK-018 part D3): energy
deviation, angular-momentum deviation and Kepler time-of-flight residual on every sample, against 2×
the §6.8 engine bounds mapped into each quantity, with the margin M. Arcs below the §7 VT-16 validity
gate (E/(v²/2 + μ/r) < 0.05 at the start) are reported as `info` only. These formulas live in
`selfcheck.py`; the generator files (`generate.py`, `l3lib.py`, `cases.py`) are unchanged, so the
datasets' `codeRevision` and the `--repro` check stay valid.

Run from the repository root (`python` = the venv's interpreter; `-B` writes no bytecode):

```sh
python -B verification/l3/generate.py --code-revision <commit> --date <YYYY-MM-DD>
python -B verification/l3/selfcheck.py --repro
```

`<commit>` is a commit that contains the generator files (`generate.py`, `l3lib.py`, `cases.py`)
unchanged. The generator is committed before the datasets are generated; `selfcheck.py --repro`
checks with `git diff` that the generator has not changed since the recorded commit, regenerates
every file into a temporary directory and compares the bytes.

When an engine change makes the restarted arcs stale (`--restart` directories), follow
[`docs/verification/l3-restart-procedure.md`](../../docs/verification/l3-restart-procedure.md).

## Conventions decided here (Orekit ↔ contracts)

| Topic | Contract (contracts-v1.md, ADR-004) | Orekit call | Notes |
|---|---|---|---|
| μ | `constants.mu_m3ps2` = 3.986004418e14 m³/s² (proposed-architecture.md §3) | passed as the `mu` argument of every `KeplerianOrbit`, `CartesianOrbit` and `KeplerianPropagator` | Orekit's `Constants` are never used |
| Reference radius | 6 378 137 m | not given to Orekit | used only for the VT-16 expectations |
| Frame | `GCRF` | `FramesFactory.getGCRF()` | no frame transformation anywhere (tolerances.md §9.3) |
| Epoch | `{scale: "UTC", iso: "2026-01-01T00:00:00.000Z"}` | `new AbsoluteDate(2026, 1, 1, 0, 0, 0.0, TAI)` | Orekit's UTC needs the leap-second file; two-body motion depends only on elapsed time, so the label of the origin changes no number |
| Time | `t_s`, elapsed SI seconds | `epoch.shiftedBy(t_s)` with the binary64 `t_s` | Orekit 13 stores dates with attosecond resolution |
| Element → state | (a, e, i, Ω, ω, ν), true anomaly, regular map, no re-normalisation | `new KeplerianOrbit(a, e, i, ω, Ω, ν, PositionAngleType.TRUE, gcrf, epoch, mu)` | Orekit's argument order puts ω **before** Ω; fields are mapped by name |
| State → elements | derived view, ADR-008 convention for degenerate cases | `new KeplerianOrbit(pv, gcrf, date, mu)` getters | angles as Orekit returns them; Orekit applies no ADR-008 convention, so ω, Ω, ν of near-circular or near-equatorial states are not comparable |
| Propagation | two-body, each sample from the segment's initial state | `KeplerianPropagator(CartesianOrbit(r0, v0), FrameAlignedProvider(gcrf), mu).propagate(date)` | initial orbit is the exact binary64 request state (A4) |
| RSW | R = r/‖r‖, W = (r × v)/‖r × v‖, S = W × R, pre-maneuver state | `LOFType.QSW.rotationFromInertial(pv)`, local→inertial by `applyInverseTo` | Q ↔ R, S ↔ S, W ↔ W; Δv_RSW = [ΔvR, ΔvS, ΔvW] is given as the local (x, y, z). Checked numerically against the contract definitions by `selfcheck.py` |
| Impulse | position unchanged, `velocityAfter[k] = velocityBefore[k] + deltaV_inertial[k]` (R12) | done in binary64 in Python | Orekit's event-driven `ImpulseManeuver` is not used: the impulse time is known and R12 fixes the arithmetic |
| −0 | P3: the request builder normalises −0 to +0 | — | request inputs normalised; outputs keep −0 as `{"$number": "-0"}` |

## Dataset location

The datasets are written to `test-data/l3-orekit/<family>/l3-orekit-<case>.json` with ids
`l3-orekit/<family>/<case>`, in the format of plan §6. They are **not** under
`test-data/reference-cases/` because two existing tests enumerate that tree and would fail on any
new file (`verification/src/datasets/datasets.test.ts` requires the tree to equal what the L2
builders produce; `conformance/src/support/datasets.test.ts` counts the files of `vt-02` and
`vt-05` and the conformance families run the engine on every file of a family directory). The owner
decided on 2026-11-15 to keep L3 in this separate directory; a later conformance task reads it
explicitly.
