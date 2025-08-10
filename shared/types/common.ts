/**
 * Common utility types and interfaces
 */

/**
 * Generic ID type
 */
export type ID = string;

/**
 * Timestamp type (ISO string)
 */
export type Timestamp = string;

/**
 * Color hex code
 */
export type ColorHex = string;

/**
 * Base entity interface
 */
export interface BaseEntity {
  /** Unique identifier */
  id: ID;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * User-owned entity interface
 */
export interface UserOwnedEntity extends BaseEntity {
  /** User ID who owns this entity */
  userId: ID;
}

/**
 * Soft-deletable entity interface
 */
export interface SoftDeletableEntity extends BaseEntity {
  /** Deletion timestamp (null if not deleted) */
  deletedAt?: Date;
}

/**
 * Generic filter interface
 */
export interface BaseFilter {
  /** Search query */
  search?: string;
  /** Creation date range */
  createdAfter?: Date;
  createdBefore?: Date;
  /** Update date range */
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Generic sort interface
 */
export interface BaseSort {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Pagination interface
 */
export interface Pagination {
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total items */
  total: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
}

/**
 * Cursor-based pagination
 */
export interface CursorPagination {
  /** Current cursor */
  cursor?: string;
  /** Next cursor */
  nextCursor?: string;
  /** Previous cursor */
  prevCursor?: string;
  /** Items per page */
  limit: number;
  /** Has more items */
  hasMore: boolean;
}

/**
 * Generic result wrapper
 */
export interface Result<T, E = Error> {
  /** Success flag */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error (if failed) */
  error?: E;
}

/**
 * Optional wrapper
 */
export type Optional<T> = T | null | undefined;

/**
 * Partial deep - makes all properties optional recursively
 */
export type PartialDeep<T> = {
  [P in keyof T]?: T[P] extends object ? PartialDeep<T[P]> : T[P];
};

/**
 * Required deep - makes all properties required recursively
 */
export type RequiredDeep<T> = {
  [P in keyof T]-?: T[P] extends object ? RequiredDeep<T[P]> : T[P];
};

/**
 * Pick by type - pick properties of a specific type
 */
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Omit by type - omit properties of a specific type
 */
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/**
 * Create type - omit system fields for creation
 */
export type CreateType<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Update type - make all fields optional except id
 */
export type UpdateType<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> & {
  id: ID;
};

/**
 * Database model type - includes system fields
 */
export type DatabaseModel<T> = T & BaseEntity;

/**
 * API model type - serialized for API responses
 */
export type ApiModel<T extends BaseEntity> = Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Event emitter types
 */
export interface EventEmitter<T = any> {
  on(event: string, listener: (data: T) => void): void;
  off(event: string, listener: (data: T) => void): void;
  emit(event: string, data: T): void;
}

/**
 * Disposable interface
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Async disposable interface
 */
export interface AsyncDisposable {
  dispose(): Promise<void>;
}

/**
 * Configuration interface
 */
export interface Config {
  [key: string]: any;
}

/**
 * Environment variables
 */
export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT?: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  REDIS_URL?: string;
  VERCEL_URL?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

/**
 * Cache interface
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Queue interface
 */
export interface Queue<T = any> {
  add(job: T, options?: any): Promise<void>;
  process(handler: (job: T) => Promise<void>): void;
}

/**
 * Storage interface
 */
export interface Storage {
  upload(file: Buffer, key: string, options?: any): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

/**
 * Metrics interface
 */
export interface Metrics {
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  decrement(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, value: number, tags?: Record<string, string>): void;
}/**

 * Additional utility types for common patterns
 */

/**
 * Async function type
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Event handler type
 */
export type EventHandler<T = any> = (event: T) => void;

/**
 * Async event handler type
 */
export type AsyncEventHandler<T = any> = (event: T) => Promise<void>;

/**
 * Constructor type
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Mixin type
 */
export type Mixin<T extends Constructor> = T & Constructor;

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Deep mutable type (opposite of DeepReadonly)
 */
export type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

/**
 * Non-empty array type
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Tuple to union type
 */
export type TupleToUnion<T extends readonly unknown[]> = T[number];

/**
 * Union to intersection type
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * Exact type (prevents excess properties)
 */
export type Exact<T, U extends T> = T & Record<Exclude<keyof U, keyof T>, never>;

/**
 * Brand type for nominal typing
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Opaque type alias
 */
export type Opaque<T, K> = T & { readonly __opaque: K };

/**
 * JSON serializable type
 */
export type JsonSerializable = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonSerializable[] 
  | { [key: string]: JsonSerializable };

/**
 * Flatten type - removes one level of nesting
 */
export type Flatten<T> = T extends (infer U)[] ? U : T;

/**
 * Head type - gets first element of tuple
 */
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;

/**
 * Tail type - gets all but first element of tuple
 */
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];

/**
 * Length type - gets length of tuple
 */
export type Length<T extends readonly unknown[]> = T['length'];

/**
 * Reverse type - reverses tuple
 */
export type Reverse<T extends readonly unknown[]> = T extends readonly [...infer Rest, infer Last]
  ? [Last, ...Reverse<Rest>]
  : [];

/**
 * Join type - joins string tuple with separator
 */
export type Join<T extends readonly string[], D extends string = ','> = T extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : '';

/**
 * Split type - splits string by separator
 */
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

/**
 * Capitalize type - capitalizes first letter
 */
export type Capitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S;

/**
 * Uncapitalize type - uncapitalizes first letter
 */
export type Uncapitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : S;

/**
 * CamelCase type - converts kebab-case to camelCase
 */
export type CamelCase<S extends string> = S extends `${infer P1}-${infer P2}${infer P3}`
  ? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
  : S;

/**
 * KebabCase type - converts camelCase to kebab-case
 */
export type KebabCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '-' : ''}${Lowercase<T>}${KebabCase<U>}`
  : S;

/**
 * SnakeCase type - converts camelCase to snake_case
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${SnakeCase<U>}`
  : S;