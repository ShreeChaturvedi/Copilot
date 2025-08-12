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
import { UnauthorizedError, ValidationError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createMethodHandler({
  [HttpMethod.PATCH]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { taskIds, updates } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return sendError(
          res,
          new ValidationError([
            { field: 'taskIds', message: 'Task IDs array is required', code: 'REQUIRED' },
          ], 'Task IDs array is required')
        );
      }

      if (taskIds.length > 100) {
        return sendError(
          res,
          new ValidationError([
            { field: 'taskIds', message: 'Maximum 100 tasks can be updated at once', code: 'MAX_LIMIT' },
          ], 'Maximum 100 tasks can be updated at once')
        );
      }

      if (!updates || typeof updates !== 'object') {
        return sendError(
          res,
          new ValidationError([
            { field: 'updates', message: 'Updates object is required', code: 'REQUIRED' },
          ], 'Updates object is required')
        );
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
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update tasks'));
    }
  },

  [HttpMethod.DELETE]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return sendError(
          res,
          new ValidationError([
            { field: 'taskIds', message: 'Task IDs array is required', code: 'REQUIRED' },
          ], 'Task IDs array is required')
        );
      }

      if (taskIds.length > 100) {
        return sendError(
          res,
          new ValidationError([
            { field: 'taskIds', message: 'Maximum 100 tasks can be deleted at once', code: 'MAX_LIMIT' },
          ], 'Maximum 100 tasks can be deleted at once')
        );
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
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to delete tasks'));
    }
  },
});