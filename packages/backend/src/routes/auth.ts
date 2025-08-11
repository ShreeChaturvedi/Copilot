import { Router, Request, Response, RequestHandler } from 'express';
import { 
  authenticateToken, 
  validateRefreshToken
} from '../middleware/auth.js';
import {
  authRateLimit,
  loginRateLimit,
  refreshTokenRateLimit,
  passwordResetRateLimit
} from '../middleware/rateLimiting.js';
import { validateBody } from '../middleware/validation.js';
import { refreshTokenService } from '../services/RefreshTokenService.js';
import { tokenBlacklistService } from '../services/TokenBlacklistService.js';
import { authService } from '../services/AuthService.js';
import { googleOAuthService } from '../services/GoogleOAuthService.js';
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  changePasswordSchema
} from '@shared/validation/auth';

const router = Router();

/**
 * POST /auth/register
 * Register a new user with email and password
 */
router.post('/register', authRateLimit, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Additional validation
    if (!authService.validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
          timestamp: new Date().toISOString()
        }
      });
    }

    const passwordValidation = authService.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet requirements',
          details: passwordValidation.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Register user
    const result = await authService.registerUser({ email, password, name });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    let errorCode = 'REGISTRATION_FAILED';
    let errorMessage = 'Failed to register user';
    let statusCode = 500;

    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_ALREADY_EXISTS':
          errorCode = 'USER_ALREADY_EXISTS';
          errorMessage = 'User with this email already exists';
          statusCode = 409;
          break;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/login
 * Login user with email and password
 */
router.post('/login', loginRateLimit, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Authenticate user
    const result = await authService.loginUser({ email, password });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    let errorCode = 'LOGIN_FAILED';
    let errorMessage = 'Invalid credentials';
    const statusCode = 401;

    if (error instanceof Error) {
      switch (error.message) {
        case 'INVALID_CREDENTIALS':
          errorCode = 'INVALID_CREDENTIALS';
          errorMessage = 'Invalid email or password';
          break;
        case 'OAUTH_USER_NO_PASSWORD':
          errorCode = 'OAUTH_USER_NO_PASSWORD';
          errorMessage = 'This account was created with Google. Please use Google login.';
          break;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/password-reset/request
 * Request password reset
 */
router.post('/password-reset/request', passwordResetRateLimit, validateBody(passwordResetRequestSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Request password reset
    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      data: {
        message: 'If an account with this email exists, a password reset link has been sent.'
      }
    });
  } catch {
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      data: {
        message: 'If an account with this email exists, a password reset link has been sent.'
      }
    });
  }
});

/**
 * POST /auth/password-reset/confirm
 * Confirm password reset with token
 */
router.post('/password-reset/confirm', authRateLimit, validateBody(passwordResetConfirmSchema), async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    // Validate password strength
    const passwordValidation = authService.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet requirements',
          details: passwordValidation.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Confirm password reset
    await authService.confirmPasswordReset(token, newPassword);

    res.json({
      success: true,
      data: {
        message: 'Password has been reset successfully'
      }
    });
  } catch (error) {
    let errorCode = 'PASSWORD_RESET_FAILED';
    let errorMessage = 'Failed to reset password';
    let statusCode = 400;

    if (error instanceof Error) {
      switch (error.message) {
        case 'PASSWORD_RESET_NOT_IMPLEMENTED':
          errorCode = 'PASSWORD_RESET_NOT_IMPLEMENTED';
          errorMessage = 'Password reset functionality is not yet implemented';
          statusCode = 501;
          break;
        case 'INVALID_RESET_TOKEN':
          errorCode = 'INVALID_RESET_TOKEN';
          errorMessage = 'Invalid or expired reset token';
          break;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticateToken as unknown as RequestHandler, validateBody(changePasswordSchema) as unknown as RequestHandler, async (req: Request & { user?: { id: string; email: string } }, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = req.user!;

    // Verify current password
    const isCurrentPasswordValid = await authService.verifyPassword(user.id, currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate new password strength
    const passwordValidation = authService.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet requirements',
          details: passwordValidation.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update password
    await authService.updatePassword(user.id, newPassword);

    // Invalidate all refresh tokens for security
    refreshTokenService.invalidateAllUserTokens(user.id);

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully. Please log in again.'
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to change password',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /auth/google
 * Get Google OAuth authorization URL
 */
router.get('/google', (_req: Request, res: Response) => {
  try {
    if (!googleOAuthService.isConfigured()) {
      return res.status(501).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured',
          timestamp: new Date().toISOString()
        }
      });
    }

    const authUrl = googleOAuthService.getAuthUrl();

    res.json({
      success: true,
      data: {
        authUrl
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: {
        code: 'GOOGLE_AUTH_URL_FAILED',
        message: 'Failed to generate Google auth URL',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_ERROR',
          message: `Google OAuth error: ${error}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_CODE',
          message: 'Authorization code is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await googleOAuthService.handleCallback(code);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    let errorCode = 'GOOGLE_OAUTH_CALLBACK_FAILED';
    let errorMessage = 'Google OAuth callback failed';

    if (error instanceof Error) {
      switch (error.message) {
        case 'GOOGLE_OAUTH_FAILED':
          errorCode = 'GOOGLE_OAUTH_FAILED';
          errorMessage = 'Google OAuth authentication failed';
          break;
        case 'GOOGLE_USER_INFO_FAILED':
          errorCode = 'GOOGLE_USER_INFO_FAILED';
          errorMessage = 'Failed to retrieve user information from Google';
          break;
      }
    }

    res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/google/verify
 * Verify Google ID token (for frontend Google Sign-In)
 */
router.post('/google/verify', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ID_TOKEN',
          message: 'Google ID token is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await googleOAuthService.verifyIdToken(idToken);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    let errorCode = 'GOOGLE_TOKEN_VERIFICATION_FAILED';
    let errorMessage = 'Google token verification failed';

    if (error instanceof Error) {
      switch (error.message) {
        case 'INVALID_ID_TOKEN':
          errorCode = 'INVALID_ID_TOKEN';
          errorMessage = 'Invalid Google ID token';
          break;
        case 'GOOGLE_TOKEN_VERIFICATION_FAILED':
          errorCode = 'GOOGLE_TOKEN_VERIFICATION_FAILED';
          errorMessage = 'Failed to verify Google token';
          break;
      }
    }

    res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/google/unlink
 * Unlink Google account from user
 */
router.post('/google/unlink', authenticateToken as unknown as RequestHandler, async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const user = req.user!;

    await googleOAuthService.unlinkAccount(user.id);

    res.json({
      success: true,
      data: {
        message: 'Google account unlinked successfully'
      }
    });
  } catch (error) {
    let errorCode = 'GOOGLE_UNLINK_FAILED';
    let errorMessage = 'Failed to unlink Google account';
    let statusCode = 500;

    if (error instanceof Error) {
      switch (error.message) {
        case 'USER_NOT_FOUND':
          errorCode = 'USER_NOT_FOUND';
          errorMessage = 'User not found';
          statusCode = 404;
          break;
        case 'GOOGLE_ACCOUNT_NOT_LINKED':
          errorCode = 'GOOGLE_ACCOUNT_NOT_LINKED';
          errorMessage = 'Google account is not linked to this user';
          statusCode = 400;
          break;
        case 'CANNOT_UNLINK_ONLY_AUTH_METHOD':
          errorCode = 'CANNOT_UNLINK_ONLY_AUTH_METHOD';
          errorMessage = 'Cannot unlink Google account as it is the only authentication method. Please set a password first.';
          statusCode = 400;
          break;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', refreshTokenRateLimit as unknown as RequestHandler, validateRefreshToken as unknown as RequestHandler, async (req: Request & { user?: { id: string; email: string } }, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const user = req.user!;

    // Check for token reuse (security breach detection)
    const isTokenReuse = await refreshTokenService.detectTokenReuse(refreshToken);
    if (isTokenReuse) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Security breach detected. All tokens have been invalidated.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Rotate refresh token for security
    const newTokenPair = await refreshTokenService.rotateRefreshToken(refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email
        },
        tokens: {
          accessToken: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
          expiresAt: newTokenPair.expiresAt
        }
      }
    });
  } catch (error) {
    let errorCode = 'REFRESH_FAILED';
    let errorMessage = 'Failed to refresh token';
    const statusCode = 401;

    if (error instanceof Error) {
      switch (error.message) {
        case 'REFRESH_TOKEN_NOT_FOUND':
          errorCode = 'REFRESH_TOKEN_NOT_FOUND';
          errorMessage = 'Refresh token not found';
          break;
        case 'TOKEN_USER_MISMATCH':
          errorCode = 'TOKEN_USER_MISMATCH';
          errorMessage = 'Token user mismatch';
          break;
        case 'INVALID_TOKEN_TYPE':
          errorCode = 'INVALID_TOKEN_TYPE';
          errorMessage = 'Invalid token type';
          break;
        case 'TOKEN_EXPIRED':
          errorCode = 'REFRESH_TOKEN_EXPIRED';
          errorMessage = 'Refresh token has expired';
          break;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and blacklist current token
 */
router.post('/logout', authenticateToken as unknown as RequestHandler, (req: Request & { token?: string }, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    const accessToken = req.token as string;

    // Blacklist access token
    tokenBlacklistService.blacklistToken(accessToken);

    // Invalidate refresh token if provided
    if (refreshToken) {
      refreshTokenService.invalidateRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      data: {
        message: 'Successfully logged out'
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/logout-all
 * Logout user from all devices
 */
router.post('/logout-all', authenticateToken as unknown as RequestHandler, (req: Request & { user?: { id: string }; token?: string }, res: Response) => {
  try {
    const user = req.user!;
    const accessToken = req.token as string;

    // Blacklist current access token
    tokenBlacklistService.blacklistToken(accessToken);

    // Invalidate all refresh tokens for this user
    refreshTokenService.invalidateAllUserTokens(user.id);

    res.json({
      success: true,
      data: {
        message: 'Successfully logged out from all devices'
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ALL_FAILED',
        message: 'Failed to logout from all devices',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticateToken as unknown as RequestHandler, (req: Request & { user?: { id: string; email: string } }, res: Response) => {
  const user = req.user!;

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email
      }
    }
  });
});

/**
 * GET /auth/verify
 * Verify if current token is valid
 */
router.get('/verify', authenticateToken as unknown as RequestHandler, (req: Request & { user?: { id: string; email: string } }, res: Response) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: {
        id: req.user!.id,
        email: req.user!.email
      }
    }
  });
});

/**
 * GET /auth/stats
 * Get authentication statistics (for debugging/monitoring)
 */
router.get('/stats', authenticateToken as unknown as RequestHandler, (_req: Request, res: Response) => {
  // Only allow this for development or admin users
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not available in production',
        timestamp: new Date().toISOString()
      }
    });
  }

  const blacklistStats = tokenBlacklistService.getStats();
  const refreshTokenStats = refreshTokenService.getStats();

  res.json({
    success: true,
    data: {
      blacklist: blacklistStats,
      refreshTokens: refreshTokenStats,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;