/**
 * Validation middleware utilities
 */

import { z } from 'zod';

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationErrorItem[];
}

/**
 * Field validation error
 */
export interface ValidationErrorItem {
  field: string;
  message: string;
  code?: string;
}

// Re-export as ValidationError for backward compatibility
export type ValidationError = ValidationErrorItem;

/**
 * Validation middleware options
 */
export interface ValidationOptions {
  /** Whether to strip unknown fields */
  stripUnknown?: boolean;
  /** Whether to abort on first error */
  abortEarly?: boolean;
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}

/**
 * Request validation schemas
 */
export interface RequestValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}

/**
 * Validated request type
 */
export interface ValidatedRequest<
  TBody = any,
  TQuery = any,
  TParams = any,
  THeaders = any
> {
  body: TBody;
  query: TQuery;
  params: TParams;
  headers: THeaders;
}

/**
 * Validation error class
 */
export class ValidationErrorClass extends Error {
  constructor(
    public errors: ValidationErrorItem[],
    message: string = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  /**
   * Get errors for a specific field
   */
  getFieldErrors(field: string): ValidationErrorItem[] {
    return this.errors.filter(error => error.field === field);
  }

  /**
   * Check if field has errors
   */
  hasFieldError(field: string): boolean {
    return this.errors.some(error => error.field === field);
  }

  /**
   * Get first error message for a field
   */
  getFirstFieldError(field: string): string | undefined {
    const error = this.errors.find(error => error.field === field);
    return error?.message;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}

/**
 * Validate data against schema
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors: ValidationErrorItem[] = result.error.errors.map(error => ({
      field: error.path.join('.'),
      message: options.errorMessages?.[error.code] || error.message,
      code: error.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: error instanceof Error ? error.message : 'Unknown validation error',
      }],
    };
  }
}

/**
 * Validate request data
 */
export function validateRequest<
  TBody = any,
  TQuery = any,
  TParams = any,
  THeaders = any
>(
  schemas: RequestValidationSchemas,
  request: {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: unknown;
  },
  options: ValidationOptions = {}
): ValidationResult<ValidatedRequest<TBody, TQuery, TParams, THeaders>> {
  const errors: ValidationError[] = [];
  const validatedData: any = {};

  // Validate body
  if (schemas.body && request.body !== undefined) {
    const result = validateData(schemas.body, request.body, options);
    if (result.success) {
      validatedData.body = result.data;
    } else {
      errors.push(...(result.errors || []));
    }
  }

  // Validate query
  if (schemas.query && request.query !== undefined) {
    const result = validateData(schemas.query, request.query, options);
    if (result.success) {
      validatedData.query = result.data;
    } else {
      errors.push(...(result.errors || []));
    }
  }

  // Validate params
  if (schemas.params && request.params !== undefined) {
    const result = validateData(schemas.params, request.params, options);
    if (result.success) {
      validatedData.params = result.data;
    } else {
      errors.push(...(result.errors || []));
    }
  }

  // Validate headers
  if (schemas.headers && request.headers !== undefined) {
    const result = validateData(schemas.headers, request.headers, options);
    if (result.success) {
      validatedData.headers = result.data;
    } else {
      errors.push(...(result.errors || []));
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validatedData as ValidatedRequest<TBody, TQuery, TParams, THeaders>,
  };
}

/**
 * Create validation middleware function
 */
export function createValidationMiddleware<
  TBody = any,
  TQuery = any,
  TParams = any,
  THeaders = any
>(
  schemas: RequestValidationSchemas,
  options: ValidationOptions = {}
) {
  return (request: {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: unknown;
  }) => {
    const result = validateRequest<TBody, TQuery, TParams, THeaders>(
      schemas,
      request,
      options
    );

    if (!result.success) {
      throw new ValidationErrorClass(result.errors || []);
    }

    return result.data!;
  };
}

/**
 * Schema composition utilities
 */
export class SchemaBuilder {
  private schema: z.ZodSchema = z.any();

  constructor(initialSchema?: z.ZodSchema) {
    if (initialSchema) {
      this.schema = initialSchema;
    }
  }

  /**
   * Add field validation
   */
  field<T>(name: string, fieldSchema: z.ZodSchema<T>): SchemaBuilder {
    if (this.schema instanceof z.ZodObject) {
      this.schema = this.schema.extend({ [name]: fieldSchema });
    } else {
      this.schema = z.object({ [name]: fieldSchema });
    }
    return this;
  }

  /**
   * Make field optional
   */
  optional(name: string): SchemaBuilder {
    if (this.schema instanceof z.ZodObject) {
      const shape = this.schema.shape;
      if (shape[name]) {
        shape[name] = shape[name].optional();
        this.schema = z.object(shape);
      }
    }
    return this;
  }

  /**
   * Add custom validation
   */
  refine<T>(
    check: (data: T) => boolean,
    message: string | { message: string; path?: string[] }
  ): SchemaBuilder {
    this.schema = this.schema.refine(check, message);
    return this;
  }

  /**
   * Transform data
   */
  transform<T, U>(transform: (data: T) => U): SchemaBuilder {
    this.schema = this.schema.transform(transform);
    return this;
  }

  /**
   * Build final schema
   */
  build<T = any>(): z.ZodSchema<T> {
    return this.schema as z.ZodSchema<T>;
  }
}

/**
 * Common validation patterns
 */
export const commonValidations = {
  /**
   * ID validation (CUID)
   */
  id: () => z.string().cuid('Invalid ID format'),

  /**
   * Email validation
   */
  email: () => z.string().email('Invalid email format'),

  /**
   * Password validation
   */
  password: () => z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  /**
   * URL validation
   */
  url: () => z.string().url('Invalid URL format'),

  /**
   * Color hex validation
   */
  color: () => z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),

  /**
   * Date validation
   */
  date: () => z.string().datetime('Invalid date format').or(z.date()),

  /**
   * Pagination validation
   */
  pagination: () => z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }),

  /**
   * Sort validation
   */
  sort: (fields: string[]) => z.object({
    sortBy: z.enum(fields as [string, ...string[]]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  /**
   * Search validation
   */
  search: () => z.object({
    q: z.string().optional(),
  }),

  /**
   * File validation
   */
  file: (maxSize: number = 10 * 1024 * 1024, allowedTypes?: string[]) => {
    if (allowedTypes && allowedTypes.length > 0) {
      return z.object({
        name: z.string().min(1, 'File name is required'),
        size: z.number().max(maxSize, `File size must be less than ${maxSize} bytes`),
        type: z.enum(allowedTypes as [string, ...string[]], {
          errorMap: () => ({ message: `File type must be one of: ${allowedTypes.join(', ')}` }),
        }),
      });
    }

    return z.object({
      name: z.string().min(1, 'File name is required'),
      size: z.number().max(maxSize, `File size must be less than ${maxSize} bytes`),
      type: z.string().min(1, 'File type is required'),
    });
  },
};

/**
 * Validation error formatter
 */
export function formatValidationErrors(errors: ValidationErrorItem[]): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const error of errors) {
    if (!formatted[error.field]) {
      formatted[error.field] = [];
    }
    formatted[error.field].push(error.message);
  }

  return formatted;
}

/**
 * Get first validation error message
 */
export function getFirstValidationError(errors: ValidationErrorItem[]): string | undefined {
  return errors[0]?.message;
}

/**
 * Check if validation errors contain specific field
 */
export function hasValidationError(errors: ValidationErrorItem[], field: string): boolean {
  return errors.some(error => error.field === field);
}