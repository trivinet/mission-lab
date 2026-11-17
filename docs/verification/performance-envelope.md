# Performance envelope and sample limit (ML-NFR-004)

Task: ML-TASK-026. Requirements: ML-NFR-004, ML-UX-003. Status of this document:
**measured record; §4 records the owner's decision of 2026-11-17 (keep 1,000,000 as the hard
limit, soft UI warning above 250,000 samples).** The Verification Engineer reviewed the record
before the decision.

**All numbers come from one machine, one browser, one session, headless, with software WebGL.**
They are not a guarantee for any other machine, and in particular not for a computer with a real
GPU. The machine was a developer PC in normal use (other programs open), not an idle benchmark
host.

## 1. Environment

| Item           | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Date           | 2026-11-17 (run started 10:39 UTC)                                          |
| OS             | Windows_NT 10.0.26200 (Windows 11 Home), x64                                |
| CPU            | Intel Core i7-10875H @ 2.30 GHz, 16 logical CPUs                            |
| RAM            | 31.8 GB total, 19.2 GB free at start                                        |
| Node           | v24.22.2                                                                    |
| Playwright     | 1.64.1                                                                      |
| Browser        | Chromium 156.0.8078.4 (Playwright build), headless, default flags           |
| WebGL renderer | ANGLE, Vulkan, **SwiftShader (software)**; no GPU was used for rendering    |
| App            | production build (`vite build`), served by `vite preview`, scene hook on    |
| Load           | Developer PC with other applications running; no attempt to quiesce it      |

During the run the author also executed one short Vitest file and a Prettier run (a few
seconds, once, around the 1 000 000 point). Nothing was done to make the numbers look better.

## 2. Method

Prerequisite (once): `pnpm exec playwright install chromium`. This installs the Chromium build
that the pinned Playwright version (1.64.1) uses; the numbers below are for that build (156.0.8078.4).

Reproduce with one command from the repository root:

```
pnpm perf:envelope
```

The data were measured with the app at commit `cf4c0d5187bb6f5dcce86f8986d850ce6d1561f6` (the
harness commit; later commits on this branch change only tests and documents, not the app).

Optional environment variables: `PERF_SIZES` (comma-separated total sample counts),
`PERF_REPS` (default 3), `PERF_RUN_TIMEOUT_MS`, `PERF_OUT_DIR` (raw JSON, default
`apps/web/perf/out/`, git-ignored). The harness is `apps/web/perf/envelope.perf.ts` with
`apps/web/playwright.perf.config.ts`. It is dev/test only: it is not run by `pnpm test`,
`pnpm test:e2e` or CI, and it is not shipped. The full ladder takes about two minutes.

Per size N and per repetition (3 repetitions per size):

- A fresh browser context and page (worker starts cold, JIT cold), URL `/?sceneHook=1`.
- Scenario: the product default with `duration_s = N - 1` and `outputStep_s = 1`, so the run has
  exactly N samples; the harness checks that the scene shows N vertices and holds N source
  samples (it did, every repetition).
- **Engine time**: measured in the worker around the engine handler (validation, propagation,
  result checks), attached to the response as diagnostic `timing`.
- **Transfer time**: main-thread receipt time minus the worker's post time. It includes
  structured-clone/transfer and any main-thread queueing before the message event.
- **Click to current**: Run click until the result state read-out becomes `current` (includes
  request building, worker start, engine, transfer, state update).
- **Current to first frame**: from `current` until the first animation frame at which the scene
  hook shows N vertices (the Float32 arrays given to the GPU buffers). This is main-thread
  scene-geometry construction plus the first render; it is not a GPU-completion timestamp. It
  also includes the polling latency of the harness (one animation frame per check) and a fixed
  cold first render of about 100 ms: at N = 1 000 it is 115.2 ms, which is the fixed-cost
  baseline (the scene work at that size is negligible). Subtract about that much to see the part
  that grows with N.
- **Responsiveness during the run**: Playwright types into the scenario name while the state is
  `computing`; the probe time is the round trip until the toolbar shows the text. It includes
  Playwright's own protocol latency, so it is an upper bound on the page's latency. The longest
  gap between animation frames in the click-to-current window, and the longest `longtask` in the
  click-to-first-frame window, are also reported. Because that window ends at the first frame, the
  long-task figure includes the same fixed cold-render cost (91.0 ms at N = 1 000, the baseline).
- **Playback frame time**: 3 s of playback at 1 s per second after the run; intervals between
  animation frames (median, 95th percentile, max). The number of frames in the 3 s window is
  reported per size (table below, footnote on p95).
- **Heap**: Chrome DevTools Protocol `JSHeapUsedSize` of the main page after a forced garbage
  collection, before the run and after the run is displayed.

The ladder is ascending and stops at the first size where a repetition fails (error state, tab
crash or timeout); a failure would be recorded as a result. None occurred.

Raw data, every repetition: `docs/verification/data/performance-envelope-2026-11-17.json`. That
file was copied by hand from the git-ignored `apps/web/perf/out/` (the harness does not write into
`docs/`); it is the unmodified harness output, apart from Prettier formatting.

## 3. Results

Median [min to max] of 3 repetitions, milliseconds unless stated. All 18 repetitions succeeded.

| N samples |        Engine (worker) |    Transfer |     Click to current | Current to first frame | Click to first frame |
| --------: | ---------------------: | ----------: | -------------------: | ---------------------: | -------------------: |
|     1 000 |       19.6 [19.1-22.2] | 0.5 [0.3-1.0] |       87.9 [84.1-108.1] |     115.2 [104.0-122.6] |       206.7 [191.9-223.3] |
|    10 000 |       40.7 [39.8-44.8] | 0.3 [0.2-0.6] |     113.6 [107.9-131.0] |     109.9 [109.6-116.9] |       224.8 [223.2-240.9] |
|   100 000 |     177.6 [175.5-179.4] | 0.5 [0.4-2.4] |     261.8 [250.6-271.8] |     164.5 [164.3-174.7] |       426.3 [425.3-436.1] |
|   250 000 |     391.9 [390.2-403.4] | 0.3 [0.2-3.0] |     496.7 [479.6-508.7] |     228.2 [221.8-262.5] |       730.5 [724.9-742.1] |
|   500 000 |     734.8 [725.2-755.4] | 1.3 [0.7-3.2] |     872.1 [863.9-902.3] |     356.8 [356.3-361.2] |     1228.4 [1225.1-1259.1] |
| 1 000 000 |  1424.1 [1413.7-1429.4] | 0.6 [0.5-0.8] |   1621.5 [1605.7-1625.8] |     587.6 [580.3-603.9] |     2206.1 [2193.3-2225.4] |

| N samples | Max frame gap during run | Max long task (click to frame) | Probe median | Probe max (3 reps: min-max) |
| --------: | -----------------------: | -----------------------------: | -----------: | --------------------------: |
|     1 000 |         19.7 [16.9-20.8] |                  91.0 [75-103] | 19.9 [18.6-21.3] |        20.1 [20.0-23.0] |
|    10 000 |         19.6 [17.6-20.6] |                   83.0 [79-99] | 17.3 [16.6-20.7] |        22.0 [21.5-22.5] |
|   100 000 |         19.0 [18.1-19.5] |                 120.0 [120-134] | 16.7 [16.6-17.4] |       176.7 [38.9-177.7] |
|   250 000 |         19.0 [18.5-19.6] |                 197.0 [190-197] | 15.9 [14.9-17.1] |        81.4 [43.5-277.0] |
|   500 000 |         18.2 [18.1-20.0] |                 306.0 [300-312] | 14.7 [13.6-15.4] |       431.0 [92.9-436.2] |
| 1 000 000 |         19.7 [19.2-20.1] |                 503.0 [499-516] | 13.7 [13.7-14.2] |        153.9 [16.7-703.9] |

| N samples | Frames in 3 s (3 reps) | Playback frame median | Playback frame p95 (note) | Playback frame max | Main-page JS heap before to after (MB) |
| --------: | ---------------------: | --------------------: | -----------------: | -----------------: | -------------------------------------: |
|     1 000 | 183, 183, 176 |       16.7 [16.7-16.8] |     17.8 [17.5-22.7] |     25.9 [22.0-34.3] |                           4.5 to 6.3 |
|    10 000 | 150, 179, 179 |       16.8 [16.8-17.3] |     19.1 [17.9-32.0] |     34.1 [31.9-34.7] |                           4.5 to 6.4 |
|   100 000 | 69, 68, 70 |       45.6 [44.5-46.0] |     50.1 [47.5-51.5] |     68.9 [58.2-74.0] |                           4.5 to 6.8 |
|   250 000 | 34, 34, 33 |     100.3 [99.5-100.9] |   108.2 [107.5-113.7] |   116.5 [116.1-118.6] |                           4.5 to 6.9 |
|   500 000 | 19, 18, 20 |     192.4 [191.6-195.3] |   217.5 [212.5-273.7] |   217.5 [214.7-273.7] |                           4.5 to 7.0 |
| 1 000 000 | 12, 12, 11 |     386.1 [380.8-386.9] |   422.3 [407.8-429.4] |   422.3 [407.8-429.4] |                           4.5 to 7.1 |

Note on p95: with fewer than about 20 frames in the window a 95th percentile is not meaningful (it
is the maximum or one frame from it). That applies to 500 000 (18 to 20 frames) and 1 000 000
(11 to 12 frames), where p95 equals max in the table; use the median there.

The probe maxima are the largest single round trip in each repetition, summarised over the three
repetitions. The large probe maxima (for example 703.9 ms at 1 000 000, one repetition) plausibly
coincide with the main thread building the scene geometry when the result arrives (the long task
column), but this is not evidenced: probe timestamps were not recorded, so a probe cannot be
placed against the long task. The probe medians stay near the idle round trip throughout.

### What the numbers say (as measured)

1. **Engine time is linear in N**, about 1.4 microseconds per sample on this machine (1.42 s at
   1 000 000). It runs in the worker: the longest animation-frame gap while a run is in progress
   stays about 18 to 20 ms (idle is about 17 ms) up to 1 000 000, and the probe median stays
   below 20 ms. The page stays interactive during a run at every size measured (ML-UX-003).
2. **Transfer is not a cost**: at most 3.2 ms in any repetition at any size, as expected for a
   transfer (not copy) of the typed arrays.
3. **The main thread is blocked for a while after the result arrives**, by scene-geometry
   construction: the longest long task is about 0.1 s at 100 000 and about 0.5 s at 1 000 000.
   During that time input is not handled by definition of a long task; the large probe maxima are consistent with it but not shown to coincide with it (see the note above).
4. **Rendering is the bottleneck, not the engine.** With software WebGL, one playback frame takes
   about 17 ms up to 10 000 samples, 46 ms at 100 000, 100 ms at 250 000, 192 ms at 500 000 and
   386 ms at 1 000 000 (about 2.6 frames per second). Frame time grows with N. A plausible
   cause is that the whole polyline is drawn every frame, but this is a hypothesis: a per-frame
   O(N) CPU cost in the app (for example in the scene or marker update) was not ruled out, and
   how much is the software renderer is not known: no GPU run and no profile were made.
5. **JS heap is not informative.** The main-page JS heap grows only from 4.5 to 7.1 MB, because
   typed-array backing stores are not in `JSHeapUsedSize`. Process memory was not measured. The
   arithmetic size at 1 000 000 samples is 56 MB of engine arrays (7 binary64 numbers per sample,
   `limits.ts`) plus 12 MB of Float32 scene vertices (3 binary32 per sample), before any GPU
   copy. Memory use was not observed to be a problem on a machine with 19 GB free; a smaller
   machine was not tested.

### Supported envelope, as measured (this machine only)

**1 000 000 is a hard ceiling that the engine and the page survive; it is not a size that plays
smoothly.** In the order of use:

| Region (total samples) | Observed                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| up to about 10 000     | **Smooth.** Playback about 60 frames per second (median 16.8 ms; worst frame 34 ms). Run completes in about 0.1 s.                                                         |
| up to about 250 000    | **Usable.** Playback 46 ms per frame at 100 000 (about 22 fps) and 100 ms at 250 000 (about 10 fps) with software rendering. Click to first frame 0.4 s to 0.7 s.          |
| above 250 000          | **Degraded.** 192 ms per frame at 500 000 (about 5 fps) and 386 ms at 1 000 000 (about 2.6 fps); a main-thread pause of 0.3 s to 0.5 s when the result appears; run 1.2 s to 2.2 s. The page stays responsive while computing. |
| above 1 000 000        | **Not measured.** The engine and validation reject it under the current provisional limit.                                                                                  |

## 4. Sample limit (Decided by the owner, 2026-11-17)

**Decided by the owner, 2026-11-17: keep 1,000,000 as the hard limit, with a soft UI warning above 250,000 samples.** The text below is the proposal and reasoning as submitted for that decision.

**Proposal: keep the limit at 1 000 000 samples** (the value of `PROVISIONAL_MAX_SAMPLE_COUNT`)
as a hard ceiling, and record it as the decided limit in part B only if the owner agrees.

What the data support, and what they do not:

- The ladder stopped at the placeholder: sizes above 1 000 000 are rejected by validation, so
  nothing above it was run. The data therefore show only that **the limit is not unsafe up to
  1 000 000** on this machine (18 of 18 runs succeeded; engine 1.4 s; page responsive during the
  run; transfer negligible). They do not show that 1 000 000 is the right or the optimal value.
- The M1 use case of 30 days at a 10 s step is 259 201 samples. That is just above the 250 000
  point (100 ms per frame), so it plays at about 10 frames per second or slightly less with
  software rendering (an estimate from the neighbouring points, not a separate measurement).
- Above about 250 000 samples playback degrades, and at the ceiling it is about 2.6 frames per
  second with a half-second pause when the result appears (see the envelope above).
- No evidence supports a higher value. Raising it needs a measurement above 1 000 000 (which
  needs the limit changed, out of scope for part A) and a rendering decision first.

Alternatives that were offered to the owner (the first was chosen as the soft warning):

- **Main alternative: keep the hard ceiling and add a soft warning above 250 000 samples**
  ("playback will be slow"). This is new behaviour and needs its own task.
- **Lower the hard limit.** The highest hard limit the reviewer would defend on this data is
  **500 000** (192 ms per frame, about 1.2 s to the first frame). 250 000 gives about 10 frames
  per second under software rendering; 1 000 000 is defensible only as a ceiling with the
  envelope published.
- **Reduce rendering cost** (not engine cost), for example by drawing a decimated polyline. This
  is real work, was not attempted (out of scope: performance optimisation), and its benefit
  depends on the unconfirmed cause of the frame-time growth.

## 5. Limitations and what was not measured

- One machine, one browser, one session; no repetition on another day or load.
- Headless Chromium with SwiftShader. Playback numbers on a computer with a GPU are not known and
  are probably better; they were not measured.
- Process-level memory (the worker's arrays, the GPU buffers, the browser's total) was not
  measured; heap figures cover the main page JS heap only.
- The ladder was bounded by the provisional limit; behaviour above 1 000 000 is unmeasured.
- Time to first frame is the first animation frame showing the N vertices, not a GPU-completion
  timestamp.
- The probe latency includes Playwright's own protocol latency.
- Each repetition is a cold page and a cold worker; warm re-runs in the same page were not
  measured.
- A single scenario family (default orbit, no maneuver); a maneuver adds one segment and does not
  change N.
- The repository tests do not assert any of these numbers; they are measurements, not
  requirements.

## 6. G2 evidence (VI-01, VI-02, VE-02)

All pass on the integrated app. Test files:

| Check                                                              | Level and file                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VI-01 request to result structure, segments, events, metadata      | `conformance/src/vi01-structure.test.ts` (engine, exhaustive, exact); `apps/web/src/worker/vi01-integration.test.ts` (added in this task: the app's request builder and worker handler, real engine, with a maneuver: contract-valid result, 2 segments, 1 event, metadata copied from the request); `apps/web/src/worker/run-handler.test.ts` (real engine, run id echo, transfer list) |
| VI-02 scene hook: rendered vertices equal `Math.fround(sample * s)` | `apps/web/src/scene/scene-geometry.test.ts` (unit, exact by `Object.is`); `apps/web/e2e/scene.spec.ts` (built app, real worker, hook `?sceneHook=1`: 0 mismatches, one and two segments); `apps/web/e2e/playback.spec.ts` (marker equals the vertex at a sample time) |
| VE-02 result states none, computing, current, stale                | `apps/web/e2e/result-states.spec.ts` (built app, real engine in the worker, MutationObserver records every state); `apps/web/src/state/result-state.test.ts` (state machine) |

The run results are in the task report (`docs/backlog/tasks/ML-TASK-026.yaml`).

## 7. Re-running

```
pnpm perf:envelope
PERF_SIZES=1000,100000 PERF_REPS=3 pnpm perf:envelope
```

Compare new numbers only with the environment table above; a different machine is a different
record, not a regression.

## 8. Release candidate re-measurement (2026-11-17, ML-TASK-044)

Why: the release-readiness review (D-1, `release-readiness-review.md`) measured the release
candidate once and found the main-thread block after a result had grown to 3187 ms at 1 000 000
samples (503 ms in §3), with a main-page JS heap of 227 MB (7.1 MB in §3). The cause was the
analysis (histories of every quantity, `computeHistories`) running on the main thread when a
result arrives. ML-TASK-044 moves it into the simulation worker (typed arrays transferred) and
this section re-measures. The method, machine and harness of §1 and §2 are unchanged; the figures
in §3 stay as the record of 2026-11-17 10:39 UTC and are not edited.

### 8.1 What changed in the app

- `computeHistories` is called in the worker (`apps/web/src/worker/run-handler.ts`), and its
  output is copied into one Float64Array per quantity and segment (NaN stands for the module's
  `null`) and transferred next to the result (`analysis-pack.ts`). The main thread unpacks only the
  quantities that are plotted. The values are the module's, unchanged: a Vitest check compares every
  unpacked value with the module output with `Object.is`, nulls included (`analysis-pack.test.ts`),
  and the VI-03 (a) plumbing test and e2e are unchanged.
- `compareCoastAndManeuver` stays on the main thread. It reads the first sample of the coast run and
  the maneuver events, so its cost does not depend on the number of samples (from the code; it was
  not timed separately). Moving it would need both results in one worker call.
- The harness (`apps/web/perf/envelope.perf.ts`) gained one additive metric, `analysis_ms` (worker
  time computing and packing the histories). `engine_ms` now excludes it. Nothing else in the harness
  changed.

### 8.2 Environment and method

Same machine and software as §1 (Intel Core i7-10875H, Windows 11, Node v24.22.2, Playwright 1.64.1,
Chromium 156.0.8078.4 headless, software WebGL). Free RAM at start 19.3 GB (before) and 20.3 GB
(after). The PC was not quiesced; nothing else was started by the author during the runs.

- **Before**: the commit `768b9e1` (the app as of the readiness review, no change to `apps/web/src`),
  sizes 250 000, 500 000 and 1 000 000 only, 3 repetitions each, run 18:37 UTC. Raw:
  `docs/verification/data/performance-envelope-rc-before-2026-11-17.json`.
- **After**: the commit `daeabfd` (app code identical to the preceding commit `055b901`), the full
  ladder of six sizes, 3 repetitions each (18 of 18 succeeded), run 18:59 UTC. Raw:
  `docs/verification/data/performance-envelope-rc-after-2026-11-17.json`. A first run of the three
  large sizes on the same code, made before the other ML-TASK-044 fixes, gave the same picture (max
  long task 227, 385 and 688 ms) and is not kept.
- No "before" was run for 1 000 to 100 000 samples in this session. For those sizes the only
  comparison is with §3 (a different session) and with the readiness review (100 000: 365 ms).

"Post-result main-thread time" here is the sum of the long tasks (over 50 ms) on the main thread
between the Run click and the first frame (`totalLongTaskDuringRun_ms`); "largest block" is the
longest single one (`maxLongTaskDuringRun_ms`). Both include the cold first render of about
100 ms noted in §2. Median [min to max] of 3 repetitions, milliseconds.

### 8.3 Before and after (same session, same machine)

| N samples | Post-result main-thread time, before | after | Largest block, before | after | Click to first frame, before | after |
| --------: | ------------------------------------: | ----: | --------------------: | ----: | ---------------------------: | ----: |
|   250 000 | 1097 [1009-1146] | 405 [403-411] | 885 [804-947] | 223 [222-229] | 1626 [1523-1785] | 1563 [1560-1565] |
|   500 000 | 1826 [1821-1879] | 637 [635-641] | 1474 [1465-1558] | 348 [346-350] | 2709 [2677-2825] | 2841 [2838-2858] |
| 1 000 000 | 3992 [3612-4054] | 1197 [1194-1208] | 3483 [3088-3486] | 613 [609-624] | 5577 [5239-5643] | 5309 [5287-5361] |

| N samples | Main-page JS heap after the run (MB), before | after | Probe max during the run (ms), before | after |
| --------: | -------------------------------------------: | ----: | ------------------------------------: | ----: |
|   250 000 | 60 | 33 | 1152 [851-1197] | 268 [17-467] |
|   500 000 | 115 | 60 | 1565 [1526-1969] | 17 [17-19] |
| 1 000 000 | 227 | 115 | 39 [28-4120] | 19 [18-19] |

What this shows, and what it does not:

1. **The main-thread block is much shorter**: at 1 000 000 samples the sum of long tasks fell from
   about 4.0 s to about 1.2 s and the largest block from 3.5 s to 0.6 s; at 250 000, from 0.9 s to
   0.2 s. The page is therefore unresponsive for a fraction of the previous time after a result. The
   remaining 0.6 s block is close to the 503 ms of §3. A CPU profile (one repetition at 1 000 000, not
   kept) put most JavaScript self time in the minified scene and vendor chunk and none of the plot
   code in its top 18 entries; what the remaining block consists of was not attributed further.
2. **Click to first frame did not improve** (5.3 s against 5.6 s at 1 000 000, 1.56 s against 1.63 s
   at 250 000). The analysis now takes place in the worker before the result is posted: 2.5 s at
   1 000 000, 1.3 s at 500 000, 0.65 s at 250 000 (§8.4). The user waits the same time for the result;
   the page can be used meanwhile (probe maximum 19 ms at 1 000 000). Showing the scene first and the
   plots when their analysis arrives would shorten the wait; it needs a state for "analysis pending"
   and was not done (not asked for).
3. **JS heap fell by half** (227 to 115 MB at 1 000 000); the number is the main-page heap only. The
   worker's heap was not measured and now holds the boxed arrays that `computeHistories` returns
   (one worker call at a time; process memory was not measured, see §5).
4. **Playback frame time is unchanged** (§8.4): it is rendering-bound, not analysis-bound.

### 8.4 Ladder after the change (3 repetitions each)

| N samples | Engine (worker) | Analysis (worker) | Transfer | Click to current | Current to first frame | Click to first frame |
| --------: | --------------: | ----------------: | -------: | ---------------: | ---------------------: | -------------------: |
|     1 000 | 20.1 [19.6-21.1] | 10.7 [10.1-11.5] | 0.4 [0.3-4.6] | 133.1 [123.0-154.9] | 118.1 [109.0-138.3] | 263.9 [241.1-271.4] |
|    10 000 | 43.7 [40.3-44.5] | 51.1 [50.9-56.2] | 0.4 [0.4-0.6] | 207.4 [195.5-218.9] | 147.6 [142.6-152.3] | 359.7 [343.1-361.5] |
|   100 000 | 185.6 [182.9-190.3] | 270.8 [269.0-277.2] | 0.6 [0.4-1.2] | 620.3 [614.7-626.4] | 198.5 [194.0-206.2] | 824.9 [808.7-826.5] |
|   250 000 | 384.7 [384.1-392.5] | 649.8 [617.7-653.5] | 1.7 [1.1-2.2] | 1265.5 [1255.3-1287.2] | 294.3 [277.4-307.9] | 1563.2 [1559.8-1564.6] |
|   500 000 | 739.0 [723.1-743.5] | 1333.9 [1320.3-1339.7] | 0.8 [0.7-0.8] | 2391.1 [2382.1-2407.4] | 450.7 [450.2-455.4] | 2841.3 [2837.5-2858.1] |
| 1 000 000 | 1457.5 [1423.8-1459.4] | 2538.1 [2522.8-2602.4] | 0.7 [0.7-0.9] | 4535.6 [4521.3-4604.8] | 765.5 [756.2-773.0] | 5308.6 [5286.8-5361.0] |

| N samples | Max frame gap in run | Largest block | Post-result main-thread time | Probe median | Probe max | Playback frame median [min-max] | JS heap after (MB) |
| --------: | -------------------: | ------------: | ---------------------------: | -----------: | --------: | ------------------------------: | -----------------: |
|     1 000 | 17.4 [16.9-18.6] | 81 [78-92] | 81 [78-146] | 19.4 [18.2-23.3] | 150.1 [70.4-173.1] | 16.7 [16.6-16.7] | 7.2 |
|    10 000 | 18.2 [18.1-18.6] | 85 [84-86] | 149 [146-151] | 19.0 [16.4-19.1] | 182.5 [175.1-184.6] | 17.4 [16.9-18.2] | 8.5 |
|   100 000 | 20.2 [19.5-21.1] | 138 [138-139] | 259 [257-260] | 15.7 [15.2-16.9] | 297.7 [20.9-297.9] | 46.0 [45.8-46.2] | 18.0 |
|   250 000 | 19.8 [19.5-19.9] | 223 [222-229] | 405 [403-411] | 14.0 [13.6-14.2] | 267.9 [17.5-467.3] | 101.2 [101.1-102.7] | 32.9 |
|   500 000 | 20.2 [19.5-20.3] | 348 [346-350] | 637 [635-641] | 13.7 [13.5-13.8] | 17.5 [17.1-19.4] | 194.5 [194.2-194.6] | 59.7 |
| 1 000 000 | 20.1 [19.5-20.4] | 613 [609-624] | 1197 [1194-1208] | 13.1 [13.1-13.3] | 19.4 [18.4-19.4] | 377.4 [376.2-379.8] | 115.1 |

At 1 000 to 100 000 samples the probe maximum (150 to 298 ms in one repetition) is the same kind of
isolated round trip as in §3; probe timestamps are not recorded, so it is not placed against a
long task.

### 8.5 Do the decisions of §4 still read as decided?

This is a reading of the numbers for the owner, who re-confirms; neither value was changed.

- **Hard limit 1 000 000.** All 18 repetitions of the ladder succeeded; the engine and analysis in
  the worker take 4.0 s in total at the limit, the page stays responsive during that time (probe
  maximum 19 ms) and the main thread blocks for 0.6 s at most after the result. The limit is
  unchanged and still not shown unsafe on this machine. The 5.3 s click to first frame and the
  377 ms playback frame (about 2.6 frames per second) are the cost of a run at the ceiling.
- **Soft warning above 250 000.** The reason for the threshold, playback of about 100 ms per frame
  (about 10 frames per second), is unchanged because playback is rendering-bound (§3 item 4). At
  250 000 the post-result block is now 0.2 s (largest) and the click to first frame 1.6 s. The
  threshold reads as decided: nothing in the new numbers argues for moving it in either direction.
  The wait before the result appears now includes the analysis (about 0.65 s at 250 000); a user of
  the 30-day, 10 s scenario (259 201 samples) waits about 1.6 s.
- The §4 text that 0.3 s to 0.5 s of main-thread pause follows a result above 250 000 samples is
  superseded by the figures above (0.2 s to 0.6 s largest block between 250 000 and 1 000 000).

Limits of this section: one machine, one session, not quiesced; "before" only for three sizes;
software WebGL; process memory not measured (the worker's memory with the packed and the boxed
arrays was not observed); the screen-reader and real-GPU questions of §5 are unchanged.
