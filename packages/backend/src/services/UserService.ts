import { query, withTransaction } from '../config/database.js';

/**
 * User profile, preferences, data-export and account-deletion service.
 *
 * Profile fields live across two tables: `name` on users, and
 * `bio`/`avatarUrl`/`timezone` plus the preference columns on user_profiles.
 * A user_profiles row is created at registration (see AuthService.registerUser),
 * but updates here upsert defensively in case a row is missing.
 */

export interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
}

export interface UserPreferences {
  theme: string;
  defaultView: string;
  weekStartsOn: number;
  notificationsEnabled: boolean;
}

export interface FullUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  googleId: string | null;
  hasPassword: boolean;
  profile: {
    bio: string | null;
    avatarUrl: string | null;
    timezone: string;
  } & UserPreferences;
}

class UserService {
  /**
   * Ensure a user_profiles row exists for the user (idempotent).
   */
  private async ensureProfileRow(userId: string): Promise<void> {
    await query(
      `INSERT INTO user_profiles (id, "userId", timezone)
       VALUES (gen_random_uuid()::text, $1, 'UTC')
       ON CONFLICT ("userId") DO NOTHING`,
      [userId]
    );
  }

  /**
   * Fetch the full user record including profile and preference columns.
   */
  async getFullUser(userId: string): Promise<FullUser | null> {
    const result = await query<{
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      googleId: string | null;
      password: string | null;
      bio: string | null;
      avatarUrl: string | null;
      timezone: string | null;
      theme: string | null;
      defaultView: string | null;
      weekStartsOn: number | null;
      notificationsEnabled: boolean | null;
    }>(
      `SELECT u.id, u.email, u.name, u."createdAt", u."googleId", u.password,
              p.bio, p."avatarUrl", p.timezone, p.theme, p."defaultView",
              p."weekStartsOn", p."notificationsEnabled"
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.createdAt,
      googleId: row.googleId,
      hasPassword: Boolean(row.password),
      profile: {
        bio: row.bio ?? null,
        avatarUrl: row.avatarUrl ?? null,
        timezone: row.timezone ?? 'UTC',
        theme: row.theme ?? 'system',
        defaultView: row.defaultView ?? 'calendar',
        weekStartsOn: row.weekStartsOn ?? 0,
        notificationsEnabled: row.notificationsEnabled ?? false,
      },
    };
  }

  /**
   * Update profile fields (name on users; bio/avatarUrl/timezone on
   * user_profiles). Only provided fields are changed. Returns the full user.
   */
  async updateProfile(
    userId: string,
    update: ProfileUpdate
  ): Promise<FullUser | null> {
    await withTransaction(async (tx) => {
      // Ensure profile row exists.
      await query(
        `INSERT INTO user_profiles (id, "userId", timezone)
         VALUES (gen_random_uuid()::text, $1, 'UTC')
         ON CONFLICT ("userId") DO NOTHING`,
        [userId],
        tx
      );

      if (update.name !== undefined) {
        await query(
          `UPDATE users SET name = $1, "updatedAt" = NOW() WHERE id = $2`,
          [update.name, userId],
          tx
        );
      }

      const profileSets: string[] = [];
      const profileParams: unknown[] = [];
      let idx = 1;
      if (update.bio !== undefined) {
        profileSets.push(`bio = $${idx++}`);
        profileParams.push(update.bio);
      }
      if (update.avatarUrl !== undefined) {
        profileSets.push(`"avatarUrl" = $${idx++}`);
        profileParams.push(update.avatarUrl);
      }
      if (update.timezone !== undefined) {
        profileSets.push(`timezone = $${idx++}`);
        profileParams.push(update.timezone);
      }
      if (profileSets.length > 0) {
        profileParams.push(userId);
        await query(
          `UPDATE user_profiles SET ${profileSets.join(', ')} WHERE "userId" = $${idx}`,
          profileParams,
          tx
        );
      }
    });

    return this.getFullUser(userId);
  }

  /**
   * Read workspace preferences for a user.
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    await this.ensureProfileRow(userId);
    const result = await query<{
      theme: string | null;
      defaultView: string | null;
      weekStartsOn: number | null;
      notificationsEnabled: boolean | null;
    }>(
      `SELECT theme, "defaultView", "weekStartsOn", "notificationsEnabled"
       FROM user_profiles WHERE "userId" = $1 LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    return {
      theme: row?.theme ?? 'system',
      defaultView: row?.defaultView ?? 'calendar',
      weekStartsOn: row?.weekStartsOn ?? 0,
      notificationsEnabled: row?.notificationsEnabled ?? false,
    };
  }

  /**
   * Update workspace preferences. Only provided fields are changed.
   */
  async updatePreferences(
    userId: string,
    update: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    await this.ensureProfileRow(userId);

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (update.theme !== undefined) {
      sets.push(`theme = $${idx++}`);
      params.push(update.theme);
    }
    if (update.defaultView !== undefined) {
      sets.push(`"defaultView" = $${idx++}`);
      params.push(update.defaultView);
    }
    if (update.weekStartsOn !== undefined) {
      sets.push(`"weekStartsOn" = $${idx++}`);
      params.push(update.weekStartsOn);
    }
    if (update.notificationsEnabled !== undefined) {
      sets.push(`"notificationsEnabled" = $${idx++}`);
      params.push(update.notificationsEnabled);
    }

    if (sets.length > 0) {
      params.push(userId);
      await query(
        `UPDATE user_profiles SET ${sets.join(', ')} WHERE "userId" = $${idx}`,
        params
      );
    }

    return this.getPreferences(userId);
  }

  /**
   * Collect all of a user's owned data for export as JSON.
   */
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.getFullUser(userId);

    const calendars = await query(
      `SELECT * FROM calendars WHERE "userId" = $1 ORDER BY "createdAt"`,
      [userId]
    );
    const events = await query(
      `SELECT * FROM events WHERE "userId" = $1 ORDER BY "start"`,
      [userId]
    );
    const taskLists = await query(
      `SELECT * FROM task_lists WHERE "userId" = $1 ORDER BY "createdAt"`,
      [userId]
    );
    const tasks = await query(
      `SELECT * FROM tasks WHERE "userId" = $1 ORDER BY "createdAt"`,
      [userId]
    );
    // Tags attached to this user's tasks (the tags table itself is global).
    const tags = await query(
      `SELECT DISTINCT t.* FROM tags t
       JOIN task_tags tt ON tt."tagId" = t.id
       JOIN tasks tk ON tk.id = tt."taskId"
       WHERE tk."userId" = $1`,
      [userId]
    );
    // task_tags mapping rows so tag-to-task assignments round-trip on re-import
    // (the distinct tags above lose which task carries which tag).
    const taskTags = await query(
      `SELECT tt.* FROM task_tags tt
       JOIN tasks tk ON tk.id = tt."taskId"
       WHERE tk."userId" = $1`,
      [userId]
    );
    const attachments = await query(
      `SELECT a.* FROM attachments a
       JOIN tasks tk ON tk.id = a."taskId"
       WHERE tk."userId" = $1`,
      [userId]
    );

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            profile: user.profile,
          }
        : null,
      calendars: calendars.rows,
      events: events.rows,
      taskLists: taskLists.rows,
      tasks: tasks.rows,
      tags: tags.rows,
      taskTags: taskTags.rows,
      attachments: attachments.rows,
    };
  }

  /**
   * Permanently delete a user. Owned rows (calendars, events, tasks, lists,
   * attachments, refresh tokens, profile) are removed via ON DELETE CASCADE.
   */
  async deleteUser(userId: string): Promise<boolean> {
    const result = await query(`DELETE FROM users WHERE id = $1`, [userId]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const userService = new UserService();
export default UserService;
