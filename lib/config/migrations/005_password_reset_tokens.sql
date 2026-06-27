-- 005_password_reset_tokens.sql
-- Password reset tokens for the forgot-password flow.
-- Only a SHA-256 hash of each reset token is stored, never the raw token
-- (mirrors refresh_tokens). Tokens are single-use ("usedAt") and expire
-- ("expiresAt"). Idempotent so it is safe to re-run.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tokenHash" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "usedAt"    timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_idx"
  ON password_reset_tokens("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_idx"
  ON password_reset_tokens("userId");
