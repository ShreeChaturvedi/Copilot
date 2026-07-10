import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// JWT Configuration.
// JWT_SECRET is mandatory in production. Outside production we fall back to a
// clearly-labeled insecure value so tests and local dev work with zero config,
// but production must fail loudly rather than sign tokens with a known key.
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? ''
    : 'insecure-development-jwt-secret-do-not-use-in-production');
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required in production. Refusing to start with an insecure default.'
  );
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Issuer/audience claims are stamped on every token at sign time and pinned at
// verify time. Shared constants keep the sign and verify paths from drifting.
const JWT_ISSUER = 'react-calendar-app';
const JWT_AUDIENCE = 'react-calendar-app-users';

// Promisified wrappers with correct generics
function signAsync(
  payload: string | object | Buffer,
  secret: jwt.Secret,
  options?: jwt.SignOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options || {}, (err, token) => {
      if (err || !token) return reject(err);
      resolve(token);
    });
  });
}

function verifyAsync<T = unknown>(
  token: string,
  secret: jwt.Secret,
  options?: jwt.VerifyOptions
): Promise<T> {
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
  // Authorization role carried on access tokens so middleware can enforce
  // roles without a database lookup on every request. Optional for backward
  // compatibility with tokens minted before roles existed.
  role?: string;
  jti?: string;
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
export async function generateAccessToken(
  userId: string,
  email: string,
  role?: string
): Promise<string> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'access',
    ...(role ? { role } : {}),
  };

  return await signAsync(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Generate JWT refresh token
 */
export async function generateRefreshToken(
  userId: string,
  email: string
): Promise<string> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'refresh',
    // Unique per token so two refresh tokens minted in the same second (e.g.
    // during rotation) never collide into an identical signed string.
    jti: randomUUID(),
  };

  return await signAsync(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(
  userId: string,
  email: string,
  role?: string
): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email, role),
    generateRefreshToken(userId, email),
  ]);

  // Calculate expiration time for access token
  const decoded = jwt.decode(accessToken) as JWTPayload;
  const expiresAt = decoded.exp! * 1000; // Convert to milliseconds

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    // Pin the algorithm and require the issuer/audience the sign path stamps.
    // Without this, any HS-signed token minted with the same secret (for any
    // purpose or audience) would validate, and the accepted algorithm set would
    // be unrestricted (defense-in-depth against token or algorithm confusion).
    const decoded = await verifyAsync<JWTPayload>(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
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
export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
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
export async function refreshAccessToken(
  refreshToken: string
): Promise<string> {
  const decoded = await verifyToken(refreshToken);

  if (decoded.type !== 'refresh') {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  return await generateAccessToken(decoded.userId, decoded.email);
}
