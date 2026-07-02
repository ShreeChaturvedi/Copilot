# SCHEMATIC — Taskflow Calendar brand-system specification

Status: implementation-ready. Source recon: `../recon/research-landing-2.md` (Concept 2), `../recon/research-app-ui.md` (sec. 9 Direction A + motion table), `../recon/design-system-map.md`, `../recon/ui-audit/critique.md`. All OKLCH values in this document were converted numerically from the stated hex, not estimated. Repo paths are absolute under `/home/shree/dev/taskflow-calendar`.

## 1. Thesis

The calendar is an engineering drawing that becomes the real product where you look: graphite lines are everything drawn or planned, indigo is the live ink of anything happening now, interactive, or done. Landing and app render the same artifact, the week grid, at two levels of finish, so the marketing page is literally the technical drawing of the instrument you then use.

Why this is native to THIS product, not a skin:

- The product's one object is a grid of time with tasks placed at coordinates. A task with a start and a duration IS a dimensioned span (`14:00 |— 90 MIN —| 15:30`). Dimension annotation is not decoration here, it is the data model drawn.
- The smart-input parser (`src/components/smart-input/`) is an annotator: it takes raw text and marks up the time, priority, and list spans. That is exactly what a drafter does to a sketch. The parse-highlight styling and the landing demo are the same act.
- The week grid is the artifact both surfaces render. The landing etch is the grid at 4-6% contrast, the app is the grid at 100%. Empty states in the app drop back to etch (the drawing of the thing you have not made yet), closing the loop: unbuilt = etched, built = inked, live = indigo.

## 2. Shared token table

One table serves landing and app. Column L = light, D = dark. Rows marked CTX note the only context-dependent values, with justification. Everything else is identical on both surfaces.

Source of truth is OKLCH (Tailwind v4 native); hex given for handoff. Define in `src/index.css` `:root` / `.dark`, expose via `@theme inline`. Prerequisite fixes before these land: add `@custom-variant dark (&:is(.dark *));`, strip all `hsl(var(--*))` wrappers in `calendar.css`/`index.css`, remove the dead `tailwind.config.js` grays (see sec. 9).

### 2.1 Surface ladder

| Token              | Light                                              | Dark                                               | Use                                     |
| ------------------ | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| `--background`     | `oklch(0.985 0.001 106)` #FAFAF9 (paper)           | `oklch(0.160 0.011 276)` #0C0D12 (board)           | page, calendar canvas                   |
| `--surface`        | `oklch(1 0 0)` #FFFFFF                             | `oklch(0.192 0.013 271)` #12141A                   | cards, rows' parent panels, chips' base |
| `--surface-raised` | `oklch(1 0 0)` #FFFFFF + `--shadow-2`              | `oklch(0.216 0.020 276)` #171923                   | popovers, menus, Cmd+K, drag previews   |
| `--surface-sunken` | `oklch(0.964 0.003 106)` #F3F3F1                   | `oklch(0.150 0.009 274)` #0A0B0F                   | input wells, kanban columns, kbd chips  |
| `--hairline`       | `color-mix(in oklab, var(--ink) 7%, transparent)`  | `color-mix(in oklab, var(--ink) 9%, transparent)`  | grid rules, dividers, row separators    |
| `--border`         | `color-mix(in oklab, var(--ink) 13%, transparent)` | `color-mix(in oklab, var(--ink) 16%, transparent)` | component edges, inputs                 |

Dark surfaces are indigo-hued near-blacks (hue 271-276), never zinc. This is the single cheapest "not stock shadcn" move in the whole system.

### 2.2 Ink ladder

| Token     | Light                            | Dark                             | Use                                                             |
| --------- | -------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `--ink`   | `oklch(0.223 0.014 273)` #191B22 | `oklch(0.950 0.007 277)` #EDEEF3 | titles, primary text                                            |
| `--ink-2` | `oklch(0.432 0.020 271)` #4C505C | `oklch(0.824 0.013 271)` #C2C5CE | body, secondary text, any meta the user must read               |
| `--ink-3` | `oklch(0.649 0.015 262)` #8A8F98 | `oklch(0.649 0.015 262)` #8A8F98 | supplementary meta only (shared value both modes, deliberately) |
| `--ink-4` | `oklch(0.789 0.012 270)` #B7BAC2 | `oklch(0.490 0.015 271)` #5D6069 | disabled, idle rings, faint rules                               |

A11y rule: `--ink-3` fails AA on both backgrounds (~3.3:1). It may only carry information that is duplicated elsewhere (counts next to labeled sections, decorative meta). Required-to-read text at any size uses `--ink-2` or darker.

### 2.3 Live ink (indigo)

| Token             | Light                                               | Dark                                                | CTX                                                                                                                  |
| ----------------- | --------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--live`          | `oklch(0.567 0.159 275)` #5E6AD2                    | same                                                | identical everywhere                                                                                                 |
| `--live-hover`    | `oklch(0.518 0.161 274)` #4F5BC3                    | `oklch(0.691 0.164 276)` #828FFF                    | CTX: hover must move toward higher contrast against its own background, so it darkens on paper and lightens on board |
| `--live-wash`     | `color-mix(in oklab, var(--live) 10%, transparent)` | `color-mix(in oklab, var(--live) 16%, transparent)` | CTX: washes need more alpha over dark to register at equal perceived strength                                        |
| `--live-rim`      | `color-mix(in oklab, var(--live) 44%, transparent)` | same                                                | focus/selection rims (Resend 44% alpha discipline)                                                                   |
| `--live-contrast` | `#FFFFFF`                                           | same                                                | text/glyphs on live fills (4.7:1 on #5E6AD2, passes AA)                                                              |

The live-ink law (enforced in review, not just tokens): indigo appears ONLY on things that are now, interactive, or done. Now-line, today marker, primary CTA, focus rings, selection, parsed spans, completed rings, drag-target rims. Never on static chrome, never as decoration. Everything drawn-but-inert is graphite.

### 2.4 Etch (the drawing layer)

| Token           | Light                                              | Dark                                                                          | CTX                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--etch-line`   | `color-mix(in oklab, var(--ink) 6%, transparent)`  | `color-mix(in oklab, oklch(0.746 0.133 278) 12%, transparent)` (#9AA3FF base) | CTX: dark etch is phosphor-indigo, not white. White hairlines on near-black read as scratches; hued lines read as blueprint. Light etch stays graphite because indigo lines on paper would violate the live-ink law |
| `--etch-text`   | `color-mix(in oklab, var(--ink) 35%, transparent)` | `color-mix(in oklab, oklch(0.746 0.133 278) 45%, transparent)`                | dimension annotations, FIG labels. Always `aria-hidden`, always redundant with real text                                                                                                                            |
| `--etch-strong` | 2x the line alpha (12% / 20%)                      |                                                                               | CTX landing vs app: landing uses base alpha across whole viewports; app empty states use `--etch-strong` because the etch there is small and must be noticed. Same language, two amplitudes                         |
| `--etch-dash`   | `stroke-dasharray: 4 3` / `border: 1px dashed`     | same                                                                          | dashed = planned/not-yet-real (empty slots, drop placeholders)                                                                                                                                                      |

### 2.5 Chip tint formula (user data colors)

User-picked list/calendar colors are data, not tokens. Every rendered color derives from the stored color C at runtime:

```css
--chip-bg: color-mix(in oklab, var(--chip) 14%, var(--surface));
--chip-fg: color-mix(in oklab, var(--chip) 72%, var(--ink)); /* light */
--chip-fg: color-mix(
  in oklab,
  var(--chip) 60%,
  var(--ink)
); /* dark: mixes toward near-white ink = auto-lightened */
--chip-bar: var(--chip); /* light */
--chip-bar: color-mix(in oklab, var(--chip) 85%, white); /* dark */
```

Past/completed chips: `opacity: 0.55; filter: saturate(0.65)`. Selected/dragging chips: solid `var(--chip)` + `--live-contrast` text.

Curated picker ramp (replaces the raw Tailwind-500 hexes in both create dialogs), all at equal perceptual lightness `oklch(0.62 0.14 H)`:

| Name   | OKLCH                  | Hex                             |
| ------ | ---------------------- | ------------------------------- |
| red    | `oklch(0.62 0.14 25)`  | #CD605A                         |
| orange | `oklch(0.62 0.14 60)`  | #C26E12                         |
| yellow | `oklch(0.62 0.14 90)`  | #A78100                         |
| green  | `oklch(0.62 0.14 150)` | #399D57                         |
| teal   | `oklch(0.62 0.14 190)` | #009F99                         |
| cyan   | `oklch(0.62 0.14 230)` | #0094C9                         |
| blue   | `oklch(0.62 0.14 262)` | #5684DA                         |
| indigo | `oklch(0.62 0.14 277)` | #727CD9 (default for new lists) |
| violet | `oklch(0.62 0.14 300)` | #9470CD                         |
| pink   | `oklch(0.62 0.14 340)` | #BC61A0                         |

Legacy stored hexes (#3b82f6 etc.) pass through the same formula unchanged.

### 2.6 Status hues

Green is removed from chrome entirely (critique 3.2: today-green was a third accent; two different greens for one affordance). Status set:

| Token                         | Value (both modes)              | Use                                                                         |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `--status-todo`               | `var(--ink-4)`                  | not-started ring                                                            |
| `--status-progress`           | `oklch(0.730 0.140 76)` #D99A2B | in-progress arc, kanban col glyph                                           |
| `--status-done`               | `var(--live)`                   | done fill. Completing is the product's core live event, so done is live ink |
| `--overdue` / `--destructive` | `oklch(0.577 0.215 27)` #DC2627 | overdue rings/text, delete actions                                          |

`--success` token remaps to `var(--live)` (toasts confirm with an indigo check, not green). `themeStore.ts:48` meta theme-color updates to `#FAFAF9` / `#0C0D12`.

### 2.7 Shadows and the rim

| Token                                                                | Light                                                                                                                                                | Dark                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `--rim` (Clerk double hairline, on every card/dialog/popover/window) | `inset 0 0 0 0.5px oklch(1 0 0 / 0.9), 0 0 0 0.5px oklch(0.223 0.014 273 / 0.16)`                                                                    | `inset 0 0 0 0.5px oklch(0.746 0.133 278 / 0.12), 0 0 0 0.5px oklch(0 0 0 / 0.6)` |
| `--shadow-1` (resting cards)                                         | `0 1px 2px -1px oklch(0.223 0.014 273 / 0.08), 0 2px 6px -2px oklch(0.223 0.014 273 / 0.05)`                                                         | `0 1px 2px -1px oklch(0 0 0 / 0.4), 0 2px 6px -2px oklch(0 0 0 / 0.3)`            |
| `--shadow-2` (popovers, drag, penumbra 3-tier)                       | `0 0.6px 1.6px -1.5px oklch(0.223 0.014 273 / 0.11), 0 2.3px 6px -3px oklch(0.223 0.014 273 / 0.09), 0 10px 24px -4px oklch(0.223 0.014 273 / 0.06)` | same structure, black at 0.5/0.4/0.35                                             |
| `--shadow-3` (dialogs, hero window)                                  | `0 1px 2px -1px 0.10, 0 8px 24px -6px 0.12, 0 28px 64px -12px 0.14` (same ink base)                                                                  | black at 0.5/0.45/0.5                                                             |

Shadows always co-occur with `--rim`; in dark mode the rim carries most of the edge (CTX: dark shadows are nearly invisible on #0C0D12, so alphas rise and the inner phosphor rim does the work).

### 2.8 Radii and spacing

Radius scale (replaces today's six unrelated radii): 4 (event chips, kbd chips), 6 (task rows, swatches, icon tiles), 8 (buttons, cards, kanban columns, inputs), 12 (dialogs, Cmd+K), 16 (mobile bottom sheets). `--radius: 0.5rem` (base drops from 10px to 8px). Spacing scale: 4/8/12/16/24/32/48/64/96.

Focus (all surfaces including rows, chips, folder cards, which currently have none): `outline: 2px solid var(--live-rim); outline-offset: 2px`.

## 3. Type system

Two faces, one law: **if it is a numeral, it is mono.** Every time, date, count, fraction, shortcut, and version in landing and app is Spline Sans Mono. This removes any dependence on tabular-figure support in the voice face and is the brand's Clerk-numerals move.

- **General Sans** (Fontshare, ITF Free Font License, variable wght 200-700) — single voice face: display AND UI. No serif, no second sans.
- **Spline Sans Mono** (Google Fonts, OFL, variable wght 300-700) — co-lead, promoted to chrome (Warp move): annotations, eyebrows, tickers, keycaps, gutters, all numerals.

### 3.1 Role table

| Role                                                                     | Face | Size/LH             | Weight               | Tracking | Case/features                                                        |
| ------------------------------------------------------------------------ | ---- | ------------------- | -------------------- | -------- | -------------------------------------------------------------------- |
| Hero display (landing H1)                                                | GS   | 72/1.02 (40 mobile) | 600                  | -0.025em | sentence case                                                        |
| Section display (landing H2)                                             | GS   | 44/1.08 (32 mobile) | 600                  | -0.02em  | sentence                                                             |
| Feature title (landing H3)                                               | GS   | 24/1.2              | 600                  | -0.015em | sentence                                                             |
| Landing body                                                             | GS   | 17/1.6              | 400                  | 0        | max-w 44ch                                                           |
| Landing caption                                                          | GS   | 14/1.5              | 400                  | 0        |                                                                      |
| App view title                                                           | GS   | 17/1.3              | 600                  | -0.01em  | e.g. "July 2026", month 600 / year 400 kept                          |
| App UI base (rows, buttons, inputs, dialog body)                         | GS   | 13/1.45             | 500 titles, 400 body | 0        |                                                                      |
| App UI secondary                                                         | GS   | 12/1.4              | 400                  | 0        |                                                                      |
| App text meta                                                            | GS   | 11/1.3              | 500                  | +0.02em  | `--ink-2` if load-bearing                                            |
| Mono annotation (dimensions, eyebrows, FIG labels, empty-state captions) | SSM  | 12/1.4 (11 in-app)  | 500                  | +0.08em  | UPPERCASE                                                            |
| Mono ticker / honesty line                                               | SSM  | 13/1.4              | 400                  | +0.06em  | UPPERCASE                                                            |
| Hour gutter                                                              | SSM  | 11/1.0              | 400                  | 0        | `09:00` or `9 AM` per user setting                                   |
| Time in event chips                                                      | SSM  | 11/1.1              | 400                  | 0        |                                                                      |
| Counts (sidebar, kanban headers, badges)                                 | SSM  | 12/1.0              | 400                  | 0        | plain text, never boxed                                              |
| Keycap chips                                                             | SSM  | 11/1.0              | 500                  | +0.02em  | on `--surface-sunken`, radius 4, h 20, min-w 20, px 4, hairline ring |
| Completion stamp / live time chip                                        | SSM  | 11/1.0              | 500                  | +0.02em  | `--live`                                                             |

### 3.2 Loading strategy

- Self-host both as variable woff2 (Fontshare download for General Sans, google-webfonts-helper or gftools for Spline Sans Mono). Latin subset only (`unicode-range: U+0000-00FF, U+2013-2014, U+2018-201D, U+2026`). Two files, ~90KB total. Kill the double Inter fetch (`index.html:8-10` AND `src/index.css:2`); Inter is dropped entirely.
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` for both files in `index.html`. `font-display: swap` plus metric-compatible fallbacks:

```css
@font-face {
  font-family: 'General Sans Fallback';
  src: local('Arial');
  size-adjust: 100.8%;
  ascent-override: 100%;
  descent-override: 24%;
  line-gap-override: 0%;
}
@font-face {
  font-family: 'Spline Sans Mono Fallback';
  src: local('Courier New');
  size-adjust: 96%;
  ascent-override: 98%;
  descent-override: 27%;
  line-gap-override: 0%;
}
```

The override numbers above are starting points: regenerate exact values with `npx fontpie <file>.woff2` at implementation time and paste over.

- Stacks: `--font-sans: 'General Sans', 'General Sans Fallback', ui-sans-serif, system-ui, sans-serif;` `--font-mono: 'Spline Sans Mono', 'Spline Sans Mono Fallback', ui-monospace, 'SFMono-Regular', Menlo, monospace;` declared in `@theme` so `font-sans`/`font-mono` utilities inherit.

## 4. The signature language, per app surface

Signature = **dimension-annotated time** + the etch + the live-ink law. Each surface below: what changes from today (per critique), in the concept's language, with measurements.

### 4.1 TaskItem row (`src/components/tasks/TaskItem.tsx`)

Today: bare 16px circle + one truncated line, no metadata ever renders, invisible interactions. New anatomy (min-height 40px, radius 6, padding 4px 8px):

```
|<-16->|<--18-->|<-10->|<--------------- title 1fr --------------->|<-8->|<- meta auto ->|<-8->|<-28->|
| grip |  ring  |      | GS 13/500 --ink, truncate                 |     | THU 14:00  x2 |     |  ...  |
 hover   16px            completed: strike + --ink-3                       SSM 11 chips           menu
 reveal  status                                                            + tag dots 6px
```

- Grip: 6-dot glyph, `--ink-4`, opacity 0 -> 1 on row hover, only under `@media (hover: hover) and (pointer: fine)`. Reserved 16px column so nothing reflows.
- Due chip = the dimension, SSM 11: unscheduled shows nothing; scheduled shows `THU 14:00`; with duration `THU 14:00 . 90 MIN`. Proximity color: overdue `--overdue`, today `--live`, else `--ink-2`. Tags: 6px dots + first tag name, `+N` overflow in SSM (kills the infinite horizontal ScrollArea).
- Hover: `background: color-mix(in oklab, var(--ink) 4%, transparent)`, instant on / 120ms off. Selected (keyboard/multi): `--live-wash` bg + 2px inset left `--live` bar.
- Fix the dead `opacity-[${...}]` template-literal class (line ~388) and the tag-color template classes (512-513) while touching this file.

### 4.2 Status ring states (16px, 1.5px stroke, replaces checkbox-vs-StatusBadge split)

| State                        | Drawing                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| not_started                  | ring `--status-todo`                                                                |
| not_started + scheduled      | ring `--status-todo` + 3px `--live` dot centered (planned = a point placed in time) |
| in_progress                  | ring `--status-progress` + 50% pie wedge at 40% alpha                               |
| done                         | disc `--status-done` + 2px `--live-contrast` check                                  |
| overdue (any not-done state) | ring `--overdue`                                                                    |
| hover (pointer fine)         | ghost check `--ink-4` inside                                                        |
| focus-visible                | standard 2px `--live-rim` outline                                                   |

Kill the `button[role='checkbox']` `!important` block in `index.css:347-368` and the dark-mode light-border leak (critique bug 10) as part of this.

### 4.3 The completion moment (the ONE delight animation in the app)

Timeline on release over the ring:

- t=0: disc fills `--live` from center, 140ms ease-out. (In calendarMode rows: opacity-only fill, no transform, per the FullCalendar drag constraint.)
- t=60ms: check draws, `stroke-dashoffset` 160ms.
- t=100ms: strikethrough draws left->right over the title, 200ms (animate `background-size` of a 1px `linear-gradient` under the text, since `text-decoration` cannot animate); title -> `--ink-3`.
- t=150ms: the stamp: `DONE 14:32` fades into the meta slot, SSM 11 `--live`, then decays to `--ink-4` after 600ms. The completion is logged like a drawing stamp, this is the signature detail.
- t=800ms: grace window closes; if the active filter hides completed, row exits via `grid-template-rows: 1fr -> 0fr` + opacity, 200ms. Clicking the ring again inside the window reverts instantly (undo is never animated).

Prerequisite: rescope the global transition kill (`index.css:599-607`) from "always" to a `.is-dragging` class toggled in the FullCalendar `Draggable` callbacks, otherwise none of this can run in the sidebar.

### 4.4 Folder cards (`TaskFolderGrid.tsx` + `new-folder.css`)

The manila clip-path folder is deleted (it renders as a detached paint bar, critique 3.5). A folder card becomes a drawing title block:

```
+----------------------------------+  200x148, --surface, --rim, --shadow-1, r8
| [28 icon tile]            [...]  |  tile bg = chip-bg(list color), r6
| Work                             |  GS 15/600 --ink
| |----------- 4/12 -----------|   |  dimension progress: 1px hairline track,
|                                  |  2px end ticks, --live fill, SSM 11 fraction
|..................................|  hairline divider
| 12 TASKS . 3 THIS WEEK           |  SSM 11 UPPERCASE --etch-text
+----------------------------------+
```

Grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap 16, fixes the left-packed fixed-column emptiness. Hover: translateY(-2px) + `--shadow-2`, 150ms; the metadata strip crossfades (150ms, with `visibility` gating so layers never double-expose, fixing critique bug 6) to the first 2 task titles, GS 12 `--ink-3`. Name and icon never fade. New-list tile: 1px dashed `color-mix(in oklab, var(--ink) 20%, transparent)`, plus glyph, `NEW LIST` SSM 11. Clicking into kanban sets the mode toggle active state and shows a back affordance (critique bug 13).

### 4.5 Kanban (`TaskKanbanBoard.tsx`)

- Columns: no vertical borders (delete `border-r`); each column is a `--surface-sunken` well, radius 8, padding 8, 12px gutters, `minmax(280px, 340px)`. Header inside the well, h 36, px 8: 14px status ring glyph (same glyphs as 4.2) + name GS 13/600 `--ink` + count SSM 12 `--ink-3` plain text (no Badge). `+` and `...` hover-revealed right.
- Cards: `--surface`, `--rim`, radius 8, `--shadow-1`, padding 10px 12px. Row 1 title GS 13/500 clamp-2. Row 2 (only when data exists): due SSM 11 proximity-colored + tag dots + priority glyph right. The hard gray-500 borders and gray fills are gone; list color appears via the due/tag system, not the card shell.
- Drag: pickup 120ms scale 1.02 + `--shadow-2` + rim -> `--live-rim`. The vacated slot keeps a dashed etch placeholder (1px dashed at `--etch-strong`, same height): the drawing of the card remains while the card is in your hand. Target gap opens 200ms. Drop settles with spring (duration 0.5, bounce 0.15) and the landed card's rim flashes `--live-rim`, decaying 300ms.
- Empty column: a dashed etched card outline (h 64, radius 8) 12px below the header, `NO TASKS` SSM 11 `--etch-text` centered inside. Drag-over: outline and text go `--live` + `--live-wash` fill. No more centered gray text floating in 700px of white.
- Mobile: `snap-x mandatory`, column 85vw with a 16px peek of the next column, pager `1 / 3` SSM 11 centered under the board (critique bug: undiscoverable columns).
- Fix the `onSchedule={() => void 0}` no-op (lines 329, 388) or remove the menu item until wired.

### 4.6 Calendar grid (`calendar.css` + `CalendarView.tsx` render hooks)

- Hour gutter: 48px (36 mobile), SSM 11 `--ink-3`, right-aligned 8px from the axis, baseline sitting 6px above its line; 4x1px tick extends left of the axis at each hour; :30 rules at 50% hairline alpha.
- Day headers (h 40): day name SSM 11 UPPERCASE `--ink-3`, date SSM 13/500 `--ink`. Today: 22px `--live` disc, `--live-contrast` numeral, day name in `--live`. One treatment, one hue (replaces the two greens and the squished pill, critique bugs).
- Today column: **hairlines at 100% alpha while other days' verticals render at 65%.** The drawing is most finished where you are: this is the thesis rendered inside the product. Wash: `color-mix(in oklab, var(--live) 3%, transparent)`, and it does NOT flood the all-day lane or Day view (scope to timegrid body cells only).
- Event chips: `--chip-bg` fill, 3px solid `--chip-bar` left edge, radius 4, padding 2px 6px; title GS 12/500 `--chip-fg`; time SSM 11 at 80% `--chip-fg`. Under 30min: single line `14:00 Standup`. Past: 0.55 opacity + saturate(0.65). Selected: solid `--chip` + white text + `--shadow-1`.
- **Drag/resize = the dimension moment.** While dragging, a floating annotation renders beside the chip: `90 MIN` SSM 11 `--live` between two 1px `--live` extension lines with end ticks (CSS pseudo-elements). While resizing, live start/end times (`14:00`, `15:30`, SSM 11 `--live`) pin to the chip's top/bottom edges. This is the landing hero's dimension annotation appearing under your cursor in the product.
- Now-line: 1px `--live` across today's column with a 6px dot at the axis; in the gutter, the current time (`14:32` SSM 11/500 `--live`) renders in a small `--background` chip that occludes the nearest hour label. Extends across other visible days at 25% alpha. Position updates once per minute via one interval driving `transform: translateY()` only.
- Weekends: `color-mix(in oklab, var(--ink) 2%, transparent)` wash. Month view: day numbers SSM 12 top-right, chips collapse to 6px dot + 11px title, `+N MORE` SSM 10.5 `--ink-3`. (Month header offset is a functional bug, filed separately, fix precedes styling.)

### 4.7 Dialogs and sheets (`ui/dialog.tsx`, `ui/sheet.tsx`, all dialog consumers)

- Dialog: radius 12, `--rim` + `--shadow-3` (border removed), zero-padding shell with zones: header 20/24/16 (eyebrow SSM 11 UPPERCASE `--ink-3`, e.g. `NEW EVENT`, then title GS 16/600), body px 24, footer 16/24 above a hairline, actions right. Primary = `--live` fill, h 36, radius 8; secondary = ghost. Overlay `oklch(0.223 0.014 273 / 0.32)` light / `oklch(0 0 0 / 0.5)` dark, `backdrop-filter: blur(4px)`. Enter 240ms, exit 160ms.
- Sheet: 420px, `--surface`, hairline left edge + rim, same header grammar. Peek-mode dual render stays.
- Detail sheet gains permanent field rows (fixes "no way to set due date/priority anywhere", critique bug 8): each unset field renders as an etched row: label SSM 11 `--etch-text` (`SCHEDULE`, `PRIORITY`, `LIST`, `TAGS`) + ghost value "None. Press S." Unset fields are drawn, not hidden.
- Create Calendar and Create List unify to one form grammar: icon tile + name input + the 10-swatch token ramp (24px swatches, selected gets `--live-rim` ring). Fix the "Create Task" button label on the list dialog.
- Below 640px every dialog becomes a bottom sheet: radius 16 16 0 0, max-h 92vh, 32x4 drag handle in `--ink-4` (fixes the clipped mobile event dialog, critique bug 4).

### 4.8 Cmd+K bar (cmdk already in repo, unwired)

Panel 560px, top 18vh, `--surface-raised`, rim, `--shadow-3`, radius 12. Input GS 15/400, h 52, px 16, hairline-bottom, no border. Group labels SSM 11 UPPERCASE `--etch-text`, px 12. Result rows h 40 px 12 radius 6: 16px icon `--ink-3`, label GS 13, right-aligned keycap chips (spec 3.1). Selected row: `--live-wash` + 2px left `--live` bar. Open 160ms (opacity + scale 0.98), close 100ms. Shortcuts surfaced: pull the real map from `src/hooks/useKeyboardShortcuts.ts`, never invent.

### 4.9 Empty states (where the etch earns its keep in-app)

Rule: an empty surface renders the etched drawing of its filled state, at `--etch-strong`, always with one concrete next action.

- Empty task list: three dashed etched row skeletons (16px circle + a line at 60% width, 40px rows), then `NOTHING PLANNED` SSM 11 `--etch-text`, then GS 13 `--ink-2` "Press N to add a task." No clipboard icon.
- Empty kanban column: sec 4.5.
- Empty folder grid: one etched folder-card outline + "Create your first list."
- First-run calendar: one etched chip outline at tomorrow 09:00, `DRAG A TASK HERE` SSM 11 (teaches the drag-in feature).
- Filter-empty (not data-empty): plain GS 13 `--ink-2` "No tasks match. Clear filters." with the clear action inline. Etch is reserved for true emptiness.

### 4.10 Auth pages (added surface; critique 3.1 says auth and app read as two products)

The rainbow conic gradient dies. Auth = paper + etch: full-viewport etched week grid at base alpha, centered 400px card (`--surface`, rim, `--shadow-2`), one `--live` filled primary button (the current screens have no visually primary action). The signup card's eyebrow: `NEW ACCOUNT` SSM 11. ThemeProvider's blue spinner becomes a `--live` ring.

### 4.11 Mobile adaptations (systemwide)

Rows min 44px, ring 18px, grip hidden, 3-dot menu always visible at 24px. View switcher gets words, not letters (`Month Week Day List`, scrollable segmented, 12px). Settings collapses to single pane with back header (fixes critique bug 5). Hour gutter 36px, labels `09`. Type stays at the same scale (13 base) except titles drop one step. Tap targets >= 44px everywhere.

## 5. Motion grammar (shared, landing + app)

Declared as tokens in `@theme`: `--ease-out: cubic-bezier(0.25,1,0.5,1)`, `--ease-out-expo: cubic-bezier(0.16,1,0.3,1)`, `--ease-move: cubic-bezier(0.77,0,0.175,1)`, `--dur-1: 120ms`, `--dur-2: 160ms`, `--dur-3: 240ms`.

| What                                                  | Duration                                                                 | Easing                              | Animates                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------- |
| Hover                                                 | 0 on / 120ms off                                                         | ease-out                            | bg, color, opacity only                     |
| Press                                                 | 120ms, scale 0.98                                                        | ease-out                            | transform (never on calendarMode task rows) |
| Tooltip/popover                                       | 140 in / 100 out                                                         | `--ease-out`                        | opacity + scale 0.98->1                     |
| Menu/dropdown                                         | 160                                                                      | `--ease-out`                        | opacity + translateY 4px                    |
| Dialog                                                | 240 in / 160 out                                                         | `--ease-out-expo`                   | opacity + translateY 8 + scale 0.98         |
| Sheet                                                 | 260 in / 200 out                                                         | `cubic-bezier(0.32,0.72,0,1)`       | translateX/Y                                |
| Placement (drag settle, reorder, gap open)            | 200-220                                                                  | `--ease-move` or spring bounce 0.15 | transform                                   |
| Completion                                            | 140/160/200 + 800 hold + 200 exit                                        | ease-out                            | sec 4.3                                     |
| Etch draw (landing load, app empty-state first paint) | 700ms staggered                                                          | `--ease-out-expo`                   | stroke-dashoffset, once per mount           |
| Ambient (landing only)                                | ticker 45s linear; now-line steps 60s; smart-input demo loop 4s IO-gated | linear                              | transform                                   |

**Two-tempo rule:** every interaction completes in <= 260ms; every ambient loop is >= 4s and compositor-only (transform/opacity). Nothing lives between 800ms and 4s. The 700ms etch draw and 800ms grace hold are the only sanctioned mid-band moments, each occurs at most once per surface.

Hard rules: never `ease-in`, never `transition: all`, never animate height/margin (use grid-rows), never animate keyboard-initiated navigation beyond a 120ms opacity, hover effects gated behind `(hover: hover) and (pointer: fine)`.

Reduced motion (`prefers-reduced-motion: reduce`): all durations -> 0 except opacity fades <= 120ms; etch renders pre-drawn; landing demo shows the final parsed frame statically; ticker is a static line; completion keeps the 800ms grace timer (it is function, not motion) with instant state changes.

## 6. Landing page, section by section

Global: the page is ONE continuous etched sheet. A single full-page etch layer (SVG, 8px baseline grid, hour ticks and week columns) runs behind every section at `--etch-line`; sections are regions of the drawing, not stacked cards. Static-first, real DOM product UI (no screenshots in the fold), fold media <= 500KB, Lighthouse perf >= 0.95, entrances done by 1.4s.

### 6.1 Nav (h 64, sticky)

Wordmark "taskflow" GS 15/600 + the grid mark (12px 3x3 hairline grid glyph with one `--live` cell, this glyph is the favicon and the app's loading mark too). Links `FEATURES  PRICING  CHANGELOG` SSM 12 UPPERCASE `--ink-3`. Right: "Sign in" ghost + "Start free" `--live` fill h 36 r8. Below the bar: 4-step progressive blur ladder (backdrop-filter 1/2/4/8px over 24px bands). Hairline bottom at 60% alpha, 100% after first scroll.

### 6.2 Hero (min-h 88vh)

Layout per the concept sketch: H1 left-top, max-w 13ch, GS 72; sub GS 17 `--ink-2` max-w 44ch; CTA row: [Start planning free] `--live` + ghost [Press Cmd+K to try the input] with a real keycap chip; beneath, the mono honesty line, SSM 13: `FREE . NO CARD . TUE 20:43 LOCAL` where the time is the visitor's real clock, ticking. Below/right: the product window, real DOM week view ~1040px, radius 10, `--rim` + `--shadow-3`, sitting ON the etch. **The etched grid's columns and hour rules run underneath and beyond the window and align pixel-perfect with the real grid inside it** (shared geometry constants, sec 9). Etch annotations around it: `W27` above the week, `07:00 ... 18:00` down the left margin, one dimension `|-- DEEP WORK . 90 MIN --|` under an etched event slot. The window's now-line is live and real.

Load choreography: nav fades 120ms; H1 rises 300ms; etch draws 700ms starting at 200ms, staggered by column; window fades up 400ms starting at 500ms. Complete at 1.3s.

Copy angle: state the thesis as fact. The product places tasks in time; say exactly that.

### 6.3 FIG. 01 — INPUT (smart-input demo)

Eyebrow `FIG. 01 . INPUT` SSM 12 `--etch-text` (figure numbering is a genuine drawing convention and encodes the page's actual sequence). H2: "Type it once. It lands on the grid." Two columns 5/7: left, the REAL `SmartTaskInput` component autotyping a 4s IO-gated loop: `Design review friday 2pm 90min #work`; parsed spans get `--live` 2px underlines + `--live-wash`. Right, a two-column grid fragment (Thu/Fri) where the chip lands. Between them, **etched leader lines** draw (300ms each) from each resolved span to the property it becomes: time span -> chip position, `#work` -> chip color dot, `90min` -> a dimension brace on the chip's height. The parser is shown doing what the brand does: annotating raw text into placed time. Reduced motion: final resolved frame, leader lines pre-drawn.

### 6.4 FIG. 02 — THE GRID (feature callouts)

One sticky product window (right, 58% width, same rim/shadow) stays mounted while four callout blocks scroll past on the left rail; each callout re-states the window (no scroll-jack, plain scroll with IO-triggered state swaps at 250ms):

- 02.A Four views, one grid. Window cycles M/W/D/L; annotation `VIEW: WEEK -> MONTH` SSM.
- 02.B Drag tasks onto time. A sidebar task drags onto Thursday; the dimension annotation `90 MIN` appears mid-drag, exactly as in-app (sec 4.6).
- 02.C Repeats you can read. Recurrence UI fragment; annotation `EVERY WED . 09:30`.
- 02.D Keyboard first. Cmd+K opens inside the window; a keycap cluster (real shortcuts from `useKeyboardShortcuts.ts`) rendered as physical chips.

Each callout: eyebrow `02.A ...` SSM `--etch-text`, H3 GS 24, one sentence GS 15 `--ink-2`. Mobile: window un-sticks and interleaves after each callout.

### 6.5 FIG. 03 — SYNC

Centered. H2: "Your Google events, on the same grid." Diagram 900px: an etched grid (labeled `GOOGLE` SSM) and the real grid converge; etched chips cross over and become inked chips. Mono fact line: `SYNC: GOOGLE CALENDAR . TWO-WAY` — **VERIFY against the shipped sync behavior before writing this line; if sync is one-way or unshipped, the section states exactly what is true or is cut.** Honesty is a material in this system, a false mono line poisons all of them.

### 6.6 Close + footer

Closing block: H2 rhyming with the hero, "Plan it. Place it. Ship the week." + repeated CTA + honesty line. Footer: the **title block**, a hairline-boxed 4-cell grid, bottom-right of the sheet, SSM 11: `TASKFLOW CALENDAR / REV 2026.07 / FREE . SELF-SERVE / MADE FOR THE WEEK` plus minimal link columns (Product, Legal, GitHub if public). No logo walls, no testimonials unless real ones exist. The etch continues beneath the footer at 50% alpha: the drawing does not end at the page.

## 7. Copy voice

Rules:

- Verb-first CTAs that name the outcome ("Start planning free", never "Get started").
- Specific over clever. Numbers, days, and shortcuts are the vocabulary, and they are always mono.
- Mono lines state facts only (times, counts, shortcuts, sync behavior). If it cannot be verified, it is not set in mono.
- No promotional adjectives (seamless, effortless, powerful, supercharge, delightful). No em dashes, no semicolons, ASCII only. No "not X but Y" constructions. Sentence case everywhere except mono annotations, which are uppercase.
- An action keeps its name through the flow: the button "Create event" yields the toast "Event created."
- Errors say what happened and the next step, no apology, no codes ("VALIDATION_ERROR" never reaches a toast again).

Ten samples:

1. H1 primary: `Tasks, placed in time.`
2. H1 alternate: `The week, drawn to scale.`
3. Primary CTA: `Start planning free`
4. Secondary CTA: `Press Cmd+K to try the input`
5. Mono honesty line: `FREE . NO CARD . TUE 20:43 LOCAL` (clock is live and real)
6. Empty task list: `Nothing planned. Press N to add a task.`
7. Empty kanban column: `NO TASKS` (drag-over: `Drop to move here`)
8. FIG. 01 header: `Type it once. It lands on the grid.`
9. FIG. 02.C header: `Repeats you can read.`
10. Completion stamp: `DONE 14:32`

## 8. Cohesion audit: the same decision visible on landing AND in app

1. Dimension annotation: `|-- 90 MIN --|` over the hero's etched event = the duration label that appears while dragging or resizing a calendar chip (4.6). Same SSM 11, same `--live`, same tick-ended lines.
2. The etch as "not yet real": landing background blueprint = app empty states (task list skeleton rows, kanban dashed slot, first-run calendar chip outline). Same `--etch-line` family, two amplitudes by token.
3. Live local time: the hero honesty line's ticking `TUE 20:43` = the now-line's gutter time chip in the app. Same mono, same `--live`, both real clocks.
4. The live-ink law itself: landing CTA, parsed demo spans, hero now-line = app now-line, selection, focus rings, done rings. One hue, one meaning, everywhere.
5. Every numeral is mono: landing dates, facts, figure numbers = app counts, gutters, chip times, stamps. One glance at any surface confirms the same type law.
6. The double-hairline rim: hero product window = app cards, dialogs, popovers, kanban cards. Identical `--rim` token.
7. Draw-on choreography: landing etch draws via stroke-dashoffset at load = the check mark draws on task completion. Same technique, same easing family, both once-per-moment.
8. Today at full finish: the hero window's today column (100% hairlines, live disc date) = the identical treatment in the shipped calendar. The landing screenshot is not a mockup, it is the app's CSS.
9. The title block: landing footer's hairline-boxed fact grid = folder cards' bottom metadata strip and dialog eyebrows. Boxed mono facts as the signature "chrome" unit.
10. Keycap chips: the hero's Cmd+K chip and FIG. 02.D cluster = Cmd+K result-row hints and shortcut chips in-app. Same 20px sunken-chip spec.

## 9. Execution risks and the three hardest details

Prerequisite fixes (blocking, from design-system-map): (a) `@custom-variant dark (&:is(.dark *));` in `index.css` (dark: utilities currently follow OS, not the toggle), retest both modes; (b) strip `hsl(var(--*))` wrappers in `calendar.css`/`index.css` FIRST and visual-diff, dormant styles will resurrect; (c) rescope the `.group/task` transition kill to `.is-dragging`; (d) remove the checkbox `!important` block; (e) delete dead artifacts (`tailwind.config.js` theme, `folder.css`, `ResizableDivider`, template `h1`/light-scheme rules); (f) sweep hardcoded hexes (DueDateBadge, kanban grays, drop-zone strip, TopProgressBar green gradient -> `--live`, spinner).

Hardest three:

1. **Pixel-perfect etch-to-product alignment in the hero, across breakpoints.** Mitigation: one shared TS module exports the grid geometry (column count, hour row height, gutter width); both the SVG etch generator and the product window's CSS grid consume it. Test at 1440/1024/390; below 640 the etch simplifies to hour ticks only (alignment problem removed rather than solved).
2. **The completion choreography under the FullCalendar drag constraints.** TaskItem rows in calendarMode must stay transform-free or drag mirrors ghost. Mitigation: the calendarMode variant of the moment is opacity/clip only (fill via `clip-path` circle inset is also banned, use opacity crossfade); transforms allowed only in non-calendar surfaces; verify drag-to-grid immediately after (the `verify` pass drives a real drag).
3. **The 0.5px rim and etch rendering on 1x displays.** 0.5px box-shadows round to 0 or 1px unpredictably. Mitigation: rims via box-shadow (which subpixel-renders better than borders), plus a `@media (max-resolution: 1.5dppx)` override to 1px at half alpha, so 1x screens get an equivalent weight instead of a missing edge.

Also watch: font self-hosting licensing is fine (ITF FFL + OFL) but General Sans variable must be downloaded from Fontshare, not hotlinked, for the preload strategy; the sync section copy is blocked on verifying real Google sync behavior; the smart-input demo depends on the parser bug (critique bug 2) being fixed, otherwise the landing demos a feature the app cannot perform, which the honesty rule forbids.

## 10. Self-critique pass (frontend-design skill)

Where the first draft drifted generic: **FIG. 02 was originally an alternating left/right feature ladder with static screenshots**, the default SaaS landing pattern that would appear for any product, and even its replacement (sticky window + scrolling callouts) is 2026-common scrollytelling. The fix, now integrated above: the page is one continuous etched sheet, there is exactly ONE product artifact that stays present and changes state, callouts are figure annotations wired to it with drawn leader lines, and the figure numbering is real drawing convention encoding the page's actual sequence. The window never swaps to a different screenshot, it transitions its own live DOM, which no template does.

Second look, Chanel rule (remove one accessory): the folder-card etched progress rows AND the dimension progress line doubled the same idea, the etched rows are cut (sec 4.4 ships only the dimension line + title-block strip). The status ring is borrowed Linear vocabulary, kept deliberately because status glyphs are product convention, and it is made ours by the scheduled dot and the `DONE 14:32` stamp: time-annotated state, which is the thesis.

<!-- ================= SPEC ENDS ================= -->
