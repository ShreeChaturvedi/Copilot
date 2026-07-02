import { test, expect } from '@playwright/test';
import {
  appPath,
  login,
  signupAndEnter,
  uniqueEmail,
  waitForApp,
  readResetLinkFromLog,
} from './support/helpers';
import { TEST_PASSWORD } from './support/constants';

test.describe('auth', () => {
  test('signup creates an account and lands in the app', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto(appPath('/signup'));
    await page.locator('#name').fill('New User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#confirmPassword').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await waitForApp(page);
    // Redirected off the auth pages onto the app root.
    await expect(page).toHaveURL(new RegExp(`${appPath('/')}?$`));
  });

  test('login authenticates an existing user', async ({ page, context }) => {
    const user = await signupAndEnter(page);
    // Drop the session and log back in through the form.
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(appPath('/login'));

    await login(page, user.email, user.password);
    await expect(page.locator('[data-view]')).toBeVisible();
  });

  test('rejects invalid credentials with an inline error', async ({ page }) => {
    await page.goto(appPath('/login'));
    await page.locator('#email').fill(uniqueEmail());
    await page.locator('#password').fill('Wrong-Password-1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[data-view]')).toHaveCount(0);
  });

  test('session persists across a full reload', async ({ page }) => {
    await signupAndEnter(page);
    // React Router lands on '/app' (no trailing slash); dev Vite only serves the
    // SPA at the canonical base '/app/' (prod handles bare '/app' via a
    // vercel.json rewrite). Reload there to exercise real persistence.
    await page.goto(appPath('/'));
    await waitForApp(page);
    await page.reload();
    // ProtectedRoute re-verifies the persisted token via /api/auth/me.
    await waitForApp(page);
  });

  test('reset-password round trip: request, reset via token, log in', async ({
    page,
  }) => {
    const user = await signupAndEnter(page);
    await page.evaluate(() => localStorage.clear());

    // 1. Request a reset link.
    await page.goto(appPath('/forgot-password'));
    await page.locator('#email').fill(user.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // 2. Read the emitted link from the captured server log (email unconfigured).
    const resetLink = await readResetLinkFromLog(user.email);
    const token = new URL(resetLink).searchParams.get('token');
    expect(token, 'reset token present in logged link').toBeTruthy();

    // 3. Open the confirm page with the token and set a new password.
    const newPassword = 'NewPassw0rd!42';
    await page.goto(appPath(`/reset-password?token=${token}`));
    await page.locator('#password').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // 4. The new password works; the old one no longer does.
    await login(page, user.email, newPassword);
    await expect(page.locator('[data-view]')).toBeVisible();
  });
});
