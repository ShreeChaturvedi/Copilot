import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { generateTokenPair } from '../../utils/jwt.js';

// Mock database module
const mockQuery = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock('../../config/database.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

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

// Import after mocks
const { authService } = await import('../AuthService.js');

describe('AuthService', () => {
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockClear();
    mockWithTransaction.mockClear();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      };

      // Mock SELECT query (check if user exists) - returns empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Mock transaction for INSERT user and profile
      mockWithTransaction.mockImplementationOnce(async (callback) => {
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              id: testUser.id,
              email: userData.email.toLowerCase(),
              name: userData.name,
              createdAt: testUser.createdAt,
            },
          ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // profile insert
        return callback();
      });

      const result = await authService.registerUser(userData);

      expect(result.user.email).toBe(userData.email.toLowerCase());
      expect(result.user.name).toBe(userData.name);
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      };

      // Mock SELECT query returning existing user
      mockQuery.mockResolvedValueOnce({ rows: [testUser], rowCount: 1 });

      await expect(authService.registerUser(userData)).rejects.toThrow(
        'USER_ALREADY_EXISTS'
      );
    });

    it('should convert email to lowercase', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPassword123!',
        name: 'Test User',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockWithTransaction.mockImplementationOnce(async (callback) => {
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              id: testUser.id,
              email: 'test@example.com',
              name: userData.name,
              createdAt: testUser.createdAt,
            },
          ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [] });
        return callback();
      });

      await authService.registerUser(userData);

      // Check that the first query was called with lowercase email
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test@example.com']
      );
    });
  });

  describe('loginUser', () => {
    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const hashedPassword = await bcrypt.hash(credentials.password, 12);

      // Mock SELECT query returning user with password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ...testUser,
            password: hashedPassword,
          },
        ],
      });

      const result = await authService.loginUser(credentials);

      expect(result.user.email).toBe(credentials.email);
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw error for non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      };

      // Mock SELECT query returning no user
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(authService.loginUser(credentials)).rejects.toThrow(
        'INVALID_CREDENTIALS'
      );
    });

    it('should throw error for OAuth user without password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      // Mock SELECT query returning user without password
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ...testUser,
            password: null,
          },
        ],
      });

      await expect(authService.loginUser(credentials)).rejects.toThrow(
        'OAUTH_USER_NO_PASSWORD'
      );
    });

    it('should throw error for invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 12);

      // Mock SELECT query returning user
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            ...testUser,
            password: hashedPassword,
          },
        ],
      });

      await expect(authService.loginUser(credentials)).rejects.toThrow(
        'INVALID_CREDENTIALS'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: testUser.email,
            name: testUser.name,
            createdAt: testUser.createdAt,
            timezone: 'UTC',
          },
        ],
      });

      const result = await authService.getUserById('user-123');

      expect(result?.id).toBe('user-123');
      expect(result?.profile?.timezone).toBe('UTC');
    });

    it('should return null for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
            createdAt: testUser.createdAt,
            timezone: 'UTC',
          },
        ],
      });

      const result = await authService.getUserByEmail('test@example.com');

      expect(result?.email).toBe('test@example.com');
      expect(result?.profile?.timezone).toBe('UTC');
    });

    it('should convert email to lowercase', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: testUser.id,
            email: 'test@example.com',
            name: testUser.name,
            createdAt: testUser.createdAt,
            timezone: 'UTC',
          },
        ],
      });

      await authService.getUserByEmail('TEST@EXAMPLE.COM');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LOWER'), [
        'TEST@EXAMPLE.COM',
      ]);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await authService.updatePassword('user-123', 'NewPassword123!');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password'),
        [expect.any(String), 'user-123']
      );
    });
  });

  describe('requestPasswordReset reset-link host (issue #34)', () => {
    const URL_KEYS = [
      'FRONTEND_URL',
      'VERCEL_PROJECT_PRODUCTION_URL',
      'VERCEL_URL',
      'RESEND_API_KEY',
      'FROM_EMAIL',
    ] as const;
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const k of URL_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of URL_KEYS) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
      }
    });

    // With RESEND unconfigured the service logs the reset link; assert the host.
    async function capturedResetLink(): Promise<string> {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // SELECT user, then INSERT token.
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'user-123', email: 'test@example.com' }],
        rowCount: 1,
      });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await authService.requestPasswordReset('test@example.com');

      const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
      logSpy.mockRestore();
      const match = logged.match(/Reset link for [^:]+: (\S+)/);
      return match ? match[1] : '';
    }

    it('uses an explicit FRONTEND_URL over Vercel variables', async () => {
      process.env.FRONTEND_URL = 'https://app.taskflow.com';
      process.env.VERCEL_URL = 'taskflow-abc123-user.vercel.app';
      const link = await capturedResetLink();
      expect(
        link.startsWith('https://app.taskflow.com/reset-password?token=')
      ).toBe(true);
    });

    it('defaults to the local Vite port 5173 (not 3000) when nothing is set', async () => {
      const link = await capturedResetLink();
      expect(
        link.startsWith('http://localhost:5173/reset-password?token=')
      ).toBe(true);
    });
  });

  describe('token role claim (role in access token)', () => {
    it('loginUser passes the user role to generateTokenPair', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...testUser, password: hashedPassword, role: 'ADMIN' }],
      });

      await authService.loginUser({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(vi.mocked(generateTokenPair)).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'ADMIN'
      );
    });

    it('registerUser passes the default role to generateTokenPair', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // exists check
      mockWithTransaction.mockImplementationOnce(async (callback) => {
        mockQuery.mockResolvedValueOnce({
          rows: [
            {
              id: 'user-123',
              email: 'new@example.com',
              name: 'New User',
              createdAt: testUser.createdAt,
              role: 'USER',
            },
          ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // profile insert
        return callback();
      });

      await authService.registerUser({
        email: 'new@example.com',
        password: 'TestPassword123!',
        name: 'New User',
      });

      expect(vi.mocked(generateTokenPair)).toHaveBeenCalledWith(
        'user-123',
        'new@example.com',
        'USER'
      );
    });
  });
});
