/**
 * GET /api/auth/google/callback - Google OAuth callback endpoint
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { googleOAuthService } from '../../../packages/backend/src/services/GoogleOAuthService.js';

export default createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_AUTH_CODE',
            message: 'Authorization code is required',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Exchange code for tokens and get/create user
      const authResult = await googleOAuthService.handleCallback(code);

      // In production, you'd redirect to frontend with tokens or set cookies
      // For API response:
      return res.status(200).json({
        success: true,
        data: authResult,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const err = error as Error;

      if (err.message === 'GOOGLE_OAUTH_FAILED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'GOOGLE_OAUTH_FAILED',
            message: 'Failed to authenticate with Google',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.error('Google OAuth callback error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during Google authentication',
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
