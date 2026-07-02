import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression for issue #37: exportUserData must include the task_tags mapping
 * rows so a re-import can reconstruct which task carries which tag. The DB is
 * mocked (the workspace suite runs in parallel with a table-wiping integration
 * test, so a live round-trip would be flaky); the mock stands in for a real
 * task + tag + mapping and asserts the mapping flows into the export.
 */
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
  query: mockQuery,
  withTransaction: vi.fn(),
}));

const { userService } = await import('../UserService.js');

const TASK_ID = 'vfy-au2-task';
const TAG_ID = 'vfy-au2-tag';

describe('UserService.exportUserData task_tags (issue #37)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Route each SELECT by the table it targets so the result is independent
    // of query call order. Order matters only for the tasks vs task_tags check.
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM users'))
        return {
          rows: [
            {
              id: 'vfy-au2-user',
              email: 'vfy-au2-export@example.com',
              name: 'Export Fixture',
              createdAt: new Date(),
              googleId: null,
              password: null,
            },
          ],
          rowCount: 1,
        };
      if (sql.includes('FROM task_tags'))
        return {
          rows: [
            {
              taskId: TASK_ID,
              tagId: TAG_ID,
              value: 'urgent',
              displayText: 'Urgent',
              iconName: 'flag',
            },
          ],
          rowCount: 1,
        };
      if (sql.includes('FROM tags'))
        return {
          rows: [{ id: TAG_ID, name: 'vfy-au2-tag-name' }],
          rowCount: 1,
        };
      if (sql.includes('FROM tasks'))
        return { rows: [{ id: TASK_ID }], rowCount: 1 };
      // calendars, events, task_lists, attachments
      return { rows: [], rowCount: 0 };
    });
  });

  it('includes the task_tags mapping rows in the export', async () => {
    const data = (await userService.exportUserData('vfy-au2-user')) as Record<
      string,
      unknown
    >;

    // The distinct tag itself is exported (pre-existing behavior).
    expect(Array.isArray(data.tags)).toBe(true);

    // The mapping rows must be present so tag assignments round-trip.
    expect(Array.isArray(data.taskTags)).toBe(true);
    const taskTags = data.taskTags as Array<{ taskId: string; tagId: string }>;
    const mapping = taskTags.find(
      (tt) => tt.taskId === TASK_ID && tt.tagId === TAG_ID
    );
    expect(mapping).toBeDefined();

    // And the mapping query is scoped to the user's tasks.
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM task_tags'),
      ['vfy-au2-user']
    );
  });
});
