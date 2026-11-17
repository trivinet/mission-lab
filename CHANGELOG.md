# Changelog

All notable changes to Mission Lab are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions use Semantic Versioning, as
the contract requires for `engineVersion`
([contracts-v1.md](docs/architecture/contracts-v1.md)).

## [1.0.0] - release candidate, not yet released

Release M1 "Orbital Sandbox". The tag and the GitHub release are created only after the owner
approves gate G4 ([G4-review.md](docs/releases/G4-review.md)). Details and known limits:
[release notes](docs/releases/release-notes-v1.0.0.md). Live site:
<https://trivinet.github.io/mission-lab/>.

### Added

- Earth orbit from Keplerian elements with validation, derived values and the degenerate-orbit
  convention (ML-FR-001, ML-FR-002; [ADR-008](docs/architecture/adr/ADR-008-degenerate-elements-and-angular-accuracy.md)).
- Two-body propagation with a universal-variable solver, deterministic for identical requests
  (ML-FR-003, ML-FR-004; [ADR-005](docs/architecture/adr/ADR-005-kepler-propagation-algorithm.md)).
- One impulsive maneuver in the RSW frame, with escape and surface-intersection warnings
  (ML-FR-005, ML-FR-006).
- Interactive 3D view, timeline and playback (ML-FR-007, ML-FR-008).
- Plots of 13 quantities and a coast-versus-maneuver comparison table (ML-FR-009, ML-FR-010;
  [ADR-010](docs/architecture/adr/ADR-010-charting-library.md)).
- Versioned JSON scenario save and load, three example scenarios, CSV export (ML-FR-011,
  ML-FR-013, ML-FR-014).
- Model and assumptions panel with the not-qualified statement (ML-FR-012).
- Static web app deployed to GitHub Pages (ML-TASK-042, `.github/workflows/pages.yml`).
- Independent verification: reference datasets, an independent implementation, Orekit reference
  data and conformance runs 1 to 5 ([G1 report](docs/verification/G1-verification-report.md),
  [conformance run 5](docs/verification/conformance-run-5.md)).
- Documentation: [user guide](docs/user-guide.md), [developer guide](docs/developer-guide.md),
  [traceability matrix](docs/verification/traceability-matrix.md),
  [contributing](docs/engineering/contributing.md) and
  [coding standards](docs/engineering/coding-standards.md).

### Changed

- The analysis of the result (histories of every plotted quantity) runs in the simulation worker
  and is transferred to the page, not computed on the main thread (ML-TASK-044,
  [performance-envelope.md](docs/verification/performance-envelope.md) section 8).
- Unsaved-changes confirmation on closing or reloading the page; text and accessibility fixes from
  the [release-readiness review](docs/verification/release-readiness-review.md) (D-2, D-3, D-6, D-7,
  D-9).
- All packages and the `PACKAGE_VERSION` constants are set to `1.0.0` (previously `0.0.0`).

### Known limits

Accepted by the owner and listed in the [release notes](docs/releases/release-notes-v1.0.0.md)
section 3: [G1](docs/releases/G1-review.md), [G2](docs/releases/G2-review.md) and
[G3](docs/releases/G3-review.md) limits; D-4, D-5, D-8 and D-10 of the release-readiness review;
flight-path angle and mean anomaly histories are not provided.
