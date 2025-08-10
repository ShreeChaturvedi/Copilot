import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
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
    googleId: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...testUser,
        profile: { timezone: 'UTC' }
      });

      const result = await authService.registerUser(userData);

      expect(result.user.email).toBe(userData.email.toLowerCase());
      expect(result.user.name).toBe(userData.name);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email.toLowerCase() }
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      await expect(authService.registerUser(userData)).rejects.toThrow('USER_ALREADY_EXISTS');
    });

    it('should convert email to lowercase', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...testUser,
        email: 'test@example.com',
        profile: { timezone: 'UTC' }
      });

      await authService.registerUser(userData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });
  });

  describe('loginUser', () => {
    it('should login user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const hashedPassword = await bcrypt.hash(credentials.password, 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: hashedPassword
      });

      const result = await authService.loginUser(credentials);

      expect(result.user.email).toBe(credentials.email);
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email.toLowerCase() }
      });
    });

    it('should throw error for non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.loginUser(credentials)).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('should throw error for OAuth user without password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: null
      });

      await expect(authService.loginUser(credentials)).rejects.toThrow('OAUTH_USER_NO_PASSWORD');
    });

    it('should throw error for invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: hashedPassword
      });

      await expect(authService.loginUser(credentials)).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        profile: { timezone: 'UTC' }
      });

      const result = await authService.getUserById('user-123');

      expect(result?.id).toBe('user-123');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: { profile: true }
      });
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        profile: { timezone: 'UTC' }
      });

      const result = await authService.getUserByEmail('test@example.com');

      expect(result?.email).toBe('test@example.com');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { profile: true }
      });
    });

    it('should convert email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        profile: { timezone: 'UTC' }
      });

      await authService.getUserByEmail('TEST@EXAMPLE.COM');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { profile: true }
      });
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      mockPrisma.user.update.mockResolvedValue(testUser);

      await authService.updatePassword('user-123', 'NewPassword123!');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: expect.any(String) }
      });
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: hashedPassword
      });

      const result = await authService.verifyPassword('user-123', password);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 12);
      
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: hashedPassword
      });

      const result = await authService.verifyPassword('user-123', 'WrongPassword123!');

      expect(result).toBe(false);
    });

    it('should return false for user without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: null
      });

      const result = await authService.verifyPassword('user-123', 'TestPassword123!');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.verifyPassword('non-existent', 'TestPassword123!');

      expect(result).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = authService.validatePassword('StrongPassword123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const result = authService.validatePassword('Short1!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = authService.validatePassword('lowercase123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = authService.validatePassword('UPPERCASE123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = authService.validatePassword('NoNumbers!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = authService.validatePassword('NoSpecialChar123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(authService.validateEmail('test@example.com')).toBe(true);
      expect(authService.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email format', () => {
      expect(authService.validateEmail('invalid-email')).toBe(false);
      expect(authService.validateEmail('test@')).toBe(false);
      expect(authService.validateEmail('@example.com')).toBe(false);
      expect(authService.validateEmail('test.example.com')).toBe(false);
    });
  });
});