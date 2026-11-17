// Bundle size per candidate: minified and gzipped (zlib level 9) JavaScript + CSS, measured by
// bundling a tiny entry that imports exactly what the spike adapter imports. Run: node tools/size.mjs
// Recharts is reported with and without React (the app already ships React, so the increment is
// the "react external" figure). The same bundler (esbuild) and settings are used for all.
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const entries = {
  uPlot: `import uPlot from 'uplot'; import 'uplot/dist/uPlot.min.css'; globalThis.x = uPlot;`,
  'ECharts (tree-shaken, as the spike imports it)': `
    import { LineChart } from 'echarts/charts';
    import { GraphicComponent, GridComponent, LegendComponent, MarkLineComponent } from 'echarts/components';
    import * as echarts from 'echarts/core';
    import { CanvasRenderer } from 'echarts/renderers';
    echarts.use([LineChart, GridComponent, LegendComponent, MarkLineComponent, GraphicComponent, CanvasRenderer]);
    globalThis.x = echarts;`,
  'ECharts (full import)': `import * as echarts from 'echarts'; globalThis.x = echarts;`,
  'Plotly basic (plotly.js-basic-dist-min)': `import Plotly from 'plotly.js-basic-dist-min'; globalThis.x = Plotly;`,
  'Recharts (React external)': {
    code: `import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
      globalThis.x = [CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis];`,
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'react-is'],
  },
  'Recharts + react + react-dom (all bundled)': {
    code: `import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
      import { createRoot } from 'react-dom/client';
      globalThis.x = [CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis, createRoot];`,
  },
};

const kb = (n) => +(n / 1000).toFixed(1);
const rows = [];
for (const [name, spec] of Object.entries(entries)) {
  const { code, external = [] } = typeof spec === 'string' ? { code: spec } : spec;
  const out = await build({
    stdin: { contents: code, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    minify: true,
    write: false,
    outdir: 'out/size',
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  let raw = 0;
  let gz = 0;
  let br = 0;
  for (const f of out.outputFiles) {
    raw += f.contents.length;
    gz += gzipSync(f.contents, { level: 9 }).length;
    br += brotliCompressSync(f.contents).length;
  }
  rows.push({ name, min_kB: kb(raw), gzip_kB: kb(gz), brotli_kB: kb(br) });
}
console.log(
  JSON.stringify({ measuredAt: new Date().toISOString(), unit: 'kB = 1000 bytes', rows }, null, 2),
);
