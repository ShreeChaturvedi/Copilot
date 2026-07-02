/**
 * AES-256-GCM encryption for Google refresh tokens (plan §1).
 *
 * Key: 32 bytes from env GOOGLE_TOKEN_ENC_KEY (hex, `openssl rand -hex 32`).
 * Format: base64(iv).base64(authTag).base64(ciphertext) with a random 12-byte
 * IV per encryption. Decrypt fails closed: any tamper/format/key problem
 * throws TokenDecryptError, which callers map to google_accounts.needsReauth.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class TokenCryptoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCryptoConfigError';
  }
}

/** Fail-closed decryption failure; callers must treat it as needsReauth. */
export class TokenDecryptError extends Error {
  constructor(message = 'Failed to decrypt stored token') {
    super(message);
    this.name = 'TokenDecryptError';
  }
}

function loadKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!hex) {
    throw new TokenCryptoConfigError('GOOGLE_TOKEN_ENC_KEY is not set');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex.trim())) {
    throw new TokenCryptoConfigError(
      'GOOGLE_TOKEN_ENC_KEY must be 32 bytes of hex (openssl rand -hex 32)'
    );
  }
  const key = Buffer.from(hex.trim(), 'hex');
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoConfigError('GOOGLE_TOKEN_ENC_KEY must be 32 bytes');
  }
  return key;
}

/** Encrypt a plaintext token to `b64(iv).b64(tag).b64(ct)`. */
export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ct.toString('base64'),
  ].join('.');
}

/**
 * Decrypt a `b64(iv).b64(tag).b64(ct)` payload. Throws TokenDecryptError on
 * any malformed input, wrong key, or authentication (tamper) failure.
 */
export function decryptToken(payload: string): string {
  const key = loadKey();
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new TokenDecryptError('Malformed encrypted token payload');
  }
  try {
    const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    throw new TokenDecryptError();
  }
}
