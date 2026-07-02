# Prerequisite CSS fixes — before/after diff notes

Foundation fixes that must land before the token pass (design-brief §2 prerequisites; issues #47, #49, plus rescopes). These are behavior-changing, parity-_breaking_ by design: they revive dormant rules and re-wire `dark:`. This file documents every visible difference so the token pass knows what is now live.

## How these shots were captured

- Own Vite dev server on `:5182` (`npx vite --port 5182 --strictPort`), shared dev API on `:3001`.
- playwright-cli headless, viewport 1440x900.
- Auth: registered a throwaway user (`prereq-test@example.com`) via the real `/api/auth/register`, injected the real JWT into the `auth-store`. The dev-server has no `/api/auth/verify` route (404s and clears the session), so that one endpoint was route-mocked in the browser to return `{valid:true}`; all other data still came from the live `:3001` DB (12 tasks / 8 events already present).
- "OS theme" was controlled with Playwright `emulateMedia({ colorScheme })`; "app theme" with the persisted `theme-store` (`light`/`dark`), which is exactly what the in-app Settings toggle writes.
- Standard before/after set was taken at OS=light. The `*-47proof-osdark-applight` pair was taken at OS=dark, app=light, on purpose (see #47).

## Screenshot inventory

| Surface                                | before                             | after                             |
| -------------------------------------- | ---------------------------------- | --------------------------------- |
| Login (light)                          | before-login-light.png             | after-login-light.png             |
| Login (dark)                           | before-login-dark.png              | after-login-dark.png              |
| Calendar week (light)                  | before-calendar-light.png          | after-calendar-light.png          |
| Calendar week (dark)                   | before-calendar-dark.png           | after-calendar-dark.png           |
| Tasks list (light)                     | before-tasks-light.png             | after-tasks-light.png             |
| Tasks list (dark)                      | before-tasks-dark.png              | after-tasks-dark.png              |
| #47 proof: OS=dark, app=light          | before-47proof-osdark-applight.png | after-47proof-osdark-applight.png |
| Drag mirror mid-drag                   | —                                  | drag-mid-drag.png                 |
| Drag drop result (create dialog)       | —                                  | drag-drop-result.png              |
| Checkbox rows after !important removal | (= before-tasks-light)             | after-checkbox-tasks-light.png    |

## #47 — `dark:` utilities now follow the in-app toggle, not the OS

Added `@custom-variant dark (&:is(.dark *));` after the tailwind import. Built CSS went from 0 class-driven dark rules + `@media (prefers-color-scheme:dark)` to 88 `:is(.dark *)` rules and 0 media-query dark rules.

Visible evidence (clearest indicator in the app is the yellow DEV MODE box, which uses `dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200`):

- **before-login-dark / before-calendar-dark**: app theme = dark, OS = light. The DEV MODE box stayed _light yellow_ — `dark:` followed the OS (light), ignoring the toggle. This is the bug.
- **after-login-dark / after-calendar-dark**: same conditions. The box is now _dark brown/yellow_ — `dark:` follows the `.dark` class the toggle sets.
- **Proof pair (OS and app deliberately disagree, OS=dark / app=light)**: before → whole page light but the DEV MODE box renders _dark_ (followed OS). after → whole page light and the box is _light_ (follows the app). This is the definitive proof the toggle now drives `dark:`.

Consequence for the token pass: every `dark:*` utility across the 31 tsx files (kanban `getStatusConfig` accents, button variants, ViewSwitcher, sheet, dropdowns, the `TaskFocusPane` drag strip, etc.) now flips with the toggle. Any surface that looked "fine" only because the tester's OS matched the toggle must be re-checked in both themes via the toggle. OS-dark users get the biggest behavior change.

## #49 — dormant `hsl(var(--oklch-token))` rules revived

Stripped `hsl()`/`oklch()` wrappers around the (oklch) tokens across `calendar.css`, `index.css`, and one line in `new-folder.css`:
`hsl(var(--x))` → `var(--x)`; `hsl(var(--x) / a)` → `color-mix(in oklab, var(--x) <a*100>%, transparent)`; `oklch(var(--chart-N))` → `var(--chart-N)`.

Directly visible in the captured surfaces:

- **Calendar column headers** (`.fc-col-header-cell`): were background-less (page color). Now render on `var(--muted)` — a faint gray band across the weekday header row in light, a dark-gray band in dark. Confirmed computed (`background-color` now resolves instead of being unset; Sat/Sun headers additionally pick up the `.fc-day-sat/sun` muted 10% wash).

Revived but shown only on surfaces not individually captured (all were dead before, all live now — flag for per-surface review in the token pass):

- Today column header muted bg (`.fc-col-header-cell.fc-day-today`).
- Month-view day-cell hover (`--accent`), timegrid slot hover (`--accent` 10%), weekend wash (`--muted` 10%), disabled/loading day washes.
- `.fc-event` fallback bg/border = `--primary` (usually masked by inline data-driven event colors, so shows only for colorless events); event hover shadow; now-indicator already used raw `--destructive` and was unaffected.
- List view: day cushion muted header, event hover accent, list dot `--primary`.
- Popover/more-link chrome: `.fc-popover` bg/border/shadow, header muted bg — now themed.
- **Scrollbars, app-wide**: the `--scrollbar-track/thumb/*` tokens (index.css) were dead `hsl(var(...))`, so `*::-webkit-scrollbar-*` fell back to defaults. They now resolve to `color-mix` values, so every custom-styled scrollbar (global `*`, `.scrollbar-styled`, `.fc-scroller`, `.time-picker-scroll`) now renders themed thumbs/tracks.
- Rich-text editor chrome (`.rte-*`): border, focus ring (`--ring`), toolbar border/bg, selected-button invert (`--primary`), blockquote border — were dead, now live wherever the Pell editor renders (event description fields).
- Gradient-text utilities (`.gradient-text-blue-red`, `.gradient-bg-blue-red`) using `--chart-3`/`--chart-1` — now produce real gradients.
- `new-folder.css` add-new-tile hover bg (`--primary` 5%).

None of these were restyled — only revived to their authored intent. Several are off-brand (indigo/zinc neutrals, chart blues, the calendar greens are untouched and still green) and are exactly what the token pass will re-base to the aqua system.

## Task-row transition-kill rescope

The global `.group/task, .group/task * { transition: none !important }` (which killed transitions on every task row at all times) is now scoped to `.group/task.is-dragging`. `TaskItem` toggles `.is-dragging` on the row from the FullCalendar Draggable's `dragstart`/`dragend` emitter events (`draggable.dragging.emitter`). No visible change at rest in the captured shots (rows look identical); the point is that rows are now free to carry transitions when the token/redesign pass adds them. During a drag the kill still applies (mirror stays clean, see verdict).

## Checkbox `!important` block removal

Removed the `button[role='checkbox'] { … !important }` block. Task-row checkboxes still render exactly 16x16, padding 0, border-box — no drift (after-checkbox-tasks-light.png is pixel-identical to before-tasks-light.png), because the shadcn `Checkbox` component already self-enforces the same dimensions via `!`-classes. The only other `role="checkbox"` element, `CircularCheckbox` (wanted 20px), is dead code (never imported/rendered), so its size no longer being clamped has no visible effect.

## Vite-template leftovers + dead config removed

- `h1 { font-size: 3.2em }`: no visible change — the only `<h1>` in the repo is in a test demo file; the live app never renders a bare `<h1>`.
- `@media (prefers-color-scheme: light) { :root { color:#213547; background:#fff } a:hover { color:#747bff } }`: removed. On light-OS machines this had been setting an off-token `:root` color/background and a purple (`#747bff`) link-hover that fought the token system. After removal, links/`:root` follow the token system in both themes. (Not separately screenshotted; effect is a subtle link-hover color change on light-OS.)
- `tailwind.config.js`: deleted (dead under Tailwind v4 — no `@config` directive, nothing imports it). `components.json` `"config"` set to `""` (v4 convention) so the shadcn CLI has no dangling path. `darkMode:'class'`, the custom gray 750/850/950 shades, and the fade/slide keyframes it declared never generated anything, so no visible change.

## Drag-mirror verdict: CLEAN

Dragged a sidebar task ("Vfy-events-17-task", calendarMode) onto the Tue 30 / 11 AM slot in week view:

- Mid-drag (drag-mid-drag.png): the FullCalendar event-preview chip renders crisply at the target slot, no ghosting, no trailing/lag artifacts.
- `.is-dragging` is present on the source row during the drag (added on `dragstart`) and removed after (`dragend`); verified count 1 → 0.
- The FC drag mirror is a lazy `cloneNode(true)` of the row taken after `dragstart`, so it inherits `.is-dragging`; the calendarMode row also carries an inline `transition:none`, so the clone is doubly protected from ghosting.
- Drop opened the event-creation dialog (drag-drop-result.png) via `eventReceive` — the expected flow.

## Verification summary

- `npm run build:frontend` succeeds after every commit and after all five.
- `tsc --noEmit -p tsconfig.app.json`: 0 errors.
- Frontend test suite: 634/634 pass. (One full-run flake — `SmartTaskInput.enhanced.demo` timing out at 5s under machine load — passes in 0.85s in isolation; unrelated to these changes.)
- In-app toggle now controls `dark:` utilities independent of OS (proof pair above).
- Calendar drag mirror clean.
  </content>
  </invoke>
