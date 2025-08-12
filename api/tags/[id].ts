/**
 * Individual Tag API Route - Operations on specific tags
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTagDTO } from '../../lib/services/TagService';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!tagId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Tag ID is required', code: 'REQUIRED' },
          ], 'Tag ID is required')
        );
      }

      const tag = await tagService.findById(tagId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!tag) {
        return sendError(res, new NotFoundError('Tag'));
      }

      sendSuccess(res, tag);
    } catch (error) {
      console.error(`GET /api/tags/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to fetch tag'));
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!tagId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Tag ID is required', code: 'REQUIRED' },
          ], 'Tag ID is required')
        );
      }

      const updateData: UpdateTagDTO = req.body;
      
      const tag = await tagService.update(tagId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!tag) {
        return sendError(res, new NotFoundError('Tag'));
      }

      sendSuccess(res, tag);
    } catch (error) {
      console.error(`PUT /api/tags/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update tag'));
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!tagId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Tag ID is required', code: 'REQUIRED' },
          ], 'Tag ID is required')
        );
      }

      // Regular patch update
      const updateData: UpdateTagDTO = req.body;
      const result = await tagService.update(tagId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!result) {
        return sendError(res, new NotFoundError('Tag'));
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/tags/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update tag'));
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!tagId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Tag ID is required', code: 'REQUIRED' },
          ], 'Tag ID is required')
        );
      }

      const success = await tagService.delete(tagId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, new NotFoundError('Tag'));
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/tags/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to delete tag'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});