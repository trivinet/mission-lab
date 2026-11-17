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

/**
 * ML-TASK-044, D-2 and D-3. Above the engine's hard limit (1 000 000) the run is refused, so the
 * "not blocked" note must not be shown; at the limit it still is. The toolbar text agrees in
 * number with its subject.
 */
test('D-2: no large-run note above the hard limit; D-3: "1 problem prevents the run"', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('input-duration').fill('999999');
  await page.getByTestId('input-step').fill('1');
  await expect(page.getByTestId('sample-warning')).toHaveAttribute('data-count', '1000000');
  await expect(page.getByTestId('run-blocked')).toHaveCount(0);

  await page.getByTestId('input-duration').fill('1000000');
  await expect(page.getByTestId('error-step')).toContainText('SAMPLE_COUNT_EXCEEDED');
  await expect(page.getByTestId('sample-warning')).toHaveCount(0);
  await expect(page.getByTestId('sample-warning-run')).toHaveCount(0);
  await expect(page.getByTestId('run-blocked')).toContainText('1 problem prevents the run');

  // Two problems: plural subject, plural verb.
  await page.getByTestId('input-duration').fill('-5');
  await page.getByTestId('input-step').fill('0');
  await expect(page.getByTestId('run-blocked')).toContainText('2 problems prevent the run');
});
