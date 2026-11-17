import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

/**
 * ML-FR-011 (save, load, unsaved indicator) and ML-FR-001 AC3 (confirmation), through the real
 * file input and the download event. State is always polled, never read once.
 */

const indicator = (page: Page) => page.getByTestId('unsaved-indicator');
const nameInput = (page: Page) => page.getByTestId('input-name');

async function save(page: Page): Promise<{ text: string; download: Download }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-button').click();
  const download = await downloadPromise;
  const path = await download.path();
  return { text: readFileSync(path, 'utf8'), download };
}

async function loadFile(page: Page, name: string, content: string): Promise<void> {
  await page
    .getByTestId('load-input')
    .setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content, 'utf8') });
}

async function sourcePositions(page: Page): Promise<string> {
  return page.evaluate(() => {
    const hook = (
      window as unknown as {
        __missionLabScene: { get: () => { sourcePosition_m: Float64Array[] | null } };
      }
    ).__missionLabScene.get();
    return JSON.stringify((hook.sourcePosition_m ?? []).map((a) => Array.from(a)));
  });
}

test('unsaved indicator: clean at start, set by an edit, cleared by save, set again by a new edit', async ({
  page,
}) => {
  await page.goto('/');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');
  await expect(indicator(page)).toHaveText('No unsaved changes');

  await nameInput(page).fill('Edited');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');
  await expect(indicator(page)).toContainText('Unsaved changes');
  // Next to the scenario name, as text (not colour alone).
  await expect(page.getByTestId('scenario-name')).toHaveText('Edited');

  const { download, text } = await save(page);
  expect(download.suggestedFilename()).toBe('Edited.scenario.json');
  expect((JSON.parse(text) as { name: string; schemaVersion: string }).name).toBe('Edited');
  expect((JSON.parse(text) as { schemaVersion: string }).schemaVersion).toBe('1.0');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');

  await page.getByTestId('input-duration').fill('3000');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');
});

test('VT-17 (e2e): save -> load -> save is byte-identical and the loaded run reproduces the original', async ({
  page,
}) => {
  await page.goto('/?sceneHook=1');
  await nameInput(page).fill('Round trip');
  await page.getByTestId('add-maneuver').click();
  await page.getByTestId('input-m0-time').fill('1500');
  await page.getByTestId('input-m0-dv-s').fill('12.5');
  const first = await save(page);

  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await expect.poll(async () => (await sourcePositions(page)).length).toBeGreaterThan(10);
  const originalPositions = await sourcePositions(page);

  // A different scenario in between, then load the saved file.
  // The saved scenario is clean (the run does not change it), so no dialog appears.
  await page.getByTestId('new-scenario-button').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(nameInput(page)).toHaveValue('New scenario');
  await loadFile(page, 'round-trip.scenario.json', first.text);
  await expect(nameInput(page)).toHaveValue('Round trip');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');
  // Loading resets the result; nothing is shown as current for the loaded scenario.
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'none');

  const second = await save(page);
  expect(second.text).toBe(first.text);

  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  await expect.poll(() => sourcePositions(page)).toBe(originalPositions);
});

const INVALID_FILES: readonly (readonly [string, string, string])[] = [
  ['invalid JSON', '{"schemaVersion": ', 'The file is not valid JSON'],
  [
    'unknown schema version',
    JSON.stringify({ schemaVersion: '9.9' }),
    'schema version of this file is missing or not supported',
  ],
  [
    'schema violation',
    JSON.stringify({ schemaVersion: '1.0', name: 5 }),
    'does not match the scenario format',
  ],
  ['file over the size limit', ' '.repeat(64 * 1024 + 1), 'too large to be a scenario'],
];

for (const [label, content, message] of INVALID_FILES) {
  test(`load rejects ${label} with a message and leaves the scenario unchanged`, async ({
    page,
  }) => {
    await page.goto('/');
    await nameInput(page).fill('Keep me');
    await page.getByTestId('input-duration').fill('4321');
    await loadFile(page, 'bad.json', content);
    const dialog = page.getByTestId('error-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('notice-message')).toContainText(message);
    // Keyboard: the dialog has focus on Close; Escape dismisses it.
    await expect(page.getByTestId('notice-dismiss')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(nameInput(page)).toHaveValue('Keep me');
    await expect(page.getByTestId('input-duration')).toHaveValue('4321');
    await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');
  });
}

test('load rejects an out-of-range value and lists the offending field', async ({ page }) => {
  await page.goto('/');
  const { text } = await save(page);
  const json = JSON.parse(text) as { initialOrbit: { elements: { eccentricity: number } } };
  json.initialOrbit.elements.eccentricity = 1.5;
  await loadFile(page, 'range.json', JSON.stringify(json));
  const dialog = page.getByTestId('error-dialog');
  await expect(dialog.getByTestId('notice-message')).toContainText('outside their allowed range');
  await expect(dialog.getByTestId('notice-details')).toContainText(
    'initialOrbit.elements.eccentricity',
  );
  await expect(dialog.getByTestId('notice-details')).toContainText('ECCENTRICITY_OUT_OF_RANGE');
});

test('New scenario: no dialog when clean; confirmation when unsaved (cancel keeps, confirm replaces)', async ({
  page,
}) => {
  await page.goto('/');
  await nameInput(page).fill('Work in progress');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'true');

  await page.getByTestId('new-scenario-button').click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('notice-dismiss')).toHaveText('Cancel');
  await page.getByTestId('notice-dismiss').click();
  await expect(dialog).toBeHidden();
  await expect(nameInput(page)).toHaveValue('Work in progress');

  await page.getByTestId('new-scenario-button').click();
  await page.getByTestId('notice-confirm').click();
  await expect(dialog).toBeHidden();
  await expect(nameInput(page)).toHaveValue('New scenario');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');

  // Clean now: no dialog.
  await page.getByTestId('new-scenario-button').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(nameInput(page)).toHaveValue('New scenario');
});

test('Load: no dialog when clean; confirmation when unsaved (cancel keeps, confirm replaces)', async ({
  page,
}) => {
  await page.goto('/');
  await nameInput(page).fill('Saved one');
  const { text } = await save(page);

  // Clean: the file loads without a dialog.
  await nameInput(page).fill('Scratch');
  await page.getByTestId('new-scenario-button').click();
  await page.getByTestId('notice-confirm').click();
  await loadFile(page, 'a.scenario.json', text);
  await expect(nameInput(page)).toHaveValue('Saved one');
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();

  // Unsaved: confirmation first.
  await nameInput(page).fill('Unsaved edit');
  await loadFile(page, 'a.scenario.json', text);
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(nameInput(page)).toHaveValue('Unsaved edit');
  await page.getByTestId('notice-dismiss').click();
  await expect(nameInput(page)).toHaveValue('Unsaved edit');

  await loadFile(page, 'a.scenario.json', text);
  await page.getByTestId('notice-confirm').click();
  await expect(nameInput(page)).toHaveValue('Saved one');
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');
});

test('keyboard: save, load and the dialog work without a mouse; focus returns to the opener', async ({
  page,
}) => {
  await page.goto('/');
  await nameInput(page).fill('Keys');

  // Save by keyboard.
  await page.getByTestId('save-button').focus();
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await downloadPromise;
  await expect(indicator(page)).toHaveAttribute('data-unsaved', 'false');

  // Load by keyboard opens the file chooser.
  await page.getByTestId('load-button').focus();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(false);

  // Dialog by keyboard: Escape cancels and focus returns to the New button; the page behind is inert.
  await nameInput(page).fill('Keys 2');
  const newButton = page.getByTestId('new-scenario-button');
  await newButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await expect(page.getByTestId('notice-dismiss')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(newButton).toBeFocused();
  await expect(nameInput(page)).toHaveValue('Keys 2');

  // Confirm by keyboard: Tab to the confirm button and press Enter.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('notice-confirm')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(nameInput(page)).toHaveValue('New scenario');
});

test('save refuses a scenario the engine rejects and says why', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('input-duration').fill('0');
  await page.getByTestId('save-button').click();
  const dialog = page.getByTestId('error-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('notice-details')).toContainText('DURATION_NOT_POSITIVE');
});
