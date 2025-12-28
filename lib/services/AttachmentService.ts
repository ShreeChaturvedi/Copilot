/**
 * Attachment Service - Concrete implementation of BaseService for Attachment operations
 */
// PrismaClient type is not directly referenced in this file
import {
  BaseService,
  type BaseServiceConfig,
  type ServiceContext,
  type BaseEntity,
} from './BaseService.js';
import { query, type SqlClient } from '../config/database.js';

/**
 * Attachment entity interface extending base
 */
export interface AttachmentEntity extends BaseEntity {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  taskId: string;
  thumbnailUrl?: string | null;
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
  thumbnailUrl?: string;
}

/**
 * Attachment update DTO
 */
export interface UpdateAttachmentDTO {
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  thumbnailUrl?: string | null;
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
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
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
    // Align with shared frontend config
    'text/markdown',
    'application/json',
    'text/html',
    'text/css',
    'text/javascript',
    'application/x-typescript',
    'application/x-sh',
    'text/x-java-source',
    'text/x-python',
    'text/x-csrc',
    'text/x-c++src',
    'text/x-go',
    'text/x-kotlin',
    'text/x-ruby',
    'text/x-php',
    'text/x-scss',
  ],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  archives: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ],
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILES_PER_TASK = 20;

/**
 * AttachmentService - Handles all attachment-related operations
 */
export class AttachmentService extends BaseService<
  AttachmentEntity,
  CreateAttachmentDTO,
  UpdateAttachmentDTO,
  AttachmentFilters
> {
  private static schemaEnsured = false;

  constructor(
    dbOrConfig?: SqlClient | BaseServiceConfig,
    maybeConfig?: BaseServiceConfig
  ) {
    super(dbOrConfig, maybeConfig);
    void this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    if (AttachmentService.schemaEnsured) return;
    try {
      await query(
        'ALTER TABLE attachments ADD COLUMN IF NOT EXISTS "thumbnailUrl" text',
        [],
        this.db
      );
      AttachmentService.schemaEnsured = true;
    } catch {
      // ignore
    }
  }
  protected getTableName(): string {
    return 'attachments';
  }

  protected getEntityName(): string {
    return 'Attachment';
  }

  protected buildWhereClause(
    filters: AttachmentFilters,
    _context?: ServiceContext
  ): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.taskId) {
      params.push(filters.taskId);
      clauses.push('"taskId" = $' + params.length);
    }
    if (filters.userId) {
      params.push(filters.userId);
      clauses.push(
        'EXISTS (SELECT 1 FROM tasks t WHERE t.id = attachments."taskId" AND t."userId" = $' +
          params.length +
          ')'
      );
    }
    if (filters.fileType) {
      params.push(filters.fileType);
      clauses.push('"fileType" = $' + params.length);
    }
    if (filters.search) {
      params.push('%' + filters.search + '%');
      clauses.push('"fileName" ILIKE $' + params.length);
    }
    if (filters.minSize !== undefined) {
      params.push(filters.minSize);
      clauses.push('"fileSize" >= $' + params.length);
    }
    if (filters.maxSize !== undefined) {
      params.push(filters.maxSize);
      clauses.push('"fileSize" <= $' + params.length);
    }
    const sql = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { sql, params };
  }

  protected async enrichEntities(
    entities: AttachmentEntity[],
    _context?: ServiceContext
  ): Promise<AttachmentEntity[]> {
    if (!entities.length) return entities;
    const taskIds = Array.from(new Set(entities.map((e) => e.taskId)));
    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(',');
    type TaskSummary = { id: string; title: string; userId: string };
    const res = await query<TaskSummary>(
      'SELECT id, title, "userId" FROM tasks WHERE id IN (' +
        placeholders +
        ')',
      taskIds,
      this.db
    );
    const map = new Map<string, TaskSummary>();
    res.rows.forEach((row) => map.set(row.id, row));
    return entities.map((e) => ({ ...e, task: map.get(e.taskId) }));
  }

  /**
   * Find attachments with optional filters and simple pagination
   */
  async findAll(
    filters: AttachmentFilters & { limit?: number; offset?: number } = {},
    context?: ServiceContext
  ): Promise<AttachmentEntity[]> {
    try {
      const { sql, params } = this.buildWhereClause(
        {
          ...filters,
          userId: context?.userId,
        },
        context
      );
      let querySql = `SELECT * FROM attachments ${sql} ORDER BY "createdAt" DESC`;
      const finalParams = [...params];
      if (typeof filters.limit === 'number') {
        querySql += ` LIMIT $${finalParams.length + 1}`;
        finalParams.push(Math.max(0, Math.min(100, filters.limit)));
      }
      if (typeof filters.offset === 'number') {
        querySql += ` OFFSET $${finalParams.length + 1}`;
        finalParams.push(Math.max(0, filters.offset));
      }
      const res = await query<AttachmentEntity>(querySql, finalParams, this.db);
      const base = res.rows.map((row) => this.transformEntity(row));
      return await this.enrichEntities(base, context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findAll:error', { error: message, filters }, context);
      throw error;
    }
  }

  /**
   * Create a new attachment row (supports optional thumbnailUrl)
   */
  async create(
    data: CreateAttachmentDTO,
    context?: ServiceContext
  ): Promise<AttachmentEntity> {
    try {
      this.log('create', { data }, context);
      await this.validateCreate(data, context);
      await this.ensureUserExists(context?.userId, 'dev@example.com');

      if (context?.userId) {
        const taskCheck = await query(
          'SELECT 1 FROM tasks WHERE id = $1 AND "userId" = $2',
          [data.taskId, context.userId],
          this.db
        );
        if (taskCheck.rowCount === 0) {
          throw new Error(
            'AUTHORIZATION_ERROR: Task not found or access denied'
          );
        }
      }

      const insertRes = await query(
        `INSERT INTO attachments (id, "fileName", "fileUrl", "fileType", "fileSize", "taskId", "thumbnailUrl", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [
          data.fileName.trim(),
          data.fileUrl.trim(),
          data.fileType.trim(),
          data.fileSize,
          data.taskId,
          data.thumbnailUrl ?? null,
        ],
        this.db
      );

      const created = this.transformEntity(insertRes.rows[0]);
      this.log('create:success', { id: created.id }, context);
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('create:error', { error: message }, context);
      throw error;
    }
  }

  /**
   * Update allowed fields for an attachment
   */
  async update(
    id: string,
    data: UpdateAttachmentDTO,
    context?: ServiceContext
  ): Promise<AttachmentEntity | null> {
    try {
      this.log('update', { id, data }, context);
      await this.validateUpdate(id, data, context);

      const sets: string[] = [];
      const params: unknown[] = [];
      if (data.fileName !== undefined) {
        params.push(data.fileName.trim());
        sets.push(`"fileName" = $${params.length}`);
      }
      if (data.fileUrl !== undefined) {
        params.push(data.fileUrl.trim());
        sets.push(`"fileUrl" = $${params.length}`);
      }
      if (data.fileType !== undefined) {
        params.push(data.fileType.trim());
        sets.push(`"fileType" = $${params.length}`);
      }
      if (data.fileSize !== undefined) {
        params.push(data.fileSize);
        sets.push(`"fileSize" = $${params.length}`);
      }
      if (data.thumbnailUrl !== undefined) {
        params.push(data.thumbnailUrl);
        sets.push(`"thumbnailUrl" = $${params.length}`);
      }
      if (sets.length === 0) return await this.findById(id, context);
      params.push(id);
      const res = await query<AttachmentEntity>(
        `UPDATE attachments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
        this.db
      );
      const row = res.rows[0];
      return row ? this.transformEntity(row) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('update:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Validate attachment creation
   */
  protected async validateCreate(
    data: CreateAttachmentDTO,
    context?: ServiceContext
  ): Promise<void> {
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
      throw new Error(
        `VALIDATION_ERROR: File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
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
      const task = await query<{ id: string; cnt: string }>(
        'SELECT id, (SELECT COUNT(*) FROM attachments a WHERE a."taskId" = tasks.id) AS cnt FROM tasks WHERE id = $1 AND "userId" = $2 LIMIT 1',
        [data.taskId, context.userId],
        this.db
      );
      if (task.rowCount === 0) {
        throw new Error('VALIDATION_ERROR: Task not found or access denied');
      }
      const cnt = Number(task.rows[0]?.cnt || 0);
      if (cnt >= MAX_FILES_PER_TASK)
        throw new Error(
          `VALIDATION_ERROR: Maximum ${MAX_FILES_PER_TASK} attachments per task allowed`
        );
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
      const attachment = await query(
        'SELECT a.id FROM attachments a JOIN tasks t ON t.id = a."taskId" WHERE a.id = $1 AND t."userId" = $2 LIMIT 1',
        [id, _context.userId],
        this.db
      );
      if (attachment.rowCount === 0)
        throw new Error(
          'AUTHORIZATION_ERROR: Attachment not found or access denied'
        );
    }

    // Validate file size if being updated
    if (data.fileSize && data.fileSize > MAX_FILE_SIZE) {
      throw new Error(
        `VALIDATION_ERROR: File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
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
  async findByTask(
    taskId: string,
    context?: ServiceContext
  ): Promise<AttachmentEntity[]> {
    const filters: AttachmentFilters = { taskId };
    return await this.findAll(filters, context);
  }

  /**
   * Get attachments by file type
   */
  async findByFileType(
    fileType: string,
    context?: ServiceContext
  ): Promise<AttachmentEntity[]> {
    const filters: AttachmentFilters = {
      fileType,
      userId: context?.userId,
    };
    return await this.findAll(filters, context);
  }

  /**
   * Get attachments by file category (images, documents, etc.)
   */
  async findByCategory(
    category: keyof typeof SUPPORTED_FILE_TYPES,
    context?: ServiceContext
  ): Promise<AttachmentEntity[]> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }
    const userId = context.userId;

    try {
      this.log('findByCategory', { category }, context);

      const supportedTypes = SUPPORTED_FILE_TYPES[category];
      if (!supportedTypes) {
        throw new Error('VALIDATION_ERROR: Invalid file category');
      }

      const placeholders = supportedTypes.map((_, i) => `$${i + 1}`).join(',');
      const res = await query<AttachmentEntity>(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a."fileType" IN (${placeholders}) AND t."userId" = $${supportedTypes.length + 1}
         ORDER BY a."createdAt" DESC`,
        [...supportedTypes, userId],
        this.db
      );
      this.log('findByCategory:success', { count: res.rowCount }, context);
      const base = res.rows.map((row) => this.transformEntity(row));
      return await this.enrichEntities(base, context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('findByCategory:error', { error: message, category }, context);
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
    const userId = context.userId;

    try {
      this.log('getStorageStats', {}, context);

      const attachmentsRes = await query<AttachmentEntity>(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE t."userId" = $1
         ORDER BY a."fileSize" DESC`,
        [userId],
        this.db
      );

      const attachments = attachmentsRes.rows;
      const totalFiles = attachments.length;
      const totalSize = attachments.reduce(
        (sum, att) => sum + Number(att.fileSize),
        0
      );
      const totalSizeMB = Math.round((totalSize / 1024 / 1024) * 100) / 100;
      const averageFileSize =
        totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0;

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('getStorageStats:error', { error: message }, context);
      throw error;
    }
  }

  /**
   * Delete attachment and clean up file
   */
  async delete(id: string, context?: ServiceContext): Promise<boolean> {
    const userId = context?.userId;
    if (!userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }

    try {
      this.log('delete', { id }, context);

      // Get attachment details first
      const attachmentRes = await query<AttachmentEntity>(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a.id = $1 AND t."userId" = $2 LIMIT 1`,
        [id, userId],
        this.db
      );
      const attachment = attachmentRes.rows[0];

      if (!attachment) {
        throw new Error(
          'AUTHORIZATION_ERROR: Attachment not found or access denied'
        );
      }

      // Delete from database
      await query('DELETE FROM attachments WHERE id = $1', [id], this.db);

      // TODO: Delete file from storage (Vercel Blob, S3, etc.)
      // This would require implementing file storage cleanup
      // await this.deleteFileFromStorage(attachment.fileUrl);

      this.log(
        'delete:success',
        { id, fileName: attachment.fileName },
        context
      );
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('delete:error', { error: message, id }, context);
      throw error;
    }
  }

  /**
   * Bulk delete attachments
   */
  async bulkDelete(
    ids: string[],
    context?: ServiceContext
  ): Promise<{ deletedCount: number }> {
    if (!context?.userId) {
      throw new Error('AUTHORIZATION_ERROR: User ID required');
    }
    const userId = context.userId;

    try {
      this.log('bulkDelete', { ids }, context);

      // Get attachments to verify ownership
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const attachments = await query<{ id: string; userId: string }>(
        `SELECT a.id, t."userId" FROM attachments a JOIN tasks t ON t.id = a."taskId" WHERE a.id IN (${placeholders}) AND t."userId" = $${ids.length + 1}`,
        [...ids, userId],
        this.db
      );

      if (attachments.rowCount !== ids.length) {
        throw new Error(
          'AUTHORIZATION_ERROR: Some attachments not found or access denied'
        );
      }

      // Delete from database
      const result = await query(
        'DELETE FROM attachments WHERE id = ANY($1::text[])',
        [ids],
        this.db
      );

      // TODO: Delete files from storage
      // for (const attachment of attachments) {
      //   await this.deleteFileFromStorage(attachment.fileUrl);
      // }

      const deletedCount = result.rowCount ?? 0;
      this.log('bulkDelete:success', { deletedCount }, context);
      return { deletedCount };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('bulkDelete:error', { error: message, ids }, context);
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
    const userId = context.userId;

    try {
      this.log('getDownloadUrl', { id }, context);

      const attachmentRes = await query<AttachmentEntity>(
        `SELECT a.* FROM attachments a
         JOIN tasks t ON t.id = a."taskId"
         WHERE a.id = $1 AND t."userId" = $2 LIMIT 1`,
        [id, userId],
        this.db
      );
      const attachment = attachmentRes.rows[0];

      if (!attachment) {
        throw new Error(
          'AUTHORIZATION_ERROR: Attachment not found or access denied'
        );
      }

      // For now, return the stored URL directly
      // In production, you might generate time-limited signed URLs
      const downloadUrl = attachment.fileUrl;

      this.log('getDownloadUrl:success', { id }, context);
      return downloadUrl;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('getDownloadUrl:error', { error: message, id }, context);
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
  static getFileCategory(
    fileType: string
  ): keyof typeof SUPPORTED_FILE_TYPES | null {
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
  async cleanupOrphanedAttachments(
    context?: ServiceContext
  ): Promise<{ deletedCount: number }> {
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
        await query(
          'DELETE FROM attachments WHERE id = ANY($1::text[])',
          [orphanedIds],
          this.db
        );

        // TODO: Clean up files from storage
        // for (const attachment of orphanedAttachments) {
        //   await this.deleteFileFromStorage(attachment.fileUrl);
        // }
      }

      this.log(
        'cleanupOrphanedAttachments:success',
        { deletedCount: orphanedRes.rowCount },
        context
      );
      return { deletedCount: orphanedRes.rowCount };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('cleanupOrphanedAttachments:error', { error: message }, context);
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
