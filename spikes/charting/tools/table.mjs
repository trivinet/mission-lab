// Prints the measurement table (medians, with min-max) from out/measurements.json as Markdown.
import { readFileSync } from 'node:fs';

const {
  env,
  reps,
  timeout_ms: timeout,
  results,
} = JSON.parse(readFileSync(process.argv[2] ?? 'results/measurements.json', 'utf8'));
const NAMES = {
  uplot: 'uPlot',
  echarts: 'ECharts (cursor: setOption graphic)',
  'echarts?cursor=zr': 'ECharts (cursor: zrender line)',
  plotly: 'Plotly basic',
  recharts: 'Recharts',
};
const f = (s, d = 0) =>
  s ? `${s.median.toFixed(d)} (${s.min.toFixed(d)}-${s.max.toFixed(d)})` : 'n/a';
console.log(JSON.stringify(env));
console.log(`repetitions: ${reps}, timeout per run: ${timeout} ms\n`);
for (const mode of ['single', 'panel']) {
  for (const dataset of ['small', 'n1e4', 'n2_5e5']) {
    if (!results.some((x) => x.mode === mode && x.dataset === dataset)) continue;
    console.log(`\n### ${mode}, ${dataset}\n`);
    console.log(
      '| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |',
    );
    console.log('|---|---|---|---|---|');
    for (const r of results.filter((x) => x.mode === mode && x.dataset === dataset)) {
      if (r.failure) {
        console.log(
          `| ${NAMES[r.lib]} | no result: ${r.failure.error} on rep ${r.failure.rep} | | | |`,
        );
      } else {
        console.log(
          `| ${NAMES[r.lib]} | ${f(r.firstRender_ms)} | ${f(r.cursorSync_ms, 1)} | ${f(r.cursorFrame_ms, 1)} | ${f(r.heapDelta_MB, 1)} |`,
        );
      }
    }
  }
}
console.log('\nObject.is read-back mismatching charts (single mode, where run):');
for (const r of results.filter((x) => x.mode === 'single'))
  console.log(`${r.lib} ${r.dataset}: ${r.verifyMismatchCharts ?? 'not run'}`);
