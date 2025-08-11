/**
 * Task Bulk Operations API Route
 */
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTaskDTO } from '../../lib/services/TaskService';

export default createMethodHandler({
  [HttpMethod.PATCH]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const { taskIds, updates } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task IDs array is required',
        });
      }

      if (taskIds.length > 100) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Maximum 100 tasks can be updated at once',
        });
      }

      if (!updates || typeof updates !== 'object') {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Updates object is required',
        });
      }

      const updateData: Partial<UpdateTaskDTO> = updates;

      const result = await taskService.bulkUpdate(taskIds, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, {
        updatedTasks: result,
        count: result.length,
      });
    } catch (error) {
      console.error('PATCH /api/tasks/bulk error:', error);
      
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
        message: error.message || 'Failed to update tasks',
      });
    }
  },

  [HttpMethod.DELETE]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task IDs array is required',
        });
      }

      if (taskIds.length > 100) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Maximum 100 tasks can be deleted at once',
        });
      }

      await taskService.bulkDelete(taskIds, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, {
        deleted: true,
        count: taskIds.length,
      });
    } catch (error) {
      console.error('DELETE /api/tasks/bulk error:', error);
      
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
        message: error.message || 'Failed to delete tasks',
      });
    }
  },
});