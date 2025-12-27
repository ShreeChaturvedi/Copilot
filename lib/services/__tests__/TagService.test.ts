/**
 * Comprehensive test suite for TagService
 * Tests CRUD operations, tag merge functionality, and cleanup operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TagService } from '../TagService';
import { pool } from '../../config/database';
import { testUsers, testTags, testTasks } from '../../__tests__/helpers/fixtures';

// Mock the database pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(),
}));

describe('TagService', () => {
  let tagService: TagService;
  const mockUserId = testUsers.standard.id;
  const mockContext = {
    userId: mockUserId,
    requestId: 'test-request-123',
  };

  beforeEach(() => {
    tagService = new TagService(pool, mockContext);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findAll', () => {
    it('should fetch all tags for the authenticated user', async () => {
      const mockTags = [testTags.priority, testTags.category, testTags.custom];
      vi.mocked(pool.query).mockResolvedValue({
        rows: mockTags,
        rowCount: 3,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT t.*, COUNT(tt.task_id) as usage_count'),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toEqual(mockTags);
      expect(result).toHaveLength(3);
    });

    it('should filter tags by type', async () => {
      const priorityTags = [testTags.priority];
      vi.mocked(pool.query).mockResolvedValue({
        rows: priorityTags,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findAll({ type: 'PRIORITY' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $2'),
        expect.arrayContaining([mockUserId, 'PRIORITY'])
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PRIORITY');
    });

    it('should search tags by name', async () => {
      const searchResults = [testTags.priority];
      vi.mocked(pool.query).mockResolvedValue({
        rows: searchResults,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findAll({ search: 'priority' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $2'),
        expect.arrayContaining([mockUserId, '%priority%'])
      );
      expect(result).toHaveLength(1);
    });

    it('should include usage count with each tag', async () => {
      const tagsWithCount = [
        { ...testTags.priority, usageCount: 5 },
        { ...testTags.category, usageCount: 3 },
      ];

      vi.mocked(pool.query).mockResolvedValue({
        rows: tagsWithCount,
        rowCount: 2,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(tt.task_id)'),
        [mockUserId]
      );
      expect(result[0].usageCount).toBe(5);
      expect(result[1].usageCount).toBe(3);
    });

    it('should return empty array when user has no tags', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should fetch a specific tag by ID', async () => {
      const mockTag = { ...testTags.priority, usageCount: 5 };
      vi.mocked(pool.query).mockResolvedValue({
        rows: [mockTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findById(mockTag.id);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE t.id = $1 AND t.user_id = $2'),
        [mockTag.id, mockUserId]
      );
      expect(result).toEqual(mockTag);
    });

    it('should return null when tag not found', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return tags belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findById('other-user-tag-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new tag', async () => {
      const createDTO = {
        name: 'important',
        type: 'CUSTOM',
        color: '#F97316',
      };

      const createdTag = {
        id: 'tag-new',
        userId: mockUserId,
        ...createDTO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.create(createDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tags'),
        expect.arrayContaining([mockUserId, createDTO.name, createDTO.type, createDTO.color])
      );
      expect(result).toEqual(createdTag);
      expect(result.userId).toBe(mockUserId);
    });

    it('should normalize tag name to lowercase', async () => {
      const createDTO = {
        name: 'URGENT',
        type: 'CUSTOM',
        color: '#EF4444',
      };

      const createdTag = {
        id: 'tag-normalized',
        userId: mockUserId,
        name: 'urgent', // Normalized
        type: createDTO.type,
        color: createDTO.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.create(createDTO);

      expect(result.name).toBe('urgent');
    });

    it('should prevent duplicate tag names for same user', async () => {
      const duplicateDTO = {
        name: 'high-priority',
        type: 'PRIORITY',
        color: '#EF4444',
      };

      vi.mocked(pool.query).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(tagService.create(duplicateDTO)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidDTO = {
        name: '',
        type: '',
      };

      await expect(tagService.create(invalidDTO as any)).rejects.toThrow();
    });

    it('should validate color format', async () => {
      const invalidDTO = {
        name: 'test',
        type: 'CUSTOM',
        color: 'invalid-color',
      };

      await expect(tagService.create(invalidDTO as any)).rejects.toThrow();
    });

    it('should validate tag type enum', async () => {
      const invalidDTO = {
        name: 'test',
        type: 'INVALID_TYPE',
        color: '#FF0000',
      };

      await expect(tagService.create(invalidDTO as any)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update tag properties', async () => {
      const tagId = testTags.custom.id;
      const updateDTO = {
        name: 'super-urgent',
        color: '#DC2626',
      };

      const updatedTag = {
        ...testTags.custom,
        ...updateDTO,
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.update(tagId, updateDTO);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tags'),
        expect.arrayContaining([tagId, mockUserId])
      );
      expect(result.name).toBe(updateDTO.name);
      expect(result.color).toBe(updateDTO.color);
    });

    it('should normalize updated tag name to lowercase', async () => {
      const tagId = testTags.custom.id;
      const updateDTO = {
        name: 'UPDATED-NAME',
      };

      const updatedTag = {
        ...testTags.custom,
        name: 'updated-name',
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [updatedTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.update(tagId, updateDTO);

      expect(result.name).toBe('updated-name');
    });

    it('should not update tags belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        tagService.update('other-user-tag', { name: 'hacked' })
      ).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('delete', () => {
    it('should delete a tag', async () => {
      const tagId = testTags.custom.id;

      // Mock finding the tag
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testTags.custom],
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

      await tagService.delete(tagId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tags WHERE id = $1 AND user_id = $2'),
        [tagId, mockUserId]
      );
    });

    it('should cascade delete task_tags associations', async () => {
      const tagId = testTags.priority.id;

      // Mock finding the tag with usage count
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{ ...testTags.priority, usageCount: 5 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock deletion (cascade handled by DB)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      await tagService.delete(tagId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tags'),
        [tagId, mockUserId]
      );
    });

    it('should not delete tags belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(tagService.delete('other-user-tag')).rejects.toThrow();

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUserId])
      );
    });
  });

  describe('merge', () => {
    it('should merge two tags by transferring all associations', async () => {
      const sourceTagId = testTags.custom.id;
      const targetTagId = testTags.priority.id;

      // Mock: verify both tags exist
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [testTags.custom],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [testTags.priority],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock: update task_tags associations
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 5,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock: delete source tag
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        // Mock: return merged tag
        .mockResolvedValueOnce({
          rows: [{ ...testTags.priority, usageCount: 10 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await tagService.merge(sourceTagId, targetTagId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_tags SET tag_id = $1'),
        expect.arrayContaining([targetTagId, sourceTagId])
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tags WHERE id = $1'),
        [sourceTagId, mockUserId]
      );
      expect(result.id).toBe(targetTagId);
    });

    it('should handle duplicate task-tag associations during merge', async () => {
      const sourceTagId = testTags.custom.id;
      const targetTagId = testTags.priority.id;

      // When a task already has both tags, merge should handle gracefully
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [testTags.custom], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 3, fields: [], command: '', oid: 0 }) // Some duplicates skipped
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 });

      const result = await tagService.merge(sourceTagId, targetTagId);

      expect(result.id).toBe(targetTagId);
    });

    it('should not merge tags belonging to other users', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        tagService.merge('other-user-tag', testTags.priority.id)
      ).rejects.toThrow();
    });

    it('should not merge a tag with itself', async () => {
      const tagId = testTags.priority.id;

      await expect(tagService.merge(tagId, tagId)).rejects.toThrow();
    });

    it('should validate both tags exist before merging', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 0,
        fields: [],
        command: '',
        oid: 0,
      });

      await expect(
        tagService.merge('non-existent-1', 'non-existent-2')
      ).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should find unused tags (zero usage count)', async () => {
      const unusedTags = [
        { ...testTags.custom, usageCount: 0 },
      ];

      vi.mocked(pool.query).mockResolvedValue({
        rows: unusedTags,
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.findUnused();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('HAVING COUNT(tt.task_id) = 0'),
        [mockUserId]
      );
      expect(result).toHaveLength(1);
      expect(result[0].usageCount).toBe(0);
    });

    it('should delete all unused tags', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        rowCount: 3, // Deleted 3 unused tags
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.cleanupUnused();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tags'),
        [mockUserId]
      );
      expect(result).toBe(3);
    });

    it('should not delete tags currently in use', async () => {
      // Only delete tags with 0 usage
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [
            { ...testTags.priority, usageCount: 5 },
            { ...testTags.category, usageCount: 3 },
            { ...testTags.custom, usageCount: 0 },
          ],
          rowCount: 3,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1, // Only 1 tag deleted
          fields: [],
          command: '',
          oid: 0,
        });

      await tagService.findUnused();
      const deletedCount = await tagService.cleanupUnused();

      expect(deletedCount).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should calculate tag usage statistics', async () => {
      const mockStats = {
        totalTags: 5,
        totalUsage: 15,
        averageUsage: 3,
        mostUsedTags: [
          { ...testTags.priority, usageCount: 10 },
          { ...testTags.category, usageCount: 5 },
        ],
      };

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{
            total_tags: mockStats.totalTags,
            total_usage: mockStats.totalUsage,
            average_usage: mockStats.averageUsage,
          }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockResolvedValueOnce({
          rows: mockStats.mostUsedTags,
          rowCount: 2,
          fields: [],
          command: '',
          oid: 0,
        });

      const result = await tagService.getStats();

      expect(result.totalTags).toBe(5);
      expect(result.totalUsage).toBe(15);
      expect(result.mostUsedTags).toHaveLength(2);
    });

    it('should return zero stats when user has no tags', async () => {
      const emptyStats = {
        totalTags: 0,
        totalUsage: 0,
        averageUsage: 0,
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [emptyStats],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.getStats();

      expect(result.totalTags).toBe(0);
      expect(result.totalUsage).toBe(0);
    });

    it('should calculate stats by tag type', async () => {
      const statsByType = [
        { type: 'PRIORITY', count: 2, totalUsage: 10 },
        { type: 'CATEGORY', count: 2, totalUsage: 5 },
        { type: 'CUSTOM', count: 1, totalUsage: 0 },
      ];

      vi.mocked(pool.query).mockResolvedValue({
        rows: statsByType,
        rowCount: 3,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.getStatsByType();

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('PRIORITY');
      expect(result[0].totalUsage).toBe(10);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection timeout'));

      await expect(tagService.findAll()).rejects.toThrow('Connection timeout');
    });

    it('should handle very long tag names', async () => {
      const longName = 'a'.repeat(256);
      const createDTO = {
        name: longName,
        type: 'CUSTOM',
        color: '#FF0000',
      };

      await expect(tagService.create(createDTO as any)).rejects.toThrow();
    });

    it('should handle special characters in tag names', async () => {
      const specialName = 'high-priority!@#$%';
      const createDTO = {
        name: specialName,
        type: 'CUSTOM',
        color: '#FF0000',
      };

      const createdTag = {
        id: 'tag-special',
        userId: mockUserId,
        name: specialName.toLowerCase(),
        type: createDTO.type,
        color: createDTO.color,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(pool.query).mockResolvedValue({
        rows: [createdTag],
        rowCount: 1,
        fields: [],
        command: '',
        oid: 0,
      });

      const result = await tagService.create(createDTO);

      expect(result.name).toBe(specialName.toLowerCase());
    });

    it('should handle concurrent tag merges', async () => {
      const source1 = testTags.custom.id;
      const source2 = 'tag-another';
      const target = testTags.priority.id;

      vi.mocked(pool.query)
        // First merge
        .mockResolvedValueOnce({ rows: [testTags.custom], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 3, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 })
        // Second merge
        .mockResolvedValueOnce({ rows: [{ id: source2, name: 'another', type: 'CUSTOM' }], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1, fields: [], command: '', oid: 0 })
        .mockResolvedValueOnce({ rows: [testTags.priority], rowCount: 1, fields: [], command: '', oid: 0 });

      const results = await Promise.all([
        tagService.merge(source1, target),
        tagService.merge(source2, target),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(target);
      expect(results[1].id).toBe(target);
    });

    it('should handle case-insensitive duplicate checking', async () => {
      const createDTO1 = {
        name: 'important',
        type: 'CUSTOM',
        color: '#FF0000',
      };

      const createDTO2 = {
        name: 'IMPORTANT', // Same name, different case
        type: 'CUSTOM',
        color: '#00FF00',
      };

      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'tag-1', userId: mockUserId, name: 'important', ...createDTO1 }],
          rowCount: 1,
          fields: [],
          command: '',
          oid: 0,
        })
        .mockRejectedValueOnce(new Error('Unique constraint violation'));

      await tagService.create(createDTO1);
      await expect(tagService.create(createDTO2)).rejects.toThrow();
    });
  });
});
