/**
 * POST /api/auth/reset-password - Confirm a password reset with a token
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../../packages/backend/src/services/AuthService.js';
import { z } from 'zod';
import { passwordSchema } from './passwordPolicy.js';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  // Shared strong policy, aligned with register and change-password (issue #66).
  newPassword: passwordSchema,
});

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const validationResult = resetPasswordSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid password reset data',
            details: validationResult.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { token, newPassword } = validationResult.data;
      await authService.confirmPasswordReset(token, newPassword);

      return res.status(200).json({
        success: true,
        data: {
          message: 'Your password has been reset. You can now sign in.',
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      const err = error as Error;

      if (
        err.message === 'INVALID_RESET_TOKEN' ||
        err.message === 'RESET_TOKEN_USED' ||
        err.message === 'RESET_TOKEN_EXPIRED'
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: err.message,
            message:
              'This password reset link is invalid or has expired. Please request a new one.',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.error('Password reset confirm error:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while resetting your password',
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
