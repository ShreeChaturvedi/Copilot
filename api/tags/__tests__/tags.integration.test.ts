/**
 * Integration tests for Tags API endpoints
 * Tests tag system integration with task management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import tagsHandler from '../index';
import tagHandler from '../[id]';
import cleanupHandler from '../cleanup';
import mergeHandler from '../merge';
import statsHandler from '../stats';
import { getAllServices } from '../../../lib/services/index.js';
import {
  createMockAuthRequest,
  createMockResponse,
  mockUser,
  testTags,
} from '../../../lib/__tests__/helpers';

// Mock the services
vi.mock('../../../lib/services/index.js');
vi.mock('../../../lib/middleware/errorHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    asyncHandler: (handler: any) => handler,
    sendSuccess: vi.fn(),
    sendError: vi.fn(),
  };
});

vi.mock('../../../lib/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    devAuth: () => (_req: any, _res: any, next: any) => next(),
  };
});

const mockTagService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  cleanupUnusedTags: vi.fn(),
  mergeTags: vi.fn(),
  getStatistics: vi.fn(),
};

const mockServices = {
  tag: mockTagService,
};

// Mock error handler functions
const mockSendSuccess = vi.fn();
const mockSendError = vi.fn();

vi.mocked(getAllServices).mockReturnValue(mockServices as unknown as ReturnType<typeof getAllServices>);

// Import mocked functions
const { sendSuccess, sendError } = await import('../../../lib/middleware/errorHandler.js');
vi.mocked(sendSuccess).mockImplementation(mockSendSuccess);
vi.mocked(sendError).mockImplementation((res, error) => {
  mockSendError(res, {
    statusCode: error?.statusCode,
    code: error?.code,
    message: error?.message,
  });
});

// Test data
const mockTag = testTags.priority;

describe('Tags API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 7.1: Tag CRUD Operations', () => {
    it('should fetch all tags for authenticated user', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: {},
      });
      const res = createMockResponse();

      mockTagService.findAll.mockResolvedValue([mockTag]);

      await tagsHandler(req, res);

      expect(mockTagService.findAll).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, [mockTag]);
    });

    it('should filter tags by type', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { type: 'PRIORITY' },
      });
      const res = createMockResponse();

      mockTagService.findAll.mockResolvedValue([mockTag]);

      await tagsHandler(req, res);

      expect(mockTagService.findAll).toHaveBeenCalledWith(
        { type: 'PRIORITY' },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should search tags by name', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { search: 'priority' },
      });
      const res = createMockResponse();

      mockTagService.findAll.mockResolvedValue([mockTag]);

      await tagsHandler(req, res);

      expect(mockTagService.findAll).toHaveBeenCalledWith(
        { search: 'priority' },
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
    });

    it('should include usage counts when requested', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { withUsageCount: 'true' },
      });
      const res = createMockResponse();

      const tagWithCount = { ...mockTag, usageCount: 5 };
      mockTagService.findAll.mockResolvedValue([tagWithCount]);

      await tagsHandler(req, res);

      expect(mockSendSuccess).toHaveBeenCalledWith(res, [tagWithCount]);
    });

    it('should create a new tag', async () => {
      const tagData = {
        name: 'urgent',
        type: 'LABEL',
        color: '#FF5722',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: tagData,
      });
      const res = createMockResponse();

      const createdTag = { ...mockTag, ...tagData, id: 'new-tag-123' };
      mockTagService.create.mockResolvedValue(createdTag);

      await tagsHandler(req, res);

      expect(mockTagService.create).toHaveBeenCalledWith(
        tagData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, createdTag, 201);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        user: undefined,
      });
      const res = createMockResponse();

      await tagsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
    });
  });

  describe('Requirement 7.2: Tag Filtering and Search', () => {
    it('should support complex tag filtering', async () => {
      const filteringScenarios = [
        {
          name: 'Filter by tag type',
          query: { type: 'PRIORITY' },
          expectedFilters: { type: 'PRIORITY' },
        },
        {
          name: 'Search by name',
          query: { search: 'work' },
          expectedFilters: { search: 'work' },
        },
        {
          name: 'Filter unused tags',
          query: { unused: 'true' },
          expectedFilters: { unused: true },
        },
        {
          name: 'Filter by color',
          query: { color: '#FF0000' },
          expectedFilters: { color: '#FF0000' },
        },
        {
          name: 'Combined filters',
          query: { type: 'LABEL', search: 'project', unused: 'false' },
          expectedFilters: { type: 'LABEL', search: 'project', unused: false },
        },
      ];

      for (const scenario of filteringScenarios) {
        const req = createMockAuthRequest(mockUser, {
          method: 'GET',
          query: scenario.query,
        });
        const res = createMockResponse();

        mockTagService.findAll.mockResolvedValue([mockTag]);

        await tagsHandler(req, res);

        expect(mockTagService.findAll).toHaveBeenCalledWith(
          scenario.expectedFilters,
          {
            userId: 'user-123',
            requestId: 'test-request-123',
          }
        );
      }
    });
  });

  describe('Requirement 7.3: Tag Cleanup and Maintenance', () => {
    it('should cleanup unused tags', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        url: '/api/tags/cleanup',
      });
      const res = createMockResponse();

      const cleanupResult = {
        cleaned: true,
        deletedCount: 5,
        deletedTagIds: ['unused-tag-1', 'unused-tag-2'],
        message: '5 unused tags were removed',
      };

      mockTagService.cleanupUnusedTags.mockResolvedValue({
        deletedCount: cleanupResult.deletedCount,
        deletedTagIds: cleanupResult.deletedTagIds,
      });

      await cleanupHandler(req, res);

      expect(mockTagService.cleanupUnusedTags).toHaveBeenCalledWith({
        userId: 'user-123',
        requestId: 'test-request-123',
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(res, cleanupResult);
    });

    it('should merge duplicate tags', async () => {
      const mergeData = {
        sourceTagIds: ['tag-1', 'tag-2'],
        targetTagId: 'tag-3',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        url: '/api/tags/merge',
        body: mergeData,
      });
      const res = createMockResponse();

      const mergeResult = {
        merged: true,
        targetTag: mockTag,
        mergedCount: mergeData.sourceTagIds.length,
      };

      mockTagService.mergeTags.mockResolvedValue(mockTag);

      await mergeHandler(req, res);

      expect(mockTagService.mergeTags).toHaveBeenCalledWith(
        mergeData.sourceTagIds,
        mergeData.targetTagId,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mergeResult);
    });
  });

  describe('Requirement 7.4: Tag Statistics and Analytics', () => {
    it('should provide tag usage statistics', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        url: '/api/tags/stats',
      });
      const res = createMockResponse();

      const tagStats = {
        totalTags: 25,
        tagsByType: {
          PRIORITY: 3,
          LABEL: 15,
          PROJECT: 4,
          PERSON: 2,
          LOCATION: 1,
        },
        mostUsedTags: [
          { name: 'work', count: 50 },
          { name: 'personal', count: 30 },
          { name: 'urgent', count: 20 },
        ],
        unusedTags: 5,
        averageTagsPerTask: 2.3,
      };

      mockTagService.getStatistics.mockResolvedValue(tagStats);

      await statsHandler(req, res);

      expect(mockTagService.getStatistics).toHaveBeenCalledWith({
        userId: 'user-123',
        requestId: 'test-request-123',
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(res, tagStats);
    });
  });

  describe('Individual Tag Operations', () => {
    it('should fetch a specific tag by ID', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'tag-123' },
      });
      const res = createMockResponse();

      mockTagService.findById.mockResolvedValue(mockTag);

      await tagHandler(req, res);

      expect(mockTagService.findById).toHaveBeenCalledWith(
        'tag-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, mockTag);
    });

    it('should update a tag', async () => {
      const updateData = {
        name: 'updated-tag',
        color: '#00FF00',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'PUT',
        query: { id: 'tag-123' },
        body: updateData,
      });
      const res = createMockResponse();

      const updatedTag = { ...mockTag, ...updateData };
      mockTagService.update.mockResolvedValue(updatedTag);

      await tagHandler(req, res);

      expect(mockTagService.update).toHaveBeenCalledWith(
        'tag-123',
        updateData,
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, updatedTag);
    });

    it('should delete a tag', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'tag-123' },
      });
      const res = createMockResponse();

      mockTagService.delete.mockResolvedValue(true);

      await tagHandler(req, res);

      expect(mockTagService.delete).toHaveBeenCalledWith(
        'tag-123',
        {
          userId: 'user-123',
          requestId: 'test-request-123',
        }
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(res, { deleted: true });
    });

    it('should return 404 for non-existent tag', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'GET',
        query: { id: 'non-existent' },
      });
      const res = createMockResponse();

      mockTagService.findById.mockResolvedValue(null);

      await tagHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Tag not found',
      });
    });
  });

  describe('Tag Integration with Tasks', () => {
    it('should handle tag creation during task creation', async () => {
      // This test simulates the flow where tags are created/associated during task creation
      const taskWithNewTags = {
        title: 'Project meeting with @john #urgent',
        tags: [
          {
            type: 'PERSON',
            name: 'john',
            value: '@john',
            displayText: '@john',
            iconName: 'person',
            color: '#4CAF50',
          },
          {
            type: 'LABEL',
            name: 'urgent',
            value: '#urgent',
            displayText: '#urgent',
            iconName: 'tag',
            color: '#FF5722',
          },
        ],
      };

      // This would typically be handled by the TaskService, but we're testing
      // that the tag system can support this integration
      for (const tagData of taskWithNewTags.tags) {
        const req = createMockAuthRequest(mockUser, {
          method: 'POST',
          body: tagData,
        });
        const res = createMockResponse();

        const createdTag = { ...mockTag, ...tagData, id: `tag-${tagData.name}` };
        mockTagService.create.mockResolvedValue(createdTag);

        await tagsHandler(req, res);

        expect(mockTagService.create).toHaveBeenCalledWith(
          tagData,
          {
            userId: 'user-123',
            requestId: 'test-request-123',
          }
        );
      }
    });

    it('should support tag-based task queries', async () => {
      // Test that the tag system supports the filtering needs of the task system
      const tagBasedQueries = [
        {
          name: 'Find all priority tags',
          query: { type: 'PRIORITY' },
        },
        {
          name: 'Find tags by partial name match',
          query: { search: 'proj' },
        },
        {
          name: 'Find frequently used tags',
          query: { minUsageCount: '5' },
        },
      ];

      for (const queryTest of tagBasedQueries) {
        const req = createMockAuthRequest(mockUser, {
          method: 'GET',
          query: queryTest.query,
        });
        const res = createMockResponse();

        mockTagService.findAll.mockResolvedValue([mockTag]);

        await tagsHandler(req, res);

        expect(mockTagService.findAll).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors for tag creation', async () => {
      const invalidTagData = {
        name: '', // Empty name
        type: 'INVALID_TYPE',
        color: 'not-a-hex-color',
      };

      const req = createMockAuthRequest(mockUser, {
        method: 'POST',
        body: invalidTagData,
      });
      const res = createMockResponse();

      mockTagService.create.mockRejectedValue(
        new Error('VALIDATION_ERROR: Tag name is required')
      );

      await tagsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Tag name is required',
      });
    });

    it('should handle authorization errors', async () => {
      const req = createMockAuthRequest(mockUser, {
        method: 'DELETE',
        query: { id: 'tag-123' },
      });
      const res = createMockResponse();

      mockTagService.delete.mockRejectedValue(
        new Error('AUTHORIZATION_ERROR: Access denied')
      );

      await tagHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    });

    it('should handle service errors gracefully', async () => {
      const req = createMockAuthRequest(mockUser, { method: 'GET' });
      const res = createMockResponse();

      mockTagService.findAll.mockRejectedValue(new Error('Database connection failed'));

      await tagsHandler(req, res);

      expect(mockSendError).toHaveBeenCalledWith(res, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Database connection failed',
      });
    });
  });
});
