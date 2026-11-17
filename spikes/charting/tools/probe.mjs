// Probes (against a running `vite preview`): (1) network requests made by each page, (2) what a
// chart exposes to keyboard and assistive technology (focusable elements, roles, aria-labels).
//   node tools/probe.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
for (const lib of ['uplot', 'echarts', 'plotly', 'recharts']) {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`http://localhost:5181/${lib}.html?manual=1&dataset=small`);
  await page.waitForFunction(() => window.__spike);
  await page.evaluate(() => window.__spike.render('small', 'single'));
  const cell = '#charts > div';
  const dom = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    const all = [...host.querySelectorAll('*')];
    const attr = (a) => all.filter((e) => e.hasAttribute(a));
    return {
      elements: all.length,
      tabindex: attr('tabindex').map(
        (e) => `${e.tagName.toLowerCase()}[tabindex=${e.getAttribute('tabindex')}]`,
      ),
      roles: [...new Set(attr('role').map((e) => e.getAttribute('role')))],
      ariaLabels: attr('aria-label')
        .map((e) => e.getAttribute('aria-label'))
        .slice(0, 3),
      canvases: host.querySelectorAll('canvas').length,
      svgs: host.querySelectorAll('svg').length,
    };
  }, cell);
  // Tab through the page: record what receives focus after the controls.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const focus = [];
  for (let k = 0; k < 8; k += 1) {
    await page.keyboard.press('Tab');
    focus.push(
      await page.evaluate(() => {
        const e = document.activeElement;
        return e
          ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.getAttribute('class') ? '.' + e.getAttribute('class').split(' ')[0] : ''}`
          : 'none';
      }),
    );
  }
  const external = requests.filter(
    (u) =>
      !u.startsWith('http://localhost:5181/') && !u.startsWith('data:') && !u.startsWith('blob:'),
  );
  console.log(
    JSON.stringify({
      lib,
      requests: requests.length,
      externalRequests: external,
      dom,
      tabOrder: focus,
    }),
  );
  await page.close();
}
await browser.close();
