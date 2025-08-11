import jwt from 'jsonwebtoken';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Promisified wrappers with correct generics
function signAsync(payload: string | object | Buffer, secret: jwt.Secret, options?: jwt.SignOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options || {}, (err, token) => {
      if (err || !token) return reject(err);
      resolve(token);
    });
  });
}

function verifyAsync<T = unknown>(token: string, secret: jwt.Secret, options?: jwt.VerifyOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, options || {}, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded as T);
    });
  });
}

export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Generate JWT access token with user information
 */
export async function generateAccessToken(userId: string, email: string): Promise<string> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'access'
  };

  return await signAsync(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'react-calendar-app',
    audience: 'react-calendar-app-users'
  });
}

/**
 * Generate JWT refresh token
 */
export async function generateRefreshToken(userId: string, email: string): Promise<string> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'refresh'
  };

  return await signAsync(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'react-calendar-app',
    audience: 'react-calendar-app-users'
  });
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(userId: string, email: string): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email),
    generateRefreshToken(userId, email)
  ]);

  // Calculate expiration time for access token
  const decoded = jwt.decode(accessToken) as JWTPayload;
  const expiresAt = decoded.exp! * 1000; // Convert to milliseconds

  return {
    accessToken,
    refreshToken,
    expiresAt
  };
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const decoded = await verifyAsync<JWTPayload>(token, JWT_SECRET);
    return decoded as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('TOKEN_INVALID');
    } else if (error instanceof jwt.NotBeforeError) {
      throw new Error('TOKEN_NOT_ACTIVE');
    } else {
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token is expired without throwing
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const decoded = await verifyToken(refreshToken);
  
  if (decoded.type !== 'refresh') {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return await generateAccessToken(decoded.userId, decoded.email);
}