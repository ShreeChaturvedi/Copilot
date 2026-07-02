/**
 * L3 test adapter: mounts the ACTUAL Vercel serverless catch-all handlers onto
 * a thin Express app so integration tests exercise the real routing table,
 * real middleware pipeline, real services and a real Postgres — the drift the
 * mocked "integration" suite (see docs/design-research/recon/test-audit.md §5.2)
 * and scripts/dev-server.ts (#31) both hide.
 *
 * The adapter does NOT re-declare any routes. It forwards every request to the
 * two real dispatchers:
 *   - api/[...route].ts          -> /api/*        (its own matchRoute table)
 *   - api/google/[...route].ts   -> /api/google/* (separate Vercel function)
 * Google is mounted first so its more-specific path wins, exactly as Vercel
 * routes the two functions in production (see vercel.json `functions`).
 *
 * Vercel `(req,res)` handlers expect: req.url (they re-parse the query and, for
 * api/[...route].ts, REASSIGN req.query), req.method, req.headers, a parsed
 * req.body, and a readable request stream (api/_handlers/upload/index.ts reads
 * req.on('data')). Express 4's req.query is a getter-only accessor, so we never
 * hand the raw Express req to a dispatcher; instead we build a fresh Node
 * Readable that replays the raw body and carries plain, assignable url/method/
 * headers/query/body properties.
 */
import express from 'express';
import { Readable } from 'node:stream';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import mainRouter from '../../api/[...route].js';
import googleRouter from '../../api/google/[...route].js';
import { resetRateLimitStore } from '../../lib/middleware/rateLimit.js';
import { pool as libPool } from '../../lib/config/database.js';
import { pool as backendPool } from '../../packages/backend/src/config/database.js';

// Re-export so tests reset the SAME in-memory rate-limit store the handlers use
// (the module is shared across the whole graph rooted at the dispatchers above).
export { resetRateLimitStore };

type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | Promise<void>;

function collectRawBody(req: express.Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function toVercelReq(
  expressReq: express.Request,
  rawBody: Buffer,
  parsedBody: unknown
): VercelRequest {
  // A real Readable so stream-reading handlers (upload) work; the buffered raw
  // body is replayed as a single chunk.
  const stream = Readable.from(
    rawBody.length ? [rawBody] : []
  ) as unknown as VercelRequest & Record<string, unknown>;
  stream.url = expressReq.originalUrl;
  stream.method = expressReq.method;
  stream.headers = expressReq.headers;
  // Own, assignable property (api/[...route].ts does `req.query = {...}`).
  stream.query = { ...expressReq.query } as Record<string, string | string[]>;
  stream.body = parsedBody;
  stream.cookies = {};
  // rateLimit getClientIP() falls back to socket.remoteAddress.
  (stream as Record<string, unknown>).socket = expressReq.socket;
  return stream as VercelRequest;
}

function mount(vercelHandler: VercelHandler): express.RequestHandler {
  return (req, res, next) => {
    collectRawBody(req)
      .then((rawBody) => {
        let parsed: unknown;
        const ct = String(req.headers['content-type'] || '');
        if (ct.includes('application/json') && rawBody.length) {
          try {
            parsed = JSON.parse(rawBody.toString('utf8'));
          } catch {
            parsed = {};
          }
        }
        const vreq = toVercelReq(req, rawBody, parsed);
        return Promise.resolve(
          vercelHandler(vreq, res as unknown as VercelResponse)
        );
      })
      .catch(next);
  };
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // NOTE: no express.json() — we read the raw stream ourselves so upload's
  // req.on('data') path is preserved and JSON is parsed exactly once.
  app.use('/api/google', mount(googleRouter)); // separate Vercel function
  app.use('/api', mount(mainRouter)); // main catch-all dispatcher
  // Fallback JSON error handler (real handlers wrap in asyncHandler, so this is
  // only a safety net for anything that escapes the promise chain).
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('L3 adapter unhandled error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Adapter error' },
        });
      }
    }
  );
  return app;
}

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/** Start the adapter on an ephemeral loopback port. */
export async function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = createServer(app);
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  );
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Force-close any lingering sockets. Requests to requireAuth routes with
        // a missing/invalid token never get a response (issue: middleware drops
        // the thrown UnauthorizedError), so their sockets stay open and would
        // otherwise block server.close() forever.
        (
          server as Server & { closeAllConnections?: () => void }
        ).closeAllConnections?.();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/** End the module-level pg pools the handlers use, so the worker can exit. */
export async function closeAppPools(): Promise<void> {
  await Promise.allSettled([libPool.end(), backendPool.end()]);
}
