/**
 * Individual Calendar API Route - Operations on specific calendars
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateCalendarDTO } from '../../lib/services/CalendarService';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;
      const calendarId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!calendarId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Calendar ID is required', code: 'REQUIRED' },
          ], 'Calendar ID is required')
        );
      }

      const calendar = await calendarService.findById(calendarId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!calendar) {
        return sendError(res, new NotFoundError('Calendar'));
      }

      sendSuccess(res, calendar);
    } catch (error) {
      console.error(`GET /api/calendars/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to fetch calendar'));
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;
      const calendarId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!calendarId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Calendar ID is required', code: 'REQUIRED' },
          ], 'Calendar ID is required')
        );
      }

      const updateData: UpdateCalendarDTO = req.body;
      
      const calendar = await calendarService.update(calendarId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!calendar) {
        return sendError(res, new NotFoundError('Calendar'));
      }

      sendSuccess(res, calendar);
    } catch (error) {
      console.error(`PUT /api/calendars/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update calendar'));
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;
      const calendarId = req.query.id as string;
      const { action } = req.query;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!calendarId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Calendar ID is required', code: 'REQUIRED' },
          ], 'Calendar ID is required')
        );
      }

      let result;

      switch (action) {
        case 'toggle-visibility': {
          result = await calendarService.toggleVisibility(calendarId, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
          break;
        }

        case 'set-default': {
          result = await calendarService.setDefault(calendarId, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
          break;
        }

        default: {
          // Regular patch update
          const updateData: UpdateCalendarDTO = req.body;
          result = await calendarService.update(calendarId, updateData, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        }
      }

      if (!result) {
        return sendError(res, new NotFoundError('Calendar'));
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/calendars/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update calendar'));
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;
      const calendarId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!calendarId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Calendar ID is required', code: 'REQUIRED' },
          ], 'Calendar ID is required')
        );
      }

      const success = await calendarService.delete(calendarId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, new NotFoundError('Calendar'));
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/calendars/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to delete calendar'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});