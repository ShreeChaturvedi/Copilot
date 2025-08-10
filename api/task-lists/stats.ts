/**
 * Task List Statistics API Route
 */
import { createMethodHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import { HttpMethod } from '../../lib/types/api';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';

export default createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const stats = await taskListService.getStatistics({
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, stats);
    } catch (error) {
      console.error('GET /api/task-lists/stats error:', error);
      
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
        message: error.message || 'Failed to fetch task list statistics',
      });
    }
  },
});