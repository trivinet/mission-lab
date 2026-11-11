# ML-SYS-001 v0.1 — Consistency Review

**Document ID:** ML-REV-001 · **Date:** 2026-11-11 · **Author:** Coordinator · **Status:** Approved at gate G0 (owner, 2026-11-11)

Scope: ML-SYS-001 v0.1 plus the accompanying narrative (architecture sketch, sample contract,
repository layout, agent organisation, master instructions). Each finding has a proposed
resolution; none is applied to the baseline until the owner approves it.

Severity: **A** = blocks implementation if unresolved · **B** = must be fixed in the baseline text ·
**C** = clarification / housekeeping.

## 1. Contradictions and gaps

| # | Sev | Finding | Proposed resolution |
|---|---|---|---|
| F-01 | A | **Legacy premise.** The plan builds Phase 0 around auditing Satellite Viewer (OD-001, R-001, ADR-001, "Baseline working application"), assuming it may be the foundation. The audit shows it shares no reusable code with Mission Lab. | Greenfield repository. See [legacy-assessment.md](../architecture/legacy-assessment.md) and ADR-001. R-001 is closed. |
| F-02 | A | **M0 vs Phase 0.** §2.1 (M0) includes testing framework, CI pipeline and a "baseline working application"; §12 Phase 0 and the master instructions forbid installing dependencies or implementing before the gate. The two are used as synonyms but have different contents. | Split M0 into **Phase 0a — Baseline** (documents only, ends at G0) and **Phase 0b — Scaffold** (repo tooling, CI, empty app shell; starts only after G0). |
| F-03 | A | **Sample contract violates §5.6.** `epoch: string` carries no declared time scale; each `TrajectorySample` repeats a full `CartesianState` with an epoch string and also `elapsedTime_s` (two sources of truth for time, and float round-off in string timestamps). | Epoch is an object `{ scale, iso }`. Samples carry `t_s` (elapsed seconds from the scenario epoch) only; frame/epoch/units are declared once per trajectory segment. See proposed-architecture §4. |
| F-04 | A | **Maneuver count.** M1 scope says "single instantaneous impulsive maneuver" and ML-FR-017 (multiple maneuvers) is LATER, yet the sample contract has `maneuvers: ImpulsiveManeuver[]` with no limit. | Keep the array in the schema (forward-compatible) and have the M1 validator reject length > 1 with an explicit diagnostic. The engine is written for an ordered list, so M2 only lifts the limit. |
| F-05 | A | **Conic scope undefined.** "Keplerian propagation" and the element list (semimajor axis…) do not say whether parabolic/hyperbolic orbits are in scope, nor what happens when a maneuver produces escape or an Earth-intersecting orbit. | M1 *inputs*: closed orbits only (0 ≤ e < 1, perigee radius above the Earth reference radius). M1 *propagator*: universal-variable formulation valid for all conics, so a post-maneuver hyperbola or sub-surface perigee is propagated and **flagged** in diagnostics, never silently accepted or crashed. Owner to confirm (decision D-4). |
| F-06 | A | **"Orbital parameter evolution" is degenerate in two-body dynamics.** Under §5.1 five of six classical elements are constant between maneuvers; ML-FR-009 as written would plot flat lines with one step. | ML-FR-009 covers time histories of quantities that do vary (radius, altitude, speed, true/mean anomaly, flight-path angle) **plus** element step changes across the maneuver. The flat element histories are retained on purpose as a visible check of conservation. |
| F-07 | B | **"Scenario comparison" is ambiguous.** §2.2 "Scenario comparison", ML-FR-010 "compare baseline and maneuver scenarios", and M3 "multi-scenario comparison" overlap. | M1 comparison = within one scenario, the *coast* run (no maneuver) versus the *maneuvered* run, over the same time span. Comparing arbitrary scenarios is M3. |
| F-08 | B | **Earth visualisation vs frame rigour.** §9.3 asks for a high-quality Earth; §5.2 only regulates Earth rotation "if introduced". A textured Earth must be oriented somehow, which implies a time/frame model the spec has not chosen. | M1 shows a rotating textured Earth using a single documented simplification (rotation about the inertial Z axis by Earth Rotation Angle with UT1 ≈ UTC), labelled as *illustrative orientation*. No authoritative output (no ground track, no lat/lon) is derived from it in M1. See ADR-004. |
| F-09 | B | **Module ↔ package mismatch.** §4.2 lists seven modules; the proposed tree has `astrodynamics`, `simulation`, `contracts`, `visualization`. Analysis Engine, Scenario Manager and Persistence Adapter have no home; the component diagram draws Storage below the physics core with a bidirectional arrow, which the text itself disclaims. | Explicit mapping in proposed-architecture §2, with one-directional dependencies. `packages/visualization` is deferred (folded into `apps/web`) until a second consumer exists. |
| F-10 | B | **Undefined contract types.** `ManeuverEvent`, `SimulationDiagnostics` are referenced but not defined; `requestId` appears in the result but not in the request; `modelVersion` has no definition. | Defined in proposed-architecture §4. |
| F-11 | B | **Independent review with a one-human team.** §10.1/§10.4 require protected `main` and "required review". GitHub cannot require an approving review from someone other than the PR author when the owner is the only human, and agent reviews are not GitHub approvals. | Protection = PR required + required CI status checks + no direct pushes. "Review" = recorded Verification/Architecture agent report in the PR, then owner merge. The owner's merge is the approval. |
| F-12 | B | **Tolerances.** §8.4 forbids inventing tolerances, and OD-009 asks to define them before implementation, but meaningful tolerances depend on the selected algorithm. | Tolerances are *derived* by the Verification Engineer from float64 error analysis before seeing implementation results, recorded with their justification, and approved by the owner at G1. The method is fixed now; the numbers are fixed in Phase 1. See verification plan §4. |
| F-13 | B | **Visual regression of a WebGL scene** (§8.1) is notoriously flaky across GPUs/CI runners. | Visual regression is limited to deterministic 2D layout screenshots; the 3D scene is verified through a non-visual scene-state test hook (object positions in scene units vs engine output). |
| F-14 | C | **Task ID format.** `TASK-014` (diagram) vs `ML-TASK-014` (YAML). | `ML-TASK-NNN` everywhere. |
| F-15 | C | **`AGENTS.md` vs execution environment.** The chosen environment (Claude Code) reads `CLAUDE.md` and `.claude/agents/*.md`. | `AGENTS.md` stays the tool-neutral source of truth; `CLAUDE.md` imports it. |
| F-16 | C | **Calendar.** §header and narrative §6 give a 6–8 week plan. | Superseded by owner instruction: no deadline; gates G0–G4 remain, weeks do not. |
| F-17 | C | **OD-006 timing.** "All open decisions shall be resolved before dependent implementation work" — the charting library (OD-006) explicitly requires representative testing, which cannot happen before Phase 3. | OD-006 is resolved by a time-boxed spike at the start of Phase 3. It blocks only plotting tasks. |
| F-18 | C | **RSW "along-track".** In RSW the S axis is perpendicular to R in the orbit plane; it coincides with the velocity direction only for circular orbits. Users often expect "along-track = prograde". | Document it in the UI help and the maneuver model; the VNC/NTW frame is a candidate for M2 ("alternative reference frames"). |

## 2. Unverified external claims in the narrative

The accompanying text asserts facts that were not checked by anyone in this project. They do not
affect Phase 0 decisions but must not be copied into documentation as facts:

- "GMAT R2026" capabilities — to be verified if/when GMAT is used as a reference source.
- React Three Fiber v10 being alpha, and React/R3F version pairing — to be verified when versions
  are pinned (ML-TASK-002).
- CCSDS Orbit Data Messages "corrections until June 2026" — to be verified when import/export is
  specified (M2).

## 3. Things the plan gets right and that are kept unchanged

Decoupled physics engine (ARCH-001/002/007); SI units and explicit frames; scenario / run / result
separation; verifier independence; artifact-based agent communication; "cut features, not rigour".
