import { test, expect } from '@playwright/test';
import {
  appPath,
  signupAndEnter,
  openSettingsSection,
  waitForApp,
} from './support/helpers';

test.describe('settings', () => {
  test('account: display name update persists across reload', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(page, 'account');

    const nameField = page.getByLabel('Display name');
    await expect(nameField).toBeVisible();
    await nameField.fill('Renamed User');
    // Blur-save (instant-apply model) — leave the field so the PATCH fires.
    await nameField.blur();
    await expect(page.getByText(/^Saved$/i)).toBeVisible({ timeout: 10_000 });

    // Reload; the persisted profile rehydrates and re-verifies via /api/auth/me.
    await page.goto(appPath('/'));
    await waitForApp(page);
    await openSettingsSection(page, 'account');
    await expect(page.getByLabel('Display name')).toHaveValue('Renamed User');
  });

  test('data export downloads a JSON file including task_tags', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(page, 'security');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const payload = parsed.data ?? parsed;

    expect(payload).toHaveProperty('taskTags');
    expect(payload).toHaveProperty('tasks');
    expect(Array.isArray(payload.taskTags)).toBeTruthy();
  });

  test('preferences: default view persists across reload', async ({ page }) => {
    await signupAndEnter(page);
    await openSettingsSection(page, 'general');

    const select = page.locator('#default-view');
    await expect(select).toBeVisible();
    await select.click();
    // Pick a value distinct from the Calendar default.
    await page.getByRole('option', { name: 'Last used' }).click();
    // Instant apply — no Save button. Reopen after reload to confirm.
    await page.goto(appPath('/'));
    await waitForApp(page);
    await openSettingsSection(page, 'general');
    await expect(page.locator('#default-view')).toContainText('Last used');
  });

  test('delete account logs the user out to the login page', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(page, 'security');

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Delete your account?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page).toHaveURL(new RegExp(`${appPath('/login')}$`));
    await expect(page.locator('#email')).toBeVisible();
  });
});
