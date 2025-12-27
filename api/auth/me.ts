/**
 * GET /api/auth/me - Get current authenticated user information
 */
import { createApiHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../packages/backend/src/services/AuthService.js';

export default createApiHandler({
  routes: [
    {
      method: HttpMethod.GET,
      requireAuth: true,
      handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
        try {
          // User is already authenticated via middleware
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

          // Fetch full user details from database
          const user = await authService.getUserById(req.user.id);

          if (!user) {
            return res.status(404).json({
              success: false,
              error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
                timestamp: new Date().toISOString(),
              },
            });
          }

          // Return user information
          return res.status(200).json({
            success: true,
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              createdAt: user.createdAt,
              profile: user.profile,
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          });
        } catch (error) {
          console.error('Get current user error:', error);
          return res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An error occurred while fetching user information',
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
    },
  ],
});
