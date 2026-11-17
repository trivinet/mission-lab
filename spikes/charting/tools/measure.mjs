// Measurement harness (ML-TASK-030): first render, cursor update and JS heap per candidate.
//
//   npm run build && node tools/measure.mjs
//
// Env: SPIKE_REPS (default 3), SPIKE_TIMEOUT_MS (default 240000), SPIKE_SIZES (default
// n1e4,n2_5e5), SPIKE_MODES (default single,panel), SPIKE_LIBS (comma list of page names).
//
// Per configuration and repetition: a fresh page (cold JIT). The data file is fetched and parsed
// BEFORE timing starts (that cost is the app's worker/transfer path, not the chart's). The
// first-render clock starts just before the chart constructor(s) and stops two animation frames
// after they return and any promise they return has resolved. Cursor: 30 updates at spread
// times; `sync` = duration of the setCursor call, `frame` = call until the next animation frame.
// Heap: CDP JSHeapUsedSize after a forced GC, before the render and after it (JS heap only: GPU,
// canvas backing store and ArrayBuffers are NOT included). The ladder for a configuration stops
// at its first failed or timed-out repetition and that is reported as the result.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const REPS = Number(process.env.SPIKE_REPS ?? 3);
const TIMEOUT = Number(process.env.SPIKE_TIMEOUT_MS ?? 240000);
const SIZES = (process.env.SPIKE_SIZES ?? 'n1e4,n2_5e5').split(',');
const MODES = (process.env.SPIKE_MODES ?? 'single,panel').split(',');
const LIBS = (process.env.SPIKE_LIBS ?? 'uplot,echarts,echarts?cursor=zr,plotly,recharts').split(
  ',',
);
const BASE = 'http://localhost:5181';

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const server = spawn('npx', ['vite', 'preview'], { shell: true, stdio: 'ignore' });
for (let k = 0; k < 50; k += 1) {
  try {
    if ((await fetch(`${BASE}/index.html`)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch();
const env = {
  date: new Date().toISOString(),
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  logicalCpus: os.cpus().length,
  totalMemGB: +(os.totalmem() / 2 ** 30).toFixed(1),
  freeMemGBAtStart: +(os.freemem() / 2 ** 30).toFixed(1),
  node: process.version,
  chromium: browser.version(),
  note: 'headless, default flags, software WebGL; developer PC in normal use, not quiesced',
};
console.log(JSON.stringify(env));

async function oneRun(lib, dataset, mode) {
  const [name, query] = lib.split('?');
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize').value;
  };
  try {
    await page.goto(`${BASE}/${name}.html?manual=1${query ? '&' + query : ''}`);
    await page.waitForFunction(() => window.__spike);
    await page.evaluate((d) => window.__spike.preload(d), dataset);
    const before = await heap();
    const run = await page
      .evaluate(([d, m]) => window.__spike.render(d, m), [dataset, mode])
      .then(
        (r) => r,
        (e) => ({ error: String(e) }),
      );
    if (run.error) return { error: run.error };
    const after = await heap();
    const cur = await page.evaluate(() => window.__spike.measureCursor(30));
    const doVerify = mode === 'single' && (dataset !== 'n2_5e5' || name !== 'recharts');
    const verify = doVerify ? await page.evaluate(() => window.__spike.verify()) : [];
    const bad = verify.filter(
      (v) =>
        v.coastY.mismatches ||
        v.maneuveredY.mismatches ||
        v.coastX.mismatches ||
        v.maneuveredX.mismatches,
    );
    return {
      firstRender_ms: run.firstRender_ms,
      heapDelta_MB: (after - before) / 2 ** 20,
      cursorSync_ms: median(cur.sync),
      cursorFrame_ms: median(cur.frame),
      verifyCharts: verify.length,
      verifyMismatchCharts: bad.length,
    };
  } finally {
    await context.close();
  }
}

const results = [];
for (const dataset of SIZES) {
  for (const mode of MODES) {
    for (const lib of LIBS) {
      if (mode === 'panel' && lib.includes('cursor=zr')) continue;
      const reps = [];
      let failure = null;
      for (let r = 0; r < REPS; r += 1) {
        const started = Date.now();
        const out = await Promise.race([
          oneRun(lib, dataset, mode).catch((e) => ({ error: String(e) })),
          new Promise((res) =>
            setTimeout(() => res({ error: `timeout after ${TIMEOUT} ms` }), TIMEOUT),
          ),
        ]);
        if (out.error) {
          failure = { rep: r + 1, error: out.error, elapsed_ms: Date.now() - started };
          break;
        }
        reps.push(out);
      }
      const pick = (k) => reps.map((x) => x[k]);
      const row = { lib, dataset, mode, reps: reps.length, failure };
      if (reps.length) {
        for (const k of ['firstRender_ms', 'heapDelta_MB', 'cursorSync_ms', 'cursorFrame_ms']) {
          row[k] = {
            median: median(pick(k)),
            min: Math.min(...pick(k)),
            max: Math.max(...pick(k)),
            all: pick(k),
          };
        }
        row.verifyMismatchCharts = Math.max(...pick('verifyMismatchCharts'));
      }
      results.push(row);
      console.log(
        JSON.stringify({
          lib,
          dataset,
          mode,
          reps: reps.length,
          failure,
          med: reps.length
            ? {
                render: row.firstRender_ms.median.toFixed(0),
                heap: row.heapDelta_MB.median.toFixed(1),
                curSync: row.cursorSync_ms.median.toFixed(2),
                curFrame: row.cursorFrame_ms.median.toFixed(1),
              }
            : null,
        }),
      );
    }
  }
}
mkdirSync('out', { recursive: true });
writeFileSync(
  'out/measurements.json',
  JSON.stringify({ env, reps: REPS, timeout_ms: TIMEOUT, results }, null, 2),
);
await browser.close();
server.kill();
if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
