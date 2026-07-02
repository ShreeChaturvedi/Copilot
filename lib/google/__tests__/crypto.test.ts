/**
 * Unit tests for AES-256-GCM token encryption (plan §9: round-trip + tamper
 * fail-closed).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  encryptToken,
  decryptToken,
  TokenCryptoConfigError,
  TokenDecryptError,
} from '../crypto.js';

const KEY_A = randomBytes(32).toString('hex');
const KEY_B = randomBytes(32).toString('hex');

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.GOOGLE_TOKEN_ENC_KEY;
  process.env.GOOGLE_TOKEN_ENC_KEY = KEY_A;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GOOGLE_TOKEN_ENC_KEY;
  else process.env.GOOGLE_TOKEN_ENC_KEY = originalKey;
});

describe('encryptToken / decryptToken', () => {
  it('round-trips a refresh token', () => {
    const secret = '1//0fake-refresh-token-payload_xyz';
    const enc = encryptToken(secret);
    expect(enc).not.toContain(secret);
    expect(enc.split('.')).toHaveLength(3);
    expect(decryptToken(enc)).toBe(secret);
  });

  it('produces a fresh IV per encryption (distinct ciphertexts)', () => {
    const a = encryptToken('same-input');
    const b = encryptToken('same-input');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe('same-input');
    expect(decryptToken(b)).toBe('same-input');
  });

  it('round-trips unicode and empty-ish payloads', () => {
    for (const s of ['", DROP TABLE;--', 'ütf-8 ✓ payload', 'x']) {
      expect(decryptToken(encryptToken(s))).toBe(s);
    }
  });

  it('fails closed on tampered ciphertext', () => {
    const enc = encryptToken('secret-token');
    const [iv, tag, ct] = enc.split('.');
    const ctBuf = Buffer.from(ct, 'base64');
    ctBuf[0] ^= 0xff;
    const tampered = [iv, tag, ctBuf.toString('base64')].join('.');
    expect(() => decryptToken(tampered)).toThrow(TokenDecryptError);
  });

  it('fails closed on tampered auth tag', () => {
    const enc = encryptToken('secret-token');
    const [iv, tag, ct] = enc.split('.');
    const tagBuf = Buffer.from(tag, 'base64');
    tagBuf[0] ^= 0x01;
    expect(() =>
      decryptToken([iv, tagBuf.toString('base64'), ct].join('.'))
    ).toThrow(TokenDecryptError);
  });

  it('fails closed on a wrong key', () => {
    const enc = encryptToken('secret-token');
    process.env.GOOGLE_TOKEN_ENC_KEY = KEY_B;
    expect(() => decryptToken(enc)).toThrow(TokenDecryptError);
  });

  it('fails closed on malformed payloads', () => {
    expect(() => decryptToken('not-even-close')).toThrow(TokenDecryptError);
    expect(() => decryptToken('a.b')).toThrow(TokenDecryptError);
    expect(() => decryptToken('')).toThrow(TokenDecryptError);
  });

  it('rejects a missing or malformed key with a config error', () => {
    delete process.env.GOOGLE_TOKEN_ENC_KEY;
    expect(() => encryptToken('x')).toThrow(TokenCryptoConfigError);
    process.env.GOOGLE_TOKEN_ENC_KEY = 'deadbeef'; // too short
    expect(() => encryptToken('x')).toThrow(TokenCryptoConfigError);
  });
});
