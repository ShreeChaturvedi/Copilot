import { test, expect, type Page } from '@playwright/test';
import {
  signupAndEnter,
  gotoTaskView,
  openAddTask,
  createTaskInline,
} from './support/helpers';

/** Fetch the task whose title contains `marker` via the in-app API (proxied). */
async function findTask(page: Page, marker: string) {
  const res = await page.request.get('/api/tasks');
  const body = await res.json();
  return (body.data as Array<Record<string, unknown>>).find((t) =>
    String(t.title ?? '').includes(marker)
  );
}

test.describe('task CRUD', () => {
  test('create a task via the smart input, then delete it', async ({
    page,
  }) => {
    await signupAndEnter(page);
    const marker = `${Date.now()}`;
    const title = `CrudTask ${marker}`;

    // Created through the real EnhancedTaskInput and persisted to Postgres.
    // (Tag/priority *parsing* is covered deterministically by the tag test and
    // the L1 parser suite; it is debounce-timing-sensitive on submit here.)
    await createTaskInline(page, title);

    const created = await findTask(page, marker);
    expect(created, 'task persisted').toBeTruthy();

    // Delete via the row options menu.
    await page
      .getByRole('button', { name: `Task options for "${title}"` })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(page.getByText(title, { exact: false })).toHaveCount(0);
    expect(await findTask(page, marker), 'task removed from DB').toBeFalsy();
  });

  test('tag add + remove round-trips through the DB (#30)', async ({
    page,
  }) => {
    await signupAndEnter(page);
    const marker = `${Date.now()}`;
    const title = `TagTask ${marker}`;
    await createTaskInline(page, title);

    // Open the detail sheet and add a tag.
    await page.getByText(title, { exact: false }).first().click();
    await page.getByRole('button', { name: 'Add tag' }).first().click();
    const tagInput = page.getByRole('textbox', { name: 'Tag name' });
    await tagInput.fill('urgent');
    await tagInput.press('Enter');

    await expect
      .poll(async () => {
        const t = await findTask(page, marker);
        return (
          (t?.tags as Array<{ name?: string; value?: string }>)?.map(
            (g) => g.name ?? g.value
          ) ?? []
        );
      })
      .toContain('urgent');

    // Remove it again — the regression that shipped as #30.
    await page
      .getByRole('button', { name: /^Remove tag/ })
      .first()
      .click();
    await expect
      .poll(async () => {
        const t = await findTask(page, marker);
        return (t?.tags as unknown[])?.length ?? 0;
      })
      .toBe(0);
  });

  // Regression for #71: the inline description must survive task create.
  test('description typed in the inline input persists', async ({ page }) => {
    await signupAndEnter(page);
    await gotoTaskView(page);
    const marker = `${Date.now()}`;
    const title = `DescTask ${marker}`;

    const textarea = await openAddTask(page);
    await textarea.click();
    await textarea.type(title, { delay: 8 });
    await textarea.press('Shift+Enter'); // focus the description field
    await page.locator('#enhanced-task-input-description').type('Body text', {
      delay: 8,
    });
    await page.locator('#enhanced-task-input-description').press('Enter');
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();

    const created = await findTask(page, marker);
    expect(created!.description).toBe('Body text');
  });
});
