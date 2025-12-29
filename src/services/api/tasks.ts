/**
 * Task API service layer
 * Replaces localStorage mocks with real API calls to /api/tasks and related endpoints
 */

import type { Task, TaskTag, FileAttachment } from '@shared/types';
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
  /** Frontend status; maps to backend enum. */
  status?: 'not_started' | 'in_progress' | 'done';
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
    priority:
      typeof task.priority === 'string'
        ? String(task.priority).toLowerCase()
        : task.priority,
    createdAt: task.createdAt ? new Date(task.createdAt as string) : new Date(),
    updatedAt: task.updatedAt ? new Date(task.updatedAt as string) : new Date(),
    completedAt: task.completedAt
      ? new Date(task.completedAt as string)
      : undefined,
    scheduledDate: task.scheduledDate
      ? new Date(task.scheduledDate as string)
      : undefined,
  };

  // Normalize status enum from backend (NOT_STARTED|IN_PROGRESS|DONE) to frontend ('not_started'|'in_progress'|'done')
  const statusRaw = typeof task.status === 'string' ? task.status : '';
  if (statusRaw) {
    const mapped =
      statusRaw === 'DONE'
        ? 'done'
        : statusRaw === 'IN_PROGRESS'
          ? 'in_progress'
          : statusRaw === 'NOT_STARTED'
            ? 'not_started'
            : undefined;
    if (mapped) revived.status = mapped;
  }

  // Attachments normalization (server join shape -> FileAttachment)
  if (Array.isArray(task.attachments)) {
    revived.attachments = (
      task.attachments as Array<Record<string, unknown>>
    ).map((attachment) => ({
      id: String(
        attachment.id ?? attachment['attachmentId'] ?? cryptoRandomId()
      ),
      name: String(attachment.fileName ?? attachment.name ?? ''),
      type: String(attachment.fileType ?? attachment.type ?? ''),
      size: Number(attachment.fileSize ?? attachment.size ?? 0),
      url: String(attachment.fileUrl ?? attachment.url ?? ''),
      uploadedAt: attachment.createdAt
        ? new Date(attachment.createdAt as string)
        : new Date(),
      thumbnailUrl:
        typeof attachment.thumbnailUrl === 'string'
          ? attachment.thumbnailUrl
          : undefined,
      taskId: String(attachment.taskId ?? ''),
    })) as FileAttachment[];
  }

  // Tags normalization (server join shape -> TaskTag[])
  if (Array.isArray(task.tags)) {
    const rawTags = task.tags as Array<Record<string, unknown>>;
    revived.tags = rawTags.map((tag) => {
      const tagEntity =
        typeof tag.tag === 'object' && tag.tag
          ? (tag.tag as Record<string, unknown>)
          : undefined;
      const typeValue = String(
        tag.type ?? tagEntity?.type ?? 'label'
      ).toLowerCase();
      return {
        // Prefer relation id for uniqueness; fallback to tag entity id or a generated id
        id: String(tag.id ?? tagEntity?.id ?? cryptoRandomId()),
        type: typeValue as TaskTag['type'],
        value: String(tag.value ?? tagEntity?.name ?? ''),
        displayText: String(tag.displayText ?? tagEntity?.name ?? ''),
        iconName: String(tag.iconName ?? 'Tag'),
        color:
          typeof tag.color === 'string'
            ? tag.color
            : typeof tagEntity?.color === 'string'
              ? tagEntity.color
              : undefined,
      };
    });
  }

  return revived as unknown as Task;
}

// Lightweight random id for client-only normalization fallbacks
function cryptoRandomId() {
  try {
    // browsers only
    const arr = new Uint32Array(2);
    const cryptoProvider =
      globalThis.crypto ?? (globalThis as { msCrypto?: Crypto }).msCrypto;
    cryptoProvider?.getRandomValues(arr);
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
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to fetch tasks');
    const items = Array.isArray(body.data?.data)
      ? body.data.data
      : body.data || []; // support paginated or plain
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
        tags: data.tags?.map((t) => ({
          type: t.type.toUpperCase(),
          name:
            typeof t.value === 'string'
              ? String(t.value).toLowerCase()
              : String(t.value),
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
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to create task');
    const created: Task = reviveTaskDates(body.data);

    // Upload attachments (if any) efficiently
    if (data.attachments && data.attachments.length > 0) {
      const dataUrlToUint8Array = (
        dataUrl: string
      ): { bytes: Uint8Array; mime: string } => {
        const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
        if (!match) throw new Error('Invalid data URL');
        const mime = match[1];
        const b64 = match[2];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { bytes, mime };
      };

      for (const f of data.attachments) {
        let publicUrl = f.url;
        let thumbnailUrl: string | undefined;
        try {
          if (f.url.startsWith('data:')) {
            const { bytes, mime } = dataUrlToUint8Array(f.url);
            const putRes = await fetch(
              `${apiBase}/upload?filename=${encodeURIComponent(f.name)}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': mime, ...authHeaders() },
                body: bytes,
              }
            );
            const putBody = await putRes
              .json()
              .catch(() => ({}) as Record<string, unknown>);
            if (!putRes.ok || !putBody.success)
              throw new Error(putBody.error?.message || 'Blob upload failed');
            publicUrl = String(putBody.data?.url || publicUrl);
            thumbnailUrl =
              typeof putBody.data?.thumbnailUrl === 'string'
                ? putBody.data.thumbnailUrl
                : undefined;
          }
        } catch (e) {
          if (
            typeof console !== 'undefined' &&
            typeof console.error === 'function'
          ) {
            console.error(
              'File upload failed; using provided URL as fallback',
              e
            );
          }
        }

        const attRes = await fetch(`${apiBase}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            fileName: f.name,
            fileType: f.type,
            fileSize: f.size,
            fileUrl: publicUrl,
            thumbnailUrl,
            taskId: created.id,
          }),
        });
        if (!attRes.ok) {
          if (
            typeof console !== 'undefined' &&
            typeof console.error === 'function'
          ) {
            console.error('Attachment record creation failed');
          }
        }
      }
      // Refetch tasks to include attachments
      const refreshed = await taskApi.fetchTasks();
      const withAttachments = refreshed.find((t) => t.id === created.id);
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
        // Map status to backend and normalize completed if not explicitly provided
        ...(data.status
          ? {
              status:
                data.status === 'done'
                  ? 'DONE'
                  : data.status === 'in_progress'
                    ? 'IN_PROGRESS'
                    : 'NOT_STARTED',
            }
          : {}),
        ...(data.status && data.completed === undefined
          ? { completed: data.status === 'done' }
          : {}),
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
      const updated = tasks.find((t) => t.id === id);
      if (!updated) throw new Error('Task not found after update');
      return updated;
    }
    const body = await res.json();
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to update task');
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
      const task = tasks.find((t) => t.id === id);
      if (!task) throw new Error('Task not found');
      const willBeCompleted = !task.completed;
      const ok = taskStorage.updateTask(id, {
        completed: willBeCompleted,
        completedAt: willBeCompleted ? new Date() : undefined,
      });
      if (!ok) throw new Error('Failed to toggle task');
      const refreshed = taskStorage.getTasks();
      const updated = refreshed.find((t) => t.id === id)!;
      return updated;
    }
    const body = await res.json();
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to toggle task');
    return reviveTaskDates(body.data);
  },
};
