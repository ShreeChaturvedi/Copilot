import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/auth/google/callback';

// Mock Google Auth Library
const mockOAuth2Client = {
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  setCredentials: vi.fn(),
  verifyIdToken: vi.fn()
};

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(() => mockOAuth2Client)
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  userProfile: {
    update: vi.fn()
  }
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}));

// Mock JWT utilities
vi.mock('../../utils/jwt.js', () => ({
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 900000
  })
}));

// Mock refresh token service
vi.mock('../RefreshTokenService.js', () => ({
  refreshTokenService: {
    storeRefreshToken: vi.fn()
  }
}));

// Mock fetch
global.fetch = vi.fn();

// Import after mocks
const { googleOAuthService } = await import('../GoogleOAuthService.js');

describe('GoogleOAuthService', () => {
  const mockGoogleUserInfo = {
    id: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    verified_email: true
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: null,
    googleId: 'google-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'profile-123',
      avatarUrl: 'https://example.com/avatar.jpg',
      timezone: 'UTC'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'consent'
      });
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback for new user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo)
      } as Response);

      // Mock user not found by Google ID
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Mock user not found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Mock user creation
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.isNewUser).toBe(true);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should handle OAuth callback for existing Google user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo)
      } as Response);

      // Mock existing user found by Google ID
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.isNewUser).toBe(false);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should link Google account to existing email user', async () => {
      const authCode = 'test-auth-code';
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      };

      const existingUser = {
        ...mockUser,
        googleId: null,
        password: 'hashed-password'
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleUserInfo)
      } as Response);

      // Mock user not found by Google ID
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Mock existing user found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      // Mock user update with Google ID
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        googleId: mockGoogleUserInfo.id
      });

      const result = await googleOAuthService.handleCallback(authCode);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.isNewUser).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { googleId: mockGoogleUserInfo.id },
        include: { profile: true }
      });
    });

    it('should throw error on OAuth failure', async () => {
      const authCode = 'test-auth-code';

      mockOAuth2Client.getToken.mockRejectedValue(new Error('OAuth failed'));

      await expect(googleOAuthService.handleCallback(authCode)).rejects.toThrow('GOOGLE_OAUTH_FAILED');
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
        email_verified: true
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload
      });

      // Mock user not found by Google ID
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Mock user not found by email
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Mock user creation
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await googleOAuthService.verifyIdToken(idToken);

      expect(result.user.email).toBe(mockGoogleUserInfo.email);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    });

    it('should throw error for invalid ID token', async () => {
      const idToken = 'invalid-token';

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => null
      });

      await expect(googleOAuthService.verifyIdToken(idToken)).rejects.toThrow('GOOGLE_TOKEN_VERIFICATION_FAILED');
    });

    it('should throw error on token verification failure', async () => {
      const idToken = 'test-id-token';

      mockOAuth2Client.verifyIdToken.mockRejectedValue(new Error('Verification failed'));

      await expect(googleOAuthService.verifyIdToken(idToken)).rejects.toThrow('GOOGLE_TOKEN_VERIFICATION_FAILED');
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink Google account successfully', async () => {
      const userId = 'user-123';
      const userWithPassword = {
        ...mockUser,
        password: 'hashed-password'
      };

      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockPrisma.user.update.mockResolvedValue({
        ...userWithPassword,
        googleId: null
      });

      await googleOAuthService.unlinkAccount(userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { googleId: null }
      });
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow('USER_NOT_FOUND');
    });

    it('should throw error if Google account not linked', async () => {
      const userId = 'user-123';
      const userWithoutGoogle = {
        ...mockUser,
        googleId: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(userWithoutGoogle);

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow('GOOGLE_ACCOUNT_NOT_LINKED');
    });

    it('should throw error if Google is the only auth method', async () => {
      const userId = 'user-123';
      const googleOnlyUser = {
        ...mockUser,
        password: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(googleOnlyUser);

      await expect(googleOAuthService.unlinkAccount(userId)).rejects.toThrow('CANNOT_UNLINK_ONLY_AUTH_METHOD');
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      expect(googleOAuthService.isConfigured()).toBe(true);
    });
  });
});