/**
 * DELETE /api/user - Permanently delete the authenticated user's account.
 * Owned rows are removed via ON DELETE CASCADE. Also revokes refresh tokens.
 */
import { createApiHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { userService } from '../../packages/backend/src/services/UserService.js';
import { refreshTokenService } from '../../packages/backend/src/services/RefreshTokenService.js';

export default createApiHandler({
  [HttpMethod.DELETE]: {
    method: HttpMethod.DELETE,
    requireAuth: true,
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
      try {
        // Revoke tokens first so any cascade-deleted rows are already gone for
        // any concurrent request; the user row delete cascades the rest.
        await refreshTokenService.invalidateAllUserTokens(req.user.id);
        const deleted = await userService.deleteUser(req.user.id);
        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
              timestamp: new Date().toISOString(),
            },
          });
        }
        return res.status(200).json({
          success: true,
          data: { deleted: true },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while deleting the account',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
});
