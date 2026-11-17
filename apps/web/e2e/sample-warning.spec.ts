import { expect, test } from '@playwright/test';

/**
 * Soft warning above 250 000 samples (owner decision 2026-11-17). 30 days at 10 s is 259 201
 * samples (the engine's count). The note never blocks the run.
 */
test('the large-run note shows at 259 201 samples, not at the default, and never blocks Run', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('input-step')).toBeVisible();
  await expect(page.getByTestId('sample-warning')).toHaveCount(0);
  await expect(page.getByTestId('sample-warning-run')).toHaveCount(0);

  await page.getByTestId('input-duration').fill('2592000');
  await page.getByTestId('input-step').fill('10');
  const note = page.getByTestId('sample-warning');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-count', '259201');
  await expect(note).toContainText('performance-envelope.md');
  await expect(page.getByTestId('sample-warning-run')).toBeVisible();
  await expect(page.getByTestId('run-button')).toBeEnabled();
  await expect(page.getByTestId('run-blocked')).toHaveCount(0);

  // Back to a small run: the note goes away.
  await page.getByTestId('input-step').fill('60');
  await expect(note).toHaveCount(0);

  // The note does not block the run: a large run completes.
  await page.getByTestId('input-step').fill('10');
  await expect(note).toBeVisible();
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'current', {
    timeout: 60_000,
  });
  await expect(page.getByTestId('sample-count')).toContainText('259');
});
