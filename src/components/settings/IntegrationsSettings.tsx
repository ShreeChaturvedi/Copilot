/**
 * Settings > Integrations: Google Calendar connection panel (M1, issue #27).
 * Connect / status / primary-calendar import / Sync now / Disconnect.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertCircle,
  CalendarClock,
  Cloud,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import {
  useGoogleCalendars,
  useGoogleDisconnect,
  useGoogleSyncNow,
  useGoogleSyncStatus,
  useLinkGoogleCalendar,
  useStartGoogleConnect,
} from '@/hooks/useGoogleSync';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function IntegrationsSettings() {
  const { data: status, isLoading } = useGoogleSyncStatus();
  const startConnect = useStartGoogleConnect();
  const canListCalendars = !!status?.connected && !status.needsReauth;
  const calendars = useGoogleCalendars(canListCalendars);
  const linkCalendar = useLinkGoogleCalendar();
  const syncNow = useGoogleSyncNow();
  const disconnect = useGoogleDisconnect();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [removeImported, setRemoveImported] = useState(false);
  // Track which calendar's Import is in flight so a shared mutation flag
  // doesn't spin/disable every row at once.
  const [linkingId, setLinkingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Google Calendar sync is not configured on this server.
        </AlertDescription>
      </Alert>
    );
  }

  if (!status.connected) {
    // The area's one earned craft moment (§2.6): an etched "not yet wired
    // up" motif in place of a plain Card + button, extending "The Etch"
    // (foundation §4) into the one empty state this area actually owns.
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-card border border-dashed border-etch-strong text-ink-muted">
            <CalendarClock className="size-4" />
          </div>
          <div
            className="h-px w-8 border-t border-dashed border-etch-strong"
            aria-hidden="true"
          />
          <div className="grid size-6 place-items-center rounded-full border border-dashed border-etch-strong text-ink-muted">
            <Link2 className="size-3" />
          </div>
          <div
            className="h-px w-8 border-t border-dashed border-etch-strong"
            aria-hidden="true"
          />
          <div className="grid size-10 place-items-center rounded-card border border-dashed border-etch-strong text-ink-muted">
            <Cloud className="size-4" />
          </div>
        </div>

        <p className="mt-4 font-serif text-[0.9375rem] leading-[1.3] text-ink">
          Bring your calendar in.
        </p>
        <p className="mt-1 text-[0.75rem] text-ink-muted max-w-[32ch]">
          Google Calendar syncs in automatically, every 15 minutes.
        </p>

        <Button
          className="mt-4"
          size="sm"
          onClick={() => startConnect.mutate()}
          disabled={startConnect.isPending}
        >
          {startConnect.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Connect Google Calendar
        </Button>
      </div>
    );
  }

  const anyError =
    status.lastError ?? status.links.find((l) => l.lastError)?.lastError;
  const lastSynced = status.links.reduce<string | null>(
    (latest, l) =>
      l.lastSyncedAt && (!latest || l.lastSyncedAt > latest)
        ? l.lastSyncedAt
        : latest,
    null
  );

  return (
    <div className="space-y-4">
      {status.needsReauth && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              The Google connection expired or was revoked. Reconnect to resume
              syncing.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startConnect.mutate()}
              disabled={startConnect.isPending}
            >
              Reconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div>
        {/* Connected-state header — flat, no Card. Foundation §1.6 rule 3's
            named "connected-integration status dot," previously an unclaimed
            neutral Badge (§1.C). */}
        <div className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
          <CalendarClock className="h-5 w-5 text-ink-muted" />
          Google Calendar
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-aqua">
            <span
              className="size-1.5 rounded-full bg-aqua"
              aria-hidden="true"
            />
            Connected
          </span>
        </div>
        <p className="mt-1 text-[0.8125rem] text-ink-muted">
          {status.email ?? 'Google account'} · last synced{' '}
          {formatRelativeTime(lastSynced)}
        </p>

        <div className="mt-4 space-y-4">
          {/* Calendar list: primary first (M1); more calendars in a later milestone */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground">Calendars</Label>
            {calendars.isLoading ? (
              <Skeleton className="h-12 w-full rounded-card" />
            ) : (
              <div className="rounded-card border border-hairline divide-y divide-hairline">
                {calendars.data?.map((cal) => (
                  <div
                    key={cal.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{cal.summary}</span>
                        {cal.primary && (
                          <Badge variant="outline">Primary</Badge>
                        )}
                      </div>
                      {cal.linked && (
                        <p className="text-xs text-ink-muted truncate">
                          Synced to “
                          {status.links.find(
                            (l) => l.googleCalendarId === cal.id
                          )?.appCalendarName ?? 'calendar'}
                          ”
                        </p>
                      )}
                    </div>
                    {cal.linked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-aqua shrink-0">
                        <span
                          className="size-1.5 rounded-full bg-aqua"
                          aria-hidden="true"
                        />
                        Synced
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setLinkingId(cal.id);
                          linkCalendar.mutate(cal.id, {
                            onSettled: () => setLinkingId(null),
                          });
                        }}
                        disabled={linkCalendar.isPending || status.needsReauth}
                        className="shrink-0"
                      >
                        {linkingId === cal.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Import
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {calendars.isError && (
              <p className="text-xs text-destructive">
                Could not load the calendar list.
              </p>
            )}
          </div>

          {anyError && !status.needsReauth && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Last sync issue: {anyError}
              </AlertDescription>
            </Alert>
          )}

          <div className="border-t border-hairline pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => syncNow.mutate()}
                disabled={
                  syncNow.isPending ||
                  status.needsReauth ||
                  status.links.length === 0
                }
              >
                {syncNow.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRemoveImported(false);
                  setDisconnectOpen(true);
                }}
                disabled={disconnect.isPending}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>

            {status.links.length === 0 && !status.needsReauth && (
              <p className="text-xs text-ink-muted">
                Import a calendar above to enable syncing.
              </p>
            )}

            <p className="text-xs text-ink-muted">
              Changes sync both ways. Edits and deletions you make here update
              Google Calendar within 15 minutes (or instantly with Sync now) —
              deleting a synced event here removes it from Google too. Recurring
              events that span daylight-saving changes can differ by an hour
              between the two calendars.
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Syncing stops immediately. Imported events stay in your calendar
              unless you choose to remove them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="remove-imported-events"
              checked={removeImported}
              onCheckedChange={(v) => setRemoveImported(v === true)}
            />
            <Label htmlFor="remove-imported-events" className="text-sm">
              Also remove the events imported from Google
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                disconnect.mutate(removeImported);
                setDisconnectOpen(false);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default IntegrationsSettings;
