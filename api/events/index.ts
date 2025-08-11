/**
 * Events API Route - CRUD operations for events
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateEventDTO, EventFilters } from '../../lib/services/EventService';

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

      // Support standardized query params per shared validation (start/end) and maintain backward-compat (startDate/endDate)
      const {
        calendarId,
        start,
        end,
        startDate,
        endDate,
        upcoming,
        search,
      } = req.query as Record<string, string>;

      // Build filters
      const filters: EventFilters = {};
      if (calendarId) filters.calendarId = calendarId;
      if (search) filters.search = search;

      let result;

      if (upcoming === 'true') {
        // Get upcoming events
        result = await eventService.findUpcoming(undefined, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      } else if ((start && end) || (startDate && endDate)) {
        // Date range query (accept both start/end and startDate/endDate)
        const rangeStart = new Date((start || startDate)!);
        const rangeEnd = new Date((end || endDate)!);
        result = await eventService.findAll(
          { ...filters, start: rangeStart, end: rangeEnd } as unknown as EventFilters,
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

      const body = req.body as Partial<CreateEventDTO & { start?: string | Date; end?: string | Date; calendarName?: string }>;
      const eventData: CreateEventDTO = {
        title: (body.title || '').trim(),
        start: typeof body.start === 'string' ? new Date(body.start) : (body.start as Date),
        end: typeof body.end === 'string' ? new Date(body.end) : (body.end as Date),
        description: body.description,
        location: body.location,
        notes: body.notes,
        calendarId: body.calendarId as string,
        allDay: body.allDay,
        recurrence: body.recurrence,
      };

      if (!eventData.title) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event title is required',
        });
      }

      if (!eventData.start) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event start time is required',
        });
      }

      if (!eventData.end) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event end time is required',
        });
      }

      // Allow calendarId to be passed as a calendar name (legacy). Resolve to actual ID if needed.
      if (!eventData.calendarId && body.calendarName) {
        try {
          const { calendar: calendarService } = getAllServices();
          const calendars = await calendarService.findAll({ search: body.calendarName } as unknown as import('../../lib/services/CalendarService').CalendarFilters, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
          const exact = calendars.find(c => c.name === body.calendarName);
          if (exact) {
            eventData.calendarId = exact.id as unknown as string;
          }
        } catch {
          // ignore and let validation below handle missing calendarId
        }
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