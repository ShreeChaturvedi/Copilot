/**
 * L5 global setup: truncate the dedicated E2E database once before the run so
 * every suite starts from a deterministic, empty state.
 *
 * The local dev-server acts on a single hard-coded `dev-user-id` for
 * task/event/calendar data (see scripts/dev-server.ts + BaseService), so rows
 * accumulate across runs otherwise. Auth/user rows are real per-test users.
 */
import { resetDatabase } from './db';

export default async function globalSetup(): Promise<void> {
  await resetDatabase();
}
