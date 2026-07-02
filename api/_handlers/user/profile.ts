/**
 * PATCH /api/user/profile - Update the authenticated user's profile.
 * Persists name (users) and bio/avatarUrl/timezone (user_profiles).
 */
import { createApiHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { userService } from '../../../packages/backend/src/services/UserService.js';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  timezone: z.string().max(100).optional(),
});

export default createApiHandler({
  [HttpMethod.PATCH]: {
    method: HttpMethod.PATCH,
    requireAuth: true,
    validateBody: profileSchema,
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

      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile update',
            details: parsed.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      try {
        const user = await userService.updateProfile(req.user.id, parsed.data);
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
        return res.status(200).json({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            googleId: user.googleId,
            profile: user.profile,
          },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while updating the profile',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
});
