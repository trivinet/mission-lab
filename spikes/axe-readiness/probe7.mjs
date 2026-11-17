import { chromium, startServer } from './harness.mjs';
const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  const dl = page.waitForEvent('download');
  await page.getByTestId('save-button').click();
  const path = await (await dl).path();
  const { readFileSync } = await import('node:fs');
  const json = JSON.parse(readFileSync(path, 'utf8'));
  console.log(JSON.stringify(json.initialOrbit));
  json.initialOrbit.elements.semiMajorAxis_m = 6000000;
  await page.getByTestId('load-input').setInputFiles({
    name: 'low.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(json)),
  });
  await page.waitForTimeout(500);
  console.log('dialog', await page.getByTestId('error-dialog').isVisible());
  console.log('a', await page.getByTestId('input-a').inputValue());
  console.log('blocked', await page.getByTestId('run-blocked').allTextContents());
  console.log(
    'perigee msg',
    await page.getByTestId('editor-column').locator('.msg').allTextContents(),
  );
} finally {
  await browser.close();
  server.close();
}
