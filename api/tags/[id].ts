/**
 * Individual Tag API Route - Operations on specific tags
 */
import { createCrudHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';
import type { UpdateTagDTO } from '../../lib/services/TagService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!tagId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag ID is required',
        });
      }

      const tag = await tagService.findById(tagId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!tag) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      sendSuccess(res, tag);
    } catch (error) {
      console.error(`GET /api/tags/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to fetch tag',
      });
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!tagId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag ID is required',
        });
      }

      const updateData: UpdateTagDTO = req.body;
      
      const tag = await tagService.update(tagId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!tag) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      sendSuccess(res, tag);
    } catch (error) {
      console.error(`PUT /api/tags/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to update tag',
      });
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!tagId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag ID is required',
        });
      }

      // Regular patch update
      const updateData: UpdateTagDTO = req.body;
      const result = await tagService.update(tagId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!result) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/tags/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to update tag',
      });
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;
      const tagId = req.query.id as string;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      if (!tagId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Tag ID is required',
        });
      }

      const success = await tagService.delete(tagId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Tag not found',
        });
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/tags/${req.query.id} error:`, error);
      
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
        message: error.message || 'Failed to delete tag',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});