import { create } from 'zustand';
import { authAPI } from '@/services/api/auth';
import { devtools, persist } from 'zustand/middleware';

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface JWTTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuthMethod = 'jwt' | 'google' | null;

interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  
  // JWT authentication
  jwtTokens: JWTTokens | null;
  user: User | null;
  
  // Google authentication
  googleTokens: GoogleAuthTokens | null;
  googleUser: GoogleUserInfo | null;
  
  // Error handling
  error: string | null;
  
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // JWT Authentication
  setJWTAuth: (tokens: JWTTokens, user: User) => void;
  updateJWTTokens: (tokens: Partial<JWTTokens>) => void;
  clearJWTAuth: () => void;
  
  // Google Authentication
  setGoogleAuth: (tokens: GoogleAuthTokens, user: GoogleUserInfo) => void;
  updateGoogleTokens: (tokens: Partial<GoogleAuthTokens>) => void;
  clearGoogleAuth: () => void;
  
  // General
  logout: () => void;
  
  // Token management
  isTokenExpired: () => boolean;
  isTokenExpiringSoon: (thresholdMinutes?: number) => boolean;
  getValidAccessToken: () => string | null;
  refreshTokenIfNeeded: () => Promise<boolean>;
}

const initialState = {
  isAuthenticated: false,
  isLoading: false,
  authMethod: null as AuthMethod,
  jwtTokens: null,
  user: null,
  googleTokens: null,
  googleUser: null,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        setLoading: (loading) => set(
          { isLoading: loading },
          false,
          'setLoading'
        ),
        
        setError: (error) => set(
          { error },
          false,
          'setError'
        ),
        
        // JWT Authentication
        setJWTAuth: (tokens, user) => set(
          {
            isAuthenticated: true,
            authMethod: 'jwt',
            jwtTokens: tokens,
            user,
            error: null,
            isLoading: false,
          },
          false,
          'setJWTAuth'
        ),
        
        updateJWTTokens: (tokenUpdates) => {
          const { jwtTokens } = get();
          if (!jwtTokens) return;
          
          const updatedTokens = { ...jwtTokens, ...tokenUpdates };
          set(
            { jwtTokens: updatedTokens },
            false,
            'updateJWTTokens'
          );
        },
        
        clearJWTAuth: () => set(
          {
            isAuthenticated: false,
            authMethod: null,
            jwtTokens: null,
            user: null,
            error: null,
          },
          false,
          'clearJWTAuth'
        ),
        
        // Google Authentication
        setGoogleAuth: (tokens, user) => set(
          {
            isAuthenticated: true,
            authMethod: 'google',
            googleTokens: tokens,
            googleUser: user,
            error: null,
            isLoading: false,
          },
          false,
          'setGoogleAuth'
        ),
        
        updateGoogleTokens: (tokenUpdates) => {
          const { googleTokens } = get();
          if (!googleTokens) return;
          
          const updatedTokens = { ...googleTokens, ...tokenUpdates };
          set(
            { googleTokens: updatedTokens },
            false,
            'updateGoogleTokens'
          );
        },
        
        clearGoogleAuth: () => set(
          {
            isAuthenticated: false,
            authMethod: null,
            googleTokens: null,
            googleUser: null,
            error: null,
          },
          false,
          'clearGoogleAuth'
        ),
        
        logout: async () => {
          const { authMethod, jwtTokens, getValidAccessToken } = get();
          
          try {
            // Get current access token for API call
            const accessToken = getValidAccessToken();
            
            if (accessToken) {
              // Call backend logout API with refresh token
              const refreshToken = authMethod === 'jwt' ? jwtTokens?.refreshToken : undefined;
              await authAPI.logout(accessToken, refreshToken);
            }
          } catch (error) {
            console.error('Backend logout error:', error);
            // Continue with local logout even if backend call fails
          }
          
          // Clear all authentication state
          set(
            {
              ...initialState,
            },
            false,
            'logout'
          );
        },
        
        isTokenExpired: () => {
          const { authMethod, jwtTokens, googleTokens } = get();
          
          if (authMethod === 'jwt' && jwtTokens) {
            return Date.now() >= jwtTokens.expiresAt;
          }
          
          if (authMethod === 'google' && googleTokens) {
            return Date.now() >= googleTokens.expiresAt;
          }
          
          return true;
        },
        
        isTokenExpiringSoon: (thresholdMinutes = 5) => {
          const { authMethod, jwtTokens, googleTokens } = get();
          const thresholdMs = thresholdMinutes * 60 * 1000;
          
          if (authMethod === 'jwt' && jwtTokens) {
            return Date.now() >= (jwtTokens.expiresAt - thresholdMs);
          }
          
          if (authMethod === 'google' && googleTokens) {
            return Date.now() >= (googleTokens.expiresAt - thresholdMs);
          }
          
          return true;
        },
        
        getValidAccessToken: () => {
          const { authMethod, jwtTokens, googleTokens, isTokenExpired } = get();
          
          if (isTokenExpired()) {
            return null;
          }
          
          if (authMethod === 'jwt' && jwtTokens) {
            return jwtTokens.accessToken;
          }
          
          if (authMethod === 'google' && googleTokens) {
            return googleTokens.accessToken;
          }
          
          return null;
        },
        
        refreshTokenIfNeeded: async () => {
          const { authMethod, jwtTokens, isTokenExpiringSoon, updateJWTTokens, clearJWTAuth, setError } = get();
          
          if (authMethod !== 'jwt' || !jwtTokens || !isTokenExpiringSoon()) {
            return true; // No refresh needed
          }
          
          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                refreshToken: jwtTokens.refreshToken,
              }),
            });
            
            if (!response.ok) {
              throw new Error('Token refresh failed');
            }
            
            const data = await response.json();
            
            if (data.success && data.data.accessToken) {
              updateJWTTokens({
                accessToken: data.data.accessToken,
                expiresAt: data.data.expiresAt || Date.now() + (60 * 60 * 1000), // 1 hour default
              });
              return true;
            } else {
              throw new Error(data.message || 'Token refresh failed');
            }
          } catch (error) {
            console.error('Token refresh error:', error);
            setError('Session expired. Please log in again.');
            clearJWTAuth();
            return false;
          }
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          authMethod: state.authMethod,
          jwtTokens: state.jwtTokens,
          user: state.user,
          googleTokens: state.googleTokens,
          googleUser: state.googleUser,
        }),
        // Don't persist loading states or errors
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Reset transient state on rehydration
            state.isLoading = false;
            state.error = null;
            
            // Check if stored tokens are still valid
            if (state.isTokenExpired()) {
              if (state.authMethod === 'jwt') {
                state.clearJWTAuth();
              } else if (state.authMethod === 'google') {
                state.clearGoogleAuth();
              }
            }
          }
        },
      }
    ),
    {
      name: 'auth-store',
    }
  )
);