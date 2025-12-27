/**
 * GET /api/auth/google - Get Google OAuth authorization URL
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { googleOAuthService } from '../../../packages/backend/src/services/GoogleOAuthService.js';

export default createMethodHandler({
  [HttpMethod.GET]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Check if Google OAuth is configured
      if (!googleOAuthService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
            message: 'Google OAuth is not configured on this server',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Generate Google OAuth authorization URL
      const authUrl = googleOAuthService.getAuthUrl();

      return res.status(200).json({
        success: true,
        data: {
          authUrl,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Google OAuth URL generation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate Google OAuth URL',
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
