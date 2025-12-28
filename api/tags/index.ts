/**
 * Tags API Route - CRUD operations for tags
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type {
  CreateTagDTO,
  TagFilters,
  TagType,
} from '../../lib/services/TagService';
import {
  UnauthorizedError,
  ValidationError,
  InternalServerError,
} from '../../lib/types/api.js';

type PopularTagsContext = { userId: string; requestId?: string };
type PopularTagsService = {
  getPopularTags: (context: PopularTagsContext) => Promise<unknown>;
};

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      const {
        search,
        popular,
        type,
        color,
        unused,
        minUsageCount,
        withUsageCount,
        hasActiveTasks,
      } = req.query;

      let result;

      if (popular === 'true') {
        // Get popular tags (frequently used)
        const popularTagsService = tagService as Partial<PopularTagsService>;
        if (typeof popularTagsService.getPopularTags === 'function') {
          result = await popularTagsService.getPopularTags({
            userId,
            requestId: req.headers['x-request-id'] as string,
          });
        } else {
          // Fallback: list all tags
          result = await tagService.findAll(
            {},
            {
              userId,
              requestId: req.headers['x-request-id'] as string,
            }
          );
        }
      } else {
        // Build filters
        const filters: TagFilters = {};

        if (search) {
          filters.search = search as string;
        }
        if (type) {
          filters.type = type as TagType;
        }
        if (color) {
          filters.color = color as string;
        }
        if (unused !== undefined) {
          filters.unused = unused === 'true';
        }
        if (minUsageCount !== undefined) {
          const parsed = Number(minUsageCount);
          if (!Number.isNaN(parsed)) {
            filters.minUsageCount = parsed;
          }
        }
        if (withUsageCount === 'true') {
          filters.withUsageCount = true;
        }
        if (hasActiveTasks === 'true') {
          filters.hasActiveTasks = true;
        }

        result = await tagService.findAll(filters, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/tags error:', error);
      sendError(
        res,
        new InternalServerError(error.message || 'Failed to fetch tags')
      );
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(
          res,
          new UnauthorizedError('User authentication required')
        );
      }

      const tagData: CreateTagDTO = req.body;

      if (!tagData.name?.trim()) {
        return sendError(
          res,
          new ValidationError(
            [
              {
                field: 'name',
                message: 'Tag name is required',
                code: 'REQUIRED',
              },
            ],
            'Tag name is required'
          )
        );
      }

      if (!tagData.color) {
        return sendError(
          res,
          new ValidationError(
            [
              {
                field: 'color',
                message: 'Tag color is required',
                code: 'REQUIRED',
              },
            ],
            'Tag color is required'
          )
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
        return sendError(
          res,
          new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg)
        );
      }

      sendError(
        res,
        new InternalServerError(error.message || 'Failed to create tag')
      );
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});
