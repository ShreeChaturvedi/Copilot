/**
 * Database-specific type definitions
 */

import type { BaseEntity, UserOwnedEntity, ID } from './common';
import type { Priority, TagType } from './tasks';

/**
 * Database User model
 */
export interface DbUser extends BaseEntity {
  /** User email (unique) */
  email: string;
  /** User display name */
  name: string;
  /** Hashed password (nullable for OAuth users) */
  password?: string;
  /** Google OAuth ID */
  googleId?: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** User timezone */
  timezone: string;
  /** User profile */
  profile?: DbUserProfile;
  /** User calendars */
  calendars?: DbCalendar[];
  /** User task lists */
  taskLists?: DbTaskList[];
  /** User tasks */
  tasks?: DbTask[];
  /** User events */
  events?: DbEvent[];
}

/**
 * Database User Profile model
 */
export interface DbUserProfile extends BaseEntity {
  /** User ID (foreign key) */
  userId: ID;
  /** User bio */
  bio?: string;
  /** User preferences (JSON) */
  preferences?: Record<string, any>;
  /** Related user */
  user?: DbUser;
}

/**
 * Database Calendar model
 */
export interface DbCalendar extends UserOwnedEntity {
  /** Calendar name */
  name: string;
  /** Calendar color */
  color: string;
  /** Calendar description */
  description?: string;
  /** Whether calendar is visible */
  visible: boolean;
  /** Whether this is the default calendar */
  isDefault: boolean;
  /** Related user */
  user?: DbUser;
  /** Calendar events */
  events?: DbEvent[];
}

/**
 * Database Event model
 */
export interface DbEvent extends UserOwnedEntity {
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Event start date/time */
  start: Date;
  /** Event end date/time */
  end: Date;
  /** Whether event is all-day */
  allDay: boolean;
  /** Event location */
  location?: string;
  /** Event notes (HTML) */
  notes?: string;
  /** Event color override */
  color?: string;
  /** Recurrence rule (RRULE) */
  recurrence?: string;
  /** Calendar ID (foreign key) */
  calendarId: ID;
  /** Related user */
  user?: DbUser;
  /** Related calendar */
  calendar?: DbCalendar;
  /** Event reminders */
  reminders?: DbEventReminder[];
}

/**
 * Database Event Reminder model
 */
export interface DbEventReminder extends BaseEntity {
  /** Event ID (foreign key) */
  eventId: ID;
  /** Minutes before event */
  minutesBefore: number;
  /** Reminder method */
  method: 'email' | 'notification' | 'popup';
  /** Whether reminder is enabled */
  enabled: boolean;
  /** Related event */
  event?: DbEvent;
}

/**
 * Database Task List model
 */
export interface DbTaskList extends UserOwnedEntity {
  /** Task list name */
  name: string;
  /** Task list color */
  color: string;
  /** Task list icon */
  icon: string;
  /** Task list description */
  description?: string;
  /** Whether task list is visible */
  isVisible: boolean;
  /** Related user */
  user?: DbUser;
  /** Tasks in this list */
  tasks?: DbTask[];
}

/**
 * Database Task model
 */
export interface DbTask extends UserOwnedEntity {
  /** Task title */
  title: string;
  /** Whether task is completed */
  completed: boolean;
  /** When task was completed */
  completedAt?: Date;
  /** Task scheduled date */
  scheduledDate?: Date;
  /** Task priority */
  priority: Priority;
  /** Rich description (HTML) */
  richDescription?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Original input text */
  originalInput?: string;
  /** Cleaned title after parsing */
  cleanTitle?: string;
  /** Task list ID (foreign key) */
  taskListId?: ID;
  /** Related user */
  user?: DbUser;
  /** Related task list */
  taskList?: DbTaskList;
  /** Task tags */
  tags?: DbTaskTag[];
  /** Task attachments */
  attachments?: DbAttachment[];
}

/**
 * Database Tag model
 */
export interface DbTag extends BaseEntity {
  /** Tag name */
  name: string;
  /** Tag type */
  type: TagType;
  /** Tag color */
  color?: string;
  /** Tasks with this tag */
  tasks?: DbTaskTag[];
}

/**
 * Database Task-Tag junction model
 */
export interface DbTaskTag extends BaseEntity {
  /** Task ID (foreign key) */
  taskId: ID;
  /** Tag ID (foreign key) */
  tagId: ID;
  /** Tag value (serialized) */
  value: string;
  /** Display text */
  displayText: string;
  /** Icon name */
  iconName: string;
  /** Related task */
  task?: DbTask;
  /** Related tag */
  tag?: DbTag;
}

/**
 * Database Attachment model
 */
export interface DbAttachment extends BaseEntity {
  /** Original filename */
  fileName: string;
  /** File URL */
  fileUrl: string;
  /** MIME type */
  fileType: string;
  /** File size in bytes */
  fileSize: number;
  /** Thumbnail URL (for images) */
  thumbnailUrl?: string;
  /** Task ID (foreign key) */
  taskId: ID;
  /** Related task */
  task?: DbTask;
}

/**
 * Database Session model (for JWT blacklisting)
 */
export interface DbSession extends BaseEntity {
  /** User ID (foreign key) */
  userId: ID;
  /** JWT token ID */
  tokenId: string;
  /** Token expiration */
  expiresAt: Date;
  /** Whether session is revoked */
  revoked: boolean;
  /** Related user */
  user?: DbUser;
}

/**
 * Database Job model (for background jobs)
 */
export interface DbJob extends BaseEntity {
  /** Job type */
  type: string;
  /** Job payload (JSON) */
  payload: Record<string, any>;
  /** Job status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Number of attempts */
  attempts: number;
  /** Maximum attempts */
  maxAttempts: number;
  /** Next run time */
  runAt: Date;
  /** Error message (if failed) */
  error?: string;
  /** Job result (JSON) */
  result?: Record<string, any>;
}

/**
 * Database query options
 */
export interface DbQueryOptions {
  /** Include related entities */
  include?: Record<string, boolean | DbQueryOptions>;
  /** Select specific fields */
  select?: Record<string, boolean>;
  /** Where conditions */
  where?: Record<string, any>;
  /** Order by */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Limit results */
  take?: number;
  /** Skip results */
  skip?: number;
  /** Cursor for pagination */
  cursor?: Record<string, any>;
}

/**
 * Database transaction interface
 */
export interface DbTransaction {
  /** Commit transaction */
  commit(): Promise<void>;
  /** Rollback transaction */
  rollback(): Promise<void>;
  /** Execute query within transaction */
  query<T>(sql: string, params?: any[]): Promise<T>;
}

/**
 * Database connection interface
 */
export interface DbConnection {
  /** Start transaction */
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
  /** Execute raw query */
  query<T>(sql: string, params?: any[]): Promise<T>;
  /** Close connection */
  close(): Promise<void>;
  /** Check connection health */
  ping(): Promise<boolean>;
}

/**
 * Database migration interface
 */
export interface DbMigration {
  /** Migration version */
  version: string;
  /** Migration name */
  name: string;
  /** Up migration */
  up: (connection: DbConnection) => Promise<void>;
  /** Down migration */
  down: (connection: DbConnection) => Promise<void>;
}

/**
 * Database seeder interface
 */
export interface DbSeeder {
  /** Seeder name */
  name: string;
  /** Run seeder */
  run: (connection: DbConnection) => Promise<void>;
  /** Rollback seeder */
  rollback: (connection: DbConnection) => Promise<void>;
}