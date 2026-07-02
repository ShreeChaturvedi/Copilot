import { test, expect, type Page } from '@playwright/test';
import { signupAndEnter, appPath, waitForApp } from './support/helpers';
import { resetDatabase } from './support/db';

test.beforeEach(async () => {
  await resetDatabase();
});

async function columnOf(page: Page, taskId: string): Promise<string | null> {
  return page.evaluate(
    (id) =>
      document
        .querySelector(`[data-task-id="${id}"]`)
        ?.closest('[data-column-key]')
        ?.getAttribute('data-column-key') ?? null,
    taskId
  );
}

async function status(page: Page, marker: string): Promise<string | undefined> {
  const res = await page.request.get('/api/tasks');
  const body = await res.json();
  return (body.data as Array<{ title?: string; status?: string }>).find((t) =>
    String(t.title ?? '').includes(marker)
  )?.status;
}

/**
 * Kanban drag between columns, asserting persistence. Uses a list-less task so
 * it lands in the board's default group: tasks assigned to a real list do not
 * populate the board grouping in this dev-server setup (issue #74). @dnd-kit
 * uses pointer events, so a real stepped mouse drag drives it.
 */
test('drag a kanban card between columns persists the new status', async ({
  page,
}) => {
  await signupAndEnter(page);
  const marker = `${Date.now()}`;

  // A task with no list shows in the board's default column.
  const created = await page.request.post('/api/tasks', {
    data: { title: `Kan ${marker}` },
  });
  expect(created.ok()).toBeTruthy();

  // Reload so the board fetches it, then open the board.
  await page.goto(appPath('/'));
  await waitForApp(page);
  await page
    .getByRole('button', { name: 'Tasks', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Board', exact: true }).click();

  const card = page
    .locator('.kanban-card', { hasText: `Kan ${marker}` })
    .first();
  await expect(card).toBeVisible();
  const taskId = (await card.getAttribute('data-task-id'))!;
  expect(await columnOf(page, taskId)).toBe('not_started');

  // Drag it onto the "In progress" column.
  const target = page.locator('[data-column-key="in_progress"]');
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + 8, { steps: 6 });
  await page.mouse.move(to.x + to.width / 2, to.y + 50, { steps: 20 });
  await page.mouse.up();

  await expect.poll(() => columnOf(page, taskId)).toBe('in_progress');
  await expect.poll(() => status(page, marker)).toBe('IN_PROGRESS');

  // The move persists across a reload.
  await page.goto(appPath('/'));
  await waitForApp(page);
  await page
    .getByRole('button', { name: 'Tasks', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(
    page.locator('.kanban-card', { hasText: `Kan ${marker}` }).first()
  ).toBeVisible();
  expect(await columnOf(page, taskId)).toBe('in_progress');
});
