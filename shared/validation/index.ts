/**
 * Validation schemas and utilities barrel export
 */

// Core validation schemas
export * from './auth';
export * from './tasks';
export * from './calendars';
export * from './events';

// API types with namespace to avoid conflicts
export * as ApiTypes from './api';

// Validation middleware and utilities (with namespace to avoid conflicts)
export * as ValidationUtils from './middleware';

// Re-export Zod for convenience
export { z } from 'zod';

// Common validation patterns and helpers
import { z } from 'zod';

/**
 * Custom Zod extensions
 */
declare module 'zod' {
  interface ZodString {
    cuid(message?: string): ZodString;
  }
}

// Extend Zod with custom CUID validation
z.ZodString.prototype.cuid = function(message?: string) {
  return this.regex(/^c[a-z0-9]{24}$/, message || 'Invalid CUID format');
};

/**
 * Schema versioning utilities
 */
export interface SchemaVersion {
  version: string;
  schema: z.ZodSchema;
  migrations?: Array<{
    from: string;
    to: string;
    migrate: (data: any) => any;
  }>;
}

export class SchemaRegistry {
  private schemas = new Map<string, Map<string, SchemaVersion>>();

  /**
   * Register a schema version
   */
  register(name: string, version: SchemaVersion): void {
    if (!this.schemas.has(name)) {
      this.schemas.set(name, new Map());
    }
    this.schemas.get(name)!.set(version.version, version);
  }

  /**
   * Get schema by name and version
   */
  get(name: string, version: string): z.ZodSchema | undefined {
    return this.schemas.get(name)?.get(version)?.schema;
  }

  /**
   * Get latest schema version
   */
  getLatest(name: string): SchemaVersion | undefined {
    const versions = this.schemas.get(name);
    if (!versions) return undefined;

    const sortedVersions = Array.from(versions.values()).sort((a, b) => 
      b.version.localeCompare(a.version, undefined, { numeric: true })
    );

    return sortedVersions[0];
  }

  /**
   * Migrate data between schema versions
   */
  migrate(name: string, data: any, fromVersion: string, toVersion: string): any {
    const fromSchema = this.schemas.get(name)?.get(fromVersion);
    const toSchema = this.schemas.get(name)?.get(toVersion);

    if (!fromSchema || !toSchema) {
      throw new Error(`Schema version not found: ${name}@${fromVersion} or ${name}@${toVersion}`);
    }

    // Find migration path
    const migration = fromSchema.migrations?.find(m => 
      m.from === fromVersion && m.to === toVersion
    );

    if (!migration) {
      throw new Error(`No migration path from ${fromVersion} to ${toVersion}`);
    }

    return migration.migrate(data);
  }

  /**
   * List all registered schemas
   */
  list(): Array<{ name: string; versions: string[] }> {
    return Array.from(this.schemas.entries()).map(([name, versions]) => ({
      name,
      versions: Array.from(versions.keys()),
    }));
  }
}

/**
 * Global schema registry instance
 */
export const schemaRegistry = new SchemaRegistry();

/**
 * Validation error codes
 */
export const ValidationErrorCodes = {
  REQUIRED: 'required',
  INVALID_TYPE: 'invalid_type',
  INVALID_FORMAT: 'invalid_format',
  TOO_SHORT: 'too_small',
  TOO_LONG: 'too_big',
  INVALID_EMAIL: 'invalid_string',
  INVALID_URL: 'invalid_string',
  INVALID_DATE: 'invalid_date',
  CUSTOM: 'custom',
} as const;

/**
 * Default error messages
 */
export const defaultErrorMessages: Record<string, string> = {
  [ValidationErrorCodes.REQUIRED]: 'This field is required',
  [ValidationErrorCodes.INVALID_TYPE]: 'Invalid data type',
  [ValidationErrorCodes.INVALID_FORMAT]: 'Invalid format',
  [ValidationErrorCodes.TOO_SHORT]: 'Value is too short',
  [ValidationErrorCodes.TOO_LONG]: 'Value is too long',
  [ValidationErrorCodes.INVALID_EMAIL]: 'Invalid email address',
  [ValidationErrorCodes.INVALID_DATE]: 'Invalid date',
};

/**
 * Validation utilities
 */
export const validationUtils = {
  /**
   * Check if value is empty
   */
  isEmpty: (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * Sanitize string input
   */
  sanitizeString: (value: string): string => {
    return value.trim().replace(/\s+/g, ' ');
  },

  /**
   * Normalize email
   */
  normalizeEmail: (email: string): string => {
    return email.toLowerCase().trim();
  },

  /**
   * Generate validation summary
   */
  summarizeErrors: (errors: Array<{ field: string; message: string }>): string => {
    const fieldCount = new Set(errors.map(e => e.field)).size;
    const errorCount = errors.length;
    
    if (fieldCount === 1) {
      return `1 field has ${errorCount} error${errorCount > 1 ? 's' : ''}`;
    }
    
    return `${fieldCount} fields have ${errorCount} error${errorCount > 1 ? 's' : ''}`;
  },

  /**
   * Group errors by field
   */
  groupErrorsByField: (errors: Array<{ field: string; message: string }>): Record<string, string[]> => {
    return errors.reduce((acc, error) => {
      if (!acc[error.field]) {
        acc[error.field] = [];
      }
      acc[error.field].push(error.message);
      return acc;
    }, {} as Record<string, string[]>);
  },
};

/**
 * Schema composition helpers
 */
export const schemaHelpers = {
  /**
   * Create optional field
   */
  optional: <T>(schema: z.ZodSchema<T>) => schema.optional(),

  /**
   * Create nullable field
   */
  nullable: <T>(schema: z.ZodSchema<T>) => schema.nullable(),

  /**
   * Create array field with min/max constraints
   */
  array: <T>(
    schema: z.ZodSchema<T>,
    options?: { min?: number; max?: number }
  ) => {
    let arraySchema = z.array(schema);
    if (options?.min !== undefined) {
      arraySchema = arraySchema.min(options.min);
    }
    if (options?.max !== undefined) {
      arraySchema = arraySchema.max(options.max);
    }
    return arraySchema;
  },

  /**
   * Create union field
   */
  union: <T extends [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]>(...schemas: T) => 
    z.union(schemas),

  /**
   * Create discriminated union
   */
  discriminatedUnion: <T extends string, U extends Record<T, z.ZodTypeAny>>(
    discriminator: T,
    options: U
  ) => z.discriminatedUnion(discriminator, Object.values(options) as any),

  /**
   * Create conditional schema
   */
  conditional: <T, U>(
    condition: (data: T) => boolean,
    trueSchema: z.ZodSchema<U>,
    falseSchema: z.ZodSchema<U>
  ) => z.any().superRefine((data, ctx) => {
    const schema = condition(data) ? trueSchema : falseSchema;
    const result = schema.safeParse(data);
    if (!result.success) {
      result.error.errors.forEach(error => {
        ctx.addIssue(error);
      });
    }
  }),
};