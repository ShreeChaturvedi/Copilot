/**
 * Task API service layer
 * Mock implementation that will be replaced with actual API calls
 */

import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskTag } from '../../types';
import { taskStorage } from '../../utils/storage';
import { validateTaskTitle } from '../../utils/validation';

/**
 * Task creation data
 */
export interface CreateTaskData {
  title: string;
  scheduledDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  tags?: TaskTag[];
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
}

/**
 * Task update data
 */
export interface UpdateTaskData {
  title?: string;
  completed?: boolean;
  scheduledDate?: Date;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Simulate network delay for more realistic behavior
 */
const simulateNetworkDelay = (ms: number = 150) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Task API service
 */
export const taskApi = {
  /**
   * Fetch all tasks from storage
   */
  fetchTasks: async (): Promise<Task[]> => {
    await simulateNetworkDelay(100);
    return taskStorage.getTasks();
  },

  /**
   * Create a new task
   */
  createTask: async (data: CreateTaskData): Promise<Task> => {
    // Validate task data
    const titleErrors = validateTaskTitle(data.title);
    if (titleErrors.length > 0) {
      throw new Error(titleErrors[0].message);
    }

    const newTask: Task = {
      id: uuidv4(),
      title: data.title.trim(),
      completed: false,
      createdAt: new Date(),
      scheduledDate: data.scheduledDate,
      priority: data.priority || 'medium',
      tags: data.tags,
      parsedMetadata: data.parsedMetadata,
    };

    await simulateNetworkDelay(200);

    const success = taskStorage.addTask(newTask);
    if (!success) {
      throw new Error('Failed to save task');
    }

    return newTask;
  },

  /**
   * Update an existing task
   */
  updateTask: async (id: string, data: UpdateTaskData): Promise<Task> => {
    // Validate title if provided
    if (data.title !== undefined) {
      const titleErrors = validateTaskTitle(data.title);
      if (titleErrors.length > 0) {
        throw new Error(titleErrors[0].message);
      }
    }

    await simulateNetworkDelay(150);

    const success = taskStorage.updateTask(id, data);
    if (!success) {
      throw new Error('Failed to update task');
    }

    // Return updated task
    const tasks = taskStorage.getTasks();
    const updatedTask = tasks.find(task => task.id === id);
    if (!updatedTask) {
      throw new Error('Task not found after update');
    }

    return updatedTask;
  },

  /**
   * Delete a task
   */
  deleteTask: async (id: string): Promise<void> => {
    await simulateNetworkDelay(100);

    const success = taskStorage.deleteTask(id);
    if (!success) {
      throw new Error('Failed to delete task');
    }
  },

  /**
   * Schedule a task for a specific date
   */
  scheduleTask: async (id: string, scheduledDate: Date): Promise<Task> => {
    return taskApi.updateTask(id, { scheduledDate });
  },

  /**
   * Toggle task completion status
   */
  toggleTask: async (id: string): Promise<Task> => {
    const tasks = taskStorage.getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) {
      throw new Error('Task not found');
    }

    return taskApi.updateTask(id, { completed: !task.completed });
  },
};