# Mission Lab v1.0.0 (M1 Orbital Sandbox): release notes

**Status: Release candidate.** Final after the owner approves gate G4
([G4-review.md](G4-review.md), Proposed). Nothing is tagged or released yet. The live site is
<https://trivinet.github.io/mission-lab/> (deployed by `.github/workflows/pages.yml`, ML-TASK-042).
Prepared by the Documentation and Release agent under ML-TASK-041 and updated under ML-TASK-043 on
2026-11-17 from the gate reviews G0 to G3 and the documents they cite. Counts and decisions are
taken from those documents or from the measurements in [G4-review.md](G4-review.md).

**Mission Lab is not qualified for operational use.** It is an educational and exploratory tool.

## 1. What is in v1.0.0

Requirements are in `docs/requirements/m1-requirements.md`; the mapping to tests is in the
[traceability matrix](../verification/traceability-matrix.md). How to use it is in the
[user guide](../user-guide.md). The app runs in the browser at
<https://trivinet.github.io/mission-lab/>.

- Create, edit and validate an Earth orbit from Keplerian elements; derived values and the
  degenerate-orbit convention are shown (ML-FR-001, ML-FR-002).
- Two-body propagation with a universal-variable solver, deterministic for identical requests
  (ML-FR-003, ML-FR-004).
- One impulsive maneuver in the RSW frame, with the along-track note (ML-FR-005, ML-FR-006).
  Escape and surface-intersecting results are propagated and flagged with a warning.
- Interactive 3D view with exact vertices, timeline and playback (ML-FR-007, ML-FR-008).
- Plots of 13 quantities and a coast-versus-maneuver comparison table (ML-FR-009, ML-FR-010).
- Versioned JSON save and load, with an unsaved-changes indicator and confirmation dialogs
  (ML-FR-011).
- Model and assumptions panel read from the result, with the not-qualified statement (ML-FR-012).
- Three example scenarios and CSV export (ML-FR-013, ML-FR-014).
- Result states none, computing, current, stale and error; computation in a Web Worker
  (ML-UX-001 to ML-UX-003).

Delivered by phase: G2 workspace (ML-TASK-020 to ML-TASK-027) and G3 analysis (ML-TASK-030 to
ML-TASK-036), listed in `docs/releases/G2-review.md` and `docs/releases/G3-review.md`. The G1
engine tasks are described in `docs/verification/G1-verification-report.md`; their numbers are
not restated here.

## 2. Verification summary

| Gate | Decision | Evidence |
|---|---|---|
| G0 (2026-11-11) | Approved | `docs/releases/G0-review.md` |
| G1 engine (2026-11-16) | Approved on conditions | `docs/verification/G1-verification-report.md`; tolerance record `docs/verification/tolerances.md` revision 5; conformance runs 1 to 4 |
| G2 workspace (2026-11-17) | Approved with limits | `docs/releases/G2-review.md`: VI-01, VI-02, VE-02 |
| G3 analysis (2026-11-17) | Approved with limits | `docs/releases/G3-review.md`: VI-03, VE-01, VT-17, VT-18 (FR-011 AC3), conformance run 5 |

Test counts as the reviews state them: 1574 tests at G1; 1792 unit and integration tests and 53
browser tests at G2; 1978 unit and integration tests and 77 browser tests (Chromium) at G3, all
passing locally and in CI at the time. On the release-candidate branch the suites were run again:
1989 unit and integration tests (106 files, 6 Vitest projects), 98 browser tests, 28 of 28 boundary
fixtures ([G4-review.md](G4-review.md) section A).

Release-readiness review (ML-TASK-040): [release-readiness-review.md](../verification/release-readiness-review.md).
It found one major finding (D-1, main-thread time after a result) and nine minor ones (D-2 to D-10). The owner
approved the pre-release fix package and accepted D-4, D-5, D-8 and D-10 for M1
([status.json](../status/status.json), activity log, 2026-11-17). ML-TASK-044 fixed D-1, D-2, D-3,
D-6, D-7 and D-9 and re-measured the performance record
([performance-envelope.md](../verification/performance-envelope.md) section 8).

Evidence layers: invariants (L1), independent implementation (L2), and Orekit as an external
tool (L3). Worst measured ratio to tolerance in conformance run 5: 0.090 for the history
comparison and 0.035 for the comparison table (`docs/verification/conformance-run-5.md`).

The full suite on the release-candidate branch is in [G4-review.md](G4-review.md). The owner
walkthrough of the 13-step acceptance scenario (ML-SYS-001 section 14) is not done yet; it is the
remaining G4 evidence. The automated acceptance flow is `apps/web/e2e/acceptance.spec.ts`
([ve-01-acceptance.md](../verification/ve-01-acceptance.md)).

## 3. Known limits and accepted gaps

Taken from the gate reviews. Each was accepted by the owner at the gate named.

From G1 (`docs/releases/G1-review.md`):

- VT-04 has no tolerance on the substitute angles; VT-15 has no L2 element comparison; VT-14 is
  checked at e = 0 only (open item O-11 stays open).
- VT-19 constants are checked against IERS Conventions 2010 (TN36). The WGS 84 attribution
  (NGA.STND.0036) was not reachable and stays an open gap.
- 13 test families have no L3 evidence; there is no textbook evidence (owner decision OA-15
  open); Orekit is the only external tool; post-maneuver trajectories in the L3 VT-12 and VT-15
  files are not compared.

From G2 (`docs/releases/G2-review.md`):

- Browsers other than Chromium, screen readers, colour contrast of the newer text and
  colour-blind rendering were not verified.
- The performance record used software WebGL on one loaded machine
  (`docs/verification/performance-envelope.md`).
- A superseded run is discarded, not cancelled; a long earlier run delays a later one.

From G3 (`docs/releases/G3-review.md`):

- Quantities with no approved tolerance row are informative only (e, omega and nu on hyperbolic
  states; periapsis, apoapsis and period histories; hyperbolic periapsis; convention-assigned
  angles on degenerate orbits). Measured differences are at most 4.4e-15.
- Flight-path angle and mean anomaly histories are not provided. ML-SYS-001 section 2.2 lists
  them; ML-FR-009 AC1 does not.
- No screen-reader test; real OS file dialogs and downloads were not tested outside Playwright.
- Analysis and plot construction ran on the main thread and were not measured near the
  1,000,000-sample limit. Superseded: ML-TASK-044 moved the analysis into the simulation worker and
  re-measured the envelope (`docs/verification/performance-envelope.md` section 8).
- VE-01 is a flow test, not numerical verification.
- Readings 5 to 9 of conformance run 5 section 4 have had no separate Systems Architect review.

From the release-readiness review (ML-TASK-040, `docs/verification/release-readiness-review.md`),
accepted by the owner for M1 on 2026-11-17 (finding ids as in that review):

- D-4: physically implausible inputs are accepted. A burn of 1e12 m/s (about 3000 times the speed
  of light) and a semi-major axis of 1e300 km both give a current result (an ESCAPE_TRAJECTORY
  warning only for the burn). Overflow is caught only far out: burns of 1e154 and 1e300 m/s give
  the error state with NON_FINITE_STATE. No plausibility limits on inputs in M1.
- D-5: impact is a warning, not a stop. After a burn that lowers the periapsis below the reference
  sphere, the run is current and the samples continue through the Earth's interior with a
  REFERENCE_SPHERE_INTERSECTION warning; the part of the trajectory after the impact is not
  marked in the 3D view (marking it is a candidate for M2). Read the warning before trusting such a trajectory.
- D-8: the layout is desktop-first and does not reflow at narrow widths: the document is wider
  than a 400 px viewport and scrolls horizontally (WCAG 1.4.10 asks for none at 320 CSS px).
  Zooming to 400 per cent scrolls in two dimensions.
- D-10: `pnpm audit --audit-level high` exits 1 (picomatch ReDoS, high, no patched version
  listed; minimatch, moderate). Both are reached only through development tooling (eslint,
  typescript-eslint, Vite); `pnpm audit --prod` reports no known vulnerabilities. The CI audit
  job is informational. To be tracked upstream.

Product limits (the model panel lists them): two-body point-mass Earth only; one maneuver;
impulsive only; GCRF frame only; UTC labels without leap seconds; altitude above a reference
sphere; illustrative Earth orientation; at most 1,000,000 samples per run, with a soft warning
above 250,000; scenario files up to 64 KiB.

Gaps in evidence found while writing the traceability matrix (see its section 5): no direct test
that a state declares frame, central body and epoch (ML-FR-003 AC3); no end-to-end test of the
error state (ML-UX-001); no review record for ML-NFR-002; no secret scan, and the audit job is
informational (ML-NFR-006). These are not owner-accepted. They are listed for the owner to
accept, fix or defer. Two gaps of that list were closed by ML-TASK-044: an end-to-end test of
plot axis titles, units, legend and maneuver marker (ML-FR-009 AC2), and a lint rule against
clock and randomness reads in the engine packages (ML-NFR-003, with fixtures; `Date.parse` and
`new Date(value)` with an argument stay allowed because they read no clock).

## 4. Owner decisions that shape the release

- G0 (2026-11-11): greenfield repository; architecture, package layout and JSON-only persistence;
  frame GCRF, UTC epoch plus elapsed seconds, illustrative Earth rotation, no ground tracks in
  M1; universal-variable propagator; closed orbits only at input; Orekit as the external
  reference (D-5); agent roles; ML-SYS-001 amendments; licence (D-9, recommendation MIT; the
  recorded owner response is "approved as recommended").
- 2026-11-12 and 2026-11-13: degenerate-element convention (e and i reported as computed, only
  undefined angles assigned) and the angular accuracy target (ADR-008); energy criterion for
  escape, and intersection limited to the simulated span (ML-FR-006 AC6); conformance workspace
  (ADR-009).
- 2026-11-16 (G1): VT-17 and the FR-011 AC3 part of VT-18 moved to G3; reduced scopes and L3 gaps
  accepted as listed above.
- 2026-11-17 (G2): sample limit kept at 1,000,000 with a soft warning above 250,000; the
  not-qualified wording approved.
- 2026-11-17 (G3): informative-only quantities; no flight-path or mean-anomaly histories; 64 KiB
  file limit; presets approved; ADR-010 (uPlot 1.6.32) accepted.

## 5. What comes in M2

Candidate capabilities from `docs/product/ML-SYS-001.md` section 2.3, not commitments:
numerical integration with configurable tolerances; J2; multiple sequential maneuvers; spacecraft
mass and propulsion parameters; finite-duration thrust; alternative frames (VNC/NTW maneuver
frame is a candidate); ground tracks and geographic visualization; enhanced plots and analysis;
import and export of orbital data formats; parabolic and hyperbolic initial orbits as inputs;
impact handling as a simulation event once an Earth-fixed frame exists. Each would get its own
requirements and verification cases.

## 6. Before this release candidate becomes the release

- The owner walkthrough of the 13 steps of ML-SYS-001 section 14 on the live site, and the
  decision on gate G4 ([G4-review.md](G4-review.md)).
- After approval: the tag `v1.0.0` and the GitHub release, created by the Coordinator. Neither
  exists yet.
- Version: every `package.json` and the `PACKAGE_VERSION` constants are `1.0.0`
  (ML-TASK-043). The change history is in [CHANGELOG.md](../../CHANGELOG.md).
