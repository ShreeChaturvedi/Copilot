import { test, expect, type Page } from '@playwright/test';
import { signupAndEnter, gotoCalendarView } from './support/helpers';

/** The calendar header title (month + year split across two spans). */
function titleLocator(page: Page) {
  return page
    .getByRole('heading', { level: 2 })
    .filter({ hasText: /\d{4}/ })
    .first();
}

async function normalizedTitle(page: Page): Promise<string> {
  return (await titleLocator(page).innerText()).replace(/\s+/g, ' ').trim();
}

test.describe('calendar navigation (regression for #32)', () => {
  test('prev / next / today move the visible range', async ({ page }) => {
    await signupAndEnter(page);
    await gotoCalendarView(page);

    // Wait for the header to mount (prev button + titled heading present).
    await expect(
      page.getByRole('button', { name: 'Previous period' })
    ).toBeVisible();
    await expect(titleLocator(page)).toBeVisible();

    // Normalize to Month view so a "period" step is a whole month and the
    // month+year title changes on each step (the default Week view can move
    // within the same month, leaving the coarse title unchanged).
    const monthBtn = page.getByRole('button', { name: 'Month', exact: true });
    await monthBtn.click();
    await expect(monthBtn).toHaveAttribute('aria-pressed', 'true');

    const initial = await normalizedTitle(page);

    // Next moves the range forward.
    await page.getByRole('button', { name: 'Next period' }).click();
    await expect.poll(() => normalizedTitle(page)).not.toBe(initial);
    const afterNext = await normalizedTitle(page);

    // Previous moves it back to where we started.
    await page.getByRole('button', { name: 'Previous period' }).click();
    await expect.poll(() => normalizedTitle(page)).toBe(initial);

    // Today returns to the current range after navigating away.
    await page.getByRole('button', { name: 'Next period' }).click();
    await expect.poll(() => normalizedTitle(page)).toBe(afterNext);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect.poll(() => normalizedTitle(page)).toBe(initial);
  });

  test('switching views changes the calendar range/format', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await gotoCalendarView(page);
    await expect(titleLocator(page)).toBeVisible();

    // Establish a known Month-view baseline first: the default view is Week, so
    // capturing the title before switching would compare a week range against a
    // month title after the round trip.
    const monthBaseline = page.getByRole('button', {
      name: 'Month',
      exact: true,
    });
    await monthBaseline.click();
    await expect(monthBaseline).toHaveAttribute('aria-pressed', 'true');
    const monthTitle = await normalizedTitle(page);

    // Switch to Day view: the segmented control marks it pressed and the title
    // format changes from "<Month> <Year>" to a single day.
    const dayBtn = page.getByRole('button', { name: 'Day', exact: true });
    await dayBtn.click();
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => normalizedTitle(page)).not.toBe(monthTitle);

    // Back to Month view.
    const monthBtn = page.getByRole('button', { name: 'Month', exact: true });
    await monthBtn.click();
    await expect(monthBtn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => normalizedTitle(page)).toBe(monthTitle);
  });
});
