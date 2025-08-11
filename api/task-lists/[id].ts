/**
 * Individual Task List API Route - Operations on specific task lists
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTaskListDTO } from '../../lib/services/TaskListService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!taskListId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task list ID is required',
        });
      }

      const taskList = await taskListService.findById(taskListId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!taskList) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Task list not found',
        });
      }

      sendSuccess(res, taskList);
    } catch (error) {
      console.error(`GET /api/task-lists/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      sendSuccess(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch task list',
      });
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!taskListId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task list ID is required',
        });
      }

      const updateData: UpdateTaskListDTO = req.body;
      
      const taskList = await taskListService.update(taskListId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!taskList) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Task list not found',
        });
      }

      sendSuccess(res, taskList);
    } catch (error) {
      console.error(`PUT /api/task-lists/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to update task list',
      });
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;
      const { action } = req.query;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!taskListId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task list ID is required',
        });
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
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Task list not found',
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/task-lists/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to update task list',
      });
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { taskList: taskListService } = getAllServices();
      const userId = req.user?.id;
      const taskListId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!taskListId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task list ID is required',
        });
      }

      const success = await taskListService.delete(taskListId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Task list not found',
        });
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/task-lists/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to delete task list',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});