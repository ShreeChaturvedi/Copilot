import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  createMockAuthRequest,
  createMockResponse,
} from '../../../../lib/__tests__/helpers';

/**
 * Regression for issue #33: the cleanup endpoint bound the whole
 * { deletedCount } object to `deletedCount`, so the message rendered as
 * "[object Object] orphaned attachments were removed" and data.deletedCount
 * was a nested object instead of a number.
 */
const { mockCleanup, mockSendSuccess, mockSendError, mockGetAllServices } =
  vi.hoisted(() => {
    const cleanupOrphanedAttachments = vi.fn();
    return {
      mockCleanup: cleanupOrphanedAttachments,
      mockSendSuccess: vi.fn((res: any, data: any, statusCode = 200) => {
        res.status(statusCode).json({ success: true, data });
      }),
      mockSendError: vi.fn((res: any, error: any) => {
        res.status(error.statusCode ?? 500).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }),
      mockGetAllServices: vi.fn(() => ({
        attachment: { cleanupOrphanedAttachments },
      })),
    };
  });

vi.mock('../../../../lib/services/index.js', () => ({
  getAllServices: mockGetAllServices,
}));

// The route now authenticates (issue #64), so stub the auth middleware as a
// pass-through — this test exercises the handler's response shape (issue #33),
// with req.user supplied by createMockAuthRequest, not the JWT pipeline.
vi.mock('../../../../lib/middleware/auth.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../lib/middleware/auth.js')>();
  return {
    ...actual,
    authenticateJWT: () => async (_req: any, _res: any, next: () => void) =>
      next(),
    devAuth: () => async (_req: any, _res: any, next: () => void) => next(),
  };
});

vi.mock(
  '../../../../lib/middleware/errorHandler.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../lib/middleware/errorHandler.js')
      >();
    return {
      ...actual,
      asyncHandler: (handler: any) => handler,
      sendSuccess: mockSendSuccess,
      sendError: mockSendError,
    };
  }
);

let cleanupHandler: typeof import('../cleanup').default;

beforeAll(async () => {
  cleanupHandler = (await import('../cleanup')).default;
});

describe('Attachments cleanup endpoint (issue #33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a numeric deletedCount and a correctly interpolated message', async () => {
    mockCleanup.mockResolvedValue({ deletedCount: 3 });
    const r = createMockAuthRequest(
      { id: 'user-1', email: 'u@example.com' },
      {
        method: 'DELETE',
        url: '/api/attachments/cleanup',
      }
    );
    const s = createMockResponse();

    await cleanupHandler(r as any, s as any);

    expect(mockCleanup).toHaveBeenCalledWith({
      userId: 'user-1',
      requestId: 'test-request-123',
    });
    expect(mockSendSuccess).toHaveBeenCalledTimes(1);
    const payload = mockSendSuccess.mock.calls[0][1] as {
      cleaned: boolean;
      deletedCount: unknown;
      message: string;
    };
    expect(payload.cleaned).toBe(true);
    expect(payload.deletedCount).toBe(3);
    expect(typeof payload.deletedCount).toBe('number');
    expect(payload.message).toBe('3 orphaned attachments were removed');
    expect(payload.message).not.toContain('[object Object]');
  });
});
