# Triage: issues #14, #15, #16, #17 — verified against working tree of `finish-polish-deploy`

Repo: /home/shree/dev/taskflow-calendar. Branch: finish-polish-deploy (HEAD 3d6b329). Verified 2026-07-01 against the CURRENT working tree, not issue text.

## Verdict summary

| Issue | Title                                              | Classification    | Fixed by commit | Merged via               |
| ----- | -------------------------------------------------- | ----------------- | --------------- | ------------------------ |
| #14   | Settings: profile update is a stub                 | **ALREADY-FIXED** | e853d36         | wf-g1-settings (4c7db7a) |
| #15   | Settings: data export + account deletion are stubs | **ALREADY-FIXED** | e853d36         | wf-g1-settings (4c7db7a) |
| #16   | Preferences and Security tabs are "Coming Soon"    | **ALREADY-FIXED** | e853d36         | wf-g1-settings (4c7db7a) |
| #17   | Event dialog Task tab unimplemented                | **ALREADY-FIXED** | 8b8e89d         | wf-g6-dialogs (a479e89)  |

All four GitHub issues are still OPEN and have zero comments. None of the fixes were cross-referenced back to the issues on GitHub. `grep -rn "Coming Soon\|TODO" src/components/settings/ src/components/dialogs/EventCreationDialog.tsx` returns nothing — no stubs remain.

Remaining work is: (a) runtime acceptance verification (DB is currently DOWN — `docker compose ps` shows no containers, so nothing has been exercised in this session), (b) zero automated test coverage for any of the new code, (c) a handful of small residual polish gaps listed per issue below, (d) close the issues with evidence.

---

## Issue #14 — Profile update (ALREADY-FIXED)

Issue asked for: backend endpoint updating name/avatarUrl/timezone, ProfileSettings calling it (no fake delay), authStore reflection, real error states.

### Evidence in working tree

- **Endpoint**: `api/user/profile.ts` — `PATCH /api/user/profile`, `requireAuth: true`, zod schema (lines 12-17): `name` 1-100 chars, `bio` ≤500 nullable, `avatarUrl` url ≤2048 nullable, `timezone` ≤100. Returns `{success, data:{id,email,name,createdAt,googleId,profile}}`.
- **Service**: `packages/backend/src/services/UserService.ts:105-153` `updateProfile()` — transaction, upserts `user_profiles` row (`ON CONFLICT ("userId") DO NOTHING`), updates `users.name` + `user_profiles.bio/"avatarUrl"/timezone` only for provided fields, returns `getFullUser()`.
- **Frontend**: `src/components/settings/ProfileSettings.tsx:70-108` `onSubmit` calls `userAPI.updateProfile(...)` (line 76), then `updateUser(...)` on authStore (line 83), `form.reset(...)` to persisted values (line 92), real error alert via `updateError` (lines 100-104, rendered 266-270). No console.log stub, no setTimeout fake delay.
- **API client**: `src/services/api/user.ts:54-65` `UserAPI.updateProfile` — `PATCH /api/user/profile` with Bearer token from `useAuthStore.getState().getValidAccessToken()`.
- **authStore**: `src/stores/authStore.ts:153` `updateUser` handles both google (`googleUser.name/picture`) and jwt (`user` merge) paths.
- **Dev server parity**: `scripts/dev-server.ts:1105` `app.patch('/api/user/profile', ...)` mirrors the serverless handler.
- Email intentionally NOT editable (schema comment at ProfileSettings.tsx:42-44, display-only input at lines 200-209).

### Residual gaps (polish, not blockers)

1. **avatarUrl has API support but no UI**: "Change Photo" button is `disabled` at `ProfileSettings.tsx:149-152`. The endpoint + service accept `avatarUrl`, so acceptance criterion "endpoint updates name, avatarUrl, timezone" is met on the backend; the UI never sends it. If avatar upload is wanted, wire it to the existing attachments/upload infra (`api/upload/`) — that is a separate small feature (~MEDIUM), otherwise leave the disabled button or remove it.
2. `ProfileSettings.tsx:101` still `console.error`s on failure (fine — it also surfaces the error in the UI).

### Acceptance checks

1. Bring up stack: `docker compose up -d` then `npx tsx scripts/migrate.ts` then `npx tsx scripts/dev-server.ts` (port 3001) and `npx vite --port 5180 --strictPort`.
2. Login as a local (jwt) user → Settings → Profile → change Display Name + Timezone → Save Changes → green "Profile updated successfully!".
3. Hard-reload the app → name persists in header/profile; `SELECT name FROM users WHERE email='...'` and `SELECT timezone, bio FROM user_profiles` confirm persistence.
4. Error path: stop dev-server, submit → red alert with a real message, no success state.
5. curl: `curl -X PATCH localhost:3001/api/user/profile -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"name":"X"}'` → 200 with profile payload; 101-char name → 400 (serverless handler; note the dev-server route skips zod validation, see gap list at bottom).

---

## Issue #15 — Data export + account deletion (ALREADY-FIXED)

Issue asked for: export downloads real JSON; deletion has confirmation dialog, DELETE endpoint (FK cascade), session ends after.

### Evidence in working tree

- **Export endpoint**: `api/user/export.ts` — `GET /api/user/export`, auth required, sets `Content-Disposition: attachment; filename="taskflow-export-YYYY-MM-DD.json"`, body `{success, data, meta}`.
- **Export contents**: `UserService.exportUserData()` (`packages/backend/src/services/UserService.ts:222-275`) returns `{exportedAt, version: 1, user:{id,email,name,createdAt,profile}, calendars, events, taskLists, tasks, tags, attachments}`. Tags = DISTINCT tags joined through `task_tags` for the user's tasks; attachments joined through the user's tasks. **Password hash is NOT included** (getFullUser selects `u.password` internally but the export picks only id/email/name/createdAt/profile).
- **Delete endpoint**: `api/user/index.ts` — `DELETE /api/user` (Vercel maps `api/user/index.ts` → `/api/user`), revokes all refresh tokens via `refreshTokenService.invalidateAllUserTokens(req.user.id)` (line 30) BEFORE `userService.deleteUser()` (line 31), which is `DELETE FROM users WHERE id=$1` relying on `ON DELETE CASCADE` (UserService.ts:281-284).
- **Frontend**: `src/components/settings/GeneralSettings.tsx`:
  - Export: `handleExportData` (lines 72-84) → `userAPI.exportData()`; client (`src/services/api/user.ts:97-118`) fetches, unwraps `data.data`, builds a Blob and triggers a browser download named `taskflow-export-YYYY-MM-DD.json`. Error surfaces via `exportError` alert (lines 319-323).
  - Delete: real `AlertDialog` confirmation (lines 372-404, "Delete your account?" with explicit consequences text), `handleConfirmDelete` (lines 86-101) calls `userAPI.deleteAccount()` then `await logout()` to end the session. Dialog stays open until the request resolves (`e.preventDefault()` at line 394); in-dialog error alert at lines 382-386.
- **Dev server parity**: `scripts/dev-server.ts:1162` (GET /api/user/export) and `:1178` (DELETE /api/user, same revoke-then-delete order).

### What a "real" data export should contain — assessment of current payload

Current: user (sans password), calendars, events, taskLists, tasks, tags, attachments (metadata rows), exportedAt, version. This satisfies the issue's acceptance list ("tasks, events, calendars, lists, and tags"). Known completeness gaps if anyone cares about re-import fidelity:

- **`task_tags` mapping rows are not exported** — you get the distinct tag rows but not which task carries which tag. Re-import could not reconstruct tag assignments. Fix: add `SELECT tt.* FROM task_tags tt JOIN tasks tk ON tk.id = tt."taskId" WHERE tk."userId" = $1` to `exportUserData`. QUICK (~10 lines: service + nothing else changes).
- Attachment binary contents are not included (only DB metadata/storage keys). Reasonable for a JSON export; note it in the UI copy if desired.
- Raw `SELECT *` rows leak internal ids/columns — acceptable for a personal export.

### Residual gaps

1. Export buffers the whole payload in memory and re-serializes client-side (fetch json → Blob). Fine at this data scale.
2. After account deletion the `logout()` call will fail server-side (tokens already revoked, user gone) — authStore.logout swallows backend errors and clears local state anyway (`src/stores/authStore.ts` logout catch: "Continue with local logout even if backend call fails"). Behaviorally correct.

### Acceptance checks

1. UI: Settings → General → Export → browser downloads `taskflow-export-<date>.json`; open it and confirm all seven top-level keys and real row data.
2. UI: Delete → confirmation dialog appears (no destructive call before confirm — verify via network tab); confirm → redirected to login, session gone.
3. DB: `docker compose exec db psql -U <user> -d <db> -c "SELECT count(*) FROM users WHERE id='<uid>'"` → 0; same for tasks/events/calendars/task_lists owned by that uid (cascade proof) and `refresh_tokens`.
4. curl: `curl -X DELETE localhost:3001/api/user -H "Authorization: Bearer $TOK"` → `{"success":true,"data":{"deleted":true}}`; repeat → 404 USER_NOT_FOUND.

---

## Issue #16 — Preferences + Security tabs (ALREADY-FIXED)

Issue asked for: at least one real persisted workspace default in Preferences, at least one real Security control, "log out everywhere" wired to `invalidateAllUserTokens`, deferred items explicitly scoped.

### Evidence in working tree

- **Migration**: `lib/config/migrations/007_user_preferences.sql` adds `theme`, `"defaultView"`, `"weekStartsOn"`, `"notificationsEnabled"` to `user_profiles` (idempotent ADD COLUMN IF NOT EXISTS). Runner: `scripts/migrate.ts` (lexical order, records in `schema_migrations`; `--status` flag available). 008_user_roles.sql exists after it.
- **Preferences endpoint**: `api/user/preferences.ts` — GET + PATCH `/api/user/preferences`, zod: theme enum light/dark/system, defaultView enum calendar/tasks/last-used, weekStartsOn int 0-6, notificationsEnabled bool. Service: `UserService.getPreferences`/`updatePreferences` (UserService.ts:158-217) with `ensureProfileRow` and defaults (system/calendar/0/false).
- **Preferences UI**: `src/components/settings/PreferencesSettings.tsx` — loads via `userAPI.getPreferences()` on mount (line 42), exposes Default View select (lines 102-131), Week Starts On select Sunday/Monday/Saturday (lines 135-159), Desktop Notifications switch (lines 163-177), Save button → `userAPI.updatePreferences` (line 72), loading/error/success states all real. No "Coming Soon" badge anywhere.
- **Security UI**: `src/components/settings/SecuritySettings.tsx` — three real cards:
  - Change Password form (lines 84-180): current/new/confirm, gated to `authMethod === 'jwt'` (line 33); Google-only accounts get an explanatory alert (lines 170-178) — that is the "explicitly scoped" deferral.
  - Connected Accounts (lines 182-205): Google link state badge from `authMethod === 'google' || user?.googleId`.
  - Active Sessions (lines 207-239): "Log out everywhere" → `logoutEverywhere()`.
- **Change-password endpoint**: `api/auth/change-password.ts` — POST, auth required, `authService.verifyPassword` (rejects OAuth-only accounts, wrong current pw → 400 INVALID_CURRENT_PASSWORD), `authService.validatePassword` strength check (→ 400 WEAK_PASSWORD with details), `authService.updatePassword` persists hash. Client: `authAPI.changePassword` (`src/services/api/auth.ts:329-358`).
- **Log out everywhere**: `src/stores/authStore.ts:243-259` `logoutEverywhere` calls `authAPI.logout(accessToken, refreshToken, true)`; `api/auth/logout.ts` accepts `logoutAll: z.boolean().optional()` (line 17) and at lines 57-58 calls invalidate-all-refresh-tokens for the user, i.e. wired to `invalidateAllUserTokens` exactly as the issue required.
- **Dev server parity**: `scripts/dev-server.ts:1133` (GET prefs), `:1146` (PATCH prefs), `:1197` (POST /api/auth/change-password).

### Residual gaps (candidates to file as new polish issues — do NOT reopen #16)

1. **Persisted preferences are not consumed by the app shell.** `grep -rn weekStartsOn src/` hits only `src/services/api/user.ts`, `PreferencesSettings.tsx`, and unrelated date-util defaults (`src/utils/dateGrouping.ts`, `src/utils/analytics.ts`). Calendar views do not read the saved `weekStartsOn`, and app startup does not read `defaultView` or server-side `theme`. Persistence works; application of the preference is future work. MEDIUM if pursued (plumb `userAPI.getPreferences()` into settingsStore/themeStore at login, pass weekStartsOn into calendar grid + date-fns `weekStartsOn` options in dateGrouping.ts).
2. **GeneralSettings still contains a cosmetic, non-persisted "Application Preferences" card** duplicating the real Preferences tab: Desktop Notifications switch with no state (`GeneralSettings.tsx:261`), Auto-save (`:273`), Keyboard Shortcuts (`:285`), and a Default View select with local `defaultValue="calendar"` (`:295`) that saves nowhere. These predate the fix and silently no-op. QUICK: delete the dead controls (or wire Default View/Notifications to `userAPI.updatePreferences` and drop the duplicates from the Preferences tab).
3. `theme` is a column + API field but PreferencesSettings does not expose it (theme lives client-side in `themeStore` via GeneralSettings Appearance card). Harmless divergence; decide one home for theme.
4. Change-password does not revoke other sessions afterward (standard hardening: call `invalidateAllUserTokens` on success, keep current session). QUICK, ~5 lines in `api/auth/change-password.ts` + dev-server mirror.

### Acceptance checks

1. `npx tsx scripts/migrate.ts --status` → 007 and 008 applied (DB must be up; it is currently DOWN).
2. Preferences: set Week Starts On = Monday → Save → "Preferences saved." → close/reopen settings → still Monday; `SELECT "weekStartsOn" FROM user_profiles WHERE "userId"='<uid>'` → 1.
3. Security (jwt user): wrong current password → "Current password is incorrect"; weak new password → strength error; valid change → success, then logout and confirm old password fails / new one works.
4. Google-auth user: Security tab shows the "signed in with Google" alert instead of the form.
5. Log out everywhere: log in from two browser profiles → trigger in one → both sessions dead once the second tries to refresh (`refresh_tokens` table empty for the user).

---

## Issue #17 — Event dialog Task tab (ALREADY-FIXED)

Issue asked for: Task tab creates tasks OR the tab is removed; no "Coming soon..." placeholder.

### Evidence in working tree

- Placeholder is gone. `grep -n "Coming soon\|will be implemented" src/components/dialogs/EventCreationDialog.tsx` → no matches.
- `src/components/dialogs/EventCreationDialog.tsx:178-209` — `TaskTabContent({onClose})` component: uses `useTaskManagement({includeTaskOperations: true})` (line 185) and renders the shared `EnhancedTaskInput` (`src/components/smart-input/EnhancedTaskInput.tsx`, exists) with `enableSmartParsing`, task-group selection, and `disabled={addTask.isPending}`. `onAddTask` (lines 187-193) calls `handleAddTask(title, groupId, smartData)` then `onClose()` — dialog closes after creating the task.
- Wired into the tab at lines 962-967: `<TabsContent value="task" ...><TaskTabContent onClose={onClose} /></TabsContent>`. Tab switching via `IntegratedActionBar` (line 716, `activeTab` state at line 260). The submit handler guards `if (activeTab !== 'event')` at line 485 so the event form can't fire from the task tab.
- Commit 8b8e89d also added the #19 conflict warning (lines 970+) — unrelated to this triage but shares the file.

### Residual gaps

- None functional. The tab is a single smart-input line (not a full task form with due date pickers etc.) but that intentionally reuses the left-pane creation surface, satisfying "reusing the existing smart-input / task creation form" from the issue's proposed approach. Smart parsing handles dates/priority inline.

### Acceptance checks

1. UI (vite on 5180 + dev-server on 3001): click a calendar slot → dialog → switch to Task tab → type "Buy milk tomorrow 5pm" → Enter → dialog closes, task appears in the task list pane with parsed due date; row exists in `tasks` table.
2. Verify task group selector in the input switches the target list.
3. Confirm no placeholder text anywhere in the dialog (already verified statically).

---

## Cross-cutting gaps and recommended follow-ups

1. **Zero automated tests for all of this.** `grep -rln "user/export|change-password|user/preferences|updateProfile|deleteUser|exportUserData" --include="*.test.ts*"` → no hits. Existing tests: `api/__tests__/task-management.e2e.test.ts`, `src/components/dialogs/__tests__/*` (5 files, none covering TaskTabContent), no `src/components/settings/__tests__/` at all. Recommended (MEDIUM, one focused PR):
   - `api/__tests__/user-settings.e2e.test.ts` following the pattern of `task-management.e2e.test.ts`: register user → PATCH profile → GET/PATCH preferences → GET export (assert 7 keys + task_tags once added) → POST change-password (wrong/weak/ok) → DELETE /api/user → assert cascade + token revocation.
   - Component tests: ProfileSettings submit success/error (mock userAPI), GeneralSettings delete-confirmation flow (no call before confirm), PreferencesSettings load/save, SecuritySettings password mismatch client-side check (`SecuritySettings.tsx:41-44`).
2. **Dev-server routes skip zod validation** (`scripts/dev-server.ts:1105,1146` pass `req.body ?? {}` straight to the service) while the serverless handlers validate. Dev/prod behavior divergence (e.g. dev accepts `weekStartsOn: 99`). QUICK: reuse the same zod schemas in dev-server.
3. **Export omits `task_tags` mapping** (see #15 section). QUICK.
4. **DB is currently down** — every acceptance check above needs `docker compose up -d` + `npx tsx scripts/migrate.ts` first. Local run recipe: `npx tsx scripts/dev-server.ts` (3001) and `npx vite --port 5180 --strictPort` (5173/5174 are taken by other projects).
5. **Close the issues** (execute-phase action, blocked in plan mode):
   - `gh issue close 14 --comment "Fixed in e853d36 (merged via wf-g1-settings): PATCH /api/user/profile + UserService.updateProfile; ProfileSettings now calls the real endpoint and updates authStore."`
   - `gh issue close 15 --comment "Fixed in e853d36: GET /api/user/export (JSON download) and DELETE /api/user (cascade + token revocation) with a real confirmation dialog in GeneralSettings."`
   - `gh issue close 16 --comment "Fixed in e853d36: Preferences tab persists defaultView/weekStartsOn/notifications via /api/user/preferences (migration 007); Security tab has change-password, Google link state, and log-out-everywhere wired to invalidateAllUserTokens."`
   - `gh issue close 17 --comment "Fixed in 8b8e89d (merged via wf-g6-dialogs): Task tab renders EnhancedTaskInput via TaskTabContent and creates real tasks, closing the dialog on submit."`
6. **New issues to file** (per the standing log-issues rule; blocked in plan mode, do in execute phase): (a) preferences persisted but not applied app-wide, (b) dead non-persisted controls in GeneralSettings Application Preferences card, (c) export missing task_tags rows, (d) no test coverage for settings/user endpoints, (e) optional: revoke sessions on password change, (f) optional: avatar upload UI for the disabled Change Photo button.
