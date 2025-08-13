/**
 * Task API service layer
 * Replaces localStorage mocks with real API calls to /api/tasks and related endpoints
 */

import type { Task, TaskTag, FileAttachment } from "@shared/types";
import { validateTaskTitle } from '../../utils/validation';
import { useAuthStore } from '@/stores/authStore';
import { taskStorage } from '../../utils/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Task creation data
 */
export interface CreateTaskData {
  title: string;
  taskListId?: string;
  scheduledDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  tags?: TaskTag[];
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    url: string; // For MVP store data URLs or Blob URLs
  }>;
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

const apiBase = '/api';

function authHeaders(): Record<string, string> {
  try {
    // Access store lazily at call time
    const token = useAuthStore.getState().getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function reviveTaskDates(task: Record<string, unknown>): Task {
  // Base fields and dates
  const revived: Record<string, unknown> = {
    ...task,
    // Normalize priority enum from backend (LOW|MEDIUM|HIGH) to frontend ('low'|'medium'|'high')
    priority: typeof task.priority === 'string' 
      ? String(task.priority).toLowerCase()
      : task.priority,
    createdAt: task.createdAt ? new Date(task.createdAt as string) : new Date(),
    updatedAt: task.updatedAt ? new Date(task.updatedAt as string) : new Date(),
    completedAt: task.completedAt ? new Date(task.completedAt as string) : undefined,
    scheduledDate: task.scheduledDate ? new Date(task.scheduledDate as string) : undefined,
  };

  // Attachments normalization (server join shape -> FileAttachment)
  if (Array.isArray(task.attachments)) {
    revived.attachments = (task.attachments as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id ?? a["attachmentId"] ?? cryptoRandomId()),
      name: String(a.fileName ?? a.name ?? ''),
      type: String(a.fileType ?? a.type ?? ''),
      size: Number(a.fileSize ?? a.size ?? 0),
      url: String(a.fileUrl ?? a.url ?? ''),
      uploadedAt: a.createdAt ? new Date(a.createdAt as string) : new Date(),
      taskId: String(a.taskId ?? ''),
    })) as FileAttachment[];
  }

  // Tags normalization (server join shape -> TaskTag[])
  if (Array.isArray((task as any).tags)) {
    const rawTags = (task as any).tags as Array<Record<string, unknown>>;
    revived.tags = rawTags.map((t) => {
      const tagEntity = (t as any).tag as Record<string, unknown> | undefined;
      return {
        // Prefer relation id for uniqueness; fallback to tag entity id or a generated id
        id: String(t.id ?? tagEntity?.id ?? cryptoRandomId()),
        type: String((t as any).type ?? tagEntity?.type ?? 'label').toLowerCase() as any,
        value: String((t as any).value ?? tagEntity?.name ?? ''),
        displayText: String((t as any).displayText ?? tagEntity?.name ?? ''),
        iconName: String((t as any).iconName ?? 'Tag'),
        color: (t as any).color ? String((t as any).color) : (tagEntity?.color ? String(tagEntity.color) : undefined),
      };
    });
  }

  return revived as Task;
}

// Lightweight random id for client-only normalization fallbacks
function cryptoRandomId() {
  try {
    // browsers only
    const arr = new Uint32Array(2);
    (globalThis.crypto || ({} as any).msCrypto).getRandomValues(arr);
    return `tmp_${arr[0].toString(16)}${arr[1].toString(16)}`;
  } catch {
    return `tmp_${Math.random().toString(36).slice(2)}`;
  }
}

function isJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

/**
 * Task API service
 */
export const taskApi = {
  /**
   * Fetch all tasks from backend
   */
  fetchTasks: async (): Promise<Task[]> => {
    const res = await fetch(`${apiBase}/tasks`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) {
      // Fallback to local storage (dev) if SSR route not available
      return taskStorage.getTasks();
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch tasks');
    const items = Array.isArray(body.data?.data) ? body.data.data : (body.data || []); // support paginated or plain
    return items.map(reviveTaskDates);
  },

  /**
   * Create a new task
   */
  createTask: async (data: CreateTaskData): Promise<Task> => {
    // Validate task data
    const titleErrors = validateTaskTitle(data.title);
    if (titleErrors.length > 0) throw new Error(titleErrors[0].message);

    // Create task
    const res = await fetch(`${apiBase}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title: data.title,
        taskListId: data.taskListId,
        scheduledDate: data.scheduledDate?.toISOString(),
        priority: data.priority?.toUpperCase(), // Backend uses enum LOW|MEDIUM|HIGH
        tags: data.tags?.map(t => ({
          type: t.type.toUpperCase(),
          name: typeof t.value === 'string' ? String(t.value).toLowerCase() : String(t.value),
          value: String(t.value),
          displayText: t.displayText,
          iconName: t.iconName,
          color: t.color,
        })),
        originalInput: data.parsedMetadata?.originalInput,
        cleanTitle: data.parsedMetadata?.cleanTitle,
      }),
    });
    if (!isJson(res)) {
      // Fallback to local storage
      const newTask: Task = {
        id: uuidv4(),
        title: data.title.trim(),
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledDate: data.scheduledDate,
        priority: data.priority || 'medium',
        tags: data.tags,
        parsedMetadata: data.parsedMetadata,
        attachments: data.attachments?.map((f, idx) => ({
          id: uuidv4(),
          name: f.name,
          type: f.type,
          size: f.size,
          url: f.url,
          uploadedAt: new Date(),
          taskId: 'local-' + idx,
        })),
      } as Task;
      taskStorage.addTask(newTask);
      return newTask;
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to create task');
    const created: Task = reviveTaskDates(body.data);

    // Upload attachments (if any)
    if (data.attachments && data.attachments.length > 0) {
      for (const f of data.attachments) {
        const attRes = await fetch(`${apiBase}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            fileName: f.name,
            fileType: f.type,
            fileSize: f.size,
            fileUrl: f.url, // For MVP we send data URL or blob URL
            taskId: created.id,
          }),
        });
        if (!attRes.ok) {
          // Non-fatal: continue
          if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error('Attachment upload failed');
          }
        }
      }
      // Refetch single task to include attachments
      const refreshed = await taskApi.fetchTasks();
      const withAttachments = refreshed.find(t => t.id === created.id);
      return withAttachments || created;
    }

    return created;
  },

  /**
   * Update an existing task
   */
  updateTask: async (id: string, data: UpdateTaskData): Promise<Task> => {
    if (data.title !== undefined) {
      const titleErrors = validateTaskTitle(data.title);
      if (titleErrors.length > 0) throw new Error(titleErrors[0].message);
    }

    const res = await fetch(`${apiBase}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        ...data,
        scheduledDate: data.scheduledDate?.toISOString(),
        priority: data.priority?.toUpperCase(),
      }),
    });
    if (!isJson(res)) {
      const ok = taskStorage.updateTask(id, {
        ...data,
      });
      if (!ok) throw new Error('Failed to update task');
      const tasks = taskStorage.getTasks();
      const updated = tasks.find(t => t.id === id);
      if (!updated) throw new Error('Task not found after update');
      return updated;
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to update task');
    return reviveTaskDates(body.data);
  },

  /**
   * Delete a task
   */
  deleteTask: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase}/tasks/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (!isJson(res)) {
      const ok = taskStorage.deleteTask(id);
      if (!ok) throw new Error('Failed to delete task');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || 'Failed to delete task');
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
    const res = await fetch(`${apiBase}/tasks/${id}?action=toggle`, {
      method: 'PATCH',
      headers: { ...authHeaders() },
    });
    if (!isJson(res)) {
      const tasks = taskStorage.getTasks();
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error('Task not found');
      const ok = taskStorage.updateTask(id, { completed: !task.completed });
      if (!ok) throw new Error('Failed to toggle task');
      const refreshed = taskStorage.getTasks();
      const updated = refreshed.find(t => t.id === id)!;
      return updated;
    }
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to toggle task');
    return reviveTaskDates(body.data);
  },
};