/**
 * Tags API Route - CRUD operations for tags
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateTagDTO, TagFilters } from '../../lib/services/TagService';
import { UnauthorizedError, ValidationError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { search, popular } = req.query;

      let result;
      
      if (popular === 'true') {
        // Get popular tags (frequently used)
        if (typeof (tagService as any).getPopularTags === 'function') {
          result = await (tagService as any).getPopularTags({
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        } else {
          // Fallback: list all tags
          result = await tagService.findAll({}, {
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        }
      } else {
        // Build filters
        const filters: TagFilters = {};
        
        if (search) {
          filters.search = search as string;
        }

        result = await tagService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/tags error:', error);
      sendError(res, new InternalServerError(error.message || 'Failed to fetch tags'));
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const tagData: CreateTagDTO = req.body;
      
      if (!tagData.name?.trim()) {
        return sendError(
          res,
          new ValidationError([
            { field: 'name', message: 'Tag name is required', code: 'REQUIRED' },
          ], 'Tag name is required')
        );
      }

      if (!tagData.color) {
        return sendError(
          res,
          new ValidationError([
            { field: 'color', message: 'Tag color is required', code: 'REQUIRED' },
          ], 'Tag color is required')
        );
      }

      const tag = await tagService.create(tagData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, tag, 201);
    } catch (error) {
      console.error('POST /api/tags error:', error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to create tag'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});