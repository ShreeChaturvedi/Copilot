/**
 * Tag Statistics API Route
 */
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { UnauthorizedError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const stats = await tagService.getStatistics({
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, stats);
    } catch (error) {
      console.error('GET /api/tags/stats error:', error);

      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to fetch tag statistics'));
    }
  },
});
