// Environment configuration with validation
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // File Upload
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5180'),
  BACKEND_URL: z.string().url().default('http://localhost:3001'),

  // Vercel
  VERCEL_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

// Parsing eagerly at import time meant merely importing this module threw
// whenever a required var (e.g. JWT_SECRET) was unset. Verified unimported
// anywhere in the runtime graph or test/ as of 2026-07-02 (see notes); parse
// lazily on first access so that stays true if something starts importing it.
let _env: z.infer<typeof envSchema> | undefined;
export function getEnv() {
  if (!_env) _env = envSchema.parse(process.env);
  return _env;
}

export const isDevelopment = () => getEnv().NODE_ENV === 'development';
export const isProduction = () => getEnv().NODE_ENV === 'production';
export const isTest = () => getEnv().NODE_ENV === 'test';

export const getBaseUrl = () => {
  // An explicit FRONTEND_URL always wins so emailed links point at the
  // canonical host. On Vercel, prefer the stable production domain over the
  // deployment-specific VERCEL_URL (which changes on every deploy). Fall back
  // to the real local Vite dev port (5173, strictPort in vite.config).
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
};
