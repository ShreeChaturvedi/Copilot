/**
 * API configuration and constants
 */

/**
 * Environment configuration
 */
export const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // API settings
  API_VERSION: 'v1',
  API_PREFIX: '/api',
  
  // CORS settings
  CORS_ORIGINS: process.env.NODE_ENV === 'production' 
    ? [
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
        process.env.FRONTEND_URL || '',
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173'], // Common dev ports
  
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    AUTH_MAX_REQUESTS: 5,
    UPLOAD_MAX_REQUESTS: 10,
  },
  
  // JWT settings (will be used in task 4.1)
  JWT: {
    SECRET: process.env.JWT_SECRET || 'your-secret-key',
    EXPIRES_IN: '15m',
    REFRESH_EXPIRES_IN: '7d',
  },
  
  // Database settings (will be used in task 3.1)
  DATABASE: {
    URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/react_calendar_dev',
    MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  },
  
  // File upload settings (will be used in task 8.1)
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'text/plain',
    ],
  },
  
  // Google OAuth settings (will be used in task 4.3)
  GOOGLE_OAUTH: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
  },
  
  // Email settings (will be used in task 11.2)
  EMAIL: {
    FROM: process.env.EMAIL_FROM || 'noreply@example.com',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  },
  
  // Redis settings (will be used in task 12.1)
  REDIS: {
    URL: process.env.REDIS_URL || 'redis://localhost:6379',
  },
} as const;

/**
 * API response codes
 */
export const API_CODES = {
  // Success codes
  SUCCESS: 'SUCCESS',
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  
  // Client error codes
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server error codes
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // Auth specific codes
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Business logic codes
  RESOURCE_NOT_OWNED: 'RESOURCE_NOT_OWNED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INVALID_OPERATION: 'INVALID_OPERATION',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Default pagination settings
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Validation constants
 */
export const VALIDATION = {
  // String lengths
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 255,
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 2000,
  
  // Array limits
  MAX_TAGS_PER_TASK: 20,
  MAX_ATTACHMENTS_PER_TASK: 10,
  
  // Date limits
  MIN_DATE: new Date('1900-01-01'),
  MAX_DATE: new Date('2100-12-31'),
} as const;

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 2 * 60 * 60, // 2 hours
  VERY_LONG: 24 * 60 * 60, // 24 hours
} as const;

/**
 * Feature flags
 */
export const FEATURES = {
  ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  ENABLE_CORS: process.env.ENABLE_CORS !== 'false',
  ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false',
  ENABLE_REAL_TIME: process.env.ENABLE_REAL_TIME !== 'false',
} as const;

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Warn about optional but recommended variables
  const recommended = [
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];
  
  const missingRecommended = recommended.filter(key => !process.env[key]);
  
  if (missingRecommended.length > 0 && config.NODE_ENV === 'production') {
    console.warn(`Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

/**
 * Get base URL for the application
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  return config.NODE_ENV === 'production' 
    ? 'https://your-domain.com' 
    : 'http://localhost:3000';
}

/**
 * Check if running in development mode
 */
export const isDevelopment = config.NODE_ENV === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = config.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = config.NODE_ENV === 'test';