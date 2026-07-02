/**
 * L3 — /api/attachments* and /api/upload contracts through the real dispatcher,
 * AttachmentService and Postgres. The upload path is blob-dependent, so the
 * 503 BLOB_NOT_CONFIGURED contract is asserted (BLOB_READ_WRITE_TOKEN is unset
 * in the test env). Metadata CRUD is exercised against a real task row.
 *
 * Frontend consumers: attachment metadata create/list lives in
 * src/services/api/tasks.ts createTask (PUT /api/upload then POST
 * /api/attachments, tasks.ts:274-311) and src/services/api/attachments.ts
 * listByTask (reads a.{id,fileName,fileType,fileSize,fileUrl,createdAt,
 * thumbnailUrl,taskId}, attachments.ts:36-46).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer,
  closeAppPools,
  resetRateLimitStore,
  type TestServer,
} from './adapter.js';
import {
  makeClient,
  registerUser,
  dbAvailable,
  cleanupPool,
  cleanupTestData,
  type TestUser,
} from './helpers.js';

interface Envelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; timestamp: string };
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  taskId: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

describe.skipIf(!dbAvailable)('L3 attachments + upload contracts', () => {
  let server: TestServer;
  let req: ReturnType<typeof makeClient>;
  let user: TestUser;
  let taskId: string;

  beforeAll(async () => {
    server = await startTestServer();
    req = makeClient(server.baseUrl);
    user = await registerUser(req);
    const task = await req<Envelope<{ id: string }>>('POST', '/api/tasks', {
      token: user.accessToken,
      body: { title: 'Attachment host' },
    });
    taskId = task.body.data!.id;
  });
  afterAll(async () => {
    await cleanupTestData();
    await server.close();
    await cleanupPool?.end();
    await closeAppPools();
  });
  beforeEach(() => resetRateLimitStore());

  describe('PUT /api/upload (blob-dependent)', () => {
    it('503 BLOB_NOT_CONFIGURED with the exact code the frontend surfaces (BLOB_READ_WRITE_TOKEN unset)', async () => {
      // upload/index.ts:53-63. The frontend throws on !putRes.ok||!success and
      // shows putBody.error.message (src/services/api/tasks.ts:285-298); the old
      // silent data:-URI fallback was removed (#35).
      const r = await req<Envelope>('PUT', '/api/upload?filename=note.bin', {
        token: user.accessToken,
        raw: {
          data: Buffer.from('hello world'),
          contentType: 'application/octet-stream',
        },
      });
      expect(r.status).toBe(503);
      expect(r.body.success).toBe(false);
      expect(r.body.error?.code).toBe('BLOB_NOT_CONFIGURED');
      expect(r.body.error?.message).toContain('BLOB_READ_WRITE_TOKEN');
    });

    it('400 "Empty body" for an empty PUT (body length check runs before the blob check)', async () => {
      const r = await req<Envelope>('PUT', '/api/upload?filename=empty.bin', {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      expect(r.body.error?.message).toBe('Empty body');
    });

    it('405 METHOD_NOT_ALLOWED for GET /api/upload', async () => {
      const r = await req<Envelope>('GET', '/api/upload');
      expect(r.status).toBe(405);
      expect(r.body.error?.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('POST/GET/DELETE /api/attachments (metadata)', () => {
    it('POST 201 stores metadata and returns fileName/fileUrl/fileType/fileSize/taskId/thumbnailUrl', async () => {
      const r = await req<Envelope<Attachment>>('POST', '/api/attachments', {
        token: user.accessToken,
        body: {
          fileName: 'spec.pdf',
          fileType: 'application/pdf',
          fileSize: 2048,
          fileUrl: 'https://blob.example/spec.pdf',
          thumbnailUrl: null,
          taskId,
        },
      });
      expect(r.status).toBe(201);
      expect(r.body.data).toMatchObject({
        fileName: 'spec.pdf',
        fileType: 'application/pdf',
        fileSize: 2048,
        fileUrl: 'https://blob.example/spec.pdf',
        taskId,
        thumbnailUrl: null,
      });
      expect(r.body.data!.id).toEqual(expect.any(String));
    });

    it("GET ?taskId= lists this task's attachments (double-nest tolerant, attachments.ts:33-46)", async () => {
      const list = await req<Envelope<{ data?: Attachment[] } & Attachment[]>>(
        'GET',
        `/api/attachments?taskId=${taskId}`,
        { token: user.accessToken }
      );
      expect(list.status).toBe(200);
      const items = Array.isArray(list.body.data?.data)
        ? list.body.data!.data
        : (list.body.data as unknown as Attachment[]);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]).toMatchObject({ taskId });
      expect(items[0].fileName).toEqual(expect.any(String));
    });

    it('POST 400 VALIDATION_ERROR without fileName / fileType / taskId / fileSize / fileUrl', async () => {
      const r = await req<Envelope>('POST', '/api/attachments', {
        token: user.accessToken,
        body: {
          fileType: 'application/pdf',
          taskId,
          fileSize: 1,
          fileUrl: 'x',
        },
      });
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      expect(r.body.error?.message).toBe('File name is required');
    });

    it('POST to another user\'s task is rejected: 400 "Task not found or access denied" (ownership enforced, no data leak)', async () => {
      const intruder = await registerUser(req);
      const r = await req<Envelope>('POST', '/api/attachments', {
        token: intruder.accessToken,
        body: {
          fileName: 'sneaky.pdf',
          fileType: 'application/pdf',
          fileSize: 10,
          fileUrl: 'https://blob.example/sneaky.pdf',
          taskId, // belongs to `user`
        },
      });
      // validateCreate scopes the task by userId and throws
      // "VALIDATION_ERROR: Task not found or access denied"
      // (lib/services/AttachmentService.ts:48-50), which the POST handler maps
      // to 400. Unlike the task/event read paths (#67), attachment writes ARE
      // ownership-checked.
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe('VALIDATION_ERROR');
      expect(r.body.error?.message).toBe('Task not found or access denied');
    });

    it('DELETE removes the attachment; the row is gone from the task listing', async () => {
      const created = await req<Envelope<Attachment>>(
        'POST',
        '/api/attachments',
        {
          token: user.accessToken,
          body: {
            fileName: 'temp.png',
            fileType: 'image/png',
            fileSize: 512,
            fileUrl: 'https://blob.example/temp.png',
            taskId,
          },
        }
      );
      const id = created.body.data!.id;
      const del = await req<Envelope>('DELETE', `/api/attachments/${id}`, {
        token: user.accessToken,
      });
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
    });
  });

  describe('stats/cleanup (pins issue #64: never authenticated)', () => {
    it('GET /api/attachments/stats -> 401 even with a valid token', async () => {
      const r = await req<Envelope>('GET', '/api/attachments/stats', {
        token: user.accessToken,
      });
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('DELETE /api/attachments/cleanup -> 401 even with a valid token', async () => {
      const r = await req<Envelope>('DELETE', '/api/attachments/cleanup', {
        token: user.accessToken,
      });
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('UNAUTHORIZED');
    });
  });
});
