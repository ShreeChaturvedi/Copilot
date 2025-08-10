/**
 * Events API Route - CRUD operations for events
 */
import { createCrudHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';
import type { CreateEventDTO, UpdateEventDTO, EventFilters } from '../../lib/services/EventService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
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

      const { 
        calendarId, 
        startDate, 
        endDate, 
        upcoming, 
        search,
        limit = '50',
        offset = '0'
      } = req.query;

      // Build filters
      const filters: EventFilters = {};
      
      if (calendarId) {
        filters.calendarId = calendarId as string;
      }
      
      if (search) {
        filters.search = search as string;
      }

      const options = {
        limit: Math.min(parseInt(limit as string) || 50, 100), // Max 100
        offset: parseInt(offset as string) || 0,
      };

      let result;

      if (upcoming === 'true') {
        // Get upcoming events
        result = await eventService.findUpcoming(options.limit, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      } else if (startDate && endDate) {
        // Get events in date range
        result = await eventService.findByDateRange(
          new Date(startDate as string),
          new Date(endDate as string),
          { ...filters, ...options },
          {
            userId,
            requestId: req.headers['x-request-id'] as string,
          }
        );
      } else {
        // Regular findAll with filters
        result = await eventService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/events error:', error);
      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch events',
      });
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
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

      const eventData: CreateEventDTO = req.body;
      
      if (!eventData.title?.trim()) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event title is required',
        });
      }

      if (!eventData.startTime) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event start time is required',
        });
      }

      if (!eventData.endTime) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event end time is required',
        });
      }

      if (!eventData.calendarId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Calendar ID is required',
        });
      }

      const event = await eventService.create(eventData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, event, 201);
    } catch (error) {
      console.error('POST /api/events error:', error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: error.message.replace('VALIDATION_ERROR: ', ''),
        });
      }

      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create event',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});