import { expect, test } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mission Lab');
  await expect(page.getByRole('heading', { name: 'Mission Lab' })).toBeVisible();
  await expect(page.getByTestId('workspace')).toBeVisible();
});
