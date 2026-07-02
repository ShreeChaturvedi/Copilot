/**
 * Settings > Integrations: Google Calendar connection panel (M1, issue #27).
 * Connect / status / primary-calendar import / Sync now / Disconnect.
 */
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Download,
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
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
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Connect your Google account to import your calendar and keep it in
            sync. Events are pulled automatically every 15 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => startConnect.mutate()}
            disabled={startConnect.isPending}
          >
            {startConnect.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Connect Google Calendar
          </Button>
        </CardContent>
      </Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Google Calendar
            <Badge variant="secondary">Connected</Badge>
          </CardTitle>
          <CardDescription>
            {status.email ?? 'Google account'} · last synced{' '}
            {formatRelativeTime(lastSynced)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calendar list: primary first (M1); more calendars in a later milestone */}
          <div className="space-y-2">
            <Label className="text-sm">Calendars</Label>
            {calendars.isLoading && <Skeleton className="h-12 w-full" />}
            {calendars.data?.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{cal.summary}</span>
                    {cal.primary && <Badge variant="outline">Primary</Badge>}
                  </div>
                  {cal.linked && (
                    <p className="text-xs text-muted-foreground truncate">
                      Synced to “
                      {status.links.find((l) => l.googleCalendarId === cal.id)
                        ?.appCalendarName ?? 'calendar'}
                      ”
                    </p>
                  )}
                </div>
                {cal.linked ? (
                  <Badge variant="secondary">Imported</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => linkCalendar.mutate(cal.id)}
                    disabled={linkCalendar.isPending || status.needsReauth}
                  >
                    {linkCalendar.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Import
                  </Button>
                )}
              </div>
            ))}
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

          <Separator />

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
              onClick={() => setDisconnectOpen(true)}
              disabled={disconnect.isPending}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Changes made in Google appear here within 15 minutes (or instantly
            with Sync now). Editing synced events here does not update Google
            yet. Recurring events that span daylight-saving changes can differ
            by an hour between the two calendars.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Syncing stops immediately. Imported events stay in your calendar
              unless you choose to remove them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-1">
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
