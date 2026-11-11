# Mission Lab design tokens (proposed)

**Status:** Proposed (ML-TASK-020), pending owner approval. Not authority until approved. No Tailwind
configuration has been changed; these tokens are mirrored as CSS custom properties in
[mockups/workspace.html](mockups/workspace.html). Source requirements: ML-SYS-001 §9.3,
ML-UX-001, ML-UX-004.

Dark-first: there is no light theme in M1 (deliberately not decided, see
[visual-direction.md](visual-direction.md)).

## 1. Colour roles

| Role | Token | Hex | Use |
|---|---|---|---|
| Background, app | `--bg-base` | `#0d1117` | Page, 3D viewport |
| Background, panel | `--bg-panel` | `#151b23` | Panels |
| Background, raised | `--bg-raised` | `#1c242e` | Buttons, banners, table header |
| Background, input | `--bg-input` | `#0a0e13` | Editable fields only (inset, darker than the panel) |
| Border, decorative | `--border` | `#2f3b4a` | Panel outlines, dividers |
| Border, control | `--border-input` | `#5f7289` | Input and button outlines (UI component, 3:1 needed) |
| Text, primary | `--text` | `#e6edf3` | Body, computed values |
| Text, secondary | `--text-2` | `#a8b3c0` | Labels |
| Text, muted | `--text-3` | `#8c99a8` | Units, notes (still 4.5:1) |
| Accent | `--accent` | `#6aa9ff` | Primary action, selection |
| Editable input text | `--input-text` | `#9cc4ff` | Value inside an editable field |
| Focus ring | `--focus` | `#9cc4ff` | 2 px outline, 2 px offset, never removed |
| State: current | `--current` | `#4cc77a` | Result matches inputs |
| State: computing | `--computing` | `#6aa9ff` | Run in progress |
| State: stale | `--stale` | `#e0ad3c` | Inputs changed since the result |
| State: error | `--error` | `#ff7b72` | Failed run, invalid field |
| Diagnostic: warning | `--warning` | `#f0883e` | Non-fatal diagnostic (e.g. escape trajectory) |
| Trajectory: coast | `--coast` | `#a8b3c0` | Coast (no maneuver) run |
| Trajectory: maneuvered | `--maneuver` | `#3dd6c6` | Maneuvered run |
| Marker: maneuver | `--marker` | `#ffb454` | Maneuver point and plot marker |

Semantic rules:

- **Editable input vs computed output.** Inputs are inset dark fields with a visible 1 px
  `--border-input` outline, a trailing unit cell and accent-blue monospace text. Computed values have
  no field chrome, use `--text` in monospace, and sit under a "computed" tag. Distinction never
  relies on colour alone (shape and tag also differ).
- **Result state.** Each of the five states (none, computing, current, stale, error) has its own
  icon and label in addition to colour: none `○`, computing `◜` (spinning, static under
  `prefers-reduced-motion`), current `✓`, stale `◆`, error `✕`. Stale values stay visible but italic
  and secondary, with a banner (ML-UX-002).
- **Warning vs stale.** Both are amber-ish, so they differ by icon (`▲` warning, `◆` stale) and text.
- **Coast vs maneuvered.** Coast is dashed grey; maneuvered is solid teal. Style and legend text
  carry the meaning, colour reinforces it.
- Colour in the 3D view is never the only carrier of information (AGENTS quality bar).

## 2. Typography

System font stacks only (no web fonts, no external requests).

| Token | Value |
|---|---|
| `--font-ui` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--font-mono` | `ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace` (all numeric values) |

| Step | Size / line height | Use |
|---|---|---|
| `text-xs` | 11 / 16 px | Units, notes, tags |
| `text-sm` | 12 / 16 px | Panel headings (uppercase, tracked), chips |
| `text-base` | 13 / 19 px | Body, labels, values |
| `text-md` | 14 / 20 px | Brand, toolbar |
| `text-lg` | 16 / 24 px | Reserved (dialogs) |
| `text-xl` | 20 / 28 px | Reserved (empty states) |

Weights: 400 body, 600 headings and emphasis.

## 3. Spacing, radii, focus

- Spacing scale (px): 4, 8, 12, 16, 24 (`--s1`…`--s5`). Panel padding 12; panel gap 8.
- Radii: 2 (tags), 4 (controls), 8 (panels, chips).
- Minimum control height 28 px (desktop-first; touch sizing not decided).
- Focus: `outline: 2px solid var(--focus); outline-offset: 2px` on `:focus-visible` for every
  interactive element. Focus ring contrast is checked below.

## 4. Contrast

Method: WCAG 2.x relative luminance and contrast ratio,
https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio. Thresholds: 4.5:1 for text (SC 1.4.3), 3:1 for
non-text UI components, focus indicators and graphical objects (SC 1.4.11). The decorative panel
border has no threshold (1:1 is shown only for completeness). Backgrounds: base `#0d1117`, panel
`#151b23`, raised `#1c242e`, input `#0a0e13`.

Script (Node, no dependencies):

```js
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126*lin(n>>16&255) + 0.7152*lin(n>>8&255) + 0.0722*lin(n&255); };
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
```

Output (every pair checked, 45 rows, all PASS):

```text
role | hex | on | ratio | min | pass
text-primary | #e6edf3 | base #0d1117 | 16.02:1 | 4.5:1 | PASS
text-primary | #e6edf3 | panel #151b23 | 14.65:1 | 4.5:1 | PASS
text-primary | #e6edf3 | raised #1c242e | 13.25:1 | 4.5:1 | PASS
text-primary | #e6edf3 | input #0a0e13 | 16.38:1 | 4.5:1 | PASS
text-secondary | #a8b3c0 | base #0d1117 | 8.90:1 | 4.5:1 | PASS
text-secondary | #a8b3c0 | panel #151b23 | 8.14:1 | 4.5:1 | PASS
text-secondary | #a8b3c0 | raised #1c242e | 7.36:1 | 4.5:1 | PASS
text-muted | #8c99a8 | base #0d1117 | 6.52:1 | 4.5:1 | PASS
text-muted | #8c99a8 | panel #151b23 | 5.97:1 | 4.5:1 | PASS
text-muted | #8c99a8 | raised #1c242e | 5.40:1 | 4.5:1 | PASS
input-text (editable) | #9cc4ff | input #0a0e13 | 10.83:1 | 4.5:1 | PASS
output-text (computed) | #e6edf3 | panel #151b23 | 14.65:1 | 4.5:1 | PASS
output-text (computed) | #e6edf3 | raised #1c242e | 13.25:1 | 4.5:1 | PASS
accent | #6aa9ff | base #0d1117 | 7.87:1 | 4.5:1 | PASS
accent | #6aa9ff | panel #151b23 | 7.20:1 | 4.5:1 | PASS
accent | #6aa9ff | raised #1c242e | 6.51:1 | 4.5:1 | PASS
state-current | #4cc77a | base #0d1117 | 8.79:1 | 4.5:1 | PASS
state-current | #4cc77a | panel #151b23 | 8.04:1 | 4.5:1 | PASS
state-current | #4cc77a | raised #1c242e | 7.28:1 | 4.5:1 | PASS
state-computing | #6aa9ff | base #0d1117 | 7.87:1 | 4.5:1 | PASS
state-computing | #6aa9ff | panel #151b23 | 7.20:1 | 4.5:1 | PASS
state-computing | #6aa9ff | raised #1c242e | 6.51:1 | 4.5:1 | PASS
state-stale | #e0ad3c | base #0d1117 | 9.20:1 | 4.5:1 | PASS
state-stale | #e0ad3c | panel #151b23 | 8.42:1 | 4.5:1 | PASS
state-stale | #e0ad3c | raised #1c242e | 7.61:1 | 4.5:1 | PASS
state-error | #ff7b72 | base #0d1117 | 7.51:1 | 4.5:1 | PASS
state-error | #ff7b72 | panel #151b23 | 6.87:1 | 4.5:1 | PASS
state-error | #ff7b72 | raised #1c242e | 6.21:1 | 4.5:1 | PASS
state-warning | #f0883e | base #0d1117 | 7.48:1 | 4.5:1 | PASS
state-warning | #f0883e | panel #151b23 | 6.84:1 | 4.5:1 | PASS
state-warning | #f0883e | raised #1c242e | 6.19:1 | 4.5:1 | PASS
traj-coast | #a8b3c0 | base #0d1117 | 8.90:1 | 3:1 | PASS
traj-coast | #a8b3c0 | panel #151b23 | 8.14:1 | 3:1 | PASS
traj-maneuver | #3dd6c6 | base #0d1117 | 10.48:1 | 3:1 | PASS
traj-maneuver | #3dd6c6 | panel #151b23 | 9.59:1 | 3:1 | PASS
maneuver-marker | #ffb454 | base #0d1117 | 10.73:1 | 3:1 | PASS
maneuver-marker | #ffb454 | panel #151b23 | 9.82:1 | 3:1 | PASS
focus-ring | #9cc4ff | base #0d1117 | 10.59:1 | 3:1 | PASS
focus-ring | #9cc4ff | panel #151b23 | 9.69:1 | 3:1 | PASS
focus-ring | #9cc4ff | raised #1c242e | 8.76:1 | 3:1 | PASS
focus-ring | #9cc4ff | input #0a0e13 | 10.83:1 | 3:1 | PASS
border-input (UI component) | #5f7289 | panel #151b23 | 3.51:1 | 3:1 | PASS
border-input (UI component) | #5f7289 | raised #1c242e | 3.17:1 | 3:1 | PASS
border-panel (decorative) | #2f3b4a | base #0d1117 | 1.66:1 | 1:1 | PASS
border-panel (decorative) | #2f3b4a | panel #151b23 | 1.52:1 | 1:1 | PASS
```

Caveats: the `.primary` button uses `#0d1117` text on `#6aa9ff` (same pair as accent on base, 7.87:1).
The mock-up banner background `#2a2110` and the mock-up control bar are not product tokens. The
dimming applied to the viewport in non-current states (opacity .45 to .8) lowers contrast and was
not measured; if kept, it must be re-checked. Colour-blind simulation was not performed; the design
relies on paired icons, labels and dash styles instead.
