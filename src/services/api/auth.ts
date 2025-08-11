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

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Login failed',
        };
      }

      return data;
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
      const response = await fetch(`${this.baseURL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Signup failed',
        };
      }

      return data;
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

  async logout(accessToken: string, refreshToken?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          refreshToken 
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

  async verifyToken(token: string): Promise<{ valid: boolean; user?: { id: string; email: string; name?: string; picture?: string } }> {
    try {
      const response = await fetch(`${this.baseURL}/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { valid: false };
      }

      return {
        valid: true,
        user: data.data?.user,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
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