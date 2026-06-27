/**
 * GET/PATCH /api/user/preferences - Read or update the authenticated user's
 * workspace preferences (theme, default view, week start, notifications).
 */
import { createApiHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { userService } from '../../packages/backend/src/services/UserService.js';
import { z } from 'zod';

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  defaultView: z.enum(['calendar', 'tasks', 'last-used']).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  notificationsEnabled: z.boolean().optional(),
});

function unauthorized(res: VercelResponse) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
    },
  });
}

export default createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
    requireAuth: true,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      if (!req.user) return unauthorized(res);
      try {
        const preferences = await userService.getPreferences(req.user.id);
        return res.status(200).json({
          success: true,
          data: preferences,
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while loading preferences',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
  [HttpMethod.PATCH]: {
    method: HttpMethod.PATCH,
    requireAuth: true,
    validateBody: preferencesSchema,
    handler: async (req: AuthenticatedRequest, res: VercelResponse) => {
      if (!req.user) return unauthorized(res);
      const parsed = preferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preferences update',
            details: parsed.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }
      try {
        const preferences = await userService.updatePreferences(
          req.user.id,
          parsed.data
        );
        return res.status(200).json({
          success: true,
          data: preferences,
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Update preferences error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while saving preferences',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
});
