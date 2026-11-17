import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * ML-TASK-034 e2e: presets (ML-FR-013), CSV export (ML-FR-014) and the display precision of the
 * comparison table (ML-FR-010 AC2 follow-up). State is always polled, never read once.
 */

const resultState = (page: Page) => page.getByTestId('result-state');

async function runAndWait(page: Page): Promise<void> {
  await page.getByTestId('run-button').click();
  await expect(resultState(page)).toHaveAttribute('data-state', 'current');
}

async function choosePreset(page: Page, id: string): Promise<void> {
  await page.getByTestId('presets-button').click();
  await page.getByTestId(`preset-${id}`).click();
}

test('presets menu: keyboard operable, each preset loads, runs to current and is not "unsaved"', async ({
  page,
}) => {
  await page.goto('/');
  const button = page.getByTestId('presets-button');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('presets-menu')).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  // Focus moves into the menu; arrows move; Escape closes and returns focus.
  await expect(page.getByTestId('preset-near-circular-leo')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('preset-eccentric-inclined-burn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('presets-menu')).toHaveCount(0);
  await expect(button).toBeFocused();

  const cases: [string, string, number][] = [
    ['near-circular-leo', 'Preset: near-circular LEO, no maneuver', 0],
    ['eccentric-inclined-burn', 'Preset: eccentric inclined orbit, along-track burn', 1],
    ['escape-burn', 'Preset: escape burn from LEO', 1],
  ];
  for (const [id, name, maneuvers] of cases) {
    await choosePreset(page, id);
    await expect(page.getByTestId('scenario-name')).toHaveText(name);
    // A loaded file is saved: no unsaved changes, and no result until the user runs.
    await expect(page.getByTestId('unsaved-indicator')).toHaveAttribute('data-unsaved', 'false');
    await expect(resultState(page)).toHaveAttribute('data-state', 'none');
    await runAndWait(page);
    await expect(page.getByTestId('comparison-maneuver')).toHaveCount(maneuvers);
    if (maneuvers === 1) {
      await expect(page.getByTestId('comparison-maneuver')).toHaveAttribute(
        'data-maneuver-id',
        'm1',
      );
    }
  }
});

test('a preset asks before discarding unsaved changes, like a loaded file', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('input-name').fill('My edits');
  await choosePreset(page, 'escape-burn');
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('scenario-name')).toHaveText('My edits');
  await page.getByRole('button', { name: 'Discard and load' }).click();
  await expect(page.getByTestId('scenario-name')).toHaveText('Preset: escape burn from LEO');
});

test('CSV export: disabled without a current result; values equal the engine arrays exactly', async ({
  page,
}) => {
  await page.goto('/?sceneHook=1');
  await page.getByTestId('add-maneuver').click();
  await page.getByTestId('input-m0-time').fill('1500');
  await page.getByTestId('input-m0-dv-s').fill('12.5');
  const exportButton = page.getByTestId('export-csv-button');
  await expect(exportButton).toBeDisabled();
  await runAndWait(page);
  await expect(exportButton).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('New-scenario.result.csv');
  const text = readFileSync(await download.path(), 'utf8');
  const lines = text.trimEnd().split('\n');
  const comments = lines.filter((l) => l.startsWith('#')).join('\n');
  expect(comments).toContain('frame: GCRF');
  expect(comments).toContain('epoch: 2026-01-01T00:00:00.000Z');
  expect(comments).toContain('units:');
  const rows = lines.filter((l) => !l.startsWith('#'));
  expect(rows[0]).toBe('segment,t_s,x_m,y_m,z_m,vx_mps,vy_mps,vz_mps');
  const data = rows.slice(1).map((l) => l.split(','));

  // The engine's own arrays, through the scene hook (a test of what the app holds).
  let engine: { t: number[]; p: number[]; v: number[]; segment: number[] } | null = null;
  await expect
    .poll(async () => {
      engine = await page.evaluate(() => {
        const hook = (
          window as unknown as {
            __missionLabScene: {
              get: () => {
                sourcePosition_m: Float64Array[] | null;
              };
            };
          }
        ).__missionLabScene.get();
        const segs = hook.sourcePosition_m ?? [];
        return {
          t: [],
          p: segs.flatMap((s) => Array.from(s)),
          v: [],
          segment: segs.flatMap((s, i) => Array.from({ length: s.length / 3 }, () => i)),
        };
      });
      return engine.p.length;
    })
    .toBeGreaterThan(0);
  const got = engine as unknown as { p: number[]; segment: number[] };
  expect(data).toHaveLength(got.segment.length);
  expect(new Set(got.segment)).toEqual(new Set([0, 1]));
  data.forEach((cells, row) => {
    expect(cells).toHaveLength(8);
    expect(Number(cells[0])).toBe(got.segment[row]);
    for (const c of [0, 1, 2]) {
      const expected = got.p[3 * row + c] ?? Number.NaN;
      expect(Object.is(Number(cells[2 + c]), expected)).toBe(true);
    }
  });

  // A physical edit makes the result stale: nothing stale is exported.
  await page.getByTestId('input-duration').fill('3000');
  await expect(resultState(page)).toHaveAttribute('data-state', 'stale');
  await expect(exportButton).toBeDisabled();
});

test('comparison table: display resolution, round-off shown as zero, exact value in the tooltip and the copy', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await choosePreset(page, 'eccentric-inclined-burn');
  await runAndWait(page);

  const sma = page.getByTestId('comparison-row-semiMajorAxis_m');
  await expect(sma.getByTestId('cmp-before')).toHaveText(/^-?\d+\.\d{3}$/);
  const raan = page.getByTestId('comparison-row-raan_rad');
  await expect(raan.getByTestId('cmp-difference')).toHaveText(/^-?\d+\.\d{3}$/);
  await expect(page.getByTestId('comparison-row-eccentricity').getByTestId('cmp-after')).toHaveText(
    /^\d+\.\d{6}$/,
  );
  // Nothing in the table is in exponential notation.
  await expect(page.getByTestId('comparison-table')).not.toContainText(/\d[eE][-+]?\d/);

  // The cell keeps the full SI value (data attribute) and shows the full value in its tooltip.
  const before = sma.getByTestId('cmp-before');
  const si = await before.getAttribute('data-value-si');
  expect(si).not.toBeNull();
  await expect(before).toHaveAttribute(
    'title',
    new RegExp(`SI: ${(si ?? '').replace('.', '\\.')} m`),
  );

  // Copy exact values: the clipboard holds the full-precision SI numbers.
  await page.getByTestId('cmp-copy-exact').click();
  await expect(page.getByTestId('cmp-copy-status')).toContainText('Copied');
  await expect
    .poll(async () => page.evaluate(async () => navigator.clipboard.readText()))
    .toContain(`semiMajorAxis_m\tm\t${si ?? ''}\t`);
});

test('comparison table: a round-off-level difference reads as zero', async ({ page }) => {
  await page.goto('/');
  // Escape preset: inclination and node do not change by an along-track burn, so these
  // differences are zero or at round-off level; either way the cell must read 0.000.
  await choosePreset(page, 'escape-burn');
  await runAndWait(page);
  const cell = page.getByTestId('comparison-row-inclination_rad').getByTestId('cmp-difference');
  await expect(cell).toContainText('0.000');
  await expect(cell).not.toContainText('-');
  await expect(cell).not.toContainText('e-');
});
