/**
 * Comprehensive test suite for TagService
 * Tests CRUD operations, tag merge functionality, and cleanup operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TagService } from '../TagService';
import { query as mockQuery, withTransaction as mockWithTransaction } from '../../config/database.js';
import { testUsers, testTasks } from '../../__tests__/helpers/fixtures';
import { createQueryResult } from './helpers/mockDatabase';

// Mock the database module
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const withTransaction = vi.fn();
  return {
    query,
    withTransaction,
    pool: { query },
  };
});

const mockedQuery = vi.mocked(mockQuery);
const mockedWithTransaction = vi.mocked(mockWithTransaction);

const tagFixtures = {
  priority: {
    id: 'tag-123',
    name: 'high-priority',
    type: 'PRIORITY',
    color: '#EF4444',
    createdAt: new Date('2024-01-10T00:00:00Z'),
    updatedAt: new Date('2024-01-10T00:00:00Z'),
  },
  label: {
    id: 'tag-456',
    name: 'work',
    type: 'LABEL',
    color: '#3B82F6',
    createdAt: new Date('2024-01-11T00:00:00Z'),
    updatedAt: new Date('2024-01-11T00:00:00Z'),
  },
  project: {
    id: 'tag-789',
    name: 'urgent',
    type: 'PROJECT',
    color: '#F97316',
    createdAt: new Date('2024-01-12T00:00:00Z'),
    updatedAt: new Date('2024-01-12T00:00:00Z'),
  },
};

describe('TagService', () => {
  let tagService: TagService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    tagService = new TagService({ enableLogging: false });
    vi.clearAllMocks();
    mockedQuery.mockReset();
    mockedWithTransaction.mockReset();
    mockedWithTransaction.mockImplementation(async (callback: any) =>
      callback({ query: mockedQuery })
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all tags', async () => {
      const mockTags = [tagFixtures.priority, tagFixtures.label, tagFixtures.project];
      mockedQuery.mockResolvedValueOnce(createQueryResult(mockTags));

      const result = await tagService.findAll({}, mockContext);

      expect(result).toEqual(mockTags);
      expect(result).toHaveLength(3);
    });

    it('should filter tags by type', async () => {
      const priorityTags = [tagFixtures.priority];
      mockedQuery.mockResolvedValueOnce(createQueryResult(priorityTags));

      const result = await tagService.findAll({ type: 'PRIORITY' }, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $1'),
        ['PRIORITY'],
        expect.anything()
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PRIORITY');
    });

    it('should search tags by name', async () => {
      const searchResults = [tagFixtures.priority];
      mockedQuery.mockResolvedValueOnce(createQueryResult(searchResults));

      const result = await tagService.findAll({ search: 'priority' }, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $1'),
        ['%priority%'],
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });

    it('should filter to tags with active tasks', async () => {
      const activeTags = [tagFixtures.priority];
      mockedQuery.mockResolvedValueOnce(createQueryResult(activeTags));

      const result = await tagService.findAll({ hasActiveTasks: true, userId: mockUserId }, mockContext);

      const tagCall = mockedQuery.mock.calls[0];
      expect(String(tagCall[0])).toContain('tk."userId" = $1');
      expect(String(tagCall[0])).toContain('tk.completed = false');
      expect(tagCall[1]).toEqual([mockUserId]);
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should fetch a specific tag by ID', async () => {
      const mockTag = tagFixtures.priority;
      mockedQuery.mockResolvedValueOnce(createQueryResult([mockTag]));

      const result = await tagService.findById(mockTag.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tags WHERE id = $1'),
        [mockTag.id],
        expect.anything()
      );
      expect(result).toEqual(mockTag);
    });

    it('should return null when tag not found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await tagService.findById('non-existent-id', mockContext);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new tag', async () => {
      const createDTO = {
        name: 'Important',
        type: 'PROJECT' as const,
        color: '#F97316',
      };

      const createdTag = {
        id: 'tag-new',
        name: 'important',
        type: createDTO.type,
        color: createDTO.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from tags')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into tags')) {
          return createQueryResult([createdTag], 1);
        }
        return createQueryResult([]);
      });

      const result = await tagService.create(createDTO, mockContext);

      expect(result.name).toBe('important');
      expect(result.type).toBe(createDTO.type);
    });

    it('should prevent duplicate tag names', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([{ id: tagFixtures.priority.id }], 1));

      await expect(
        tagService.create({ name: 'High-Priority', type: 'PRIORITY' }, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should validate color format', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        tagService.create({ name: 'test', type: 'PROJECT', color: 'invalid-color' }, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should validate tag type enum', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        tagService.create({ name: 'test', type: 'INVALID_TYPE' as any, color: '#FF0000' }, mockContext)
      ).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('update', () => {
    it('should update tag properties', async () => {
      const tagId = tagFixtures.project.id;
      const updateDTO = {
        name: 'Super-Urgent',
        color: '#DC2626',
      };

      const updatedTag = {
        ...tagFixtures.project,
        name: 'super-urgent',
        color: updateDTO.color,
        updatedAt: new Date(),
      };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(createQueryResult([updatedTag], 1));

      const result = await tagService.update(tagId, updateDTO, mockContext);

      expect(result?.name).toBe('super-urgent');
      expect(result?.color).toBe(updateDTO.color);
    });

    it('should normalize updated tag name to lowercase', async () => {
      const tagId = tagFixtures.project.id;
      const updateDTO = {
        name: 'UPDATED-NAME',
      };

      const updatedTag = {
        ...tagFixtures.project,
        name: 'updated-name',
        updatedAt: new Date(),
      };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(createQueryResult([updatedTag], 1));

      const result = await tagService.update(tagId, updateDTO, mockContext);

      expect(result?.name).toBe('updated-name');
    });

    it('should reject duplicate names on update', async () => {
      const tagId = tagFixtures.project.id;
      const updateDTO = {
        name: 'high-priority',
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([{ id: tagFixtures.priority.id }], 1));

      await expect(tagService.update(tagId, updateDTO, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });
  });

  describe('findOrCreate', () => {
    it('should return existing tag when found', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([tagFixtures.priority], 1));

      const result = await tagService.findOrCreate(
        { name: 'High-Priority', type: 'PRIORITY' },
        mockContext
      );

      expect(result.id).toBe(tagFixtures.priority.id);
    });

    it('should create tag when not found', async () => {
      const createDTO = { name: 'new-tag', type: 'PROJECT' as const };
      const createdTag = { ...tagFixtures.project, id: 'tag-new', name: 'new-tag' };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select * from tags where name')) {
          return createQueryResult([]);
        }
        if (lower.includes('select id from tags where name')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into tags')) {
          return createQueryResult([createdTag], 1);
        }
        return createQueryResult([]);
      });

      const result = await tagService.findOrCreate(createDTO, mockContext);

      expect(result.name).toBe('new-tag');
    });
  });

  describe('task tag relations', () => {
    it('should attach tag to task', async () => {
      const taskTagData = {
        taskId: testTasks.incomplete.id,
        tagId: tagFixtures.priority.id,
        value: 'HIGH',
        displayText: 'High Priority',
        iconName: 'priority-high',
      };

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: taskTagData.taskId }], 1))
        .mockResolvedValueOnce(createQueryResult([], 1));

      await tagService.attachToTask(taskTagData, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO task_tags'),
        expect.arrayContaining([taskTagData.taskId, taskTagData.tagId]),
        expect.anything()
      );
    });

    it('should detach tag from task', async () => {
      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: testTasks.incomplete.id }], 1))
        .mockResolvedValueOnce(createQueryResult([], 1));

      await tagService.detachFromTask(testTasks.incomplete.id, tagFixtures.priority.id, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM task_tags'),
        [testTasks.incomplete.id, tagFixtures.priority.id],
        expect.anything()
      );
    });

    it('should return task tags with metadata', async () => {
      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: testTasks.incomplete.id }], 1))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: tagFixtures.priority.id,
              name: tagFixtures.priority.name,
              type: tagFixtures.priority.type,
              color: tagFixtures.priority.color,
              createdAt: tagFixtures.priority.createdAt,
              updatedAt: tagFixtures.priority.updatedAt,
              value: 'HIGH',
              displayText: 'High Priority',
              iconName: 'priority-high',
            },
          ])
        );

      const result = await tagService.getTaskTags(testTasks.incomplete.id, mockContext);

      expect(result).toHaveLength(1);
      expect(result[0].tag.id).toBe(tagFixtures.priority.id);
      expect(result[0].value).toBe('HIGH');
    });

    it('should update task-tag fields', async () => {
      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: testTasks.incomplete.id }], 1))
        .mockResolvedValueOnce(createQueryResult([], 1));

      await tagService.updateTaskTag(
        testTasks.incomplete.id,
        tagFixtures.priority.id,
        { displayText: 'Updated Priority' },
        mockContext
      );

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_tags SET'),
        expect.arrayContaining(['Updated Priority', testTasks.incomplete.id, tagFixtures.priority.id]),
        expect.anything()
      );
    });
  });

  describe('cleanup', () => {
    it('should delete unused tags', async () => {
      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ id: tagFixtures.project.id }], 1))
        .mockResolvedValueOnce(createQueryResult([], 1));

      const result = await tagService.cleanupUnusedTags(mockContext);

      expect(result.deletedCount).toBe(1);
    });

    it('should return zero when no unused tags exist', async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], 0));

      const result = await tagService.cleanupUnusedTags(mockContext);

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('merge', () => {
    it('should merge two tags by transferring associations', async () => {
      const sourceTagId = tagFixtures.project.id;
      const targetTagId = tagFixtures.priority.id;

      mockedQuery
        .mockResolvedValueOnce(createQueryResult([], 1))
        .mockResolvedValueOnce(createQueryResult([], 1))
        .mockResolvedValueOnce(createQueryResult([{ ...tagFixtures.priority }], 1));

      const result = await tagService.mergeTags(sourceTagId, targetTagId, mockContext);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_tags SET "tagId" = $1'),
        [targetTagId, sourceTagId],
        expect.anything()
      );
      expect(result.id).toBe(targetTagId);
    });

    it('should not merge a tag with itself', async () => {
      const tagId = tagFixtures.priority.id;

      await expect(tagService.mergeTags(tagId, tagId, mockContext)).rejects.toThrow(
        'VALIDATION_ERROR'
      );
    });
  });

  describe('getStatistics', () => {
    it('should calculate tag usage statistics', async () => {
      mockedQuery
        .mockResolvedValueOnce(createQueryResult([{ count: '5' }], 1))
        .mockResolvedValueOnce(
          createQueryResult([
            { type: 'PRIORITY', count: '2' },
            { type: 'LABEL', count: '2' },
            { type: 'PROJECT', count: '1' },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            { ...tagFixtures.priority, usage: '10' },
            { ...tagFixtures.label, usage: '5' },
          ])
        );

      const result = await tagService.getStatistics(mockContext);

      expect(result.totalTags).toBe(5);
      expect(result.tagsByType.PRIORITY).toBe(2);
      expect(result.mostUsedTags).toHaveLength(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(tagService.findAll({}, mockContext)).rejects.toThrow('Connection timeout');
    });

    it('should handle special characters in tag names', async () => {
      const createDTO = {
        name: 'high-priority!@#$%',
        type: 'PROJECT' as const,
        color: '#FF0000',
      };

      const createdTag = {
        id: 'tag-special',
        name: 'high-priority!@#$%'.toLowerCase(),
        type: createDTO.type,
        color: createDTO.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const lower = sql.toLowerCase();
        if (lower.includes('select id from tags')) {
          return createQueryResult([]);
        }
        if (lower.includes('insert into tags')) {
          return createQueryResult([createdTag], 1);
        }
        return createQueryResult([]);
      });

      const result = await tagService.create(createDTO, mockContext);

      expect(result.name).toBe(createdTag.name);
    });
  });
});
