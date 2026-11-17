import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

// Serves ./data (engine output) at /data without copying the 18 MB files into dist/.
const serveData = () => {
  const handler = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/data/')) return next();
    const file = path.join(root, 'data', path.basename(url));
    if (!existsSync(file)) return next();
    res.setHeader(
      'Content-Type',
      file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
    );
    createReadStream(file).pipe(res);
  };
  return {
    name: 'spike-serve-data',
    configureServer(s) {
      s.middlewares.use(handler);
    },
    configurePreviewServer(s) {
      s.middlewares.use(handler);
    },
  };
};

export default defineConfig({
  root,
  publicDir: false,
  plugins: [serveData()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.join(root, 'index.html'),
        uplot: path.join(root, 'uplot.html'),
        echarts: path.join(root, 'echarts.html'),
        plotly: path.join(root, 'plotly.html'),
        recharts: path.join(root, 'recharts.html'),
      },
    },
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
});
