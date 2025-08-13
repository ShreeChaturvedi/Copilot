import type { FileAttachment } from '@shared/types';
import { useAuthStore } from '@/stores/authStore';

const apiBase = '/api';

function authHeaders(): Record<string, string> {
  try {
    const token = useAuthStore.getState().getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function isJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

function reviveAttachment(raw: Record<string, unknown>): FileAttachment {
  return {
    id: String(raw.id ?? raw['attachmentId'] ?? ''),
    name: String(raw.fileName ?? raw['name'] ?? ''),
    type: String(raw.fileType ?? raw['type'] ?? ''),
    size: Number(raw.fileSize ?? raw['size'] ?? 0),
    url: String(raw.fileUrl ?? raw['url'] ?? ''),
    uploadedAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    thumbnailUrl: (raw as any).thumbnailUrl ? String((raw as any).thumbnailUrl) : undefined,
    taskId: String(raw.taskId ?? ''),
  };
}

export interface CreateAttachmentInput {
  taskId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string; // data URL, blob URL, or remote URL
}

export const attachmentsApi = {
  async listByTask(taskId: string): Promise<FileAttachment[]> {
    const res = await fetch(`${apiBase}/attachments?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) return [];
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch attachments');
    const items = Array.isArray(body.data?.data) ? body.data.data : (body.data || []);
    return items.map(reviveAttachment);
  },

  async get(id: string): Promise<FileAttachment> {
    const res = await fetch(`${apiBase}/attachments/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) throw new Error('Unexpected response');
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch attachment');
    return reviveAttachment(body.data);
  },

  async create(input: CreateAttachmentInput): Promise<FileAttachment> {
    const res = await fetch(`${apiBase}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        taskId: input.taskId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        fileUrl: input.fileUrl,
      }),
    });
    if (!isJson(res)) throw new Error('Unexpected response');
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to create attachment');
    return reviveAttachment(body.data);
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${apiBase}/attachments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (!isJson(res)) throw new Error('Unexpected response');
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to delete attachment');
  },

  async getDownloadUrl(id: string): Promise<string> {
    // For now, use GET by id and return stored fileUrl
    const att = await this.get(id);
    return att.url;
  },
};