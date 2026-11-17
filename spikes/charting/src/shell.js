// Shared page shell for the four spike pages. Each page supplies an adapter:
//   adapter.create(container, input, opts) -> { ready: Promise, setCursor(t_s), destroy(), readback() }
// readback() returns { coast: {x, y}, maneuvered: {x, y} } read from the LIBRARY'S OWN state
// (not from the arrays this shell built), with null where the library holds a gap.
//
// Test hook: window.__spike (used by tools/measure.mjs and by hand in the console).
import { alignedOnCoastGrid, chartInput, compareExact, loadDataset } from './data.js';

// design-tokens.md (approved 2026-11-16): colours for the dark workspace.
export const THEME = {
  bgPanel: '#151b23',
  border: '#2f3b4a',
  text: '#e6edf3',
  text2: '#a8b3c0',
  coast: '#a8b3c0', // dashed grey
  maneuver: '#3dd6c6', // solid teal
  marker: '#ffb454', // maneuver marker
  cursor: '#e6edf3',
  font: 'system-ui, "Segoe UI", sans-serif',
};

const params = new URLSearchParams(location.search);

/** @param {string} lib @param {{create:Function}} adapter */
export function runPage(lib, adapter) {
  document.title = `${lib} charting spike`;
  document.body.style.cssText = `margin:0;background:#0d1117;color:${THEME.text};font:13px ${THEME.font}`;
  document.body.innerHTML = `
    <header style="display:flex;gap:16px;align-items:center;padding:8px 12px;border-bottom:1px solid ${THEME.border};flex-wrap:wrap">
      <h1 style="font-size:14px;margin:0">${lib} spike (ML-TASK-030)</h1>
      <label>Dataset <select id="dataset"><option value="small">small (101 samples)</option>
        <option value="n1e4">n1e4 (about 1e4)</option><option value="n2_5e5">n2_5e5 (250 000)</option></select></label>
      <label>Mode <select id="mode"><option value="single">single chart (speed)</option>
        <option value="panel">panel (8 quantities)</option></select></label>
      <label>Cursor t <input id="cursor" type="range" min="0" max="1" step="0.001" value="0.3" style="vertical-align:middle">
        <output id="cursorOut" style="font-family:ui-monospace,Consolas,monospace"></output></label>
      <span id="status" role="status" style="color:${THEME.text2}"></span>
    </header>
    <main id="charts" style="padding:12px;display:grid;gap:8px"></main>`;
  const $ = (id) => document.getElementById(id);
  const state = { dataset: params.get('dataset') ?? 'small', mode: params.get('mode') ?? 'single' };
  $('dataset').value = state.dataset;
  $('mode').value = state.mode;

  /** @type {{chart:any,input:any}[]} */
  let charts = [];
  let current = null; // dataset in use
  let cursorT = 0;

  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

  async function destroy() {
    for (const c of charts) c.chart.destroy();
    charts = [];
    $('charts').replaceChildren();
  }

  /** @returns {Promise<{firstRender_ms:number, charts:number}>} */
  async function render(dataset = state.dataset, mode = state.mode) {
    await destroy();
    state.dataset = dataset;
    state.mode = mode;
    current = await loadDataset(dataset); // fetch + parse excluded from the timing
    const metas =
      mode === 'panel' ? current.series : current.series.filter((s) => s.key === 'speed_kmps');
    const host = $('charts');
    host.style.gridTemplateColumns = mode === 'panel' ? 'repeat(2, minmax(0, 1fr))' : '1fr';
    const width = mode === 'panel' ? 620 : 980;
    const height = mode === 'panel' ? 230 : 400;
    cursorT = 0.3 * current.meta.duration_s;
    const containers = metas.map(() => {
      const el = document.createElement('div');
      el.style.cssText = `background:${THEME.bgPanel};border:1px solid ${THEME.border};width:${width}px;height:${height}px;position:relative`;
      host.appendChild(el);
      return el;
    });
    await raf();
    const t0 = performance.now();
    const made = metas.map((s, i) => {
      const input = chartInput(current, s);
      const chart = adapter.create(containers[i], input, {
        width,
        height,
        theme: THEME,
        cursorT_s: cursorT,
      });
      return { chart, input };
    });
    charts = made;
    await Promise.all(made.map((m) => m.chart.ready));
    await raf();
    await raf(); // two frames: the chart is committed and painted
    const firstRender_ms = performance.now() - t0;
    $('status').textContent =
      `${lib}: ${made.length} chart(s), ${current.runs.maneuvered.n} points/series, first render ${firstRender_ms.toFixed(0)} ms`;
    syncSlider();
    return { firstRender_ms, charts: made.length };
  }

  function syncSlider() {
    const tMax = current?.meta.duration_s ?? 1;
    $('cursor').value = String(cursorT / tMax);
    $('cursorOut').textContent = `${cursorT.toFixed(0)} s`;
  }

  /** Move the external time cursor (playback t_s) on every chart. Synchronous call. */
  function setCursor(t_s) {
    cursorT = t_s;
    for (const c of charts) c.chart.setCursor(t_s);
    $('cursorOut').textContent = `${t_s.toFixed(0)} s`;
  }

  /** Cursor cost: `count` updates spread over the run. sync = call duration; frame = call to next frame. */
  async function measureCursor(count = 30) {
    const tMax = current.meta.duration_s;
    const sync = [];
    const frame = [];
    const began = performance.now();
    for (let k = 0; k < count; k += 1) {
      if (k >= 3 && performance.now() - began > 20000) break; // very slow chart: report what was measured
      const t = ((k * 0.61803398875) % 1) * tMax; // spread, not monotonic
      const s = performance.now();
      setCursor(t);
      sync.push(performance.now() - s);
      await raf();
      frame.push(performance.now() - s);
    }
    return { sync, frame };
  }

  /** Object.is comparison of what each chart holds against the engine's numbers (VI-03 plumbing). */
  function verify() {
    const out = [];
    for (const { chart, input } of charts) {
      const rb = chart.readback();
      const ds = current.runs;
      const coastCmp = compareExact(rb.coast.y, ds.coast.cols[input.key]);
      const manCmp = compareExact(rb.maneuvered.y, ds.maneuvered.cols[input.key]);
      const coastX = compareExact(rb.coast.x, ds.coast.t);
      const manX = compareExact(rb.maneuvered.x, ds.maneuvered.t);
      out.push({
        key: input.key,
        coastY: coastCmp,
        maneuveredY: manCmp,
        coastX,
        maneuveredX: manX,
      });
    }
    return out;
  }

  window.__spike = {
    lib,
    preload: (d) => loadDataset(d).then(() => true),
    render,
    destroy,
    setCursor,
    measureCursor,
    verify,
    get state() {
      return state;
    },
  };

  $('dataset').addEventListener('change', (e) => void render(e.target.value, state.mode));
  $('mode').addEventListener('change', (e) => void render(state.dataset, e.target.value));
  $('cursor').addEventListener('input', (e) => {
    if (current) setCursor(Number(e.target.value) * current.meta.duration_s);
  });
  if (params.get('manual') !== '1') void render();
}

export { alignedOnCoastGrid };
