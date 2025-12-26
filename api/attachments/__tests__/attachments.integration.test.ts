import { describe, it, expect, beforeEach, vi } from 'vitest';
import listHandler from '../index';
import itemHandler from '../[id]';
import statsHandler from '../stats';
import { getAllServices } from '../../../lib/services/index';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createMockAuthRequest,
  createMockResponse,
} from '../../../lib/__tests__/helpers';

vi.mock('../../../lib/services/index', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/services/index')>('../../../lib/services/index');
  return {
    ...actual,
    getAllServices: vi.fn(() => ({ attachment: mockAttachmentService } as any)),
  } as any;
});
vi.mock('../../../lib/middleware/errorHandler', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/middleware/errorHandler')>('../../../lib/middleware/errorHandler');
  return {
    ...actual,
    sendSuccess: vi.fn(),
    sendError: vi.fn(),
  } as typeof actual & { sendSuccess: any; sendError: any };
});
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (_name: string, _data: Buffer, _opts: any) => ({
    url: 'https://blob.local/test-object',
    pathname: '/test-object'
  })),
}));
vi.mock('sharp', () => ({
  default: (input: Buffer) => ({
    rotate: () => ({
      resize: () => ({
        jpeg: () => ({
          toBuffer: async () => Buffer.from(input.slice(0, Math.max(10, Math.floor(input.length / 4))))
        }),
        webp: () => ({
          toBuffer: async () => Buffer.from(input.slice(0, Math.max(10, Math.floor(input.length / 8))))
        }),
      })
    })
  })
}));

const mockAttachmentService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByCategory: vi.fn(),
  getStorageStats: vi.fn(),
};

vi.mocked(getAllServices).mockReturnValue({ attachment: mockAttachmentService } as any);

const errorModule = await import('../../../lib/middleware/errorHandler');
const mockSendSuccess = vi.fn();
const mockSendError = vi.fn();
(errorModule as any).sendSuccess = mockSendSuccess as any;
(errorModule as any).sendError = mockSendError as any;

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

    expect(mockAttachmentService.findAll).toHaveBeenCalledWith({ taskId: 't1', limit: 50, offset: 0 }, { userId: 'user-1', requestId: 'req-1' });
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('validates create payload', async () => {
    const r = req({ method: 'POST', body: { fileName: '', fileType: '', fileSize: 0, fileUrl: '', taskId: '' } });
    const s = res();

    await listHandler(r as any, s as any);

    expect(mockSendError).toHaveBeenCalled();
  });

  it('gets attachment by id', async () => {
    const r = req({ method: 'GET', query: { id: 'a1' } });
    const s = res();
    mockAttachmentService.findById.mockResolvedValue({ id: 'a1' });

    await itemHandler(r as any, s as any);

    expect(mockAttachmentService.findById).toHaveBeenCalledWith('a1', { userId: 'user-1', requestId: 'req-1' });
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('deletes attachment by id', async () => {
    const r = req({ method: 'DELETE', query: { id: 'a1' } });
    const s = res();
    mockAttachmentService.delete.mockResolvedValue(true);

    await itemHandler(r as any, s as any);

    expect(mockAttachmentService.delete).toHaveBeenCalledWith('a1', { userId: 'user-1', requestId: 'req-1' });
    expect(mockSendSuccess).toHaveBeenCalledWith(s, { deleted: true });
  });

  it('ensures upload endpoint compresses images and returns thumbnail', async () => {
    const { default: uploadHandler } = await import('../../upload/index');
    const r = req({ method: 'PUT', url: '/api/upload?filename=test.jpg', headers: { 'content-type': 'image/jpeg', 'x-request-id': 'req-2' } });
    const base64 = '/9j/4AAQSkZJRgABAQABAAD/2wCEAAkGBxISEhUQFRUVFRUVFRUVFRUVFRUVFRUXFxUYFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQMH/8QAHhABAQABBAMAAAAAAAAAAAAAAQIDBBEABSEiMTH/xAAWAQEBAQAAAAAAAAAAAAAAAAABAgT/xAAZEQABBQAAAAAAAAAAAAAAAAAAARECITH/2gAMAwEAAhEDEQA/ANrVg9z2l2M0y3qGm6oVgU9sA1dZq1p2gq7eXfIc3f+Xo8XkqT1fWc3M5G0qk6sQ8M0xKx3W+Hj7m6w3mA4m2b8zW3FvJ2iH2k3u0Zz9X//Z';
    const buf = Buffer.from(base64, 'base64');
    const s = res();
    // Minimal stream simulation
    const events: Record<string, Function[]> = {};
    (r as any).on = (ev: string, fn: Function) => { (events[ev] ||= []).push(fn); };
    // Trigger upload handler
    const p = uploadHandler(r as any, s as any);
    events['data']?.forEach((fn) => fn(buf));
    events['end']?.forEach((fn) => fn());
    await p;
    const { sendSuccess } = await import('../../../lib/middleware/errorHandler');
    expect(vi.mocked(sendSuccess)).toHaveBeenCalled();
    const call = vi.mocked(sendSuccess).mock.calls.find((c) => c[1] && (c[1] as any).data);
    expect(call).toBeTruthy();
    const payload = call?.[1] as any;
    expect(payload.data.url).toContain('https://blob.local');
    expect(typeof payload.data.thumbnailUrl).toBe('string');
    expect(payload.data.contentType).toBe('image/jpeg');
    expect(typeof payload.data.size).toBe('number');
  });

  it('returns storage stats via stats route', async () => {
    const r = req({ method: 'GET', url: '/api/attachments/stats' });
    const s = res();
    mockAttachmentService.getStorageStats.mockResolvedValue({ totalFiles: 0, totalSize: 0, totalSizeMB: 0, averageFileSize: 0, filesByType: {}, largestFiles: [] });
    await statsHandler(r as any, s as any);
    expect(mockAttachmentService.getStorageStats).toHaveBeenCalledWith({ userId: 'user-1', requestId: 'req-1' });
  });
});
