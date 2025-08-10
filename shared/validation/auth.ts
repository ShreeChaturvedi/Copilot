/**
 * Authentication validation schemas
 */

import { z } from 'zod';

/**
 * User validation schemas
 */
export const userSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const userProfileSchema = userSchema.extend({
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    leftPaneWidth: z.number().min(200).max(800).default(300),
    showCompletedTasks: z.boolean().default(true),
    defaultCalendar: z.string().default(''),
    showNotesEditor: z.boolean().default(false),
  }).optional(),
});

/**
 * Authentication request schemas
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Google OAuth schemas
 */
export const googleAuthSchema = z.object({
  googleToken: z.string().min(1, 'Google token is required'),
});

export const googleAuthStateSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  isAuthenticated: z.boolean(),
});

/**
 * JWT payload schema
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().cuid(),
  email: z.string().email(),
  iat: z.number(),
  exp: z.number(),
});

/**
 * Auth tokens schema
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  timezone: z.string().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    leftPaneWidth: z.number().min(200).max(800).optional(),
    showCompletedTasks: z.boolean().optional(),
    defaultCalendar: z.string().optional(),
    showNotesEditor: z.boolean().optional(),
  }).optional(),
});

/**
 * Validation helper functions
 */
export const validateEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const result = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/^(?=.*\d)/, 'Password must contain at least one number')
    .safeParse(password);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(err => err.message),
  };
};

/**
 * Type exports from schemas
 */
export type User = z.infer<typeof userSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetData = z.infer<typeof passwordResetSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type GoogleAuthRequest = z.infer<typeof googleAuthSchema>;
export type GoogleAuthState = z.infer<typeof googleAuthStateSchema>;
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;