# Token pass evidence (issue #28, Workstream B step 2)

Foundation only: tokens, fonts, hardcode sweep, calendar color re-base. Surface anatomy (TaskItem grid, kanban columns, folder cards, calendar disc and now-line chrome, dialogs) lands on later branches. Shots: own Vite on :5183 against a fresh dev API on :3005 (the shared :3001 instance had a dead DB pool, see below), playwright-cli headless, user token-pass@example.com, themes toggled via the app's persisted preference (what the in-app toggle writes).

## What the shots show

| Shot                                                   | Verdict                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| login-{light,dark}-1440                                | Canvas tokens correct behind the legacy auth chrome (body bg computes to `oklch(0.988 0.002 200)` / `oklch(0.174 0.008 200)`). Rainbow conic gradient and frosted panel are the auth surface pass (brief 4.8), untouched. Cursor glow re-based green to aqua.                                                                        |
| calendar-week-{light,dark}-{1440,390}                  | No green anywhere. Today pill aqua with per-theme ink (white numeral light, dark ink numeral dark). Today wash = aqua film. Weekend wash neutral. Now-line aqua (was destructive red). Event chip colors are user data, chip formula comes with the calendar surface pass.                                                           |
| tasks-folder-{light,dark}-1440, tasks-folder-light-390 | Folder cards on surface tokens, mini-calendar today disc aqua, sidebar donut still on legacy chart tokens (deliberate, analytics pass).                                                                                                                                                                                              |
| dialog-create-list-{light,dark}-1440                   | The ten curated swatches, blue pre-selected. Primary button enabled computes `oklch(0.53 0.088 182)` + white in light, bright aqua + ink in dark (verified via computed style, the light shot shows the disabled state because the name field is empty). "Create Task" copy bug is fixed in the dialog unification pass (brief 4.5). |
| kanban-light-1440                                      | getStatusConfig re-based: not-started neutral, in-progress `--warning` amber, done `--success` (aqua). Gray/emerald gone.                                                                                                                                                                                                            |

Fonts: `document.fonts.check` true for Inter, Spline Sans Mono 400/500, Sentient 300/400, all served from `/fonts/`. Zero requests to fonts.googleapis.com or gstatic (checked via resource timing). Bytes shipped: inter-latin.woff2 48,256 (variable wght, covers 400-600), spline-sans-mono-latin.woff2 36,476 (variable, 400-500), sentient-300.woff2 24,232, sentient-400.woff2 24,348. Total 133,312 bytes.

## Decisions and deviations from the brief

- The brief's ink token named `--muted` (2.2) is implemented as `--ink-muted` and mapped to shadcn `--muted-foreground`. shadcn `--muted` stays a surface (= `--surface-2`) because dozens of `bg-muted` call sites treat it as one. Surface passes should read `--muted-foreground` (or `text-muted-foreground`) where the brief says ink `--muted`.
- `--popover` maps to `--surface-3`, not `--surface-1`. The shadcn popover token also drives dropdowns, selects, command and FC popovers, which the brief puts on surface-3 (menus). Single token, menus won.
- Dark `--shadow-1` is `0 0 #0000` instead of `none` so it stays composable inside comma-separated shadow lists.
- Radius role tokens exposed as utilities: `rounded-chip` 6, `rounded-btn` 8, `rounded-card` 10, `rounded-dialog` 12, `rounded-sheet` 16. The stock sm/md/lg/xl scale re-derives from the 0.5rem base (4/6/8/12).
- Inter and Spline ship as single variable woff2 files (Google serves the same file for every requested weight), so 500/600 render true weights at less total weight than three statics. Sentient fallback metrics are the brief's values (size-adjust 106%, ascent-override 92%), not fontpie output (fontpie can't run in this env).
- Now-line re-based to `--aqua` now rather than waiting for the calendar pass: it is a token swap, and a red now-line violates the brief's "red means only errors/overdue/delete" at the token level.
- The default-list fallback `#3b82f6` (six components) and the duplicated TASK_COLORS / TASK_LIST_COLORS / DEFAULT_COLORS swatch arrays now come from the shared curated palette, `DEFAULT_PRESET_COLOR` (#0d97d5, the curated blue) keeps blue as the default selection since the curated array leads with red.
- Kanban "In Progress" header text in `--warning` fails AA on the light canvas, same as the amber-500 it replaced. The kanban surface pass kills colored header text entirely (brief 4.3), so no interim fix.
- vite.config.ts: proxy target is now overridable via `API_PROXY_TARGET` (defaults to :3001) so parallel agents can pin their own API instance.

## Known off-token colors deliberately left for surface passes

- Auth pages: rainbow conic gradient + frosted panel (brief 4.8 kills them). Login primary button still the legacy `authPrimary` variant.
- Chart tokens `--chart-1..5` and TaskAnalytics palettes (incl. `created: #3b82f6` in TaskAnalyticsDialog), the sidebar donut greens.
- Smart-input parser palettes (CompromiseNLPParser category colors, ChronoDateParser date-tag blue) and the debug-dropdown/ai-badge blue-green gradients (still keyed to prefers-color-scheme).
- FullCalendar event default `#3788d8` and inline data-driven event colors (chip formula pass, brief 2.4/4.4).
- ResizableDivider.tsx gray/green styling (orphaned component, recon flags it for deletion).
- tw-animate/Radix motion still on stock curves, `--ease-settle`/`--dur-*` are wired but unconsumed until the motion pass.

## Infra note

The dev API (scripts/dev-server.ts) ends its PG pool on `beforeExit`, and a background-shell signal can leave the process serving with a dead pool ("Cannot use a pool after calling end on the pool"). The shared :3001 instance was in that state, so this pass ran its own instance detached (`setsid nohup ... PORT=3005`). If :3001 misbehaves for later agents, restart it the same way.
