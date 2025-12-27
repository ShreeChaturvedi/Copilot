/**
 * Comprehensive test suite for AttachmentService
 * Tests file upload/download, stats calculation, and cleanup operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AttachmentService } from '../AttachmentService';
import { pool } from '../../config/database';
import { testUsers, testAttachments, testTasks, testEvents } from '../../__tests__/helpers/fixtures';

// Mock the database pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(),
}));

describe('AttachmentService', () => {
  let attachmentService: AttachmentService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    attachmentService = new AttachmentService(pool, mockContext);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all attachments for the authenticated user', async () => {
      const mockAttachments = [testAttachments.document, testAttachments.image];
      vi.mocked(pool.query).mockResolvedValue({
        rows: mockAttachments,
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM attachments'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toEqual(mockAttachments);
      expect(result).toHaveLength(2);
    });

    it('should filter attachments by task ID', async () => {
      const taskId = testTasks.incomplete.id;
      const taskAttachments = [testAttachments.document];

      vi.mocked(pool.query).mockResolvedValue({
        rows: taskAttachments,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findAll({ taskId });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('task_id = $2'),
        expect.arrayContaining([mockUserId, taskId])
      );
      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe(taskId);
    });

    it('should filter attachments by event ID', async () => {
      const eventId = testEvents.meeting.id;
      const eventAttachments = [testAttachments.image];

      vi.mocked(pool.query).mockResolvedValue({
        rows: eventAttachments,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findAll({ eventId });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('event_id = $2'),
        expect.arrayContaining([mockUserId, eventId])
      );
      expect(result).toHaveLength(1);
    });

    it('should filter attachments by MIME type', async () => {
      const mimeType = 'application/pdf';
      const pdfAttachments = [testAttachments.document];

      vi.mocked(pool.query).mockResolvedValue({
        rows: pdfAttachments,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findAll({ mimeType });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('mime_type = $2'),
        expect.arrayContaining([mockUserId, mimeType])
      );
      expect(result[0].mimeType).toBe(mimeType);
    });

    it('should return empty array when user has no attachments', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should fetch a specific attachment by ID', async () => {
      const mockAttachment = testAttachments.document;
      vi.mocked(pool.query).mockResolvedValue({
        rows: [mockAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findById(mockAttachment.id);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        [mockAttachment.id, mockUserId]
      );
      expect(result).toEqual(mockAttachment);
    });

    it('should return null when attachment not found', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return attachments belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findById('other-user-attachment-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new attachment for a task', async () => {
      const createDTO = {
        taskId: testTasks.incomplete.id,
        filename: 'report.pdf',
        fileUrl: 'https://blob.vercel-storage.com/report-xyz.pdf',
        fileSize: 2048000,
        mimeType: 'application/pdf',
      };

      const createdAttachment = {
        id: 'att-new',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.create(createDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO attachments'),
        expect.arrayContaining([
          mockUserId,
          createDTO.filename,
          createDTO.fileUrl,
          createDTO.fileSize,
          createDTO.mimeType,
        ])
      );
      expect(result).toEqual(createdAttachment);
      expect(result.userId).toBe(mockUserId);
    });

    it('should create a new attachment for an event', async () => {
      const createDTO = {
        eventId: testEvents.meeting.id,
        filename: 'agenda.docx',
        fileUrl: 'https://blob.vercel-storage.com/agenda-abc.docx',
        fileSize: 512000,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      const createdAttachment = {
        id: 'att-event',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.create(createDTO);

      expect(result.eventId).toBe(createDTO.eventId);
      expect(result.filename).toBe(createDTO.filename);
    });

    it('should validate task/event ownership before creating attachment', async () => {
      const createDTO = {
        taskId: 'other-user-task',
        filename: 'unauthorized.pdf',
        fileUrl: 'https://blob.vercel-storage.com/file.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      vi.mocked(pool.query).mockRejectedValue(
        new Error('Foreign key constraint violation')
      );

      await expect(attachmentService.create(createDTO as any)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        filename: '',
        fileUrl: '',
      };

      await expect(attachmentService.create(invalidDTO as any)).rejects.toThrow();
    });

    it('should validate file size is positive', async () => {
      const invalidDTO = {
        taskId: testTasks.incomplete.id,
        filename: 'test.pdf',
        fileUrl: 'https://blob.vercel-storage.com/test.pdf',
        fileSize: -1,
        mimeType: 'application/pdf',
      };

      await expect(attachmentService.create(invalidDTO as any)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update attachment filename', async () => {
      const attachmentId = testAttachments.document.id;
      const updateDTO = {
        filename: 'updated-proposal.pdf',
      };

      const updatedAttachment = {
        ...testAttachments.document,
        ...updateDTO,
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.update(attachmentId, updateDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE attachments'),
        expect.arrayContaining([attachmentId, mockUserId])
      );
      expect(result.filename).toBe(updateDTO.filename);
    });

    it('should not update file URL or size (immutable after upload)', async () => {
      const attachmentId = testAttachments.document.id;
      const updateDTO = {
        fileUrl: 'https://malicious.com/file.pdf',
        fileSize: 999999,
      };

      // Service should reject these updates or ignore them
      await expect(
        attachmentService.update(attachmentId, updateDTO as any)
      ).rejects.toThrow();
    });

    it('should not update attachments belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        attachmentService.update('other-user-attachment', { filename: 'hacked.pdf' })
      ).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('delete', () => {
    it('should delete an attachment', async () => {
      const attachmentId = testAttachments.spreadsheet.id;

      // Mock finding the attachment
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testAttachments.spreadsheet],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock deletion
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await attachmentService.delete(attachmentId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM attachments WHERE id = $1 AND user_id = $2'),
        [attachmentId, mockUserId]
      );
      expect(result).toEqual(testAttachments.spreadsheet);
    });

    it('should return deleted attachment info for cleanup (file deletion)', async () => {
      const attachmentId = testAttachments.document.id;

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testAttachments.document],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await attachmentService.delete(attachmentId);

      // Service should return attachment info so caller can delete from blob storage
      expect(result.fileUrl).toBe(testAttachments.document.fileUrl);
    });

    it('should not delete attachments belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(attachmentService.delete('other-user-attachment')).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('getStorageStats', () => {
    it('should calculate total storage used by user', async () => {
      const mockStats = {
        totalFiles: 3,
        totalSize: 2279800, // Sum of test attachments
        averageSize: 759933,
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{
          total_files: mockStats.totalFiles,
          total_size: mockStats.totalSize,
          average_size: mockStats.averageSize,
        }],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.getStorageStats();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toEqual(mockStats);
    });

    it('should return zero stats when user has no attachments', async () => {
      const emptyStats = {
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{
          total_files: 0,
          total_size: 0,
          average_size: 0,
        }],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.getStorageStats();

      expect(result).toEqual(emptyStats);
    });

    it('should calculate stats by MIME type category', async () => {
      const mockStatsByType = [
        { mimeType: 'application/pdf', count: 1, totalSize: 1024000 },
        { mimeType: 'image/png', count: 1, totalSize: 512000 },
        { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', count: 1, totalSize: 204800 },
      ];

      vi.mocked(pool.query).mockResolvedValue({
        rows: mockStatsByType,
        rowCount: 3,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.getStatsByMimeType();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY mime_type'),
        [mockUserId]
      );
      expect(result).toHaveLength(3);
      expect(result[0].mimeType).toBe('application/pdf');
    });
  });

  describe('cleanup', () => {
    it('should find orphaned attachments (tasks/events deleted)', async () => {
      const orphanedAttachment = {
        ...testAttachments.document,
        taskId: 'deleted-task-id',
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [orphanedAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findOrphaned();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN tasks'),
        [mockUserId]
      );
      expect(result).toHaveLength(1);
    });

    it('should delete orphaned attachments', async () => {
      const orphanedIds = ['att-orphan-1', 'att-orphan-2'];

      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.cleanupOrphaned();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM attachments'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toBe(2); // Number of deleted attachments
    });

    it('should find attachments exceeding size limit', async () => {
      const sizeLimit = 1000000; // 1MB
      const largeAttachment = {
        ...testAttachments.document,
        fileSize: 2048000, // 2MB
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [largeAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.findOverSizeLimit(sizeLimit);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('file_size > $2'),
        [mockUserId, sizeLimit]
      );
      expect(result).toHaveLength(1);
      expect(result[0].fileSize).toBeGreaterThan(sizeLimit);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection timeout'));

      await expect(attachmentService.findAll()).rejects.toThrow('Connection timeout');
    });

    it('should handle very large file sizes', async () => {
      const largeFile = {
        taskId: testTasks.incomplete.id,
        filename: 'large-video.mp4',
        fileUrl: 'https://blob.vercel-storage.com/video.mp4',
        fileSize: 524288000, // 500MB
        mimeType: 'video/mp4',
      };

      const createdAttachment = {
        id: 'att-large',
        userId: mockUserId,
        ...largeFile,
        createdAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.create(largeFile);

      expect(result.fileSize).toBe(524288000);
    });

    it('should handle special characters in filenames', async () => {
      const specialFilename = 'my file (copy) [2024].pdf';
      const createDTO = {
        taskId: testTasks.incomplete.id,
        filename: specialFilename,
        fileUrl: 'https://blob.vercel-storage.com/encoded-name.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      };

      const createdAttachment = {
        id: 'att-special',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdAttachment],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await attachmentService.create(createDTO);

      expect(result.filename).toBe(specialFilename);
    });

    it('should handle concurrent attachment deletions', async () => {
      const att1 = testAttachments.document.id;
      const att2 = testAttachments.image.id;

      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [testAttachments.document], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testAttachments.image], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [], command: '', oid: 0 });

      const results = await Promise.all([
        attachmentService.delete(att1),
        attachmentService.delete(att2),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(att1);
      expect(results[1].id).toBe(att2);
    });

    it('should validate MIME type format', async () => {
      const invalidDTO = {
        taskId: testTasks.incomplete.id,
        filename: 'test.pdf',
        fileUrl: 'https://blob.vercel-storage.com/test.pdf',
        fileSize: 1024,
        mimeType: 'invalid/mime/type',
      };

      await expect(attachmentService.create(invalidDTO as any)).rejects.toThrow();
    });
  });
});
