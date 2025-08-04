import { create } from 'zustand';
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

interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Google authentication
  googleTokens: GoogleAuthTokens | null;
  googleUser: GoogleUserInfo | null;
  
  // Error handling
  error: string | null;
  
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setGoogleAuth: (tokens: GoogleAuthTokens, user: GoogleUserInfo) => void;
  updateGoogleTokens: (tokens: Partial<GoogleAuthTokens>) => void;
  clearGoogleAuth: () => void;
  logout: () => void;
  
  // Token management
  isTokenExpired: () => boolean;
  isTokenExpiringSoon: (thresholdMinutes?: number) => boolean;
  getValidAccessToken: () => string | null;
}

const initialState = {
  isAuthenticated: false,
  isLoading: false,
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
        
        setGoogleAuth: (tokens, user) => set(
          {
            isAuthenticated: true,
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
            googleTokens: null,
            googleUser: null,
            error: null,
          },
          false,
          'clearGoogleAuth'
        ),
        
        logout: () => {
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
          const { googleTokens } = get();
          if (!googleTokens) return true;
          
          return Date.now() >= googleTokens.expiresAt;
        },
        
        isTokenExpiringSoon: (thresholdMinutes = 5) => {
          const { googleTokens } = get();
          if (!googleTokens) return true;
          
          const thresholdMs = thresholdMinutes * 60 * 1000;
          return Date.now() >= (googleTokens.expiresAt - thresholdMs);
        },
        
        getValidAccessToken: () => {
          const { googleTokens, isTokenExpired } = get();
          
          if (!googleTokens || isTokenExpired()) {
            return null;
          }
          
          return googleTokens.accessToken;
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
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
            if (state.googleTokens && state.isTokenExpired()) {
              state.clearGoogleAuth();
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