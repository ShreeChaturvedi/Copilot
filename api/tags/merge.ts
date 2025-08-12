/**
 * Tag Merge API Route - Merge multiple tags into one
 */
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { UnauthorizedError, ValidationError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { tag: tagService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      const { sourceTagIds, targetTagId } = req.body;

      if (!Array.isArray(sourceTagIds) || sourceTagIds.length === 0) {
        return sendError(
          res,
          new ValidationError([
            { field: 'sourceTagIds', message: 'Source tag IDs array is required', code: 'REQUIRED' },
          ], 'Source tag IDs array is required')
        );
      }

      if (!targetTagId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'targetTagId', message: 'Target tag ID is required', code: 'REQUIRED' },
          ], 'Target tag ID is required')
        );
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
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to merge tags'));
    }
  },
});