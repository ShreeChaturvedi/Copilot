/**
 * Attachments API Route - CRUD operations for attachments
 */
import { createCrudHandler } from '../../lib/utils/apiHandler.js';
import { getAllServices } from '../../lib/services/index.js';
import { sendSuccess, sendError } from '../../lib/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import type { CreateAttachmentDTO, AttachmentFilters } from '../../lib/services/AttachmentService';

export default createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const {
        taskId,
        category,
        search,
        limit = '50',
        offset = '0',
        fileType,
        // reserved for future use
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        minSize,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        maxSize,
      } = req.query;

      // Build filters
      const filters: AttachmentFilters = {};
      
      if (taskId) {
        filters.taskId = taskId as string;
      }
      
      // fileType filter (exact MIME type)
      if (fileType) {
        filters.fileType = fileType as string;
      }
      
      if (search) {
        filters.search = search as string;
      }

      const options = {
        limit: Math.min(parseInt(limit as string) || 50, 100), // Max 100
        offset: parseInt(offset as string) || 0,
      };

      let result;

      if (category) {
        // Get attachments by category for current user (images, documents, audio, video)
        result = await attachmentService.findByCategory(
          category as keyof typeof import('../../lib/services/AttachmentService').SUPPORTED_FILE_TYPES,
          {
            userId,
            requestId: req.headers['x-request-id'] as string,
          }
        );
      } else {
        // Regular findAll with filters and pagination
        result = await attachmentService.findAll({ ...filters, ...options }, {
          userId,
          requestId: req.headers['x-request-id'] as string,
        });
      }

      sendSuccess(res, result);
    } catch (error) {
      console.error('GET /api/attachments error:', error);
      sendError(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch attachments',
      });
    }
  },

  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { attachment: attachmentService } = getAllServices();
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        });
      }

      const attachmentData: Partial<CreateAttachmentDTO> = req.body;

      if (!attachmentData.fileName?.trim()) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'File name is required',
        });
      }

      if (!attachmentData.fileType) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'File type is required',
        });
      }

      if (!attachmentData.taskId) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Task ID is required',
        });
      }

      if (typeof attachmentData.fileSize !== 'number' || attachmentData.fileSize <= 0) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Valid file size is required',
        });
      }

      if (!attachmentData.fileUrl?.trim()) {
        return sendError(res, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'File URL is required',
        });
      }

      const createPayload: CreateAttachmentDTO = {
        fileName: attachmentData.fileName!,
        fileUrl: attachmentData.fileUrl!,
        fileType: attachmentData.fileType!,
        fileSize: attachmentData.fileSize!,
        taskId: attachmentData.taskId!,
      };

      const attachment = await attachmentService.create(createPayload, {
        userId,
        requestId: req.headers['x-request-id'] as string,
      });

      sendSuccess(res, attachment, 201);
    } catch (error) {
      console.error('POST /api/attachments error:', error);
      
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
        message: error.message || 'Failed to create attachment',
      });
    }
  },

  requireAuth: true,
  rateLimit: 'api',
});