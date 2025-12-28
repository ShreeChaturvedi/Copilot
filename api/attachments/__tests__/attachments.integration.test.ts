import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createMockAuthRequest,
  createMockResponse,
} from '../../../lib/__tests__/helpers';

const {
  mockAttachmentService,
  mockSendSuccess,
  mockSendError,
  mockGetAllServices,
} = vi.hoisted(() => {
  const service = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByCategory: vi.fn(),
    getStorageStats: vi.fn(),
  };

  return {
    mockAttachmentService: service,
    mockSendSuccess: vi.fn((res, data, statusCode = 200) => {
      res.status(statusCode).json({ success: true, data });
    }),
    mockSendError: vi.fn((res, error) => {
      const statusCode = error.statusCode ?? 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }),
    mockGetAllServices: vi.fn(() => ({ attachment: service })),
  };
});

vi.mock('../../../lib/services/index.js', () => ({
  getAllServices: mockGetAllServices,
}));

vi.mock('../../../lib/middleware/errorHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    asyncHandler: (handler: any) => handler,
    sendSuccess: mockSendSuccess,
    sendError: mockSendError,
  };
});

vi.mock('../../../lib/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    devAuth: () => (_req: any, _res: any, next: any) => next(),
  };
});
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (_name: string, _data: Buffer, _opts: any) => ({
    url: 'https://blob.local/test-object',
    pathname: '/test-object',
  })),
}));
vi.mock('sharp', () => ({
  default: (input: Buffer) => ({
    rotate: () => ({
      resize: () => ({
        jpeg: () => ({
          toBuffer: async () =>
            Buffer.from(
              input.slice(0, Math.max(10, Math.floor(input.length / 4)))
            ),
        }),
        webp: () => ({
          toBuffer: async () =>
            Buffer.from(
              input.slice(0, Math.max(10, Math.floor(input.length / 8)))
            ),
        }),
      }),
    }),
  }),
}));

let listHandler: typeof import('../index').default;
let itemHandler: typeof import('../[id]').default;
let statsHandler: typeof import('../stats').default;

beforeAll(async () => {
  listHandler = (await import('../index')).default;
  itemHandler = (await import('../[id]')).default;
  statsHandler = (await import('../stats')).default;
});

const mockUser = { id: 'user-1' };

function req(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return createMockAuthRequest(mockUser as any, {
    url: '/api/attachments',
    ...overrides,
  });
}

function res(): VercelResponse {
  return createMockResponse() as any;
}

describe('Attachments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists attachments by task', async () => {
    const r = req({ method: 'GET', query: { taskId: 't1' } });
    const s = res();
    mockAttachmentService.findAll.mockResolvedValue([]);

    await listHandler(r as any, s as any);

    expect(mockAttachmentService.findAll).toHaveBeenCalledWith(
      { taskId: 't1', limit: 50, offset: 0 },
      { userId: 'user-1', requestId: 'test-request-123' }
    );
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('validates create payload', async () => {
    const r = req({
      method: 'POST',
      body: {
        fileName: '',
        fileType: '',
        fileSize: 0,
        fileUrl: '',
        taskId: '',
      },
    });
    const s = res();

    await listHandler(r as any, s as any);

    expect(mockSendError).toHaveBeenCalled();
  });

  it('gets attachment by id', async () => {
    const r = req({ method: 'GET', query: { id: 'a1' } });
    const s = res();
    mockAttachmentService.findById.mockResolvedValue({ id: 'a1' });

    await itemHandler(r as any, s as any);

    expect(mockAttachmentService.findById).toHaveBeenCalledWith('a1', {
      userId: 'user-1',
      requestId: 'test-request-123',
    });
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('deletes attachment by id', async () => {
    const r = req({ method: 'DELETE', query: { id: 'a1' } });
    const s = res();
    mockAttachmentService.delete.mockResolvedValue(true);

    await itemHandler(r as any, s as any);

    expect(mockAttachmentService.delete).toHaveBeenCalledWith('a1', {
      userId: 'user-1',
      requestId: 'test-request-123',
    });
    expect(mockSendSuccess).toHaveBeenCalledWith(s, { deleted: true });
  });

  it('ensures upload endpoint compresses images and returns thumbnail', async () => {
    const { default: uploadHandler } = await import('../../upload/index');
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const r = req({
      method: 'PUT',
      url: '/api/upload?filename=test.jpg',
      headers: { 'content-type': 'image/jpeg', 'x-request-id': 'req-2' },
    });
    const base64 =
      '/9j/4AAQSkZJRgABAQABAAD/2wCEAAkGBxISEhUQFRUVFRUVFRUVFRUVFRUVFRUXFxUYFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQMH/8QAHhABAQABBAMAAAAAAAAAAAAAAQIDBBEABSEiMTH/xAAWAQEBAQAAAAAAAAAAAAAAAAABAgT/xAAZEQABBQAAAAAAAAAAAAAAAAAAARECITH/2gAMAwEAAhEDEQA/ANrVg9z2l2M0y3qGm6oVgU9sA1dZq1p2gq7eXfIc3f+Xo8XkqT1fWc3M5G0qk6sQ8M0xKx3W+Hj7m6w3mA4m2b8zW3FvJ2iH2k3u0Zz9X//Z';
    const buf = Buffer.from(base64, 'base64');
    const s = res();
    // Minimal stream simulation
    type UploadEventHandler = (chunk?: Buffer) => void;
    const events: Record<string, UploadEventHandler[]> = {};
    (r as any).on = (ev: string, fn: UploadEventHandler) => {
      (events[ev] ||= []).push(fn);
    };
    // Trigger upload handler
    try {
      const p = uploadHandler(r as any, s as any);
      events['data']?.forEach((fn) => fn(buf));
      events['end']?.forEach((fn) => fn());
      await p;
      const { sendSuccess } = await import(
        '../../../lib/middleware/errorHandler.js'
      );
      expect(vi.mocked(sendSuccess)).toHaveBeenCalled();
      const call = vi.mocked(sendSuccess).mock.calls[0];
      expect(call).toBeTruthy();
      const payload = call?.[1] as any;
      expect(payload.url).toContain('https://blob.local');
      expect(typeof payload.thumbnailUrl).toBe('string');
      expect(payload.contentType).toBe('image/jpeg');
      expect(typeof payload.size).toBe('number');
    } finally {
      process.env.BLOB_READ_WRITE_TOKEN = previousToken;
    }
  });

  it('returns storage stats via stats route', async () => {
    const r = req({ method: 'GET', url: '/api/attachments/stats' });
    const s = res();
    mockAttachmentService.getStorageStats.mockResolvedValue({
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: 0,
      averageFileSize: 0,
      filesByType: {},
      largestFiles: [],
    });
    await statsHandler(r as any, s as any);
    expect(mockAttachmentService.getStorageStats).toHaveBeenCalledWith({
      userId: 'user-1',
      requestId: 'test-request-123',
    });
  });
});
