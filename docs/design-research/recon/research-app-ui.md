# Design Research Dossier: Premium Task/Calendar App UI Patterns for Taskflow

Date: 2026-07-01. Recon-only research (repo untouched). Target: elevating Taskflow's app UI on its existing Tailwind v4 + shadcn base. Confidence tags: [V] = verified against a published source this session, [K] = well-established product knowledge not re-verified today (treat as "check against a live screenshot before hard-coding"), [E] = estimate from screenshots/teardowns.

## 0. Taskflow current baseline (verified against working tree, branch `finish-polish-deploy`)

Stack facts an implementer needs:

- **Tailwind v4** (`tailwindcss@^4.1.11`, `@tailwindcss/vite`, `@tailwindcss/postcss`), imported CSS-first in `/home/shree/dev/taskflow-calendar/src/index.css` line 6 (`@import 'tailwindcss';`) plus `tw-animate-css@^1.3.5` (line 4). NOTE: a legacy v3-style `/home/shree/dev/taskflow-calendar/tailwind.config.js` also exists (custom gray-750/850/950, fade-in 0.2s, slide-in 0.3s, collapsible 0.17s keyframes) — **verified dead code**: no `@config` directive anywhere in the CSS, and Vite loads Tailwind via `@tailwindcss/vite` (vite.config.ts line 4/8), so in v4 that JS config is NOT applied. Any `gray-750/850/950` or `animate-fade-in` classes referencing it silently no-op; new theme tokens must go in `src/index.css` via `@theme`.
- **shadcn/ui tokens, stock zinc theme, oklch**, defined in `src/index.css` `:root` (lines ~27-70): `--radius: 0.625rem` (10px), `--background: oklch(1 0 0)`, `--foreground: oklch(0.141 0.005 285.823)`, `--primary: oklch(0.21 0.006 285.885)` (near-black zinc — there is **no brand accent color at all** right now), `--border: oklch(0.92 0.004 286.32)`, `--muted-foreground: oklch(0.552 0.016 285.938)`, full `--sidebar-*` token set, `--success: oklch(0.6 0.15 145)`, scrollbar tokens (`--scrollbar-size: 8px`). Dark mode is class-based (`darkMode: 'class'`).
- **Font: Inter** 300–700 via Google Fonts `@import` in `src/index.css` line 2. `line-height: 1.5` on `:root`. No display cut, no `font-feature-settings`, no tabular numerals anywhere.
- **Calendar = FullCalendar 6.1.18** (`@fullcalendar/react` + daygrid/timegrid/list/interaction). Styling overrides live in `/home/shree/dev/taskflow-calendar/src/components/calendar/calendar.css`; custom header at `src/components/calendar/ConsolidatedCalendarHeader.tsx`.
- **Drag & drop = @dnd-kit/core ^6.3.1** (kanban) + FullCalendar interaction plugin (calendar).
- Key UI surfaces:
  - Task row: `/home/shree/dev/taskflow-calendar/src/components/tasks/TaskItem.tsx` (~line 312+: `flex items-center gap-3`, hover-revealed actions `opacity-0 group-hover/task:opacity-100 transition-opacity duration-200`, `h-7 w-7` icon buttons, tag chips in horizontal ScrollArea, `ml-7` metadata indent). Custom `src/components/ui/CircularCheckbox.tsx` exists.
  - Kanban: `/home/shree/dev/taskflow-calendar/src/components/tasks/TaskKanbanBoard.tsx` (columns `border-r border-border`, header `px-4 py-2 bg-muted/10` + count `Badge variant="outline" text-xs h-5`; cards `shadow-sm border rounded-md py-2 px-2 sm:px-3`, drag overlay `shadow-lg`).
  - Sidebar: `/home/shree/dev/taskflow-calendar/src/components/layout/LeftPane.tsx`, `BaseSidebarPane.tsx`; folder styles `src/styles/folder.css`, `src/styles/new-folder.css`.
  - Badges/chips: `src/components/tasks/DueDateBadge.tsx`, `StatusBadge.tsx`. Color/emoji/icon pickers already exist in `src/components/ui/` (`color-picker.tsx`, `emoji-picker.tsx`, `icon-picker.tsx`).
- Net read: competent stock shadcn — colorless (no accent), one 10px radius everywhere, default shadows, no motion system, no density tuning, no numeric/type refinement. Everything below is about closing that gap.

---

## 1. The cross-product "premium" formula (what all of these apps share)

1. **One accent color, everything else neutral.** Linear (indigo `#5e6ad2`), Things (blue), Todoist (red `#DE483A` [V brandcolorcode.com]), Notion Calendar (near-monochrome + calendar colors). Chrome (nav, headers, buttons) stays gray; saturated color is reserved for _user data_ (lists, tags, calendars, priorities). Taskflow currently has zero accent — adding exactly one is the single highest-leverage change.
2. **Smaller type than default web.** App UI text is 13px (Linear list UI [V: 13px/500 eyebrow token; 12–14px body tokens]) to 14px, metadata 11–12px, with 16–18px reserved for view titles. Tailwind's `text-base` 16px reads "website", not "app".
3. **Hierarchy by receding, not by decorating.** Linear's redesign explicitly: navigation and orientation elements "should recede" while task content "stays in focus"; they darkened text in light mode / lightened in dark mode for contrast and stripped chroma from grays for a "neutral and timeless" feel [V linear.app/now/how-we-redesigned-the-linear-ui]. Practically: sidebar text = muted-foreground, content titles = foreground, borders = hairline (their dark hairlines: `#23252a` on `#0f1011` surfaces — ~6% lightness delta, not default shadcn 8–10%).
4. **Alignment as a feature.** Linear "spent time aligning labels, icons, and buttons, both vertically and horizontally in the sidebar and tabs... something that you'll feel after a few minutes" [V]. Fixed icon column widths (e.g. every sidebar icon in a 16px box inside a 24px slot) beat ad-hoc `gap-*`.
5. **Motion is rare, fast, and physical.** See section 7. Things: "each animation is purposeful" [V]; Emil Kowalski's frequency matrix: actions done 100+ times/day get **no** animation [V].
6. **Keyboard-first surface area.** Cmd+K command menu (Notion Calendar, Akiflow [V]), single-key view switching (NC: `1-9` = number of days, `D/W/M` views, `T` = today [V matthiasfrank.de]). A command bar is now table stakes for "premium tool" perception; repo already ships `src/components/ui/command.tsx` (cmdk) — wiring it up is cheap.

---

## 2. Task row / item design

### Concrete patterns per product

- **Linear** [V + E]: rows ~36–40px tall, 13px medium title, no checkbox — a **status icon** (14px circle: dashed = backlog, open gray = todo, yellow part-filled pie = in progress, filled + check = done) doubles as the state control. Metadata (priority icon, ID in gray 12px, labels as 1px-border pills with 8px colored dot, avatar 18px, due date) sits inline right. Hover = full-row bg tint. Selected = stronger persistent tint driven by keyboard j/k. Density is the brand: "instrument-panel density where every pixel earns its place".
- **Things 3** [V culturedcode.com + K]: the opposite pole — tall airy rows, 15–16px regular-weight titles, huge white space ("no distractions... just you and your thoughts"). Circular ~16px outline checkbox; on check it fills blue with a white check, a subtle strike/fade, then the row **slides away to the Logbook after a ~2s grace delay** so mis-taps are recoverable [K]. Tapping a row makes it "smoothly transform into a clear white piece of paper" (inline expand to editor — no modal) with fields "neatly tucked away in the corner until you need them" [V]. Metadata shows only when present: small gray calendar icon + date left of title, tag chips below, yellow-boxed deadline flag on the right [K].
- **Todoist** [K]: circular checkbox **tinted by priority** (P1 red, P2 orange, P3 blue, P4 gray outline; in-app hexes widely documented as P1 `#d1453b`, P2 `#eb8909`, P3 `#246fe0`); hover previews the check glyph; complete = brief fill + row fades out. Rows ~44px web, title 14px, description 13px gray under it, metadata chips (date colored by proximity: overdue red, today green, tomorrow orange/yellow, next week purple [K, medium confidence]) inline under the title. Hover reveals edit/schedule/comment/more icons top-right, absolutely positioned so text never reflows.
- **Height** [V height.app/product/spreadsheet + K]: spreadsheet-mode rows ~32px, borderless until hover, type-and-return to create task-per-line; subtask indentation shows parent relationships. (Height sunset Sep 2025 — pattern still valid.)
- **Sunsama** [V reviews]: card-like rows with planned-time estimate chip on the right; "calm" = no badges unless meaningful, generous 8–12px padding, muted palette.

### Transferable spec (synthesis)

- Two density modes if possible; default: **row min-height 36–40px, title 13–14px/500, metadata 12px muted**, 8px vertical padding.
- Checkbox: keep `CircularCheckbox.tsx`, size 16–18px, 1.5px border, border-color = list/priority color, fill on complete with 200ms scale pop (0.9→1) + check-draw; **300–800ms grace delay before the row leaves the list** (Things pattern), completed style = 55–60% opacity + optional strikethrough at `text-muted-foreground`.
- Hover: `bg-muted/50` full row, instantly on / ~150ms off; actions fade in opacity-only, absolutely positioned right (current TaskItem already does opacity reveal — keep, but ensure no layout shift and add `@media (hover: hover)` gating).
- Selected (multi-select / keyboard): distinct from hover — accent-tinted bg `color-mix(accent 8%, transparent)` + 2px inset left accent bar, not a border box.
- Chips: 20px tall pills, 11–12px text, `rounded-full`, 1px border at 25% color + 8px dot or 10% tinted bg + full-color text. Max 2 visible + "+N" overflow (avoid current infinite horizontal ScrollArea for rows).
- Drag affordance: 6-dot grip appears in a reserved 16px gutter on hover (Notion/Height pattern); while dragging: original slot dims to 40%, drag preview gets `shadow-lg` + `scale(1.02)` + 2–3° tilt.

---

## 3. Kanban cards + columns

- **Column header (Linear board)** [V linear.app/docs/board-layout + toolstackpm]: status icon (colored, same glyph as list rows) + column name 13px/600 + **gray count immediately right of the name** (plain text, not a badge) + `+` button and `⋯` menu on the far right (hover-revealed). Taskflow currently uses `Badge variant="outline"` for counts — plain `text-xs text-muted-foreground tabular-nums` is closer to the premium reference.
- **Column body**: column bg slightly recessed vs page (`bg-muted/30` light, one surface-step up in dark), **no vertical borders between columns** (Linear uses gutters, not rules — Taskflow's `border-r border-border` per column at `TaskKanbanBoard.tsx:229` reads heavy); fixed column width ~300–340px; 8px gap between cards.
- **Card anatomy** (Linear/Height): 12px padding, radius 8px, 1px border + `shadow-xs` at rest; row 1 = tiny gray ID / list emoji + labels; row 2 = title 13px/500 clamped to 2 lines; row 3 = footer with priority icon, due chip, avatar 20px right-aligned. Nothing bold, nothing full-saturation.
- **Drag physics**: pick-up = scale 1.03 + shadow-lg + slight tilt (2–4°); the vacated slot collapses and target gap **animates open ~150–200ms** as you hover (placeholder = dashed 1.5px border box or just empty gap); drop = spring settle (bounce ≤0.2). dnd-kit `DragOverlay` + `dropAnimation` handles all of this.
- **Empty column**: keep full header with count "0", body shows nothing at rest; while dragging, whole column shows a full-height faint drop target (`bg-accent/5` + dashed border); optionally a ghost "+ New task" row at the bottom of every column (Linear's `+` per column [V]).
- **WIP/limits**: only Height/Businessmap-class tools surface WIP limits; for Taskflow the count-in-header is enough.

## 4. Sidebar / folder navigation

- **Item metrics**: item height 28–32px (Linear ~28px [E], Notion ~27px [E]), icon 16px in a fixed-width slot, text 13px, radius 6px on hover/active pill. Indent children by 16–20px, never with tree lines.
- **Grouping**: section labels in 11px/600 uppercase `tracking-wide` muted (Linear "Workspace/Your teams"), or Things-style Areas: 15px puffy icon + name as a group header with projects nested and **progress pies** (tiny circular completion meter) in front of project names [V culturedcode].
- **Counts**: right-aligned, 12px `text-muted-foreground tabular-nums`, only rendered when > 0 (Things shows Today count as the app badge too [K]). Don't box them in badges.
- **Hover reveals**: chevron (expand) replaces or joins the icon on hover, `+` and `⋯` appear on the right (Notion pattern [K]). Everything opacity-only.
- **Active state**: `bg-sidebar-accent` neutral pill + text at full foreground weight 500 — not an accent-filled bar (accent fill is a "website nav" tell). Linear's active tab is a subtle neutral tint [E].
- **Fixed sections**: smart lists pinned top with distinct icons+colors (Todoist: Inbox/Today/Upcoming; Things: Today star yellow, Upcoming red-ish calendar, Anytime teal stack, Someday sand box [K colored glyphs, gray text]) — icon carries the color, label stays neutral.
- Taskflow hooks: `LeftPane.tsx`, `BaseSidebarPane.tsx`, `src/styles/folder.css`; sidebar token set already exists in `index.css` (`--sidebar-*`) — tune tokens, not components.

## 5. Calendar surfaces

- **Event chip (the modern consensus, Notion Calendar/Google 2023+/Amie)**: rounded 4–6px block, **background = calendar color at ~12–18% tint, 3px solid left bar + title text at full calendar color**, title 12px/500 + time 11px regular; <30min events collapse to single line "title, time". Solid-fill chips are reserved for the event being dragged/selected or for the "primary" calendar. **Past events fade** to ~50% opacity / desaturate (Notion Calendar [K]). Multi-day/all-day events: full-tint bars in the all-day lane, radius only on the ends that terminate.
- **Current-time indicator**: 2px line in red/accent across today's column with an 8px dot or the **exact time label in the hour gutter, in the same red** (Notion Calendar shows the live time in the axis [K]); line spans only today, ghosted across other visible days.
- **Today highlight**: column wash `--fc-today-bg-color` at ~3–4% accent tint (default FullCalendar yellow wash reads dated — override it), plus date number in header set in a filled accent circle (Google/NC/Amie all do the filled-circle date [K]).
- **Header controls**: left = "July 2026" 16–18px/600 (month bold, year regular is a nice touch), `‹ › Today` chiclets; right = segmented view switcher (Day/Week/Month) + settings. Keyboard: `T` today, `D/W/M` views, `1–9` = n-day flexible view (NC's signature [V]), arrows navigate. Repo file: `ConsolidatedCalendarHeader.tsx`.
- **Fantastical touches** [V flexibits + macstories]: colored **pill per event in the DayTicker** (mini horizontal day strip) showing _when in the day_ the event occurs; heat-map dots per day showing schedule density — a good pattern for Taskflow's mini-month or list header.
- **Weekends**: 2–3% neutral wash on weekend columns; hour gridlines at half opacity for :30 lines.
- **FullCalendar implementation levers** (all in `src/components/calendar/calendar.css`): `--fc-border-color`, `--fc-today-bg-color`, `--fc-now-indicator-color`, `--fc-event-bg-color/--fc-event-border-color/--fc-event-text-color` (better: per-event via `eventContent`/`eventClassNames` render hook to build the tint+bar+text chip), `.fc-timegrid-slot { height }` for vertical density, `.fc-col-header-cell` for the day header, `slotLabelFormat` for lowercase `9 AM` gutter labels, `dayHeaderContent` for the filled-circle today number.

## 6. Color-coding systems (lists / tags / priorities)

- **Todoist's 20-color user palette** (project/label/filter colors from their API colors guide; berry_red corroborated as `#b8255f` [V color-hex palette]; rest [K, high confidence]):
  `berry_red #b8255f, red #db4035, orange #ff9933, yellow #fad000, olive_green #afb83b, lime_green #7ecc49, green #299438, mint_green #6accbc, teal #158fad, sky_blue #14aaf5, light_blue #96c3eb, blue #4073ff, grape #884dff, violet #af38eb, lavender #eb96eb, magenta #e05194, salmon #ff8d85, charcoal #808080, grey #b8b8b8, taupe #ccac93`.
  This is the canonical "user picks a color for a list/tag" palette shape: ~20 hues, mid-saturation, all legible as 8px dots. Taskflow's `color-picker.tsx` should offer a curated set like this, **stored as a named token, not raw hex**, so dark mode can remap.
- **Priority ≠ list color.** Todoist: priority lives only in the checkbox/flag (P1 `#d1453b`, P2 `#eb8909`, P3 `#246fe0`, P4 neutral [K]). Linear: priority is a **gray glyph** (bars of increasing height; urgent = orange square-exclamation) — deliberately colorless so labels/status own the hue [K]. Lesson: max one saturated system per row; if Taskflow colors lists, priorities should be glyph-first.
- **Status hues (Linear)**: backlog = dashed gray ring, todo = gray ring, in-progress = yellow partial pie, review = green [K, medium], done = brand-indigo filled check, canceled = gray ✕. The "progress pie that fills by stage" is the memorable element.
- **Derived tints, not stored tints**: every chip/event needs 3 derived values from the one stored color — `bg = color at 10–15% (color-mix(in oklab, C 12%, transparent))`, `fg = C` (dark mode: lightened C), `bar/dot = C`. Linear's theme system reduced 98 variables to base+accent+contrast generated in **LCH** so hues stay perceptually equal-lightness [V] — with Tailwind v4 already on oklch, do the same via `color-mix()`/`oklch(from ...)`.
- **Date-proximity coloring** (Todoist convention [K]): overdue = red, today = green, tomorrow = orange, this-week = purple, later = gray. Map onto `DueDateBadge.tsx`.

## 7. Micro-motion system (durations, easings, what never animates)

Source: Emil Kowalski's design-engineering guidance [V raw SKILL.md] + Things/Linear observations.

| Interaction                               | Duration                                                  | Easing                                                                                        |
| ----------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hover states                              | instant on, ~150ms off                                    | ease-out                                                                                      |
| Button press                              | 100–160ms, `scale(0.97)`                                  | ease-out                                                                                      |
| Tooltip / small popover                   | 125–200ms                                                 | ease-out                                                                                      |
| Dropdown / select / context menu          | 150–250ms                                                 | ease-out                                                                                      |
| Modal / drawer / sheet                    | 200–500ms (enter slower than exit; e.g. 300 in / 200 out) | strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)`; iOS drawer `cubic-bezier(0.32, 0.72, 0, 1)` |
| On-screen movement (reorder, kanban drop) | 200–350ms                                                 | strong ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)` or spring `{duration: 0.5, bounce: 0.2}` |
| List item entrance                        | enter from `scale(0.95)`+fade minimum, never `scale(0)`   | ease-out                                                                                      |
| Stagger                                   | 30–80ms between items                                     | —                                                                                             |

Hard rules [V]:

- **Never animate keyboard-initiated actions** or anything done 100+ times/day (checking a task off is borderline — keep it ≤200ms and opacity/transform only). Frequency matrix: 100+/day = none; tens/day = minimal; occasional = standard; rare/first-run = delight allowed.
- **Never `ease-in`**, never `transition: all`, animate **only `transform` and `opacity`** (not height/padding/margin — for expand/collapse use grid-rows or the existing tw-animate-css collapsible keyframes at 0.17s which already match this guidance).
- Gate hover effects behind `@media (hover: hover) and (pointer: fine)`; honor `@media (prefers-reduced-motion: reduce)`.
- Springs: keep bounce 0.1–0.3, mostly avoid bounce; Apple-style `{type: spring, duration: 0.5, bounce: 0.2}` for drag-drop settle only.
- Signature-moment budget: pick ONE delight animation (Things picked task-complete; Amie picks event-drag). Everything else utilitarian.
- Repo note: standardize as CSS vars in `src/index.css` (e.g. `--ease-out-strong`, `--dur-fast: 150ms`, `--dur-med: 250ms`) and Tailwind v4 `@theme` tokens; current ad-hoc `duration-200` usages then migrate for free.

## 8. Per-product quick reference (verified concrete values)

### Linear (from voltagent/awesome-design-md extraction of linear.app, dark marketing theme — app UI is the same family) [V]

- Brand: `#5e6ad2` (lavender-indigo), hover `#828fff`, focus `#5e69d1`.
- Dark surfaces (elevation ladder): canvas `#010102` → `#0f1011` → `#141516` → `#18191a` → `#191a1b`. Hairlines: `#23252a` / `#34343a` / `#3e3e44`.
- Text ladder: `#f7f8f8` (ink) → `#d0d6e0` → `#8a8f98` → `#62666d`. Success green `#27a644`.
- Type: Inter/Inter Display family ("Linear Display/Text"); weights 510/590 custom (use 500/600); UI sizes 12–16px at 400, 13px/500 for eyebrows, negative tracking only ≥20px (-0.2px at 20px up to -3px at 80px).
- Spacing scale 4/8/12/16/24/32/48/96. Radii 4/6/8/12/16/24/full. Buttons `8px 14px` pad, radius 8. Inputs `8px 12px`, radius 8; focus ring 2px @50%. Top nav 56px.
- Redesign principles [V blog]: 3-variable LCH theme engine (base/accent/contrast 30–100), chrome-blue stripped from grays, nav recedes, obsessive icon/label alignment.
- Legit copy-source: shadcn users replicate this as the "Linear theme" — neutral zinc + `--primary: #5e6ad2-equivalent oklch(0.585 0.233 277.117)`-ish accent.

### Things 3 [V culturedcode.com/things/features + K]

- White-space-first; system font (SF Pro); brand blue accent; brightly-colored sidebar glyphs on neutral labels; progress pies on projects; Magic Plus draggable FAB (drag left margin = heading, drag to Inbox target); inline row→editor morph ("clear white piece of paper"); drag "flocking" when multi-reordering; increased corner rounding + glassy buttons in the 2025 refresh [V blog/UMA]. Adjustable text size (3.18) — accessibility win worth copying (a density/size setting).

### Todoist

- Brand red `#DE483A` [V brandcolorcode]; 20-color user palette (sec. 6); priority checkbox colors P1 `#d1453b` / P2 `#eb8909` / P3 `#246fe0` [K]; natural-language quick add with inline **highlighted token chips** as you type ("tomorrow 5pm #work @errand p1" get colored underlines/chips) [K] — Taskflow already has `src/components/smart-input/` + `smart-tags.css`, so this pattern is directly relevant: token chips styled as tinted pills inside the input.

### Notion Calendar (Cron) [V matthiasfrank + notion.com blog]

- 3-pane: calendars left / grid center / event context right. Cmd+K command menu; `1–9` n-day view, `D/W/M`, `T` today; menu-bar next-event. Monochrome chrome, all color from calendar hues; drag edges to resize events; understated 4px-radius tinted chips [K].

### Amie [V producthunt/reviews]

- "Joyful productivity": won Product Hunt Golden Kitty for design; todos live _inside_ the calendar as checkable event chips (checkbox inside the event block) [K]; big radii, springy purposeful animations, avatars/emoji prominent, strong dark mode. Personality via motion + roundness, not decoration.

### Sunsama [V reviews]

- Calm tech: muted palette, generous whitespace, no gamification; guided daily planning ritual framing ("What are you working on today?"); channel colors as small dots; estimated-vs-actual time chips on tasks. Feel target: "paper planner", serif-friendly.

### Akiflow [V changelog/reviews]

- Command bar as the hero (Cmd+K with shortcut hints in results); "bright pastel colors, clean lines" after redesign; time-slot ritual UI; snooze/defer verbs surfaced as first-class buttons with keycap hints.

### Height (sunset 2025) [V height.app]

- Spreadsheet-density list (type-and-return task creation), visible column customization, clear subtask indentation — the reference for a future "compact mode".

### Fantastical [V flexibits/macstories]

- DayTicker: horizontal day strip where each event is a colored pill positioned by time-of-day; heat-map dots for busyness; calendar sets (context switching work/home) — pattern for Taskflow folder-level "focus sets".

### Motion [V reviews]

- Cautionary tale: powerful auto-scheduling but "steep learning curve", UI "not as visually appealing" — feature density without hierarchy discipline reads as clutter. Don't ship every control visible.

---

## 9. Candidate visual directions for Taskflow

All four keep: Tailwind v4 `@theme` tokens in `src/index.css`, shadcn primitives, Inter as base (already loaded), FullCalendar overridden via `calendar.css` render hooks. Each direction = palette sketch + type pairing + one signature element + when to pick it.

### Direction A — "Instrument Panel" (Linear-school precision)

- **Palette (light)**: bg `oklch(0.99 0.002 286)`, surface `oklch(0.972 0.002 286)`, border `oklch(0.925 0.003 286)`, fg `oklch(0.19 0.005 286)`, muted-fg `oklch(0.50 0.01 286)`; **accent indigo `#5e6ad2` → `oklch(0.55 0.17 277)`**, accent-hover `oklch(0.62 0.19 277)`. **Dark**: canvas `#0f1011`, raised `#141516`/`#18191a`, hairline `#23252a`, ink `#f7f8f8`/`#8a8f98` (values straight from Linear's ladder, sec. 8).
- **Type**: Inter 13px UI base / 12px meta / 500 titles; add `Inter Display` (or Inter at 600 with `letter-spacing:-0.01em`) for view headers 18px; `font-feature-settings: "cv05","tnum"` for numerals in counts/dates.
- **Radii**: drop global `--radius` 10px → 8px, chips 6px, buttons 8px.
- **Signature element**: **status ring system** — a 14px circular status icon on every task (dashed→open→partial pie→filled check) that doubles as the click target, reused in kanban column headers; plus Cmd+K command bar with keycap hints.
- **Pick when**: Taskflow wants to read as a serious multi-user work tool (RBAC branch suggests it does). Lowest risk, most "2026 default premium".

### Direction B — "Soft Paper" (Things × Sunsama calm)

- **Palette (light)**: warm paper bg `oklch(0.985 0.004 85)`, card white, border `oklch(0.91 0.006 85)`, fg warm-black `oklch(0.22 0.01 60)`; **accent Things-style blue `oklch(0.60 0.16 250)` (~`#3a7bd5`)**; sidebar glyphs get their own hues (Today yellow `oklch(0.8 0.15 90)`, Upcoming coral, Anytime teal) on neutral labels. **Dark**: warm graphite `oklch(0.21 0.008 60)` base, avoid pure black.
- **Type**: Inter 14px base but weight 400 titles (calm, not bold) + **Source Serif 4 or Lora 20px/600 for view titles and date headers** (Sunsama planner feel).
- **Radii**: keep 10px, cards 12px, generous row height 44px, whitespace-first.
- **Signature element**: **the completion moment** — circular checkbox fills with a 200ms pop + check draw, row holds ~1.5s then gracefully slides out (Things's grace delay); plus tiny **progress pies** next to each list/folder in the sidebar.
- **Pick when**: Taskflow positions as a personal planner. Warmer, most differentiated from stock shadcn, slightly more CSS work.

### Direction C — "Joyful Color" (Amie × Todoist energy)

- **Palette**: neutral high-contrast chrome (near-white/near-black) but the **full 20-hue user palette (sec. 6) does the talking**: every list/tag/event renders 12% tint bg + full-hue text + hue dot; **accent = user's chosen list color, not a fixed brand hue** (app-level accent falls back to violet `oklch(0.55 0.25 295)`).
- **Type**: Inter for UI + **Plus Jakarta Sans or General Sans 600** for headers (rounder, friendlier); emoji-first list identity (emoji-mart already in repo).
- **Radii**: big — events 8px, cards 12px, modals 16px; chips full-round.
- **Signature element**: **todos as checkable calendar chips** — scheduled tasks render on the FullCalendar grid as tinted event chips with a working checkbox inside (Amie's hallmark), springy drag `{duration:0.5, bounce:0.2}` on drop.
- **Pick when**: consumer-leaning, wants "delight" reviews. Highest motion/QA budget; risks looking toy-like if density isn't kept tight.

### Direction D — "Editorial Calm" (Notion Calendar monochrome)

- **Palette**: strict monochrome chrome — light `oklch(1 0 0)` bg / `oklch(0.96 0 0)` panels / true-gray text ladder; **zero fixed accent**; all chroma comes from calendar/list colors as 4px-radius tinted chips; current-time line red `oklch(0.60 0.22 25)` is the only hard-coded color.
- **Type**: Inter 13px, tabular numerals everywhere in the grid gutter, uppercase 10px/600 tracking-wide day-of-week headers.
- **Radii**: 4–6px, hairline borders, ultra-flat (shadows only on popovers).
- **Signature element**: **keyboard-first flexible grid** — `1–9` keys set visible day count, `T` today, Cmd+K everything; live time label in the hour gutter in red; today's date in a filled black circle.
- **Pick when**: calendar is the hero surface and eng time is tight (mostly token + FullCalendar CSS work, minimal component redesign).

**Recommendation**: A as the base system (tokens, type scale, motion), stealing B's completion moment for the checkbox and D's keyboard/calendar treatments — they compose without conflict. C only if product direction says consumer.

---

## 10. Sources

- Linear values: https://raw.githubusercontent.com/voltagent/awesome-design-md/main/design-md/linear.app/DESIGN.md ; redesign principles: https://linear.app/now/how-we-redesigned-the-linear-ui ; board docs: https://linear.app/docs/board-layout ; also surfaced: https://getdesign.md/linear.app/design-md , https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1
- Motion values: https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md (Emil Kowalski, emilkowal.ski)
- Things 3: https://culturedcode.com/things/features/ ; https://culturedcode.com/things/blog/ ; https://umatechnology.org/things-3-is-out-with-overhauled-interface-and-multiple-new-features/ ; https://medium.com/@smithtimmytim/review-things-3-for-mac-and-ios-114f4420f44b
- Todoist: https://www.brandcolorcode.com/todoist ; https://www.color-hex.com/color-palette/97257 ; https://www.todoist.com/help/articles/set-a-priority-in-todoist-Wy82Jp ; https://mobbin.com/colors/brand/todoist (403 to fetcher)
- Notion Calendar: https://matthiasfrank.de/en/notion-calendar/ ; https://www.notion.com/blog/introducing-notion-calendar ; https://efficient.app/apps/notion-calendar
- Amie: https://www.producthunt.com/products/amie-2 ; https://ellieplanner.com/comparisons/amie-calendar-review ; https://nicelydone.club/apps/amie
- Sunsama: https://calmevo.com/sunsama-review/ ; https://www.sunsama.com/daily-planning ; https://blog.saner.ai/sunsama-reviews/
- Akiflow: https://product.akiflow.com/changelog/major-ui-ux-reviews ; https://efficient.app/apps/akiflow
- Height: https://height.app/product/spreadsheet ; https://freshvanroot.com/blog/height-app-review/
- Fantastical: https://flexibits.com/fantastical ; https://www.macstories.net/reviews/the-new-fantastical-review/
- Motion: https://thebusinessdive.com/motion-app-review ; https://www.usemotion.com/
- Morgen: https://www.morgen.so/ ; https://efficient.app/apps/morgen
