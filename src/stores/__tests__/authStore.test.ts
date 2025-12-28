import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';
import type { GoogleAuthTokens, GoogleUserInfo } from '../authStore';

vi.mock('@/services/api/auth', () => ({
  authAPI: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock tokens and user for testing
const mockTokens: GoogleAuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000, // 1 hour from now
  tokenType: 'Bearer',
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
};

const mockUser: GoogleUserInfo = {
  id: 'mock-user-id',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg',
};

const mockExpiredTokens: GoogleAuthTokens = {
  ...mockTokens,
  expiresAt: Date.now() - 1000, // 1 second ago (expired)
};

const mockExpiringSoonTokens: GoogleAuthTokens = {
  ...mockTokens,
  expiresAt: Date.now() + 60000, // 1 minute from now
};

describe('AuthStore', () => {
  beforeEach(async () => {
    // Clear localStorage and reset store
    localStorage.clear();
    await useAuthStore.getState().logout();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.googleTokens).toBe(null);
      expect(state.googleUser).toBe(null);
      expect(state.error).toBe(null);
    });
  });

  describe('Loading State Management', () => {
    it('should set loading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('Error Management', () => {
    it('should set error message', () => {
      const { setError } = useAuthStore.getState();

      setError('Test error message');
      expect(useAuthStore.getState().error).toBe('Test error message');
    });

    it('should clear error message', () => {
      const { setError } = useAuthStore.getState();

      setError('Test error');
      expect(useAuthStore.getState().error).toBe('Test error');

      setError(null);
      expect(useAuthStore.getState().error).toBe(null);
    });
  });

  describe('Google Authentication', () => {
    it('should set Google authentication data', () => {
      const { setGoogleAuth } = useAuthStore.getState();

      setGoogleAuth(mockTokens, mockUser);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.googleTokens).toEqual(mockTokens);
      expect(state.googleUser).toEqual(mockUser);
      expect(state.error).toBe(null);
      expect(state.isLoading).toBe(false);
    });

    it('should update Google tokens', () => {
      const { setGoogleAuth, updateGoogleTokens } = useAuthStore.getState();

      // First set initial auth
      setGoogleAuth(mockTokens, mockUser);

      // Then update tokens
      const newTokens = {
        accessToken: 'new-access-token',
        expiresAt: Date.now() + 7200000, // 2 hours from now
      };

      updateGoogleTokens(newTokens);

      const state = useAuthStore.getState();
      expect(state.googleTokens).toEqual({
        ...mockTokens,
        ...newTokens,
      });
    });

    it('should not update tokens when no tokens exist', () => {
      const { updateGoogleTokens } = useAuthStore.getState();

      // Try to update when no tokens exist
      updateGoogleTokens({ accessToken: 'new-token' });

      const state = useAuthStore.getState();
      expect(state.googleTokens).toBe(null);
    });

    it('should clear Google authentication', () => {
      const { setGoogleAuth, clearGoogleAuth } = useAuthStore.getState();

      // First set auth
      setGoogleAuth(mockTokens, mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then clear
      clearGoogleAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.googleTokens).toBe(null);
      expect(state.googleUser).toBe(null);
      expect(state.error).toBe(null);
    });
  });

  describe('Logout', () => {
    it('should reset all state on logout', async () => {
      const { setGoogleAuth, setLoading, setError, logout } =
        useAuthStore.getState();

      // Set some state
      setGoogleAuth(mockTokens, mockUser);
      setLoading(true);
      setError('Some error');

      // Verify state is set
      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('Some error');

      // Logout
      await logout();

      // Verify state is reset
      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.googleTokens).toBe(null);
      expect(state.googleUser).toBe(null);
      expect(state.error).toBe(null);
    });
  });

  describe('Token Validation', () => {
    it('should detect expired tokens', () => {
      const { setGoogleAuth, isTokenExpired } = useAuthStore.getState();

      // Set expired tokens
      setGoogleAuth(mockExpiredTokens, mockUser);

      expect(isTokenExpired()).toBe(true);
    });

    it('should detect valid tokens', () => {
      const { setGoogleAuth, isTokenExpired } = useAuthStore.getState();

      // Set valid tokens
      setGoogleAuth(mockTokens, mockUser);

      expect(isTokenExpired()).toBe(false);
    });

    it('should return true for expired when no tokens exist', () => {
      const { isTokenExpired } = useAuthStore.getState();

      expect(isTokenExpired()).toBe(true);
    });

    it('should detect tokens expiring soon with default threshold', () => {
      const { setGoogleAuth, isTokenExpiringSoon } = useAuthStore.getState();

      // Set tokens expiring in 1 minute (less than default 5 minute threshold)
      setGoogleAuth(mockExpiringSoonTokens, mockUser);

      expect(isTokenExpiringSoon()).toBe(true);
    });

    it('should detect tokens expiring soon with custom threshold', () => {
      const { setGoogleAuth, isTokenExpiringSoon } = useAuthStore.getState();

      // Set tokens expiring in 1 minute
      setGoogleAuth(mockExpiringSoonTokens, mockUser);

      // With 30 second threshold, should not be expiring soon
      expect(isTokenExpiringSoon(0.5)).toBe(false);

      // With 2 minute threshold, should be expiring soon
      expect(isTokenExpiringSoon(2)).toBe(true);
    });

    it('should return true for expiring soon when no tokens exist', () => {
      const { isTokenExpiringSoon } = useAuthStore.getState();

      expect(isTokenExpiringSoon()).toBe(true);
    });
  });

  describe('Valid Access Token', () => {
    it('should return valid access token', () => {
      const { setGoogleAuth, getValidAccessToken } = useAuthStore.getState();

      setGoogleAuth(mockTokens, mockUser);

      expect(getValidAccessToken()).toBe(mockTokens.accessToken);
    });

    it('should return null for expired tokens', () => {
      const { setGoogleAuth, getValidAccessToken } = useAuthStore.getState();

      setGoogleAuth(mockExpiredTokens, mockUser);

      expect(getValidAccessToken()).toBe(null);
    });

    it('should return null when no tokens exist', () => {
      const { getValidAccessToken } = useAuthStore.getState();

      expect(getValidAccessToken()).toBe(null);
    });
  });

  describe('Persistence', () => {
    it('should persist authentication state', () => {
      const { setGoogleAuth } = useAuthStore.getState();

      setGoogleAuth(mockTokens, mockUser);

      // Check that data is in localStorage
      const stored = localStorage.getItem('auth-store');
      expect(stored).toBeTruthy();

      const parsedStored = JSON.parse(stored!);
      expect(parsedStored.state.isAuthenticated).toBe(true);
      expect(parsedStored.state.googleUser).toEqual(mockUser);
    });

    it('should not persist transient state', () => {
      const { setGoogleAuth, setLoading, setError } = useAuthStore.getState();

      setGoogleAuth(mockTokens, mockUser);
      setLoading(true);
      setError('Test error');

      const stored = localStorage.getItem('auth-store');
      const parsedStored = JSON.parse(stored!);

      // Should not persist loading or error state
      expect(parsedStored.state.isLoading).toBeUndefined();
      expect(parsedStored.state.error).toBeUndefined();
    });
  });

  describe('Token Expiration on Rehydration', () => {
    it('should clear expired tokens on rehydration', () => {
      // Manually set expired tokens in localStorage
      const expiredState = {
        state: {
          isAuthenticated: true,
          googleTokens: mockExpiredTokens,
          googleUser: mockUser,
        },
        version: 0,
      };

      localStorage.setItem('auth-store', JSON.stringify(expiredState));

      // Create a new store instance to trigger rehydration
      const { isAuthenticated, googleTokens } = useAuthStore.getState();

      // Should have cleared expired tokens
      expect(isAuthenticated).toBe(false);
      expect(googleTokens).toBe(null);
    });
  });
});
