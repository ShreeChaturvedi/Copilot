/**
 * Shared helpers for the L5 browser E2E suite.
 *
 * The app has no data-testids (verified), so selectors lean on roles +
 * accessible names, label/placeholder text and stable ids. Auth is exercised
 * through the real UI; other flows sign up a fresh user first (signup
 * auto-authenticates and lands on the app).
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { APP_BASE, API_LOG_PATH, TEST_PASSWORD } from './constants';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

/** Absolute in-app path, e.g. appPath('/login') -> '/app/login'. */
export function appPath(rel: string): string {
  return `${APP_BASE}${rel.startsWith('/') ? rel : `/${rel}`}`;
}

/**
 * Wait until the authenticated shell has mounted. MainLayout's root carries
 * `data-view` ("calendar" | "task"); it only renders once ProtectedRoute has
 * verified the session, so it is the reliable "logged in and booted" landmark.
 */
export async function waitForApp(page: Page): Promise<void> {
  await expect(page.locator('[data-view]')).toBeVisible({ timeout: 30_000 });
}

export interface E2EUser {
  email: string;
  password: string;
  name: string;
}

/** Sign up a brand-new user through the real UI; ends on the booted app. */
export async function signupAndEnter(
  page: Page,
  overrides: Partial<E2EUser> = {}
): Promise<E2EUser> {
  const user: E2EUser = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? TEST_PASSWORD,
    name: overrides.name ?? 'E2E User',
  };
  await page.goto(appPath('/signup'));
  await page.locator('#name').fill(user.name);
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#confirmPassword').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await waitForApp(page);
  return user;
}

/** Log in an existing user through the real UI; ends on the booted app. */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(appPath('/login'));
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await waitForApp(page);
}

/**
 * Read the most recent password-reset link emitted for `email`. Email is
 * unconfigured locally, so AuthService logs
 * `[password-reset] Reset link for <email>: <url>` to the dev-server stdout,
 * which the webServer captures to API_LOG_PATH. Polls because the log write
 * happens asynchronously after the forgot-password response returns.
 */
export async function readResetLinkFromLog(
  email: string,
  timeoutMs = 10_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const re = new RegExp(
    `\\[password-reset\\] Reset link for ${email.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}: (\\S+)`
  );
  let lastErr = '';
  while (Date.now() < deadline) {
    try {
      const log = await readFile(API_LOG_PATH, 'utf8');
      const matches = [...log.matchAll(new RegExp(re, 'g'))];
      if (matches.length > 0) return matches[matches.length - 1][1];
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `No reset link for ${email} in ${API_LOG_PATH} within ${timeoutMs}ms${
      lastErr ? ` (${lastErr})` : ''
    }`
  );
}

/** Switch the shell into Task view (kanban/list live here). Idempotent. */
export async function gotoTaskView(page: Page): Promise<void> {
  const root = page.locator('[data-view]');
  if ((await root.getAttribute('data-view')) === 'task') return;
  await page
    .getByRole('button', { name: 'Tasks', exact: true })
    .first()
    .click();
  await expect(root).toHaveAttribute('data-view', 'task');
}

/**
 * Open the inline "Add task" input and return its title textarea. The button is
 * a toggle, so this is a no-op-safe single click; callers should not click it
 * twice (that closes the input again).
 */
export async function openAddTask(page: Page) {
  const textarea = page.locator('#enhanced-task-input-textarea');
  if (!(await textarea.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: 'Add task', exact: true })
      .first()
      .click();
  }
  await expect(textarea).toBeVisible();
  return textarea;
}

/** Create a task from Task view via the inline smart input; returns its title. */
export async function createTaskInline(
  page: Page,
  title: string
): Promise<string> {
  await gotoTaskView(page);
  const textarea = await openAddTask(page);
  await textarea.click();
  await textarea.type(title, { delay: 8 });
  await textarea.press('Enter');
  await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  return title;
}

/**
 * Open the Settings dialog to a section. The dialog is bridged via an
 * `app:open-settings` CustomEvent; a follow-up click on the section's unique
 * nav description disambiguates (the "Preferences" title text also appears in
 * the Calendar item's description). Pass `navDescription` for the sections that
 * need it (general/preferences/etc.); omit for profile (opens directly).
 */
export async function openSettingsSection(
  page: Page,
  section: string,
  navDescription?: string
): Promise<void> {
  await page.evaluate((s) => {
    window.dispatchEvent(
      new CustomEvent('app:open-settings', { detail: { section: s } })
    );
  }, section);
  if (navDescription) {
    await page.getByText(navDescription, { exact: true }).first().click();
  }
}

/**
 * Create a calendar via the app API (used as setup for event flows). A fresh
 * user has none, and the event dialog requires one. Returns the created row.
 */
export async function createCalendarViaApi(
  page: Page,
  name: string,
  color: string
): Promise<{ id: string; color: string }> {
  const res = await page.request.post('/api/calendars', {
    data: { name, color },
  });
  expect(res.ok(), 'calendar created').toBeTruthy();
  const data = (await res.json()).data;
  // Reload so the running app fetches the new calendar (the event dialog needs
  // one selected before it will enable "Create Event").
  await page.goto(appPath('/'));
  await waitForApp(page);
  return data;
}

/**
 * Create an event through the real EventCreationDialog. Assumes a calendar
 * already exists (auto-selected). Set `daily` for a daily recurrence.
 */
export async function createEventViaDialog(
  page: Page,
  title: string,
  opts: { daily?: boolean } = {}
): Promise<void> {
  await gotoCalendarView(page);
  await page.getByRole('button', { name: 'New Event' }).first().click();
  await expect(page.locator('#event-title')).toBeVisible();
  await page.locator('#event-title').fill(title);
  if (opts.daily) {
    await page
      .getByRole('combobox')
      .filter({ hasText: 'Never Repeats' })
      .first()
      .click();
    await page.getByRole('option', { name: 'Daily' }).click();
  }
  await page.getByRole('button', { name: 'Create Event' }).click();
  await expect(page.locator('#event-title')).toHaveCount(0);
}

/** Switch to Month view for stable occurrence/title rendering. */
export async function gotoMonthView(page: Page): Promise<void> {
  await gotoCalendarView(page);
  // Wait for the view-selection toolbar to actually mount before switching. A
  // bare isVisible() check is instantaneous (no auto-wait), so under CI timing
  // it races the calendar's first render and silently skips the switch, leaving
  // the default (Week) view — where a freshly-created event never matches the
  // month-grid assertions. Wait, then click only if not already on Month.
  const monthBtn = page.getByRole('button', { name: 'Month', exact: true });
  await expect(monthBtn).toBeVisible();
  if ((await monthBtn.getAttribute('aria-pressed')) !== 'true') {
    await monthBtn.click();
  }
  await expect(monthBtn).toHaveAttribute('aria-pressed', 'true');
}

/** Switch the shell into Calendar view. Idempotent. */
export async function gotoCalendarView(page: Page): Promise<void> {
  const root = page.locator('[data-view]');
  if ((await root.getAttribute('data-view')) === 'calendar') return;
  await page
    .getByRole('button', { name: 'Calendar', exact: true })
    .first()
    .click();
  await expect(root).toHaveAttribute('data-view', 'calendar');
}
