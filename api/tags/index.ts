/**
 * Tags API Route - CRUD operations for tags
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateTagDTO, TagFilters } from '../../lib/services/TagService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const { search, popular } = req.query;

      let result;
      
      if (popular === 'true') {
        // Get popular tags (frequently used)
        result = await tagService.getPopularTags({
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
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
      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch tags',
      });
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const tagData: CreateTagDTO = req.body;
      
      if (!tagData.name?.trim()) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag name is required',
        });
      }

      if (!tagData.color) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag color is required',
        });
      }

      const tag = await tagService.create(tagData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, tag, 201);
    } catch (error) {
      console.error('POST /api/tags error:', error);
      
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
        message: error.message || 'Failed to create tag',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});