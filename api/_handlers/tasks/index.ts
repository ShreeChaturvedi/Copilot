/**
 * Tasks API Route - CRUD operations for tasks
 */
import { createCrudHandler } from '../../../lib/utils/apiHandler.js';
import { getAllServices } from '../../../lib/services/index.js';
import {
  sendSuccess,
  sendError,
} from '../../../lib/middleware/errorHandler.js';
import {
  UnauthorizedError,
  ValidationError,
  InternalServerError,
} from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type {
  CreateTaskDTO,
  TaskFilters,
} from '../../../lib/services/TaskService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
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
        limit,
      } = req.query;

      // Build filters
      const filters: TaskFilters = {};

      if (completed !== undefined) {
        filters.completed = completed === 'true';
      }

      if (taskListId) {
        filters.taskListId = taskListId as string;
      }

      if (priority) {
        const p = String(priority).toUpperCase();
        if (p === 'LOW' || p === 'MEDIUM' || p === 'HIGH') {
          // Backend enum uses DB form
          filters.priority = p as TaskFilters['priority'];
        }
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
        filters.sortBy = sortBy as TaskFilters['sortBy'];
      }
      if (sortOrder) {
        filters.sortOrder = (sortOrder as string) === 'asc' ? 'asc' : 'desc';
      }

      // Always take the paginated path so the response has one stable shape
      // (bare array in `data`, pagination in `meta`) and a hard upper bound.
      // Parse defensively: a bad value like `?limit=abc` must not reach SQL as
      // `LIMIT NaN`. The default cap (500) preserves the app's current
      // "load everything" behavior for typical accounts while bounding runaway
      // ones. Clamp page to >=1 and limit to [1, 500].
      const rawLimit = parseInt(String(limit), 10);
      const limitNum = Math.min(
        Math.max(Number.isFinite(rawLimit) ? rawLimit : 500, 1),
        500
      );
      const rawPage = parseInt(String(page), 10);
      const pageNum = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);

      const { data, pagination } = await taskService.findPaginated(
        filters,
        pageNum,
        limitNum,
        {
          userId,
          requestId: req.headers['x-request-id'] as string,
        }
      );

      sendSuccess(res, data, 200, { pagination });
    } catch (error) {
      console.error('GET /api/tasks error:', error);
      sendError(res, new InternalServerError('Failed to fetch tasks'));
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { task: taskService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      // Validate request body
      const taskData: CreateTaskDTO = req.body;

      if (!taskData.title?.trim()) {
        return sendError(
          res,
          new ValidationError(
            [
              {
                field: 'title',
                message: 'Task title is required',
                code: 'REQUIRED',
              },
            ],
            'Task title is required'
          )
        );
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
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(
          res,
          new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg)
        );
      }

      sendError(res, new InternalServerError('Failed to create task'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});
