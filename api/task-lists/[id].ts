/**
 * Individual Task List API Route - Operations on specific task lists
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTaskListDTO } from '../../lib/services/TaskListService';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!taskListId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Task list ID is required', code: 'REQUIRED' },
          ], 'Task list ID is required')
        );
      }

      const taskList = await taskListService.findById(taskListId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!taskList) {
        return sendError(res, new NotFoundError('Task list'));
      }

      sendSuccess(res, taskList);
    } catch (error) {
      console.error(`GET /api/task-lists/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to fetch task list'));
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!taskListId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Task list ID is required', code: 'REQUIRED' },
          ], 'Task list ID is required')
        );
      }

      const updateData: UpdateTaskListDTO = req.body;
      
      const taskList = await taskListService.update(taskListId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!taskList) {
        return sendError(res, new NotFoundError('Task list'));
      }

      sendSuccess(res, taskList);
    } catch (error) {
      console.error(`PUT /api/task-lists/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied')); 
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update task list'));
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;
      const { action } = req.query;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!taskListId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Task list ID is required', code: 'REQUIRED' },
          ], 'Task list ID is required')
        );
      }

      let result;

      switch (action) {
        case 'set-default': {
          result = await taskListService.setDefault(taskListId, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
          break;
        }

        default: {
          // Regular patch update
          const updateData: UpdateTaskListDTO = req.body;
          result = await taskListService.update(taskListId, updateData, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        }
      }

      if (!result) {
        return sendError(res, new NotFoundError('Task list'));
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/task-lists/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update task list'));
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!taskListId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Task list ID is required', code: 'REQUIRED' },
          ], 'Task list ID is required')
        );
      }

      const success = await taskListService.delete(taskListId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, new NotFoundError('Task list'));
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/task-lists/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to delete task list'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});
