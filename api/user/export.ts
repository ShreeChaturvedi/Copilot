/**
 * GET /api/user/export - Download the authenticated user's data as JSON.
 * Returns tasks, events, calendars, task lists, tags and attachments.
 */
import { createApiHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { userService } from '../../packages/backend/src/services/UserService.js';

export default createApiHandler({
  [HttpMethod.GET]: {
    method: HttpMethod.GET,
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
        const data = await userService.exportUserData(req.user.id);
        const filename = `taskflow-export-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );
        return res.status(200).json({
          success: true,
          data,
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Export user data error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while exporting data',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
});
