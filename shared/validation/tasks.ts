/**
 * Task validation schemas
 */

import { z } from 'zod';

/**
 * Priority enum schema
 */
export const prioritySchema = z.enum(['low', 'medium', 'high']);

/**
 * Tag type enum schema
 */
export const tagTypeSchema = z.enum(['date', 'time', 'priority', 'location', 'person', 'label', 'project']);

/**
 * Task tag schema
 */
export const taskTagSchema = z.object({
  id: z.string().cuid(),
  type: tagTypeSchema,
  value: z.union([z.string(), z.date(), prioritySchema]),
  displayText: z.string().min(1, 'Display text is required'),
  iconName: z.string().min(1, 'Icon name is required'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
});

/**
 * Parsed tag schema (extends task tag with position info)
 */
export const parsedTagSchema = taskTagSchema.extend({
  startIndex: z.number().min(0),
  endIndex: z.number().min(0),
  originalText: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1, 'Parser source is required'),
});

/**
 * Parsed metadata schema
 */
export const parsedMetadataSchema = z.object({
  originalInput: z.string(),
  cleanTitle: z.string().min(1, 'Clean title is required'),
  confidence: z.number().min(0).max(1).optional(),
  parsedBy: z.string().optional(),
});

/**
 * File attachment schema
 */
export const fileAttachmentSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'File name is required'),
  type: z.string().min(1, 'File type is required'),
  size: z.number().min(0, 'File size must be non-negative'),
  url: z.string().url('Invalid file URL'),
  uploadedAt: z.date(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
  taskId: z.string().cuid(),
});

/**
 * Voice attachment schema
 */
export const voiceAttachmentSchema = z.object({
  id: z.string().cuid(),
  duration: z.number().min(0, 'Duration must be non-negative'),
  transcription: z.string().optional(),
  url: z.string().url('Invalid voice note URL'),
  recordedAt: z.date(),
  waveformData: z.array(z.number()).optional(),
  taskId: z.string().cuid(),
});

/**
 * Task schema
 */
export const taskSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1, 'Task title is required').max(500, 'Task title must be less than 500 characters'),
  completed: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  scheduledDate: z.date().optional(),
  priority: prioritySchema.optional(),
  taskListId: z.string().cuid().optional(),
  userId: z.string().cuid(),
  tags: z.array(taskTagSchema).optional(),
  parsedMetadata: parsedMetadataSchema.optional(),
  attachments: z.array(fileAttachmentSchema).optional(),
  voiceNote: voiceAttachmentSchema.optional(),
  richDescription: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  estimatedDuration: z.number().min(1, 'Duration must be at least 1 minute').max(1440, 'Duration cannot exceed 24 hours').optional(),
});

/**
 * Task list schema
 */
export const taskListSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'Task list name is required').max(100, 'Task list name must be less than 100 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  icon: z.string().min(1, 'Icon is required'),
  taskCount: z.number().min(0).default(0),
  isVisible: z.boolean().default(true),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  userId: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Task folder schema
 */
export const taskFolderSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name must be less than 100 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  iconId: z.string().min(1, 'Icon is required'),
  taskCount: z.number().min(0).default(0),
  completedCount: z.number().min(0).default(0),
  tasks: z.array(taskSchema),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  userId: z.string().cuid(),
});

/**
 * Task creation schemas
 */
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500, 'Task title must be less than 500 characters'),
  taskListId: z.string().cuid().optional(),
  scheduledDate: z.string().datetime().optional().or(z.date().optional()),
  priority: prioritySchema.optional(),
  tags: z.array(z.object({
    type: tagTypeSchema,
    value: z.string(),
    displayText: z.string().min(1, 'Display text is required'),
    iconName: z.string().min(1, 'Icon name is required'),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  })).optional(),
  parsedMetadata: z.object({
    originalInput: z.string(),
    cleanTitle: z.string().min(1, 'Clean title is required'),
  }).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500, 'Task title must be less than 500 characters').optional(),
  completed: z.boolean().optional(),
  scheduledDate: z.string().datetime().optional().or(z.date().optional()),
  priority: prioritySchema.optional(),
  taskListId: z.string().cuid().optional(),
  richDescription: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  estimatedDuration: z.number().min(1, 'Duration must be at least 1 minute').max(1440, 'Duration cannot exceed 24 hours').optional(),
});

/**
 * Task list creation schemas
 */
export const createTaskListSchema = z.object({
  name: z.string().min(1, 'Task list name is required').max(100, 'Task list name must be less than 100 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  icon: z.string().min(1, 'Icon is required'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

export const updateTaskListSchema = z.object({
  name: z.string().min(1, 'Task list name is required').max(100, 'Task list name must be less than 100 characters').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  icon: z.string().min(1, 'Icon is required').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isVisible: z.boolean().optional(),
});

/**
 * Task query schemas
 */
export const taskQuerySchema = z.object({
  taskListId: z.string().cuid().optional(),
  completed: z.boolean().optional(),
  scheduledDate: z.string().datetime().optional(),
  priority: prioritySchema.optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'scheduledDate', 'priority', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const taskListQuerySchema = z.object({
  search: z.string().optional(),
  visible: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Bulk operation schemas
 */
export const bulkUpdateTasksSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one task ID is required'),
  updates: updateTaskSchema,
});

export const bulkDeleteTasksSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one task ID is required'),
});

/**
 * File upload schemas
 */
export const fileUploadSchema = z.object({
  taskId: z.string().cuid().optional(),
});

/**
 * Validation helper functions
 */
export const validateTaskTitle = (title: string): { valid: boolean; errors: string[] } => {
  const result = z.string()
    .min(1, 'Task title is required')
    .max(500, 'Task title must be less than 500 characters')
    .safeParse(title);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

export const validateColor = (color: string): boolean => {
  return z.string().regex(/^#[0-9A-F]{6}$/i).safeParse(color).success;
};

export const validatePriority = (priority: string): boolean => {
  return prioritySchema.safeParse(priority).success;
};

/**
 * Type exports from schemas
 */
export type Priority = z.infer<typeof prioritySchema>;
export type TagType = z.infer<typeof tagTypeSchema>;
export type TaskTag = z.infer<typeof taskTagSchema>;
export type ParsedTag = z.infer<typeof parsedTagSchema>;
export type ParsedMetadata = z.infer<typeof parsedMetadataSchema>;
export type FileAttachment = z.infer<typeof fileAttachmentSchema>;
export type VoiceAttachment = z.infer<typeof voiceAttachmentSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
export type TaskFolder = z.infer<typeof taskFolderSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskSchema>;
export type CreateTaskListRequest = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListRequest = z.infer<typeof updateTaskListSchema>;
export type TaskQueryParams = z.infer<typeof taskQuerySchema>;
export type TaskListQueryParams = z.infer<typeof taskListQuerySchema>;
export type BulkUpdateTasksRequest = z.infer<typeof bulkUpdateTasksSchema>;
export type BulkDeleteTasksRequest = z.infer<typeof bulkDeleteTasksSchema>;
export type FileUploadRequest = z.infer<typeof fileUploadSchema>;