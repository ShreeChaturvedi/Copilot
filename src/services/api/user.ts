/**
 * User API service - profile, preferences, data export and account deletion.
 */
import { useAuthStore } from '@/stores/authStore';

export interface UserProfileData {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  googleId?: string | null;
  profile: {
    bio: string | null;
    avatarUrl: string | null;
    timezone: string;
    theme: string;
    defaultView: string;
    weekStartsOn: number;
    notificationsEnabled: boolean;
  };
}

export interface UpdateProfileData {
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultView: 'calendar' | 'tasks' | 'last-used';
  weekStartsOn: number;
  notificationsEnabled: boolean;
}

const apiBase = '/api';

function authHeaders(): Record<string, string> {
  try {
    const token = useAuthStore.getState().getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function extractError(data: unknown, fallback: string): string {
  const d = data as { error?: { message?: string }; message?: string };
  return d?.error?.message || d?.message || fallback;
}

class UserAPI {
  async updateProfile(update: UpdateProfileData): Promise<UserProfileData> {
    const response = await fetch(`${apiBase}/user/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(update),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(extractError(data, 'Failed to update profile'));
    }
    return data.data as UserProfileData;
  }

  async getPreferences(): Promise<UserPreferences> {
    const response = await fetch(`${apiBase}/user/preferences`, {
      method: 'GET',
      headers: { ...authHeaders() },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(extractError(data, 'Failed to load preferences'));
    }
    return data.data as UserPreferences;
  }

  async updatePreferences(
    update: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const response = await fetch(`${apiBase}/user/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(update),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(extractError(data, 'Failed to save preferences'));
    }
    return data.data as UserPreferences;
  }

  /**
   * Fetch the full export payload and trigger a browser download as a JSON file.
   */
  async exportData(): Promise<void> {
    const response = await fetch(`${apiBase}/user/export`, {
      method: 'GET',
      headers: { ...authHeaders() },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(extractError(data, 'Failed to export data'));
    }

    const blob = new Blob([JSON.stringify(data.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async deleteAccount(): Promise<void> {
    const response = await fetch(`${apiBase}/user`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(extractError(data, 'Failed to delete account'));
    }
  }
}

export const userAPI = new UserAPI();
