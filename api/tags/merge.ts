/**
 * Tag Merge API Route - Merge multiple tags into one
 */
import { createMethodHandler } from '../../lib/utils/apiHandler';
import { getAllServices } from '../../lib/services';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler';
import { HttpMethod } from '../../lib/types/api';
import type { AuthenticatedRequest } from '../../lib/types/api';
import type { VercelResponse } from '@vercel/node';

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
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

      const { sourceTagIds, targetTagId } = req.body;

      if (!Array.isArray(sourceTagIds) || sourceTagIds.length === 0) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Source tag IDs array is required',
        });
      }

      if (!targetTagId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Target tag ID is required',
        });
      }

      const result = await tagService.mergeTags(sourceTagIds, targetTagId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, {
        merged: true,
        targetTag: result,
        mergedCount: sourceTagIds.length,
      });
    } catch (error) {
      console.error('POST /api/tags/merge error:', error);
      
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
        message: error.message || 'Failed to merge tags',
      });
    }
  },
});