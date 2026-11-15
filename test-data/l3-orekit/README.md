# L3 Orekit reference cases

External-tool reference datasets (evidence layer L3, ADR-003; ML-TASK-012 part B), format of the
verification plan §6. Produced by `verification/l3/generate.py` with Orekit 13.1.9 (orekit_jpype
13.1.9.0); the generating commit, tool and runtime versions are in each file's `producedBy`.
Validated by `verification/l3/selfcheck.py --repro` before use (energy, angular momentum and
closure under assumption A6 of tolerances.md §9.3, Orekit round trip, RSW axis mapping,
byte-identical regeneration). Environment and conventions: `verification/l3/README.md`.

| Directory | Family | Cases |
|---|---|---|
| `vt-02` | Elements → Cartesian | the 9 grid cases |
| `vt-05` | Two-body propagation, 160 output steps, about 10 periods | the 9 grid cases |
| `vt-12` | RSW → inertial Δv (pure radial, along-track, cross-track; combined) | 8 |
| `vt-15` | Post-maneuver orbit (apsis tangential, normal, radial, combined; at t = 0 and after 1 T) | 14 |
| `vt-16` | Post-maneuver escape (2 hyperbolic) and sub-surface periapsis (1) | 3 |

Ids are `l3-orekit/<family>/<case>`; file names carry the `l3-orekit-` prefix so that they cannot be
confused with the L2 datasets of `test-data/reference-cases/`. This directory is an interim
location: see `verification/l3/README.md` "Dataset location". Requests are stored as
`inputs.requestBody` (no `requestId`); `−0` is written as `{"$number": "-0"}`.
