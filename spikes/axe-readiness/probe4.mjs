import { chromium, startServer, fill, waitState } from './harness.mjs';

const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  // sample limit
  for (const [d, s] of [
    ['1000000', '1'], // 1,000,001 samples
    ['999999', '1'], // 1,000,000 samples
    ['5000000', '1'],
  ]) {
    const page = await browser.newPage();
    await page.goto(base);
    await fill(page, 'duration', d);
    await fill(page, 'step', s);
    console.log('--- limit', d, s, 'blocked', await page.getByTestId('run-blocked').count());
    console.log(
      ' issues',
      await page
        .getByTestId('field-duration')
        .allTextContents()
        .catch(() => []),
    );
    console.log(' note', await page.getByTestId('sample-warning-run').allTextContents());
    await page.getByTestId('run-button').click();
    await page.waitForTimeout(6000);
    console.log(' state', await page.getByTestId('result-state').getAttribute('data-state'));
    console.log(' banner', await page.getByTestId('result-banner').allTextContents());
    console.log(
      ' diag',
      (await page.getByTestId('diagnostic').allTextContents()).map((x) => x.slice(0, 250)),
    );
    await page.close();
  }
  // worker crash
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const O = window.Worker;
    window.__ws = [];
    window.Worker = class extends O {
      constructor(...a) {
        super(...a);
        window.__ws.push(this);
      }
    };
  });
  await page.goto(base);
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await fill(page, 'duration', '900000');
  await fill(page, 'step', '1');
  await page.getByTestId('run-button').click();
  await waitState(page, 'computing');
  await page.evaluate(() =>
    window.__ws[0].dispatchEvent(new ErrorEvent('error', { message: 'boom' })),
  );
  await waitState(page, 'error');
  console.log('crash banner', await page.getByTestId('result-banner').allTextContents());
  console.log('crash diag', await page.getByTestId('diagnostic').allTextContents());
  await fill(page, 'duration', '3000');
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  console.log('recovered, worker count', await page.evaluate(() => window.__ws.length));
} finally {
  await browser.close();
  server.close();
}
