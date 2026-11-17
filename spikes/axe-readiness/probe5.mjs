import { chromium, startServer, fill } from './harness.mjs';
const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  await fill(page, 'duration', '1000000');
  await fill(page, 'step', '1');
  console.log((await page.getByTestId('editor-column').innerText()).slice(0, 1500));
  console.log('RUNBLOCKED', await page.getByTestId('run-blocked').innerText());
  console.log(
    'focusable describedby',
    await page.getByTestId('run-button').getAttribute('aria-describedby'),
  );
  console.log(
    await page
      .locator('[data-testid^="error-"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') + ': ' + e.textContent)),
  );
} finally {
  await browser.close();
  server.close();
}
