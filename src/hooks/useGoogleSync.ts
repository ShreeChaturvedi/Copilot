/**
 * React Query hooks for Google Calendar sync (Settings Integrations panel).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toUserMessage } from '@/utils/errorMessages';
import {
  googleSyncApi,
  googleRedirectUri,
  type GoogleSyncStatus,
} from '@/services/api/google';
import { eventQueryKeys } from './useEvents';
import { calendarQueryKeys } from './useCalendars';

export const googleSyncQueryKeys = {
  all: ['googleSync'] as const,
  status: () => [...googleSyncQueryKeys.all, 'status'] as const,
  calendars: () => [...googleSyncQueryKeys.all, 'calendars'] as const,
};

export function useGoogleSyncStatus() {
  return useQuery({
    queryKey: googleSyncQueryKeys.status(),
    queryFn: googleSyncApi.getStatus,
    staleTime: 30_000,
  });
}

export function useGoogleCalendars(enabled: boolean) {
  return useQuery({
    queryKey: googleSyncQueryKeys.calendars(),
    queryFn: googleSyncApi.listCalendars,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Kick off the consent round trip (full-page redirect to Google). */
export function useStartGoogleConnect() {
  return useMutation({
    mutationFn: googleSyncApi.getConnectUrl,
    onSuccess: ({ authUrl }) => {
      window.location.assign(authUrl);
    },
    onError: (error: Error) => {
      toast.error(
        toUserMessage(error, 'Could not start the Google connection')
      );
    },
  });
}

/** Exchange the consent code (used by the OAuth callback page). */
export function useCompleteGoogleConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code }: { code: string }) =>
      googleSyncApi.connect(code, googleRedirectUri()),
    onSuccess: (status: GoogleSyncStatus) => {
      queryClient.setQueryData(googleSyncQueryKeys.status(), status);
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
    },
  });
}

export function useLinkGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (googleCalendarId: string) =>
      googleSyncApi.linkCalendar(googleCalendarId),
    onSuccess: ({ stats }) => {
      const total = stats.inserted + stats.updated + stats.deleted;
      if (stats.inserted > 0) {
        toast.success(
          `Imported ${stats.inserted} event${stats.inserted === 1 ? '' : 's'} from Google Calendar`
        );
      } else if (total > 0) {
        toast.success(
          `Calendar synced (${total} change${total === 1 ? '' : 's'})`
        );
      } else {
        toast.success('Calendar linked — already up to date.');
      }
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(toUserMessage(error, 'Import from Google Calendar failed'));
    },
  });
}

export function useGoogleSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: googleSyncApi.syncNow,
    onSuccess: (result) => {
      const failed = result.links.filter((l) => l.error);
      // Ops left in the outbox with a backoff never reached Google this cycle.
      const stuck = result.outbound?.retried ?? 0;
      if (result.outboundError) {
        toast.error(
          `Some changes couldn't reach Google: ${toUserMessage(result.outboundError, 'push failed')}`
        );
      } else if (failed.length > 0) {
        toast.error(
          `Sync finished with errors: ${toUserMessage(failed[0].error, 'some events failed')}`
        );
      } else if (stuck > 0) {
        toast.error(
          `${stuck} change${stuck === 1 ? '' : 's'} couldn't reach Google — retrying shortly.`
        );
      } else {
        const inbound = result.links.reduce(
          (n, l) =>
            n +
            (l.stats
              ? l.stats.inserted + l.stats.updated + l.stats.deleted
              : 0),
          0
        );
        const changed = inbound + (result.outbound?.succeeded ?? 0);
        toast.success(
          changed > 0
            ? `Synced ${changed} change${changed === 1 ? '' : 's'} with Google`
            : 'Already up to date with Google'
        );
      }
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(toUserMessage(error, 'Google sync failed'));
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
    },
  });
}

export function useGoogleDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (removeImportedEvents: boolean) =>
      googleSyncApi.disconnect(removeImportedEvents),
    onSuccess: () => {
      toast.success('Google Calendar disconnected');
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(toUserMessage(error, 'Disconnect failed'));
    },
  });
}
