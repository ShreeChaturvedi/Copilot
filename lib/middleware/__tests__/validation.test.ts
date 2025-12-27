/**
 * Validation middleware test suite
 * Tests Zod schema validation for body, query, params, and common schemas
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  validateRequest,
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
} from '../validation';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers';
import type { AuthenticatedRequest } from '../../types/api';

describe('Validation Middleware', () => {
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  describe('validateRequest', () => {
    it('should validate request body successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const req = createMockRequest({
        body: {
          name: 'John Doe',
          age: 30,
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toEqual({
        name: 'John Doe',
        age: 30,
      });
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should fail validation for invalid body', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const req = createMockRequest({
        body: {
          name: 'John Doe',
          age: 'not a number',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      expect(vi.mocked(res.json)).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'body.age',
              }),
            ]),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate query parameters successfully', async () => {
      const schema = z.object({
        page: z.string(),
        limit: z.string(),
      });

      const req = createMockRequest({
        query: {
          page: '1',
          limit: '20',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ query: schema });
      await middleware(req, res, mockNext);

      expect(req.validated?.query).toEqual({
        page: '1',
        limit: '20',
      });
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should fail validation for invalid query parameters', async () => {
      const schema = z.object({
        page: z.string(),
        limit: z.string().min(1),
      });

      const req = createMockRequest({
        query: {
          page: '1',
          limit: '', // Empty string, should fail min(1)
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ query: schema });
      await middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate multiple targets (body and query)', async () => {
      const bodySchema = z.object({
        title: z.string(),
      });
      const querySchema = z.object({
        page: z.string(),
      });

      const req = createMockRequest({
        body: { title: 'Test Task' },
        query: { page: '1' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({
        body: bodySchema,
        query: querySchema,
      });
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toEqual({ title: 'Test Task' });
      expect(req.validated?.query).toEqual({ page: '1' });
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should include field path in validation errors', async () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
          age: z.number().min(18),
        }),
      });

      const req = createMockRequest({
        body: {
          user: {
            email: 'invalid-email',
            age: 15,
          },
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.user.email',
            code: 'invalid_string',
          }),
          expect.objectContaining({
            field: 'body.user.age',
            code: 'too_small',
          }),
        ])
      );
    });

    it('should handle missing required fields', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      const req = createMockRequest({
        body: {
          name: 'John',
          // email is missing
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.email',
          }),
        ])
      );
    });

    it('should handle optional fields', async () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
      });

      const req = createMockRequest({
        body: {
          name: 'Task Name',
          // description is optional
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toEqual({
        name: 'Task Name',
      });
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should transform data using Zod transforms', async () => {
      const schema = z.object({
        priority: z.string().transform(val => parseInt(val, 10)),
        tags: z.string().transform(val => val.split(',')),
      });

      const req = createMockRequest({
        body: {
          priority: '5',
          tags: 'work,important,urgent',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toEqual({
        priority: 5,
        tags: ['work', 'important', 'urgent'],
      });
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle validation errors from refine', async () => {
      const schema = z
        .object({
          password: z.string(),
          confirmPassword: z.string(),
        })
        .refine(data => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword'],
        });

      const req = createMockRequest({
        body: {
          password: 'password123',
          confirmPassword: 'different',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.confirmPassword',
            message: 'Passwords do not match',
          }),
        ])
      );
    });

    it('should include timestamp in error response', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const req = createMockRequest({
        body: {
          name: 123, // Wrong type
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });

      const beforeTime = new Date();
      await middleware(req, res, mockNext);
      const afterTime = new Date();

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      const timestamp = new Date(jsonCall.error?.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('validateBody', () => {
    it('should be a shorthand for body validation', async () => {
      const schema = z.object({
        title: z.string(),
      });

      const req = createMockRequest({
        body: {
          title: 'Test Title',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateBody(schema);
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toEqual({ title: 'Test Title' });
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('validateQuery', () => {
    it('should be a shorthand for query validation', async () => {
      const schema = z.object({
        search: z.string(),
      });

      const req = createMockRequest({
        query: {
          search: 'test query',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateQuery(schema);
      await middleware(req, res, mockNext);

      expect(req.validated?.query).toEqual({ search: 'test query' });
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('validateParams', () => {
    it('should be a shorthand for params validation', async () => {
      const schema = z.object({
        id: z.string(),
      });

      const req = createMockRequest({
        url: '/api/tasks/[id]',
        query: {
          id: '123',
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateParams(schema);
      await middleware(req, res, mockNext);

      expect(req.validated?.params).toBeDefined();
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('commonSchemas', () => {
    describe('pagination', () => {
      it('should validate pagination parameters with defaults', async () => {
        const req = createMockRequest({
          query: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.pagination);
        await middleware(req, res, mockNext);

        expect(req.validated?.query).toEqual({
          page: 1,
          limit: 20,
          offset: 0,
        });
        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should transform string pagination parameters to numbers', async () => {
        const req = createMockRequest({
          query: {
            page: '3',
            limit: '50',
            offset: '100',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.pagination);
        await middleware(req, res, mockNext);

        expect(req.validated?.query).toEqual({
          page: 3,
          limit: 50,
          offset: 100,
        });
      });

      it('should reject invalid page number (< 1)', async () => {
        const req = createMockRequest({
          query: {
            page: '0',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.pagination);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject invalid limit (> 100)', async () => {
        const req = createMockRequest({
          query: {
            limit: '200',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.pagination);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject negative offset', async () => {
        const req = createMockRequest({
          query: {
            offset: '-10',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.pagination);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('id', () => {
      it('should validate ID parameter', async () => {
        const req = createMockRequest({
          url: '/api/tasks/[id]',
          query: {
            id: 'task-123',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateParams(commonSchemas.id);
        await middleware(req, res, mockNext);

        expect(req.validated?.params).toEqual({
          id: 'task-123',
        });
        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should reject empty ID', async () => {
        const req = createMockRequest({
          url: '/api/tasks/[id]',
          query: {
            id: '',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateParams(commonSchemas.id);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('dateRange', () => {
      it('should validate date range parameters', async () => {
        const req = createMockRequest({
          query: {
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.dateRange);
        await middleware(req, res, mockNext);

        expect(req.validated?.query).toEqual({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        });
        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should accept optional date parameters', async () => {
        const req = createMockRequest({
          query: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.dateRange);
        await middleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should reject invalid date format', async () => {
        const req = createMockRequest({
          query: {
            startDate: 'not-a-date',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.dateRange);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject end date before start date', async () => {
        const req = createMockRequest({
          query: {
            startDate: '2024-12-31',
            endDate: '2024-01-01',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.dateRange);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        const jsonCall = vi.mocked(res.json).mock.calls[0][0];
        expect(jsonCall.error?.message).toContain('Start date must be before end date');
      });

      it('should accept same start and end date', async () => {
        const req = createMockRequest({
          query: {
            startDate: '2024-06-15',
            endDate: '2024-06-15',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.dateRange);
        await middleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledOnce();
      });
    });

    describe('search', () => {
      it('should validate search parameters with defaults', async () => {
        const req = createMockRequest({
          query: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.search);
        await middleware(req, res, mockNext);

        expect(req.validated?.query).toEqual({
          sort: 'desc', // Default value
        });
        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should validate search query string', async () => {
        const req = createMockRequest({
          query: {
            q: 'search term',
            sort: 'asc',
            sortBy: 'createdAt',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.search);
        await middleware(req, res, mockNext);

        expect(req.validated?.query).toEqual({
          q: 'search term',
          sort: 'asc',
          sortBy: 'createdAt',
        });
        expect(mockNext).toHaveBeenCalledOnce();
      });

      it('should reject invalid sort direction', async () => {
        const req = createMockRequest({
          query: {
            sort: 'invalid',
          },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        const middleware = validateQuery(commonSchemas.search);
        await middleware(req, res, mockNext);

        expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should accept asc and desc sort values', async () => {
        const reqAsc = createMockRequest({
          query: { sort: 'asc' },
        }) as AuthenticatedRequest;
        const resAsc = createMockResponse();

        const middlewareAsc = validateQuery(commonSchemas.search);
        await middlewareAsc(reqAsc, resAsc, mockNext);

        expect(reqAsc.validated?.query).toEqual({ sort: 'asc' });

        const reqDesc = createMockRequest({
          query: { sort: 'desc' },
        }) as AuthenticatedRequest;
        const resDesc = createMockResponse();

        const middlewareDesc = validateQuery(commonSchemas.search);
        await middlewareDesc(reqDesc, resDesc, mockNext);

        expect(reqDesc.validated?.query).toEqual({ sort: 'desc' });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body', async () => {
      const schema = z.object({
        name: z.string().optional(),
      });

      const req = createMockRequest({
        body: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle null body', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const req = createMockRequest({
        body: null,
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(vi.mocked(res.status)).toHaveBeenCalledWith(400);
    });

    it('should handle array body', async () => {
      const schema = z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      );

      const req = createMockRequest({
        body: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      expect(req.validated?.body).toHaveLength(2);
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle deeply nested validation errors', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            settings: z.object({
              theme: z.enum(['light', 'dark']),
            }),
          }),
        }),
      });

      const req = createMockRequest({
        body: {
          user: {
            profile: {
              settings: {
                theme: 'invalid',
              },
            },
          },
        },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware = validateRequest({ body: schema });
      await middleware(req, res, mockNext);

      const jsonCall = vi.mocked(res.json).mock.calls[0][0];
      expect(jsonCall.error?.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'body.user.profile.settings.theme',
          }),
        ])
      );
    });

    it('should preserve validated data across middleware', async () => {
      const schema1 = z.object({
        name: z.string(),
      });
      const schema2 = z.object({
        page: z.string(),
      });

      const req = createMockRequest({
        body: { name: 'Test' },
        query: { page: '1' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const middleware1 = validateBody(schema1);
      const middleware2 = validateQuery(schema2);

      await middleware1(req, res, mockNext);
      await middleware2(req, res, mockNext);

      expect(req.validated?.body).toEqual({ name: 'Test' });
      expect(req.validated?.query).toEqual({ page: '1' });
    });
  });
});
