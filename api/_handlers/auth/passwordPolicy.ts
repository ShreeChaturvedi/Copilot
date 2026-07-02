/**
 * Shared password policy for the self-serve auth flows.
 *
 * Registration, password reset and change-password now enforce the SAME strong
 * rule so a password accepted by one form is accepted by the others (issue #66:
 * register used to accept passwords that change-password later rejected as
 * WEAK_PASSWORD). Kept deliberately in sync with
 * AuthService.validatePassword (packages/backend/src/services/AuthService.ts),
 * which backs the change-password WEAK_PASSWORD check — the special-character
 * class here matches that validator exactly.
 */
import { z } from 'zod';

/** Special characters accepted by the policy (matches AuthService.validatePassword). */
export const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    SPECIAL_CHAR_REGEX,
    'Password must contain at least one special character'
  );
