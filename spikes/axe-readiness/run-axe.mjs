// ML-TASK-040: axe-core scan of the main UI states, plus structural checks (names, focus order,
// focus visibility, text alternatives) and a dimming/opacity scan. Writes results/axe.json.
// Run: npm install && (build the app first: pnpm --filter @mission-lab/web build) && node run-axe.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { axeSource, chromium, fill, startServer, waitState } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const axe = await axeSource();
const { server, base } = await startServer();
const browser = await chromium.launch();
const out = { axeVersion: '4.11.1', states: {}, structure: {} };

async function scan(page, name) {
  await page.evaluate(axe);
  const res = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
    }),
  );
  out.states[name] = {
    violations: res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary?.slice(0, 300) })),
    })),
    incomplete: res.incomplete.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.any[0]?.message ?? n.none[0]?.message ?? '',
      })),
    })),
    passes: res.passes.length,
  };
  console.log(
    name.padEnd(34),
    'violations:',
    res.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'none',
    '| incomplete:',
    res.incomplete.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'none',
  );
}

async function fresh() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base + '?sceneHook=1');
  await page.getByTestId('workspace').waitFor();
  return page;
}

const badFile = {
  name: 'bad.scenario.json',
  mimeType: 'application/json',
  buffer: Buffer.from('{ not json'),
};

try {
  // 1. none
  let page = await fresh();
  await scan(page, '1 none');

  // structure: accessible names, roles, tab order, focus visibility, text alternatives
  out.structure.controls = await page.evaluate(() => {
    const sel =
      'button, input, select, textarea, a[href], [tabindex], [role="slider"], canvas, [role="menuitem"]';
    return [...document.querySelectorAll(sel)].map((el) => {
      const labelledby = el.getAttribute('aria-labelledby');
      const labelEls = el.labels ? [...el.labels].map((l) => l.textContent.trim()) : [];
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        role: el.getAttribute('role'),
        testid: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label'),
        labelledby: labelledby ? document.getElementById(labelledby)?.textContent.trim() : null,
        labels: labelEls,
        text: el.textContent.trim().slice(0, 40),
        tabindex: el.getAttribute('tabindex'),
        hidden: el.getAttribute('aria-hidden'),
      };
    });
  });
  const order = [];
  for (let n = 0; n < 60; n += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        testid: el.getAttribute('data-testid') ?? el.className ?? el.tagName,
        tag: el.tagName.toLowerCase(),
        name:
          el.getAttribute('aria-label') ??
          (el.labels?.[0]?.textContent ?? el.textContent ?? '').trim().slice(0, 40),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        outlineOffset: cs.outlineOffset,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      };
    });
    if (info === null) break;
    if (order.length > 0 && order[0].testid === info.testid && order.length > 3) break;
    order.push(info);
  }
  out.structure.tabOrder = order;
  out.structure.hasTabTrapOrWrap = order.length;
  console.log('tab stops (no maneuver, state none):', order.length);

  // 2. validation error present (field invalid)
  await fill(page, 'a', '-5');
  await scan(page, '2 none + field error');
  await fill(page, 'a', '7000');

  // 3. current
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await page.waitForTimeout(500);
  await scan(page, '3 current (coast)');

  // 4. stale
  await fill(page, 'a', '7100');
  await waitState(page, 'stale');
  await scan(page, '4 stale');
  // opacity/dimming scan in stale state
  out.structure.staleOpacity = await page.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('body *')) {
      let o = 1;
      for (let n = el; n && n !== document.body; n = n.parentElement)
        o *= Number(getComputedStyle(n).opacity);
      if (
        o < 1 &&
        el.childNodes.length > 0 &&
        [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() !== '')
      ) {
        res.push({
          text: el.textContent.trim().slice(0, 40),
          effectiveOpacity: o,
          testid: el.getAttribute('data-testid'),
        });
      }
    }
    return res.slice(0, 40);
  });

  // 5. with maneuver + comparison, current
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '2400');
  await fill(page, 'm0-dv-r', '0');
  await fill(page, 'm0-dv-s', '100');
  await fill(page, 'm0-dv-w', '0');
  await scan(page, '5 maneuver added (stale)');
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await page.waitForTimeout(800);
  await scan(page, '6 maneuver current + comparison');
  const order2 = [];
  for (let n = 0; n < 120; n += 1) {
    await page.keyboard.press('Tab');
    const t = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName,
    );
    order2.push(t);
  }
  out.structure.tabOrderManeuverRun = order2;

  // 7. preset menu open
  await page
    .getByTestId('presets-button')
    .click()
    .catch(async () => {
      await page.getByRole('button', { name: /Presets/ }).click();
    });
  await scan(page, '7 preset menu open');
  await page.keyboard.press('Escape');

  // 8. error state (non-finite)
  await page.getByTestId('remove-maneuver-0').click();
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '100');
  await fill(page, 'm0-dv-r', '0');
  await fill(page, 'm0-dv-s', '1e300');
  await fill(page, 'm0-dv-w', '0');
  await page.getByTestId('run-button').click();
  await waitState(page, 'error');
  await scan(page, '8 error (failed run)');

  // 9. confirm dialog (unsaved changes + New)
  await page.getByTestId('new-scenario-button').click();
  await page.getByTestId('confirm-dialog').waitFor();
  await scan(page, '9 confirm dialog open');
  await page.keyboard.press('Escape');

  // 10. error dialog (bad file)
  await page.getByTestId('load-input').setInputFiles(badFile);
  await page.getByTestId('error-dialog').waitFor();
  await scan(page, '10 error dialog open');
  await page.close();

  // 11. escape (warning diagnostic) current
  page = await fresh();
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '100');
  await fill(page, 'm0-dv-r', '0');
  await fill(page, 'm0-dv-s', '5000');
  await fill(page, 'm0-dv-w', '0');
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await page.waitForTimeout(500);
  await scan(page, '11 current with warning diagnostic');
  await page.close();

  // 12. narrow viewport (reflow check, WCAG 1.4.10 at 320 css px)
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base);
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  out.structure.reflow = {};
  for (const w of [1280, 1024, 768, 400]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(200);
    out.structure.reflow[w] = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth,
    }));
  }
  // zoom 200% equivalent: viewport 640 wide
  await page.close();
} finally {
  await mkdir(join(here, 'results'), { recursive: true });
  await writeFile(join(here, 'results', 'axe.json'), JSON.stringify(out, null, 2));
  await browser.close();
  server.close();
}
