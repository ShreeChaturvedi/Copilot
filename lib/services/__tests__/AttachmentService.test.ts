/**
 * Comprehensive test suite for AttachmentService
 * Tests file upload/download, stats calculation, and cleanup operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AttachmentService,
  MAX_FILE_SIZE,
  SUPPORTED_FILE_TYPES,
} from '../AttachmentService';
import { query as mockQuery } from '../../config/database.js';
import { testUsers, testAttachments, testTasks } from '../../__tests__/helpers/fixtures';
import { createQueryResult } from './helpers/mockDatabase';

// Mock the database module
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  return {
    query,
    pool: { query },
  };
});

const mockedQuery = vi.mocked(mockQuery);

const mapAttachment = (
  attachment: typeof testAttachments.document,
  overrides: Record<string, unknown> = {}
) => ({
  id: attachment.id,
  taskId: attachment.taskId ?? testTasks.incomplete.id,
  userId: attachment.userId,
  fileName: attachment.filename,
  fileUrl: attachment.fileUrl,
  fileType: attachment.mimeType,
  fileSize: attachment.fileSize,
  thumbnailUrl: null,
  createdAt: attachment.createdAt,
  updatedAt: attachment.createdAt,
  ...overrides,
});

const attachmentFixtures = {
  document: mapAttachment(testAttachments.document, { taskId: testTasks.incomplete.id }),
  image: mapAttachment(testAttachments.image, { taskId: testTasks.completed.id }),
  spreadsheet: mapAttachment(testAttachments.spreadsheet, { taskId: testTasks.completed.id }),
};

const taskRows = [
  { id: testTasks.incomplete.id, title: testTasks.incomplete.title, userId: testUsers.standard.id },
  { id: testTasks.completed.id, title: testTasks.completed.title, userId: testUsers.standard.id },
];

describe('AttachmentService', () => {
  let attachmentService: AttachmentService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    attachmentService = new AttachmentService({ enableLogging: false });
    vi.clearAllMocks();
    mockedQuery.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all attachments for the authenticated user', async () => {
      const attachments = [attachmentFixtures.document, attachmentFixtures.image];

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments')) {
          return createQueryResult(attachments);
        }
        if (lower.includes('from tasks')) {
          return createQueryResult(taskRows);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.findAll({}, mockContext);

      expect(result).toHaveLength(2);
    });

    it('should filter attachments by task ID', async () => {
      const taskId = testTasks.incomplete.id;
      const attachments = [attachmentFixtures.document];

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments')) {
          return createQueryResult(attachments);
        }
        if (lower.includes('from tasks')) {
          return createQueryResult(taskRows);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.findAll({ taskId }, mockContext);

      const attachmentCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM attachments')
      );
      expect(attachmentCall).toBeTruthy();
      expect(attachmentCall?.[0]).toContain('"taskId" = $1');
      expect(attachmentCall?.[1]).toEqual([taskId, mockUserId]);
      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe(taskId);
    });

    it('should filter attachments by file type', async () => {
      const fileType = 'application/pdf';
      const attachments = [attachmentFixtures.document];

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments')) {
          return createQueryResult(attachments);
        }
        if (lower.includes('from tasks')) {
          return createQueryResult(taskRows);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.findAll({ fileType }, mockContext);

      const attachmentCall = mockedQuery.mock.calls.find((call) =>
        String(call[0]).includes('FROM attachments')
      );
      expect(attachmentCall?.[0]).toContain('"fileType" = $2');
      expect(attachmentCall?.[1]).toEqual([mockUserId, fileType]);
      expect(result[0].fileType).toBe(fileType);
    });

    it('should return empty array when user has no attachments', async () => {
      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments')) {
          return createQueryResult([]);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.findAll({}, mockContext);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should fetch a specific attachment by ID', async () => {
      const mockAttachment = attachmentFixtures.document;
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockAttachment]));

      const result = await attachmentService.findById(mockAttachment.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM attachments WHERE id = $1'),
        [mockAttachment.id],
        expect.anything()
      );
      expect(result).toEqual(mockAttachment);
    });

    it('should return null when attachment not found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await attachmentService.findById('non-existent-id', mockContext);

      expect(result).toBeNull();
    });

    it('should query by id regardless of context', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await attachmentService.findById('other-user-attachment-id', mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM attachments WHERE id = $1'),
        ['other-user-attachment-id'],
        expect.anything()
      );
    });
  });

  describe('create', () => {
    it('should create a new attachment for a task', async () => {
      const createDTO = {
        taskId: testTasks.incomplete.id,
        fileName: 'report.pdf',
        fileUrl: 'https://blob.vercel-storage.com/report-xyz.pdf',
        fileSize: 2048000,
        fileType: 'application/pdf',
      };

      const createdAttachment = {
        id: 'att-new',
        userId: mockUserId,
        ...createDTO,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('select id, (select count(*)')) {
          return createQueryResult([{ id: createDTO.taskId, cnt: '0' }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select 1 from tasks')) {
          return createQueryResult([{ '?column?': 1 }], 1);
        }
        if (lower.includes('insert into attachments')) {
          return createQueryResult([createdAttachment], 1);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.create(createDTO, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO attachments'),
        expect.arrayContaining([createDTO.fileName, createDTO.fileUrl, createDTO.fileType]),
        expect.anything()
      );
      expect(result).toEqual(createdAttachment);
      expect(result.userId).toBe(mockUserId);
    });

    it('should create a new attachment with thumbnail', async () => {
      const createDTO = {
        taskId: testTasks.incomplete.id,
        fileName: 'photo.jpg',
        fileUrl: 'https://blob.vercel-storage.com/photo.jpg',
        fileSize: 512000,
        fileType: 'image/jpeg',
        thumbnailUrl: 'https://blob.vercel-storage.com/thumb.jpg',
      };

      const createdAttachment = {
        id: 'att-thumb',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('select id, (select count(*)')) {
          return createQueryResult([{ id: createDTO.taskId, cnt: '0' }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select 1 from tasks')) {
          return createQueryResult([{ '?column?': 1 }], 1);
        }
        if (lower.includes('insert into attachments')) {
          return createQueryResult([createdAttachment], 1);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.create(createDTO, mockContext);

      expect(result.thumbnailUrl).toBe(createDTO.thumbnailUrl);
      expect(result.fileName).toBe(createDTO.fileName);
    });

    it('should validate task ownership before creating attachment', async () => {
      const createDTO = {
        taskId: 'other-user-task',
        fileName: 'unauthorized.pdf',
        fileUrl: 'https://blob.vercel-storage.com/file.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(attachmentService.create(createDTO as any, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        fileName: '',
        fileUrl: '',
      };

      await expect(attachmentService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });

    it('should validate file size is positive', async () => {
      const invalidDTO = {
        taskId: testTasks.incomplete.id,
        fileName: 'test.pdf',
        fileUrl: 'https://blob.vercel-storage.com/test.pdf',
        fileSize: -1,
        fileType: 'application/pdf',
      };

      await expect(attachmentService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });

    it('should reject unsupported file types', async () => {
      const invalidDTO = {
        taskId: testTasks.incomplete.id,
        fileName: 'test.pdf',
        fileUrl: 'https://blob.vercel-storage.com/test.pdf',
        fileSize: 1024,
        fileType: 'invalid/type',
      };

      await expect(attachmentService.create(invalidDTO as any, mockContext)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update attachment file name', async () => {
      const attachmentId = attachmentFixtures.document.id;
      const updateDTO = {
        fileName: 'updated-proposal.pdf',
      };

      const updatedAttachment = {
        ...attachmentFixtures.document,
        ...updateDTO,
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments a join tasks')) {
          return createQueryResult([{ id: attachmentId }], 1);
        }
        if (lower.startsWith('update attachments set')) {
          return createQueryResult([updatedAttachment], 1);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.update(attachmentId, updateDTO, mockContext);

      expect(result?.fileName).toBe(updateDTO.fileName);
    });

    it('should update attachment file type and size', async () => {
      const attachmentId = attachmentFixtures.document.id;
      const updateDTO = {
        fileType: SUPPORTED_FILE_TYPES.documents[0],
        fileSize: 4096,
      };

      const updatedAttachment = {
        ...attachmentFixtures.document,
        ...updateDTO,
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments a join tasks')) {
          return createQueryResult([{ id: attachmentId }], 1);
        }
        if (lower.startsWith('update attachments set')) {
          return createQueryResult([updatedAttachment], 1);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.update(attachmentId, updateDTO, mockContext);

      expect(result?.fileType).toBe(updateDTO.fileType);
      expect(result?.fileSize).toBe(updateDTO.fileSize);
    });

    it('should not update attachments belonging to other users', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        attachmentService.update('other-user-attachment', { fileName: 'hacked.pdf' }, mockContext)
      ).rejects.toThrow('AUTHORIZATION_ERROR');
    });
  });

  describe('delete', () => {
    it('should delete an attachment', async () => {
      const attachmentId = attachmentFixtures.spreadsheet.id;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([attachmentFixtures.spreadsheet]))
        .mockResolvedValueOnce(createQueryResult([], 1));

      const result = await attachmentService.delete(attachmentId, mockContext);

      expect(result).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM attachments WHERE id = $1'),
        [attachmentId],
        expect.anything()
      );
    });

    it('should not delete attachments belonging to other users', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(attachmentService.delete('other-user-attachment', mockContext)).rejects.toThrow(
        'AUTHORIZATION_ERROR'
      );
    });
  });

  describe('getStorageStats', () => {
    it('should calculate total storage used by user', async () => {
      const attachments = [
        attachmentFixtures.document,
        attachmentFixtures.image,
        attachmentFixtures.spreadsheet,
      ];

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments a')) {
          return createQueryResult(attachments);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.getStorageStats(mockContext);

      expect(result.totalFiles).toBe(3);
      expect(result.totalSize).toBe(
        attachmentFixtures.document.fileSize +
          attachmentFixtures.image.fileSize +
          attachmentFixtures.spreadsheet.fileSize
      );
      expect(result.filesByType[attachmentFixtures.document.fileType].count).toBe(1);
    });

    it('should return zero stats when user has no attachments', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await attachmentService.getStorageStats(mockContext);

      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.averageFileSize).toBe(0);
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple attachments when owned by user', async () => {
      const ids = [attachmentFixtures.document.id, attachmentFixtures.image.id];

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: ids[0] }, { id: ids[1] }], 2))
        .mockResolvedValueOnce(createQueryResult([], 2));

      const result = await attachmentService.bulkDelete(ids, mockContext);

      expect(result.deletedCount).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should delete orphaned attachments', async () => {
      const orphanedIds = ['att-orphan-1', 'att-orphan-2'];

      mockedQuery
        .mockResolvedValueOnce(createQueryResult(orphanedIds.map((id) => ({ id, fileUrl: 'x' })), 2))
        .mockResolvedValueOnce(createQueryResult([], 2));

      const result = await attachmentService.cleanupOrphanedAttachments();

      expect(result.deletedCount).toBe(2);
    });

    it('should return zero when no orphaned attachments exist', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 0));

      const result = await attachmentService.cleanupOrphanedAttachments();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return file URL when attachment is accessible', async () => {
      const attachmentId = attachmentFixtures.document.id;

      mockedQuery.mockResolvedValueOnce(createQueryResult([attachmentFixtures.document]));

      const result = await attachmentService.getDownloadUrl(attachmentId, mockContext);

      expect(result).toBe(attachmentFixtures.document.fileUrl);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(attachmentService.findAll({}, mockContext)).rejects.toThrow('Connection timeout');
    });

    it('should reject very large file sizes', async () => {
      const largeFile = {
        taskId: testTasks.incomplete.id,
        fileName: 'large-video.mp4',
        fileUrl: 'https://blob.vercel-storage.com/video.mp4',
        fileSize: MAX_FILE_SIZE + 1,
        fileType: 'video/mp4',
      };

      await expect(attachmentService.create(largeFile as any, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });

    it('should handle special characters in file names', async () => {
      const specialFileName = 'my file (copy) [2024].pdf';
      const createDTO = {
        taskId: testTasks.incomplete.id,
        fileName: specialFileName,
        fileUrl: 'https://blob.vercel-storage.com/encoded-name.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
      };

      const createdAttachment = {
        id: 'att-special',
        userId: mockUserId,
        ...createDTO,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('select id, (select count(*)')) {
          return createQueryResult([{ id: createDTO.taskId, cnt: '0' }], 1);
        }
        if (lower.includes('insert into users')) {
          return createQueryResult([], 1);
        }
        if (lower.includes('select 1 from tasks')) {
          return createQueryResult([{ '?column?': 1 }], 1);
        }
        if (lower.includes('insert into attachments')) {
          return createQueryResult([createdAttachment], 1);
        }
        return createQueryResult([]);
      });

      const result = await attachmentService.create(createDTO, mockContext);

      expect(result.fileName).toBe(specialFileName);
    });

    it('should handle concurrent attachment deletions', async () => {
      const att1 = attachmentFixtures.document.id;
      const att2 = attachmentFixtures.image.id;

      let deleteCount = 0;
      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.startsWith('alter table attachments')) {
          return createQueryResult([]);
        }
        if (lower.includes('from attachments a')) {
          deleteCount += 1;
          const attachment = deleteCount === 1 ? attachmentFixtures.document : attachmentFixtures.image;
          return createQueryResult([attachment], 1);
        }
        if (lower.startsWith('delete from attachments')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const results = await Promise.all([
        attachmentService.delete(att1, mockContext),
        attachmentService.delete(att2, mockContext),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
    });
  });
});
