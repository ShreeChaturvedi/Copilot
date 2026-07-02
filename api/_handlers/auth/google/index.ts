/**
 * GET  /api/auth/google - Get Google OAuth authorization URL
 * POST /api/auth/google - Exchange an authorization code for a session
 *
 * The callback page (src/pages/GoogleCallback.tsx) posts { code, redirectUri }
 * here after Google redirects back. We exchange the code for tokens + a user
 * record and return a shape the callback maps onto setGoogleAuth(googleTokens,
 * user). `googleTokens.accessToken` carries the app's own JWT so that all
 * subsequent authenticated API calls work the same as email/password sessions.
 */
import { createMethodHandler } from '../../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { googleOAuthService } from '../../../../packages/backend/src/services/GoogleOAuthService.js';

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

  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
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

      const { code } = (req.body ?? {}) as { code?: string };

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

      // Exchange the authorization code for tokens and a user record.
      const authResult = await googleOAuthService.handleCallback(code);

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            name: authResult.user.name ?? '',
            picture: authResult.user.avatarUrl,
          },
          // googleTokens carries the app's JWT pair: the callback stores
          // accessToken as the bearer for all subsequent API requests.
          googleTokens: {
            accessToken: authResult.tokens.accessToken,
            refreshToken: authResult.tokens.refreshToken,
            expiresAt: authResult.tokens.expiresAt,
          },
          isNewUser: authResult.isNewUser,
        },
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

      console.error('Google OAuth code exchange error:', error);
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
