import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables BEFORE any imports
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/auth/google/callback';

// Mock Google Auth Library - define mock inside factory due to hoisting
vi.mock('google-auth-library', () => {
  const mockOAuth2Client = {
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    setCredentials: vi.fn(),
    verifyIdToken: vi.fn(),
  };
  return {
    OAuth2Client: vi.fn(() => mockOAuth2Client),
    __mockOAuth2Client: mockOAuth2Client, // Export for test access
  };
});

// Mock database module with factory pattern for hoisting
vi.mock('../../config/database.js', () => {
  const query = vi.fn();
  const withTransaction = vi.fn();
  const pool = { query };
  return {
    query,
    withTransaction,
    pool,
  };
});

// Mock JWT utilities
vi.mock('../../utils/jwt.js', () => ({
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 900000,
  }),
}));

// Mock refresh token service
vi.mock('../RefreshTokenService.js', () => ({
  refreshTokenService: {
    storeRefreshToken: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

// Import AFTER mocks are set up
import { googleOAuthService } from '../GoogleOAuthService.js';
import {
  query as mockQuery,
  withTransaction as mockWithTransaction,
} from '../../config/database.js';
import { __mockOAuth2Client } from 'google-auth-library';

// Get the mock client instance
const mockOAuth2Client = __mockOAuth2Client as {
  generateAuthUrl: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  setCredentials: ReturnType<typeof vi.fn>;
  verifyIdToken: ReturnType<typeof vi.fn>;
};

// Helper to create query results
function createQueryResult<T>(rows: T[], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

// Cast mocked functions
const mockedQuery = vi.mocked(mockQuery);
const mockedWithTransaction = vi.mocked(mockWithTransaction);

describe('GoogleOAuthService', () => {
  const mockGoogleUserInfo = {
    id: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    verified_email: true,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: null,
    googleId: 'google-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedQuery.mockReset();
    mockedWithTransaction.mockReset();
  });

  describe('getAuthUrl', () => {
    it('should generate Google OAuth authorization URL', () => {
      const mockUrl = 'https://accounts.google.com/oauth/authorize?...';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(mockUrl);

      const result = googleOAuthService.getAuthUrl();

      expect(result).toBe(mockUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        prompt: 'consent',
      });
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback for new user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo),
      } as Response);

      // Mock transaction for user creation - the callback uses the module-level query()
      const createdUser = {
        id: 'new-user-123',
        email: mockGoogleUserInfo.email.toLowerCase(),
        name: mockGoogleUserInfo.name,
        createdAt: new Date(),
      };

      // Mock database queries - both outside and inside transaction use this mock
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // User not found by Google ID
        if (sqlLower.includes('select') && sqlLower.includes('"googleid"')) {
          return createQueryResult([]);
        }
        // User not found by email
        if (sqlLower.includes('select') && sqlLower.includes('lower(email)')) {
          return createQueryResult([]);
        }
        // INSERT user (inside transaction)
        if (sqlLower.includes('insert into users')) {
          return createQueryResult([createdUser]);
        }
        // INSERT user_profile (inside transaction)
        if (sqlLower.includes('insert into user_profiles')) {
          return createQueryResult([{ id: 'profile-123' }]);
        }
        return createQueryResult([]);
      });

      // Mock transaction - just execute the callback with a fake client
      mockedWithTransaction.mockImplementation(async (callback: any) => {
        return callback({}); // The callback uses module-level query(), not client.query()
      });

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email.toLowerCase());
      expect(result.isNewUser).toBe(true);
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should handle OAuth callback for existing Google user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo),
      } as Response);

      // Mock existing user found by Google ID
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select') && sqlLower.includes('"googleid"')) {
          return createQueryResult([mockUser]);
        }
        // Update avatar
        if (sqlLower.includes('update user_profiles')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.isNewUser).toBe(false);
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should link Google account to existing email user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      const existingUser = {
        ...mockUser,
        googleId: null,
        password: 'hashed-password',
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo),
      } as Response);

      // Mock user not found by Google ID, but found by email
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // Find user by email (SELECT with LOWER(email) in WHERE clause)
        if (sqlLower.includes('select') && sqlLower.includes('lower(email)')) {
          return createQueryResult([existingUser]);
        }
        // Find user by googleId (SELECT with "googleid" = $1 in WHERE clause)
        if (
          sqlLower.includes('select') &&
          sqlLower.includes('where') &&
          sqlLower.includes('"googleid" = $1')
        ) {
          return createQueryResult([]);
        }
        // Update user with googleId
        if (sqlLower.includes('update users set "googleid"')) {
          return createQueryResult([], 1);
        }
        // Update avatar
        if (sqlLower.includes('update user_profiles')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.isNewUser).toBe(false);
    });

    it('should throw error on OAuth failure', async () => {
      const authCode = 'test-auth-code';

      mockOAuth2Client.getToken.mockRejectedValue(new Error('OAuth failed'));

      await expect(googleOAuthService.handleCallback(authCode)).rejects.toThrow(
        'GOOGLE_OAUTH_FAILED'
      );
    });
  });

  describe('verifyIdToken', () => {
    it('should verify Google ID token successfully', async () => {
      const idToken = 'test-id-token';
      const mockPayload = {
        sub: mockGoogleUserInfo.id,
        email: mockGoogleUserInfo.email,
        name: mockGoogleUserInfo.name,
        picture: mockGoogleUserInfo.picture,
        email_verified: true,
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      // Mock existing user found by Google ID
      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        if (sqlLower.includes('select') && sqlLower.includes('"googleid"')) {
          return createQueryResult([mockUser]);
        }
        if (sqlLower.includes('update user_profiles')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      const result = await googleOAuthService.verifyIdToken(idToken);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    });

    it('should throw error for invalid ID token', async () => {
      const idToken = 'invalid-token';

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => null,
      });

      await expect(googleOAuthService.verifyIdToken(idToken)).rejects.toThrow(
        'GOOGLE_TOKEN_VERIFICATION_FAILED'
      );
    });

    it('should throw error on token verification failure', async () => {
      const idToken = 'test-id-token';

      mockOAuth2Client.verifyIdToken.mockRejectedValue(
        new Error('Verification failed')
      );

      await expect(googleOAuthService.verifyIdToken(idToken)).rejects.toThrow(
        'GOOGLE_TOKEN_VERIFICATION_FAILED'
      );
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink Google account successfully', async () => {
      const userId = 'user-123';
      const userWithPassword = {
        id: userId,
        googleId: 'google-123',
        password: 'hashed-password',
      };

      mockedQuery.mockImplementation(async (sql: string) => {
        const sqlLower = sql.toLowerCase();
        // SELECT query
        if (sqlLower.includes('select') && sqlLower.includes('from users')) {
          return createQueryResult([userWithPassword]);
        }
        // UPDATE query
        if (sqlLower.includes('update users')) {
          return createQueryResult([], 1);
        }
        return createQueryResult([]);
      });

      await googleOAuthService.unlinkAccount(userId);

      expect(mockedQuery).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent';

      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow(
        'USER_NOT_FOUND'
      );
    });

    it('should throw error if Google account not linked', async () => {
      const userId = 'user-123';
      const userWithoutGoogle = {
        id: userId,
        googleId: null,
        password: 'hashed-password',
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([userWithoutGoogle]));

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow(
        'GOOGLE_ACCOUNT_NOT_LINKED'
      );
    });

    it('should throw error if Google is the only auth method', async () => {
      const userId = 'user-123';
      const googleOnlyUser = {
        id: userId,
        googleId: 'google-123',
        password: null,
      };

      mockedQuery.mockResolvedValueOnce(createQueryResult([googleOnlyUser]));

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow(
        'CANNOT_UNLINK_ONLY_AUTH_METHOD'
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      expect(googleOAuthService.isConfigured()).toBe(true);
    });
  });
});
