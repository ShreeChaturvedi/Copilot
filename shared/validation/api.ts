/**
 * API validation schemas
 */

import { z } from 'zod';

/**
 * Pagination schemas
 */
export const paginationParamsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).optional(),
  cursor: z.string().optional(),
});

export const paginationMetaSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1),
  total: z.number().min(0),
  totalPages: z.number().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  nextCursor: z.string().optional(),
  prevCursor: z.string().optional(),
});

/**
 * Sorting schemas
 */
export const sortParamsSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Search schemas
 */
export const searchParamsSchema = z.object({
  q: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

/**
 * Base query schemas
 */
export const baseQueryParamsSchema = paginationParamsSchema
  .merge(sortParamsSchema)
  .merge(searchParamsSchema);

/**
 * API response schemas
 */
export const apiResponseSchema = z.object({
  data: z.any(),
  success: z.boolean(),
  error: z.string().optional(),
  details: z.any().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  fieldErrors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string().optional(),
  })).optional(),
  statusCode: z.number().min(100).max(599),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export const paginatedResponseSchema = apiResponseSchema.extend({
  data: z.array(z.any()),
  meta: paginationMetaSchema,
});

/**
 * Validation error schema
 */
export const validationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

/**
 * Health check schema
 */
export const healthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().min(0),
  database: z.object({
    status: z.enum(['connected', 'disconnected']),
    responseTime: z.number().min(0).optional(),
  }),
  cache: z.object({
    status: z.enum(['connected', 'disconnected']),
    responseTime: z.number().min(0).optional(),
  }).optional(),
});

/**
 * WebSocket message schemas
 */
export const webSocketMessageSchema = z.object({
  type: z.string(),
  data: z.any(),
  timestamp: z.string().datetime(),
  userId: z.string().cuid().optional(),
});

export const taskUpdateMessageSchema = webSocketMessageSchema.extend({
  type: z.enum(['task:created', 'task:updated', 'task:deleted']),
  data: z.object({
    taskId: z.string().cuid(),
    task: z.any().optional(),
    userId: z.string().cuid(),
  }),
});

export const eventUpdateMessageSchema = webSocketMessageSchema.extend({
  type: z.enum(['event:created', 'event:updated', 'event:deleted']),
  data: z.object({
    eventId: z.string().cuid(),
    event: z.any().optional(),
    userId: z.string().cuid(),
  }),
});

export const calendarUpdateMessageSchema = webSocketMessageSchema.extend({
  type: z.enum(['calendar:created', 'calendar:updated', 'calendar:deleted']),
  data: z.object({
    calendarId: z.string().cuid(),
    calendar: z.any().optional(),
    userId: z.string().cuid(),
  }),
});

/**
 * File upload schemas
 */
export const fileUploadResponseSchema = z.object({
  id: z.string().cuid(),
  fileName: z.string(),
  fileUrl: z.string().url(),
  fileType: z.string(),
  fileSize: z.number().min(0),
  uploadedAt: z.string().datetime(),
});

export const fileUploadRequestSchema = z.object({
  taskId: z.string().cuid().optional(),
});

/**
 * Bulk operation schemas
 */
export const bulkUpdateRequestSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one ID is required'),
  updates: z.record(z.any()),
});

export const bulkDeleteRequestSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one ID is required'),
});

/**
 * Request validation middleware schema
 */
export const requestValidationSchema = z.object({
  body: z.any().optional(),
  query: z.record(z.any()).optional(),
  params: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * Rate limiting schemas
 */
export const rateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000), // At least 1 second
  max: z.number().min(1),
  message: z.string().optional(),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false),
});

/**
 * CORS configuration schema
 */
export const corsConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string()), z.boolean()]),
  credentials: z.boolean().default(false),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  allowedHeaders: z.array(z.string()).optional(),
  exposedHeaders: z.array(z.string()).optional(),
  maxAge: z.number().optional(),
});

/**
 * Environment validation schema
 */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.number().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
});

/**
 * Validation helper functions
 */
export const validatePagination = (page: number, limit: number): { valid: boolean; errors: string[] } => {
  const result = paginationParamsSchema.safeParse({ page, limit });
  
  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

export const validateSortParams = (sortBy?: string, sortOrder?: string): { valid: boolean; errors: string[] } => {
  const result = sortParamsSchema.safeParse({ sortBy, sortOrder });
  
  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

export const validateEnvironment = (env: Record<string, any>): { valid: boolean; errors: string[]; data?: any } => {
  const result = environmentSchema.safeParse(env);
  
  if (result.success) {
    return { valid: true, errors: [], data: result.data };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
};

/**
 * Create standardized API response
 */
export const createApiResponse = <T>(data: T, success: boolean = true, error?: string): z.infer<typeof apiResponseSchema> => {
  return {
    data,
    success,
    error,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create standardized API error
 */
export const createApiError = (
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any,
  fieldErrors?: Array<{ field: string; message: string; code?: string }>
): z.infer<typeof apiErrorSchema> => {
  return {
    code,
    message,
    statusCode,
    details,
    fieldErrors,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create paginated response
 */
export const createPaginatedResponse = <T>(
  data: T[],
  meta: z.infer<typeof paginationMetaSchema>
): z.infer<typeof paginatedResponseSchema> => {
  return {
    data,
    success: true,
    timestamp: new Date().toISOString(),
    meta,
  };
};

/**
 * Type exports from schemas
 */
export type PaginationParams = z.infer<typeof paginationParamsSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type SortParams = z.infer<typeof sortParamsSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;
export type BaseQueryParams = z.infer<typeof baseQueryParamsSchema>;
export type ApiResponse<T = any> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & { data: T };
export type ApiError = z.infer<typeof apiErrorSchema>;
export type PaginatedResponse<T = any> = Omit<z.infer<typeof paginatedResponseSchema>, 'data'> & { data: T[] };
export type ValidationError = z.infer<typeof validationErrorSchema>;
export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
export type WebSocketMessage<T = any> = Omit<z.infer<typeof webSocketMessageSchema>, 'data'> & { data: T };
export type TaskUpdateMessage = z.infer<typeof taskUpdateMessageSchema>;
export type EventUpdateMessage = z.infer<typeof eventUpdateMessageSchema>;
export type CalendarUpdateMessage = z.infer<typeof calendarUpdateMessageSchema>;
export type FileUploadResponse = z.infer<typeof fileUploadResponseSchema>;
export type FileUploadRequest = z.infer<typeof fileUploadRequestSchema>;
export type BulkUpdateRequest<T = any> = Omit<z.infer<typeof bulkUpdateRequestSchema>, 'updates'> & { updates: T };
export type BulkDeleteRequest = z.infer<typeof bulkDeleteRequestSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
export type CorsConfig = z.infer<typeof corsConfigSchema>;
export type Environment = z.infer<typeof environmentSchema>;