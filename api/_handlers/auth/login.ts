/**
 * POST /api/auth/login - User login endpoint
 */
import { createMethodHandler } from '../../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../../packages/backend/src/services/AuthService.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default createMethodHandler(
  {
    [HttpMethod.POST]: async (
      req: AuthenticatedRequest,
      res: VercelResponse
    ) => {
      try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login credentials',
              details: validationResult.error.errors,
              timestamp: new Date().toISOString(),
            },
          });
        }

        const { email, password } = validationResult.data;

        // Authenticate user
        const authResult = await authService.loginUser({ email, password });

        // Return user and tokens
        return res.status(200).json({
          success: true,
          data: authResult,
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        const err = error as Error;

        if (err.message === 'INVALID_CREDENTIALS') {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
              timestamp: new Date().toISOString(),
            },
          });
        }

        if (err.message === 'OAUTH_USER_NO_PASSWORD') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'OAUTH_USER_NO_PASSWORD',
              message:
                'This account uses Google OAuth. Please sign in with Google.',
              timestamp: new Date().toISOString(),
            },
          });
        }

        // Generic server error
        console.error('Login error:', err);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred during login',
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  },
  { rateLimit: 'auth' }
);
