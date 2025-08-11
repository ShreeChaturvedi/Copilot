/**
 * Calendars API Route - CRUD operations for calendars
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import { UnauthorizedError, ValidationError, InternalServerError } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateCalendarDTO, CalendarFilters } from '../../lib/services/CalendarService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { isVisible, search, withEventCounts } = req.query;

      let result;
      
      if (withEventCounts === 'true') {
        // Get calendars with event counts
        result = await calendarService.getWithEventCounts({
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      } else {
        // Build filters
        const filters: CalendarFilters = {};
        
        if (isVisible !== undefined) {
          filters.isVisible = isVisible === 'true';
        }
        
        if (search) {
          filters.search = search as string;
        }

        result = await calendarService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/calendars error:', error);
      sendError(res, new InternalServerError(error.message || 'Failed to fetch calendars'));
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { calendar: calendarService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const calendarData: CreateCalendarDTO = req.body;
      
      if (!calendarData.name?.trim()) {
        return sendError(
          res,
          new ValidationError([
            { field: 'name', message: 'Calendar name is required', code: 'REQUIRED' },
          ], 'Calendar name is required')
        );
      }

      if (!calendarData.color) {
        return sendError(
          res,
          new ValidationError([
            { field: 'color', message: 'Calendar color is required', code: 'REQUIRED' },
          ], 'Calendar color is required')
        );
      }

      const calendar = await calendarService.create(calendarData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, calendar, 201);
    } catch (error) {
      console.error('POST /api/calendars error:', error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to create calendar'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});