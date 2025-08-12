/**
 * Task Lists API Route - CRUD operations for task lists
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateTaskListDTO, TaskListFilters } from '../../lib/services/TaskListService';
import { UnauthorizedError, ValidationError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { search, withTaskCount } = req.query;

      let result;
      
      if (withTaskCount === 'true') {
        // Get task lists with task counts
        result = await taskListService.getWithTaskCount({
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      } else {
        // Build filters
        const filters: TaskListFilters = {};
        
        if (search) {
          filters.search = search as string;
        }

        result = await taskListService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/task-lists error:', error);
      sendError(res, new InternalServerError(error.message || 'Failed to fetch task lists'));
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const taskListData: CreateTaskListDTO = req.body;
      
      if (!taskListData.name?.trim()) {
        return sendError(
          res,
          new ValidationError([
            { field: 'name', message: 'Task list name is required', code: 'REQUIRED' },
          ], 'Task list name is required')
        );
      }

      if (!taskListData.color) {
        return sendError(
          res,
          new ValidationError([
            { field: 'color', message: 'Task list color is required', code: 'REQUIRED' },
          ], 'Task list color is required')
        );
      }

      const taskList = await taskListService.create(taskListData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, taskList, 201);
    } catch (error) {
      console.error('POST /api/task-lists error:', error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to create task list'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});