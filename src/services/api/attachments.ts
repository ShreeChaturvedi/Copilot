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
    const res = await fetch(`${apiBase}/attachments?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!isJson(res)) return [];
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to fetch attachments');
    const items = Array.isArray(body.data?.data) ? body.data.data : (body.data || []);
    return items.map((a: any) => ({
      id: a.id,
      name: a.fileName,
      type: a.fileType,
      size: a.fileSize,
      url: a.fileUrl,
      uploadedAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      taskId: a.taskId,
    })) as FileAttachment[];
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${apiBase}/attachments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (!isJson(res)) return; // assume success in legacy mode
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error?.message || 'Failed to delete attachment');
  },
};