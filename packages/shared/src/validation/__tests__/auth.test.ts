import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshTokenSchema,
  registerSchema,
} from '../auth';

describe('auth validation schemas', () => {
  it('normalizes emails to lowercase on registration', () => {
    const result = registerSchema.parse({
      email: 'TEST@Example.COM',
      password: 'StrongPass1!',
      name: 'Test User',
    });

    expect(result.email).toBe('test@example.com');
  });

  it('allows empty name strings on registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'StrongPass1!',
      name: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects weak passwords on registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'weakpass',
      name: 'Test User',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes emails on login', () => {
    const result = loginSchema.parse({
      email: 'LOGIN@Example.COM',
      password: 'Password123!',
    });

    expect(result.email).toBe('login@example.com');
  });

  it('validates password reset requests', () => {
    const result = passwordResetRequestSchema.parse({
      email: 'RESET@Example.COM',
    });

    expect(result.email).toBe('reset@example.com');
  });

  it('validates password reset confirmation payloads', () => {
    const result = passwordResetConfirmSchema.safeParse({
      token: 'reset-token',
      newPassword: 'NewStrong1!',
    });

    expect(result.success).toBe(true);
  });

  it('validates password change payloads', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldStrong1!',
      newPassword: 'NewStrong1!',
    });

    expect(result.success).toBe(true);
  });

  it('validates refresh token payloads', () => {
    const result = refreshTokenSchema.safeParse({
      refreshToken: 'refresh-token',
    });

    expect(result.success).toBe(true);
  });
});
