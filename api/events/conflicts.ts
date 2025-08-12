/**
 * Event Conflicts API Route - Check for event conflicts
 */
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { UnauthorizedError, ValidationError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { start, end, startTime, endTime, excludeEventId, calendarId } = req.query as Record<string, string>;

      const startParam = start || startTime;
      const endParam = end || endTime;
      if (!startParam || !endParam) {
        return sendError(
          res,
          new ValidationError([
            { field: 'start', message: 'Start time is required', code: 'REQUIRED' },
            { field: 'end', message: 'End time is required', code: 'REQUIRED' },
          ], 'Start time and end time are required')
        );
      }

      const conflicts = await eventService.getConflicts(
        {
          start: new Date(startParam),
          end: new Date(endParam),
          calendarId: calendarId as string,
        },
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
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to check event conflicts'));
    }
  },
});