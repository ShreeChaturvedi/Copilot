/**
 * POST /api/auth/google/verify - Verify Google ID token (for client-side OAuth)
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { googleOAuthService } from '../../../packages/backend/src/services/GoogleOAuthService.js';
import { z } from 'zod';

const verifySchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Validate request body
      const validationResult = verifySchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid ID token request',
            details: validationResult.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { idToken } = validationResult.data;

      // Verify ID token and get/create user
      const authResult = await googleOAuthService.verifyIdToken(idToken);

      return res.status(200).json({
        success: true,
        data: authResult,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const err = error as Error;

      if (
        err.message === 'GOOGLE_TOKEN_VERIFICATION_FAILED' ||
        err.message === 'INVALID_ID_TOKEN'
      ) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_ID_TOKEN',
            message: 'Invalid Google ID token',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.error('Google ID token verification error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during token verification',
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
