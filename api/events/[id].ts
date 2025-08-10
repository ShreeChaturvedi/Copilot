/**
 * Individual Event API Route - Operations on specific events
 */
import { createCrudHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';
import type { UpdateEventDTO } from '../../lib/services/EventService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;
      const eventId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!eventId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event ID is required',
        });
      }

      const event = await eventService.findById(eventId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!event) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Event not found',
        });
      }

      sendSuccess(res, event);
    } catch (error) {
      console.error(`GET /api/events/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to fetch event',
      });
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;
      const eventId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!eventId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event ID is required',
        });
      }

      const updateData: UpdateEventDTO = req.body;
      
      const event = await eventService.update(eventId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!event) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Event not found',
        });
      }

      sendSuccess(res, event);
    } catch (error) {
      console.error(`PUT /api/events/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: error.message.replace('VALIDATION_ERROR: ', ''),
        });
      }
      
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
        message: error.message || 'Failed to update event',
      });
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;
      const eventId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!eventId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event ID is required',
        });
      }

      // Regular patch update
      const updateData: UpdateEventDTO = req.body;
      const result = await eventService.update(eventId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!result) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Event not found',
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/events/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: error.message.replace('VALIDATION_ERROR: ', ''),
        });
      }
      
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
        message: error.message || 'Failed to update event',
      });
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { event: eventService } = getAllServices();
      const userId = req.user?.id;
      const eventId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!eventId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Event ID is required',
        });
      }

      const success = await eventService.delete(eventId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Event not found',
        });
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/events/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to delete event',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});