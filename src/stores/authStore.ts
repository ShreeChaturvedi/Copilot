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
  // Editable profile fields must ride on the Google user too, or a Google
  // user's bio/timezone edits are dropped on save and lost on reload (#8).
  bio?: string;
  timezone?: string;
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

  // Change the JWT user's password. The server revokes every existing session
  // and returns a fresh token pair, which this swaps in so the current client
  // stays signed in instead of being force-logged-out on the next refresh.
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;

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

/**
 * Single-flight guard for the refresh-token exchange. The server rotates the
 * refresh token on every exchange and treats reuse of the old one as theft,
 * so two concurrent refreshes (e.g. StrictMode double effects, parallel auth
 * guards) would revoke the whole session (#57). All concurrent callers share
 * one in-flight exchange.
 */
let refreshInFlight: Promise<boolean> | null = null;

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

        setLoading: (loading) =>
          set({ isLoading: loading }, false, 'setLoading'),

        setError: (error) => set({ error }, false, 'setError'),

        // JWT Authentication
        setJWTAuth: (tokens, user) =>
          set(
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
          set({ jwtTokens: updatedTokens }, false, 'updateJWTTokens');
        },

        clearJWTAuth: () =>
          // Note: `error` is intentionally left untouched. A session-expiry
          // reason set right before/after this clear must survive so the login
          // screen can explain why the user was signed out (#13).
          set(
            {
              isAuthenticated: false,
              authMethod: null,
              jwtTokens: null,
              user: null,
            },
            false,
            'clearJWTAuth'
          ),

        changePassword: async (currentPassword, newPassword) => {
          const { refreshTokenIfNeeded, getValidAccessToken, updateJWTTokens } =
            get();

          // Make sure the request goes out with a live access token.
          await refreshTokenIfNeeded();
          const accessToken = getValidAccessToken();
          if (!accessToken) {
            return {
              success: false,
              message: 'Your session has expired. Please log in again.',
            };
          }

          const result = await authAPI.changePassword(
            accessToken,
            currentPassword,
            newPassword
          );

          if (result.success && result.tokens) {
            // The change revoked this client's refresh token server-side; swap
            // in the fresh pair so the next /auth/refresh doesn't 401 and log
            // the user out. Token-only update, same as the refresh flow.
            updateJWTTokens(result.tokens);
          }

          return { success: result.success, message: result.message };
        },

        updateUser: (updates) => {
          const { user, googleUser, authMethod } = get();
          if (authMethod === 'google' && googleUser) {
            set(
              {
                googleUser: {
                  ...googleUser,
                  name: updates.name ?? googleUser.name,
                  picture: updates.picture ?? googleUser.picture,
                  bio: updates.bio ?? googleUser.bio,
                  timezone: updates.timezone ?? googleUser.timezone,
                },
              },
              false,
              'updateUser'
            );
            return;
          }
          if (user) {
            set({ user: { ...user, ...updates } }, false, 'updateUser');
          }
        },

        // Google Authentication
        setGoogleAuth: (tokens, user) =>
          set(
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
          set({ googleTokens: updatedTokens }, false, 'updateGoogleTokens');
        },

        clearGoogleAuth: () =>
          // `error` left untouched on purpose, same rationale as clearJWTAuth (#13).
          set(
            {
              isAuthenticated: false,
              authMethod: null,
              googleTokens: null,
              googleUser: null,
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
              const refreshToken =
                authMethod === 'jwt' ? jwtTokens?.refreshToken : undefined;
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
            return Date.now() >= jwtTokens.expiresAt - thresholdMs;
          }

          if (authMethod === 'google' && googleTokens) {
            return Date.now() >= googleTokens.expiresAt - thresholdMs;
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
          const { authMethod, jwtTokens, isTokenExpiringSoon } = get();

          if (authMethod !== 'jwt' || !jwtTokens || !isTokenExpiringSoon()) {
            return true; // No refresh needed
          }

          // Share one in-flight exchange between concurrent callers: the
          // rotated refresh token makes a second parallel exchange fatal.
          if (refreshInFlight) {
            return refreshInFlight;
          }

          refreshInFlight = (async () => {
            // Re-read state inside the exchange so the freshest refresh
            // token is used.
            const {
              jwtTokens: tokens,
              updateJWTTokens,
              clearJWTAuth,
              setError,
            } = get();
            if (!tokens) return false;

            try {
              const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  refreshToken: tokens.refreshToken,
                }),
              });

              if (!response.ok) {
                throw new Error('Token refresh failed');
              }

              const data = await response.json();

              if (data.success && data.data.accessToken) {
                updateJWTTokens({
                  accessToken: data.data.accessToken,
                  // The server rotates the refresh token on every exchange;
                  // keeping the old one would trip reuse detection next time.
                  ...(data.data.refreshToken
                    ? { refreshToken: data.data.refreshToken }
                    : {}),
                  expiresAt: data.data.expiresAt || Date.now() + 60 * 60 * 1000, // 1 hour default
                });
                return true;
              } else {
                throw new Error(data.message || 'Token refresh failed');
              }
            } catch (error) {
              console.error('Token refresh error:', error);
              // Clear first, then set the reason: clearJWTAuth no longer wipes
              // `error`, so this message survives for the login screen (#13).
              clearJWTAuth();
              setError('Session expired. Please log in again.');
              return false;
            }
          })().finally(() => {
            refreshInFlight = null;
          });

          return refreshInFlight;
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
                // An expired access token is recoverable while a refresh
                // token exists: keep the session and let the auth guard
                // exchange it (#57). Only a missing refresh token is fatal.
                if (!state.jwtTokens?.refreshToken) {
                  state.clearJWTAuth();
                }
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
