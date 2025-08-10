/**
 * Event Conflicts API Route - Check for event conflicts
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
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const { startTime, endTime, excludeEventId } = req.query;

      if (!startTime || !endTime) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Start time and end time are required',
        });
      }

      const conflicts = await eventService.getConflicts(
        new Date(startTime as string),
        new Date(endTime as string),
        excludeEventId as string,
        {
          userId,
          requestId: req.headers['x-request-id'] as string,
        }
      );

      sendSuccess(res, {
        conflicts,
        hasConflicts: conflicts.length > 0,
        count: conflicts.length,
      });
    } catch (error) {
      console.error('GET /api/events/conflicts error:', error);
      
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
        message: error.message || 'Failed to check event conflicts',
      });
    }
  },
});