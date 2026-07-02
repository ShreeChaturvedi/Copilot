/**
 * Second catch-all Serverless Function: the /api/google/* namespace.
 *
 * Deliberately a SEPARATE function from api/[...route].ts (see the note
 * there): Google sync brings its own dependency weight and its own traffic
 * profile (cron + webhook), so it gets its own slot instead of bloating the
 * main bundle. Endpoint logic lives in lib/google/googleApi.ts and is shared
 * with the dev-server mirrors.
 *
 * M1 routes (plan §3/§6):
 *   GET  /api/google/status         (JWT)  connection + per-link sync state
 *   GET  /api/google/connect        (JWT)  consent URL (?redirectUri= allowlisted)
 *   POST /api/google/connect        (JWT)  {code, redirectUri} -> store tokens
 *   GET  /api/google/calendars      (JWT)  linkable calendars (primary-first)
 *   POST /api/google/link           (JWT)  {googleCalendarId?} -> link + full import
 *   POST /api/google/sync           (JWT caller-only; Bearer GOOGLE_SYNC_CRON_SECRET
 *                                    runs reconciliation across all users)
 *   POST /api/google/disconnect     (JWT)  {removeImportedEvents?}
 *
 * M3 will add here: POST /api/google/webhook (public, channel-token
 * validated) and GET /api/google/cron/renew (Vercel cron, CRON_SECRET).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import {
  asyncHandler,
  sendError,
  sendSuccess,
} from '../../lib/middleware/errorHandler.js';
import { createApiHandler } from '../../lib/utils/apiHandler.js';
import * as googleApi from '../../lib/google/googleApi.js';

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | Promise<void>;

function requireUser(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  return req.user.id;
}

const statusHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    requireAuth: true,
    handler: async (req, res) => {
      sendSuccess(res, await googleApi.getStatus(requireUser(req)));
    },
  },
});

const connectHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    requireAuth: true,
    handler: async (req, res) => {
      requireUser(req);
      const redirectUri =
        typeof req.query.redirectUri === 'string'
          ? req.query.redirectUri
          : undefined;
      sendSuccess(res, googleApi.getConnectUrl(redirectUri));
    },
  },
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    requireAuth: true,
    handler: async (req, res) => {
      const userId = requireUser(req);
      const { code, redirectUri } = (req.body ?? {}) as {
        code?: string;
        redirectUri?: string;
      };
      sendSuccess(
        res,
        await googleApi.connect(userId, code ?? '', redirectUri)
      );
    },
  },
});

const calendarsHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    requireAuth: true,
    handler: async (req, res) => {
      sendSuccess(res, await googleApi.listCalendars(requireUser(req)));
    },
  },
});

const linkHandler = createApiHandler({
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    requireAuth: true,
    handler: async (req, res) => {
      const userId = requireUser(req);
      const { googleCalendarId } = (req.body ?? {}) as {
        googleCalendarId?: string;
      };
      sendSuccess(
        res,
        await googleApi.linkCalendar(userId, googleCalendarId || 'primary')
      );
    },
  },
});

const disconnectHandler = createApiHandler({
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    requireAuth: true,
    handler: async (req, res) => {
      const userId = requireUser(req);
      const { removeImportedEvents } = (req.body ?? {}) as {
        removeImportedEvents?: boolean;
      };
      sendSuccess(
        res,
        await googleApi.disconnect(userId, !!removeImportedEvents)
      );
    },
  },
});

const jwtSyncHandler = createApiHandler({
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    requireAuth: true,
    handler: async (req, res) => {
      sendSuccess(res, await googleApi.syncUser(requireUser(req)));
    },
  },
});

/**
 * POST /api/google/sync: cron mode (reconciliation across all users) when the
 * bearer matches GOOGLE_SYNC_CRON_SECRET, otherwise JWT mode (caller only).
 */
const syncHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
      return sendError(
        res,
        new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed')
      );
    }
    if (googleApi.isCronRequest(req.headers.authorization)) {
      sendSuccess(res, await googleApi.syncAllUsers());
      return;
    }
    await jwtSyncHandler(req, res);
  }
);

const routes: Record<string, ApiHandler> = {
  status: statusHandler,
  connect: connectHandler,
  calendars: calendarsHandler,
  link: linkHandler,
  sync: syncHandler,
  disconnect: disconnectHandler,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const pathname = new URL(req.url || '', 'http://localhost').pathname;
  const segments = pathname.split('/').filter(Boolean);
  // Accept both /api/google/<route> and /google/<route> (Vercel may strip /api).
  const start = segments[0] === 'api' ? 1 : 0;
  const route = segments[start] === 'google' ? segments[start + 1] : undefined;

  const matched = route ? routes[route] : undefined;
  if (!matched || segments.length > start + 2) {
    sendError(res, new ApiError(404, 'NOT_FOUND', 'Endpoint not found'));
    return;
  }
  await matched(req, res);
}
