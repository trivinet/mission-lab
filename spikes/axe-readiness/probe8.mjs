import { chromium, startServer } from './harness.mjs';
const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  await page.getByTestId('presets-button').click();
  console.log(
    await page.evaluate(() => {
      const b = document.querySelector('[data-testid="presets-button"]');
      const id = b.getAttribute('aria-controls');
      return { id, found: id !== null && document.getElementById(id) !== null };
    }),
  );
} finally {
  await browser.close();
  server.close();
}
