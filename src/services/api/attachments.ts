import { useAuthStore } from '@/stores/authStore';
import type { FileAttachment } from '@shared/types';

const apiBase = '/api';

function authHeaders(): Record<string, string> {
  try {
    const token = useAuthStore.getState().getValidAccessToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function isJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export const attachmentsApi = {
  async listByTask(taskId: string): Promise<FileAttachment[]> {
    const res = await fetch(
      `${apiBase}/attachments?taskId=${encodeURIComponent(taskId)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      }
    );
    if (!isJson(res)) return [];
    const body = await res.json();
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to fetch attachments');
    const items: unknown = Array.isArray(body.data?.data)
      ? body.data.data
      : body.data || [];
    return (items as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id),
      name: String(a.fileName),
      type: String(a.fileType),
      size: Number(a.fileSize),
      url: String(a.fileUrl),
      uploadedAt: a.createdAt ? new Date(String(a.createdAt)) : new Date(),
      thumbnailUrl:
        typeof a.thumbnailUrl === 'string' ? a.thumbnailUrl : undefined,
      taskId: String(a.taskId),
    })) as FileAttachment[];
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(
      `${apiBase}/attachments/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { ...authHeaders() },
      }
    );
    if (!isJson(res)) return; // assume success in legacy mode
    const body = await res.json();
    if (!res.ok || !body.success)
      throw new Error(body.error?.message || 'Failed to delete attachment');
  },
};
