/**
 * Shared helpers for the L2 real-Postgres service suites
 * (`lib/services/__tests__/*.db.test.ts`).
 *
 * L2 gating convention (mirrors GoogleSyncService.dbintegration.test.ts):
 * these suites run only when L2_TEST_DATABASE_URL points at a migrated test
 * database and cleanly skip otherwise, so the DB-less CI job (`checks`) stays
 * green. Each suite sets process.env.DATABASE_URL to that URL and then
 * dynamically imports lib/config/database.js and the service under test, so
 * both the service's `this.db` pool and the module-level `withTransaction`
 * pool point at the same test database.
 *
 * Isolation: every suite seeds its own users (unique emails) and deletes only
 * those users in afterAll. `users` cascades to calendars/events/task_lists/
 * tasks/task_tags/attachments, so a per-user delete cleans up everything the
 * suite created. Tags are global (unique name, no userId) so suites use
 * prefixed tag names and clean them up explicitly.
 */
import { randomUUID } from 'node:crypto';

/** Set in local runs / CI to a migrated Postgres; unset elsewhere -> suites skip. */
export const L2_DB_URL = process.env.L2_TEST_DATABASE_URL;

/** Minimal shape of the pg query helper the seed factory needs. */
export type QueryFn = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<{ rows: T[]; rowCount: number | null }>;

/** A short unique token so parallel suites/tests never collide on unique keys. */
export const uid = (): string => randomUUID().slice(0, 12);

export interface SeededUser {
  id: string;
  email: string;
  name: string | null;
}

export interface SeededTaskList {
  id: string;
  name: string;
  color: string;
  userId: string;
}

export interface SeededCalendar {
  id: string;
  name: string;
  color: string;
  userId: string;
}

/**
 * Build a set of direct-SQL seed helpers bound to a query function. Seeding via
 * raw SQL (not the services) keeps arrange steps independent of the code under
 * test.
 */
export function makeSeed(query: QueryFn) {
  async function createUser(
    overrides: {
      email?: string;
      name?: string | null;
      password?: string | null;
    } = {}
  ): Promise<SeededUser> {
    const id = randomUUID();
    const email = overrides.email ?? `l2-${uid()}@example.com`;
    const name = overrides.name === undefined ? 'L2 User' : overrides.name;
    const res = await query<SeededUser>(
      `INSERT INTO users (id, email, name, password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name`,
      [id, email.toLowerCase(), name, overrides.password ?? null]
    );
    return res.rows[0];
  }

  async function createTaskList(
    userId: string,
    overrides: {
      name?: string;
      color?: string;
      icon?: string | null;
      description?: string | null;
    } = {}
  ): Promise<SeededTaskList> {
    const res = await query<SeededTaskList>(
      `INSERT INTO task_lists (id, name, color, icon, description, "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, color, "userId"`,
      [
        overrides.name ?? `List ${uid()}`,
        overrides.color ?? '#8B5CF6',
        overrides.icon ?? null,
        overrides.description ?? null,
        userId,
      ]
    );
    return res.rows[0];
  }

  async function createCalendar(
    userId: string,
    overrides: {
      name?: string;
      color?: string;
      isVisible?: boolean;
      isDefault?: boolean;
    } = {}
  ): Promise<SeededCalendar> {
    const res = await query<SeededCalendar>(
      `INSERT INTO calendars (id, name, color, "isVisible", "isDefault", "userId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, color, "userId"`,
      [
        overrides.name ?? `Cal ${uid()}`,
        overrides.color ?? '#10b981',
        overrides.isVisible ?? true,
        overrides.isDefault ?? false,
        userId,
      ]
    );
    return res.rows[0];
  }

  /** Delete users by id; cascades remove all dependent rows. Never throws. */
  async function deleteUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
      userIds,
    ]).catch(() => {});
  }

  /** Delete tags whose name starts with the given prefix (tags are global). */
  async function deleteTagsByPrefix(prefix: string): Promise<void> {
    await query(`DELETE FROM tags WHERE name LIKE $1`, [`${prefix}%`]).catch(
      () => {}
    );
  }

  return {
    createUser,
    createTaskList,
    createCalendar,
    deleteUsers,
    deleteTagsByPrefix,
  };
}

export type Seed = ReturnType<typeof makeSeed>;
