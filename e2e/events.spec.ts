import { test, expect, type Page } from '@playwright/test';
import {
  signupAndEnter,
  createCalendarViaApi,
  createEventViaDialog,
  gotoMonthView,
} from './support/helpers';
import { resetDatabase } from './support/db';

// Event flows share the single dev-user backend (calendars are UNIQUE per user
// and the dialog auto-selects the default calendar), so isolate each test.
test.beforeEach(async () => {
  await resetDatabase();
});

// Wide range that captures a month of daily occurrences regardless of "today".
function rangeQuery(): string {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 35);
  return `start=${start.toISOString()}&end=${end.toISOString()}`;
}

async function occurrenceCount(page: Page, marker: string): Promise<number> {
  const res = await page.request.get(`/api/events?${rangeQuery()}`);
  const body = await res.json();
  return (body.data as Array<{ title?: string }>).filter((e) =>
    String(e.title ?? '').includes(marker)
  ).length;
}

test.describe('event CRUD, recurrence, exceptions, color', () => {
  test('create a single event, then delete it', async ({ page }) => {
    await signupAndEnter(page);
    await createCalendarViaApi(page, 'Work', '#3B82F6');
    const marker = `${Date.now()}`;
    const title = `Sync ${marker}`;

    await gotoMonthView(page);
    await createEventViaDialog(page, title);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();

    // Delete (non-recurring → no scope dialog).
    await page.getByText(title, { exact: false }).first().click();
    await page
      .getByRole('button', { name: /^Delete/i })
      .first()
      .click();

    await expect(page.getByText(title, { exact: false })).toHaveCount(0);
    expect(await occurrenceCount(page, marker)).toBe(0);
  });

  test('recurring event expands into occurrences that survive reload', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await createCalendarViaApi(page, 'Work', '#3B82F6');
    const marker = `${Date.now()}`;
    const title = `Standup ${marker}`;

    await gotoMonthView(page);
    await createEventViaDialog(page, title, { daily: true });

    // Many occurrences render and the master carries the RRULE.
    expect(await occurrenceCount(page, marker)).toBeGreaterThan(5);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();

    // Recurrence survives a full reload.
    await page.reload();
    await gotoMonthView(page);
    expect(await occurrenceCount(page, marker)).toBeGreaterThan(5);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  });

  test('deleting one occurrence records a persisted exception', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await createCalendarViaApi(page, 'Work', '#3B82F6');
    const marker = `${Date.now()}`;
    const title = `Daily ${marker}`;

    await gotoMonthView(page);
    await createEventViaDialog(page, title, { daily: true });
    const before = await occurrenceCount(page, marker);
    expect(before).toBeGreaterThan(5);

    // Remove a single occurrence via the "This event" scope.
    await page.getByText(title, { exact: false }).first().click();
    await page
      .getByRole('button', { name: /^Delete/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'This event' }).click();

    await expect.poll(() => occurrenceCount(page, marker)).toBe(before - 1);

    // The exception persists across reload (no resurrection of the occurrence).
    await page.reload();
    await gotoMonthView(page);
    expect(await occurrenceCount(page, marker)).toBe(before - 1);
  });

  test('event color (inherited from its calendar) persists across reload', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await createCalendarViaApi(page, 'Colorful', '#FF5733');
    const marker = `${Date.now()}`;
    const title = `Colored ${marker}`;

    await gotoMonthView(page);
    await createEventViaDialog(page, title);

    // FullCalendar carries the calendar color on the chip as a CSS var.
    const chip = page.locator('.fc-event', { hasText: title }).first();
    await expect(chip).toHaveAttribute('style', /--chip-c:\s*#FF5733/i);

    await page.reload();
    await gotoMonthView(page);
    await expect(
      page.locator('.fc-event', { hasText: title }).first()
    ).toHaveAttribute('style', /--chip-c:\s*#FF5733/i);
  });
});
