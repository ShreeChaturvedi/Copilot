/**
 * Attachment Service - Concrete implementation of BaseService for Attachment operations
 */
import type { PrismaClient, Attachment } from '@prisma/client';
import { BaseService, type ServiceContext, type BaseEntity } from './BaseService';

/**
 * Attachment entity interface extending base
 */
export interface AttachmentEntity extends BaseEntity {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  taskId: string;
  
  // Relations (optional for different query contexts)
  task?: {
    id: string;
    title: string;
    userId: string;
  };
}

/**
 * Attachment creation DTO
 */
export interface CreateAttachmentDTO {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  taskId: string;
}

/**
 * Attachment update DTO
 */
export interface UpdateAttachmentDTO {
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
}

/**
 * Attachment filters interface
 */
export interface AttachmentFilters {
  taskId?: string;
  fileType?: string;
  search?: string;
  userId?: string; // For filtering by task owner
  minSize?: number;
  maxSize?: number;
}

/**
 * File upload result interface
 */
export interface FileUploadResult {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
}

/**
 * Supported file types configuration
 */
export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_TASK = 20;

/**
 * AttachmentService - Handles all attachment-related operations
 */
export class AttachmentService extends BaseService<AttachmentEntity, CreateAttachmentDTO, UpdateAttachmentDTO, AttachmentFilters> {
  protected getModel() {
    return this.prisma.attachment;
  }

  protected getEntityName(): string {
    return 'Attachment';
  }

  protected buildWhereClause(filters: AttachmentFilters, context?: ServiceContext): any {
    const where: any = {};

    // Task filter
    if (filters.taskId) {
      where.taskId = filters.taskId;
    }

    // Filter by task owner (user)
    if (filters.userId) {
      where.task = {
        userId: filters.userId,
      };
    }

    // File type filter
    if (filters.fileType) {
      where.fileType = filters.fileType;
    }

    // Search filter (by filename)
    if (filters.search) {
      where.fileName = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // File size filters
    if (filters.minSize !== undefined || filters.maxSize !== undefined) {
      where.fileSize = {};
      if (filters.minSize !== undefined) {
        where.fileSize.gte = filters.minSize;
      }
      if (filters.maxSize !== undefined) {
        where.fileSize.lte = filters.maxSize;
      }
    }

    return where;
  }

  protected buildIncludeClause(): any {
    return {
      task: {
        select: {
          id: true,
          title: true,
          userId: true,
        },
      },
    };
  }

  /**
   * Validate attachment creation
   */
  protected async validateCreate(data: CreateAttachmentDTO, context?: ServiceContext): Promise<void> {
    if (!data.fileName?.trim()) {
      throw new Error('VALIDATION_ERROR: File name is required');
    }

    if (!data.fileUrl?.trim()) {
      throw new Error('VALIDATION_ERROR: File URL is required');
    }

    if (!data.fileType?.trim()) {
      throw new Error('VALIDATION_ERROR: File type is required');
    }

    if (!data.fileSize || data.fileSize <= 0) {
      throw new Error('VALIDATION_ERROR: Valid file size is required');
    }

    // Validate file size
    if (data.fileSize > MAX_FILE_SIZE) {
      throw new Error(`VALIDATION_ERROR: File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate file type
    const allSupportedTypes = [
      ...SUPPORTED_FILE_TYPES.images,
      ...SUPPORTED_FILE_TYPES.documents,
      ...SUPPORTED_FILE_TYPES.audio,
      ...SUPPORTED_FILE_TYPES.video,
      ...SUPPORTED_FILE_TYPES.archives,
    ];

    if (!allSupportedTypes.includes(data.fileType)) {
      throw new Error('VALIDATION_ERROR: Unsupported file type');
    }

    // Validate task exists and user has access
    if (context?.userId) {
      const task = await this.prisma.task.findFirst({
        where: {
          id: data.taskId,
          userId: context.userId,
        },
        include: {
          _count: {
            select: {
              attachments: true,
            },
          },
        },
      });

      if (!task) {
        throw new Error('VALIDATION_ERROR: Task not found or access denied');
      }

      // Check attachment limit per task
      if (task._count.attachments >= MAX_FILES_PER_TASK) {
        throw new Error(`VALIDATION_ERROR: Maximum ${MAX_FILES_PER_TASK} attachments per task allowed`);
      }
    }
  }

  /**
   * Validate attachment updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateAttachmentDTO,
    context?: ServiceContext
  ): Promise<void> {
    if (data.fileName !== undefined && !data.fileName?.trim()) {
      throw new Error('VALIDATION_ERROR: File name cannot be empty');
    }

    if (data.fileUrl !== undefined && !data.fileUrl?.trim()) {
      throw new Error('VALIDATION_ERROR: File URL cannot be empty');
    }

    if (data.fileSize !== undefined && data.fileSize <= 0) {
      throw new Error('VALIDATION_ERROR: Valid file size is required');
    }

    // Check if user has access to the attachment
    if (context?.userId) {
      const attachment = await this.getModel().findFirst({
        where: {
          id,
          task: {
            userId: context.userId,
          },
        },
      });

      if (!attachment) {
        throw new Error('AUTHORIZATION_ERROR: Attachment not found or access denied');
      }
    }

    // Validate file size if being updated
    if (data.fileSize && data.fileSize > MAX_FILE_SIZE) {
      throw new Error(`VALIDATION_ERROR: File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate file type if being updated
    if (data.fileType) {
      const allSupportedTypes = [
        ...SUPPORTED_FILE_TYPES.images,
        ...SUPPORTED_FILE_TYPES.documents,
        ...SUPPORTED_FILE_TYPES.audio,
        ...SUPPORTED_FILE_TYPES.video,
        ...SUPPORTED_FILE_TYPES.archives,
      ];

      if (!allSupportedTypes.includes(data.fileType)) {
        throw new Error('VALIDATION_ERROR: Unsupported file type');
      }
    }
  }

  /**
   * Get attachments for a specific task
   */
  async findByTask(taskId: string, context?: ServiceContext): Promise<AttachmentEntity[]> {
    const filters: AttachmentFilters = { taskId };
    return await this.findAll(filters, context);
  }

  /**
   * Get attachments by file type
   */
  async findByFileType(fileType: string, context?: ServiceContext): Promise<AttachmentEntity[]> {
    const filters: AttachmentFilters = { 
      fileType,
      userId: context?.userId,
    };
    return await this.findAll(filters, context);
  }

  /**
   * Get attachments by file category (images, documents, etc.)
   */
  async findByCategory(category: keyof typeof SUPPORTED_FILE_TYPES, context?: ServiceContext): Promise<AttachmentEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('findByCategory', { category }, context);

      const supportedTypes = SUPPORTED_FILE_TYPES[category];
      if (!supportedTypes) {
        throw new Error('VALIDATION_ERROR: Invalid file category');
      }

      const attachments = await this.getModel().findMany({
        where: {
          fileType: { in: supportedTypes },
          task: {
            userId: context.userId,
          },
        },
        include: this.buildIncludeClause(),
        orderBy: { createdAt: 'desc' },
      });

      this.log('findByCategory:success', { count: attachments.length }, context);
      return attachments.map((attachment) => this.transformEntity(attachment));
    } catch (error) {
      this.log('findByCategory:error', { error: error.message, category }, context);
      throw error;
    }
  }

  /**
   * Get user's storage usage statistics
   */
  async getStorageStats(context?: ServiceContext): Promise<{
    totalFiles: number;
    totalSize: number;
    totalSizeMB: number;
    averageFileSize: number;
    filesByType: Record<string, { count: number; size: number }>;
    largestFiles: AttachmentEntity[];
  }> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getStorageStats', {}, context);

      const attachments = await this.getModel().findMany({
        where: {
          task: {
            userId: context.userId,
          },
        },
        include: this.buildIncludeClause(),
        orderBy: { fileSize: 'desc' },
      });

      const totalFiles = attachments.length;
      const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);
      const totalSizeMB = Math.round((totalSize / 1024 / 1024) * 100) / 100;
      const averageFileSize = totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0;

      // Group by file type
      const filesByType: Record<string, { count: number; size: number }> = {};
      attachments.forEach((attachment) => {
        if (!filesByType[attachment.fileType]) {
          filesByType[attachment.fileType] = { count: 0, size: 0 };
        }
        filesByType[attachment.fileType].count++;
        filesByType[attachment.fileType].size += attachment.fileSize;
      });

      const largestFiles = attachments
        .slice(0, 10)
        .map((attachment) => this.transformEntity(attachment));

      const stats = {
        totalFiles,
        totalSize,
        totalSizeMB,
        averageFileSize,
        filesByType,
        largestFiles,
      };

      this.log('getStorageStats:success', { totalFiles, totalSizeMB }, context);
      return stats;
    } catch (error) {
      this.log('getStorageStats:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Delete attachment and clean up file
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    try {
      this.log('delete', { id }, context);

      // Get attachment details first
      const attachment = await this.getModel().findFirst({
        where: {
          id,
          task: {
            userId: context?.userId,
          },
        },
        include: this.buildIncludeClause(),
      });

      if (!attachment) {
        throw new Error('AUTHORIZATION_ERROR: Attachment not found or access denied');
      }

      // Delete from database
      await this.getModel().delete({
        where: { id },
      });

      // TODO: Delete file from storage (Vercel Blob, S3, etc.)
      // This would require implementing file storage cleanup
      // await this.deleteFileFromStorage(attachment.fileUrl);

      this.log('delete:success', { id, fileName: attachment.fileName }, context);
      return true;
    } catch (error) {
      this.log('delete:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Bulk delete attachments
   */
  async bulkDelete(ids: string[], context?: ServiceContext): Promise<{ deletedCount: number }> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('bulkDelete', { ids }, context);

      // Get attachments to verify ownership
      const attachments = await this.getModel().findMany({
        where: {
          id: { in: ids },
          task: {
            userId: context.userId,
          },
        },
      });

      if (attachments.length !== ids.length) {
        throw new Error('AUTHORIZATION_ERROR: Some attachments not found or access denied');
      }

      // Delete from database
      const result = await this.getModel().deleteMany({
        where: {
          id: { in: ids },
        },
      });

      // TODO: Delete files from storage
      // for (const attachment of attachments) {
      //   await this.deleteFileFromStorage(attachment.fileUrl);
      // }

      this.log('bulkDelete:success', { deletedCount: result.count }, context);
      return { deletedCount: result.count };
    } catch (error) {
      this.log('bulkDelete:error', { error: error.message, ids }, context);
      throw error;
    }
  }

  /**
   * Generate secure download URL (if needed for private files)
   */
  async getDownloadUrl(id: string, context?: ServiceContext): Promise<string> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('getDownloadUrl', { id }, context);

      const attachment = await this.getModel().findFirst({
        where: {
          id,
          task: {
            userId: context.userId,
          },
        },
      });

      if (!attachment) {
        throw new Error('AUTHORIZATION_ERROR: Attachment not found or access denied');
      }

      // For now, return the stored URL directly
      // In production, you might generate time-limited signed URLs
      const downloadUrl = attachment.fileUrl;

      this.log('getDownloadUrl:success', { id }, context);
      return downloadUrl;
    } catch (error) {
      this.log('getDownloadUrl:error', { error: error.message, id }, context);
      throw error;
    }
  }

  /**
   * Check if file type is supported
   */
  static isSupportedFileType(fileType: string): boolean {
    const allSupportedTypes = [
      ...SUPPORTED_FILE_TYPES.images,
      ...SUPPORTED_FILE_TYPES.documents,
      ...SUPPORTED_FILE_TYPES.audio,
      ...SUPPORTED_FILE_TYPES.video,
      ...SUPPORTED_FILE_TYPES.archives,
    ];
    return allSupportedTypes.includes(fileType);
  }

  /**
   * Get file category from file type
   */
  static getFileCategory(fileType: string): keyof typeof SUPPORTED_FILE_TYPES | null {
    for (const [category, types] of Object.entries(SUPPORTED_FILE_TYPES)) {
      if (types.includes(fileType)) {
        return category as keyof typeof SUPPORTED_FILE_TYPES;
      }
    }
    return null;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clean up orphaned attachments (attachments with no associated task)
   */
  async cleanupOrphanedAttachments(context?: ServiceContext): Promise<{ deletedCount: number }> {
    try {
      this.log('cleanupOrphanedAttachments', {}, context);

      const orphanedAttachments = await this.getModel().findMany({
        where: {
          task: null,
        },
        select: { id: true, fileUrl: true },
      });

      if (orphanedAttachments.length > 0) {
        const orphanedIds = orphanedAttachments.map((att) => att.id);
        
        await this.getModel().deleteMany({
          where: {
            id: { in: orphanedIds },
          },
        });

        // TODO: Clean up files from storage
        // for (const attachment of orphanedAttachments) {
        //   await this.deleteFileFromStorage(attachment.fileUrl);
        // }
      }

      this.log('cleanupOrphanedAttachments:success', { deletedCount: orphanedAttachments.length }, context);
      return { deletedCount: orphanedAttachments.length };
    } catch (error) {
      this.log('cleanupOrphanedAttachments:error', { error: error.message }, context);
      throw error;
    }
  }

  /**
   * Private method to delete file from storage
   * TODO: Implement based on storage provider (Vercel Blob, S3, etc.)
   */
  private async deleteFileFromStorage(fileUrl: string): Promise<void> {
    // Placeholder for file storage cleanup
    // Implementation depends on storage provider
    this.log('deleteFileFromStorage', { fileUrl });
  }
}