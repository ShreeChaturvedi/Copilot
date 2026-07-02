/**
 * L3 — /api/user* contracts through the real dispatcher, UserService and
 * Postgres. Field names pinned to src/services/api/user.ts (unwraps data.data;
 * UserProfileData/UserPreferences interfaces, user.ts:6-35) and the export
 * download shape (user.ts:98-117).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  closeAppPools,
  resetRateLimitStore,
  type TestServer,
} from './adapter.js';
import {
  makeClient,
  registerUser,
  dbAvailable,
  cleanupPool,
  cleanupTestData,
  type TestUser,
} from './helpers.js';

interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

interface Profile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  googleId: string | null;
  profile: {
    bio: string | null;
    avatarUrl: string | null;
    timezone: string;
    theme: string;
    defaultView: string;
    weekStartsOn: number;
    notificationsEnabled: boolean;
  };
}

interface Preferences {
  theme: 'light' | 'dark' | 'system';
  defaultView: 'calendar' | 'tasks' | 'last-used';
  weekStartsOn: number;
  notificationsEnabled: boolean;
}

describe.skipIf(!dbAvailable)('L3 user contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;
  let user: TestUser;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
    user = await registerUser(req, { name: 'Original Name' });
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  describe('PATCH /api/user/profile', () => {
    it('200 updates name + profile fields; returns the UserProfileData shape (user.ts:6-21)', async () => {
      const r = await req<Envelope<Profile>>('PATCH', '/api/user/profile', {
        token: user.accessToken,
        body: {
          name: 'Updated Name',
          bio: 'building the L3 suite',
          avatarUrl: 'https://example.com/a.png',
          timezone: 'America/New_York',
        },
      });
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({
        id: user.userId,
        email: user.email,
        name: 'Updated Name',
        googleId: null,
      });
      expect(r.body.data!.profile).toMatchObject({
        bio: 'building the L3 suite',
        avatarUrl: 'https://example.com/a.png',
        timezone: 'America/New_York',
      });
      // /me reflects the new name.
      const me = await req<Envelope<{ name: string }>>('GET', '/api/auth/me', {
        token: user.accessToken,
      });
      expect(me.body.data!.name).toBe('Updated Name');
    });

    it('400 VALIDATION_ERROR for a non-URL avatarUrl (zod, profile.ts:15)', async () => {
      const r = await req<Envelope>('PATCH', '/api/user/profile', {
        token: user.accessToken,
        body: { avatarUrl: 'not-a-url' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET/PATCH /api/user/preferences', () => {
    it('GET returns defaults theme:system, defaultView:calendar, weekStartsOn:0, notificationsEnabled:false (UserService.getPreferences:172-175)', async () => {
      const u = await registerUser(req);
      const r = await req<Envelope<Preferences>>(
        'GET',
        '/api/user/preferences',
        { token: u.accessToken }
      );
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({
        theme: 'system',
        defaultView: 'calendar',
        weekStartsOn: 0,
        notificationsEnabled: false,
      });
    });

    it('PATCH persists changes and echoes the full preferences object', async () => {
      const u = await registerUser(req);
      const patch = await req<Envelope<Preferences>>(
        'PATCH',
        '/api/user/preferences',
        {
          token: u.accessToken,
          body: {
            theme: 'dark',
            defaultView: 'tasks',
            weekStartsOn: 1,
            notificationsEnabled: true,
          },
        }
      );
      expect(patch.status).toBe(200);
      expect(patch.body.data).toEqual({
        theme: 'dark',
        defaultView: 'tasks',
        weekStartsOn: 1,
        notificationsEnabled: true,
      });
      const after = await req<Envelope<Preferences>>(
        'GET',
        '/api/user/preferences',
        { token: u.accessToken }
      );
      expect(after.body.data!.theme).toBe('dark');
      expect(after.body.data!.weekStartsOn).toBe(1);
    });

    it('400 VALIDATION_ERROR for an out-of-enum theme and out-of-range weekStartsOn', async () => {
      const badTheme = await req<Envelope>('PATCH', '/api/user/preferences', {
        token: user.accessToken,
        body: { theme: 'neon' },
      });
      expect(badTheme.status).toBe(400);
      expect(badTheme.body.error?.code).toBe('VALIDATION_ERROR');

      const badWeek = await req<Envelope>('PATCH', '/api/user/preferences', {
        token: user.accessToken,
        body: { weekStartsOn: 9 },
      });
      expect(badWeek.status).toBe(400);
    });
  });

  describe('GET /api/user/export', () => {
    it('200 with JSON attachment headers and every data section the export downloads (user.ts:98-117)', async () => {
      const u = await registerUser(req);
      // Seed one row in the main tables so the export is non-trivial.
      const cal = await req<Envelope<{ id: string }>>(
        'POST',
        '/api/calendars',
        {
          token: u.accessToken,
          body: { name: 'Exp Cal', color: '#10b981' },
        }
      );
      await req('POST', '/api/events', {
        token: u.accessToken,
        body: {
          title: 'Exp Event',
          start: '2026-09-01T10:00:00.000Z',
          end: '2026-09-01T11:00:00.000Z',
          calendarId: cal.body.data!.id,
        },
      });
      await req('POST', '/api/tasks', {
        token: u.accessToken,
        body: { title: 'Exp Task' },
      });

      const r = await req<
        Envelope<{
          exportedAt: string;
          version: unknown;
          user: unknown;
          calendars: unknown[];
          events: unknown[];
          taskLists: unknown[];
          tasks: unknown[];
          tags: unknown[];
          taskTags: unknown[];
          attachments: unknown[];
        }>
      >('GET', '/api/user/export', { token: u.accessToken });

      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toContain('application/json');
      expect(r.headers.get('content-disposition')).toContain(
        'taskflow-export-'
      );
      const d = r.body.data!;
      expect(Object.keys(d)).toEqual(
        expect.arrayContaining([
          'exportedAt',
          'user',
          'calendars',
          'events',
          'taskLists',
          'tasks',
          'tags',
          'taskTags',
          'attachments',
        ])
      );
      expect(d.calendars.length).toBeGreaterThanOrEqual(1);
      expect(d.events.length).toBeGreaterThanOrEqual(1);
      expect(d.tasks.length).toBeGreaterThanOrEqual(1);
      // taskTags present (regression #37: mapping rows were previously omitted).
      expect(Array.isArray(d.taskTags)).toBe(true);
    });
  });

  describe('DELETE /api/user (account deletion)', () => {
    it('200 {deleted:true}; cascades the account away so login stops working', async () => {
      const u = await registerUser(req);
      const del = await req<Envelope<{ deleted: boolean }>>(
        'DELETE',
        '/api/user',
        {
          token: u.accessToken,
        }
      );
      expect(del.status).toBe(200);
      expect(del.body.data).toEqual({ deleted: true });

      const login = await req<Envelope>('POST', '/api/auth/login', {
        body: { email: u.email, password: u.password },
      });
      expect(login.status).toBe(401);
    });
  });
});
