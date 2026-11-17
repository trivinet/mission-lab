import { chromium, startServer, waitState } from './harness.mjs';
const { server, base } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto(base);
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  const t = await page.locator('section[aria-labelledby="h-model"]').innerText();
  console.log(t.slice(0, 2000));
} finally {
  await browser.close();
  server.close();
}
