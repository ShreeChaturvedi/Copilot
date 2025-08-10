/**
 * Tasks API Route - CRUD operations for tasks
 */
import { createCrudHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';
import type { CreateTaskDTO, UpdateTaskDTO, TaskFilters } from '../../lib/services/TaskService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
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

      // Extract query parameters for filtering
      const {
        completed,
        taskListId,
        priority,
        search,
        overdue,
        scheduledDateFrom,
        scheduledDateTo,
        tags,
        sortBy,
        sortOrder,
        page = '1',
        limit = '20',
      } = req.query;

      // Build filters
      const filters: TaskFilters = {} as TaskFilters;
      
      if (completed !== undefined) {
        filters.completed = completed === 'true';
      }
      
      if (taskListId) {
        filters.taskListId = taskListId as string;
      }
      
      if (priority) {
        filters.priority = priority as any;
      }
      
      if (search) {
        filters.search = search as string;
      }
      
      if (overdue === 'true') {
        filters.overdue = true;
      }
      
      if (scheduledDateFrom || scheduledDateTo) {
        filters.scheduledDate = {};
        if (scheduledDateFrom) {
          filters.scheduledDate.from = new Date(scheduledDateFrom as string);
        }
        if (scheduledDateTo) {
          filters.scheduledDate.to = new Date(scheduledDateTo as string);
        }
      }
      
      if (tags) {
        const tagList = Array.isArray(tags) ? tags : [tags];
        filters.tags = tagList as string[];
      }

      // Sorting support via query params
      if (sortBy) {
        (filters as any).sortBy = sortBy as any;
      }
      if (sortOrder) {
        (filters as any).sortOrder = (sortOrder as string) === 'asc' ? 'asc' : 'desc';
      }

      // Get tasks with pagination if requested
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      
      let result;
      if (pageNum > 1 || limitNum !== 20) {
        result = await taskService.findPaginated(filters, pageNum, limitNum, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      } else {
        const tasks = await taskService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
        result = { data: tasks };
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/tasks error:', error);
      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch tasks',
      });
    }
  },
  
  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
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

      // Validate request body
      const taskData: CreateTaskDTO = req.body;
      
      if (!taskData.title?.trim()) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task title is required',
        });
      }

      // Create the task
      const task = await taskService.create(taskData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, task, 201);
    } catch (error) {
      console.error('POST /api/tasks error:', error);
      
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
        message: error.message || 'Failed to create task',
      });
    }
  },
  
  requireAuth: true,
  rateLimit: 'api',
});