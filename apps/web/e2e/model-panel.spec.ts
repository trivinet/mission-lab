import { expect, test } from '@playwright/test';

const ROW_IDS = [
  'dynamics',
  'central-body',
  'mu',
  'radius',
  'constants-source',
  'propagator',
  'maneuver-model',
  'frame',
  'epoch',
  'time-convention',
  'engine-version',
  'duration',
  'output-step',
] as const;

test('with no result the panel says there is no model; the not-qualified statement is visible', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'none');
  await expect(page.getByTestId('model-none')).toContainText('No model');
  await expect(page.getByTestId('model-frame')).toHaveCount(0);
  await expect(page.getByTestId('not-qualified')).toBeVisible();
  await expect(page.getByTestId('not-qualified')).toContainText(
    'Not qualified for operational use',
  );
});

test('after a run every model item and limitation is visible; stale keeps them marked', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');

  const panel = page.getByTestId('model-panel');
  await expect(panel).toHaveAttribute('data-model', 'current');
  for (const id of ROW_IDS) {
    const cell = page.getByTestId(`model-${id}`);
    await expect(cell, id).toBeVisible();
    await expect(cell, id).not.toHaveText('');
  }
  // Values come from the engine's result; the default scenario samples 6000 s every 60 s.
  await expect(page.getByTestId('model-duration')).toHaveText('6000 s');
  await expect(page.getByTestId('model-output-step')).toHaveText('60 s');
  await expect(page.getByTestId('model-frame')).toHaveText('GCRF');

  const limitations = page.getByTestId('model-limitation');
  await expect.poll(async () => limitations.count()).toBeGreaterThan(0);
  const count = await limitations.count();
  for (let i = 0; i < count; i++) {
    await expect(limitations.nth(i)).toBeVisible();
    await expect(limitations.nth(i)).not.toHaveText('');
  }
  await expect(page.getByTestId('not-qualified')).toBeVisible();

  // A physical edit makes the result stale: the old model stays, marked stale.
  await page.getByTestId('input-duration').fill('3000');
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'stale');
  await expect(panel).toHaveAttribute('data-model', 'stale');
  await expect(page.getByTestId('model-stale')).toBeVisible();
  await expect(page.getByTestId('model-duration')).toHaveText('6000 s');
  await expect(page.getByTestId('not-qualified')).toBeVisible();
});

test('the details collapse and expand from the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current');
  const toggle = page.getByTestId('model-toggle');
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await expect(page.getByTestId('model-frame')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('model-frame')).toBeHidden();
  await expect(page.getByTestId('not-qualified')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('model-frame')).toBeVisible();
});
