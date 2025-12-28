/**
 * Individual Task API Route - Operations on specific tasks
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTaskDTO } from '../../lib/services/TaskService';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalServerError,
} from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;
      const taskId = req.query.id as string;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      if (!taskId) {
        return sendError(
          res,
          new ValidationError(
            [{ field: 'id', message: 'Task ID is required', code: 'REQUIRED' }],
            'Task ID is required'
          )
        );
      }

      const task = await taskService.findById(taskId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!task) {
        return sendError(res, new NotFoundError('Task'));
      }

      sendSuccess(res, task);
    } catch (error) {
      console.error(`GET /api/tasks/${req.query.id} error:`, error);

      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(
        res,
        new InternalServerError(error.message || 'Failed to fetch task')
      );
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;
      const taskId = req.query.id as string;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      if (!taskId) {
        return sendError(
          res,
          new ValidationError(
            [{ field: 'id', message: 'Task ID is required', code: 'REQUIRED' }],
            'Task ID is required'
          )
        );
      }

      const updateData: UpdateTaskDTO = req.body;

      const task = await taskService.update(taskId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!task) {
        return sendError(res, new NotFoundError('Task'));
      }

      sendSuccess(res, task);
    } catch (error) {
      console.error(`PUT /api/tasks/${req.query.id} error:`, error);

      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(
          res,
          new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg)
        );
      }

      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(
        res,
        new InternalServerError(error.message || 'Failed to update task')
      );
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;
      const taskId = req.query.id as string;
      const { action } = req.query;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      if (!taskId) {
        return sendError(
          res,
          new ValidationError(
            [{ field: 'id', message: 'Task ID is required', code: 'REQUIRED' }],
            'Task ID is required'
          )
        );
      }

      let result;

      switch (action) {
        case 'toggle': {
          // Toggle completion status
          result = await taskService.toggleCompletion(taskId, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
          break;
        }

        default: {
          // Regular patch update
          const updateData: UpdateTaskDTO = req.body;
          // Normalize status/checkbox linkage: if status provided without explicit completed,
          // map DONE->completed true; others->completed false
          if (updateData.status && updateData.completed === undefined) {
            updateData.completed = updateData.status === 'DONE';
          }
          result = await taskService.update(taskId, updateData, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        }
      }

      if (!result) {
        return sendError(res, new NotFoundError('Task'));
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/tasks/${req.query.id} error:`, error);

      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(
          res,
          new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg)
        );
      }

      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(
        res,
        new InternalServerError(error.message || 'Failed to update task')
      );
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;
      const taskId = req.query.id as string;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      if (!taskId) {
        return sendError(
          res,
          new ValidationError(
            [{ field: 'id', message: 'Task ID is required', code: 'REQUIRED' }],
            'Task ID is required'
          )
        );
      }

      const success = await taskService.delete(taskId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, new NotFoundError('Task'));
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/tasks/${req.query.id} error:`, error);

      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(
        res,
        new InternalServerError(error.message || 'Failed to delete task')
      );
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});
