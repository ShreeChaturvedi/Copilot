/**
 * Smoke test for DB-backed refresh token rotation + reuse detection.
 * Run against a throwaway DB that has the refresh_tokens table.
 */
import { refreshTokenService } from '../packages/backend/src/services/RefreshTokenService.js';
import { generateTokenPair } from '../packages/backend/src/utils/jwt.js';
import { query, pool } from '../packages/backend/src/config/database.js';

const userId = 'refresh-smoke-user';
const email = 'refresh-smoke@example.com';

async function main() {
  await query(
    `INSERT INTO users (id, email, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [userId, email]
  );

  console.log('1. issue + store initial token');
  const pair = await generateTokenPair(userId, email);
  await refreshTokenService.storeRefreshToken(pair.refreshToken, userId, email);

  console.log('2. validate stored token');
  const info = await refreshTokenService.validateRefreshToken(
    pair.refreshToken
  );
  console.assert(info.userId === userId, 'validate userId');

  console.log('3. rotate -> new pair, old revoked');
  const rotated = await refreshTokenService.rotateRefreshToken(
    pair.refreshToken
  );
  console.assert(
    rotated.refreshToken !== pair.refreshToken,
    'new token differs'
  );

  console.log('4. reuse of old (revoked) token is detected');
  const reuse = await refreshTokenService.detectTokenReuse(pair.refreshToken);
  console.assert(reuse === true, 'reuse detected');

  console.log('5. reuse invalidated the whole family -> new token now revoked');
  let newTokenRejected = false;
  try {
    await refreshTokenService.validateRefreshToken(rotated.refreshToken);
  } catch (e) {
    newTokenRejected = (e as Error).message === 'REFRESH_TOKEN_NOT_FOUND';
  }
  console.assert(newTokenRejected, 'family revoked after reuse');

  console.log('6. stats reflect no active tokens for user');
  const stats = await refreshTokenService.getStats();
  console.assert(!stats.tokensByUser[userId], 'no active tokens for user');

  const allOk =
    info.userId === userId &&
    rotated.refreshToken !== pair.refreshToken &&
    reuse === true &&
    newTokenRejected &&
    !stats.tokensByUser[userId];

  // cleanup
  await query('DELETE FROM refresh_tokens WHERE "userId" = $1', [userId]);
  await query('DELETE FROM users WHERE id = $1', [userId]);

  console.log(
    allOk
      ? '\n✅ REFRESH SMOKE PASSED - DB-backed rotation + reuse detection work'
      : '\n❌ REFRESH SMOKE FAILED - see assertions above'
  );
  await pool.end();
  if (!allOk) process.exit(1);
}

main().catch(async (err) => {
  console.error('\n❌ REFRESH SMOKE FAILED:', err);
  await pool.end();
  process.exit(1);
});
