/**
 * Single catch-all Serverless Function for the entire API.
 *
 * Vercel's Hobby plan allows at most 12 Serverless Functions per deployment.
 * The app has ~38 endpoints, so instead of one function per file we ship ONE
 * function here that replays Vercel's own filesystem routing against an explicit
 * table. The real endpoint modules live under `api/_handlers/**`; Vercel does
 * NOT turn underscore-prefixed paths into functions, so they add no slots and
 * are simply imported and dispatched to from here.
 *
 * Routing rules mirror Vercel filesystem routing:
 *   - Static segments win over dynamic `[param]` segments
 *     (e.g. /api/tasks/stats -> tasks/stats.ts, not tasks/[id].ts).
 *   - A dynamic segment is injected into `req.query` under its param name
 *     (e.g. /api/tasks/abc -> tasks/[id].ts with req.query.id === 'abc'),
 *     exactly as the standalone function would have received it.
 *   - Each handler still owns method dispatch (405) and CORS/OPTIONS handling
 *     via the shared middleware, so per-method behavior is unchanged.
 *   - Unknown routes return the app's standard NOT_FOUND error shape.
 *
 * NOTE: The `api/google/*` namespace is intentionally left unused here. Google
 * Calendar sync will later add a SECOND function at `api/google/[...route].ts`
 * (a separate slot) so its heavier dependencies don't bloat this bundle. See
 * issues #25 and #50 for the function-limit context.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError } from '../lib/types/api.js';
import { sendError } from '../lib/middleware/errorHandler.js';

// --- Handler modules (all under api/_handlers/, never built as functions) ---
import health from './_handlers/health.js';
import tasksIndex from './_handlers/tasks/index.js';
import tasksStats from './_handlers/tasks/stats.js';
import tasksBulk from './_handlers/tasks/bulk.js';
import taskById from './_handlers/tasks/[id].js';
import taskListsIndex from './_handlers/task-lists/index.js';
import taskListsStats from './_handlers/task-lists/stats.js';
import taskListById from './_handlers/task-lists/[id].js';
import calendarsIndex from './_handlers/calendars/index.js';
import calendarById from './_handlers/calendars/[id].js';
import eventsIndex from './_handlers/events/index.js';
import eventsConflicts from './_handlers/events/conflicts.js';
import eventById from './_handlers/events/[id].js';
import tagsIndex from './_handlers/tags/index.js';
import tagsStats from './_handlers/tags/stats.js';
import tagsMerge from './_handlers/tags/merge.js';
import tagsCleanup from './_handlers/tags/cleanup.js';
import tagById from './_handlers/tags/[id].js';
import attachmentsIndex from './_handlers/attachments/index.js';
import attachmentsStats from './_handlers/attachments/stats.js';
import attachmentsCleanup from './_handlers/attachments/cleanup.js';
import attachmentById from './_handlers/attachments/[id].js';
import authRegister from './_handlers/auth/register.js';
import authLogin from './_handlers/auth/login.js';
import authLogout from './_handlers/auth/logout.js';
import authRefresh from './_handlers/auth/refresh.js';
import authMe from './_handlers/auth/me.js';
import authForgotPassword from './_handlers/auth/forgot-password.js';
import authResetPassword from './_handlers/auth/reset-password.js';
import authChangePassword from './_handlers/auth/change-password.js';
import authGoogle from './_handlers/auth/google/index.js';
import authGoogleCallback from './_handlers/auth/google/callback.js';
import authGoogleVerify from './_handlers/auth/google/verify.js';
import uploadIndex from './_handlers/upload/index.js';
import userIndex from './_handlers/user/index.js';
import userProfile from './_handlers/user/profile.js';
import userPreferences from './_handlers/user/preferences.js';
import userExport from './_handlers/user/export.js';

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | Promise<void>;

interface Route {
  /** Path segments after `/api/`. A `:name` segment matches any value and is
   *  injected into req.query under `name` (mirrors an `[name].ts` file). */
  segments: string[];
  handler: ApiHandler;
}

// Order is irrelevant: matching always prefers an exact static route over a
// dynamic one of the same length (see matchRoute).
const routes: Route[] = [
  { segments: ['health'], handler: health },

  { segments: ['tasks'], handler: tasksIndex },
  { segments: ['tasks', 'stats'], handler: tasksStats },
  { segments: ['tasks', 'bulk'], handler: tasksBulk },
  { segments: ['tasks', ':id'], handler: taskById },

  { segments: ['task-lists'], handler: taskListsIndex },
  { segments: ['task-lists', 'stats'], handler: taskListsStats },
  { segments: ['task-lists', ':id'], handler: taskListById },

  { segments: ['calendars'], handler: calendarsIndex },
  { segments: ['calendars', ':id'], handler: calendarById },

  { segments: ['events'], handler: eventsIndex },
  { segments: ['events', 'conflicts'], handler: eventsConflicts },
  { segments: ['events', ':id'], handler: eventById },

  { segments: ['tags'], handler: tagsIndex },
  { segments: ['tags', 'stats'], handler: tagsStats },
  { segments: ['tags', 'merge'], handler: tagsMerge },
  { segments: ['tags', 'cleanup'], handler: tagsCleanup },
  { segments: ['tags', ':id'], handler: tagById },

  { segments: ['attachments'], handler: attachmentsIndex },
  { segments: ['attachments', 'stats'], handler: attachmentsStats },
  { segments: ['attachments', 'cleanup'], handler: attachmentsCleanup },
  { segments: ['attachments', ':id'], handler: attachmentById },

  { segments: ['auth', 'register'], handler: authRegister },
  { segments: ['auth', 'login'], handler: authLogin },
  { segments: ['auth', 'logout'], handler: authLogout },
  { segments: ['auth', 'refresh'], handler: authRefresh },
  { segments: ['auth', 'me'], handler: authMe },
  { segments: ['auth', 'forgot-password'], handler: authForgotPassword },
  { segments: ['auth', 'reset-password'], handler: authResetPassword },
  { segments: ['auth', 'change-password'], handler: authChangePassword },
  { segments: ['auth', 'google'], handler: authGoogle },
  { segments: ['auth', 'google', 'callback'], handler: authGoogleCallback },
  { segments: ['auth', 'google', 'verify'], handler: authGoogleVerify },

  { segments: ['upload'], handler: uploadIndex },

  { segments: ['user'], handler: userIndex },
  { segments: ['user', 'profile'], handler: userProfile },
  { segments: ['user', 'preferences'], handler: userPreferences },
  { segments: ['user', 'export'], handler: userExport },
];

interface RouteMatch {
  handler: ApiHandler;
  params: Record<string, string>;
}

/**
 * Match path segments to a route, preferring an exact static match over a
 * dynamic one of the same length (Vercel filesystem routing semantics).
 */
export function matchRoute(segs: string[]): RouteMatch | null {
  let dynamic: RouteMatch | null = null;

  for (const route of routes) {
    if (route.segments.length !== segs.length) continue;

    const params: Record<string, string> = {};
    let matches = true;
    let hasDynamic = false;

    for (let i = 0; i < segs.length; i++) {
      const rs = route.segments[i];
      if (rs.startsWith(':')) {
        params[rs.slice(1)] = segs[i];
        hasDynamic = true;
      } else if (rs !== segs[i]) {
        matches = false;
        break;
      }
    }

    if (!matches) continue;
    if (!hasDynamic) return { handler: route.handler, params }; // static wins
    if (!dynamic) dynamic = { handler: route.handler, params };
  }

  return dynamic;
}

/**
 * Parse the request URL into decoded path segments and a query object shaped
 * the way Vercel populates req.query (repeated keys become arrays).
 */
export function parseUrl(rawUrl: string): {
  segments: string[];
  query: Record<string, string | string[]>;
} {
  const url = new URL(rawUrl, 'http://localhost');
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));

  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }

  return { segments, query };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { segments, query } = parseUrl(req.url || '');
  // Vercel may or may not include the leading `/api` in req.url; handle both.
  const routeSegments = segments[0] === 'api' ? segments.slice(1) : segments;

  const matched = matchRoute(routeSegments);

  if (!matched) {
    sendError(res, new ApiError(404, 'NOT_FOUND', 'Endpoint not found'));
    return;
  }

  // Reconstruct req.query exactly as the standalone file-system function would
  // have seen it: the parsed query string plus any dynamic path params. The
  // catch-all's own `route` param is intentionally dropped.
  req.query = { ...query, ...matched.params };

  await matched.handler(req, res);
}
