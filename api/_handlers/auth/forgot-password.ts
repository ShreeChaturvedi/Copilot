/**
 * POST /api/auth/forgot-password - Request a password reset link
 *
 * Always returns a generic success so the response cannot be used to tell
 * whether an email is registered.
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../../packages/backend/src/services/AuthService.js';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const GENERIC_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    const validationResult = forgotPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid email address is required',
          details: validationResult.error.errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      await authService.requestPasswordReset(validationResult.data.email);
    } catch (error) {
      // Log internally but never reveal failures to the caller; the response
      // must stay generic regardless of whether the email exists or sending
      // succeeded.
      console.error('Password reset request error:', error);
    }

    return res.status(200).json({
      success: true,
      data: { message: GENERIC_MESSAGE },
      meta: { timestamp: new Date().toISOString() },
    });
  },
});
