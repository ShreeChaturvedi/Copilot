/**
 * React Query hooks for Google Calendar sync (Settings Integrations panel).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
      toast.error(error.message || 'Could not start the Google connection');
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
      toast.success(
        `Imported ${stats.inserted} event${stats.inserted === 1 ? '' : 's'} from Google Calendar`
      );
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Import from Google Calendar failed');
    },
  });
}

export function useGoogleSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: googleSyncApi.syncNow,
    onSuccess: (result) => {
      const failed = result.links.filter((l) => l.error);
      if (failed.length > 0) {
        toast.error(`Sync finished with errors: ${failed[0].error}`);
      } else {
        const changed = result.links.reduce(
          (n, l) =>
            n +
            (l.stats
              ? l.stats.inserted + l.stats.updated + l.stats.deleted
              : 0),
          0
        );
        toast.success(
          changed > 0
            ? `Synced ${changed} change${changed === 1 ? '' : 's'} from Google`
            : 'Already up to date with Google'
        );
      }
      queryClient.invalidateQueries({ queryKey: googleSyncQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Google sync failed');
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
      toast.error(error.message || 'Disconnect failed');
    },
  });
}
