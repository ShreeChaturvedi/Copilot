# Integration pass evidence (issue #28)

Captured 2026-07-02 against the live app (Vite :5192, dev API :3021) with playwright-cli headless. Themes via the app's themeStore setTheme (the same code path as Settings > General > Appearance). Naming: `{surface}-{theme}-{width}.png`. Full matrix at 1440 and 390 in both themes for login, signup, cal-week/day/month/list, tasks, folders, kanban, task-sheet, event-dialog, create-list, create-calendar, cmdk, settings, settings-integrations. Representative 768 subset: cal-week, tasks, kanban, settings, both themes. Mobile checked for horizontal overflow down to 390 (scrollWidth 370 < clientWidth). The 390 create-list/create-calendar shots are omitted because the sidebar that hosts their entry points is a drawer at that width; the 390 event-dialog and task-sheet shots cover the bottom-sheet dialog treatment.

## Cross-surface inconsistencies fixed (commit: the integration consistency commit)

1. Toaster (App.tsx) followed the OS (`theme="system"`) instead of the in-app theme control, and skinned variants with raw emerald/red/amber fills. Now bound to themeStore resolvedTheme; success = success tokens (aqua, brief 2.3), error = destructive, base = popover surface.
2. Global MutationCache double-toasted every mutation failure that also had a per-hook onError toast (the audit's stacked VALIDATION_ERROR toasts). Global handler now only logs when the mutation defines its own onError.
3. ProtectedRoute and PublicRoute "Verifying your session" state used emerald spinner + slate text. Now primary/muted tokens.
4. Sidebar TaskAnalyticsSummary was the last green surface: emerald donut segment, green oklch gradient progress bar, emerald % text, green Flag for done, amber-500 icon. Now aqua/warning/faint tokens, done = CheckCircle2 in success, numerals mono (type role: counts are mono), sentence-case tooltips.
5. TaskAnalyticsDialog charts used raw hexes (#10b981/#f59e0b/#6b7280/#3b82f6/#ef4444). Now token vars (aqua/warning/faint/destructive) + curated blue #0d97d5; the include-completed toggle still carried the retired today-green oklch(0.7 0.15 140), now aqua film-08 + rim.
6. SmartParsingToggle (Autotag) and TaskControls show-completed toggle also carried the today-green on-state. Now aqua film + rim. Zero occurrences of the 140-hue green remain in src.
7. Invalid `hsl(var(--*))` wrappers that silently no-op since the oklch token pass: TaskGroupCombobox (two icon wrappers), ui/range-slider.css (slider thumbs lost their primary fill), ui/sidebar.tsx rail shadows. Rewritten to direct var() / color-mix.
8. Emoji-as-icon clash (audit 3.3): the smart input group button, TaskInput, and TaskGroupCombobox rendered raw emoji ids with a no-op inline color. All three now render the lucide glyph via getIconByName with Folder fallback tinted in the list color, matching TaskFolderGrid.
9. Sentence case sweep (brief section 7): Create Event -> Create event, Edit Event -> Edit event, New Event -> New event (aria-label + tooltip), All Day -> All day, Never Repeats -> Never repeats, Log Out -> Log out, Update Password -> Update password, StatusBadge Not Started / In Progress -> Not started / In progress (now matches the kanban column labels), Add Task placeholder -> Add task, New List menu items -> New list.
10. Settings success alerts (Preferences, Profile, Security) were green-200/green-950 slabs. Now aqua film + rim + success ink. Profile's amber note -> warning token.
11. GoogleCallback success/error states used raw green/red circles and alerts. Now success/destructive tokens.
12. ConflictWarning card was yellow-300/yellow-950. Now warning film + hairline pattern.
13. Smart-input parse-confidence dots (5 input variants), parsing error line, degraded-mode dot, voice record button, upload check, image error icon: raw green/yellow/red-400 -> success/warning/destructive tokens.
14. Dead src/components/ui/Modal.tsx (gray-800 legacy modal, zero consumers) deleted with its test and index exports.

## Issues filed

- #73: ~40 `transition-all` sites in shared shadcn primitives (switch, tabs, sidebar, progress, BaseList, color-picker, ...) violate motion grammar (brief 5). Too broad for a harmonization fix, needs per-primitive verification.

## Accepted leftovers (deliberate, not missed)

- DefaultPreview/PDFPreview file-type colors (pdf red, xls green, ...) are file-type identity marks inside attachment previews, treated like user-data colors, left raw.
- Settings card headings remain Title Case ("Account Overview", "Member Since"). A product-wide heading-case sweep is copy redesign, not cross-surface harmonization. Buttons and action labels are sentence case everywhere now.
- Dev-only: reloading `/app` (no trailing slash) 404s under Vite because base is `/app/`; production is covered by the vercel.json `/app -> /app/index.html` rewrite. The router leaves the URL at `/app` after login, so dev reloads from that exact URL show Vite's 404. Dev-ergonomics only.
- The yellow DEV MODE panel is `import.meta.env.DEV`-gated (never ships) and was hidden by injected CSS for the shots.

## Part A fixes verified in the same session (own commits)

- #57: expired access token + valid refresh token, reload at /app/ -> app boots authenticated, refresh token rotated, no /login redirect, zero console errors. Root causes: onRehydrateStorage cleared expired JWT sessions before refresh could run, useAuthGuard hard-cleared on client-side expiry, refreshTokenIfNeeded dropped the rotated refresh token (next exchange tripped TOKEN_REUSE_DETECTED), and concurrent guard effects raced the exchange (now single-flight).
- #68/#69: Settings > Appearance > Dark -> .dark applied, theme-store persists {"theme":"dark","hasExplicitPreference":true}, PATCH /api/user/preferences converges the server, reload stays dark. Fresh browser with no local preference correctly adopts the server value without marking it explicit.
- #58 remainder: toasts never show machine codes (toUserMessage strips "VALIDATION_ERROR:" prefixes, bare codes fall back to plain copy). "NO DUE DATE" was already "No date" (dateGrouping.ts) rendering as a sanctioned micro-caps label.

## Gates

- npx vitest run: 68 files, 806 tests green (updated: 4 tests pinning old copy/classes, removed Modal.test.tsx with its dead component).
- npx tsc -p tsconfig.app.json: clean. npm run build:frontend: succeeds.
