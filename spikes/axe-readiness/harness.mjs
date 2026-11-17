// Shared harness for the ML-TASK-040 accessibility review. Throwaway, not part of the workspace.
// - Playwright is taken from the repository root install (no new Playwright dependency).
// - The built app (apps/web/dist) is served by a tiny in-process static server on a free port,
//   so no `vite preview` process can be left behind.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
export const { chromium } = requireFromRoot('@playwright/test');
export const distDir = join(repoRoot, 'apps', 'web', 'dist');

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

export async function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    const file = rel === '' ? 'index.html' : rel;
    try {
      const body = await readFile(join(distDir, file));
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${String(port)}/` };
}

export const axeSource = () =>
  readFile(join(here, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

export const fill = (page, id, value) => page.getByTestId(`input-${id}`).fill(value);
export const stateOf = (page) => page.getByTestId('result-state').getAttribute('data-state');
export async function waitState(page, kind, timeout = 30000) {
  await page.waitForFunction(
    (k) => document.querySelector('[data-testid="result-state"]')?.getAttribute('data-state') === k,
    kind,
    { timeout },
  );
}
