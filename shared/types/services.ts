/**
 * Service layer type definitions
 */

import type { ID, BaseFilter, BaseSort, Pagination } from './common';
import type { Task, TaskList, TaskFilters } from './tasks';
import type { CalendarEvent, EventFilters } from './events';
import type { Calendar } from './calendars';
import type { User, AuthTokens, LoginCredentials, RegisterData } from './auth';

/**
 * Base service interface for CRUD operations
 */
export interface BaseService<T, CreateDTO, UpdateDTO> {
  /** Find all entities with optional filters */
  findAll(userId: ID, filters?: BaseFilter): Promise<T[]>;
  /** Find entity by ID */
  findById(id: ID, userId: ID): Promise<T | null>;
  /** Create new entity */
  create(data: CreateDTO, userId: ID): Promise<T>;
  /** Update existing entity */
  update(id: ID, data: UpdateDTO, userId: ID): Promise<T>;
  /** Delete entity */
  delete(id: ID, userId: ID): Promise<void>;
  /** Count entities */
  count(userId: ID, filters?: BaseFilter): Promise<number>;
}

/**
 * Paginated service interface
 */
export interface PaginatedService<T, CreateDTO, UpdateDTO, FilterType = BaseFilter> 
  extends BaseService<T, CreateDTO, UpdateDTO> {
  /** Find entities with pagination */
  findPaginated(
    userId: ID, 
    page: number, 
    limit: number, 
    filters?: FilterType,
    sort?: BaseSort
  ): Promise<{
    data: T[];
    pagination: Pagination;
  }>;
}

/**
 * Authentication service interface
 */
export interface AuthService {
  /** Register new user */
  register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }>;
  /** Login user */
  login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }>;
  /** Login with Google OAuth */
  loginWithGoogle(googleToken: string): Promise<{ user: User; tokens: AuthTokens }>;
  /** Refresh access token */
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  /** Logout user */
  logout(userId: ID, tokenId: string): Promise<void>;
  /** Verify JWT token */
  verifyToken(token: string): Promise<{ userId: ID; tokenId: string }>;
  /** Get user by ID */
  getUserById(userId: ID): Promise<User | null>;
  /** Update user profile */
  updateProfile(userId: ID, data: Partial<User>): Promise<User>;
  /** Change password */
  changePassword(userId: ID, oldPassword: string, newPassword: string): Promise<void>;
  /** Request password reset */
  requestPasswordReset(email: string): Promise<void>;
  /** Reset password */
  resetPassword(token: string, newPassword: string): Promise<void>;
}

/**
 * Task service interface
 */
export interface TaskService extends PaginatedService<Task, CreateTaskDTO, UpdateTaskDTO, TaskFilters> {
  /** Toggle task completion */
  toggleCompletion(id: ID, userId: ID): Promise<Task>;
  /** Find tasks by task list */
  findByTaskList(taskListId: ID, userId: ID): Promise<Task[]>;
  /** Find tasks by scheduled date */
  findByScheduledDate(date: Date, userId: ID): Promise<Task[]>;
  /** Find overdue tasks */
  findOverdue(userId: ID): Promise<Task[]>;
  /** Search tasks */
  search(query: string, userId: ID): Promise<Task[]>;
  /** Bulk update tasks */
  bulkUpdate(ids: ID[], updates: Partial<UpdateTaskDTO>, userId: ID): Promise<Task[]>;
  /** Bulk delete tasks */
  bulkDelete(ids: ID[], userId: ID): Promise<void>;
  /** Get task statistics */
  getStats(userId: ID): Promise<TaskStats>;
}

/**
 * Task List service interface
 */
export interface TaskListService extends BaseService<TaskList, CreateTaskListDTO, UpdateTaskListDTO> {
  /** Get default task list for user */
  getDefault(userId: ID): Promise<TaskList>;
  /** Set default task list */
  setDefault(id: ID, userId: ID): Promise<TaskList>;
  /** Get task list with task count */
  getWithTaskCount(userId: ID): Promise<(TaskList & { taskCount: number })[]>;
  /** Reorder task lists */
  reorder(ids: ID[], userId: ID): Promise<TaskList[]>;
}

/**
 * Calendar service interface
 */
export interface CalendarService extends BaseService<Calendar, CreateCalendarDTO, UpdateCalendarDTO> {
  /** Get default calendar for user */
  getDefault(userId: ID): Promise<Calendar>;
  /** Set default calendar */
  setDefault(id: ID, userId: ID): Promise<Calendar>;
  /** Toggle calendar visibility */
  toggleVisibility(id: ID, userId: ID): Promise<Calendar>;
  /** Get visible calendars */
  getVisible(userId: ID): Promise<Calendar[]>;
}

/**
 * Event service interface
 */
export interface EventService extends PaginatedService<CalendarEvent, CreateEventDTO, UpdateEventDTO, EventFilters> {
  /** Find events by date range */
  findByDateRange(start: Date, end: Date, userId: ID): Promise<CalendarEvent[]>;
  /** Find events by calendar */
  findByCalendar(calendarId: ID, userId: ID): Promise<CalendarEvent[]>;
  /** Find upcoming events */
  findUpcoming(userId: ID, limit?: number): Promise<CalendarEvent[]>;
  /** Search events */
  search(query: string, userId: ID): Promise<CalendarEvent[]>;
  /** Get event conflicts */
  getConflicts(event: CreateEventDTO | UpdateEventDTO, userId: ID): Promise<CalendarEvent[]>;
}

/**
 * File service interface
 */
export interface FileService {
  /** Upload file */
  upload(file: Buffer, fileName: string, mimeType: string, userId: ID): Promise<FileUploadResult>;
  /** Delete file */
  delete(fileId: ID, userId: ID): Promise<void>;
  /** Get file URL */
  getUrl(fileId: ID, userId: ID): Promise<string>;
  /** Get file metadata */
  getMetadata(fileId: ID, userId: ID): Promise<FileMetadata>;
}

/**
 * Notification service interface
 */
export interface NotificationService {
  /** Send email notification */
  sendEmail(to: string, subject: string, content: string): Promise<void>;
  /** Send push notification */
  sendPush(userId: ID, title: string, body: string): Promise<void>;
  /** Schedule reminder */
  scheduleReminder(userId: ID, eventId: ID, reminderTime: Date): Promise<void>;
  /** Cancel reminder */
  cancelReminder(userId: ID, eventId: ID): Promise<void>;
}

/**
 * Cache service interface
 */
export interface CacheService {
  /** Get cached value */
  get<T>(key: string): Promise<T | null>;
  /** Set cached value */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete cached value */
  delete(key: string): Promise<void>;
  /** Clear cache by pattern */
  clearPattern(pattern: string): Promise<void>;
  /** Invalidate user cache */
  invalidateUser(userId: ID): Promise<void>;
}

/**
 * Real-time service interface
 */
export interface RealtimeService {
  /** Emit event to user */
  emitToUser(userId: ID, event: string, data: any): Promise<void>;
  /** Emit event to room */
  emitToRoom(room: string, event: string, data: any): Promise<void>;
  /** Join user to room */
  joinRoom(userId: ID, room: string): Promise<void>;
  /** Leave user from room */
  leaveRoom(userId: ID, room: string): Promise<void>;
}

/**
 * Job service interface
 */
export interface JobService {
  /** Schedule job */
  schedule<T>(type: string, payload: T, runAt?: Date): Promise<void>;
  /** Process jobs */
  process<T>(type: string, handler: (payload: T) => Promise<void>): void;
  /** Get job status */
  getStatus(jobId: ID): Promise<JobStatus>;
  /** Cancel job */
  cancel(jobId: ID): Promise<void>;
}

/**
 * DTO types for service operations
 */
export interface CreateTaskDTO {
  title: string;
  taskListId?: ID;
  scheduledDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  tags?: Array<{
    type: string;
    value: string;
    displayText: string;
    iconName: string;
    color?: string;
  }>;
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
}

export interface UpdateTaskDTO {
  title?: string;
  completed?: boolean;
  scheduledDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  taskListId?: ID;
  richDescription?: string;
  estimatedDuration?: number;
}

export interface CreateTaskListDTO {
  name: string;
  color: string;
  icon: string;
  description?: string;
}

export interface UpdateTaskListDTO {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  isVisible?: boolean;
}

export interface CreateCalendarDTO {
  name: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateCalendarDTO {
  name?: string;
  color?: string;
  description?: string;
  visible?: boolean;
  isDefault?: boolean;
}

export interface CreateEventDTO {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarId: ID;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

export interface UpdateEventDTO {
  title?: string;
  start?: Date;
  end?: Date;
  description?: string;
  location?: string;
  calendarId?: ID;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

/**
 * Service result types
 */
export interface FileUploadResult {
  id: ID;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

export interface FileMetadata {
  id: ID;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

export interface JobStatus {
  id: ID;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  error?: string;
  result?: any;
}

/**
 * Service error types
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id?: ID) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
      404
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}
/*
*
 * Backend-specific service implementations
 */

/**
 * Prisma service interface for database operations
 */
export interface PrismaService {
  /** Get Prisma client instance */
  getClient(): any;
  /** Execute transaction */
  transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T>;
  /** Disconnect from database */
  disconnect(): Promise<void>;
}

/**
 * Email service configuration
 */
export interface EmailConfig {
  /** SMTP host */
  host: string;
  /** SMTP port */
  port: number;
  /** Use secure connection */
  secure: boolean;
  /** Authentication credentials */
  auth: {
    user: string;
    pass: string;
  };
  /** Default from address */
  from: string;
}

/**
 * File storage configuration
 */
export interface StorageConfig {
  /** Storage provider */
  provider: 'local' | 'vercel-blob' | 's3';
  /** Storage bucket/container */
  bucket?: string;
  /** Storage region */
  region?: string;
  /** Access credentials */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Base URL for file access */
  baseUrl?: string;
}

/**
 * Background job configuration
 */
export interface JobConfig {
  /** Job queue provider */
  provider: 'memory' | 'redis' | 'database';
  /** Redis connection URL */
  redisUrl?: string;
  /** Default job options */
  defaultOptions: {
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Application environment */
  env: 'development' | 'production' | 'test';
  /** Server port */
  port: number;
  /** Database configuration */
  database: {
    url: string;
    maxConnections?: number;
  };
  /** JWT configuration */
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  /** OAuth configuration */
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  };
  /** Email configuration */
  email: EmailConfig;
  /** Storage configuration */
  storage: StorageConfig;
  /** Job configuration */
  jobs: JobConfig;
  /** CORS configuration */
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  /** Rate limiting configuration */
  rateLimit: {
    windowMs: number;
    max: number;
  };
}