/**
 * Performance-envelope measurement harness (ML-TASK-026 part A1, ML-NFR-004). DEV/TEST ONLY: it
 * is run by `pnpm perf:envelope` (playwright.perf.config.ts), never by `pnpm test`, `pnpm
 * test:e2e` or CI, and it is not part of the shipped app.
 *
 * Method, per total sample count N and per repetition (at least 3):
 *  - a fresh browser context and page on the production build (so the worker starts cold and the
 *    run includes JIT warm-up, as a user's first run does), URL `/?sceneHook=1`;
 *  - the scenario is the product default with duration_s = N - 1 and outputStep_s = 1, giving
 *    exactly N samples (checked against the scene hook's source arrays);
 *  - the page records, in itself, the click time on Run, every result-state change, the arrival
 *    of every worker message (a wrapper around `Worker` added before the app loads), every
 *    requestAnimationFrame timestamp and every `longtask` entry;
 *  - the worker attaches `timing` (engine time, wall-clock post time) to its response
 *    (apps/web/src/worker/simulation.worker.ts); transfer time is main-thread receipt time minus
 *    the worker's post time (it therefore includes structured-clone/transfer and any main-thread
 *    queueing before the message event runs);
 *  - the first rendered frame is the first requestAnimationFrame after the result is current at
 *    which the scene hook reports N vertices (the Float32 arrays the renderer uploads);
 *  - responsiveness during the run: Playwright types into the scenario name while the state is
 *    "computing" and measures the round trip to the toolbar showing it (includes Playwright's own
 *    protocol latency, so it is an upper bound on the page's latency); the longest rAF gap and the
 *    longest long task in the click-to-current window are reported;
 *  - playback: rate 1 s/s, 3 s of playback, rAF frame intervals (median, p95, max);
 *  - heap: CDP `Performance.getMetrics` JSHeapUsedSize of the main page after a forced GC, before
 *    and after the run. The worker's heap and the transferred ArrayBuffers are NOT in that number.
 *
 * Sizes: PERF_SIZES (comma-separated, default below). Repetitions: PERF_REPS (default 3). The
 * ladder stops at the first size where a repetition fails (error state, crash or timeout); that
 * failure is recorded as a result. Raw JSON goes to PERF_OUT_DIR (default apps/web/perf/out).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SIZES = (process.env.PERF_SIZES ?? '1000,10000,100000,250000,500000,1000000')
  .split(',')
  .map((s) => Number(s.trim()));
const REPS = Number(process.env.PERF_REPS ?? '3');
const RUN_TIMEOUT_MS = Number(process.env.PERF_RUN_TIMEOUT_MS ?? '240000');
const OUT_DIR = process.env.PERF_OUT_DIR ?? path.join(import.meta.dirname, 'out');

interface PerfPage {
  clickAt: number | null;
  states: { state: string; at: number }[];
  messages: {
    type: string;
    at: number;
    timing?: { engine_ms: number; workerPostedAt_ms: number } | undefined;
  }[];
  frames: number[];
  longTasks: { start: number; duration: number }[];
  firstFrameAt: number | null;
  sceneVertices: number | null;
  sourceSamples: number | null;
  workerErrors: string[];
}

interface Rep {
  ok: boolean;
  failure?: string;
  n: number;
  // Latencies, ms.
  engine_ms?: number | undefined;
  transfer_ms?: number | undefined;
  clickToWorkerPost_ms?: number | undefined;
  clickToCurrent_ms?: number | undefined;
  currentToFirstFrame_ms?: number | undefined;
  clickToFirstFrame_ms?: number | undefined;
  maxFrameGapDuringRun_ms?: number | undefined;
  maxLongTaskDuringRun_ms?: number | undefined;
  totalLongTaskDuringRun_ms?: number | undefined;
  probeCount?: number | undefined;
  probeMedian_ms?: number | undefined;
  probeMax_ms?: number | undefined;
  playbackFrames?: number | undefined;
  playbackFrameMedian_ms?: number | undefined;
  playbackFrameP95_ms?: number | undefined;
  playbackFrameMax_ms?: number | undefined;
  heapBefore_MB?: number | undefined;
  heapAfter_MB?: number | undefined;
  sceneVertices?: number | undefined;
  sourceSamples?: number | undefined;
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? Number.NaN) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

function percentile(values: readonly number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? Number.NaN;
}

function intervals(times: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    out.push((times[i] ?? 0) - (times[i - 1] ?? 0));
  }
  return out;
}

async function installProbes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __perf: PerfPage };
    const now = (): number => performance.timeOrigin + performance.now();
    w.__perf = {
      clickAt: null,
      states: [],
      messages: [],
      frames: [],
      longTasks: [],
      firstFrameAt: null,
      sceneVertices: null,
      sourceSamples: null,
      workerErrors: [],
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        // Registered before the app sets onmessage, so it fires first.
        this.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as { type: string; timing?: PerfPage['messages'][0]['timing'] };
          w.__perf.messages.push({ type: data.type, at: now(), timing: data.timing });
        });
        this.addEventListener('error', (event: ErrorEvent) => {
          w.__perf.workerErrors.push(event.message);
        });
      }
    };
    const tick = (): void => {
      w.__perf.frames.push(now());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__perf.longTasks.push({
            start: performance.timeOrigin + entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask unsupported: the field stays empty and the report says so through zeros.
    }
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        if (target?.closest('[data-testid="run-button"]') !== null && target !== null) {
          w.__perf.clickAt = now();
        }
      },
      true,
    );
    // The element does not exist yet when this script runs: observe the whole document.
    new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as Element;
        if (target.getAttribute('data-testid') === 'result-state') {
          w.__perf.states.push({ state: target.getAttribute('data-state') ?? '', at: now() });
        }
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
  });
}

/** Resolves once the first rAF after the state is current at which the hook shows n vertices. */
async function waitFirstFrame(page: Page, n: number, timeout_ms: number): Promise<void> {
  await page.evaluate(
    ({ n: expected, timeout }) =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as {
          __perf: PerfPage;
          __missionLabScene?: {
            get: () => {
              segments: { vertices: Float32Array }[];
              sourcePosition_m: Float64Array[] | null;
            };
          };
        };
        const deadline = performance.now() + timeout;
        const poll = (): void => {
          const state = w.__missionLabScene?.get();
          if (state !== undefined) {
            const vertices = state.segments.reduce((a, s) => a + s.vertices.length / 3, 0);
            if (vertices === expected) {
              w.__perf.firstFrameAt = performance.timeOrigin + performance.now();
              w.__perf.sceneVertices = vertices;
              w.__perf.sourceSamples = (state.sourcePosition_m ?? []).reduce(
                (a, p) => a + p.length / 3,
                0,
              );
              resolve();
              return;
            }
          }
          if (performance.now() > deadline) {
            reject(new Error('scene never showed the expected vertex count'));
            return;
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }),
    { n, timeout: timeout_ms },
  );
}

async function measureOnce(browser: import('@playwright/test').Browser, n: number): Promise<Rep> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const flags = { crashed: false };
  page.on('crash', () => {
    flags.crashed = true;
  });
  try {
    await installProbes(page);
    await page.goto('/?sceneHook=1');
    await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'none');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const heapMB = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage');
      const { metrics } = await cdp.send('Performance.getMetrics');
      return (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? Number.NaN) / 1e6;
    };
    const heapBefore_MB = await heapMB();

    await page.getByTestId('input-duration').fill(String(n - 1));
    await page.getByTestId('input-step').fill('1');
    await page.getByTestId('run-button').click();

    // Probe the main thread while the run is in progress.
    const probes: number[] = [];
    const state = page.getByTestId('result-state');
    const deadline = Date.now() + RUN_TIMEOUT_MS;
    let final = '';
    while (Date.now() < deadline && !flags.crashed) {
      const current = (await state.getAttribute('data-state', { timeout: 30_000 })) ?? '';
      if (current === 'current' || current === 'error') {
        final = current;
        break;
      }
      if (current === 'computing' && probes.length < 100) {
        const label = `probe ${String(probes.length)}`;
        const t0 = performance.now();
        await page.getByTestId('input-name').fill(label);
        await expect(page.getByTestId('scenario-name')).toHaveText(label, { timeout: 60_000 });
        probes.push(performance.now() - t0);
      } else {
        await page.waitForTimeout(50);
      }
    }
    if (flags.crashed) {
      return { ok: false, n, failure: 'the browser tab crashed' };
    }
    if (final === 'error') {
      const banner = await page.getByTestId('result-banner').textContent();
      return { ok: false, n, failure: `result state error: ${banner ?? ''}`.slice(0, 300) };
    }
    if (final !== 'current') {
      return { ok: false, n, failure: `no result within ${String(RUN_TIMEOUT_MS)} ms` };
    }

    await waitFirstFrame(page, n, 120_000);
    const heapAfter_MB = await heapMB();

    // Playback at 1 s/s for 3 s.
    await page.getByTestId('playback-rate').selectOption('1');
    const playStart = await page.evaluate(() => performance.timeOrigin + performance.now());
    await page.getByTestId('playback-toggle').click();
    await page.waitForTimeout(3000);
    const playEnd = await page.evaluate(() => performance.timeOrigin + performance.now());
    await page.getByTestId('playback-toggle').click();

    const perf = await page.evaluate(() => (window as unknown as { __perf: PerfPage }).__perf);
    const clickAt = perf.clickAt ?? Number.NaN;
    const resultMsg = perf.messages.find((m) => m.type === 'result');
    const currentAt = perf.states.find((s) => s.state === 'current')?.at ?? Number.NaN;
    const firstFrameAt = perf.firstFrameAt ?? Number.NaN;
    const runFrames = perf.frames.filter((t) => t >= clickAt && t <= currentAt);
    const runGaps = intervals(runFrames);
    const longInRun = perf.longTasks.filter((t) => t.start >= clickAt && t.start <= firstFrameAt);
    const playFrames = intervals(perf.frames.filter((t) => t >= playStart && t <= playEnd));

    return {
      ok: true,
      n,
      engine_ms: resultMsg?.timing?.engine_ms,
      transfer_ms:
        resultMsg?.timing === undefined
          ? undefined
          : resultMsg.at - resultMsg.timing.workerPostedAt_ms,
      clickToWorkerPost_ms:
        resultMsg?.timing === undefined ? undefined : resultMsg.timing.workerPostedAt_ms - clickAt,
      clickToCurrent_ms: currentAt - clickAt,
      currentToFirstFrame_ms: firstFrameAt - currentAt,
      clickToFirstFrame_ms: firstFrameAt - clickAt,
      maxFrameGapDuringRun_ms: runGaps.length === 0 ? undefined : Math.max(...runGaps),
      maxLongTaskDuringRun_ms:
        longInRun.length === 0 ? 0 : Math.max(...longInRun.map((t) => t.duration)),
      totalLongTaskDuringRun_ms: longInRun.reduce((a, t) => a + t.duration, 0),
      probeCount: probes.length,
      probeMedian_ms: probes.length === 0 ? undefined : median(probes),
      probeMax_ms: probes.length === 0 ? undefined : Math.max(...probes),
      playbackFrames: playFrames.length,
      playbackFrameMedian_ms: playFrames.length === 0 ? undefined : median(playFrames),
      playbackFrameP95_ms: playFrames.length === 0 ? undefined : percentile(playFrames, 0.95),
      playbackFrameMax_ms: playFrames.length === 0 ? undefined : Math.max(...playFrames),
      heapBefore_MB,
      heapAfter_MB,
      sceneVertices: perf.sceneVertices ?? undefined,
      sourceSamples: perf.sourceSamples ?? undefined,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      n,
      failure: `${flags.crashed ? 'tab crashed; ' : ''}${detail}`.slice(0, 300),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

const METRICS: readonly (keyof Rep)[] = [
  'engine_ms',
  'transfer_ms',
  'clickToCurrent_ms',
  'currentToFirstFrame_ms',
  'clickToFirstFrame_ms',
  'maxFrameGapDuringRun_ms',
  'maxLongTaskDuringRun_ms',
  'totalLongTaskDuringRun_ms',
  'probeMedian_ms',
  'probeMax_ms',
  'playbackFrameMedian_ms',
  'playbackFrameP95_ms',
  'playbackFrameMax_ms',
  'heapBefore_MB',
  'heapAfter_MB',
];

function summarise(
  reps: readonly Rep[],
): Record<string, { median: number; min: number; max: number }> {
  const out: Record<string, { median: number; min: number; max: number }> = {};
  for (const key of METRICS) {
    const values = reps
      .filter((r) => r.ok)
      .map((r) => r[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length > 0) {
      out[key] = { median: median(values), min: Math.min(...values), max: Math.max(...values) };
    }
  }
  return out;
}

const results: { n: number; reps: Rep[]; summary: ReturnType<typeof summarise> }[] = [];
let stopped = false;
let environment: Record<string, unknown> = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const pw = JSON.parse(
    readFileSync(
      path.join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        'node_modules',
        '@playwright',
        'test',
        'package.json',
      ),
      'utf8',
    ),
  ) as { version: string };
  const page = await browser.newPage();
  await page.goto('/');
  const gl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (ctx === null) {
      return 'unavailable';
    }
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    return ext === null ? 'unavailable' : String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  });
  const ua = await page.evaluate(() => navigator.userAgent);
  await page.close();
  const cpus = os.cpus();
  environment = {
    startedAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    cpu: cpus[0]?.model ?? 'unknown',
    logicalCpus: cpus.length,
    ramTotal_GB: Number((os.totalmem() / 2 ** 30).toFixed(1)),
    ramFreeAtStart_GB: Number((os.freemem() / 2 ** 30).toFixed(1)),
    node: process.version,
    playwright: pw.version,
    browser: `${browser.browserType().name()} ${browser.version()}`,
    userAgent: ua,
    webglRenderer: gl,
    sizes: SIZES,
    repetitions: REPS,
    note: 'Single developer PC, not idle, headless Chromium. See docs/verification/performance-envelope.md.',
  };
});

for (const n of SIZES) {
  test(`envelope: N = ${String(n)} samples`, async ({ browser }) => {
    test.skip(stopped, 'an earlier size failed; the ladder stops at the first clear failure');
    const reps: Rep[] = [];
    for (let i = 0; i < REPS; i += 1) {
      const rep = await measureOnce(browser, n);
      reps.push(rep);
      console.log(`N=${String(n)} rep ${String(i + 1)}: ${JSON.stringify(rep)}`);
      if (!rep.ok) {
        stopped = true;
        break;
      }
    }
    results.push({ n, reps, summary: summarise(reps) });
    // A failure is a result, not a harness error: it is recorded and the ladder stops.
    expect(reps.length).toBeGreaterThan(0);
  });
}

test.afterAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(
    OUT_DIR,
    `envelope-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(file, JSON.stringify({ environment, results }, null, 2));
  console.log(`raw data: ${file}`);
  console.log(
    '| N | reps ok | engine | transfer | click->current | current->frame | click->frame | max rAF gap in run | max long task | probe median | probe max | playback frame med/p95/max | heap before->after (MB) |',
  );
  for (const r of results) {
    const s = r.summary;
    const f = (k: string): string =>
      s[k] === undefined
        ? '-'
        : `${s[k].median.toFixed(1)} [${s[k].min.toFixed(1)}-${s[k].max.toFixed(1)}]`;
    const failed = r.reps.find((x) => !x.ok);
    console.log(
      `| ${String(r.n)} | ${String(r.reps.filter((x) => x.ok).length)}/${String(r.reps.length)}${failed ? ` FAIL: ${failed.failure ?? ''}` : ''} | ${f('engine_ms')} | ${f('transfer_ms')} | ${f('clickToCurrent_ms')} | ${f('currentToFirstFrame_ms')} | ${f('clickToFirstFrame_ms')} | ${f('maxFrameGapDuringRun_ms')} | ${f('maxLongTaskDuringRun_ms')} | ${f('probeMedian_ms')} | ${f('probeMax_ms')} | ${f('playbackFrameMedian_ms')} / ${f('playbackFrameP95_ms')} / ${f('playbackFrameMax_ms')} | ${f('heapBefore_MB')} -> ${f('heapAfter_MB')} |`,
    );
  }
});
