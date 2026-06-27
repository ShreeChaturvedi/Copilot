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
  // Optional profile fields surfaced by /api/auth/me and profile updates.
  bio?: string;
  timezone?: string;
  googleId?: string | null;
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

  // Profile updates (reflect persisted profile changes across the app)
  updateUser: (updates: Partial<User>) => void;
  
  // Google Authentication
  setGoogleAuth: (tokens: GoogleAuthTokens, user: GoogleUserInfo) => void;
  updateGoogleTokens: (tokens: Partial<GoogleAuthTokens>) => void;
  clearGoogleAuth: () => void;
  
  // General
  logout: () => void;
  logoutEverywhere: () => Promise<void>;
  
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

        updateUser: (updates) => {
          const { user, googleUser, authMethod } = get();
          if (authMethod === 'google' && googleUser) {
            set(
              {
                googleUser: {
                  ...googleUser,
                  name: updates.name ?? googleUser.name,
                  picture: updates.picture ?? googleUser.picture,
                },
              },
              false,
              'updateUser'
            );
            return;
          }
          if (user) {
            set(
              { user: { ...user, ...updates } },
              false,
              'updateUser'
            );
          }
        },
        
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

        logoutEverywhere: async () => {
          const { authMethod, jwtTokens, getValidAccessToken } = get();

          try {
            const accessToken = getValidAccessToken();
            const refreshToken =
              authMethod === 'jwt' ? jwtTokens?.refreshToken : undefined;
            if (accessToken && refreshToken) {
              // logoutAll revokes every refresh token for this user server-side.
              await authAPI.logout(accessToken, refreshToken, true);
            }
          } catch (error) {
            console.error('Logout everywhere error:', error);
          }

          set({ ...initialState }, false, 'logoutEverywhere');
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