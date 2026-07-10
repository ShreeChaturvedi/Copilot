/**
 * Inbound sync engine: Google -> Taskflow (plan §3). M1 scope: initial full
 * import and incremental pull. All inbound paths (manual "Sync now", the
 * 15-min reconciliation cron, and the M3 webhook) converge on syncCalendar().
 *
 * Invariants:
 *  - events.list always uses singleEvents=false (masters keep recurrence[]).
 *  - Full sync: timeMin = now - 1y, identical across pages; incremental
 *    requests send only syncToken (+ singleEvents/maxResults) — Google
 *    forbids timeMin with syncToken.
 *  - nextSyncToken appears only on the last page and is persisted only after
 *    every page committed. Pages are processed transactionally per page.
 *  - 410 GONE: clear the stored token and run a full import; the "wipe" is
 *    logical — re-upsert by googleEventId plus a deletion sweep of mapped
 *    rows missing from the fresh feed.
 *  - Recurring-instance shells (recurringEventId set) are buffered and
 *    processed after all pages so their masters exist locally first.
 *  - Echo suppression: items whose etag equals the stored events.googleEtag
 *    are our own writes coming back -> skipped (the outbox drain records the
 *    response etag after every successful outbound write).
 *
 * M2 conflict handling (plan §5):
 *  - Changed item + existing mapped row -> per-field three-way merge against
 *    googleSyncSnapshot; app-winning fields re-enqueue ONE outbound patch
 *    with If-Match of the newly stored etag. Pending upsert ops for the row
 *    are replaced by that patch (their payload/etag predate the merge).
 *  - Edit-vs-delete by timestamps, tombstone-aware:
 *      Google cancelled + app edited since last sync: app updatedAt newer ->
 *      re-insert to Google as a NEW event (cancelled ids are not revivable);
 *      else delete the app row.
 *      App deleted (tombstone) + Google edited: Google `updated` newer than
 *      deletedAt -> resurrect locally (tombstone + pending delete dropped);
 *      else re-enqueue the outbound delete with the fresh etag.
 *      Both deleted -> clear tombstone + pending delete op.
 */
import type { PoolClient } from 'pg';
import type { GoogleCalendarClient } from './GoogleCalendarClient.js';
import { SyncTokenGoneError, type GCalEvent } from './types.js';
import {
  appEventToGoogle,
  googleEventToApp,
  originalStartToIso,
  MappingError,
  type AppEventFields,
} from './mapping.js';
import {
  appFieldsToSynced,
  instanceExceptionsOf,
  normalizeSnapshot,
  syncedFieldsEqual,
  syncedToAppFields,
  threeWayMergeEvent,
} from './merge.js';
import * as repo from './syncRepo.js';
import type { CalendarLinkRow, MappedEventRow } from './syncRepo.js';

export interface SyncStats {
  mode: 'full' | 'incremental';
  inserted: number;
  updated: number;
  deleted: number;
  exceptionsApplied: number;
  skipped: number;
  /** Rows that went through the three-way merge (subset of updated). */
  merged: number;
  pages: number;
}

const MAX_RESULTS = 2500;
const FULL_SYNC_WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // 1 year back

function newStats(mode: SyncStats['mode']): SyncStats {
  return {
    mode,
    inserted: 0,
    updated: 0,
    deleted: 0,
    exceptionsApplied: 0,
    skipped: 0,
    merged: 0,
    pages: 0,
  };
}

/** Current synced-field values of a local row, shaped for the merge. */
function rowToAppFields(row: MappedEventRow): AppEventFields {
  return {
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    start: row.start,
    end: row.end,
    allDay: row.allDay,
    recurrence: row.recurrence ?? null,
    exceptions: row.exceptions ?? [],
  };
}

export class GoogleSyncService {
  /**
   * Sync one linked calendar: incremental when a syncToken is stored, full
   * import otherwise. On success updates the link's sync state; on failure
   * records lastError on the link and rethrows for the caller's error
   * mapping (needsReauth etc.).
   */
  async syncCalendar(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    try {
      const stats = link.syncToken
        ? await this.incrementalSync(client, link)
        : await this.fullImport(client, link);
      await repo.updateLinkSyncState(link.id, {
        lastSyncedAt: new Date(),
        lastError: null,
      });
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await repo
        .updateLinkSyncState(link.id, { lastError: message })
        .catch(() => {});
      throw error;
    }
  }

  /**
   * Initial full import (and post-410 resync). Pages the window, upserts
   * masters/one-offs per page, folds instance shells at the end, sweeps
   * mapped rows missing from the feed, then persists the fresh syncToken.
   */
  async fullImport(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    const stats = newStats('full');
    const windowStart = new Date(Date.now() - FULL_SYNC_WINDOW_MS);
    const instanceItems: GCalEvent[] = [];
    const seenIds: string[] = [];
    let pageToken: string | undefined;
    let syncToken: string | undefined;

    do {
      const page = await client.listEvents(link.googleCalendarId, {
        singleEvents: false,
        maxResults: MAX_RESULTS,
        timeMin: windowStart.toISOString(),
        pageToken,
      });
      stats.pages++;
      const items = page.items ?? [];
      seenIds.push(...items.map((e) => e.id));

      // Masters/one-offs now; instance shells after all pages (their master
      // may be on a later page).
      const masters = items.filter((e) => !e.recurringEventId);
      instanceItems.push(...items.filter((e) => !!e.recurringEventId));

      await repo.withTransaction(async (tx) => {
        for (const item of masters) {
          await this.processMasterItem(tx, link, item, stats);
        }
      });

      pageToken = page.nextPageToken;
      if (!pageToken) syncToken = page.nextSyncToken;
    } while (pageToken);

    await repo.withTransaction(async (tx) => {
      for (const item of instanceItems) {
        await this.processInstanceItem(tx, link, item, stats);
      }
      stats.deleted += await repo.deleteMappedEventsNotSeen(
        tx,
        link.userId,
        link.googleCalendarId,
        seenIds,
        windowStart
      );
    });

    const now = new Date();
    await repo.updateLinkSyncState(link.id, {
      syncToken: syncToken ?? null,
      lastFullSyncAt: now,
      lastSyncedAt: now,
      lastError: null,
    });
    return stats;
  }

  /**
   * Incremental pull with the stored syncToken. 410 -> clear token, full
   * import. The new token is persisted only after every page committed.
   */
  async incrementalSync(
    client: GoogleCalendarClient,
    link: CalendarLinkRow
  ): Promise<SyncStats> {
    if (!link.syncToken) return this.fullImport(client, link);

    const stats = newStats('incremental');
    const instanceItems: GCalEvent[] = [];
    let pageToken: string | undefined;
    const syncToken: string | undefined = link.syncToken;
    let nextSyncToken: string | undefined;

    try {
      do {
        const page = await client.listEvents(link.googleCalendarId, {
          singleEvents: false,
          maxResults: MAX_RESULTS,
          syncToken,
          pageToken,
        });
        stats.pages++;
        const items = page.items ?? [];
        const masters = items.filter((e) => !e.recurringEventId);
        instanceItems.push(...items.filter((e) => !!e.recurringEventId));

        await repo.withTransaction(async (tx) => {
          for (const item of masters) {
            await this.processMasterItem(tx, link, item, stats);
          }
        });

        pageToken = page.nextPageToken;
        if (!pageToken) nextSyncToken = page.nextSyncToken;
      } while (pageToken);
    } catch (error) {
      if (error instanceof SyncTokenGoneError) {
        // Stale token: clear storage and full-resync (events.list reference).
        await repo.updateLinkSyncState(link.id, { syncToken: null });
        return this.fullImport(client, { ...link, syncToken: null });
      }
      throw error;
    }

    await repo.withTransaction(async (tx) => {
      for (const item of instanceItems) {
        await this.processInstanceItem(tx, link, item, stats);
      }
    });

    await repo.updateLinkSyncState(link.id, {
      syncToken: nextSyncToken ?? link.syncToken,
      lastSyncedAt: new Date(),
      lastError: null,
    });
    return stats;
  }

  /** Handle a master/one-off item (no recurringEventId). */
  private async processMasterItem(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    if (item.status === 'cancelled') {
      return this.applyInboundCancellation(tx, link, item, stats);
    }
    return this.applyInboundItem(tx, link, item, stats);
  }

  /**
   * Apply one active inbound item: tombstone-aware edit-vs-delete first, then
   * echo suppression, then plain insert or three-way merge (plan §5).
   */
  private async applyInboundItem(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    // App deleted this event locally? The tombstone decides edit-vs-delete.
    const tomb = await repo.getTombstone(link.userId, item.id, tx);
    if (tomb) {
      const googleUpdated = item.updated ? new Date(item.updated) : null;
      if (googleUpdated && googleUpdated.getTime() > tomb.deletedAt.getTime()) {
        // Google edited AFTER our delete -> Google wins: resurrect locally.
        await repo.deleteTombstone(tx, link.userId, item.id);
        await repo.deletePendingDeleteOps(tx, link.userId, item.id);
        // fall through: no local row exists, so this upserts a fresh one
      } else {
        // Our delete is newer -> app wins: refresh the outbound delete so
        // its If-Match matches Google's current etag, and keep the tombstone
        // until that delete succeeds.
        await repo.enqueueDeleteOp(tx, {
          userId: link.userId,
          googleCalendarId: link.googleCalendarId,
          googleEventId: item.id,
          ifMatchEtag: item.etag,
        });
        stats.skipped++;
        return;
      }
    }

    // Echo suppression: our own outbound write coming back.
    const existing = await repo.getEventByGoogleId(link.userId, item.id, tx);
    if (existing && existing.googleEtag === item.etag) {
      stats.skipped++;
      return;
    }

    let fields;
    try {
      fields = googleEventToApp(item);
    } catch (error) {
      if (error instanceof MappingError) {
        console.warn(
          `Skipping unmappable Google event ${item.id}:`,
          error.message
        );
        stats.skipped++;
        return;
      }
      throw error;
    }

    const googleUpdatedAt = item.updated ? new Date(item.updated) : null;

    if (!existing) {
      const result = await repo.upsertEventFromGoogle(tx, {
        userId: link.userId,
        appCalendarId: link.appCalendarId,
        googleCalendarId: link.googleCalendarId,
        googleEventId: item.id,
        etag: item.etag,
        googleUpdatedAt,
        fields,
      });
      if (result === 'inserted') stats.inserted++;
      else stats.updated++;
      return;
    }

    // Existing mapped row with a real inbound change: three-way merge.
    // Instance-derived exclusions are invisible in Google's recurrence[]
    // (they are override/cancelled instances there), so they are stripped
    // from the app side of the merge and re-attached afterwards.
    const base = normalizeSnapshot(existing.googleSyncSnapshot);
    const instanceExceptions = instanceExceptionsOf(
      existing.googleSyncSnapshot
    );
    const appFields = rowToAppFields(existing);
    appFields.exceptions = appFields.exceptions.filter(
      (e) => !instanceExceptions.includes(e)
    );
    const merge = threeWayMergeEvent(
      base,
      appFieldsToSynced(appFields),
      appFieldsToSynced(fields),
      existing.updatedAt,
      googleUpdatedAt
    );
    await repo.applyMergedEvent(tx, {
      eventId: existing.id,
      fields: syncedToAppFields(merge.merged),
      etag: item.etag,
      googleUpdatedAt,
      instanceExceptions,
    });
    // Pending upsert ops for this row predate the merge (stale payload and a
    // stale If-Match): replace them with one fresh patch when the app side
    // still has something to say.
    await repo.deletePendingUpsertOps(tx, link.userId, existing.id);
    if (merge.needsOutbound) {
      const timezone = await repo.getUserTimezone(link.userId);
      await repo.enqueuePatchOp(tx, {
        userId: link.userId,
        eventId: existing.id,
        googleCalendarId: link.googleCalendarId,
        googleEventId: item.id,
        payload: appEventToGoogle(
          syncedToAppFields(merge.merged),
          timezone
        ) as unknown as Record<string, unknown>,
        ifMatchEtag: item.etag,
      });
    }
    stats.updated++;
    stats.merged++;
  }

  /**
   * Inbound cancellation (status='cancelled'): edit-vs-delete rules (plan §5).
   */
  private async applyInboundCancellation(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    // Both sides deleted: clear the bookkeeping and drop the outbound delete.
    const tomb = await repo.getTombstone(link.userId, item.id, tx);
    if (tomb) {
      await repo.deleteTombstone(tx, link.userId, item.id);
      await repo.deletePendingDeleteOps(tx, link.userId, item.id);
    }

    const existing = await repo.getEventByGoogleId(link.userId, item.id, tx);
    if (!existing) return;

    // Was the app row edited since the last successful sync? (Instance-
    // derived exclusions are part of the synced base, not app edits.)
    const base = normalizeSnapshot(existing.googleSyncSnapshot);
    const instanceExceptions = instanceExceptionsOf(
      existing.googleSyncSnapshot
    );
    const appFields = rowToAppFields(existing);
    appFields.exceptions = appFields.exceptions.filter(
      (e) => !instanceExceptions.includes(e)
    );
    const googleUpdated = item.updated ? new Date(item.updated) : null;
    // With a base snapshot, compare fields. WITHOUT one (an app-origin row
    // whose first outbound insert hasn't completed, or a legacy row) we cannot
    // prove the row is unchanged, so fall back to timestamps like the merge
    // path does — a locally-newer edit survives via the re-insert-as-new
    // branch below instead of being silently deleted.
    const appChanged = base
      ? !syncedFieldsEqual(appFieldsToSynced(appFields), base)
      : existing.updatedAt.getTime() > (googleUpdated?.getTime() ?? 0);

    if (
      appChanged &&
      (!googleUpdated || existing.updatedAt.getTime() > googleUpdated.getTime())
    ) {
      // The app's edit outlived Google's cancellation -> app wins: re-insert
      // to Google as a NEW event (cancelled ids are not reliably revivable).
      const timezone = await repo.getUserTimezone(link.userId);
      await repo.clearEventMapping(tx, existing.id);
      await repo.deletePendingUpsertOps(tx, link.userId, existing.id);
      await repo.enqueueInsertOp(tx, {
        userId: link.userId,
        eventId: existing.id,
        googleCalendarId: link.googleCalendarId,
        payload: appEventToGoogle(
          rowToAppFields(existing),
          timezone
        ) as unknown as Record<string, unknown>,
      });
      stats.updated++;
      return;
    }

    await repo.deletePendingUpsertOps(tx, link.userId, existing.id);
    stats.deleted += await repo.deleteEventByGoogleId(tx, link.userId, item.id);
  }

  /**
   * Handle a recurring-instance shell (recurringEventId set): map to the
   * app's native pattern — the master gets the original occurrence start in
   * exceptions[]; a modified instance additionally becomes a standalone app
   * event mapped to the instance's own Google id (plan §3).
   */
  private async processInstanceItem(
    tx: PoolClient,
    link: CalendarLinkRow,
    item: GCalEvent,
    stats: SyncStats
  ): Promise<void> {
    const masterGoogleId = item.recurringEventId!;
    let originalIso: string | null = null;
    if (item.originalStartTime) {
      try {
        originalIso = originalStartToIso(item.originalStartTime);
      } catch {
        originalIso = null;
      }
    }

    if (originalIso) {
      const added = await repo.addExceptionToMaster(
        tx,
        link.userId,
        masterGoogleId,
        originalIso
      );
      if (added) stats.exceptionsApplied++;
    }

    if (item.status === 'cancelled') {
      // Cancelled instance: the exception on the master is the main story;
      // a previously-imported standalone row for this instance goes through
      // the same edit-vs-delete rules as any other cancellation.
      return this.applyInboundCancellation(tx, link, item, stats);
    }

    return this.applyInboundItem(tx, link, item, stats);
  }
}

export const googleSyncService = new GoogleSyncService();
