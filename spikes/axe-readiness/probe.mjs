import { chromium, startServer, fill, waitState } from './harness.mjs';

const { server, base } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
try {
  await page.goto(base);
  // collision attempt: circular 7000 km, big retrograde burn at t = 100 s
  await fill(page, 'e', '0');
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '100');
  await fill(page, 'm0-dv-r', '0');
  await fill(page, 'm0-dv-s', process.argv[2] ?? '-7500');
  await fill(page, 'm0-dv-w', '0');
  await page.getByTestId('run-button').click();
  await page.waitForTimeout(3000);
  console.log('state', await page.getByTestId('result-state').getAttribute('data-state'));
  console.log(
    'banner',
    await page
      .getByTestId('result-banner')
      .textContent()
      .catch(() => null),
  );
  console.log('diag', await page.getByTestId('diagnostic').allTextContents());
  console.log('samples', await page.getByTestId('sample-count').textContent());
  console.log('errors', errors);
} finally {
  await browser.close();
  server.close();
}
