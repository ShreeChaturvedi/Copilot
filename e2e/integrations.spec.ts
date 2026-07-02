import { test, expect } from '@playwright/test';
import { signupAndEnter } from './support/helpers';

/**
 * D's suites own the full Google sync flow; here we only confirm the
 * Integrations panel renders and its Connect button builds an /app-variant
 * auth URL (the redirect URI the client supplies), WITHOUT completing consent.
 *
 * /api/google/status is stubbed "configured" so the Connect button shows on a
 * stack with no Google credentials, and /api/google/connect is intercepted so
 * the browser never navigates to Google.
 */
test('integrations panel: Connect builds an /app-variant auth URL', async ({
  page,
}) => {
  await page.route('**/api/google/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          configured: true,
          connected: false,
          email: null,
          needsReauth: false,
          syncEnabled: false,
          connectedAt: null,
          lastError: null,
          lastErrorAt: null,
          links: [],
        },
      }),
    })
  );
  let connectUrl: string | null = null;
  await page.route('**/api/google/connect*', (route) => {
    connectUrl = route.request().url();
    // Fail closed so the app shows a toast instead of navigating to Google.
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'STUBBED', message: 'stubbed in E2E' },
      }),
    });
  });

  await signupAndEnter(page);

  // Open Settings → Integrations.
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('app:open-settings', {
        detail: { section: 'integrations' },
      })
    )
  );
  await page.locator('button', { hasText: 'Integrations' }).first().click();

  // Panel renders with the Connect affordance.
  const connect = page.getByRole('button', {
    name: /Connect Google Calendar/i,
  });
  await expect(connect).toBeVisible();

  // Clicking it issues the connect request carrying the /app callback redirect.
  await connect.click();
  await expect.poll(() => connectUrl).not.toBeNull();
  const redirectUri = new URL(connectUrl!).searchParams.get('redirectUri');
  expect(redirectUri).toContain('/app/auth/google/callback');
});
