// Generates the spike's data from REAL engine runs (@mission-lab/simulation, runSimulation).
//
//   npm run data            (from spikes/charting, after `npm install`; the repository root must have
//                            been installed with `pnpm install` so the engine's own dependencies exist)
//
// The engine is TypeScript with extensionless imports, so it is bundled with esbuild (a spike
// dev dependency) into .build/ and imported from there. Nothing under packages/ is modified.
//
// Derived series (radius, altitude, speed, elements) are computed HERE from the engine's
// samples with the engine's own `stateToElements`. This is a stand-in for the analysis module
// (ML-TASK-031, not yet built). The values are NOT reference values: the spike only checks that
// a chart displays whatever numbers it is given (VI-03 plumbing), never that they are correct.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const outDir = path.resolve(here, '..', 'data');
const buildDir = path.resolve(here, '..', 'node_modules', '.spike-build');
mkdirSync(outDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });

const entry = path.join(buildDir, 'engine-entry.js');
writeFileSync(
  entry,
  `export { runSimulation, buildSimulationRequest, DEGENERACY_THRESHOLDS } from '@mission-lab/simulation';
export { stateToElements, EARTH_CONSTANTS } from '@mission-lab/astrodynamics';
`,
);
const bundled = path.join(buildDir, 'engine.mjs');
await build({
  entryPoints: [entry],
  outfile: bundled,
  bundle: true,
  format: 'esm',
  platform: 'node',
  alias: {
    '@mission-lab/simulation': path.join(root, 'packages/simulation/src/index.ts'),
    '@mission-lab/astrodynamics': path.join(root, 'packages/astrodynamics/src/index.ts'),
    '@mission-lab/contracts': path.join(root, 'packages/contracts/src/index.ts'),
  },
  nodePaths: [path.join(root, 'packages/contracts/node_modules')],
  logLevel: 'error',
});
const engine = await import(pathToFileURL(bundled).href);

/** The product default scenario (apps/web/src/state/default-scenario.ts), with overrides. */
function scenario(duration_s, outputStep_s, maneuvers) {
  return {
    schemaVersion: '1.0',
    id: 'spike-scenario',
    name: 'Charting spike',
    centralBody: 'EARTH',
    frame: 'GCRF',
    epoch: { scale: 'UTC', iso: '2026-01-01T00:00:00.000Z' },
    initialOrbit: {
      kind: 'KEPLERIAN',
      elements: {
        semiMajorAxis_m: 7_000_000,
        eccentricity: 0.01,
        inclination_rad: Math.PI / 4,
        raan_rad: 0,
        argPeriapsis_rad: 0,
        trueAnomaly_rad: 0,
      },
    },
    maneuvers,
    duration_s,
    outputStep_s,
  };
}

const RAD_TO_DEG = 180 / Math.PI; // display-unit conversion only (spike stand-in for the formatter)

const SERIES = [
  { key: 'radius_km', label: 'Radius', unit: 'km' },
  { key: 'altitude_km', label: 'Altitude', unit: 'km' },
  { key: 'speed_kmps', label: 'Speed', unit: 'km/s' },
  { key: 'trueAnomaly_deg', label: 'True anomaly', unit: 'deg' },
  { key: 'a_km', label: 'Semi-major axis', unit: 'km' },
  { key: 'e', label: 'Eccentricity', unit: '-' },
  { key: 'i_deg', label: 'Inclination', unit: 'deg' },
  { key: 'raan_deg', label: 'RAAN', unit: 'deg' },
];

/** Columns for one run: t_s plus every series, concatenated over segments (no gap element). */
function columns(result) {
  const mu = engine.EARTH_CONSTANTS.mu_m3ps2;
  const re = engine.EARTH_CONSTANTS.referenceRadius_m;
  const n = result.segments.reduce((s, seg) => s + seg.t_s.length, 0);
  const t = new Float64Array(n);
  const cols = Object.fromEntries(SERIES.map((s) => [s.key, new Float64Array(n)]));
  let k = 0;
  for (const seg of result.segments) {
    for (let j = 0; j < seg.t_s.length; j += 1) {
      const p = [seg.position_m[3 * j], seg.position_m[3 * j + 1], seg.position_m[3 * j + 2]];
      const v = [seg.velocity_mps[3 * j], seg.velocity_mps[3 * j + 1], seg.velocity_mps[3 * j + 2]];
      const r = Math.hypot(...p);
      const sp = Math.hypot(...v);
      const el = engine.stateToElements(
        { position_m: p, velocity_mps: v },
        mu,
        engine.DEGENERACY_THRESHOLDS,
      );
      if (!el.ok) throw new Error('stateToElements failed: ' + el.reason);
      t[k] = seg.t_s[j];
      cols.radius_km[k] = r / 1000;
      cols.altitude_km[k] = (r - re) / 1000;
      cols.speed_kmps[k] = sp / 1000;
      cols.trueAnomaly_deg[k] = el.elements.trueAnomaly_rad * RAD_TO_DEG;
      cols.a_km[k] = el.elements.semiMajorAxis_m / 1000;
      cols.e[k] = el.elements.eccentricity;
      cols.i_deg[k] = el.elements.inclination_rad * RAD_TO_DEG;
      cols.raan_deg[k] = el.elements.raan_rad * RAD_TO_DEG;
      k += 1;
    }
  }
  return { n, t, cols, segLengths: result.segments.map((s) => s.t_s.length) };
}

function run(sc) {
  const built = engine.buildSimulationRequest(sc);
  if (!built.ok) throw new Error('request rejected ' + JSON.stringify(built.issues));
  const out = engine.runSimulation(built.value);
  if (!out.ok) throw new Error('run rejected ' + JSON.stringify(out.issues));
  if (out.value.status !== 'ok')
    throw new Error('run failed ' + JSON.stringify(out.value.diagnostics));
  return out.value;
}

const DATASETS = [
  { name: 'small', duration_s: 6000, step_s: 60, burn_t_s: 3000 }, // product default, 101 samples
  { name: 'n1e4', duration_s: 9999, step_s: 1, burn_t_s: 5000 }, // about 1e4 points per series
  { name: 'n2_5e5', duration_s: 249_999, step_s: 1, burn_t_s: 125_000 }, // 250 000 samples (soft-warning size)
];

const manifest = {
  generatedBy: 'spikes/charting/tools/gen-data.mjs',
  series: SERIES,
  datasets: {},
};

for (const d of DATASETS) {
  const burn = { id: 'burn-1', t_s: d.burn_t_s, frame: 'RSW', deltaV_mps: [0, 200, 0] };
  const coast = run(scenario(d.duration_s, d.step_s, []));
  const maneuvered = run(scenario(d.duration_s, d.step_s, [burn]));
  const ev = maneuvered.events[0];
  const info = {
    duration_s: d.duration_s,
    step_s: d.step_s,
    burn_t_s: ev.t_s,
    deltaV_RSW_mps: burn.deltaV_mps,
    runs: {},
  };
  for (const [runName, result] of [
    ['coast', coast],
    ['maneuvered', maneuvered],
  ]) {
    const c = columns(result);
    const parts = [c.t, ...SERIES.map((s) => c.cols[s.key])];
    const total = new Float64Array(parts.length * c.n);
    parts.forEach((p, idx) => total.set(p, idx * c.n));
    writeFileSync(path.join(outDir, `${d.name}.${runName}.f64`), Buffer.from(total.buffer));
    info.runs[runName] = { n: c.n, segLengths: c.segLengths, requestId: result.requestId };
  }
  manifest.datasets[d.name] = info;
  console.log(d.name, JSON.stringify(info));
}
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
