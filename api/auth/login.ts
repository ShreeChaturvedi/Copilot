// Placeholder Vercel API route for login - will be implemented in task 4.2
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    // Placeholder response - will be implemented in task 4.2
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Login endpoint will be implemented in task 4.2',
        timestamp: new Date().toISOString(),
      },
    });
  },
});