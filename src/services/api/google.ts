/**
 * Google Calendar sync API client (M1, issue #27).
 * Talks to the /api/google/* serverless function (or its dev-server mirror).
 */
import { useAuthStore } from '@/stores/authStore';
import { googleRedirectUri } from '@/lib/urls';

// Re-exported so existing importers (useGoogleSync, IntegrationsSettings)
// keep a single source of truth for the /app-aware redirect URI.
export { googleRedirectUri };

export interface GoogleLinkStatus {
  id: string;
  googleCalendarId: string;
  appCalendarId: string;
  appCalendarName: string | null;
  syncEnabled: boolean;
  hasSyncToken: boolean;
  lastFullSyncAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface GoogleSyncStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  needsReauth: boolean;
  syncEnabled: boolean;
  connectedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  links: GoogleLinkStatus[];
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  linked: boolean;
  appCalendarId: string | null;
}

export interface GoogleSyncStats {
  mode: 'full' | 'incremental';
  inserted: number;
  updated: number;
  deleted: number;
  exceptionsApplied: number;
  skipped: number;
  pages: number;
}

/** Outbox drain totals for a sync cycle (M2 outbound push). */
export interface GoogleOutboundStats {
  due: number;
  succeeded: number;
  conflicts: number;
  dropped: number;
  retried: number;
}

export interface GoogleUserSyncResult {
  userId: string;
  links: Array<{
    linkId: string;
    googleCalendarId: string;
    stats?: GoogleSyncStats;
    error?: string;
  }>;
  /** Outbound (local -> Google) push totals for the cycle. */
  outbound?: GoogleOutboundStats;
  /** Set when the outbox drain failed to push local changes to Google. */
  outboundError?: string;
}

const apiBase = '/api/google';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    // Ensure a fresh JWT before every request. The access token lives ~15
    // minutes and nothing refreshes it mid-session, so without this the client
    // silently drops the Authorization header once it expires and the server
    // rejects the call with "Missing or invalid authorization header".
    await useAuthStore.getState().refreshTokenIfNeeded();
    const token = useAuthStore.getState().getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(init.headers ?? {}),
    },
  });
  let body: {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  } = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON error body
  }
  if (!res.ok || !body.success) {
    const error = new Error(
      body.error?.message || `Request failed (${res.status})`
    ) as Error & { code?: string };
    error.code = body.error?.code;
    throw error;
  }
  return body.data as T;
}

export const googleSyncApi = {
  getStatus: () => request<GoogleSyncStatus>('/status'),

  getConnectUrl: () =>
    request<{ authUrl: string; redirectUri: string }>(
      `/connect?redirectUri=${encodeURIComponent(googleRedirectUri())}`
    ),

  connect: (code: string, redirectUri: string) =>
    request<GoogleSyncStatus>('/connect', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri }),
    }),

  listCalendars: () => request<GoogleCalendarEntry[]>('/calendars'),

  linkCalendar: (googleCalendarId: string) =>
    request<{ status: GoogleSyncStatus; stats: GoogleSyncStats }>('/link', {
      method: 'POST',
      body: JSON.stringify({ googleCalendarId }),
    }),

  syncNow: () =>
    request<GoogleUserSyncResult>('/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  disconnect: (removeImportedEvents: boolean) =>
    request<{ removedEvents: number; unmappedEvents: number }>('/disconnect', {
      method: 'POST',
      body: JSON.stringify({ removeImportedEvents }),
    }),
};
