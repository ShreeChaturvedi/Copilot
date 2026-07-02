# Taskflow Calendar — Visual Quality Audit (live app, branch `finish-polish-deploy`)

Audited 2026-07-01 by running the actual app headless (playwright-cli) at 1440x900 and 390x844.
All screenshots referenced below live in this directory:
`/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/ui-audit/`

## 0. How this was run (reproduce)

- Postgres: `docker start react-calendar-postgres` (container from repo `docker-compose.yml`, db `react_calendar_dev`, postgres/postgres).
- API: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_dev npx tsx scripts/dev-server.ts` (port 3001).
- Frontend: `npx vite --port 5180 --strictPort` → http://localhost:5180.
- Throwaway user: `recon-plan@example.com` / `ReconPlan1!` (signed up via UI; a second user `recon-plan2@example.com` same password exists from a retry).
- Seeded via UI: task lists "Work" (#3b82f6, desc "Deep work and deliverables") and "Personal" (#10b981); 7 tasks (3 Work, 4 Personal, 1 completed); calendar "Team" (blue); 4 events — "Team Standup" Wed 9:30–10:00 recurring weekly, "Design review" Thu 13:00–14:30, "Lunch with Maya" Fri 12:00–13:00 (location "Blue Bottle Cafe"), "Company Offsite" all-day Thu.
- Dev-environment quirks that matter to anyone re-running this:
  - `scripts/dev-server.ts` ignores the JWT for most data routes and uses `devContext = { userId: 'dev-user-id' }` (lines 51–56, 85–108, 398–500). All lists/tasks/events live under `dev-user-id` regardless of who is logged in. `POST /api/tasks` (line 98) validates `taskListId` against `dev-user-id`, so a list id from any other source 500s with "VALIDATION_ERROR: Task list not found or access denied".
  - Mid-audit a sibling process killed both servers and wiped the DB (0 rows, schema intact) and stopped the container; everything above was re-seeded after restart.
  - The JWT access token expires in 15 min; after expiry a page reload lands on /login (refresh did not silently recover in two separate instances). Worth a functional look, not part of the visual audit.
  - The floating yellow "🚧 DEV MODE" auth debug panel (`div.fixed.z-50.bg-yellow-100`, draggable) renders over the top-right toolbar and **intercepts clicks** on the header buttons at 1440px (Playwright click on "Add task" failed until it was hidden). It appears in `login-1440.png`, `signup-1440.png`, `app-initial-1440.png`. For all later screenshots it was hidden with injected CSS. It must not ship.

## 1. Ground truth: fonts, tokens, theming

Verified at runtime (`document.fonts`, computed styles), not just from source:

- **Font**: Inter is the only family that actually renders. Loaded weights 400/500/600/700 via Google Fonts `@import` in `src/index.css:2`. Computed body stack: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, …`. `document.fonts.check('16px Inter')` → true. No display/secondary family anywhere; every surface is Inter at mostly 14px/16px with weight 400–600.
- **Design tokens** (`src/index.css:27–70`, stock shadcn/ui zinc, oklch):
  - `--radius: 0.625rem` (10px); sm/md/lg/xl derived.
  - Light: background `oklch(1 0 0)` = #ffffff; foreground `oklch(0.141 0.005 285.823)` ≈ #09090b; muted-foreground `oklch(0.552 0.016 285.938)` ≈ #71717a; border/input `oklch(0.92 0.004 286.32)` ≈ #e4e4e7; primary `oklch(0.21 0.006 285.885)` ≈ #18181b; secondary/muted/accent `oklch(0.967 0.001 286.375)` ≈ #f4f4f5; sidebar `oklch(0.985 0 0)` ≈ #fafafa; destructive ≈ #dc2626; `--success: oklch(0.6 0.15 145)` ≈ #3f9d5c (custom addition).
  - Dark (`.dark`, index.css:152–197): background ≈ #09090b, card/popover ≈ #18181b, secondary/muted/accent ≈ #27272a, border `oklch(1 0 0 / 10%)`, primary flips to near-white.
- **Dark mode mechanics**: class strategy. Zustand `theme-store` in localStorage (`{"state":{"theme":"system"}}`, default system), toggled from Settings → General → Appearance (Light/Dark/System buttons). Sets `.dark` on `<html>`. Verified working: `calendar-week-dark-1440.png`, `tasks-dark-1440.png`, `settings-general-dark-1440.png`.
  - Dark-mode leak found at runtime: the task checkbox border computes to the LIGHT border token `oklch(0.92 0.004 286.32)` in dark mode (bright ~#e4e4e7 rings on #09090b background) — see circles in `tasks-dark-1440.png`.
- **Calendar (FullCalendar) theme** `src/components/calendar/calendar.css`:
  - Today tint `--fc-today-bg-color: oklch(0.7 0.15 140 / 0.15)` (muted green), dark `.../0.1` (lines 6–22).
  - Today date pill: `.fc-day-today .fc-daygrid-day-number { background-color: oklch(0.7 0.3 140) }` (line 117) — an out-of-gamut vivid green ≈ #00c04d; header pill `.day-header-number.today` uses `oklch(0.7 0.15 140)` (line 106). Two different greens for the same "today" affordance.
  - Event chips: sampled at runtime `rgb(59,130,246)` (#3b82f6) bg + border, white text, `border-radius: 4px`, `font-size: 14px`.
- **List color palette offered in Create-List dialog**: #3b82f6, #ef4444, #10b981, #f59e0b, #8b5cf6 (+ pink/teal/lime swatches in Create-Calendar dialog) — raw Tailwind-500 hexes, unrelated to the zinc token system.
- **Auth screens**: animated OKLCH conic-gradient rainbow background, `.auth-gradient-bg::before` in `src/index.css:631–660` — full-spectrum hues `oklch(0.9 0.12 0→360)`, blur(120px), 90s rotation.
- **Folder region CSS**: `src/styles/folder.css` (clip-path folder shape, unused-looking) and `src/styles/new-folder.css` (imported by `TaskFolderGrid.tsx:11`).
- Icons are lucide-react throughout, except emoji used as data (`📁` default list emoji, DEV panel `🚧`).

## 2. Screenshot inventory

Desktop 1440x900: `login-1440.png`, `signup-1440.png`, `app-initial-1440.png` (first-run empty week + DEV panel), `calendar-week-1440.png`, `calendar-month-1440.png`, `calendar-day-1440.png`, `calendar-list-1440.png`, `calendar-week-dark-1440.png`, `event-dialog-1440.png`, `event-dialog-filled-1440.png`, `event-detail-popover-1440.png`, `create-calendar-dialog-1440.png`, `create-list-dialog-1440.png`, `task-group-dropdown-1440.png`, `tasks-view-empty-1440.png` (empty state), `tasks-list-view-1440.png` (6 tasks), `tasks-list-completed-1440.png`, `tasks-dark-1440.png`, `folder-grid-1440.png`, `folder-card-hover-1440.png`, `kanban-work-1440.png`, `kanban-card-hover-1440.png`, `task-options-menu-1440.png`, `schedule-dialog-1440.png` (proves Schedule no-op), `task-detail-sheet-1440.png`, `task-detail-sheet-loaded-1440.png`, `task-item-hover-1440.png`, `add-task-dialog-1440.png` (enhanced input), `smart-input-parsing-1440.png`, `smart-input-enhanced-typing-1440.png`, `smart-input-parsed-wait-1440.png` (4s wait, still nothing), `settings-tab1-1440.png` (General), `settings-calendar-1440.png`, `settings-preferences-1440.png`, `settings-security-1440.png`, `settings-help-1440.png`, `settings-profile-1440.png`, `settings-general-dark-1440.png`, `user-menu-1440.png`.
Mobile 390x844: `login-390.png`, `signup-390.png`, `calendar-week-390.png`, `calendar-month-390.png`, `calendar-day-390.png`, `sidebar-drawer-390.png`, `tasks-list-390.png` (drawer over tasks), `tasks-drawer-collapsed-390.png`, `tasks-main-390.png`, `folder-grid-390.png`, `kanban-390.png`, `event-dialog-390.png`, `task-detail-sheet-390.png`, `settings-390.png`, `smart-input-390.png`.
`tmp-*.png` are working shots; ignore.

There is **no analytics view** beyond the sidebar "All Tasks" summary card (`TaskAnalyticsSummary`, visible in `tasks-list-completed-1440.png` bottom-left: donut, "1 / 6 completed", "17%").

## 3. Per-surface critique

### 3.1 Login / Signup (`login-1440.png`, `signup-1440.png`, `login-390.png`, `signup-390.png`)

- The animated rainbow gradient is loud and hue-cycles through pinks/cyans/lime with no relationship to the product's zinc-neutral interior. First screen and app interior read as two different products.
- The card is `bg-card/soft shadow` but the gradient bleeds through it (card appears translucent pink/green in screenshots) — text sits on a shifting tint; contrast of the muted description text (#71717a) over pink is borderline.
- Primary CTA is visually secondary: "Login" / "Create account" render as white/outline buttons identical in weight to "Login with Google" below them. On `signup-1440.png` "Create account" has a barely-visible thin green ring (uses `--success`?) — reads accidental, not primary. There is no filled primary button on either auth screen.
- Hierarchy: heading 16–18px semibold, barely bigger than field labels; the card feels like one gray column.
- Detail bugs: signup "Sign up" link on login has `href="#"`; password fields flagged by Chrome for missing `autocomplete` attrs (console).
- Mobile renders fine (single column), the gradient is even louder proportionally.

### 3.2 Calendar week/day/list (`calendar-week-1440.png`, `calendar-day-1440.png`, `calendar-list-1440.png`, `calendar-week-dark-1440.png`, mobile variants)

- Overall the strongest surface — clean grid, hairline borders, quiet slot labels. But:
- **Today column tint**: the pale green `oklch(0.7 .15 140 / .15)` fills the entire day column including the all-day row; in Day view (`calendar-day-1440.png`) it floods the whole grid, making the view look like a rendering error. In dark mode the tint turns the column into a murky green-gray.
- **Green as "today" is a third accent**: events are blue #3b82f6, selected/primary is zinc-black, and today is two different greens (pill `oklch(0.7 .3 140)`, header pill `oklch(0.7 .15 140)`, tint). No system.
- The Day/List view header date pill is a **squished vertical green sliver** (see "Wednesday/1" in `calendar-day-1440.png`, `calendar-list-1440.png`) — the 24px circle collapses because the number is inside a flex header; it looks broken.
- Event chips: flat #3b82f6, 4px radius, white 14px text, time and title concatenated ("9:30 AM - 10:00 AM - Te…") and truncated mid-word at week width. No calendar color coding (the user's calendar color is used globally), no hover elevation (only a slight brightness shift), no left-border/tint treatment; chips read heavier than everything else on an otherwise hairline page.
- Current-time indicator is a plain red line + red arrow at far left overlapping the axis label (`app-initial-1440.png` bottom).
- Toolbar: "July 2026" title mixes weight (bold "July", regular "2026") — nice idea, but then Day/List titles ("July 1, 2026") drop it. View switcher (Month/Week/Day/List segmented) is 12px text in a 36px-tall pill group; on mobile it collapses to cryptic single letters "M W D L" (`calendar-month-390.png`).
- **Month view is functionally broken** (`calendar-month-1440.png`, `calendar-month-390.png`): the weekday/date column headers show "SAT 3, SUN 4, MON 5, TUE 6, WED 7, THU 8, FRI 9" while the grid below starts SUN 28 29 30 1 2 3 4. Headers are offset (and include dates from the _current week_, a Week-view header pattern); the recurring Wednesday standup renders under the "TUE" header. Today's "1" pill sits under "TUE 6". Grid itself starts on Sunday while headers start Saturday. This is the single worst calendar defect.
- Month cells otherwise: day numbers right-aligned 14px, events as full chips (blue, truncated "9:30 Te…"), huge empty cells, no "+n more" affordance seen.
- Dark week view (`calendar-week-dark-1440.png`) holds up; the green today tint desaturates into an olive smear, and hairlines at `white/10` nearly vanish.

### 3.3 Left task pane in Calendar view (`calendar-week-1440.png` left rail, `task-item-hover-1440.png`, `app-initial-1440.png`)

**Owner-flagged: task item displays.** Forensics:

- A task row (`TaskItem.tsx` ~line 312–420) is: 16px circle checkbox + one line of 14px/500 text. **Nothing else renders** — no due date, no priority, no tags, no list color, even though the data model has all of them (they're null because smart parsing is dead, §3.8, but even scheduled tasks would only show a small badge). Rows are visually indistinguishable from each other and from plain text.
- Titles truncate at ~28 chars with "…" ("Book dentist appointment next t…") in a 330px pane with ~40px of padding around content — the pane wastes width on both gutters.
- The group header stack is misaligned: folder emoji + "Personal" bold 15px, then an ALL-CAPS 11px tracking label "NO DUE DATE" + count chip **hanging below-left under the emoji**, then rows. The caps label sits closer to the group title than to its own rows; hierarchy reads inverted (see `calendar-week-1440.png`).
- The 📁 emoji as list icon (hard-coded default, colored via `style={{color}}` which does nothing to an emoji glyph) clashes with the lucide icon set used everywhere else, and repeats in the smart-input button, the group dropdown (`task-group-dropdown-1440.png`), and headers.
- Hover (`task-item-hover-1440.png`): a faint `accent` wash on the row. No affordances appear on hover (no drag handle, no quick-schedule, no menu) — the row's only interactions are invisible: click title = inline edit in calendar mode (`TaskItem.tsx:195–206`), which selects the text with a blue selection highlight that looks like a bug (`task-detail-sheet-1440.png` predecessor shot showed this), right-click = context menu (undiscoverable).
- Checkbox is a plain 1px circle; completed tasks just vanish from the list (default filter) rather than showing a checked/struck state anywhere visible.
- Empty state (`app-initial-1440.png`): a gray clipboard-check icon + "No upcoming tasks", centered, fine but generic; "Upcoming Tasks" heading duplicates the section content.

### 3.4 Tasks view — List mode (`tasks-list-view-1440.png`, `tasks-list-completed-1440.png`, `tasks-main-390.png`)

- The main pane renders the same bare TaskItem at full 1100px width: a 16px circle and a sentence, then ~900px of white. Six rows occupy a quarter of the viewport; density is ~48px/row with no secondary line, no columns, no metadata, no zebra/hover structure. It reads as a wireframe, not a product.
- Toolbar ("All Tasks ⌄ [5] 👁") mixes an unlabeled sort control, a count badge, and a hide-completed eye icon at 11–12px in muted gray — all icon-only, no labels, no separators; the "1" completed-count superscript on the checkmark toolbar icon (top right, `tasks-list-completed-1440.png`) is 9px and overlaps the icon bounds.
- "No tasks match the current filters" (`tasks-view-empty-1440.png`) is a bare gray sentence centered in 1100px of white — no icon, no CTA (contrast with the sidebar empty state which at least has an icon).
- Mobile (`tasks-main-390.png`): the header wraps "July 1, 2026" into three lines next to the drawer button; the right toolbar icons run off-canvas (filter icon clipped at the edge); Folder|List toggle crowds the wrapped title.

### 3.5 Tasks view — Folder mode / TaskFolderGrid (`folder-grid-1440.png`, `folder-card-hover-1440.png`, `folder-grid-390.png`)

**Owner-flagged: folder region.** Forensics:

- Each folder card (`TaskFolderGrid.tsx:62–140` + `src/styles/new-folder.css`) tries to draw a manila-folder silhouette: a small colored bar (the "tab") above a rounded white card. As rendered, the tab is a **detached 60x8px colored rectangle floating 4px above the card with mismatched corner radii** — it reads as a paint artifact, not a folder tab (crystal clear on `folder-grid-390.png`: green bar over "Personal", blue over "Work", gray over "New List", plus a stray gray tab fragment orphaned in row 2).
- Card content: 40px tinted-square lucide folder icon (`${color}15` background), 16px semibold name, "3 tasks" 13px muted. The card is ~190x130 with over half its area empty; the aspect/padding don't match the clip-path geometry the CSS was designed for ("designed for a container with an approximate 4:3 aspect ratio", `folder.css` comment), which is why the tab detaches.
- **Hover is broken** (`folder-card-hover-1440.png`): hovering "Work" fades in up-to-3 task previews (`TaskFolderGrid.tsx:112–138`) that render **on top of the folder icon and title** — gray 12px text with bullet dots collides with "Work" and the icon, everything semi-transparent, unreadable. This is presumably meant to be a reveal animation where icon fades out; both layers currently show at ~50%.
- "New List" card: dashed 1.5px border, gray plus in a rounded square, muted label — plus a _gray folder tab_ floating above the dashed outline, which makes the placeholder look like a fourth broken folder.
- Layout: 3 cards left-packed in one row with a fixed ~220px column; the remaining ~60% of the pane is empty. No sorting, no counts-by-status, no color on the card surface itself (the chosen list color appears only in the 8px tab and icon tint).
- Clicking a folder switches you into Kanban for that list with **no back affordance and no mode indication** — the Folder|List segmented control shows neither selected (`kanban-work-1440.png` top center).

### 3.6 Tasks view — Kanban (`kanban-work-1440.png`, `kanban-card-hover-1440.png`, `kanban-390.png`, `task-options-menu-1440.png`)

**Owner-flagged: kanban board.** Forensics:

- Columns: "Not Started / In Progress / Done" as full-width thirds separated by full-height 1px borders and a header row underline — the grid reads as a spreadsheet, not a board. Column headers mix metaphors: gray circle icon + black text (Not Started), amber play icon + **amber text** (In Progress), green flag icon + **green text** (Done) with gray count chips; three different visual treatments in one row.
- Cards (`TaskKanbanBoard.tsx`, runtime classes: `shadow-sm border rounded-md py-2 px-2 sm:px-3 bg-gray-500/10 border-gray-500 dark:bg-gray-400/10 dark:border-gray-400 cursor-grab`): **hard-coded gray regardless of list color or priority**, a heavy 1px solid gray-500 border (darker than any other border in the app), 10% gray fill, single truncated line ("Prepare client demo slides friday 11…"). They look like disabled buttons, not draggable cards. No metadata (no due, no priority, no tags, no assignee row), no grab-handle iconography; the ⋮ options button only appears on hover/focus of the first card.
- Empty columns show centered gray "Drop tasks here" text at the _top third_ of a 700px-tall column, so 80% of the board is blank white (`kanban-work-1440.png`).
- The board ignores the seeded list color entirely — Work is #3b82f6 but nothing on the board is blue.
- **Card menu → Schedule is a literal no-op**: `TaskKanbanBoard.tsx:329` and `:388` pass `onSchedule={() => void 0}` into `TaskActionMenuItems`. Screenshot pair `task-options-menu-1440.png` (menu open: Schedule with a stray ⓘ info icon pinned to the menu's right edge, red Delete) → `schedule-dialog-1440.png` (click: nothing happened). Menu offers only Schedule/Delete — no Edit, no Move-to-list, no priority.
- Mobile (`kanban-390.png`): one column fills the screen; the next column is a 4px sliver at the right edge — no scroll affordance, no snap, no column pager; users will not discover columns 2 and 3.
- Kanban state is also reachable _only_ through the folder grid; the Folder|List toggle can't return you to it once you leave.

### 3.7 Task detail / edit surfaces (`task-detail-sheet-1440.png`, `task-detail-sheet-loaded-1440.png`, `task-detail-sheet-390.png`, `add-task-dialog-1440.png`)

- The right-side sheet (`TaskDetailSheet.tsx`) opens at ~40% viewport width and shows: 18px bold truncated title, pencil/red-trash/X icon row, then **one row containing a static Loader glyph that looks like a frozen spinner** (`TaskDetailSheet.tsx:189` renders `<Loader className="h-4 w-4">` permanently, un-animated) and a "Not Started" status chip. Then ~700x800px of empty white. Sections for description/location/tags/attachments render only when data exists (lines 201–260), and since parsing is dead nothing ever exists — the sheet is a title in a desert. No due-date row, no priority row, no list row, no created/updated meta: none of the core task fields are even present as empty controls, so there is **no way to set a due date or priority from the detail sheet at all**.
- A11y/copy bug: the icon buttons are labeled "Edit event" / "Delete event" on a _task_ sheet (visible in accessibility snapshot).
- "Edit" (pencil) just closes the sheet and puts the row title into inline-edit mode — no full edit form exists anywhere.
- Mobile (`task-detail-sheet-390.png`): full-screen sheet with truncated title, the fake spinner, and an **empty status chip** (label disappears at this width; an outlined pill with a circle and no text). 95% blank.
- The "Add task" (+) toolbar button opens the _enhanced_ input docked bottom-center (`add-task-dialog-1440.png`): white card, "What would you like to work on?" 16px placeholder, a "Due Date" chip, footer row with 📁 "Personal" list selector, paperclip, a green-outlined "Autotag" pill toggle, mic, and a dark submit arrow. This is the most designed component in the app, but: the Autotag pill's green outline is the only green control in the product; the mic/attach icons promise features that were not observably wired; typing a description hint "⇧ ⏎ for description" appears in 10px gray (`smart-input-enhanced-typing-1440.png`); and submitting from it 500'd in the dev environment (default-list id mismatch, §0) with two raw "VALIDATION_ERROR: Task list not found or access denied" toasts stacked top-right (`tmp-state.png`) — error toasts expose internal error codes verbatim.

### 3.8 Smart input (`smart-input-parsing-1440.png`, `smart-input-enhanced-typing-1440.png`, `smart-input-parsed-wait-1440.png`, `smart-input-390.png`)

- **Smart parsing is non-functional end to end, verified**: typed "Email vendor about invoice friday 4pm urgent", waited 4+ seconds (past the debounce in `src/components/smart-input/hooks/useTextParser.ts:90–128`), DOM probe found 0 highlight nodes (`mark, [class*=highlight], [data-tag]`), no chips under the input, and the created task came back from the API with `dueDate: null, priority: "MEDIUM", parsedMetadata: null`. Same result for all 7 seeded tasks containing "tomorrow at 9am p1", "urgent today 2pm", "friday 11am p2", "next tuesday", "high priority".
- The wiring downstream is correct (`SmartTaskInput.tsx:180–211` builds smartData; `useTaskManagement.ts:198–243` maps priority/scheduledDate/tags onto the mutation), so the parser itself (`SmartParser.ts` pipeline / `useTextParser` → `getParser()`) returns zero tags at runtime with no console error (the catch at useTextParser.ts:114 would have logged). The flagship "smart input with highlighting" (its own aria-label) is currently a plain textarea.
- Visual consequences: tasks keep their raw syntax as titles ("Draft Q3 budget report tomorrow at 9am p1"), everything lands in "NO DUE DATE", priorities all MEDIUM, tags never exist — which in turn starves every list/kanban/detail surface of metadata to display.
- The left-pane input itself: 36px pill, 📁 emoji group button (opens `task-group-dropdown-1440.png` — menu with emoji + name rows and a green "New List" item; the green `text-success` row is the only colored menu item in the app), gray arrow-up submit that's disabled-gray even when focused until text exists.

### 3.9 Dialogs (`event-dialog-1440.png`, `event-dialog-filled-1440.png`, `create-calendar-dialog-1440.png`, `create-list-dialog-1440.png`, `event-dialog-390.png`)

- Create Event: competent layout (Event|Task tab pills, name + calendar select, date @ start → end, Display select, All Day + Never Repeats, location, rich-text description with B/I/U/#/•/link/quote/¶ toolbar). Issues: the RTE toolbar glyphs are plain text characters at inconsistent optical sizes; "Display: Relative" is unexplained jargon; the disabled "Create Event" is mid-gray-on-gray (looks broken rather than disabled); tab bar has an unexplained right-side panel icon ("Switch to right panel mode"); footer buttons hug the card edge with no separator.
- Create Calendar dialog (`create-calendar-dialog-1440.png`) and Create List dialog (`create-list-dialog-1440.png`) are two different designs for the same job: different name-row layouts (icon-tile + input vs emoji button + input), different color pickers (8 solid 32px circles vs 5 24px circles), different placeholder tone (whimsical "Holiday Planning / Travelling, food, life…" vs terse). The List dialog's primary button is labeled **"Create Task"** while its heading says "Create New Task List" (copy bug, `create-list-dialog-1440.png`).
- Event detail popover (`event-detail-popover-1440.png`): clean rows (color dot + title, calendar, date/time, "Every week on Wednesday") but four icon buttons (pencil, red trash, panel, X) with three different hover treatments, and the popover dims the entire calendar behind it like a modal.
- **Mobile Create Event is unusable** (`event-dialog-390.png`): the dialog is wider than the 390px viewport — right edge clipped: "Task" tab cut to "Tas", end-time field half gone, calendar select entirely off-screen, footer shows only "Canc". No responsive stacking.

### 3.10 Settings (`settings-tab1-1440.png` …profile/calendar/preferences/security/help, `settings-general-dark-1440.png`, `settings-390.png`)

- Desktop: the most conventional, safest surface — left nav (avatar + 5 items with 13px descriptions), right pane of cards. Nitpicks: modal is 1150px wide but height-capped so General already scrolls (Sidebar Task Analytics toggle clipped at the fold in `settings-tab1-1440.png`); "Local Account" chip and "Member Since July 1, 2026" occupy a whole card; Calendar tab is a single card with one segmented control and "Visible Hours: 6 AM – 10 PM" as plain text (looks unfinished, `settings-calendar-1440.png`); Profile tab timezone is a **native unstyled `<select>`** ("Select timezone...") amid shadcn selects (`settings-profile-1440.png`); Security's "Update Password" button is enabled-looking gray while actually disabled; Help tab's version block says "Environment: Development".
- Theme buttons (Light/Dark/System) work and persist; `settings-general-dark-1440.png` shows correct dark rendering of the modal.
- **Mobile settings is broken** (`settings-390.png`): the two-pane layout doesn't collapse — nav keeps ~260px, content is squeezed into ~100px so every word wraps ("Manage / your / account / and / application / settings"), cards clip off the right edge. Unusable.

### 3.11 Misc systemic observations

- **Radii inventory**: 10px cards/dialogs, 8px buttons, 6px checkboxes, 4px event chips/kanban cards, 18px folder shape fallback, full-round today pill — six radii with no scale logic.
- **Shadows**: `shadow-sm` on kanban cards, big soft shadow on auth card and popovers, none on folder cards (they're borders), none on event chips. No elevation system.
- **Color story**: interior is zinc-monochrome with exactly one hue per feature bolted on (blue events, green today/success/Autotag, amber in-progress, red destructive) plus raw Tailwind palettes in pickers and _rainbow_ auth. Nothing shares saturation/lightness; list colors the user picks barely appear anywhere after creation (only folder tab + icon tint).
- **Focus states**: shadcn `focus-visible:ring-[3px] ring-ring/50` present on buttons/inputs (visible when tabbing), but custom surfaces (task rows, event chips, folder cards, kanban cards) show no focus treatment; folder cards are divs with `role=button`.
- **Copy**: "Create Task" (for a list), "Edit event"/"Delete event" (for a task), "NO DUE DATE" (shouting), "No tasks match the current filters" (on a brand-new empty account), "🚧 DEV MODE".
- **Duplicate identity row**: user avatar+name+email pinned bottom-left appears in both sidebar footer and settings nav with different styles.
- Sidebar section headers ("Calendars", "Task Lists") pack +/collapse icon buttons 24px from each other with no divider from content.

## 4. Bugs found while auditing (should become GitHub issues — repo was read-only for this recon, none filed)

1. **Month view header misalignment** — weekday/date headers offset from grid (shows week-strip dates SAT 3–FRI 9 over a month grid starting SUN 28); events/today land under wrong weekday label. `calendar-month-1440.png`, `calendar-month-390.png`.
2. **Smart parsing dead end-to-end** — no highlighting, no tags, no dueDate/priority extraction; verified via DOM probe + API payloads (§3.8). Flagship feature.
3. **Kanban Schedule menu item is a no-op** — `TaskKanbanBoard.tsx:329,388` (`onSchedule={() => void 0}`).
4. **Mobile Create Event dialog clipped/unusable** at 390px (`event-dialog-390.png`).
5. **Mobile Settings layout broken** — nav doesn't collapse, content ~100px wide (`settings-390.png`).
6. **Folder card hover previews overlap icon/title** — unreadable double-exposure (`folder-card-hover-1440.png`); folder "tab" renders as detached floating bar (`folder-grid-390.png`).
7. **DEV MODE panel ships in dev builds over the toolbar and intercepts clicks**; also leaks auth state visually (`app-initial-1440.png`).
8. **No way to set due date/priority/tags from any UI** — detail sheet has no fields, list rows have no controls, kanban Schedule no-op; enhanced input's Due Date chip is the sole path (untested end-to-end because its submit 500s in dev, §0).
9. Copy bugs: "Create Task" button on Create New Task List dialog; "Edit event/Delete event" aria-labels on task sheet; static Loader icon on detail sheet reads as stuck spinner (`TaskDetailSheet.tsx:189`).
10. Dark mode: task checkbox borders use light-mode border token (bright rings, `tasks-dark-1440.png`).
11. Session drops to /login on reload after access-token expiry (~15 min) — refresh flow didn't recover (observed twice; may be dev-server-specific).
12. Day/List view header date pill renders as a squished vertical sliver (`calendar-day-1440.png`).
13. Kanban unreachable except via folder click; mode toggle shows no active state once in kanban; no back affordance.
14. Mobile month view: same header bug as desktop plus "M/W/D/L" unlabeled view switcher.

## 5. What's actually good (keep)

- Week/day grid bones, hairline discipline, and slot-label typography.
- The enhanced bottom input's overall shape (chip + footer-toolbar pattern) is the right direction for the whole app.
- Settings desktop information architecture (nav + cards) is fine.
- Event detail popover content rows (icon + fact per line) are clean.
- Dark theme tokens fundamentally work; surfaces flip correctly except noted leaks.
- Agenda list in the sidebar (TODAY/TOMORROW/FRIDAY groups with time + color dot chips, `folder-grid-1440.png` left rail) is the best-looking list in the product — the task list should look like this.

## 6. Cleanup state after audit

- Browser session closed (`playwright-cli -s=audit close`).
- My dev API (bg task b4rldxtgu) and vite (bjy42q1vb) killed.
- `react-calendar-postgres` container left running (matches state found at session start); DB retains the seeded recon data + users listed in §0.
- Repo untouched (read-only audit); the only repo-root stranger files (`loggedin-calendar.png`, `.playwright-cli/`) predate this audit — from a sibling agent.
