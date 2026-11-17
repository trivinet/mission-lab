// Loads the engine-generated spike data (see tools/gen-data.mjs) and shapes it for the charts.
// No physics here: the arrays are exactly what the generator wrote (binary64, little endian).

/** @typedef {{key:string,label:string,unit:string}} SeriesMeta */

let manifestPromise;
const datasetCache = new Map();

export function loadManifest() {
  manifestPromise ??= fetch('/data/manifest.json').then((r) => r.json());
  return manifestPromise;
}

/**
 * @param {string} name 'small' | 'n1e4' | 'n2_5e5'
 * @returns {Promise<{meta:object, series:SeriesMeta[], runs:{coast:Run, maneuvered:Run}}>}
 */
export async function loadDataset(name) {
  if (datasetCache.has(name)) return datasetCache.get(name);
  const manifest = await loadManifest();
  const meta = manifest.datasets[name];
  if (!meta) throw new Error('unknown dataset ' + name);
  const runs = {};
  for (const runName of ['coast', 'maneuvered']) {
    const info = meta.runs[runName];
    const buf = await (await fetch(`/data/${name}.${runName}.f64`)).arrayBuffer();
    const all = new Float64Array(buf);
    const n = info.n;
    const t = all.subarray(0, n);
    const cols = {};
    manifest.series.forEach((s, i) => {
      cols[s.key] = all.subarray((i + 1) * n, (i + 2) * n);
    });
    runs[runName] = { n, t, cols, segLengths: info.segLengths };
  }
  const out = { meta, series: manifest.series, runs };
  // The maneuvered run shares the coast grid: the burn sample is stored at the end of segment 0
  // and again at the start of segment 1, so n_maneuvered = n_coast + 1.
  const [n0, n1] = runs.maneuvered.segLengths;
  if (n0 + n1 !== runs.coast.n + 1) throw new Error('unexpected sample layout');
  datasetCache.set(name, out);
  return out;
}

/**
 * Chart inputs for one quantity. All arrays are views on the engine data (no copy, no change).
 * @param {Awaited<ReturnType<typeof loadDataset>>} ds
 * @param {SeriesMeta} s
 */
export function chartInput(ds, s) {
  const { coast, maneuvered } = ds.runs;
  return {
    key: s.key,
    label: s.label,
    unit: s.unit,
    burnT_s: ds.meta.burn_t_s,
    tMax_s: ds.meta.duration_s,
    coast: { t: coast.t, y: coast.cols[s.key] },
    maneuvered: {
      t: maneuvered.t,
      y: maneuvered.cols[s.key],
      segLengths: maneuvered.segLengths,
    },
  };
}

/**
 * Split-segment view used by libraries whose rows share one x grid (uPlot, Recharts): the
 * maneuvered run as two aligned arrays on the coast grid, null where a segment is absent.
 * Segment 0 covers indices 0..n0-1, segment 1 covers n0-1..n-1 (the burn sample belongs to both).
 * Values are the engine's numbers, copied bit for bit.
 */
export function alignedOnCoastGrid(input) {
  const n = input.coast.t.length;
  const [n0, n1] = input.maneuvered.segLengths;
  const pre = new Array(n).fill(null);
  const post = new Array(n).fill(null);
  for (let k = 0; k < n0; k += 1) pre[k] = input.maneuvered.y[k];
  for (let k = 0; k < n1; k += 1) post[n0 - 1 + k] = input.maneuvered.y[n0 + k];
  return { n, n0, n1, pre, post };
}

/**
 * Single-array view with an explicit gap element (ECharts, Plotly): x and y with one extra
 * element between the segments whose y is null. The gap element carries x = burn time.
 */
export function withGapElement(input) {
  const [n0, n1] = input.maneuvered.segLengths;
  const m = n0 + 1 + n1;
  const x = new Array(m);
  const y = new Array(m);
  for (let k = 0; k < n0; k += 1) {
    x[k] = input.maneuvered.t[k];
    y[k] = input.maneuvered.y[k];
  }
  x[n0] = input.burnT_s;
  y[n0] = null;
  for (let k = 0; k < n1; k += 1) {
    x[n0 + 1 + k] = input.maneuvered.t[n0 + k];
    y[n0 + 1 + k] = input.maneuvered.y[n0 + k];
  }
  return { x, y, gapIndex: n0 };
}

/**
 * Compare read-back plotted values with the engine's numbers, `Object.is` per value (VI-03
 * plumbing, tolerances.md section 1). `plotted` is a list of numbers and nulls (null = gap).
 * Returns counts; the null entries are the gaps and are not compared.
 */
export function compareExact(plotted, engineValues) {
  const finite = plotted.filter((v) => v !== null && !(typeof v === 'number' && Number.isNaN(v)));
  let mismatches = 0;
  if (finite.length !== engineValues.length)
    mismatches = Math.abs(finite.length - engineValues.length);
  const m = Math.min(finite.length, engineValues.length);
  for (let k = 0; k < m; k += 1) {
    if (!Object.is(finite[k], engineValues[k])) mismatches += 1;
  }
  return {
    plottedPoints: finite.length,
    enginePoints: engineValues.length,
    gaps: plotted.length - finite.length,
    mismatches,
  };
}
