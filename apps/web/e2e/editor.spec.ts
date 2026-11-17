import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const state = (page: Page) => page.getByTestId('result-state');

async function run(page: Page): Promise<void> {
  await page.getByTestId('run-button').click();
}

async function fill(page: Page, id: string, value: string): Promise<void> {
  await page.getByTestId(`input-${id}`).fill(value);
}

test('layout shell: three columns, toolbar, and the labelled scene region holding the 3D view', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Simulation view (3D)' })).toBeVisible();
  const region = page.getByTestId('scene-region');
  await expect(region).toBeVisible();
  await expect(page.getByTestId('scene-container').getByTestId('workspace-scene')).toBeVisible();
  await expect(page.getByTestId('editor-column')).toBeVisible();
  await expect(page.getByTestId('diagnostics-panel')).toBeVisible();
  // Initially: chip "No result" and the "none" banner, both text, not colour alone.
  await expect(state(page)).toContainText('No result');
  await expect(page.getByTestId('result-banner')).toContainText('No result yet');
});

test('every scenario and element field shows its unit; computed values are distinct', async ({
  page,
}) => {
  await page.goto('/');
  const units: Record<string, string> = {
    epoch: 'UTC',
    duration: 's',
    step: 's',
    a: 'km',
    e: '-',
    i: 'deg',
    raan: 'deg',
    argp: 'deg',
    nu: 'deg',
  };
  for (const [id, unit] of Object.entries(units)) {
    await expect(page.getByTestId(`unit-${id}`)).toHaveText(unit);
  }
  // Defaults are shown in km and deg (7 000 000 m, pi/4 rad).
  await expect(page.getByTestId('input-a')).toHaveValue('7000');
  await expect(page.getByTestId('input-i')).toHaveValue('45');
  // Editable inputs are inputs; computed outputs (derived panel, result) are not.
  await expect(page.getByTestId('derived-panel').locator('input')).toHaveCount(0);
  await expect(page.getByTestId('summary-panel').locator('input')).toHaveCount(0);
  await expect(
    page.getByTestId('derived-panel').getByText('computed', { exact: true }),
  ).toBeVisible();
});

test('edit each field class, run, and see a current result; physical edits stale it', async ({
  page,
}) => {
  await page.goto('/');
  await fill(page, 'name', 'LEO test');
  await fill(page, 'epoch', '2027-03-04T05:06:07.000Z');
  await fill(page, 'duration', '3000');
  await fill(page, 'step', '30');
  await fill(page, 'a', '7200');
  await fill(page, 'e', '0.05');
  await fill(page, 'i', '60');
  await fill(page, 'raan', '10');
  await fill(page, 'argp', '20');
  await fill(page, 'nu', '30');
  await expect(page.getByTestId('scenario-name')).toHaveText('LEO test');
  await expect(page.getByTestId('run-blocked')).toHaveCount(0);

  await run(page);
  await expect(state(page)).toHaveAttribute('data-state', 'current');
  // 3000 s at 30 s -> 101 samples.
  await expect(page.getByTestId('sample-count')).toHaveText('101');

  // The name is display-only.
  await fill(page, 'name', 'LEO test 2');
  await expect(state(page)).toHaveAttribute('data-state', 'current');

  for (const [id, value] of [
    ['epoch', '2027-03-04T05:06:08.000Z'],
    ['duration', '3030'],
    ['step', '31'],
    ['a', '7300'],
    ['e', '0.06'],
    ['i', '61'],
    ['raan', '11'],
    ['argp', '21'],
    ['nu', '31'],
  ] as const) {
    await run(page);
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await fill(page, id, value);
    await expect(state(page)).toHaveAttribute('data-state', 'stale');
    await expect(page.getByTestId('result-banner')).toContainText('Stale');
    await expect(page.getByTestId('input-' + id)).toHaveValue(value);
  }
});

test.describe('field-level validation prevents the run (ML-FR-002 AC2)', () => {
  const cases: [string, string, string, string][] = [
    ['a <= 0', 'a', '-5', 'SEMI_MAJOR_AXIS_NOT_POSITIVE'],
    ['a not finite (blank)', 'a', '', 'NON_FINITE_NUMBER'],
    ['a not finite (text)', 'a', 'abc', 'NON_FINITE_NUMBER'],
    ['e < 0', 'e', '-0.1', 'ECCENTRICITY_OUT_OF_RANGE'],
    ['e >= 1', 'e', '1', 'ECCENTRICITY_OUT_OF_RANGE'],
    ['i > 180 deg', 'i', '181', 'INCLINATION_OUT_OF_RANGE'],
    ['i < 0 deg', 'i', '-1', 'INCLINATION_OUT_OF_RANGE'],
    ['raan outside [0, 360)', 'raan', '360', 'ANGLE_OUT_OF_RANGE'],
    ['argp outside [0, 360)', 'argp', '-10', 'ANGLE_OUT_OF_RANGE'],
    ['nu outside [0, 360)', 'nu', '400', 'ANGLE_OUT_OF_RANGE'],
    ['duration <= 0', 'duration', '0', 'DURATION_NOT_POSITIVE'],
    ['step <= 0', 'step', '-1', 'OUTPUT_STEP_NOT_POSITIVE'],
    ['epoch malformed', 'epoch', '2026-01-01', 'EPOCH_INVALID'],
  ];
  for (const [name, id, value, code] of cases) {
    test(name, async ({ page }) => {
      await page.goto('/');
      await fill(page, id, value);
      const message = page.getByTestId(`error-${id}`);
      await expect(message).toBeVisible();
      await expect(message).toContainText(code);
      await expect(page.getByTestId(`input-${id}`)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('run-blocked')).toBeVisible();
      // A click that does not move focus: an angle field keeps its out-of-range text (a normal
      // click would first blur it, which normalises it; see the normalisation tests below).
      await page.getByTestId('run-button').dispatchEvent('click');
      // The run is prevented: the result state is unchanged (none), never computing.
      await expect(state(page)).toHaveAttribute('data-state', 'none');
    });
  }

  test('perigee not above the reference radius', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'a', '6000');
    await expect(page.getByTestId('error-orbit')).toContainText('PERIGEE_BELOW_REFERENCE_RADIUS');
    await run(page);
    await expect(state(page)).toHaveAttribute('data-state', 'none');
    await fill(page, 'a', '7000');
    await expect(page.getByTestId('error-orbit')).toHaveCount(0);
    await run(page);
    await expect(state(page)).toHaveAttribute('data-state', 'current');
  });

  test('a validation failure does not change an existing current result', async ({ page }) => {
    await page.goto('/');
    await run(page);
    await expect(state(page)).toHaveAttribute('data-state', 'current');
    await fill(page, 'e', '1.5');
    // The edit itself is physical: stale. The rejected run then leaves it stale, never none/error.
    await expect(state(page)).toHaveAttribute('data-state', 'stale');
    await run(page);
    await expect(state(page)).toHaveAttribute('data-state', 'stale');
  });
});

test('maneuver: add, edit, UTC label, total |dv| from the engine, remove', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('no-maneuver')).toBeVisible();
  await expect(page.getByTestId('rsw-note')).toContainText('not the velocity direction');

  await page.getByTestId('add-maneuver').click();
  await expect(page.getByTestId('maneuver-0')).toBeVisible();
  await fill(page, 'm0-time', '3600');
  await expect(page.getByTestId('field-m0-time')).toContainText('2026-01-01T01:00:00.000Z UTC');
  await fill(page, 'm0-dv-s', '100');
  await expect(page.getByTestId('unit-m0-dv-s')).toHaveText('m/s');
  await expect(page.getByTestId('dv-total-0')).toContainText('run to compute');

  // Duration is 6000 s, so a maneuver at 3600 s is valid and runs.
  await run(page);
  await expect(state(page)).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('dv-total-0')).toHaveText('100 m/s');
  await expect(page.getByTestId('event-count')).toHaveText('1');

  // Editing the Δv makes the shown total stale (marked), and a rerun updates it.
  await fill(page, 'm0-dv-r', '30');
  await expect(state(page)).toHaveAttribute('data-state', 'stale');
  await run(page);
  await expect(state(page)).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('dv-total-0')).not.toHaveText('100 m/s');

  await page.getByTestId('remove-maneuver-0').click();
  await expect(page.getByTestId('maneuver-0')).toHaveCount(0);
  await expect(state(page)).toHaveAttribute('data-state', 'stale');
  await run(page);
  await expect(page.getByTestId('event-count')).toHaveText('0');
});

test('maneuver validation: time out of range, non-finite dv, and the second maneuver', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('add-maneuver').click();
  await fill(page, 'm0-time', '7000');
  await expect(page.getByTestId('error-m0-time')).toContainText('MANEUVER_TIME_OUT_OF_RANGE');
  await fill(page, 'm0-time', '-1');
  await expect(page.getByTestId('error-m0-time')).toContainText('MANEUVER_TIME_OUT_OF_RANGE');
  await fill(page, 'm0-time', '100');
  await expect(page.getByTestId('error-m0-time')).toHaveCount(0);

  await fill(page, 'm0-dv-s', 'x');
  await expect(page.getByTestId('error-m0-dv-s')).toContainText('NON_FINITE_NUMBER');
  await run(page);
  await expect(state(page)).toHaveAttribute('data-state', 'none');
  await fill(page, 'm0-dv-s', '5');

  await page.getByTestId('add-maneuver').click();
  const limit = page.getByTestId('error-maneuvers');
  await expect(limit).toContainText('MANEUVER_COUNT_EXCEEDED');
  await expect(limit).toContainText('At most 1 maneuver');
  await run(page);
  await expect(state(page)).toHaveAttribute('data-state', 'none');
  await page.getByTestId('remove-maneuver-1').click();
  await expect(page.getByTestId('error-maneuvers')).toHaveCount(0);
});

test.describe('angle normalisation (ML-FR-002 AC2)', () => {
  const cases: [string, string, string, string][] = [
    ['raan 360 deg', 'raan', '360', '0'],
    ['raan 370 deg', 'raan', '370', '10'],
    ['argp -10 deg', 'argp', '-10', '350'],
    ['nu 400 deg', 'nu', '400', '40'],
  ];
  for (const [name, id, typed, normalised] of cases) {
    test(name + ' is normalised into [0, 360) when the field loses focus', async ({ page }) => {
      await page.goto('/');
      await fill(page, id, typed);
      // While typing, the engine message is shown and the run is blocked.
      await expect(page.getByTestId(`error-${id}`)).toContainText('ANGLE_OUT_OF_RANGE');
      await page.getByTestId(`input-${id}`).blur();
      await expect(page.getByTestId(`input-${id}`)).toHaveValue(normalised);
      await expect(page.getByTestId(`error-${id}`)).toHaveCount(0);
      await expect(page.getByTestId('run-blocked')).toHaveCount(0);
      await run(page);
      await expect(state(page)).toHaveAttribute('data-state', 'current');
    });
  }
});

test.describe('derived values (ML-FR-002 AC4) come from the engine and are visibly outputs', () => {
  test('default orbit: perigee/apogee radius and altitude, period, specific energy', async ({
    page,
  }) => {
    await page.goto('/');
    const panel = page.getByTestId('derived-panel');
    // Default a = 7000 km, e = 0.01: r_p = 6930 km, r_a = 7070 km (hand calculation).
    await expect(panel.getByTestId('derived-perigee-radius')).toContainText('6930 km');
    await expect(panel.getByTestId('derived-apogee-radius')).toContainText('7070 km');
    await expect(panel.getByTestId('derived-perigee-altitude')).toContainText('km');
    await expect(panel.getByTestId('derived-apogee-altitude')).toContainText('km');
    await expect(panel.getByTestId('derived-period')).toContainText(' s');
    await expect(panel.getByTestId('derived-specific-energy')).toContainText('km²/s²');
    // Distinct from inputs: no input element, tagged computed, not editable.
    await expect(panel.locator('input')).toHaveCount(0);
    await expect(panel.getByText('computed', { exact: true })).toBeVisible();
  });

  test('derived values follow the inputs and every one carries a unit', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'a', '9000');
    await fill(page, 'e', '0.2');
    const panel = page.getByTestId('derived-panel');
    // r_p = a(1 - e) = 7200 km, r_a = a(1 + e) = 10800 km (hand calculation).
    await expect(panel.getByTestId('derived-perigee-radius')).toContainText('7200 km');
    await expect(panel.getByTestId('derived-apogee-radius')).toContainText('10800 km');
    for (const id of [
      'perigee-radius',
      'apogee-radius',
      'perigee-altitude',
      'apogee-altitude',
      'period',
      'specific-energy',
    ]) {
      await expect(panel.getByTestId(`derived-${id}`)).toContainText(/(km|s|km²\/s²)$/);
    }
  });

  test('invalid orbit inputs: derived values are withheld with a reason', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'e', '1.5');
    await expect(page.getByTestId('derived-unavailable')).toBeVisible();
    await expect(page.getByTestId('derived-perigee-radius')).toHaveCount(0);
  });
});

test.describe('degenerate orbit classification (ML-FR-002 AC3)', () => {
  test('non-degenerate orbit: nothing undefined', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'e', '0.1');
    await expect(page.getByTestId('degeneracy')).toHaveAttribute('data-convention', 'NONE');
    await expect(page.getByTestId('degeneracy-undefined')).toHaveText('none');
  });

  test('circular orbit: argument of perigee undefined, nu is the argument of latitude', async ({
    page,
  }) => {
    await page.goto('/');
    await fill(page, 'e', '0');
    await fill(page, 'i', '45');
    await expect(page.getByTestId('degeneracy')).toHaveAttribute('data-convention', 'CIRCULAR');
    await expect(page.getByTestId('degeneracy-convention')).toHaveText('CIRCULAR');
    await expect(page.getByTestId('degeneracy-undefined')).toContainText('ω');
    await expect(page.getByTestId('degeneracy-undefined')).not.toContainText('Ω');
    await expect(page.getByTestId('degeneracy-note')).toContainText('argument of latitude');
  });

  test('equatorial orbit: RAAN undefined, omega is the longitude of perigee', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'e', '0.1');
    await fill(page, 'i', '0');
    await expect(page.getByTestId('degeneracy')).toHaveAttribute('data-convention', 'EQUATORIAL');
    await expect(page.getByTestId('degeneracy-undefined')).toContainText('Ω');
    await expect(page.getByTestId('degeneracy-note')).toContainText('longitude of perigee');
  });

  test('circular and equatorial: both undefined, nu is the true longitude', async ({ page }) => {
    await page.goto('/');
    await fill(page, 'e', '0');
    await fill(page, 'i', '0');
    await expect(page.getByTestId('degeneracy')).toHaveAttribute(
      'data-convention',
      'CIRCULAR_EQUATORIAL',
    );
    await expect(page.getByTestId('degeneracy-undefined')).toContainText('Ω');
    await expect(page.getByTestId('degeneracy-undefined')).toContainText('ω');
    await expect(page.getByTestId('degeneracy-note')).toContainText('true longitude');
    await expect(page.getByTestId('degeneracy-reported')).toContainText('0°, 0°');
  });
});

test('keyboard only: edit a field, add a maneuver and run the default scenario with focus visible', async ({
  page,
}) => {
  await page.goto('/');

  async function tabTo(testId: string): Promise<void> {
    for (let n = 0; n < 80; n += 1) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') ?? null,
      );
      if (focused === testId) {
        return;
      }
    }
    throw new Error(`could not reach ${testId} by keyboard`);
  }

  // Edit the duration by keyboard.
  await tabTo('input-duration');
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement ?? document.body);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline.style).toBe('solid');
  expect(outline.width).toBe('2px');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('3000');
  await expect(page.getByTestId('input-duration')).toHaveValue('3000');

  // Add a maneuver with Enter on the focused button, edit its time, then remove it with Space.
  await tabTo('add-maneuver');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('maneuver-0')).toBeVisible();
  await tabTo('remove-maneuver-0');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('maneuver-0')).toHaveCount(0);

  // Run with the keyboard (focus moves back through the toolbar from the start).
  await page.evaluate(() => {
    (document.activeElement as HTMLElement).blur();
  });
  await tabTo('run-button');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-state', 'current');
  await expect(page.getByTestId('sample-count')).toHaveText('51');
});
