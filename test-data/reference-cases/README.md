# Reference cases

Independent reference datasets for Mission Lab verification (ADR-003), format of the verification
plan §6. Every file is produced by the committed reference code in `verification/src/datasets/`
(its commit is in `producedBy.codeRevision`) and is checked for bit-for-bit reproducibility by
`verification/src/datasets/datasets.test.ts`. Tolerances are the approved formulas of
`docs/verification/tolerances.md` evaluated at the dataset's own scale and committed before any
engine run on the dataset (§4.1).

| Directory | Family | Produced by |
|---|---|---|
| `vt-02`, `vt-03`, `vt-04`, `vt-05`, `vt-08` | Element/state conversion, propagation, closure | ML-TASK-011 (`build.ts`) |
| `vt-01` | Vector identities (inputs and fixed tolerances) | ML-TASK-018 part C (`build-c.ts`) |
| `vt-06-07` | Energy and angular-momentum conservation, per-sample tolerances | ML-TASK-018 part C |
| `vt-09` | Sampling independence (exact), also VT-10 inputs | ML-TASK-018 part C |
| `vt-12` | RSW frame (VT-11), inertial Δv (VT-12), impulsive change (VT-13) | ML-TASK-018 part C |
| `vt-14` | Zero-Δv maneuver vs coast (tolerance for e = 0 only, open item O-11) | ML-TASK-018 part C |
| `vt-15` | Post-maneuver orbit vs closed form | ML-TASK-018 part C |
| `vt-16` | Escape and reference-sphere intersection warnings; sub-surface arcs vs L2a/L2b | ML-TASK-018 part C |
| `vt-18` | Invalid-input classes with expected codes and paths | ML-TASK-018 part C |
| `vi-01` | Request → result structure scenarios, −0 rule, failed-result shape | ML-TASK-018 part C |

Special numbers that JSON cannot carry are written as `{"$number": "NaN" | "Infinity" |
"-Infinity" | "-0"}` (decoder: `verification/src/datasets/encoding.ts`).
