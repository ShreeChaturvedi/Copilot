/**
 * Authentication API service
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  message?: string;
}

export interface SignupResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  message?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data?: {
    accessToken: string;
    expiresAt: number;
  };
  message?: string;
}

export interface GoogleAuthRequest {
  code: string;
  redirectUri: string;
}

export interface GoogleAuthResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      createdAt: string;
      updatedAt: string;
    };
    googleTokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: number;
      tokenType?: string;
      scope?: string;
    };
  };
  message?: string;
}

/**
 * The auth endpoints return { success, data: { user, tokens } } (nested), while
 * the rest of the app consumes a flat { accessToken, refreshToken, expiresAt,
 * user } shape. Normalize here so callers get a single, stable contract.
 */
interface BackendAuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    picture?: string;
    createdAt: string;
    updatedAt?: string;
  };
  tokens: { accessToken: string; refreshToken: string; expiresAt: number };
}

function normalizeAuthData(
  raw: BackendAuthResult
): NonNullable<LoginResponse['data']> {
  return {
    accessToken: raw.tokens.accessToken,
    refreshToken: raw.tokens.refreshToken,
    expiresAt: raw.tokens.expiresAt,
    user: {
      id: raw.user.id,
      email: raw.user.email,
      name: raw.user.name ?? '',
      picture: raw.user.picture,
      createdAt: raw.user.createdAt,
      updatedAt: raw.user.updatedAt ?? raw.user.createdAt,
    },
  };
}

function extractErrorMessage(data: unknown, fallback: string): string {
  const d = data as { error?: { message?: string }; message?: string };
  return d?.error?.message || d?.message || fallback;
}

class AuthAPI {
  private baseURL = '/api/auth';

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: extractErrorMessage(data, 'Login failed'),
        };
      }

      return { success: true, data: normalizeAuthData(data.data) };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  async signup(userData: SignupRequest): Promise<SignupResponse> {
    try {
      // The backend route is /register; there is no /signup endpoint.
      const response = await fetch(`${this.baseURL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: extractErrorMessage(data, 'Signup failed'),
        };
      }

      return { success: true, data: normalizeAuthData(data.data) };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await fetch(`${this.baseURL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Token refresh failed',
        };
      }

      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  async logout(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.error?.message || 'Logout failed',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Return success even on network error since we'll clear local state anyway
      return { success: true };
    }
  }

  async googleAuth(authData: GoogleAuthRequest): Promise<GoogleAuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Google authentication failed',
        };
      }

      return data;
    } catch (error) {
      console.error('Google auth error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  async verifyToken(token: string): Promise<{
    valid: boolean;
    user?: { id: string; email: string; name?: string; picture?: string };
  }> {
    try {
      // There is no dedicated /verify route; /me is the canonical "is this
      // token still valid?" endpoint and already returns the authenticated
      // user. A 200 means the access token is valid.
      const response = await fetch(`${this.baseURL}/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = await response.json();

      // /me returns the user fields flat under `data` ({ id, email, name, ... }),
      // not nested under data.user.
      const u = data?.data;
      if (!data?.success || !u) {
        return { valid: false };
      }

      return {
        valid: true,
        user: {
          id: u.id,
          email: u.email,
          name: u.name ?? undefined,
          picture: u.picture ?? u.profile?.avatarUrl,
        },
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  }

  // Request a password reset link. The backend always responds with a generic
  // success (it never reveals whether the email is registered), so callers
  // should show the same confirmation regardless of the result.
  async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: extractErrorMessage(data, 'Could not send reset email'),
        };
      }

      return { success: true, message: data.data?.message };
    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  // Confirm a password reset with the token from the emailed link.
  async confirmPasswordReset(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: extractErrorMessage(data, 'Could not reset password'),
        };
      }

      return { success: true, message: data.data?.message };
    } catch (error) {
      console.error('Password reset confirm error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  // Get Google OAuth URL
  getGoogleAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}

export const authAPI = new AuthAPI();
