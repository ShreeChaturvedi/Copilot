/**
 * POST /api/auth/logout - Logout user and invalidate refresh token
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { refreshTokenService } from '../../../packages/backend/src/services/RefreshTokenService.js';
import {
  extractTokenFromHeader,
  verifyToken,
} from '../../../packages/backend/src/utils/jwt.js';
import { z } from 'zod';

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  logoutAll: z.boolean().optional(), // Logout from all devices
});

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Validate request body
      const validationResult = logoutSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid logout request',
            details: validationResult.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { refreshToken, logoutAll } = validationResult.data;

      // Resolve the user id for "log out everywhere". This route has no auth
      // middleware, so derive it from the access token when req.user is absent.
      let userId = req.user?.id;
      if (logoutAll && !userId) {
        const token = extractTokenFromHeader(req.headers.authorization);
        if (token) {
          try {
            const decoded = await verifyToken(token);
            if (decoded.type === 'access') {
              userId = decoded.userId;
            }
          } catch {
            // ignore; fall through to single-token revocation
          }
        }
      }

      if (logoutAll && userId) {
        // Invalidate all refresh tokens for this user
        await refreshTokenService.invalidateAllUserTokens(userId);
      } else {
        // Invalidate only this refresh token
        await refreshTokenService.invalidateRefreshToken(refreshToken);
      }

      return res.status(200).json({
        success: true,
        data: {
          message: logoutAll
            ? 'Logged out from all devices'
            : 'Logged out successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Even if there's an error, we still want to indicate success
      // since the token is likely already invalid
      console.error('Logout error:', error);
      return res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
