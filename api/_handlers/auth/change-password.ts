/**
 * POST /api/auth/change-password - Change the authenticated user's password.
 * Verifies the current password, validates the new one, and persists the hash.
 */
import { createApiHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../../packages/backend/src/services/AuthService.js';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

export default createApiHandler({
  [HttpMethod.POST]: {
    method: HttpMethod.POST,
    requireAuth: true,
    validateBody: changePasswordSchema,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid password change request',
            details: parsed.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { currentPassword, newPassword } = parsed.data;

      try {
        // Reject when the account has no password (OAuth-only).
        const isValid = await authService.verifyPassword(
          req.user.id,
          currentPassword
        );
        if (!isValid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CURRENT_PASSWORD',
              message: 'Current password is incorrect',
              timestamp: new Date().toISOString(),
            },
          });
        }

        const strength = authService.validatePassword(newPassword);
        if (!strength.isValid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: strength.errors[0] ?? 'Password is too weak',
              details: strength.errors,
              timestamp: new Date().toISOString(),
            },
          });
        }

        // updatePassword revokes every existing session (including this
        // client's refresh token) and mints a fresh pair so the caller who
        // just changed their password stays signed in. Return that pair so the
        // client can swap it in; otherwise its now-revoked refresh token would
        // 401 on the next /auth/refresh and force-log the user out.
        const tokens = await authService.updatePassword(
          req.user.id,
          newPassword
        );

        return res.status(200).json({
          success: true,
          data: { message: 'Password updated successfully', tokens },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while changing the password',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
});
