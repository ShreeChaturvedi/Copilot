import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import listHandler from '../index';
import itemHandler from '../[id]';
import { getAllServices } from '../../../lib/services/index';

vi.mock('../../../lib/services/index');
vi.mock('../../../lib/middleware/errorHandler');

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

const { sendSuccess, sendError } = await import('../../../lib/middleware/errorHandler');
const mockSendSuccess = vi.fn();
const mockSendError = vi.fn();
vi.mocked(sendSuccess).mockImplementation(mockSendSuccess);
vi.mocked(sendError).mockImplementation(mockSendError);

const mockUser = { id: 'user-1' };

function req(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    url: '/api/attachments',
    query: {},
    headers: { 'x-request-id': 'req-1' },
    body: {},
    user: mockUser as any,
    ...overrides,
  } as any;
}

function res(): VercelResponse {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as any;
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
});