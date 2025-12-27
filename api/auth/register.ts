/**
 * POST /api/auth/register - User registration endpoint
 */
import { createMethodHandler } from '../../lib/utils/apiHandler.js';
import { HttpMethod } from '../../lib/types/api.js';
import type { AuthenticatedRequest } from '../../lib/types/api.js';
import type { VercelResponse } from '@vercel/node';
import { authService } from '../../packages/backend/src/services/AuthService.js';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').optional(),
});

export default createMethodHandler({
  [HttpMethod.POST]: async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Validate request body
      const validationResult = registerSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration data',
            details: validationResult.error.errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const { email, password, name } = validationResult.data;

      // Register user
      const authResult = await authService.registerUser({
        email,
        password,
        name,
      });

      // Return user and tokens
      return res.status(201).json({
        success: true,
        data: authResult,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const err = error as Error;

      if (err.message === 'USER_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_ALREADY_EXISTS',
            message: 'An account with this email already exists',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Generic server error
      console.error('Registration error:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during registration',
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});
