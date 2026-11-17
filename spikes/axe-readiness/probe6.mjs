import { chromium, startServer } from './harness.mjs';
const { server, base } = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  const r = await page.evaluate(() => {
    const w = new Worker(new URL('/', location.href).href.replace(/\/$/, '') + '/assets/x.js', {
      type: 'module',
    });
    let hit = false;
    w.onmessageerror = () => {
      hit = true;
    };
    w.dispatchEvent(new MessageEvent('messageerror'));
    return { hasProp: 'onmessageerror' in w, hit };
  });
  console.log(r);
} finally {
  await browser.close();
  server.close();
}
