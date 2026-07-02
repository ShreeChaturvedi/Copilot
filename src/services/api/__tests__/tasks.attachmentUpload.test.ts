import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskApi, type CreateTaskData } from '../tasks';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => body,
  } as unknown as Response;
}

const createdTask = {
  id: 'task-1',
  title: 'Test task',
  completed: false,
  priority: 'MEDIUM',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('taskApi.createTask attachment upload failure (#35)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.endsWith('/api/tasks') && method === 'POST') {
        return jsonResponse(200, { success: true, data: createdTask });
      }
      // Upload endpoint reports it cannot persist the file (e.g. no blob token,
      // or the file is too large) -> must surface, not fall back to a data: URI.
      if (u.includes('/api/upload')) {
        return jsonResponse(503, {
          success: false,
          error: { message: 'BLOB_READ_WRITE_TOKEN is not set' },
        });
      }
      // If the fix regresses, the swallow path would POST the attachment here.
      if (u.includes('/api/attachments') && method === 'POST') {
        return jsonResponse(201, { success: true, data: { id: 'att-1' } });
      }
      if (u.endsWith('/api/tasks') && method === 'GET') {
        return jsonResponse(200, { success: true, data: [createdTask] });
      }
      throw new Error(`unexpected fetch: ${method} ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input: CreateTaskData = {
    title: 'Test task',
    attachments: [
      {
        name: 'big.txt',
        type: 'text/plain',
        size: 100000,
        url: 'data:text/plain;base64,aGVsbG8=',
      },
    ],
  };

  it('rejects when the upload fails instead of persisting the data: URI', async () => {
    await expect(taskApi.createTask(input)).rejects.toThrow(
      /Failed to upload attachment/
    );
  });

  it('never creates an attachment record with the data: URI fallback', async () => {
    await expect(taskApi.createTask(input)).rejects.toThrow();

    const attachmentPosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).includes('/api/attachments') &&
        (init as RequestInit | undefined)?.method === 'POST'
    );
    expect(attachmentPosts).toHaveLength(0);
  });
});
