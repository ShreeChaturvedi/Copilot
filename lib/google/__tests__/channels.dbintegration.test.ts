/**
 * M3 push-channel integration tests: the real /api/google endpoint logic
 * (googleApi.ts) driven end-to-end with FakeGoogleCalendarClient against a
 * REAL local Postgres (plan §9), via the injectable client factory.
 *
 * Gated behind GOOGLE_SYNC_TEST_DB_URL like the M1/M2 suites. Run locally:
 *
 *   docker exec react-calendar-postgres psql -U postgres -c \
 *     'CREATE DATABASE react_calendar_sync_test'
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_sync_test \
 *     npm run db:migrate
 *   GOOGLE_SYNC_TEST_DB_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_sync_test \
 *     npx vitest run --config vitest.backend.config.ts lib/google/__tests__/channels.dbintegration.test.ts
 *
 * Covers: watch-at-link persistence, webhook token validation and routing
 * (valid / invalid / unknown / expired / sync-ack), the renewal sweep, and
 * the plan's required M3 proof — a killed channel still converges through
 * the 15-min reconciliation path (syncAllUsers), which also re-establishes
 * the channel.
 *
 * This file's sweeps (syncAllUsers / renewChannels) scan EVERY account in
 * the database, so the google db suites are serialized with a Postgres
 * advisory lock (see GOOGLE_DB_SUITE_LOCK in each dbintegration file).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { FakeGoogleCalendarClient } from '../FakeGoogleCalendarClient.js';
import type { CalendarLinkRow } from '../syncRepo.js';

const DB_URL = process.env.GOOGLE_SYNC_TEST_DB_URL;
const WEBHOOK_URL = 'https://taskflow-m3.test/api/google/webhook';

/** Shared advisory-lock key serializing the google db suites. */
const GOOGLE_DB_SUITE_LOCK = 271_828;

type Repo = typeof import('../syncRepo.js');
type Db = typeof import('../../config/database.js');
type GoogleApi = typeof import('../googleApi.js');
type Channels = typeof import('../channels.js');

describe.skipIf(!DB_URL)(
  'M3 push channels (Fake client + real Postgres)',
  () => {
    let repo: Repo;
    let db: Db;
    let googleApi: GoogleApi;
    let channels: Channels;
    let lockClient: PoolClient;
    let envBackup: Record<string, string | undefined>;
    let userId: string;

    beforeAll(async () => {
      envBackup = {
        DATABASE_URL: process.env.DATABASE_URL,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_TOKEN_ENC_KEY: process.env.GOOGLE_TOKEN_ENC_KEY,
        GOOGLE_WEBHOOK_URL: process.env.GOOGLE_WEBHOOK_URL,
      };
      process.env.DATABASE_URL = DB_URL!;
      // Sync must look configured (requireConfigured()); tokens are never
      // decrypted because every Google call goes through the injected Fake.
      process.env.GOOGLE_CLIENT_ID = 'm3-test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'm3-test-client-secret';
      process.env.GOOGLE_TOKEN_ENC_KEY = 'a'.repeat(64);
      process.env.GOOGLE_WEBHOOK_URL = WEBHOOK_URL;

      db = await import('../../config/database.js');
      repo = await import('../syncRepo.js');
      googleApi = await import('../googleApi.js');
      channels = await import('../channels.js');

      lockClient = await db.pool.connect();
      await lockClient.query('SELECT pg_advisory_lock($1)', [
        GOOGLE_DB_SUITE_LOCK,
      ]);
    }, 120_000);

    afterAll(async () => {
      if (lockClient) {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [
          GOOGLE_DB_SUITE_LOCK,
        ]);
        lockClient.release();
      }
      if (db) await db.pool.end();
      for (const [k, v] of Object.entries(envBackup)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    beforeEach(async () => {
      // Fence: syncAllUsers/renewChannels scan every account. The suites are
      // advisory-lock serialized, so leftover accounts here can only be dead
      // residue of a previously finished file — clear them.
      await db.query('DELETE FROM google_accounts');
      await db.query(`DELETE FROM users WHERE email LIKE 'm3-test-%'`);
      const u = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, name)
       VALUES (gen_random_uuid()::text, $1, 'M3 Test') RETURNING id`,
        [
          `m3-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        ]
      );
      userId = u.rows[0].id;
      await db.query(
        `INSERT INTO google_accounts ("userId", "googleUserId", email, "refreshTokenEnc")
       VALUES ($1, 'm3-google-user', 'm3-test@example.com', 'not-a-real-token')`,
        [userId]
      );
    });

    function uniqueCalId(label = 'primary'): string {
      return `m3-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    }

    function clientForFake(fake: FakeGoogleCalendarClient) {
      return async () => fake;
    }

    function webhookHeaders(
      link: CalendarLinkRow,
      overrides: Record<string, string> = {}
    ): Record<string, string> {
      return {
        'x-goog-channel-id': link.channelId!,
        'x-goog-resource-id': link.channelResourceId!,
        'x-goog-channel-token': link.channelToken!,
        'x-goog-resource-state': 'exists',
        'x-goog-message-number': '2',
        ...overrides,
      };
    }

    async function link(fake: FakeGoogleCalendarClient, calId: string) {
      await googleApi.linkCalendar(userId, calId, clientForFake(fake));
      const row = await repo.getLinkByGoogleCalendarId(userId, calId);
      expect(row).not.toBeNull();
      return row!;
    }

    async function eventTitles(): Promise<string[]> {
      const res = await db.query<{ title: string }>(
        `SELECT title FROM events WHERE "userId" = $1 ORDER BY title`,
        [userId]
      );
      return res.rows.map((r) => r.title);
    }

    it('watch-at-link persists the full channel state', async () => {
      const calId = uniqueCalId();
      const fake = new FakeGoogleCalendarClient(calId);
      await fake.insertEvent(calId, {
        summary: 'Existing meeting',
        start: { dateTime: '2026-07-06T14:00:00Z' },
        end: { dateTime: '2026-07-06T15:00:00Z' },
      });

      const row = await link(fake, calId);

      // Channel columns persisted from the watch response.
      expect(row.channelId).toBeTruthy();
      expect(row.channelResourceId).toBe(`fake-resource-${row.channelId}`);
      expect(row.channelToken).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
      expect(row.channelExpiration).toBeInstanceOf(Date);
      // ~7 days out -> comfortably outside the 48h renewal window.
      expect(channels.channelNeedsRenewal(row)).toBe(false);

      // The watch request carried the 7-day TTL, the public address, and the
      // same per-channel secret that was persisted.
      expect(fake.watchedChannels).toHaveLength(1);
      expect(fake.watchedChannels[0]).toMatchObject({
        id: row.channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        token: row.channelToken,
        params: { ttl: '604800' },
      });

      // Import itself still worked.
      expect(await eventTitles()).toEqual(['Existing meeting']);
    });

    it('valid webhook triggers an incremental sync of the right link only', async () => {
      const calA = uniqueCalId('a');
      const calB = uniqueCalId('b');
      const fake = new FakeGoogleCalendarClient(calA);
      fake.addCalendar({ id: calB, summary: 'Second calendar' });
      const linkA = await link(fake, calA);
      const linkB = await link(fake, calB);

      // Both calendars change on Google; only A's channel pings.
      await fake.insertEvent(calA, {
        summary: 'Pushed to A',
        start: { dateTime: '2026-07-08T09:00:00Z' },
        end: { dateTime: '2026-07-08T09:30:00Z' },
      });
      await fake.insertEvent(calB, {
        summary: 'Silent on B',
        start: { dateTime: '2026-07-08T10:00:00Z' },
        end: { dateTime: '2026-07-08T10:30:00Z' },
      });

      const result = await googleApi.handleWebhook(
        webhookHeaders(linkA),
        clientForFake(fake)
      );
      expect(result.outcome).toBe('synced');
      expect(result.linkId).toBe(linkA.id);
      expect(result.stats?.mode).toBe('incremental');
      expect(result.stats?.inserted).toBe(1);

      // A's event landed; B's did not (its channel never pinged).
      expect(await eventTitles()).toContain('Pushed to A');
      expect(await eventTitles()).not.toContain('Silent on B');

      // B's link was not touched by A's notification.
      const freshB = await repo.getLinkByGoogleCalendarId(userId, calB);
      expect(freshB!.syncToken).toBe(linkB.syncToken);
    });

    it("acks the initial 'sync' ping without pulling", async () => {
      const calId = uniqueCalId();
      const fake = new FakeGoogleCalendarClient(calId);
      const row = await link(fake, calId);
      await fake.insertEvent(calId, {
        summary: 'Not yet pulled',
        start: { dateTime: '2026-07-08T09:00:00Z' },
        end: { dateTime: '2026-07-08T09:30:00Z' },
      });

      const result = await googleApi.handleWebhook(
        webhookHeaders(row, { 'x-goog-resource-state': 'sync' }),
        clientForFake(fake)
      );
      expect(result).toEqual({ outcome: 'acknowledged', linkId: row.id });
      expect(await eventTitles()).not.toContain('Not yet pulled');
    });

    it('rejects invalid, missing, and unknown channel credentials', async () => {
      const calId = uniqueCalId();
      const fake = new FakeGoogleCalendarClient(calId);
      const row = await link(fake, calId);
      await fake.insertEvent(calId, {
        summary: 'Must not leak in',
        start: { dateTime: '2026-07-08T09:00:00Z' },
        end: { dateTime: '2026-07-08T09:30:00Z' },
      });
      const clientFor = clientForFake(fake);

      // Wrong token.
      let result = await googleApi.handleWebhook(
        webhookHeaders(row, { 'x-goog-channel-token': 'forged-token' }),
        clientFor
      );
      expect(result).toEqual({ outcome: 'ignored', reason: 'token_mismatch' });

      // Missing token header (we always set one at watch time).
      const noToken = webhookHeaders(row);
      delete noToken['x-goog-channel-token'];
      result = await googleApi.handleWebhook(noToken, clientFor);
      expect(result).toEqual({ outcome: 'ignored', reason: 'token_mismatch' });

      // Unknown channel id.
      result = await googleApi.handleWebhook(
        webhookHeaders(row, { 'x-goog-channel-id': 'no-such-channel' }),
        clientFor
      );
      expect(result).toEqual({ outcome: 'ignored', reason: 'unknown_channel' });

      // Stale resource id (channel replaced since).
      result = await googleApi.handleWebhook(
        webhookHeaders(row, { 'x-goog-resource-id': 'stale-resource' }),
        clientFor
      );
      expect(result).toEqual({
        outcome: 'ignored',
        reason: 'resource_mismatch',
      });

      // Expired channel.
      await repo.setLinkChannel(row.id, {
        channelId: row.channelId!,
        channelResourceId: row.channelResourceId!,
        channelExpiration: new Date(Date.now() - 60_000),
        channelToken: row.channelToken!,
      });
      result = await googleApi.handleWebhook(webhookHeaders(row), clientFor);
      expect(result).toEqual({ outcome: 'ignored', reason: 'channel_expired' });

      // None of the rejected notifications pulled anything.
      expect(await eventTitles()).not.toContain('Must not leak in');
    });

    it('renewal replaces a soon-expiring channel and leaves a fresh one', async () => {
      const calId = uniqueCalId();
      const fake = new FakeGoogleCalendarClient(calId);
      const row = await link(fake, calId);
      const old = {
        channelId: row.channelId!,
        channelResourceId: row.channelResourceId!,
        channelToken: row.channelToken!,
      };

      // Age the channel into the 48h renewal window (24h left).
      await repo.setLinkChannel(row.id, {
        ...old,
        channelExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const stats = await googleApi.renewChannels(
        { drainOps: false },
        clientForFake(fake)
      );
      expect(stats.address).toBe(WEBHOOK_URL);
      expect(stats).toMatchObject({
        due: 1,
        renewed: 1,
        created: 0,
        failed: 0,
      });

      const renewed = (await repo.getLinkByGoogleCalendarId(userId, calId))!;
      expect(renewed.channelId).not.toBe(old.channelId);
      expect(renewed.channelToken).not.toBe(old.channelToken);
      expect(renewed.channelResourceId).toBe(
        `fake-resource-${renewed.channelId}`
      );
      // Fresh 7-day expiration: outside the renewal window again.
      expect(channels.channelNeedsRenewal(renewed)).toBe(false);
      // Old channel was stopped AFTER the new one was live (no gap).
      expect(fake.stoppedChannels).toContainEqual({
        id: old.channelId,
        resourceId: old.channelResourceId,
      });
      expect(fake.watchedChannels).toHaveLength(2);

      // The old channel's credentials no longer authenticate a webhook.
      const staleResult = await googleApi.handleWebhook(
        webhookHeaders({ ...renewed, ...old } as CalendarLinkRow),
        clientForFake(fake)
      );
      expect(staleResult.outcome).toBe('ignored');

      // A second sweep finds nothing to do.
      const again = await googleApi.renewChannels(
        { drainOps: false },
        clientForFake(fake)
      );
      expect(again).toMatchObject({ due: 0, renewed: 0, created: 0 });
    });

    it('KILL THE CHANNEL: the 15-min reconciliation path still converges and heals the watch', async () => {
      const calId = uniqueCalId();
      const fake = new FakeGoogleCalendarClient(calId);
      const keep = await fake.insertEvent(calId, {
        summary: 'Keep and edit',
        start: { dateTime: '2026-07-06T09:00:00Z' },
        end: { dateTime: '2026-07-06T09:30:00Z' },
      });
      const doomed = await fake.insertEvent(calId, {
        summary: 'Delete me',
        start: { dateTime: '2026-07-06T10:00:00Z' },
        end: { dateTime: '2026-07-06T10:30:00Z' },
      });
      const row = await link(fake, calId);
      expect(await eventTitles()).toEqual(['Delete me', 'Keep and edit']);
      const deadHeaders = webhookHeaders(row);

      // Kill the channel (Google-side expiry/deletion): its stored state is
      // gone and its pings no longer authenticate.
      await repo.setLinkChannel(row.id, null);
      const deadPing = await googleApi.handleWebhook(
        deadHeaders,
        clientForFake(fake)
      );
      expect(deadPing).toEqual({
        outcome: 'ignored',
        reason: 'unknown_channel',
      });

      // Google keeps changing while push is dead — no webhooks delivered.
      await fake.patchEvent(calId, keep.id, { summary: 'Keep and edited' });
      await fake.deleteEvent(calId, doomed.id);
      await fake.insertEvent(calId, {
        summary: 'Born while push was dead',
        start: { dateTime: '2026-07-09T09:00:00Z' },
        end: { dateTime: '2026-07-09T09:30:00Z' },
      });

      // The 15-min reconciliation cron (POST /api/google/sync, cron mode).
      const result = await googleApi.syncAllUsers(45_000, clientForFake(fake));
      expect(result.usersSynced).toBe(1);
      expect(result.usersFailed).toBe(0);

      // Converged: edit applied, delete applied, new event imported.
      expect(await eventTitles()).toEqual([
        'Born while push was dead',
        'Keep and edited',
      ]);

      // And the reconciliation's renewal sweep re-established the channel.
      expect(result.channels).toMatchObject({ due: 1, created: 1, failed: 0 });
      const healed = (await repo.getLinkByGoogleCalendarId(userId, calId))!;
      expect(healed.channelId).toBeTruthy();
      expect(healed.channelId).not.toBe(row.channelId);
      expect(channels.channelNeedsRenewal(healed)).toBe(false);

      // The healed channel's pings authenticate and sync again.
      const revived = await googleApi.handleWebhook(
        webhookHeaders(healed),
        clientForFake(fake)
      );
      expect(revived.outcome).toBe('synced');
    });

    it('disconnect stops every live channel and clears the rows', async () => {
      const calA = uniqueCalId('a');
      const calB = uniqueCalId('b');
      const fake = new FakeGoogleCalendarClient(calA);
      fake.addCalendar({ id: calB, summary: 'Second calendar' });
      const linkA = await link(fake, calA);
      const linkB = await link(fake, calB);

      await googleApi.disconnect(userId, false, clientForFake(fake));

      expect(fake.stoppedChannels).toContainEqual({
        id: linkA.channelId!,
        resourceId: linkA.channelResourceId!,
      });
      expect(fake.stoppedChannels).toContainEqual({
        id: linkB.channelId!,
        resourceId: linkB.channelResourceId!,
      });
      expect(await repo.getLinksForUser(userId)).toHaveLength(0);
      expect(await repo.getAccount(userId)).toBeNull();
    });
  }
);
