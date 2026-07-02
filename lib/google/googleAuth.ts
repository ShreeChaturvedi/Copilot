/**
 * OAuth plumbing for the Google Calendar connect flow (plan §6).
 *
 * Separate from the login OAuth flow (which stays openid/email/profile): the
 * calendar connect is an incremental-auth dance requesting
 * `calendar.events` plus openid/email (the id_token identifies the Google
 * account and gives us the primary-calendar id fallback).
 *
 * Redirect-URI footgun fix: callers pass the redirectUri they actually used
 * for the consent screen; we validate it against an allowlist and pass it to
 * the token exchange. Env GOOGLE_REDIRECT_URI stays the default.
 */
import { OAuth2Client } from 'google-auth-library';

export const CALENDAR_CONNECT_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

/** state value the frontend callback branches on (login vs calendar connect). */
export const CALENDAR_CONNECT_STATE = 'calendar_connect';

export class RedirectUriNotAllowedError extends Error {
  constructor(uri: string) {
    super(`Redirect URI not in allowlist: ${uri}`);
    this.name = 'RedirectUriNotAllowedError';
  }
}

export function isGoogleSyncConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_TOKEN_ENC_KEY
  );
}

/**
 * Allowed OAuth redirect URIs: env default, an optional comma-separated
 * GOOGLE_REDIRECT_ALLOWLIST, and the registered localhost URIs outside
 * production.
 */
export function redirectUriAllowlist(): string[] {
  const allow = new Set<string>();
  if (process.env.GOOGLE_REDIRECT_URI) {
    allow.add(process.env.GOOGLE_REDIRECT_URI);
  }
  for (const uri of (process.env.GOOGLE_REDIRECT_ALLOWLIST ?? '').split(',')) {
    if (uri.trim()) allow.add(uri.trim());
  }
  if (process.env.NODE_ENV !== 'production') {
    // SPA now lives under /app; keep the pre-rebase URIs allowed during the
    // transition so an in-flight consent round trip still validates.
    allow.add('http://localhost:5180/app/auth/google/callback');
    allow.add('http://localhost:5173/app/auth/google/callback');
    allow.add('http://localhost:5180/auth/google/callback');
    allow.add('http://localhost:5173/auth/google/callback');
  }
  return [...allow];
}

/** Validate a caller-supplied redirectUri; fall back to the env default. */
export function resolveRedirectUri(requested?: string): string {
  const allowlist = redirectUriAllowlist();
  if (!requested) {
    const fallback = process.env.GOOGLE_REDIRECT_URI ?? allowlist[0];
    if (!fallback) {
      throw new RedirectUriNotAllowedError('(none configured)');
    }
    return fallback;
  }
  if (!allowlist.includes(requested)) {
    throw new RedirectUriNotAllowedError(requested);
  }
  return requested;
}

/** Consent URL for the calendar connect flow (incremental auth). */
export function buildConnectAuthUrl(redirectUri: string): string {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  return client.generateAuthUrl({
    scope: CALENDAR_CONNECT_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    state: CALENDAR_CONNECT_STATE,
  });
}

export interface ConnectExchangeResult {
  refreshToken: string;
  scopes: string;
  googleUserId: string;
  email: string | null;
  /** Short-lived; handy for the immediate post-connect calls. */
  accessToken: string | null;
}

/**
 * Exchange the consent code. The id_token comes straight from Google over
 * TLS so decoding its payload without signature verification is fine here.
 */
export async function exchangeConnectCode(
  code: string,
  redirectUri: string
): Promise<ConnectExchangeResult> {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.refresh_token) {
    // prompt=consent should always yield one; treat absence as a hard error
    // rather than silently storing a connection that cannot sync.
    throw new Error('GOOGLE_NO_REFRESH_TOKEN');
  }
  const grantedScopes = tokens.scope ?? '';
  if (
    !grantedScopes.includes('https://www.googleapis.com/auth/calendar.events')
  ) {
    throw new Error('GOOGLE_CALENDAR_SCOPE_NOT_GRANTED');
  }

  let googleUserId = '';
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8')
      ) as { sub?: string; email?: string };
      googleUserId = payload.sub ?? '';
      email = payload.email ?? null;
    } catch {
      // fall through; googleUserId stays empty
    }
  }

  return {
    refreshToken: tokens.refresh_token,
    scopes: grantedScopes,
    googleUserId,
    email,
    accessToken: tokens.access_token ?? null,
  };
}

/**
 * Access-token provider backed by a refresh token. Throws the raw
 * google-auth-library error on failure; callers map invalid_grant to
 * needsReauth (see GoogleSyncService).
 */
export function accessTokenProviderFor(
  refreshToken: string
): () => Promise<string> {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: refreshToken });
  return async () => {
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('GOOGLE_ACCESS_TOKEN_UNAVAILABLE');
    return token;
  };
}

/** True when an auth error means the grant itself is dead (needs reconnect). */
export function isInvalidGrantError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /invalid_grant|invalid_rapt|unauthorized_client/i.test(message);
}

/** Best-effort revocation on disconnect; failures are non-fatal. */
export async function revokeGoogleToken(refreshToken: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    });
  } catch (error) {
    console.warn('Google token revocation failed (non-fatal):', error);
  }
}
