/**
 * Tag Cleanup API Route - Remove unused tags
 */
import { createMethodHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import { HttpMethod } from '../../lib/types/api';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';

export default createMethodHandler({
  [HttpMethod.DELETE]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const deletedCount = await tagService.cleanupUnusedTags({
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, {
        cleaned: true,
        deletedCount,
        message: `${deletedCount} unused tags were removed`,
      });
    } catch (error) {
      console.error('DELETE /api/tags/cleanup error:', error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to cleanup unused tags',
      });
    }
  },
});