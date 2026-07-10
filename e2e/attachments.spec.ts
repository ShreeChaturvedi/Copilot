import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { signupAndEnter, gotoTaskView, openAddTask } from './support/helpers';

const NOTE_TXT = fileURLToPath(new URL('./fixtures/note.txt', import.meta.url));

/**
 * Local uploads have no BLOB_READ_WRITE_TOKEN, so /api/upload returns 503. Per
 * issue #35 the app must SURFACE that failure (no silent data:-URI fallback).
 * This asserts the error toast appears when creating a task with an attachment.
 */
test('attachment upload surfaces the 503 error (no silent fallback, #35)', async ({
  page,
}) => {
  await signupAndEnter(page);
  await gotoTaskView(page);

  const textarea = await openAddTask(page);
  await textarea.click();
  await textarea.type(`Attach task ${Date.now()}`, { delay: 8 });

  // Attach a small valid file through the hidden dropzone input.
  await page.getByRole('button', { name: 'Attach files' }).click();
  await expect(page.getByText('Attach Files')).toBeVisible();
  // Scope to the dialog: the composer card now also renders a drag-drop file
  // input, so a bare input[type=file] matches two elements.
  await page
    .getByRole('dialog')
    .locator('input[type="file"]')
    .setInputFiles(NOTE_TXT);
  await page.getByRole('button', { name: 'Done' }).click();

  // Submitting triggers the upload → 503 → surfaced error toast.
  await textarea.click();
  await textarea.press('Enter');

  await expect(
    page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /cannot be persisted|BLOB_READ_WRITE_TOKEN/i })
      .first()
  ).toBeVisible();
});
