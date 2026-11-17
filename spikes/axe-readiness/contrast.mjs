// ML-TASK-040: contrast ratios computed (WCAG 2.x relative luminance), not estimated.
// Part A: the design tokens parsed from apps/web/src/index.css against the documented hex values
//         and every text/background token pair. Part B: every visible text node in the built app
//         (computed colour vs the effective background, alpha composited), per UI state.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, fill, startServer, waitState } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const css = await readFile(join(here, '..', '..', 'apps', 'web', 'src', 'index.css'), 'utf8');
const tokens = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g))
  tokens[m[1]] = m[2].toLowerCase();

const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const documented = {
  'bg-base': '#0d1117',
  'bg-panel': '#151b23',
  'bg-raised': '#1c242e',
  'bg-input': '#0a0e13',
  border: '#2f3b4a',
  'border-input': '#5f7289',
  text: '#e6edf3',
  'text-2': '#a8b3c0',
  'text-3': '#8c99a8',
  accent: '#6aa9ff',
  'input-text': '#9cc4ff',
  focus: '#9cc4ff',
  current: '#4cc77a',
  computing: '#6aa9ff',
  stale: '#e0ad3c',
  error: '#ff7b72',
  warning: '#f0883e',
  coast: '#a8b3c0',
  maneuver: '#3dd6c6',
  marker: '#ffb454',
};
const out = { tokenMismatches: [], tokenPairs: [], dom: {} };
for (const [k, v] of Object.entries(documented))
  if (tokens[k] !== v) out.tokenMismatches.push({ token: k, css: tokens[k], doc: v });

const bgs = ['bg-base', 'bg-panel', 'bg-raised', 'bg-input'];
const textTokens = [
  'text',
  'text-2',
  'text-3',
  'accent',
  'input-text',
  'current',
  'computing',
  'stale',
  'error',
  'warning',
];
for (const t of textTokens)
  for (const b of bgs)
    out.tokenPairs.push({ fg: t, bg: b, ratio: ratio(hex(tokens[t]), hex(tokens[b])), min: 4.5 });
for (const t of ['coast', 'maneuver', 'marker', 'focus', 'border-input'])
  for (const b of bgs)
    out.tokenPairs.push({ fg: t, bg: b, ratio: ratio(hex(tokens[t]), hex(tokens[b])), min: 3 });
console.log('token mismatches vs doc:', out.tokenMismatches.length);
const failing = out.tokenPairs.filter((p) => p.ratio < p.min);
console.log(
  'token pairs:',
  out.tokenPairs.length,
  'below threshold:',
  failing.map((p) => `${p.fg}/${p.bg} ${p.ratio.toFixed(2)}`).join(', ') || 'none',
);

// Part B
const { server, base } = await startServer();
const browser = await chromium.launch();
const scanDom = (page) =>
  page.evaluate(() => {
    const parse = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (m === null) return null;
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
    };
    const over = (top, bot) => ({
      r: top.r * top.a + bot.r * (1 - top.a),
      g: top.g * top.a + bot.g * (1 - top.a),
      b: top.b * top.a + bot.b * (1 - top.a),
      a: 1,
    });
    const effBg = (el) => {
      const stack = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) stack.push(c);
        if (c && c.a === 1) break;
      }
      let acc = { r: 13, g: 17, b: 23, a: 1 };
      for (const c of stack.reverse()) acc = over(c, acc);
      return acc;
    };
    const L = (c) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const rows = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (t.textContent.trim() === '') continue;
      const el = t.parentElement;
      if (
        el.closest('[aria-hidden="true"]') ||
        el.closest('.sr-only') ||
        el.closest('canvas, script, style')
      )
        continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      let fg = parse(cs.color);
      const bg = effBg(el);
      let op = 1;
      for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      fg = over({ ...fg, a: fg.a * op }, bg);
      const [a, b] = [L(fg), L(bg)].sort((x, y) => y - x);
      rows.push({
        text: t.textContent.trim().slice(0, 40),
        testid: el.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
        size: cs.fontSize,
        ratio: (a + 0.05) / (b + 0.05),
        fg: `${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)}`,
        bg: `${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}`,
        opacity: op,
      });
    }
    return rows;
  });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  const record = async (name) => {
    const rows = await scanDom(page);
    const bad = rows.filter((r) => r.ratio < 4.5);
    out.dom[name] = {
      texts: rows.length,
      min: Math.min(...rows.map((r) => r.ratio)),
      below45: bad,
    };
    console.log(
      name.padEnd(12),
      'texts',
      rows.length,
      'min ratio',
      out.dom[name].min.toFixed(2),
      'below 4.5:',
      bad.length,
    );
    for (const b of bad.slice(0, 8))
      console.log(
        '   ',
        b.ratio.toFixed(2),
        JSON.stringify(b.text),
        b.testid,
        b.fg,
        'on',
        b.bg,
        'op',
        b.opacity,
      );
  };
  await record('none');
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await page.waitForTimeout(500);
  await record('current');
  await fill(page, 'a', '7100');
  await waitState(page, 'stale');
  await record('stale');
  await fill(page, 'a', '-5');
  await record('invalid');
  await fill(page, 'a', '7000');
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '100');
  await fill(page, 'm0-dv-r', '0');
  await fill(page, 'm0-dv-s', '1e300');
  await fill(page, 'm0-dv-w', '0');
  await page.getByTestId('run-button').click();
  await waitState(page, 'error');
  await record('error');
  await fill(page, 'm0-dv-s', '5000');
  await page.getByTestId('run-button').click();
  await waitState(page, 'current');
  await page.waitForTimeout(500);
  await record('maneuver');
  await page.getByTestId('new-scenario-button').click();
  await page.getByTestId('confirm-dialog').waitFor();
  await record('dialog');
} finally {
  await writeFile(join(here, 'results', 'contrast.json'), JSON.stringify(out, null, 2));
  await browser.close();
  server.close();
}
