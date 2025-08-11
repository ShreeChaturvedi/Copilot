/**
 * Example API route implementations using the new infrastructure
 * This file demonstrates how to use the middleware and utilities
 */
import { z } from 'zod';
import { createApiHandler, createCrudHandler } from '../utils/apiHandler';
import { HttpMethod } from '../types/api';
import { sendSuccess } from '../middleware/errorHandler';
import { NotFoundError, ValidationError } from '../types/api';
import type { AuthenticatedRequest } from '../types/api';
import type { VercelResponse } from '@vercel/node';

/**
 * Example 1: Simple CRUD handler
 */
// Example schema used in docs/examples
// Example schema retained for documentation usage
export const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

// Type derived from example schema to ensure it's referenced
export type ExampleUser = z.infer<typeof userSchema>;

export const exampleCrudHandler = createCrudHandler({
  get: async (req: AuthenticatedRequest, res: VercelResponse) => {
    // Simulate fetching users
    const users = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    ];
    
    sendSuccess(res, users);
  },
  
  post: async (req: AuthenticatedRequest, res: VercelResponse) => {
    // Body validation is handled by the middleware
    const userData = req.body;
    
    // Simulate creating user
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      createdAt: new Date().toISOString(),
    };
    
    sendSuccess(res, newUser, 201);
  },
  
  requireAuth: true,
  rateLimit: 'api',
});

/**
 * Example 2: Advanced API handler with custom validation
 */
const taskQuerySchema = z.object({
  completed: z.string().optional().transform(val => val === 'true'),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  scheduledDate: z.string().datetime().optional(),
  tags: z.array(z.string()).max(20).default([]),
});

export const exampleTaskHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const query = req.query;
      
      // Simulate database query with filters
      const tasks = [
        {
          id: '1',
          title: 'Example task',
          completed: false,
          priority: 'high',
          userId: req.user?.id,
        },
      ].filter(task => {
        if (query.completed !== undefined && task.completed !== query.completed) {
          return false;
        }
        if (query.priority && task.priority !== query.priority) {
          return false;
        }
        return true;
      });
      
      // Simulate pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;
      const paginatedTasks = tasks.slice(offset, offset + limit);
      
      sendSuccess(res, paginatedTasks, 200, {
        pagination: {
          page,
          limit,
          total: tasks.length,
          totalPages: Math.ceil(tasks.length / limit),
        },
      });
    },
    requireAuth: true,
    validateQuery: taskQuerySchema,
  },
  
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const taskData = req.body;
      
      // Simulate creating task
      const newTask = {
        id: Date.now().toString(),
        ...taskData,
        userId: req.user?.id,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      sendSuccess(res, newTask, 201);
    },
    requireAuth: true,
    validateBody: createTaskSchema,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50,
    },
  },
});

/**
 * Example 3: Resource-specific handler (e.g., /api/tasks/[id])
 */
const updateTaskSchema = createTaskSchema.partial();

export const exampleTaskByIdHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const taskId = req.query.id as string;
      
      // Simulate database lookup
      const task = {
        id: taskId,
        title: 'Example task',
        completed: false,
        priority: 'medium',
        userId: req.user?.id,
      };
      
      if (!task) {
        throw new NotFoundError('Task');
      }
      
      // Check ownership
      if (task.userId !== req.user?.id) {
        throw new NotFoundError('Task'); // Don't reveal existence
      }
      
      sendSuccess(res, task);
    },
    requireAuth: true,
  },
  
  [HttpMethod.PUT]: {
    method: HttpMethod.PUT,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const taskId = req.query.id as string;
      const updates = req.body;
      
      // Simulate database update
      const updatedTask = {
        id: taskId,
        ...updates,
        userId: req.user?.id,
        updatedAt: new Date().toISOString(),
      };
      
      sendSuccess(res, updatedTask);
    },
    requireAuth: true,
    validateBody: updateTaskSchema,
  },
  
  [HttpMethod.DELETE]: {
    method: HttpMethod.DELETE,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const taskId = req.query.id as string;
      
      // Simulate database deletion
      // In real implementation, check ownership first
      
      sendSuccess(res, { deleted: true, id: taskId });
    },
    requireAuth: true,
  },
});

/**
 * Example 4: File upload handler
 */
export const exampleUploadHandler = createApiHandler({
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      // File upload logic would go here
      // This is just a placeholder
      
      const file = {
        id: Date.now().toString(),
        fileName: 'example.jpg',
        fileUrl: 'https://example.com/files/example.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        uploadedAt: new Date().toISOString(),
      };
      
      sendSuccess(res, file, 201);
    },
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
    },
  },
});

/**
 * Example 5: Error handling demonstration
 */
export const exampleErrorHandler = createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      const errorType = req.query.type as string;
      
      switch (errorType) {
        case 'validation':
          throw new ValidationError([
            { field: 'email', message: 'Invalid email format', code: 'invalid_string' },
          ]);
          
        case 'notfound':
          throw new NotFoundError('Resource');
          
        case 'server':
          throw new Error('Simulated server error');
          
        default:
          sendSuccess(res, { message: 'No error triggered' });
      }
    },
  },
});