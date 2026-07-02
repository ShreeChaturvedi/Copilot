# Triage dossier: issues #18, #20, #32 (frontend)

Repo: /home/shree/dev/taskflow-calendar, branch `finish-polish-deploy` at 3d6b329 (2026-07-01).
All verification done against the CURRENT working tree with the app running live (Vite 5180 + `scripts/dev-server.ts` on 3001 + docker postgres). Repo untouched.

Verdicts up front:

- **#18 — FIXED on this branch** (commit baabbc6, in `wf-g7-minor`, ancestor of HEAD). Close after push.
- **#20 — FIXED on this branch** (commit 252efe6, ancestor of HEAD). Verified live end-to-end. Close after push. One new blocker bug found while verifying (see NEW BUG below).
- **#32 — ROOT CAUSE CONFIRMED, dev-only**: the draggable "🚧 DEV MODE" overlay (`DevAuthToggle` in `src/App.tsx`) is a `position:fixed; z-index:50` panel whose default position is the top-right corner, exactly covering the calendar header's Prev/Next/New-Event buttons. It intercepts every pointer event aimed at them. The nav handlers and FullCalendar ref wiring are **not broken at all** — hiding the overlay makes Next/Prev/Today work perfectly in week and month views. Production builds are unaffected (widget is `import.meta.env.DEV`-gated).

---

## Issue #32 — Calendar Next/Previous/Today navigation does nothing

### Classification

Bug, **dev-environment only**, not a deploy blocker for production users. High-value fix anyway: it blocks manual dev testing of ALL right-side header controls (search, filter, prev, next, new event, half of Today) and it already produced one false "critical" bug report (this issue). Cheap fix (one file).

### Confirmed root cause (evidence, not guess)

`DevAuthToggle` — `src/App.tsx:33-195`, rendered at `src/App.tsx:212` when `import.meta.env.DEV` (`src/App.tsx:200-205`).

- Default position `src/App.tsx:37-40`:
  ```ts
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('dev-toggle-position');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 220, y: 16 };
  });
  ```
- Panel root `src/App.tsx:150-162`: `className="fixed z-50 bg-yellow-100 ... cursor-grab"` with `onMouseDown={handleMouseDown}` (which calls `e.preventDefault()` and starts a drag, App.tsx:83-93). The root has NO `pointer-events-none`; only inner text spans do. So the whole ~172x98 px panel swallows pointerdown/mousedown/click.
- Measured live (1280x720 viewport): overlay rect `x:1070..1242, y:16..114`. Header "Next period" button rect `x:1190, y:20, w:28, h:28` — fully inside. Both the overlay and the header button cluster are right-anchored, so they overlap at ANY viewport width (overlay spans `innerWidth-220 .. innerWidth-48`; the prev/next/plus cluster sits `innerWidth-118 .. innerWidth-34`).
- Playwright's own actionability log named the interceptor verbatim when clicking "Next period":
  ```
  <div class="fixed z-50 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg border border-yellow-300 ... cursor-grab hover:shadow-xl"> intercepts pointer events
  ```
  (click retried until 5s timeout; a document-level capture-phase listener I injected recorded ZERO pointerdown/mousedown/click events reaching the page, and `document.elementFromPoint()` at the button center returned the overlay div.)
- **Counterfactual proof**: after `overlay.style.display='none'` via console, with NO other change:
  - Next: first grid cell `data-date` 2026-06-28 → 2026-07-05, Today button enabled. Two more Nexts → 2026-07-12.
  - Today: back to 2026-06-28, Today disabled again.
  - Prev: works symmetrically.
  - Month view: title "July 2026" → "August 2026" on Next.
- Screenshot proof: `/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/32-overlay-covering-nav.png` (yellow panel sitting on the Prev/Next/New-Event buttons; only Today's left half peeks out). The repo-root `loggedin-calendar.png` from the 2026-06-26 session that filed #32 shows the identical overlay position — same mechanism in the original report.

The suspects named in the issue body are all exonerated: `RightPane.tsx:105-124` handlers, the `calendarRef` threading (MainLayout.tsx:21 `useRef` → RightPane.tsx:28 → CalendarView.tsx:420 `<FullCalendar ref=...>`), the `key={calendarKey}` remount (CalendarView.tsx:401 — key is `"06:00:00-22:00:00"`, derived from `calendarSettingsStore.getSlotTimes()` which returns stable strings unless the user changes slot settings), and the lazy `ConsolidatedCalendarHeader` all work correctly. Exactly one `.fc` root exists in the DOM. No console errors.

Why the original report saw "no-op with no errors": coordinate/forced clicks (claude-in-chrome style) land on the overlay; the overlay's `onMouseDown` preventDefaults and arms its drag logic; nothing else happens.

### Fix plan (file: `src/App.tsx` only)

1. Change the default position to bottom-right, away from the header (App.tsx:39):
   `{ x: window.innerWidth - 220, y: window.innerHeight - 130 }`
2. Bump the persistence key `'dev-toggle-position'` → `'dev-toggle-position-v2'` (App.tsx:38 and App.tsx:133) so stale saved top-right positions don't resurrect the overlap for existing dev profiles.
3. (Recommended hardening) Restrict dragging to the title bar: move `onMouseDown`/`onTouchStart` from the root div (App.tsx:161-162) onto the "🚧 DEV MODE" title div (App.tsx:164) and drop that div's `pointer-events-none`. Root stays pointer-opaque (it is an opaque panel; click-through would be confusing), but a mis-positioned panel can always be dragged off by its title.
4. Do NOT delete the widget: Mock Login is genuinely functional locally because `scripts/dev-server.ts` falls back to `devContext.userId = 'dev-user-id'` for any invalid/absent bearer token (dev-server.ts:50, 57-73), so the mock token still yields working data endpoints.

### Tests

- No e2e harness exists yet (vitest + jsdom only; CI is issue #24). Add a cheap component regression test now: render `<DevAuthToggle />` (export it or test via App) with `localStorage` empty and `window.innerWidth=1280`, assert the computed `style.top` is bottom-anchored (`y >= innerHeight - 200`), i.e. not in the 0-120px header band. Fragile-but-honest alternative: assert the storage key is `dev-toggle-position-v2`.
- Manual/scripted verification (this is what actually proves it — run after fix):
  ```bash
  docker start react-calendar-postgres
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/react_calendar_dev" JWT_SECRET="dev-triage-secret" npx tsx scripts/dev-server.ts &   # no .env exists in the repo; env must be inline
  npx vite --port 5180 --strictPort &
  playwright-cli -s=v32 open http://localhost:5180   # click "Mock Login"
  playwright-cli -s=v32 click "getByRole('button', { name: 'Next period' })"
  playwright-cli -s=v32 --raw eval "document.querySelector('[data-date]').getAttribute('data-date')"  # must advance
  ```
- When Playwright e2e lands (#24): test "clicking Next period changes the first `[data-date]` cell; Today returns and disables".

### Acceptance criteria

- [ ] In dev (StrictMode, DevAuthToggle visible, default position, 1280x720): Next/Prev/Today clicks change the FullCalendar visible range in week AND month views; header title updates; Today enables when off-period.
- [ ] The DEV MODE panel does not overlap any header control at its default position; all header buttons are visible and clickable.
- [ ] A dev profile with an old saved `dev-toggle-position` no longer gets the overlapping position (key bumped).
- [ ] Panel remains draggable and Mock Login/Logout still work.
- [ ] Issue closed with a comment explaining prod was never affected (`import.meta.env.DEV` gate, App.tsx:200-205).

---

## Issue #18 — Hardcoded 'default-user'

### Classification

Already fixed on this branch. Commit `baabbc6` "fix(tasks): use authenticated user id in TaskFolderGrid, not 'default-user' (#18)" (part of the `wf-g7-minor` merge ab3199f, ancestor of HEAD — verified with `git merge-base --is-ancestor`).

### Verified current state

- `src/components/tasks/TaskFolderGrid.tsx:9` imports `useAuthStore`; line 165:
  ```ts
  const userId = useAuthStore((s) => s.user?.id ?? s.googleUser?.id ?? '');
  ```
  threaded into `createTaskFolders(tasks, taskGroups, globalShowCompleted, userId)` (lines 27, 51, 168-169). TODO gone.
- `grep -rn "default-user" --exclude-dir={node_modules,dist,.git}` over the whole repo: **zero hits** (exit 1). All three acceptance criteria of the issue are met.

### Remaining work

None code-wise. Close the issue referencing baabbc6 once the branch is pushed (branch is 25 commits ahead of origin). Note in the close comment that the empty-string fallback (`?? ''`) is intentional for the pre-auth render frame.

---

## Issue #20 — Smart-input tag editor + in-progress analytics

### Classification

Already fixed on this branch. Commit `252efe6` "feat(frontend): tag editor dialog and in-progress analytics (#20)" (ancestor of HEAD; touched only `SmartTaskInput.tsx` +91 and `useTaskStats.ts` +5/-6). **Verified live end-to-end** (details below). Close after push, but read the NEW BUG section — it blocks the feature in dev and deserves its own issue.

### Verified current state (code)

- Tag click handler `src/components/smart-input/SmartTaskInput.tsx:263-266`: `handleTagClick` sets `editingTag`/`editingValue` (state at lines 123-124). Save logic 276-288 splices `editingValue` into `inputText` over `[startIndex, endIndex)` and re-parses. Dialog markup lines 588-636 (`<Dialog open={editingTag !== null}>`, title "Edit tag", shows `type` + confidence %, one text input, Cancel/Save). Wired via `onTagClick={handleTagClick}` at line 581 → `ParsedTags` (`src/components/smart-input/components/ParsedTags.tsx:61`).
- Stats hook `src/hooks/useTaskStats.ts:64-104`: reads `task.status`, `.toUpperCase()` switch maps `NOT_STARTED|PENDING`, `IN_PROGRESS|ACTIVE`, `DONE|COMPLETED|FINISHED`, falls back to the `completed` boolean. Both TODO comments named in the issue are gone from both files (grep exit 1).
- Backend really delivers `status`: `lib/services/TaskService.ts:309-311` (`transformEntity` emits `row.status` or derives from `completed`); column self-migrates with default `'NOT_STARTED'` (TaskService.ts:187-193); shared type `packages/shared/src/types/index.ts:93-94` (`status?: 'not_started' | 'in_progress' | 'done'` — lowercase; the hook's toUpperCase handles both casings).
- Consumer renders it: `src/components/tasks/TaskAnalyticsSummary.tsx:116` (donut slice "In Progress" #f59e0b), 268-274 (count pill), 294 (summary sentence).

### Verified live (headless, 2026-07-01)

Typed "Buy milk tomorrow 5pm" in the left-pane smart input → chips "Tomorrow at 5:00 PM" + "Shopping" rendered → clicked the time chip (`getByLabel('View Tomorrow at 5:00 PM tag')`) → dialog opened seeded with `tomorrow 5pm` → edited to `tomorrow 6pm`, Save → input became "Buy milk tomorrow 6pm" and chips re-parsed to "Tomorrow at 6:00 PM". Round-trip works.

**BUT** this only worked after I patched a live component ref via the React fiber, because of:

### NEW BUG found (file as its own gh issue — not filed yet, plan-mode constraint)

**Smart parsing is completely dead in dev (StrictMode): `useTextParser`'s `isMountedRef` is permanently false, so no tags ever render and the #20 tag editor is unreachable in dev.**

- File: `src/components/smart-input/hooks/useTextParser.ts:81-88`:
  ```ts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  ```
  `src/main.tsx:7` wraps the app in `<StrictMode>`. React 19 dev StrictMode mounts → runs cleanup → remounts every component; the cleanup sets `isMountedRef.current = false` and the effect body never sets it back to `true` (refs survive the simulated remount). Every debounced parse then bails silently at `useTextParser.ts:97` (`if (!isMountedRef.current) return;`) — `parseResult` stays null, no error, no console output.
- Evidence: with the app live, fiber inspection of `SmartTaskInput` showed hook state `parseResult=null, isLoading=false, error=null`, `parserRef.current=SmartParser` (loaded fine), `timeoutRef.current=<timer id>` (debounce ran), and **`isMountedRef.current === false` on a mounted, interactive component**. `new SmartParser().parse('Buy milk tomorrow 5pm #groceries')` run directly in the same page returned 2 tags. Setting `isMountedRef.current = true` via the fiber — a one-flag change, nothing else — made chips render on the next keystroke.
- Impact: dev-only (StrictMode double-invoke is dev-only; prod builds unaffected). But it invisibly disables smart parsing, tag highlighting, and the tag editor for anyone testing locally, and `triggerParse`/`clear` are fine so the failure is intermittent-looking.
- Fix (one line): add `isMountedRef.current = true;` as the first line of that effect body (line 82). The same stale-`isMounted` pattern is worth grepping for elsewhere: `grep -rn "isMountedRef" src/`.
- Suggested test: vitest + `@testing-library/react`, render a component using `useTextParser` inside `<StrictMode>`, type text, `await waitFor` tags to be non-empty. Fails today, passes with the fix.

### Remaining work for #20

- Close the issue referencing 252efe6 after push.
- 252efe6 added no tests. Nice-to-have (not blocking close): component test — mock `useTextParser` to return a fixed tag, render `SmartTaskInput`, click chip, assert dialog opens with `originalText`, save edited text, assert input value spliced correctly (cover the `startIndex/endIndex` splice and the whitespace-collapse `.replace(/\s+/g,' ')`).
- Acceptance (all currently met, conditional on the isMountedRef fix for dev verification):
  - [x] Clicking a parsed tag opens an editor dialog (verified live).
  - [x] Editing + Save replaces the tag span and re-parses (verified live).
  - [x] Stats count `in_progress`/`IN_PROGRESS` from the backend status field (code-verified; backend emits status).
  - [x] Both TODOs removed.

---

## Operational notes for whoever acts on this

- Dev stack quirks: **no `.env` exists**; `scripts/dev-server.ts` only loads `.env`/`.env.local`, so start it with env inline: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/react_calendar_dev" JWT_SECRET=<anything> npx tsx scripts/dev-server.ts`. Vite: `npx vite --port 5180 --strictPort` (5173/5174 are taken by other projects). Postgres: `docker start react-calendar-postgres` (I stopped it again after testing, restoring its prior state).
- Dev-server auth fallback: any invalid/missing bearer token resolves to userId `'dev-user-id'` (`scripts/dev-server.ts:50, 57-73`) — that's why Mock Login "works" and why local API smoke tests pass unauthenticated. Different from prod serverless handlers; keep in mind when interpreting local test results.
- Side effects I created (harmless, local only): user `triage32@example.com` in the local dev DB (via `/api/auth/register`); untracked `.playwright-cli/` and `loggedin-calendar.png` in the repo root pre-existed from the 2026-06-26 session.
- Per the project's standing rule (memory: log-issues-to-github), the `useTextParser` StrictMode bug needs a `gh issue create` — blocked by plan-mode/read-only constraints this session; do it first thing on execute.

## Suggested close-out actions (execute phase)

1. `git push` the branch (25 commits ahead), then `gh issue close 18 -c "Fixed in baabbc6 (wf-g7-minor): TaskFolderGrid reads the user id from useAuthStore; no 'default-user' literals remain (verified by repo-wide grep)."`
2. `gh issue close 20 -c "Fixed in 252efe6: tag chips open an Edit-tag dialog (verified live: edit tomorrow 5pm -> 6pm round-trip), and useTaskStats counts IN_PROGRESS from the backend status field."`
3. `gh issue create` for the useTextParser StrictMode bug (title: "Smart parsing dead in dev: useTextParser isMountedRef never reset after StrictMode remount"), body from the NEW BUG section above.
4. Fix #32 per the plan (App.tsx only), verify with the playwright-cli script above, close #32 with the root-cause explanation + screenshot.
