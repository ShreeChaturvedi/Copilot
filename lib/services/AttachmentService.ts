/**
 * Attachment Service - Concrete implementation of BaseService for Attachment operations
 */
// PrismaClient type is not directly referenced in this file
import { BaseService, type ServiceContext, type BaseEntity } from './BaseService.js';
import { query } from '../config/database.js';

/**
 * Attachment entity interface extending base
 */
export interface AttachmentEntity extends BaseEntity {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  taskId: string;
  createdAt: Date;
  updatedAt: Date;
  
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
  protected getTableName(): string { return 'attachments'; }

  protected getEntityName(): string {
    return 'Attachment';
  }

  protected buildWhereClause(filters: AttachmentFilters, _context?: ServiceContext): { sql: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filters.taskId) { params.push(filters.taskId); clauses.push('"taskId" = $' + params.length); }
    if (filters.userId) { params.push(filters.userId); clauses.push('EXISTS (SELECT 1 FROM tasks t WHERE t.id = attachments."taskId" AND t."userId" = $' + params.length + ')'); }
    if (filters.fileType) { params.push(filters.fileType); clauses.push('"fileType" = $' + params.length); }
    if (filters.search) { params.push('%' + filters.search + '%'); clauses.push('"fileName" ILIKE $' + params.length); }
    if (filters.minSize !== undefined) { params.push(filters.minSize); clauses.push('"fileSize" >= $' + params.length); }
    if (filters.maxSize !== undefined) { params.push(filters.maxSize); clauses.push('"fileSize" <= $' + params.length); }
    const sql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  protected async enrichEntities(entities: AttachmentEntity[], _context?: ServiceContext): Promise<AttachmentEntity[]> {
    if (!entities.length) return entities;
    const taskIds = Array.from(new Set(entities.map((e) => e.taskId)));
    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await query('SELECT id, title, "userId" FROM tasks WHERE id IN (' + placeholders + ')', taskIds, this.db);
    const map = new Map<string, any>();
    res.rows.forEach((r: any) => map.set(r.id, r));
    return entities.map((e) => ({ ...e, task: map.get(e.taskId) }));
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
      const task = await query('SELECT id, (SELECT COUNT(*) FROM attachments a WHERE a."taskId" = tasks.id) AS cnt FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1', [data.taskId, context.userId], this.db);
      if (task.rowCount === 0) {
        throw new Error('VALIDATION_ERROR: Task not found or access denied');
      }
      const cnt = Number((task.rows[0] as any).cnt || 0);
      if (cnt >= MAX_FILES_PER_TASK) throw new Error(`VALIDATION_ERROR: Maximum ${MAX_FILES_PER_TASK} attachments per task allowed`);
    }
  }

  /**
   * Validate attachment updates
   */
  protected async validateUpdate(
    id: string,
    data: UpdateAttachmentDTO,
    _context?: ServiceContext
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
    if (_context?.userId) {
      const attachment = await query('SELECT a.id FROM attachments a JOIN tasks t ON t.id = a."taskId" WHERE a.id = $1 AND t."userId" = $2 LIMIT 1', [id, _context.userId], this.db);
      if (attachment.rowCount === 0) throw new Error('AUTHORIZATION_ERROR: Attachment not found or access denied');
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

      const placeholders = supportedTypes.map((_, i) => `$${i + 1}`).join(',');
      const res = await query(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a."fileType" IN (${placeholders}) AND t."userId" = $${supportedTypes.length + 1}
         ORDER BY a."createdAt" DESC`,
        [...supportedTypes, context.userId!],
        this.db
      );
      this.log('findByCategory:success', { count: res.rowCount }, context);
      const base = res.rows.map((r: any) => this.transformEntity(r));
      return await this.enrichEntities(base, context);
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

      const attachmentsRes = await query(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE t."userId" = $1
         ORDER BY a."fileSize" DESC`,
        [context.userId!],
        this.db
      );

      const attachments = attachmentsRes.rows as any[];
      const totalFiles = attachments.length;
      const totalSize = attachments.reduce((sum, att) => sum + Number(att.fileSize), 0);
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

      const largestFiles = attachments.slice(0, 10).map((attachment) => this.transformEntity(attachment));

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
      const attachmentRes = await query(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a.id = $1 AND t."userId" = $2 LIMIT 1`,
        [id, context?.userId!],
        this.db
      );
      const attachment = attachmentRes.rows[0];

      if (!attachment) {
        throw new Error('AUTHORIZATION_ERROR: Attachment not found or access denied');
      }

      // Delete from database
      await query('DELETE FROM attachments WHERE id = $1', [id], this.db);

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
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const attachments = await query(
        `SELECT a.id, t."userId" FROM attachments a JOIN tasks t ON t.id = a."taskId" WHERE a.id IN (${placeholders}) AND t."userId" = $${ids.length + 1}`,
        [...ids, context.userId!],
        this.db
      );

      if (attachments.rowCount !== ids.length) {
        throw new Error('AUTHORIZATION_ERROR: Some attachments not found or access denied');
      }

      // Delete from database
      const result = await query('DELETE FROM attachments WHERE id = ANY($1::text[])', [ids], this.db);

      // TODO: Delete files from storage
      // for (const attachment of attachments) {
      //   await this.deleteFileFromStorage(attachment.fileUrl);
      // }

      this.log('bulkDelete:success', { deletedCount: result.count }, context);
      return { deletedCount: result.rowCount ?? 0 };
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

      const attachmentRes = await query(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a.id = $1 AND t."userId" = $2 LIMIT 1`,
        [id, context.userId!],
        this.db
      );
      const attachment = attachmentRes.rows[0];

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

      const orphanedRes = await query<{ id: string; fileUrl: string }>(
        `SELECT a.id, a."fileUrl" FROM attachments a
         LEFT JOIN tasks t ON t.id = a."taskId"
         WHERE t.id IS NULL`,
        [],
        this.db
      );

      if (orphanedRes.rowCount > 0) {
        const orphanedIds = orphanedRes.rows.map((att) => att.id);
        await query('DELETE FROM attachments WHERE id = ANY($1::text[])', [orphanedIds], this.db);

        // TODO: Clean up files from storage
        // for (const attachment of orphanedAttachments) {
        //   await this.deleteFileFromStorage(attachment.fileUrl);
        // }
      }

      this.log('cleanupOrphanedAttachments:success', { deletedCount: orphanedRes.rowCount }, context);
      return { deletedCount: orphanedRes.rowCount };
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