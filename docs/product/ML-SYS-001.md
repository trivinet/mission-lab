# MISSION LAB
## Preliminary Product & Engineering Specification

**Document ID:** ML-SYS-001
**Version:** 0.3 — v0.2 with the Appendix A amendments folded into the body (see Change Log)
**Status:** Proposed (v0.3), pending owner review. v0.2 was the approved baseline (owner, 2026-11-11). Appendix A is a traceability table for the folded amendments.
**Project owner:** Human Product Owner & Technical Lead
**Project type:** Personal R&D / Web Application
**Primary language:** English for technical specifications and code
**Target:** No fixed deadline. The original "6–8 weeks" target is orientative only (owner instruction, 2026-11-11).

> Review findings and proposed amendments to this version are tracked in
> [ML-SYS-001-review.md](ML-SYS-001-review.md). This file is not edited except through an
> owner-approved version bump.

# Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-11 | Preliminary specification, as received. |
| 0.2 | 2026-11-11 | Approved at gate G0. Appendix A added: review amendments F-01 to F-18 and roadmap additions A.2. |
| 0.3 | 2026-11-11 | Appendix A amendments folded into the body text, with no intended change of meaning. Appendix A replaced by a traceability table. Proposed, pending owner review. |

---

# 1. Project Definition

## 1.1 Purpose

Mission Lab is an interactive web-based orbital mechanics laboratory designed for experimentation, visualization and preliminary spacecraft mission analysis.

The application shall enable users to configure orbital scenarios, define spacecraft and maneuver parameters, execute simulations and explore the resulting trajectories and performance indicators through an intuitive graphical interface.

The project emphasizes:

- Physical and numerical correctness.
- Interactive experimentation.
- High-quality 2D/3D visualization.
- Reproducible simulation results.
- Modularity and maintainability.
- Progressive scientific capability.
- Professional software engineering practices.

Commercialization is not a requirement for the initial development phase.

## 1.2 Target Users

**Primary:** Aerospace engineering students, enthusiasts and the project owner.

**Secondary:** University instructors, researchers and engineers interested in accessible preliminary mission analysis.

**Future potential:** Small space engineering teams, educational institutions and technical communities.

The initial product shall not be represented as flight-qualified or operational mission-planning software.

## 1.3 Product Philosophy

Mission Lab shall provide a consistent workflow:

**Configure → Simulate → Visualize → Analyze → Compare**

The user shall be able to understand which physical models are active, which assumptions have been made and how simulation outputs relate to the configured inputs.

Visual fidelity shall not take precedence over numerical correctness.

## 1.4 Success Definition

The first release will be considered successful when a user can:

1. Configure an initial Earth orbit.
2. Visualize that orbit in an interactive 3D environment.
3. Propagate the spacecraft over a selected duration.
4. Apply at least one impulsive maneuver.
5. Compare the trajectory before and after the maneuver.
6. Inspect relevant orbital parameters and maneuver metrics.
7. Save and reload a complete scenario.
8. Reproduce the same results from identical inputs.

The application shall also pass the agreed numerical verification tests.

---

# 2. Scope and Product Roadmap

## 2.1 Release M0 — Engineering Foundation

**Objective:** Establish a reliable development environment and evaluate reusable legacy code.

Deliverables:

- Existing repository assessment.
- Architecture proposal and approved decisions.
- Dependency and security assessment.
- Coding standards.
- Testing framework.
- CI pipeline.
- Documentation structure.
- Initial backlog.
- Baseline working application, delivered in two parts: Phase 0a (documents only, ends at G0) and Phase 0b (repository tooling, CI and an empty application shell, starts after G0). See §12.

M0 must be completed before substantial new feature development.

## 2.2 Release M1 — Orbital Sandbox

**Objective:** Deliver the first complete, interactive orbital maneuvering experience.

Functional scope:

- Earth-centered orbital scenarios.
- Configurable initial epoch.
- Keplerian initial conditions, restricted to closed orbits as input (0 ≤ e < 1, perigee radius above the Earth reference radius).
- Conversion between Keplerian and Cartesian states.
- Keplerian two-body propagation with a universal-variable formulation valid for all conic sections. Escape and surface-intersection trajectories that result from a maneuver are propagated, displayed and flagged in diagnostics, never silently accepted or crashed.
- Single instantaneous impulsive maneuver. The maneuver list is an ordered list in the contract; the M1 validator rejects more than one maneuver with an explicit diagnostic.
- Maneuver components in the local RSW frame.
- Interactive 3D visualization.
- Playback and timeline control.
- Initial and resulting orbit visualization.
- Orbital parameter evolution: time histories of quantities that vary between maneuvers (radius, altitude, speed, true and mean anomaly, flight-path angle), plus element step changes across each maneuver. Elements that are constant between maneuvers are plotted as flat histories on purpose, as a visible conservation check.
- Maneuver delta-v display.
- Scenario comparison within one scenario: the coast run (no maneuver) against the maneuvered run, over the same time span. Comparing arbitrary scenarios is M3.
- Save/load using versioned JSON files.
- Explicit model and assumption metadata.

The initial maneuver implementation shall apply a velocity increment at a specified simulation epoch. It shall not be modeled as continuous thrust.

Nonfunctional scope:

- Deterministic simulation results.
- Input validation and meaningful error reporting.
- Numerical regression tests.
- Responsive desktop-first interface.
- Browser-based computation without a mandatory backend.
- Clear separation between simulation and visualization.
- Reproducible development and build processes.

## 2.3 Release M2 — Advanced Orbital Dynamics

Candidate capabilities:

- Numerical integration with configurable tolerances.
- J2 gravitational perturbation.
- Multiple sequential maneuvers.
- Spacecraft mass and propulsion parameters.
- Optional finite-duration thrust.
- Alternative reference frames (a VNC/NTW maneuver frame is a candidate).
- Ground tracks and geographic visualization.
- Enhanced plots and trajectory analysis.
- Import/export of selected orbital data formats.
- Parabolic and hyperbolic initial orbits as direct inputs.
- Impact handling as a simulation event (stop condition, impact point), once an Earth-fixed frame exists.

Features shall be implemented incrementally, with separate requirements and verification cases.

## 2.4 Release M3 — Mission Design Tools

Candidate capabilities:

- Hohmann and bi-elliptic transfer analysis.
- Inclination-change analysis.
- Maneuver planning tools.
- Target-orbit specification.
- Basic maneuver optimization.
- Design parameter sweeps.
- Sensitivity studies.
- Multi-scenario comparison.
- Mission performance reports.

## 2.5 Release M4 — Extended Mission Analysis

Long-term research directions:

- Low-thrust trajectory design.
- Gauss Variational Equations.
- Multi-spacecraft scenarios.
- Constellation analysis.
- Visibility and ground-station geometry.
- Perturbed orbital environments.
- Restricted three-body dynamics.
- Cislunar mission design.
- Import/export interoperability.
- Automated optimization.
- Other central bodies and multi-planetary scenarios.
- Interplanetary transfers (patched conics, Lambert targeting) and deep-space trajectories.
- Launch and ascent to orbit.
- Descent and landing.

These are exploratory directions, not commitments for the initial releases.

---

# 3. Architectural Principles

The following principles are mandatory unless an approved Architecture Decision Record explicitly documents an exception.

**ARCH-001 — Separation of concerns**

Orbital mechanics calculations shall be independent of UI and visualization frameworks.

**ARCH-002 — Single source of physical truth**

The simulation engine produces authoritative physical states. The visualization layer shall never independently calculate authoritative trajectories.

**ARCH-003 — Explicit units**

All public interfaces carrying physical quantities shall document their units. The internal canonical system shall use SI units unless explicitly approved otherwise.

**ARCH-004 — Explicit reference frames**

All state vectors shall be associated with a declared reference frame, central body and epoch.

**ARCH-005 — Reproducibility**

Identical simulation inputs and model configurations shall produce repeatable outputs within established numerical tolerances.

**ARCH-006 — Versioned interfaces**

Serialized scenarios and public simulation interfaces shall include version metadata where appropriate.

**ARCH-007 — Testability**

The physics engine shall support automated execution without the browser or 3D renderer.

**ARCH-008 — Extensibility**

New physical models and propagation strategies shall be integrated through defined interfaces, not by modifying unrelated UI components.

**ARCH-009 — Minimal infrastructure**

Backend services, authentication and databases shall not be introduced until justified by an approved use case.

**ARCH-010 — Human-controlled changes**

No AI agent may unilaterally change product scope, approved architecture, scientific assumptions or deployment policy.

**Roadmap consequence (effective now)**

No M1 interface may assume Earth, a closed orbit or a single central body, except through explicit, versioned fields: `centralBody`, `mu_m3ps2`, `frame`, `dynamicsModel` and `propagator`.

Launch and landing need atmosphere, thrust and Earth-fixed frames. They will require a force-model interface and numerical propagation, and are not reachable by extending the analytical M1 propagator (see §2.5).

---

# 4. Proposed Software Architecture

## 4.1 Technology Baseline (Proposed)

**Frontend:** React + TypeScript.

**Application framework:** Retain the existing framework if its assessment supports continued use; otherwise evaluate Next.js versus a simpler React/Vite application.

**3D rendering:** Three.js, potentially through React Three Fiber.

**UI styling:** Tailwind CSS and a consistent reusable component system.

**Charts:** A performant React-compatible plotting library, selected after representative visualization tests.

**Simulation engine:** Standalone TypeScript package with no dependency on the frontend.

**Background computation:** Web Workers for calculations that would otherwise block the main UI thread.

**Data persistence M1:** Versioned JSON import/export and optional browser-local persistence.

**Backend M1:** Not required.

**Testing:** Unit, integration, end-to-end and numerical reference tests.

**CI/CD:** GitHub Actions and preview deployments.

Specific library versions must be reviewed, selected and pinned during M0.

## 4.2 Functional Modules

The module-to-package mapping is defined in proposed-architecture §2 (docs/architecture/proposed-architecture.md). Dependencies between modules are one-directional. The separate `packages/visualization` package is deferred until a second consumer exists; until then the Visualization Engine lives in `apps/web`.

### A. Scenario Manager

Responsibilities:

- Create and edit simulation scenarios.
- Validate user-provided inputs.
- Manage spacecraft and maneuver definitions.
- Maintain scenario revisions.
- Serialize and deserialize configurations.
- Request simulation execution.

### B. Astrodynamics Core

Responsibilities:

- Physical constants and numerical utilities.
- Orbital element/state conversion.
- Reference frame utilities.
- Keplerian propagation.
- Numerical propagation when introduced.
- Maneuver application.
- Derived orbital parameters.
- Physical and numerical validation.

It shall not reference React, Three.js or browser-specific APIs.

### C. Simulation Controller

Responsibilities:

- Receive simulation requests.
- Validate configuration compatibility.
- Execute or delegate calculations.
- Manage calculation status.
- Support cancellation where applicable.
- Return immutable simulation results.
- Associate outputs with configuration identifiers.

### D. Visualization Engine

Responsibilities:

- Display central body, spacecraft and trajectories.
- Transform physical coordinates into scene coordinates.
- Interpolate between calculated states for smooth playback.
- Control camera, focus, zoom and visibility.
- Render selected orbital geometry and indicators.

It shall not modify authoritative physical states.

### E. Analysis Engine

Responsibilities:

- Compute derived metrics.
- Compare scenarios.
- Generate orbital parameter time histories.
- Prepare plotting datasets.
- Evaluate maneuver performance.

### F. User Interface

Responsibilities:

- Scenario configuration.
- Parameter editing.
- Simulation execution.
- Timeline and playback controls.
- Plot interaction.
- Visibility and camera controls.
- Error presentation and documentation access.

### G. Persistence Adapter

Responsibilities:

- Save/load scenario files.
- Validate schema versions.
- Migrate supported historical schemas.
- Preserve metadata required for reproducibility.

A remote persistence implementation may be introduced later without changing the domain model.

---

# 5. Scientific and Numerical Baseline

## 5.1 Initial Dynamics

M1 shall use the point-mass, two-body gravitational model:

d²r/dt² = -μr/|r|³

where:

- r is the spacecraft position vector relative to the central body.
- μ is the central body's gravitational parameter.
- t is the simulation time.

The initial baseline shall be Earth-centered.

The model shall explicitly exclude J2, atmospheric drag, third-body gravity, solar radiation pressure and thrust between impulsive maneuvers.

## 5.2 Reference Frames

M1 shall use a clearly documented Earth-centered inertial frame for its idealized two-body dynamics.

The chosen frame convention shall be defined precisely before implementation. The system shall not casually treat TEME, ECI, GCRF, EME2000 and Earth-fixed coordinates as interchangeable.

The UI shall distinguish orbital geometry from Earth-surface visualization.

M1 may show a rotating, textured Earth using one documented simplification: rotation about the inertial Z axis by the Earth Rotation Angle, with UT1 approximated by UTC. This orientation is illustrative and shall be labelled as such. M1 derives no authoritative output from it: no ground track and no latitude or longitude (see ADR-004).

Earth rotation and ground-track calculations, if introduced, must use documented time and frame conventions.

## 5.3 Orbital Elements

The initial interface shall support:

- Semimajor axis.
- Eccentricity.
- Inclination.
- Right ascension of ascending node.
- Argument of periapsis.
- True anomaly.

The application shall validate physically meaningful input ranges and identify degenerate element configurations.

M1 accepts closed orbits only as initial input (0 ≤ e < 1, perigee radius above the Earth reference radius). Parabolic and hyperbolic initial orbits are M2 candidates (§2.3).

For circular and equatorial orbits, the product shall document the ambiguity of classical orbital elements and either use a defined convention or provide an alternative state representation.

## 5.4 Impulsive Maneuvers

M1 shall represent an impulsive maneuver as an instantaneous change in inertial velocity at a defined epoch.

The maneuver input shall support radial, along-track and cross-track components in a documented RSW convention. In RSW the along-track axis S lies in the orbit plane, perpendicular to R. It coincides with the velocity direction only for circular orbits, so along-track is not always prograde. The UI help and the maneuver model documentation shall state this. A VNC/NTW frame is an M2 candidate (§2.3).

The local maneuver vector shall be transformed into the selected inertial frame at the maneuver epoch.

Position shall remain continuous across the instantaneous maneuver, while velocity changes discontinuously.

The maneuver list is ordered. The M1 validator shall reject a list with more than one maneuver, with an explicit diagnostic. M2 lifts this limit (ML-FR-017).

## 5.5 Propagation and Sampling

The authoritative propagation method shall be selected during M0/M1 and independently verified.

An analytical Keplerian propagator is the preferred M1 baseline.

Trajectory samples shall be produced at configurable times. Rendering frame rate shall not determine numerical integration accuracy or propagation step size.

Maneuver discontinuities shall be preserved in the result model.

Trajectory samples carry `t_s` only: elapsed seconds from the scenario epoch. The M1 propagator uses a universal-variable formulation valid for all conic sections (ADR-005). Post-maneuver escape and surface-intersection trajectories are propagated and flagged in diagnostics, never silently accepted or crashed.

## 5.6 Time and Units

Internal physical calculations shall use seconds, metres, kilograms and radians.

Displayed values may use kilometres, kilometres per second and degrees.

Epochs shall use an explicitly declared time scale. An epoch is an object `{ scale, iso }`, not a bare string. Conversion between civil UTC timestamps and simulation time shall be centralized.

Every externally supplied state shall include a reference frame and epoch. Frame, epoch and units are declared once per trajectory segment, not repeated for each sample.

## 5.7 Model Limitations

Every simulation output shall identify:

- Selected dynamics model.
- Central body and constants.
- Propagator.
- Maneuver model.
- Reference frame.
- Time convention.
- Calculation configuration.
- Model limitations.

Each result also carries `requestId`, a deterministic hash of the physical inputs that is present in both the request and the result; `ManeuverEvent` records; and `SimulationDiagnostics`, as defined in proposed-architecture §4.

No result shall be presented as suitable for operational spacecraft navigation without appropriate independent qualification.

---

# 6. Preliminary Functional Requirements

All requirements shall receive permanent identifiers and traceability links.

| ID | Requirement | Priority |
|---|---|---|
| ML-FR-001 | Create a new orbital scenario | MUST |
| ML-FR-002 | Configure and validate Keplerian elements (closed orbits only as input in M1) | MUST |
| ML-FR-003 | Convert Keplerian elements to Cartesian states | MUST |
| ML-FR-004 | Propagate an orbit with the two-body model | MUST |
| ML-FR-005 | Configure an impulsive RSW maneuver | MUST |
| ML-FR-006 | Execute maneuver propagation | MUST |
| ML-FR-007 | Display orbital trajectories in 3D | MUST |
| ML-FR-008 | Control simulation playback | MUST |
| ML-FR-009 | Visualize time histories of varying orbital quantities and element step changes across maneuvers; element histories that are flat between maneuvers are retained as a conservation check | MUST |
| ML-FR-010 | Compare the coast run and the maneuvered run of one scenario over the same time span | MUST |
| ML-FR-011 | Save and load scenario configurations | MUST |
| ML-FR-012 | Display active physical models and assumptions | MUST |
| ML-FR-013 | Provide predefined example scenarios | SHOULD |
| ML-FR-014 | Export simulation results as CSV | SHOULD |
| ML-FR-015 | Support numerical propagation | LATER |
| ML-FR-016 | Support J2 perturbations | LATER |
| ML-FR-017 | Support multiple maneuvers | LATER |
| ML-FR-018 | Support low-thrust maneuvers | LATER |
| ML-FR-019 | Support mission optimization | FUTURE |
| ML-FR-020 | Support multi-spacecraft simulations | FUTURE |

Priority definitions:

- MUST: mandatory for the agreed release.
- SHOULD: valuable, but removable if time or quality is threatened.
- LATER: deferred to an identified future release.
- FUTURE: research direction without committed scope.

These requirements are preliminary. Their acceptance criteria shall be detailed before implementation.

---

# 7. Nonfunctional Requirements

## Performance

- The interface shall remain responsive during supported simulations.
- Expensive calculations shall be isolated from the rendering loop.
- Supported scenario sizes and performance budgets shall be measured during M1.

## Reliability

- Invalid inputs shall not cause silent failures.
- Failed simulations shall return meaningful diagnostics.
- Numerical outputs shall reject non-finite or physically invalid results.

## Maintainability

- Modules shall have clearly defined interfaces.
- Dependencies shall follow the approved architecture.
- New code shall include relevant automated tests.
- Public scientific functions shall be documented.

## Security

- Dependencies shall be assessed for known vulnerabilities.
- Secrets shall never be committed.
- Imported scenarios shall be validated before processing.
- Computational resource limits shall prevent unreasonable user inputs.

## Usability

- Key physical parameters shall have descriptions and units.
- Users shall be able to distinguish editable inputs from computed outputs.
- Results shall remain comprehensible without interacting with the 3D scene alone.
- Keyboard and responsive layout considerations shall be included in UI reviews.

## Reproducibility

- Scenario configuration shall contain sufficient information to reconstruct calculations.
- Model versions shall be retained with results when required.
- Automated reference cases shall run in CI.

---

# 8. Verification and Validation Strategy

## 8.1 Verification Levels

**Unit tests:** Mathematical utilities, vector operations, conversions, time handling and maneuver transformations.

**Integration tests:** Scenario execution, simulation results, serialization and interaction between modules.

**Numerical reference tests:** Compare outputs against analytical solutions or independently generated reference datasets.

**End-to-end tests:** Confirm that a user can configure, run, inspect and save a scenario.

**Visual regression tests:** Limited to deterministic 2D layout screenshots. The 3D scene is verified through a non-visual scene-state test hook that compares object positions in scene units with engine output.

## 8.2 Mandatory Numerical Test Families

- Circular and elliptical orbit propagation.
- Orbital element to Cartesian conversion and round-trip consistency.
- Two-body specific mechanical energy conservation.
- Two-body angular momentum conservation.
- Propagation over complete orbital periods.
- Zero-magnitude maneuver equivalence.
- Impulsive velocity change correctness.
- RSW basis orthogonality and orientation.
- Maneuver frame transformation correctness.
- Degenerate orbital element cases.
- Scenario serialization round-trip.

## 8.3 Independent Reference Sources

Reference solutions may be generated using analytical astrodynamics calculations and independently established software such as GMAT or Orekit.

Reference datasets must record input configuration, model assumptions, tool version, output quantities and numerical tolerance.

A reference comparison is only valid when dynamics, constants, frames, epochs and time conventions are sufficiently equivalent.

## 8.4 Acceptance Policy

Every scientific requirement shall have explicit pass/fail criteria.

Numerical tolerances shall be justified according to the algorithm, floating-point precision, duration and reference model. Tolerances are derived by the Verification Engineer from a float64 error analysis, before implementation results are examined. Each tolerance is recorded with its justification and approved by the owner at G1. The derivation method is fixed in this version; the numerical values are fixed in Phase 1.

No fixed numerical tolerance shall be invented solely to make an implementation pass.

A simulation shall not be accepted because its 3D representation appears physically plausible.

---

# 9. UI / UX Requirements

## 9.1 Main Workspace

The principal interface shall consist of:

**A. Scenario Explorer:** spacecraft, initial state, maneuvers and configuration.

**B. Simulation View:** interactive Earth and trajectory visualization.

**C. Timeline:** simulation time, playback, maneuver events and inspection.

**D. Analysis Panel:** orbital parameters, maneuver metrics and time-series plots.

**E. Workspace Toolbar:** create, run, compare, save, load and display settings.

## 9.2 Interaction Design

The application shall minimize unnecessary navigation between pages.

Users should be able to modify scenario parameters, execute a calculation and inspect the result within the same workspace.

Physical changes shall trigger new authoritative calculations. Purely visual changes shall not unnecessarily recompute trajectories.

The UI shall distinguish unsaved configurations, stale simulation results, active calculations and completed results.

## 9.3 Visual Identity

- Dark-first technical workspace.
- High-quality Earth and trajectory visualization.
- Restrained colors with semantic meaning.
- Clear scientific typography.
- Consistent units, labels and legends.
- Informative plots rather than decorative charts.
- Smooth camera movement and time navigation.

Visual polish is a product requirement, but not justification for weakening scientific verification.

---

# 10. Engineering Process

## 10.1 Source Control

- Git repository as the source of truth.
- Protected `main` branch: pull request required, required CI status checks, no direct pushes. Agent reviews are recorded in the pull request (see §10.4); the owner's merge is the approval.
- Short-lived feature branches.
- Pull requests for integration.
- Descriptive commit history.
- Versioned release tags.

## 10.2 Work Item Structure

Each implementation task shall include:

- Unique task ID in the form `ML-TASK-NNN`.
- Parent requirement or issue.
- Objective.
- Scope and exclusions.
- Affected modules.
- Dependencies.
- Acceptance criteria.
- Test requirements.
- Expected deliverables.
- Assigned agent role.

## 10.3 Definition of Ready

A task is ready when:

- Its purpose is understood.
- Relevant requirements exist.
- Interfaces and assumptions are clear.
- Dependencies are identified.
- Acceptance criteria are testable.
- The scope is sufficiently limited.

## 10.4 Definition of Done

A task is complete when:

- The implementation meets its acceptance criteria.
- Applicable tests pass.
- Existing tests remain passing.
- The code follows architectural constraints.
- Documentation has been updated.
- The pull request includes a summary and verification evidence.
- Required review has been completed: a Verification or Architecture agent report is recorded in the pull request, and the owner merges (the merge is the approval).
- The human owner approves integration where required.

## 10.5 Architectural Decision Records

Important decisions shall be documented using:

- Context.
- Considered options.
- Decision.
- Rationale.
- Consequences.
- Status.

Agents may propose architectural decisions, but only the human owner may approve architectural changes that affect the baseline.

---

# 11. AI Development Organization

## 11.1 Human Product Owner / Technical Lead

Authority:

- Establish product vision.
- Approve scope.
- Approve architectural baseline.
- Prioritize development.
- Resolve major trade-offs.
- Accept releases.
- Authorize deployment and external actions.

## 11.2 Coordinator Agent

Responsibilities:

- Read the approved specification.
- Evaluate dependencies.
- Decompose approved work.
- Prepare task assignments.
- Coordinate specialized agents.
- Track progress and blockers.
- Prepare integration summaries.

The Coordinator shall not invent new requirements or silently change product priorities.

## 11.3 Systems & Architecture Agent

Responsibilities:

- Refine requirements.
- Define component interfaces.
- Evaluate technical trade-offs.
- Maintain architecture documentation.
- Propose ADRs.
- Perform architectural reviews.

## 11.4 Astrodynamics Agent

Responsibilities:

- Implement orbital mechanics functionality.
- Document equations and conventions.
- Provide numerical test scenarios.
- Explain model limitations.
- Identify physical or numerical edge cases.

## 11.5 Frontend & Visualization Agent

Responsibilities:

- Implement UI components.
- Develop 3D scene interaction.
- Maintain consistent visual patterns.
- Connect the visualization layer to approved simulation interfaces.
- Address usability and rendering performance.

## 11.6 Verification Agent

Responsibilities:

- Derive test cases from requirements.
- Execute independent checks.
- Review scientific assumptions.
- Report failures and regressions.
- Verify acceptance criteria.

The Verification Agent should avoid using the implementation under test as its sole independent reference.

## 11.7 Documentation & Release Agent

Responsibilities:

- Maintain user and developer documentation.
- Update traceability links.
- Compile release notes.
- Prepare release checklists.
- Identify documentation inconsistencies.

## 11.8 Coordination Rules

- Agents receive bounded tasks.
- Agents must communicate through persisted artifacts or recorded task reports.
- Concurrent changes to the same files require explicit coordination.
- Shared interfaces must be agreed before parallel implementation.
- Agents must report uncertainty and blockers.
- No agent may suppress failed tests or bypass validation.
- No agent may commit secrets or confidential third-party material.
- External services and code must comply with applicable licensing.
- Human approval is required for scope changes, major architectural changes and production releases.
- `AGENTS.md` is the tool-neutral source of agent instructions. `CLAUDE.md` imports it.

---

# 12. Preliminary Delivery Phases

Phases are gated, not time-boxed. Gates G0 to G4 remain. No calendar duration is specified (owner instruction, 2026-11-11).

## Phase 0a — Baseline (documents only; ends at G0)

Deliverables:

- Repository audit.
- Existing functionality inventory.
- Code reuse assessment.
- Technical risks.
- Initial approved architecture.
- Requirements baseline.

**Exit gate (G0):** human approval of proposed architecture and M1 scope.

## Phase 0b — Scaffold (starts only after G0)

Deliverables:

- Repository tooling, CI pipeline and an empty application shell.
- Development environment.

Exit gate: not defined in this version.

## Phase 1 — Astrodynamics Foundation

Deliverables:

- Constants and units.
- State and orbital element models.
- Conversion functions.
- Two-body propagator.
- Impulsive maneuver model.
- Numerical verification suite.

**Exit gate:** scientific reference tests pass.

## Phase 2 — Interactive Workspace

Deliverables:

- 3D Earth and trajectories.
- Scenario editor.
- Simulation controls.
- Timeline.
- Results inspection.

**Exit gate:** an end-to-end orbital scenario is usable through the UI.

## Phase 3 — Analysis and Comparison

Deliverables:

- Time-boxed charting-library spike at the start of the phase (resolves OD-006).
- Orbital parameter plots.
- Pre/post-maneuver comparison.
- Maneuver metrics.
- Scenario import/export.
- Preset scenarios.

**Exit gate:** complete user acceptance scenario passes.

## Phase 4 — Stabilization and First Release

Deliverables:

- Regression verification.
- Performance assessment.
- UI refinements.
- Error handling.
- Documentation.
- Versioned release.

**Exit gate:** human acceptance of M1 and release checklist.

---

# 13. Risks and Open Decisions

## Key Risks

**R-001:** Legacy architecture may not support the proposed separation of concerns. *Closed: greenfield repository (ADR-001).*

**R-002:** Reference frame or time conventions may be implemented inconsistently.

**R-003:** Visualization may appear correct while physical states are incorrect.

**R-004:** Scope expansion may threaten delivery of M1.

**R-005:** Concurrent agent changes may introduce integration conflicts.

**R-006:** Technology selection may create unnecessary infrastructure complexity.

**R-007:** Incomplete numerical reference cases may result in undetected errors.

**R-008:** Excessive documentation overhead may reduce practical development progress.

## Open Decisions

**OD-001:** Reuse or replace the existing Satellite Viewer codebase. *Resolved: greenfield repository (ADR-001).*

**OD-002:** Confirm the final frontend framework and visualization stack.

**OD-003:** Define the exact inertial reference frame convention.

**OD-004:** Select the M1 Keplerian propagation algorithm.

**OD-005:** Select canonical time representations and conversion rules.

**OD-006:** Choose the charting library after representative testing. *Resolved by a time-boxed spike at the start of Phase 3; blocks only plotting tasks.*

**OD-007:** Determine whether M1 requires any browser-local database beyond JSON files.

**OD-008:** Select the AI agent execution and orchestration environment.

**OD-009:** Define release acceptance tolerances and reference datasets. *Method fixed in §8.4; numerical values approved by the owner at G1.*

All open decisions shall be resolved before dependent implementation work begins, except OD-006, which is resolved as stated above.

---

# 14. Release Acceptance Scenario

The reference demonstration for M1 shall be:

1. Create an Earth-centered elliptical or circular orbit.
2. Inspect its orbital elements.
3. Propagate the orbit for a selected duration.
4. Visualize the unmodified trajectory.
5. Define an impulsive RSW maneuver.
6. Execute the maneuver.
7. Visualize the resulting trajectory and maneuver location.
8. Inspect changes in orbital parameters.
9. Compare both simulations.
10. Save the scenario to a versioned JSON file.
11. Reload the scenario.
12. Confirm reproducibility of the result.
13. Inspect the recorded physical model, reference frame and calculation metadata.

The release shall not be accepted unless the corresponding numerical verification suite passes.

---

# 15. Long-Term Vision

Mission Lab may progressively become a comprehensive environment for interactive aerospace engineering experimentation.

Long-term capabilities may include mission optimization, low-thrust trajectories, multi-spacecraft dynamics, constellations, coverage analysis and educational experiences.

These extensions shall preserve a consistent architecture and scientific foundation.

**The guiding principle is to build a tool that remains enjoyable to explore, trustworthy to learn from and maintainable as its capabilities expand.**

---

# Appendix A — Traceability of v0.2 amendments (folded in v0.3)

The amendments approved at gate G0 are folded into the body of this document in v0.3. Each row
maps one item to the section(s) where it now lives. The original v0.2 wording of Appendix A is
recoverable from git history: `git show 644b1af:docs/product/ML-SYS-001.md`. The review findings
and their resolutions remain in [ML-SYS-001-review.md](ML-SYS-001-review.md).

| Item | Amendment (short form) | Where it now lives (v0.3) |
|---|---|---|
| F-01 | Greenfield repository; R-001 closed | §13 Key Risks (R-001); §13 Open Decisions (OD-001) |
| F-02 | Phase 0a Baseline (documents) and Phase 0b Scaffold (after G0) | §2.1 (M0); §12 Phase 0a and Phase 0b |
| F-03 | Epoch as `{ scale, iso }`; samples carry `t_s`; frame, epoch and units declared once per segment | §5.5; §5.6 |
| F-04 | Ordered maneuver list; M1 validator rejects more than one maneuver | §2.2 (single impulsive maneuver); §5.4 |
| F-05 | Closed-orbit inputs only; universal-variable propagator; escape and surface-intersection results flagged | §2.2 (Keplerian initial conditions; propagation); §5.3; §5.5; §6 ML-FR-002 |
| F-06 | ML-FR-009 covers varying quantities and element step changes; flat element histories kept | §2.2 (orbital parameter evolution); §6 ML-FR-009 |
| F-07 | M1 comparison is coast run versus maneuvered run within one scenario; arbitrary comparison is M3 | §2.2 (scenario comparison); §6 ML-FR-010 |
| F-08 | Illustrative Earth orientation (Earth Rotation Angle, UT1 ≈ UTC); no authoritative Earth-fixed output in M1 | §5.2 |
| F-09 | Module-to-package mapping; one-directional dependencies; `packages/visualization` deferred | §4.2 (introductory paragraph) |
| F-10 | `requestId`, `ManeuverEvent` and `SimulationDiagnostics` defined by contract. Partial: `modelVersion` has no definition in proposed-architecture §4 and is not folded | §5.7 |
| F-11 | Protection is PR, required CI checks and no direct push; agent review recorded in PR; owner merge is approval | §10.1; §10.4 |
| F-12 | Tolerance derivation method fixed now; numerical values approved by owner at G1 | §8.4; §13 OD-009 |
| F-13 | Visual regression limited to 2D layout screenshots; 3D scene verified by scene-state hook | §8.1 |
| F-14 | Task identifier format `ML-TASK-NNN` | §10.2 |
| F-15 | `AGENTS.md` is the tool-neutral source; `CLAUDE.md` imports it | §11.8 |
| F-16 | No deadline; gates G0 to G4 remain; no week-based schedule | §12 (introduction) |
| F-17 | OD-006 resolved by a time-boxed spike at the start of Phase 3; blocks only plotting tasks | §12 Phase 3; §13 OD-006; §13 closing sentence |
| F-18 | RSW along-track is not always prograde; UI help and maneuver model state it; VNC/NTW is an M2 candidate | §5.4; §2.3 |
| A.2 M1 | Escape and surface-intersection trajectories from a maneuver are propagated, displayed and flagged; only initial orbit input is limited to closed orbits | §2.2; §5.3 |
| A.2 M2 | Parabolic and hyperbolic initial orbits as direct inputs | §2.3 |
| A.2 M2 | Impact handling as a simulation event, once an Earth-fixed frame exists | §2.3 |
| A.2 M4 | Other central bodies and multi-planetary scenarios | §2.5 |
| A.2 M4 | Interplanetary transfers and deep-space trajectories | §2.5 |
| A.2 M4 | Launch and ascent to orbit | §2.5 |
| A.2 M4 | Descent and landing | §2.5 |
| A.2 | Architectural consequence, effective now: no M1 interface assumes Earth, a closed orbit or a single central body except through explicit versioned fields | §3 (Roadmap consequence) |
