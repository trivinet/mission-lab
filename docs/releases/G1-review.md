# Gate G1 — Engine Review Decision

**Date:** 2026-11-16 · **Prepared by:** Coordinator · **Decision owner:** Product Owner
**Status:** **APPROVED** by the owner on 2026-11-16 ("Apruebo G1 así"), on the conditions below,
as recommended in the [G1 verification report](../verification/G1-verification-report.md) §8.

## A. Evidence

- [G1 verification report](../verification/G1-verification-report.md) (ML-VER-008): every
  existing test passes (1574 tests, 0 skipped, locally and in CI run 43847512903 on `main`
  77cdbaa). G1 was not met as the verification plan words it, because VT-17 has no test.
- [Tolerance record](../verification/tolerances.md) revision 5, approved 2026-11-16 (revisions 3
  and 4 approved 2026-11-13 and 2026-11-15).

## B. Decisions

1. **VT-17 and the FR-011 AC3 part of VT-18 are deferred to gate G3**, with persistence
   (ML-TASK-033). The verification plan is to be amended so that G1 does not require them. Reason:
   persistence does not exist before Phase 3; the plan and the backlog disagreed (G1 report §10
   item 2).
2. **Reduced scopes accepted for G1:**
   - VT-04 without a tolerance on the substitute angles (L2 finding F-3);
   - VT-15 without the L2 element comparison (L1 closed form in 320-bit plus L3 Orekit back it);
   - VT-14 at e = 0 only (owner direction P-1, 2026-11-15). The report says "VT-14: e = 0 only";
   - VT-19 against IERS Conventions 2010 (TN36). The WGS 84 attribution (NGA.STND.0036, not
     reachable from this network) stays an open gap (owner decision, 2026-11-16).
3. **L3 gaps accepted** as listed in G1 report §3:
   - 13 families without L3 evidence;
   - no textbook evidence (owner decision OA-15 still open);
   - Orekit is the only external tool;
   - the post-maneuver trajectories in the L3 VT-12 and VT-15 files are not compared.
4. **Evidence approved as committed.** These artifacts are approved unchanged at `main` 77cdbaa,
   identified by git object hash. A later change to any of them is a new version that needs its
   own approval (verification plan §6). The status text inside the files ("not yet reviewed or
   approved", "In review") is superseded by this record.

   | Artifact | Git object at 77cdbaa |
   |---|---|
   | `test-data/reference-cases/` (190 dataset files) | tree `9984f434b589394419685339ded2aab134249333` |
   | `test-data/l3-orekit/` (43 Orekit files), as L3 references | tree `dfe49febca8d227a8a1cbc263d823c7f06c1337d` |
   | `docs/verification/l2-references-report.md`, with findings F-1, F-3, F-4, F-5, F-7 accepted as reported | blob `7476fccb49c423ba0e877fffe71b7f3b7c3ba9d7` |
   | `docs/verification/conformance-run-1.md` | blob `16a6d2e41efd7f69a2cb2ed70cb6881e2a110f40` |
   | `docs/verification/conformance-run-2.md` | blob `7bfeaa98cb88a87cec3290fb5234773a28403cb7` |
   | `docs/verification/conformance-run-3.md` | blob `0edea29a51ebef2b87b88ae55fc62b2a0784c4d2` |
   | `docs/verification/conformance-run-4.md` (accepted 2026-11-16) | blob `8566ca5d16ce65637962593faf9d40591d18a8c5` |
   | `docs/verification/vt-19-constants.md` | blob `3240b3505bfd91ca6f4a923d6df32ff430368bae` |

5. **Open items O-1 and O-2 closed** on the evidence in the G1 report. O-11 (VT-14 for e > 0)
   stays open and does not block G1.
6. **The G1 verification report is approved.**
7. **Gate G1 is passed.** Phase 2 may start on tasks marked *ready*.

## C. Follow-ups (Coordinator)

- A written procedure for the restarted Orekit arcs when an engine change moves an event state.
  CI has no Orekit, so the arcs cannot be regenerated there.
- Documentation clean-up of the inconsistencies in G1 report §10:
  - stale status text;
  - task YAML statuses;
  - the plan amendment for decision 1;
  - superseded informative tests;
  - tolerance-record items from F-1 and F-4.
