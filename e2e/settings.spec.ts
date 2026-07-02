import { test, expect } from '@playwright/test';
import {
  appPath,
  signupAndEnter,
  openSettingsSection,
  waitForApp,
} from './support/helpers';

test.describe('settings', () => {
  test('profile: display name update persists across reload', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(page, 'profile');

    const nameField = page.getByLabel('Display Name');
    await expect(nameField).toBeVisible();
    await nameField.fill('Renamed User');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/Profile updated/i)).toBeVisible();

    // Reload; the persisted profile rehydrates and re-verifies via /api/auth/me.
    await page.goto(appPath('/'));
    await waitForApp(page);
    await openSettingsSection(page, 'profile');
    await expect(page.getByLabel('Display Name')).toHaveValue('Renamed User');
  });

  test('data export downloads a JSON file including task_tags', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(
      page,
      'general',
      'Account and application settings'
    );

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
    expect(Array.isArray(payload.taskTags)).toBe(true);
  });

  test('preferences: default view persists across reload', async ({ page }) => {
    await signupAndEnter(page);
    await openSettingsSection(
      page,
      'preferences',
      'Workspace and display settings'
    );

    const select = page.locator('#default-view');
    await expect(select).toBeVisible();
    await select.click();
    // Pick a value distinct from the "Calendar View" default.
    await page.getByRole('option', { name: 'Remember Last Used' }).click();
    await page.getByRole('button', { name: 'Save Preferences' }).click();

    await page.goto(appPath('/'));
    await waitForApp(page);
    await openSettingsSection(
      page,
      'preferences',
      'Workspace and display settings'
    );
    await expect(page.locator('#default-view')).toContainText(
      'Remember Last Used'
    );
  });

  test('delete account logs the user out to the login page', async ({
    page,
  }) => {
    await signupAndEnter(page);
    await openSettingsSection(
      page,
      'general',
      'Account and application settings'
    );

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Delete your account?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page).toHaveURL(new RegExp(`${appPath('/login')}$`));
    await expect(page.locator('#email')).toBeVisible();
  });
});
