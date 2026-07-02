# Triage: Issue #9 (blob leak on attachment delete) and #31 (dev server missing /api/upload + /api/attachments)

Repo: /home/shree/dev/taskflow-calendar (ShreeChaturvedi/taskflow-calendar)
Branch: finish-polish-deploy, HEAD 3d6b329. Recon date 2026-07-01. Both issues are still OPEN on GitHub.

## Verdict (read this first)

**Both issues are ALREADY FIXED on this branch** by commit `5f05a95` "fix(attachments): delete blobs on attachment/task delete and add dev-server routes (#9, #31)" (2026-06-26, merged via `wf-g3-attachments` at merge commit `2f00d8a`). The fix is **NOT on main** (`git ls-tree main -- lib/utils/blobStorage.ts` returns nothing). Do not re-implement. Remaining work is: (a) verification, (b) one real residual on #31 (frontend still swallows the upload error and falls back to a data: URI), (c) small hardening/test gaps, (d) one adjacent bug found during triage that should be filed as a new GitHub issue.

- **#9 classification: fixed-on-branch, pending verification + close after merge/deploy.** All five acceptance criteria from the issue are met in code.
- **#31 classification: fixed-on-branch server-side; one residual client-side gap** (silent data:-URI fallback in `src/services/api/tasks.ts`) that arguably keeps the acceptance box unchecked. Needs an owner decision (see Questions).

Note `gh issue view <n> --comments` prints nothing in this environment (exit 0, empty). Use `gh issue view <n> --json title,body,labels,state,comments` instead. Neither issue has comments.

---

## Issue #9 — Attachment deletion leaks files in blob storage

### What the issue claimed (now stale)

TODO stubs at AttachmentService lines 647/700/821 and a no-op `deleteFileFromStorage` at 844. **All four are gone.** Line numbers in the issue no longer match the file.

### Current state (verified in working tree)

**New helper `lib/utils/blobStorage.ts`** (entire file, 3 exports):

- `isBlobUrl(url)` — `typeof url === 'string' && /^https?:\/\//i.test(url.trim())`. data: URIs, null, empty → false.
- `deleteBlob(url)` — returns early if `!isBlobUrl(url)`; returns early if `!process.env.BLOB_READ_WRITE_TOKEN`; else `const { del } = await import('@vercel/blob'); await del(url, { token })` wrapped in try/catch that `console.error('Failed to delete blob', { url, error: message })` and swallows. One failure never aborts a larger operation.
- `deleteBlobs(urls[])` — dedupes via Set, filters through `isBlobUrl`, awaits `deleteBlob` serially per URL.

**`lib/services/AttachmentService.ts`** (864 lines, imports `deleteBlobs` at line 12):

- `delete()` line 650: after the DB row delete (line 646) calls `await this.deleteFileFromStorage(attachment.fileUrl, attachment.thumbnailUrl)`.
- `bulkDelete()` lines 681-710: the ownership SELECT now also fetches `a."fileUrl", a."thumbnailUrl"` (line 688); after the row delete it calls `deleteBlobs(attachments.rows.flatMap((a) => [a.fileUrl, a.thumbnailUrl]))` (lines 708-710).
- `cleanupOrphanedAttachments()` lines 812-835: orphan SELECT fetches `fileUrl`/`thumbnailUrl` (line 817), deletes rows, then `deleteBlobs(orphanedRes.rows.flatMap(...))` (lines 833-835).
- `deleteFileFromStorage(fileUrl, ...extraUrls)` lines 857-863: logs then delegates to `deleteBlobs([fileUrl, ...extraUrls])`. No longer a no-op.

**Bonus beyond the issue — task deletion also cleans blobs** (`lib/services/TaskService.ts`, imports `deleteBlobs` line 11):

- Schema (`lib/config/migrations/001_initial_schema.sql` line 154): `"taskId" text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE` — cascade would otherwise silently orphan blobs with no surviving rows.
- `delete(id)` lines 808-816: `const blobUrls = await this.collectAttachmentBlobUrls([id])` BEFORE `DELETE FROM tasks`, then `await deleteBlobs(blobUrls)` after.
- `bulkDelete` lines 1082-1093: same capture-before-cascade pattern.
- `collectAttachmentBlobUrls(taskIds)` lines 823-838: `SELECT "fileUrl", "thumbnailUrl" FROM attachments WHERE "taskId" IN (...)`, flatMaps both URLs, and its own try/catch returns `[]` on failure so blob bookkeeping never blocks the task delete.

### Acceptance criteria from #9 → code status

| Criterion                                         | Status                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| Delete removes row + blob                         | Done (delete → deleteFileFromStorage → deleteBlobs) |
| bulkDelete removes all blobs                      | Done (lines 708-710)                                |
| cleanupOrphanedAttachments removes orphaned blobs | Done (lines 833-835)                                |
| data-URI attachments delete without throwing      | Done (`isBlobUrl` skips them)                       |
| One storage error doesn't abort bulk ops          | Done (per-URL try/catch in `deleteBlob`)            |

### BLOB_READ_WRITE_TOKEN handling (asked in the task)

- `lib/config/env.ts` line 25: `BLOB_READ_WRITE_TOKEN: z.string().optional()` — optional everywhere, never required at boot.
- `api/upload/index.ts` line 52: `const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;` combined with `isProd = process.env.NODE_ENV === 'production'` (line 51). `!isProd && !hasBlob` → data-URI fallback (lines 56-130, sharp-optimized for images, `dev: true` flag in payload). Otherwise → `put()` from `@vercel/blob` (relies on env token implicitly; no explicit `token:` passed to `put`).
- `scripts/dev-server.ts` lines 172-181: no token → explicit `503 {"success":false,"error":{"code":"BLOB_NOT_CONFIGURED","message":"BLOB_READ_WRITE_TOKEN is not set; file uploads cannot be persisted locally. Set it in .env.local to test attachments."}}`. No data-URI fallback in the dev server.
- `lib/utils/blobStorage.ts`: `deleteBlob` reads the env var and passes `{ token }` explicitly to `del()`; **silently no-ops when the token is absent** (see residual R3).
- Documented in `.env.example` line 27 (`BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"`), `README.md` line 415, `README.monorepo.md` line 123.
- **Local state right now: neither `.env` nor `.env.local` exists in the repo**, so local dev has no token → `PUT /api/upload` returns the 503 above, and `deleteBlob` no-ops (harmless, nothing was ever uploaded to a store).

### @vercel/blob del() facts (installed version 0.27.3, matches package.json `^0.27.3`)

- Signature (`node_modules/@vercel/blob/dist/index.d.ts` line 59): `declare function del(url: string[] | string, options?: BlobCommandOptions): Promise<void>;`
- `BlobCommandOptions.token?: string` with `@defaultvalue process.env.BLOB_READ_WRITE_TOKEN` — so a token is required either via option or env; with neither, `del` throws `BlobError` ("No token found").
- Takes the **full blob URL(s)** exactly as stored in `fileUrl`/`thumbnailUrl` (e.g. `https://<storeid>.public.blob.vercel-storage.com/name-hash.jpg`). Accepts an array — the current per-URL loop in `deleteBlobs` could be one batched `del(urls, { token })` call, but the loop keeps failure isolation.
- Implementation POSTs `{ urls: [...] }` to the `/delete` API (`dist/index.js` line 28-36). Deleting a URL that doesn't exist is a **successful no-op** (Vercel's delete is idempotent) — the "already-deleted blob" acceptance concern is handled by the API itself; thrown errors are auth/store level (`BlobAccessError`, `BlobStoreNotFoundError`, `BlobServiceRateLimited`), and the wrapper swallows those too.

### #9 fix plan (what's actually left)

1. **Nothing to implement for the acceptance criteria.** Verify and close after merge to main + deploy.
2. Optional hardening (R3 below): in `lib/utils/blobStorage.ts:deleteBlob`, log a `console.warn` when skipping a real blob URL because the token is missing — today a misconfigured prod deploy resumes leaking with zero signal.
3. Test gap (R4): no test anywhere asserts blob cleanup. `lib/services/__tests__/AttachmentService.test.ts` (has delete/bulkDelete/cleanupOrphaned suites at lines 423-523) mocks only `../../config/database.js` and never mocks/asserts `lib/utils/blobStorage`; `lib/utils/__tests__/` does not exist. Add:
   - `lib/utils/__tests__/blobStorage.test.ts`: `isBlobUrl` truth table (https ✓, http ✓, `data:...` ✗, null/undefined/'' ✗); `deleteBlob` no-ops without token; calls `del(url, { token })` with token set (vi.mock `@vercel/blob`); swallows a rejecting `del`; `deleteBlobs` dedupes and continues past one failure.
   - In `AttachmentService.test.ts` and `TaskService.test.ts`: `vi.mock('../utils/blobStorage.js')` (note `.js` specifier) and assert `deleteBlobs` was called with the expected `[fileUrl, thumbnailUrl]` sets on delete/bulkDelete/cleanup/task-delete.

### #9 acceptance checks (manual, needs a real token)

```bash
# .env.local: BLOB_READ_WRITE_TOKEN=<paste from Vercel dashboard — user pastes it, never commit>
docker compose up -d                      # Postgres
npx tsx scripts/dev-server.ts             # API on :3001
npx vite --port 5180 --strictPort         # FE on :5180 (5173/5174 are taken by other projects)
```

1. Upload: `curl -s -X PUT 'http://localhost:3001/api/upload?filename=triage.txt' -H 'Content-Type: text/plain' --data 'hello'` → 201 with `data.url` = `https://....public.blob.vercel-storage.com/...`.
2. Create attachment row: `curl -s -X POST http://localhost:3001/api/attachments -H 'Content-Type: application/json' -d '{"fileName":"triage.txt","fileType":"text/plain","fileSize":5,"fileUrl":"<url>","taskId":"<existing dev-user task id>"}'`.
3. Delete it: `curl -s -X DELETE http://localhost:3001/api/attachments/<id>` → `{"success":true,"data":{"deleted":true}}`.
4. Confirm blob gone: `node -e "import('@vercel/blob').then(async ({list})=>{const r=await list();console.log(r.blobs.map(b=>b.url))}"` (token from env) → uploaded URL absent. Repeat via task delete (step 2 then `DELETE /api/tasks/:id`) to exercise the cascade path.
5. data-URI case: create an attachment with `fileUrl:"data:text/plain;base64,aGVsbG8="` and delete → 200, no error in dev-server logs.

---

## Issue #31 — Dev server lacks /api/upload and /api/attachments

### What the issue claimed (now stale)

`scripts/dev-server.ts` had no upload/attachment routes; Express 404'd with HTML; FE `isJson()===false` branches silently no-op'd. **The routes now exist** (same commit `5f05a95`).

### Current state (verified in `scripts/dev-server.ts`, 1252 lines)

- `PUT /api/upload` lines 150-260. Route-level `express.raw({ type: '*/*', limit: '60mb' })` (global `express.json()` at line 46 doesn't interfere with binary types). Mirrors `api/upload/index.ts`: sharp optimize (1920px jpeg q82) + thumbnail (512px webp q80) for images, raw `put()` otherwise. **No token → 503 `BLOB_NOT_CONFIGURED` JSON** (lines 172-181) — exactly the explicit-error behavior the issue and the task prompt demand. No data-URI fallback here.
- `GET /api/attachments` lines 263-293 (taskId/category/search/fileType/limit/offset via AttachmentService.findAll/findByCategory).
- `POST /api/attachments` lines 295-319 (maps `VALIDATION_ERROR:` → 400, `AUTHORIZATION_ERROR` → 403, else 500 — always JSON).
- `GET /api/attachments/:id` lines 321-339; shared `updateAttachment` handler lines 341-376 wired as `PUT`+`PATCH` lines 378-379; `DELETE /api/attachments/:id` lines 381-395 (calls `attachmentService.delete` → which now also deletes blobs, so #9 behavior holds locally too).
- All attachment routes use the hardcoded `devContext = { userId: 'dev-user-id' }` (lines 49-52) — consistent with the task routes (lines 85-145), so ownership checks line up locally. `resolveUserId(req)` (real JWT, lines 61-74) is only used by `/api/user/*` routes (lines 1107-1199). This is the pre-existing issue #18 class, not a #31 regression.
- FE proxy: `vite.config.ts` lines 120-124 proxies `/api` → `http://localhost:3001`.

### Frontend callers (verified)

- `src/services/api/tasks.ts` `createTask`: uploads data-URL attachments via `PUT ${apiBase}/upload?filename=...` (lines 274-281), throws on `!putRes.ok || !putBody.success` (285-286)... **but the enclosing `catch` (lines 293-303) logs `'File upload failed; using provided URL as fallback'` and continues with `publicUrl = f.url` (the raw data: URI)**, then POSTs `/api/attachments` with it (lines 305-316). A failed POST is also only logged (`'Attachment record creation failed'`, lines 317-324).
- `src/services/api/attachments.ts`: `listByTask` returns `[]` when response isn't JSON (line 29); `delete` returns silently when not JSON (line 57, "assume success in legacy mode"). With the dev routes now always returning JSON these no-op branches are dead locally, but remain landmines if the API server is down (Vite proxy then returns a non-JSON 500).
- UI delete callers: `src/components/tasks/TaskItem.tsx:173` and `src/components/tasks/TaskDetailSheet.tsx:118` (`await attachmentsApi.delete(att.id)`).

### Residual gaps (ranked)

- **R1 (the real one, blocks closing #31 as written):** FE swallow in `src/services/api/tasks.ts:293-303`. With no local token: dev server returns the honest 503, but the FE catches it and POSTs the attachment with the data: URI as `fileUrl`. Outcome: files whose base64 body stays under Express's default `express.json()` 100kb limit persist as data-URI rows (attachment "works", masking the missing token); anything bigger gets an Express 413 (HTML) on `POST /api/attachments`, FE logs and continues — **a silent no-op again, just moved**. The issue's acceptance ("real persistence or an explicit JSON error, not a silent no-op") is only met server-side.
  - Fix: in `createTask`, remove the catch-and-continue (rethrow so the UI surfaces it), and make the attachment-POST failure throw too. Files: `src/services/api/tasks.ts` (lines 268-325). Test: FE unit test mocking `fetch` → 503 `BLOB_NOT_CONFIGURED` → `createTask` rejects with that message (pattern: existing `src/components/tasks/__tests__/TaskItem.attachments.test.tsx` mocks `attachmentsApi`). Acceptance: with no token, attaching a file in the UI at http://localhost:5180 shows an error and creates NO attachment row (`curl 'http://localhost:3001/api/attachments?taskId=<id>'` → `[]`); with a token, the attachment persists with a blob URL and survives reload.
  - Alternative if the owner wants a zero-config local experience: keep a data-URI path but make it explicit (dev server accepts and persists data URIs, raise the `express.json` limit, cap file size) — that contradicts the issue text, so it's the owner's call (see Questions).
- **R2:** `api/upload/index.ts` (serverless) still has the silent dev data-URI fallback at lines 54-130 (`!isProd && !hasBlob`). Dead on Vercel prod (NODE_ENV=production) but live under `vercel dev`, and inconsistent with the dev server's honest 503. Align by replacing that branch with the same 503 `BLOB_NOT_CONFIGURED`. Also: prod with a missing token currently falls into `put()` which throws → generic 500 `INTERNAL_ERROR`; an upfront `!hasBlob → 503` in prod too gives a clear signal.
- **R3:** `deleteBlob` skips silently when token is missing — a misconfigured prod deploy leaks blobs with no log. Add a warn (see #9 plan step 2).
- **R4:** zero test coverage of blob cleanup (see #9 plan step 3).
- **R5 (cosmetic drift):** dev server has no `/api/attachments/stats` or `/api/attachments/cleanup` (serverless: `api/attachments/stats.ts`, `api/attachments/cleanup.ts`). Locally `GET /api/attachments/stats` is swallowed by the `:id` route → 404; `DELETE /api/attachments/cleanup` → `delete('cleanup')` → 403. No frontend callers exist today, so low priority; if added, register them BEFORE the `:id` routes.

### Adjacent bug found (file as a NEW GitHub issue — standing rule is to log every found bug; plan mode blocked `gh issue create` this session)

`api/attachments/cleanup.ts` lines 22-30: `cleanupOrphanedAttachments()` returns `{ deletedCount: number }` (AttachmentService.ts line 843), but cleanup.ts binds the whole object to `deletedCount` and interpolates it: the response message renders as `"[object Object] orphaned attachments were removed"` and `data.deletedCount` is a nested object `{deletedCount: n}` instead of a number. Fix: `const { deletedCount } = await attachmentService.cleanupOrphanedAttachments(...)`. Suggested title: "attachments cleanup endpoint returns '[object Object]' message and nested deletedCount".

---

## Suggested issue dispositions

- **#9:** comment that it's implemented on `finish-polish-deploy` in `5f05a95` (lib/utils/blobStorage.ts + AttachmentService delete/bulkDelete/cleanup + TaskService cascade capture), note the test gap, keep open until merged to main and verified against a real store, then close.
- **#31:** comment the same commit added the dev routes with the 503 `BLOB_NOT_CONFIGURED` behavior; keep open for R1 (FE fallback removal) unless the owner declares client behavior out of scope, in which case close on merge.

## Key commands used (repro)

```bash
gh issue view 9  --json title,body,labels,state,comments   # plain `--comments` prints nothing here
gh issue view 31 --json title,body,labels,state,comments
git log --oneline -15 -- lib/utils/blobStorage.ts lib/services/AttachmentService.ts scripts/dev-server.ts api/upload/index.ts
git ls-tree main -- lib/utils/blobStorage.ts               # empty → fix not on main
git branch --contains 5f05a95                               # finish-polish-deploy, wf-g3-attachments
```
