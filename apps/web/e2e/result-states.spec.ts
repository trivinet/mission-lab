import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Records every text the result-state read-out ever shows, in order, in the page itself. A
 * MutationObserver sees each DOM update, so a short "computing" phase cannot be missed by polling.
 */
async function recordStates(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = document.querySelector('[data-testid="result-state"]');
    if (target === null) {
      throw new Error('no result-state element');
    }
    const seen: string[] = [target.getAttribute('data-state') ?? ''];
    const w = window as unknown as { __states: string[]; __stateTimes: Record<string, number> };
    w.__states = seen;
    w.__stateTimes = {};
    new MutationObserver(() => {
      const text = target.getAttribute('data-state') ?? '';
      if (seen[seen.length - 1] !== text) {
        seen.push(text);
        w.__stateTimes[text] = performance.now();
      }
    }).observe(target, { attributes: true, attributeFilter: ['data-state'] });
  });
}

async function recordedStates(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __states: string[] }).__states);
}

test('VE-02: result state goes none -> computing -> current -> stale', async ({ page }) => {
  await page.goto('/');
  const state = page.getByTestId('result-state');
  await expect(state).toHaveAttribute('data-state', 'none');
  await recordStates(page);

  await page.getByTestId('run-button').click();
  await expect(state).toHaveAttribute('data-state', 'current');
  expect(await recordedStates(page)).toEqual(['none', 'computing', 'current']);
  // The default scenario: 6000 s at 60 s gives 101 samples (real engine, in the worker).
  await expect(page.getByTestId('sample-count')).toHaveText('101');

  // Editing the name (display only) keeps the result current.
  await page.getByTestId('input-name').fill('Renamed');
  await expect(state).toHaveAttribute('data-state', 'current');

  // Editing a physical parameter makes the result stale and does not recompute it.
  await page.getByTestId('input-duration').fill('3000');
  await expect(state).toHaveAttribute('data-state', 'stale');
  await expect(page.getByTestId('sample-count')).toHaveText('101');
  expect(await recordedStates(page)).toEqual(['none', 'computing', 'current', 'stale']);

  // A new run recomputes: stale -> computing -> current, with the new duration (51 samples).
  await page.getByTestId('run-button').click();
  await expect(state).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('sample-count')).toHaveText('51');
});

test('validation issues prevent the run and show per field', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('input-duration').fill('-5');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('error-duration')).toBeVisible();
  await expect(page.getByTestId('result-state')).toHaveAttribute('data-state', 'none');
});

/**
 * ML-UX-003 evidence. Method: a long run (many samples, set through the inputs of this test only;
 * the engine is not slowed) is started, then while the read-out still says "computing" the test
 * clicks a main-thread probe button and checks that its counter updates, and a requestAnimationFrame
 * loop in the page records the longest gap between frames during the run.
 * Limits: this shows the page handled input and painted while the run was in progress on this
 * machine, not a performance budget; it does not prove the worker is the only place the engine
 * runs (the code review and the absence of any runSimulation import outside the worker do).
 */
test('ML-UX-003: the page responds to input while a run is in progress', async ({ page }) => {
  await page.goto('/');
  const state = page.getByTestId('result-state');
  await page.getByTestId('input-duration').fill('6000');
  await page.getByTestId('input-step').fill('0.01');
  await recordStates(page);

  await page.evaluate(() => {
    const w = window as unknown as { __maxFrameGap_ms: number; __stop: boolean };
    w.__maxFrameGap_ms = 0;
    w.__stop = false;
    let last = performance.now();
    const tick = (now: number): void => {
      w.__maxFrameGap_ms = Math.max(w.__maxFrameGap_ms, now - last);
      last = now;
      if (!w.__stop) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });

  await page.getByTestId('run-button').click();
  await expect(state).toHaveAttribute('data-state', 'computing');

  const pings = 5;
  const pingEnds_ms: number[] = [];
  for (let i = 0; i < pings; i += 1) {
    // The probe edits the scenario name (display only): the toolbar shows it only after the main
    // thread handled the input and React painted, so it proves the page responds during the run.
    await page.getByTestId('input-name').fill(`ping ${String(i)}`);
    await expect(page.getByTestId('scenario-name')).toHaveText(`ping ${String(i)}`);
    pingEnds_ms.push(await page.evaluate(() => performance.now()));
  }

  await expect(state).toHaveAttribute('data-state', 'current', { timeout: 60_000 });
  // At least one ping was handled and painted before the run finished. This compares in-page
  // timestamps, so it does not depend on when the test happened to read the state.
  const currentAt_ms = await page.evaluate(
    () => (window as unknown as { __stateTimes: Record<string, number> }).__stateTimes.current ?? 0,
  );
  expect(pingEnds_ms.filter((t) => t < currentAt_ms).length).toBeGreaterThan(0);
  const maxGap_ms = await page.evaluate(() => {
    const w = window as unknown as { __maxFrameGap_ms: number; __stop: boolean };
    w.__stop = true;
    return w.__maxFrameGap_ms;
  });
  test.info().annotations.push({ type: 'max frame gap (ms)', description: maxGap_ms.toFixed(1) });
  expect(await recordedStates(page)).toEqual(['none', 'computing', 'current']);
});
