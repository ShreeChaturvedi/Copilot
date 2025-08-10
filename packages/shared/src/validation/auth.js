import { z } from 'zod';
// User registration schema
export const registerSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .min(1, 'Email is required')
        .max(255, 'Email is too long')
        .transform(email => email.toLowerCase()),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .max(128, 'Password is too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name is too long')
        .optional()
        .or(z.literal(''))
});
// User login schema
export const loginSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .min(1, 'Email is required')
        .transform(email => email.toLowerCase()),
    password: z
        .string()
        .min(1, 'Password is required')
});
// Password reset request schema
export const passwordResetRequestSchema = z.object({
    email: z
        .string()
        .email('Invalid email format')
        .min(1, 'Email is required')
        .transform(email => email.toLowerCase())
});
// Password reset confirm schema
export const passwordResetConfirmSchema = z.object({
    token: z
        .string()
        .min(1, 'Reset token is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .max(128, 'Password is too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
});
// Change password schema
export const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .max(128, 'Password is too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/\d/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
});
// Refresh token schema
export const refreshTokenSchema = z.object({
    refreshToken: z
        .string()
        .min(1, 'Refresh token is required')
});
// Google OAuth schemas
export const googleIdTokenSchema = z.object({
    idToken: z
        .string()
        .min(1, 'Google ID token is required')
});
export const googleCallbackSchema = z.object({
    code: z
        .string()
        .min(1, 'Authorization code is required')
        .optional(),
    error: z
        .string()
        .optional()
});
