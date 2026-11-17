import { chromium, startServer, fill } from './harness.mjs';

const cases = [
  ['dv_s 1e12', { man: { t: '100', s: '1e12' } }],
  ['dv_s 1e300', { man: { t: '100', s: '1e300' } }],
  ['dv_s 1e150 (square overflows?)', { man: { t: '100', s: '1e154' } }],
  ['a 1e300 km', { a: '1e300' }],
  ['duration 1e300 step 1e298', { duration: '1e300', step: '1e298' }],
  ['dv_r 1e9 hyperbolic', { man: { t: '100', r: '1e9' } }],
  ['dv_s 20000 escape long', { man: { t: '100', s: '20000' }, duration: '1e10', step: '1e8' }],
];
const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  for (const [label, c] of cases) {
    const page = await browser.newPage();
    await page.goto(base);
    if (c.a) await fill(page, 'a', c.a);
    if (c.duration) await fill(page, 'duration', c.duration);
    if (c.step) await fill(page, 'step', c.step);
    if (c.man) {
      await page.getByTestId('add-maneuver').click();
      await fill(page, 'm0-time', c.man.t);
      await fill(page, 'm0-dv-r', c.man.r ?? '0');
      await fill(page, 'm0-dv-s', c.man.s ?? '0');
      await fill(page, 'm0-dv-w', '0');
    }
    const blocked = await page.getByTestId('run-blocked').count();
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(2500);
    console.log('---', label, 'blocked:', blocked);
    console.log(' state', await page.getByTestId('result-state').getAttribute('data-state'));
    console.log(
      ' diag',
      (await page.getByTestId('diagnostic').allTextContents()).map((s) => s.slice(0, 220)),
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
