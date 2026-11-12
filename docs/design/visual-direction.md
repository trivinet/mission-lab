# Visual direction, M1 workspace (proposed)

**Status:** Proposed (ML-TASK-020), pending owner approval. Mock-up:
[mockups/workspace.html](mockups/workspace.html). Tokens: [design-tokens.md](design-tokens.md).
All values in the mock-up are placeholders, not computed.

## Layout rationale

Desktop-first, one screen, three columns under a toolbar (ML-SYS-001 §9.1, §9.2: no page
navigation; edit, run and inspect in one workspace).

- **Left, scenario editor (A)**: scenario fields, Keplerian elements in km and deg, derived read-only
  quantities, the single maneuver (ML-FR-001, 002, 005). Inputs are inset and blue; derived values
  are flat, tagged "computed" (ML-FR-002 AC4). Field-level errors sit under the field, with an icon.
- **Centre, simulation view (B), timeline (C), plots (D)**: the 3D view is the largest region; the
  timeline sits directly beneath it so playback controls and the displayed time are adjacent
  (ML-FR-008). Plots below, with axis titles, units, legend and maneuver marker (ML-FR-009 AC2).
  Display options live under the viewport and carry the note that they never recompute
  (ML-FR-007 AC4). The Earth orientation is labelled illustrative (ML-FR-007 AC3, ADR-004).
- **Right, results**: diagnostics first (warnings and errors are never buried), then the
  coast-vs-maneuver table (ML-FR-010), then Model & assumptions rendered from the result
  (ML-FR-012) with the not-for-operational-use statement.
- **Toolbar (E)**: new, load, save, export, an unsaved-changes marker (ML-FR-011 AC4) and the result
  state chip with the Run button. The unsaved marker and the result state are two separate
  indicators on purpose (ML-SYS-001 §9.2).
- **Five result states (ML-UX-001, amended)**: none, computing, current, stale, error. Each has an
  icon, a label, and a banner over the centre column. Stale keeps old values visible but italic and
  muted (ML-UX-002). Computing leaves the UI interactive (ML-UX-003).
- **Keyboard (ML-UX-004)**: native controls only, DOM order follows the visual order (toolbar,
  editor, view, timeline, plots, results), one visible focus style. Verified only by inspection of
  the markup, see Not verified in the task report.

## Deliberately NOT decided

- Charting library (OD-006) and real plot styling; the SVGs are placeholders.
- Final 3D look: Earth texture, lighting, atmosphere, camera behaviour.
- Light theme, high-contrast theme, and colour-blind-specific palettes.
- Responsive/mobile layout beyond a single-column fallback; touch target sizes.
- Component library structure, Tailwind theme mapping, icon set (the mock-up uses Unicode glyphs).
- Exact copy, localisation, number-formatting rules (formatting module belongs to the engineering
  task; the mock-up shows thousands separators only illustratively).
- Delta-v display unit: the mock-up uses m/s per ML-FR-005; whether km/s is also offered is open.
- Collapse/resize behaviour of panels and persistence of layout.

## Choices for the owner

**1. Panel arrangement.**
- A (shown): editor left, results right, view and plots centre.
- B: editor left, view centre-large, results and plots in a tabbed bottom dock; more viewport,
  but hides results behind tabs.
- C: editor and results as tabs in one right sidebar; largest viewport, but inputs and results
  cannot be seen together.
- Recommendation: **A** for M1. Edit, run and compare stay visible at once, matching the
  one-workspace requirement; revisit when M2 adds panels.

**2. Accent colour.**
- Blue `#6aa9ff` (shown): conventional, strong contrast (7.87:1 on base), but shares the hue family
  with the editable-input text and the "computing" state.
- Teal/cyan: collides with the maneuvered-trajectory colour; not recommended.
- Violet (not computed in this task): separates accent from state colours but would need its own
  contrast check.
- Recommendation: **keep blue**, and rely on the existing icon and tag distinctions. If the owner
  prefers violet, a re-run of the contrast script is required first.

**3. Result-state presentation.**
- Banner plus chip (shown): unmissable, costs a row of vertical space.
- Chip only in the toolbar: compact, easier to overlook after an edit (risk against ML-UX-002).
- Recommendation: **banner plus chip**, banner only for stale, computing, error and none.
