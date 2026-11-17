// Feature smoke test + screenshots against a running `vite preview` (port 5181).
//   node tools/smoke.mjs [dataset]
// Writes screenshots to out/ and prints the Object.is read-back verification per library.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const dataset = process.argv[2] ?? 'small';
mkdirSync('out', { recursive: true });
const browser = await chromium.launch();
for (const lib of ['uplot', 'echarts', 'plotly', 'recharts']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:5181/${lib}.html?dataset=${dataset}&manual=1`);
  await page.waitForFunction(() => window.__spike);
  const r = await page.evaluate((d) => window.__spike.render(d, 'single'), dataset);
  await page.evaluate(() => window.__spike.setCursor(4200));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `out/${lib}-${dataset}.png` });
  const v = await page.evaluate(() => window.__spike.verify());
  console.log(
    lib,
    JSON.stringify(r),
    JSON.stringify(v[0]),
    errors.length ? 'ERRORS ' + errors.join(' | ') : '',
  );
  await page.close();
}
await browser.close();
