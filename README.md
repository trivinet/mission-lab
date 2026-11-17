# Mission Lab

An interactive, browser-based laboratory for exploring orbital mechanics and preliminary
spacecraft mission design: configure an orbit, simulate it, apply a maneuver, and analyse the
result.

**Status:** release M1 "Orbital Sandbox" (v1.0.0) is in preparation; gates G0 to G3 are approved
and Phase 4 (stabilisation and release) is in progress. The release notes are a draft. Live task
status: `docs/status/status.json`.

Mission Lab is a personal R&D project. It is **not qualified for operational use** and must not be
used for real spacecraft navigation or mission planning.

## Start here

| If you want to | Read |
|---|---|
| Use the application | [User guide](docs/user-guide.md) |
| Build, test and change it | [Developer guide](docs/developer-guide.md) |
| See which test backs which requirement | [Traceability matrix](docs/verification/traceability-matrix.md) |
| See what v1.0.0 contains (draft) | [Release notes](docs/releases/release-notes-v1.0.0.md) |

Quick start (Node 24.22.2 and pnpm 12.16.1, see the developer guide):

```
pnpm install --frozen-lockfile
pnpm --filter @mission-lab/web dev
```

## Documents

| Document | Purpose |
|---|---|
| [docs/product/ML-SYS-001.md](docs/product/ML-SYS-001.md) | Product and engineering specification |
| [docs/product/ML-SYS-001-review.md](docs/product/ML-SYS-001-review.md) | Consistency review and proposed amendments |
| [docs/architecture/legacy-assessment.md](docs/architecture/legacy-assessment.md) | Assessment of the earlier Satellite Viewer |
| [docs/architecture/proposed-architecture.md](docs/architecture/proposed-architecture.md) | Architecture, conventions and simulation contract |
| [docs/architecture/contracts-v1.md](docs/architecture/contracts-v1.md) | Simulation contracts v1.0 |
| [docs/architecture/adr/](docs/architecture/adr/) | Architecture Decision Records |
| [docs/requirements/m1-requirements.md](docs/requirements/m1-requirements.md) | M1 requirements and acceptance criteria |
| [docs/verification/m1-verification-plan.md](docs/verification/m1-verification-plan.md) | Verification plan |
| [docs/verification/tolerances.md](docs/verification/tolerances.md) | Tolerance record |
| [docs/engineering/contributing.md](docs/engineering/contributing.md) | Contributing |
| [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md) | Coding standards |
| [docs/backlog/backlog.md](docs/backlog/backlog.md) | Implementation backlog |
| [docs/releases/G0-review.md](docs/releases/G0-review.md), [G1](docs/releases/G1-review.md), [G2](docs/releases/G2-review.md), [G3](docs/releases/G3-review.md) | Gate review packages and decisions |
| [AGENTS.md](AGENTS.md) | Working rules for the AI engineering team |
