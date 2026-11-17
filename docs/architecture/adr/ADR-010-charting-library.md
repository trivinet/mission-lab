# ADR-010 — Charting library for the time-history and comparison plots

**Status:** Accepted by the owner on 2026-11-17 (uPlot 1.6.32, exact pin) · **Resolves:** OD-006 (ADR-006; ML-SYS-001 §9;
proposed-architecture §5) · **Task:** ML-TASK-030 · **Affects (if approved):** ML-TASK-032,
`apps/web/package.json`, `docs/architecture/tech-baseline.md` ·
**Evidence:** `spikes/charting/` (code, raw data, `results/`)

Note: the backlog line for ML-TASK-030 says "ADR-008"; that number is taken by the
degenerate-elements ADR, so this record is ADR-010.

## Context

ML-FR-009 needs time histories (radius, altitude, speed, true anomaly, classical elements) with
axis titles with units, a legend and a marker at the maneuver time, plotted from the analysis
module's numbers exactly (AC3, VI-03 plumbing, `Object.is`). ML-FR-010 AC1 needs the coast and the
maneuvered run overlaid with distinct, labelled styles. Playback drives a moving time cursor from
outside the chart. A maneuver splits a result into two segments (contracts v1), so the plotted
line must break at the maneuver instead of joining the two segments. The run limit is 1 000 000
samples with a soft UI warning above 250 000 (performance-envelope §4), and the app is a static
SPA with no network access beyond its own origin (ADR-006).

ADR-006 left the library open until a spike on representative data. This ADR records that spike.

## Method

- **Data:** real engine runs through `@mission-lab/simulation` (`runSimulation`): the product
  default scenario (6000 s at 60 s, 101 samples) and the same scenario with an impulsive
  200 m/s along-track maneuver (RSW `[0, 200, 0]`) at mid-span, each as a coast run and a
  maneuvered run, at three sizes: 101, 10 000 and 250 000 samples (maneuvered runs have one more
  sample because the maneuver time belongs to both segments: 102, 10 001, 250 001). Eight series
  per run: radius, altitude, speed, true anomaly, a, e, i, RAAN, split at the maneuver. The
  derived series are computed in the spike's generator from the engine samples with the engine's
  `stateToElements`; this stands in for the analysis module (ML-TASK-031, not yet built). The
  spike checks only that a chart shows the numbers it is given; it is not evidence that the
  numbers are correct (VI-03 (a) vs (b)).
- **Pages:** one page per candidate, same shell and data. Single mode: one chart (speed) with
  coast and maneuvered series. Panel mode: eight charts at once (what the plots screen will
  hold), each with coast and maneuvered series, and the cursor moves on all eight.
- **Measurements:** `spikes/charting/tools/measure.mjs`; 3 repetitions per point, each in a fresh
  browser context (cold JIT); the table gives the median with (min-max). Environment: Windows 11
  Home 10.0.26200 x64, Intel Core i7-10875H @ 2.30 GHz (16 logical CPUs), 31.8 GB RAM (about
  18-20 GB free), Node v24.22.2, Chromium 156.0.8078.4 (Playwright 1.64.1 build), headless,
  default flags, software WebGL (SwiftShader); a developer PC in normal use, not quiesced. Runs
  on 2026-11-17.
  - *First render:* from just before the chart constructors to two animation frames after they
    return (so the paint is included). It includes each adapter's conversion of the engine arrays
    to the library's input format. Data fetch and parse are excluded (in the app that path is the
    worker transfer).
  - *Cursor:* 30 updates at spread times; "call" is the duration of the synchronous
    `setCursor`; "to next frame" is from the call to the next animation frame (16.6 ms is the
    display refresh floor of this environment, so a value of 16-17 ms means "no extra cost").
    `performance.now()` resolution is 0.1 ms, so 0.1 means "at or below the timer resolution".
  - *Heap:* `JSHeapUsedSize` after a forced GC, after minus before the chart is created. JS heap
    only: canvas and GPU memory and the data ArrayBuffers are not included.
  - A configuration stops at its first failed or timed-out repetition and that is the result.
- Bundle size: `tools/size.mjs` bundles a tiny entry that imports exactly what the adapter
  imports, with esbuild 0.28.2 (minified, ES2022, same settings for all), and reports gzip
  (zlib level 9) and Brotli. Measured 2026-11-17.
- Metadata: `tools/metadata.mjs` read the npm registry (`https://registry.npmjs.org/<package>`,
  `dist-tags.latest`, `versions[v].license`, `time`, `dist.unpackedSize`) and the public repository
  API on **2026-11-17 12:55 UTC**; the raw output is `spikes/charting/metadata.json`. Release
  counts come from the registry `time` map read the same day.

## Options

Shortlist: maintained, permissively licensed, usable from React 19 without a server. All four
were built and measured. The selection was by category: a small Canvas time-series library
(uPlot), a full-featured Canvas library (Apache ECharts), a full-featured SVG library built on
D3 (Plotly, basic bundle) and a React-native declarative SVG library (Recharts).

| | uPlot | Apache ECharts | Plotly (basic bundle) | Recharts |
|---|---|---|---|---|
| npm package, version | `uplot` 1.6.32 | `echarts` 6.1.0 | `plotly.js-basic-dist-min` 4.3.0 | `recharts` 3.10.1 |
| Licence (registry) | MIT | Apache-2.0 | MIT | MIT |
| Published (registry `time`) | 2025-03-14 | 2026-05-19 | 2026-11-10 | 2026-07-25 |
| npm releases in the last 12 months (since 2025-11-17) | 0 | 3 (6.1.0 and two 6.1.0 release candidates) | 13 | 23 (includes `3.11.0-canary` builds; `latest` is 3.10.1) |
| Repository last push / open issues / archived | 2026-11-17 / 132 / no | 2026-10-13 / 1 478 / no | 2026-11-16 / 809 / no | 2026-11-16 / 494 / no |
| Runtime npm dependencies | 0 | 2 (`zrender`, `tslib`) | 0 (prebuilt) | 11 (redux toolkit, react-redux, immer, victory-vendor, ...) |
| Peer: React 19 | not needed (no React) | not needed | not needed | `^16.8 \|\| ... \|\| ^19` (React 19 works) |
| Unpacked size (registry) | 545 KB | 60.3 MB (all builds) | 1.21 MB | 7.45 MB |
| Bundle as the spike imports it, min / gzip / brotli | 53.6 / **23.9** / 21.4 kB (+ CSS 1.6 kB) | 539.5 / **184.6** / 156.3 kB (tree-shaken); 1141.5 / 383.6 / 312.0 kB (full import) | 1218.5 / **405.6** / 334.8 kB | 365.5 / **108.7** / 91.1 kB with React external (the app has React); 587.9 / 177.1 / 148.8 kB with React and React DOM |
| Renderer | Canvas 2D | Canvas (SVG available) | SVG (basic bundle has no WebGL) | SVG |
| Maintenance signal read | Repository under a personal account (`leeoniya/uPlot` in the registry metadata; contributor counts not read); no npm release for 8 months while the repository was pushed on 2026-11-17 | Repository under the `apache` organisation; 3 npm releases in 12 months, two of them release candidates | 13 npm releases in 12 months, last 2026-11-10 | 23 npm releases in 12 months, many of them canary builds |

Sources: npm registry and repository API read 2026-11-17 (see Method), sizes measured here. "Stars"
and similar popularity figures were read but are not used as a criterion.

### Measurements (median of 3, with min-max)

All numbers are from one machine and one browser, headless with software WebGL; they are not a
guarantee for another computer. Raw data: `spikes/charting/results/measurements*.json`.

**Single chart, speed, coast + maneuvered**

| Library | Points per series | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|---|
| uPlot | 101 | 35 (34-47) | 0.0 (0.0-0.1) | 16.7 (16.7-16.7) | 0.3 |
| uPlot | ~1e4 | 50 (48-50) | 0.1 (0.0-0.1) | 16.7 (16.6-16.8) | 0.5 |
| uPlot | 250 000 | 92 (92-93) | 0.1 (0.0-0.1) | 16.6 (16.5-16.6) | 5.1 |
| ECharts, cursor via `setOption` graphic | 101 | 113 (111-117) | 6.4 (6.4-6.5) | 16.6 (16.5-16.8) | 1.4 |
| ECharts, cursor via `setOption` graphic | ~1e4 | 152 (150-187) | 10.3 (10.1-10.3) | 16.8 (16.8-16.8) | 5.3 |
| ECharts, cursor via `setOption` graphic | 250 000 | 787 (781-825) | 112.6 (111.8-112.9) | 126.2 (125.0-126.3) | 98.9 |
| ECharts, cursor via a zrender line | 101 | 101 (97-107) | 0.1 (0.1-0.1) | 16.7 (16.7-16.8) | 1.2 |
| ECharts, cursor via a zrender line | ~1e4 | 135 (134-140) | 0.1 (0.1-0.1) | 16.7 (16.5-16.8) | 5.1 |
| ECharts, cursor via a zrender line | 250 000 | 741 (646-748) | 0.1 (0.1-0.1) | 16.3 (15.6-16.5) | 98.7 |
| Plotly basic | 101 | 117 (117-133) | 15.5 (14.9-16.2) | 18.2 (17.2-18.8) | 1.2 |
| Plotly basic | ~1e4 | 143 (133-147) | 20.9 (20.8-21.0) | 24.0 (23.3-24.6) | 2.2 |
| Plotly basic | 250 000 | 403 (399-406) | 168.2 (165.7-172.9) | 170.4 (167.9-175.4) | 23.5 |
| Recharts | 101 | 134 (134-134) | 11.4 (10.2-11.6) | 16.6 (16.5-16.7) | 2.5 |
| Recharts | ~1e4 | 835 (825-839) | 163.0 (161.6-163.1) | 164.0 (162.6-164.3) | 28.0 |
| Recharts | 250 000 | 17 126 (17 078-17 152) | 4 020 (4 006-4 028) | 4 023 (4 008-4 030) | 632 |

**Panel, 8 charts (each coast + maneuvered), cursor moved on all eight**

| Library | Points per series | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|---|
| uPlot | 101 | 67 (66-68) | 0.1 (0.0-0.1) | 16.7 (16.4-16.8) | 0.7 |
| uPlot | ~1e4 | 101 (100-123) | 0.1 (0.1-0.1) | 16.6 (16.5-16.7) | 2.1 |
| uPlot | 250 000 | 364 (347-366) | 0.1 (0.1-0.1) | 16.5 (16.5-16.6) | 35.9 |
| ECharts (`setOption` cursor) | 101 | 250 (249-251) | 30.7 (30.6-30.8) | 38.3 (38.1-38.5) | 3.6 |
| ECharts (`setOption` cursor) | ~1e4 | 586 (583-592) | 73.8 (72.3-74.8) | 210.8 (208.9-211.5) | 35.4 |
| ECharts (`setOption` cursor) | 250 000 | 9 740 (9 626-9 951) | 1 112 (1 106-1 112) | 6 155 (6 078-6 464) | 800 |
| Plotly basic | 101 | 267 (267-268) | 101.6 (101.0-101.7) | 106.7 (106.5-106.9) | 2.9 |
| Plotly basic | ~1e4 | 381 (379-400) | 139.9 (139.8-142.1) | 145.4 (145.2-146.8) | 10.1 |
| Plotly basic | 250 000 | 2 134 (2 130-2 196) | 1 373 (1 359-1 382) | 1 378 (1 365-1 387) | 167 |
| Recharts | 101 | 384 (352-385) | 69.9 (69.7-70.9) | 71.9 (71.7-72.8) | 10.1 |
| Recharts | ~1e4 | 5 466 (5 449-5 483) | 1 284 (1 283-1 289) | 1 286 (1 285-1 291) | 214 |
| Recharts | 250 000 | no result: timeout after 240 s on the first repetition | | | |

"~1e4" is 10 000 samples (coast) / 10 001 (maneuvered). The ECharts zrender-cursor variant was
measured in single mode only. The uPlot figures were checked visually (screenshots of all
eight charts) so the speed is not a skipped render.

### Feature matrix (each candidate built and run on engine data)

| Required feature | uPlot | ECharts | Plotly basic | Recharts |
|---|---|---|---|---|
| Gap at the maneuver (no line across the discontinuity) | Yes. `spanGaps: false` with nulls; one shared sorted x is required, so the maneuvered run is two series ("before burn", "after burn") on the coast grid | Yes. One series with an explicit `[t, null]` element, `connectNulls: false` | Yes. One trace with a NaN element in typed arrays, `connectgaps: false` | Yes. `connectNulls={false}`; like uPlot, two `<Line>`s on one table of rows |
| Maneuver marker | Yes, but written by us: 15 lines in the `draw` hook (canvas) | Yes, built in: `markLine` with label | Yes: layout shape + annotation | Yes, built in: `<ReferenceLine>` with label |
| Axis titles with units, legend | Yes (`axes[].label`; DOM legend, which also lists the extra "after burn" entry and adds height below the canvas) | Yes (axis `name`; legend component) | Yes (axis `title`; legend) | Yes (axis `label`; `<Legend>`; the "after burn" entry is hidden with `legendType="none"`) |
| External time cursor | Yes: a DOM line on `u.over`, 0.1 ms at 250 000 points in all modes | Yes: `graphic` via `setOption` (113 ms at 250 000 points, 1.1 s for 8 charts) or a zrender line (0.1 ms, lower-level API) | Yes: `relayout` of a shape (168 ms at 250 000 points, 1.4 s for 8 charts) | Yes: a second `<ReferenceLine>` from React state; the whole chart re-renders (4 s at 250 000 points) |
| Coast vs maneuvered, distinct styles | Yes (dash vs solid, token colours) | Yes | Yes | Yes |
| Read-back of exact plotted values (`Object.is`) | Yes, public: `u.data` holds the very arrays passed in | Yes, but through `chart.getModel()...getData().getStore()`, which is outside the documented API; `getOption()` was not tested | Yes, public: `gd.data` holds the typed arrays passed in | No public accessor for the plotted points; read back by re-rendering with a `dot` render prop that records the value each point is drawn with (works, slow) |
| Result of the `Object.is` check, x and y, coast and maneuvered, single chart | 0 mismatches at ~1e4 and 250 000 | 0 / 0 | 0 / 0 | 0 / 0 |

The check compares what each chart holds (through the access path above) with the engine's
columns, per value with `Object.is`, and counts the gap elements (1 in the maneuvered series, 0 in
the coast series). It proves plumbing only (VI-03 (a)): no candidate altered, rounded or
resampled the data it was given with default settings. Down-sampling options (ECharts `lttb`
`sampling`, Plotly `scattergl` which is not in the basic bundle) were **not** used; they would
change what is drawn, and FR-009 AC3 is about the numbers shown.

### Keyboard, screen reader, network, CSP

- **uPlot:** the README shipped in the 1.6.32 package has no accessibility section; the bundle
  contains no `aria-*` and no `tabindex`; probe (`tools/probe.mjs`): a canvas and a DOM legend,
  none of it in the Tab order.
- **ECharts:** an `aria` option, off by default, adds an `aria-label` description generated from
  the chart configuration and optional decal patterns as a second encoding besides colour
  (ECharts handbook, "Accessibility", https://echarts.apache.org/handbook/en/best-practices/aria/,
  read 2026-11-17). The chart is one canvas element; probe: nothing in the Tab order; not tested
  with a screen reader.
- **Plotly basic:** no accessibility documentation was located; the minified basic bundle has one
  `aria-label` string and no `tabindex`; probe: SVG, nothing in the Tab order.
- **Recharts:** `accessibilityLayer` ("accessibility support for keyboard-only and screen reader
  users", default `true`; type declaration in recharts 3.10.1); probe: the SVG is focusable
  (`tabindex=0`, `role="application"`). The arrow-key behaviour was not exercised (the spike has
  no tooltip).
- **Network and CSP:** for all four, the probe saw no request outside the local server; none of
  the four production bundles contains `eval(` or `new Function(`. Plotly's bundle contains
  default URL settings (`cdn.plot.ly`, `cloud.plotly.com`) that were not used. No page was run
  under a restrictive `Content-Security-Policy` header; that is not verified.

### Observations that do not depend on the library

- **Angle series wrap.** True anomaly and RAAN are normalised to [0, 2π) by the engine. The
  plotted line jumps from about 360 deg to 0 at every wrap in all four candidates. RAAN of the
  product default scenario (0 rad) is the worse case: numerical values hover at 0 and 2π and the
  chart is filled with jumps. Whatever the library, the analysis/plot data layer (ML-TASK-031,
  032) has to decide how angles are plotted (unwrapped continuous angle, or explicit gaps at the
  wrap). This is for the owner and the Systems Architect; it is not a scientific change in the
  spike.
- With the product default (101 samples) every candidate renders a chart in 35-134 ms; the
  library choice matters at the large sizes, which is the only place the soft-warning size
  (250 000) is reached.

## Decision (accepted by the owner, 2026-11-17)

**Adopt uPlot 1.6.32 (exact pin) for the M1 time-history and comparison plots.**

Reasons, all from the measurements above:

1. **Interactive playback at the largest size.** At 250 000 samples with eight charts on screen it
   renders in 364 ms and moves the time cursor on all eight at the timer floor (0.1 ms; frame to
   frame 16.5 ms, i.e. no extra cost). ECharts needs 9.7 s to render and 1.1 s per cursor update
   by its documented path; Plotly basic 2.1 s and 1.4 s; Recharts did not finish within 240 s.
   ECharts with a lower-level zrender cursor is fast for one chart (0.1 ms) but still renders in
   0.74 s and holds about 100 MB for a single chart, 800 MB for eight.
2. **Memory.** 36 MB for eight charts at 250 000 points, against 167 MB (Plotly) and 800 MB
   (ECharts).
3. **Size and supply chain.** 23.9 kB gzip (+1.6 kB CSS), no runtime dependencies, MIT; the
   others are 109-406 kB gzip with React external and bring dependency trees (Recharts 11 packages,
   ECharts 2).
4. **Exact values are the library's own arrays**: `u.data` is the array passed in, so the VI-03
   plumbing check reads the plotted values through a public property.
5. Every required feature works on engine data (matrix above).

What uPlot does not give, and the cost of that (accepted as consequences below): no built-in
marker/annotation (about 15 lines of canvas code), shared-x model (the maneuver gap becomes two
series), no accessibility support, an extra legend entry to hide or restyle, and no npm
release since 2025-03-14 (the repository itself was pushed on 2026-11-17).

**Runner-up: Apache ECharts 6.1.0 (tree-shaken, 184.6 kB gzip, Apache-2.0)**, if the owner
prefers built-in marker, legend, tooltips, zoom and an `aria` description over performance at the
largest sizes. If chosen, the cursor must be a lower-level zrender element (documented
`setOption` costs 113 ms per update at 250 000 points), the panel at 250 000 points would need a
decision on down-sampling for display (which conflicts with "plotted values equal the analysis
output" unless the full data stays reachable), and the soft-warning threshold may need a plot-time
note. Recharts and Plotly basic are not recommended: Recharts needs 163 ms per cursor update at
10 000 points and 4 s at 250 000; Plotly basic is the largest bundle (405.6 kB gzip) with a
168 ms cursor update at 250 000 points.

## Angle plotting policy (owner decision, 2026-11-17)

Angles reported in [0, 2π) (true anomaly, Ω, ω) are plotted with a **break in the line at each wrap**:
the series is split where consecutive values jump across the 0/2π boundary, and no plotted value is
changed (no unwrapping). This keeps the plotted values identical to the analysis module output
(ML-FR-009 AC3; VI-03 plumbing). Implemented in ML-TASK-032.

## Consequences

- **Dependency:** `uplot` is added to `apps/web` (exact version, `1.6.32`) by ML-TASK-032, with its
  justification in that PR (ML-NFR-007). `pnpm-lock.yaml` changes then, not before. The spike
  itself added nothing to `apps/web` or to the root lockfile.
- **Documents:** `docs/architecture/tech-baseline.md` §2 needs a row for `uplot` (version, date
  published 2025-03-14, MIT, source checked) and its selection rule check (rule 2: older than 14
  days; rule 4: permissive licence). `proposed-architecture.md` §5 "Charts" row and ADR-006's
  "Charting library" bullet point to this ADR. This ADR's status becomes Accepted.
- **Wrapper:** uPlot is not a React component. `apps/web` needs a small wrapper (create in an
  effect, destroy on unmount, resize with the panel). The React wrapper packages on npm were not
  evaluated and are not proposed.
- **Application code we own:** the maneuver marker, the time cursor, the coast/maneuver styling
  from the design tokens (`--coast` dashed, `--maneuver` solid, `--marker`), the legend styling,
  the angle wrap policy, and a text alternative for every plot (the cursor-time values and the
  comparison table, ML-FR-010 AC2), because the canvas is not accessible to assistive technology
  and plots must not carry information alone (quality bar). ML-UX-004 concerns inputs; the cursor
  is driven by the existing keyboard-operable playback control.
- **CSS:** `uplot/dist/uPlot.min.css` (1.6 kB) or equivalent rules restyled to the tokens.
- **CSP / no network:** no `eval`, no network use seen; CSP not tested (see above).
- **Maintenance risk:** no npm release for 8 months at the date of reading, and the repository
  is under a personal account (contributor and bus-factor data were not read). The
  library is small (53.6 kB minified, 545 kB unpacked, no dependencies), is pinned exactly, and
  could be vendored if it were abandoned. The owner should accept this risk explicitly.
- **If ECharts is chosen instead:** dependency `echarts` 6.1.0 (+ `zrender` 6.1.0, `tslib`), tree-shaken
  imports only, 184.6 kB gzip, the cursor and down-sampling caveats above.
- **Licence:** MIT (uPlot) is permissive and within tech-baseline rule 4.

## Not verified

Real-GPU or other machines; Firefox and Safari; real screen-reader behaviour; any CSP header;
Recharts arrow-key behaviour; ECharts `getOption()` read-back; down-sampled plotting; the
analysis module's own series (the spike derived them itself); the maneuvered panel with real
playback driven by the app; behaviour with the 1 000 000-sample hard limit (not measured; the
ladder stopped at 250 000, the soft-warning size). Only one maneuver per scenario exists in M1,
so multi-gap behaviour was not tested. Heap figures exclude canvas/GPU memory and the data
buffers.
