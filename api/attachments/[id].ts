/**
 * Individual Attachment API Route - Operations on specific attachments
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { UpdateAttachmentDTO } from '../../lib/services/AttachmentService';
import { UnauthorizedError, ValidationError, NotFoundError, ForbiddenError, InternalServerError } from '../../lib/types/api.js';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;
      const attachmentId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!attachmentId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Attachment ID is required', code: 'REQUIRED' },
          ], 'Attachment ID is required')
        );
      }

      const attachment = await attachmentService.findById(attachmentId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!attachment) {
        return sendError(res, new NotFoundError('Attachment'));
      }

      sendSuccess(res, attachment);
    } catch (error) {
      console.error(`GET /api/attachments/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to fetch attachment'));
    }
  },

  put: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;
      const attachmentId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!attachmentId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Attachment ID is required', code: 'REQUIRED' },
          ], 'Attachment ID is required')
        );
      }

      const updateData: UpdateAttachmentDTO = req.body;
      
      const attachment = await attachmentService.update(attachmentId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!attachment) {
        return sendError(res, new NotFoundError('Attachment'));
      }

      sendSuccess(res, attachment);
    } catch (error) {
      console.error(`PUT /api/attachments/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update attachment'));
    }
  },

  patch: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;
      const attachmentId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!attachmentId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Attachment ID is required', code: 'REQUIRED' },
          ], 'Attachment ID is required')
        );
      }

      // Regular patch update
      const updateData: UpdateAttachmentDTO = req.body;
      const result = await attachmentService.update(attachmentId, updateData, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!result) {
        return sendError(res, new NotFoundError('Attachment'));
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error(`PATCH /api/attachments/${req.query.id} error:`, error);
      
      if (error.message?.startsWith('VALIDATION_ERROR:')) {
        const msg = error.message.replace('VALIDATION_ERROR: ', '');
        return sendError(res, new ValidationError([{ message: msg, code: 'VALIDATION_ERROR' }], msg));
      }
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to update attachment'));
    }
  },

  delete: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;
      const attachmentId = req.query.id as string;

      if (!userId) {
        return sendError(res, new UnauthorizedError('User authentication required'));
      }

      if (!attachmentId) {
        return sendError(
          res,
          new ValidationError([
            { field: 'id', message: 'Attachment ID is required', code: 'REQUIRED' },
          ], 'Attachment ID is required')
        );
      }

      const success = await attachmentService.delete(attachmentId, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      if (!success) {
        return sendError(res, new NotFoundError('Attachment'));
      }

      sendSuccess(res, { deleted: true });
    } catch (error) {
      console.error(`DELETE /api/attachments/${req.query.id} error:`, error);
      
      if (error.message?.includes('AUTHORIZATION_ERROR')) {
        return sendError(res, new ForbiddenError('Access denied'));
      }

      sendError(res, new InternalServerError(error.message || 'Failed to delete attachment'));
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});