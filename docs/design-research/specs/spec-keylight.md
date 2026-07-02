# KEYLIGHT — Taskflow Calendar brand-system specification

Status: implementation-ready. Audience: implementation agents. Sources of truth cross-referenced: `recon/research-landing-2.md` (Concept 1 + register laws), `recon/research-app-ui.md` §7/§9-A ("Instrument Panel+" is locked), `recon/design-system-map.md` (file/line targets), `recon/ui-audit/critique.md` (defects this system must erase). Repo is read-only for design work; all paths cited for the eventual implementation pass.

## 1. Thesis

**The brightest surface is now.** KEYLIGHT is one lighting law applied at two intensities. A calendar's whole job is to answer "where am I in the week?" — so illumination encodes temporal proximity. Today is the brightest column. The now-line is the hottest point in the room. Past events fall into shadow. On the landing page the law is theatrical: the week grid is a glass slab in a dark room and the only light source hangs over the TODAY column. In the app the same law runs at instrument intensity: a 7% indigo film on today, a lit date circle, an indigo now-line with a live mono time label. Nothing on either surface is "decorated with light" — light is always information.

Why native to this product: Taskflow's one differentiating claim is tasks and calendar on one grid ("type a task, drop it on a day"). The moment a task gets placed, it enters time — and time, in this system, is rendered as light. The metaphor is the product mechanic, not a mood board. It also solves three audited defects in one move: the green "today" third-accent mess (critique §3.2), the app's total colorlessness (research-app-ui §0), and the landing/app identity split (rainbow auth vs zinc interior, critique §3.1) — one key, indigo `#5e6ad2`, spent as light everywhere.

## 2. Shared token table

Canonical format: oklch (Tailwind v4 `@theme` in `src/index.css`); hex given for handoff. All dark:variant utilities require the `@custom-variant dark (&:is(.dark *));` fix first (design-system-map §2) or these tokens sit on sand.

### 2.1 Core surfaces and ink

| Token                                                | Dark ("the room")                | Light ("the studio")             | Notes                                                                                                  |
| ---------------------------------------------------- | -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--bg` (canvas/chrome)                               | `oklch(0.155 0.009 274)` #0B0C10 | `oklch(0.976 0.003 90)` #F7F7F5  | Page + sidebar. Light canvas is deliberately NOT white — white is reserved for lit surfaces (see 2.4). |
| `--surface` (cards, panels, the slab)                | `oklch(0.182 0.009 264)` #101216 | `oklch(1 0 0)` #FFFFFF           |                                                                                                        |
| `--surface-raised` (hover, raised rows)              | `oklch(0.205 0.010 268)` #15171C | `oklch(0.985 0.001 90)` #FAFAF9  | Light hover uses wash instead: `rgba(22,23,29,0.03)`.                                                  |
| `--overlay` (popover, dialog, Cmd+K)                 | `oklch(0.230 0.012 264)` #1A1D23 | #FFFFFF                          | Light overlays differentiate via penumbra, not color.                                                  |
| `--recess` (kanban column bg, wells)                 | `oklch(0.173 0.009 264)` #0E1014 | `oklch(0.966 0.003 90)` #F2F2EF  |                                                                                                        |
| `--grid-bg` (calendar slot area)                     | #0B0C10 (= bg)                   | `oklch(0.985 0.001 90)` #FAFAF9  | Light grid is faint gray so today can be white.                                                        |
| `--ink`                                              | `oklch(0.978 0.001 0)` #F7F8F8   | `oklch(0.206 0.012 278)` #16171D |                                                                                                        |
| `--ink-secondary`                                    | `oklch(0.874 0.015 261)` #D0D6E0 | `oklch(0.42 0.012 270)` #494C55  |                                                                                                        |
| `--muted-fg`                                         | `oklch(0.649 0.015 262)` #8A8F98 | `oklch(0.509 0.012 262)` #62666D | 12px meta passes 4.5:1 on its surfaces in both themes.                                                 |
| `--faint-fg` (placeholders, disabled)                | `oklch(0.509 0.012 262)` #62666D | #8A8F98                          | Never for content.                                                                                     |
| `--hairline`                                         | `oklch(0.264 0.010 268)` #23252A | `oklch(0.924 0.004 90)` #E6E6E3  | ~6% lightness delta from surface, per Linear discipline.                                               |
| `--hairline-strong` (inputs, dividers under headers) | `oklch(0.313 0.013 267)` #2E3138 | `oklch(0.87 0.005 90)` #D9D9D5   |                                                                                                        |

### 2.2 The key (theme-independent hue, theme-dependent films)

| Token              | Dark                                                                     | Light                                             | Use                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--key`            | `oklch(0.567 0.159 275)` #5E6AD2                                         | same                                              | The one accent. Solid fills allowed on exactly four things: primary CTA, today date circle, done status ring, now-line. Everywhere else, films. |
| `--key-hover`      | `oklch(0.62 0.16 275)` ≈ #6B77E0                                         | `oklch(0.511 0.167 274)` #4C58C4                  | Dark brightens toward the light; light deepens.                                                                                                 |
| `--key-ink`        | #FFFFFF on key                                                           | #FFFFFF                                           | Text on solid key.                                                                                                                              |
| `--key-wash-app`   | `color-mix(in oklch, var(--key) 7%, transparent)`                        | `color-mix(in oklch, var(--key) 3%, transparent)` | Today column, selected rows, drop targets.                                                                                                      |
| `--key-wash-stage` | `...16%, transparent)`                                                   | `...8%, transparent)`                             | Landing hero only. Stage = app x2.                                                                                                              |
| `--key-rim`        | `rgba(94,106,210,0.28)`                                                  | `rgba(94,106,210,0.25)`                           | Today column hairlines, Cmd+K panel ring.                                                                                                       |
| `--key-rim-strong` | `rgba(94,106,210,0.44)`                                                  | `rgba(94,106,210,0.40)`                           | Hero slab rim at the lit column, focus-within on auth card.                                                                                     |
| `--key-glow`       | `rgba(94,106,210,0.12)`                                                  | `rgba(94,106,210,0.08)`                           | Large blurred halos (hero slab, now-dot).                                                                                                       |
| `--focus-ring`     | `2px solid color-mix(in oklch, var(--key) 55%, transparent)`, offset 1px | same                                              | Focus IS the light. Applies to task rows, chips, folder tiles, kanban cards too (critique: custom surfaces had no focus).                       |

### 2.3 Light-physics set (rims, penumbra, floor-line, grain)

Physics rule, stated once and obeyed everywhere: **dark room — elevation moves a surface closer to the key light, so higher = lighter surface + brighter top rim + deeper occlusion below. White studio — light is ambient, so elevation reads through shadow depth only; surfaces stay white, rims stay machined.**

| Token                                                            | Dark                                                                                                                                                                                           | Light                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--rim-1` (cards at rest)                                        | `inset 0 0.5px 0 rgba(247,248,248,0.04)`                                                                                                                                                       | `inset 0 0.5px 0 rgba(255,255,255,0.9)`                                                                              |
| `--rim-2` (popovers)                                             | `inset 0 0.5px 0 rgba(247,248,248,0.06)`                                                                                                                                                       | same as light rim-1                                                                                                  |
| `--rim-3` (dialogs, drag overlays, hero slab)                    | `inset 0 0.5px 0 rgba(247,248,248,0.09)`                                                                                                                                                       | same                                                                                                                 |
| `--hairline-double` (Clerk material, on every card/panel/dialog) | `inset 0 0 0 0.5px rgba(255,255,255,0.06), 0 0 0 0.5px rgba(4,5,8,0.8)`                                                                                                                        | `inset 0 0 0 0.5px rgba(255,255,255,0.9), 0 0 0 0.5px rgba(22,23,29,0.13)`                                           |
| `--penumbra-1` (cards)                                           | `0 1px 2px rgba(0,0,0,0.45), 0 3px 8px -2px rgba(0,0,0,0.35)`                                                                                                                                  | `0 0.6px 1.5px -1px rgba(22,23,29,0.10), 0 2px 5px -2px rgba(22,23,29,0.07), 0 8px 20px -8px rgba(22,23,29,0.03)`    |
| `--penumbra-2` (popovers, dropdowns, sheets)                     | `0 2px 4px rgba(0,0,0,0.5), 0 8px 20px -4px rgba(0,0,0,0.45)`                                                                                                                                  | `0 1px 2px -1px rgba(22,23,29,0.12), 0 4px 10px -3px rgba(22,23,29,0.09), 0 16px 32px -10px rgba(22,23,29,0.05)`     |
| `--penumbra-3` (dialogs, Cmd+K, drag overlay, hero slab)         | `0 4px 10px rgba(0,0,0,0.55), 0 24px 60px -12px rgba(0,0,0,0.6)`                                                                                                                               | `0 1.5px 3px -1.5px rgba(22,23,29,0.14), 0 8px 20px -6px rgba(22,23,29,0.10), 0 32px 64px -16px rgba(22,23,29,0.06)` |
| Elevation recipe                                                 | `box-shadow: var(--rim-N), var(--hairline-double), var(--penumbra-N)`                                                                                                                          | same composition, light values                                                                                       |
| `--floor-line`                                                   | `linear-gradient(90deg, transparent, rgba(138,143,152,0.5) 50%, transparent)`, height 1px                                                                                                      | `linear-gradient(90deg, transparent, rgba(22,23,29,0.22) 50%, transparent)`                                          |
| Hero slab extra (landing only)                                   | append `0 0 80px -20px var(--key-glow)`                                                                                                                                                        | append nothing (studio has no colored spill)                                                                         |
| `--grain`                                                        | SVG feTurbulence data-URI: `fractalNoise`, baseFrequency 0.9, numOctaves 2, 128px tile, rendered on a `::before` covering the ROOM background only, `opacity: 0.04`, `mix-blend-mode: overlay` | **none** (studio is clean paper — deliberate accessory removal, see §10)                                             |
| Grain scope rule                                                 | Landing room walls + auth page background only. Never on any product surface, never anywhere in the app interior.                                                                              | —                                                                                                                    |

### 2.4 Today-column set (the brand in-app; full spec in §4.5)

| Token              | Dark                                                                              | Light                                                                           |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `--today-col-bg`   | `--key-wash-app` over `--grid-bg`                                                 | `oklch(1 0 0)` #FFFFFF + `color-mix(in oklch, var(--key) 3%, transparent)` film |
| `--today-cone`     | `linear-gradient(180deg, rgba(94,106,210,0.10), transparent 120px)` top of column | none (white IS the light)                                                       |
| `--today-hairline` | `--key-rim` on the column's left/right borders                                    | `rgba(94,106,210,0.25)`                                                         |
| `--now-line`       | `2px solid var(--key)` + glow `0 0 12px rgba(94,106,210,0.5)`                     | `2px solid var(--key)` + glow `0 0 8px rgba(94,106,210,0.35)`                   |

### 2.5 Status + data color

| Token                                                 | Value                                                                                                                                                                                                 | Notes                                                                                                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--destructive`                                       | keep existing `oklch(0.577 0.245 27)` ≈ #DC2626; dark text-on-dark variant `oklch(0.68 0.19 25)`                                                                                                      | Overdue, delete.                                                                                                                                                                                      |
| `--success`                                           | keep `oklch(0.6 0.15 145)`                                                                                                                                                                            | Toasts/confirmation ONLY. Green is fired from "today" duty entirely (kills critique's two-greens bug, calendar.css:61-71,106,117).                                                                    |
| Kanban status                                         | glyph-only, no hue: todo = hairline ring, in-progress = key arc, done = filled key                                                                                                                    | Removes amber/emerald hardcodes (TaskKanbanBoard.tsx:34-77).                                                                                                                                          |
| User color palette (lists/calendars/tags), 12 curated | `oklch(0.65 0.14 H)` for H = 25 #D76963, 55 #CF752D, 85 #B68700, 115 #8D9819, 145 #51A556, 175 #00AA8A, 205 #00A6B7, 235 #009BD8, 305 #A377D3, 335 #C26BB1, plus warm gray #998D83, cool gray #8D8E98 | Equal-lightness by construction. The 255–295 hue band is excluded so no user color impersonates the key. Replaces raw Tailwind-500 swatches in both pickers (unifies the two dialogs, critique §3.9). |
| Chip recipe (any stored color C, incl. legacy hexes)  | bg `color-mix(in oklab, C 14%, transparent)`, bar/dot `C`, text light: `C`; text dark: `oklch(from C clamp(0.72, l, 0.82) min(c, 0.13) h)`                                                            | One formula for event chips, tag pills, list dots. Fallback for non-RCS browsers: precompute per palette entry.                                                                                       |
| Past-event shadow                                     | `opacity: 0.55; filter: saturate(0.6)`                                                                                                                                                                | "Before now falls into shadow." Applied by comparing event end < now.                                                                                                                                 |

Also swept when tokens land (design-system-map §13 hardcode list): DueDateBadge hexes, TaskFocusPane drop-strip colors, ThemeProvider blue spinner → key, TopProgressBar green gradient → `linear-gradient(90deg, transparent, var(--key))`, themeStore meta theme-color → #0B0C10/#F7F7F5, smart-tags fallback #3b82f6 → key.

## 3. Type roles

Three faces, three jobs: **Schibsted Grotesk** speaks (display), **General Sans** works (UI/body), **Spline Sans Mono** measures (time, counts, keys). Inter is removed entirely (including the double Google-Fonts fetch, index.html:8-10 + index.css:2).

| Role                            | Face / weight                          | Size / line-height                  | Tracking / case           | Where                                                                                                                                                      |
| ------------------------------- | -------------------------------------- | ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero display                    | Schibsted Grotesk 500                  | 64px/1.02 desktop, 40px/1.05 mobile | -0.03em                   | Landing H1 only                                                                                                                                            |
| Landing H2                      | Schibsted Grotesk 500                  | 40px/1.1                            | -0.02em                   | Section heads                                                                                                                                              |
| Product display                 | Schibsted Grotesk 500                  | 24–28px/1.1                         | -0.02em                   | Day-view date numeral, empty-state headings, onboarding. The ONLY app surfaces where the display face appears.                                             |
| Feature title / dialog title    | General Sans 600                       | 20px landing, 15px app /1.3         | -0.01em                   |                                                                                                                                                            |
| View title                      | General Sans 600 + 400                 | 16px/1.25                           | -0.01em                   | "**July** 2026" keeps bold-month/regular-year, now applied in Day/List titles too (fixes inconsistency, critique §3.2)                                     |
| Landing body                    | General Sans 400                       | 17px/1.6                            | 0                         | Subheads, feature copy                                                                                                                                     |
| App UI base                     | General Sans 500 (titles) / 400 (body) | 13px/1.4                            | 0                         | Task titles, buttons, inputs, menus                                                                                                                        |
| App meta                        | General Sans 400                       | 12px/1.35                           | 0, `--muted-fg`           | Second lines, descriptions                                                                                                                                 |
| Section label                   | General Sans 600                       | 11px/1                              | +0.06em, uppercase, muted | Sidebar groups, kanban "column of" labels                                                                                                                  |
| Time / date digits / counts     | Spline Sans Mono 400                   | 11–12px/1                           | 0                         | Gutter labels (lowercase "9 am"), chip times, due chips, sidebar counts, now-label. Mono is inherently tabular — this IS the numerals system (Clerk move). |
| Eyebrow / ticker / honesty line | Spline Sans Mono 500                   | 12px/1                              | +0.08em, uppercase        | Landing eyebrows, CTA microcopy, footer facts                                                                                                              |
| Kbd hints                       | Spline Sans Mono 400                   | 11px/1                              | 0                         | 18px-tall chips, radius 4, hairline border, `--recess` bg                                                                                                  |

Loading strategy: self-host all three as variable woff2 in `/public/fonts` (Fontshare license permits General Sans self-hosting; the other two are Google/OFL). `font-display: swap` + metric-compatible fallbacks (`@font-face` override descriptors — generate `size-adjust`/`ascent-override`/`descent-override` with fontaine or capsize against Arial for General Sans and Schibsted, Courier New for Spline) so the swap doesn't reflow row heights. Landing preloads: Schibsted 500 latin subset + General Sans 400/500/600 subset + Spline 400 (budget ≤160KB total). App preloads General Sans + Spline only; Schibsted loads lazily (used only in empty states/date numerals, so a swap there is invisible). Set `--font-sans`, `--font-display`, `--font-mono` in `@theme`; body 13px General Sans replaces the `:root` Inter stack (index.css:9-19).

## 4. The light language, surface by surface (app)

Global prerequisites from design-system-map: strip `hsl(var(--*))` wrappers in calendar.css/index.css first, add the dark custom-variant, delete Vite-template `h1`/light-scheme leftovers (index.css:95-108), retire tailwind.config.js grays.

### 4.1 TaskItem anatomy (`TaskItem.tsx`)

```
|<-10px->|(16px status ring)|<-8->|Title 13/500..................|meta →|(⋯ 24px)|<-10->|
|        |                  |     |due chip 11 mono · list dot+name 12 · tags(≤2)+N     |
```

- Row: min-height 36px, padding 6px 10px, radius 6px. Second line renders only when data exists; row stays 36px single-line otherwise (kills the current "circle + sentence in 1100px of white", critique §3.4).
- Hover: `--surface-raised` (dark) / `rgba(22,23,29,0.03)` (light), instant on / 150ms off; action icons (schedule, menu) fade in opacity-only, absolutely positioned right, `@media (hover:hover)` gated. Drag grip (6-dot, 16px reserved gutter) appears on hover in list panes.
- Selected: `--key-wash-app` bg + 2px inset left bar `--key` (light on the edge of the lit row, not a border box).
- Due-chip proximity = brightness, on-law: overdue `--destructive`; today `--key`; this week `--ink-secondary`; later `--muted-fg`. No Todoist rainbow.
- Completed: ring filled key, title `--muted-fg` + strikethrough, row opacity 0.6 (replace the dead template-literal `opacity-[${...}]` class, TaskItem.tsx:388).
- calendarMode constraint honored: rows draggable into FullCalendar must keep `transition/transform: none` (index.css:599-607) — completion there uses fade-only variant (§5).
- Keyboard: rows focusable, `--focus-ring`, j/k navigation reserved.

### 4.2 Status rings + the completion moment

Ring: 16px SVG circle, 1.5px stroke, full-round. States: **todo** stroke `--hairline-strong`; **in-progress** todo ring + key arc sweeping 25/50/75%; **done** filled `--key`, 10px white check; **canceled** `--muted-fg` ring + x. The ring is a light meter: work moves toward full illumination. (Differentiation from Linear's pie: no yellow, arc is the key hue, done = lit.)

Completion timeline (the app's ONE delight animation — signature budget spent here):

- t0 press: ring scale 0.9, 60ms
- t60: key fill scales from center, 140ms; check strokes in (dashoffset), 160ms starting t120
- t150: strikethrough draws left→right 200ms, title → muted
- t200: light pass — row bg flashes `color-mix(in oklch, var(--key) 10%, transparent)` and decays to 0 over 500ms ("the light acknowledges it")
- t800: hold (Things grace window; mis-tap recovery)
- t800–1050: content fades 200ms, then row collapses via `grid-template-rows 1fr→0fr` 250ms ease-out (height animation via the sanctioned grid-rows trick only)
- Toast: "Done. Undo" (5s).
  Keyboard-initiated completion: no flash, 150ms fade only (never animate 100x/day keyboard actions). calendarMode: ring fill + 200ms fade, no slide. Reduced motion: instant state + 150ms opacity.

### 4.3 Folder cards (`TaskFolderGrid.tsx` + `new-folder.css` — full replacement)

Kill the manila clip-path tab (renders as a detached floating bar, critique §3.5). New object: the **gel tile** — the list's color is a lighting gel laid on a slab.

- Grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap 16px, tiles 4:3.
- Tile: `--surface`, radius 10, `--rim-1 + --hairline-double + --penumbra-1`. Top edge: 3px full-width strip in list color (top corners inherit radius).
- Content, 14px padding: 32px icon tile (radius 8, bg `color-mix(in oklab, C 12%, transparent)`, lucide folder-open 16px in C — no 📁 emoji), name 14/600 `--ink`, bottom row: count in mono 12 muted ("3 tasks · 1 done").
- Hover: translateY(-2px) 150ms + `--penumbra-2` + gel glow `0 4px 16px -6px color-mix(in oklab, C 35%, transparent)`; body crossfades (150ms, icon → first 3 task titles 12px muted, single-exposure — name and strip never move, fixing the double-exposure bug).
- New-list tile: dashed 1.5px `--hairline-strong`, plus icon, no strip, no ghost tab.
- Click → kanban: breadcrumb "Folders / Work" appears in TaskControls with a back chevron (fixes no-way-back, critique §3.5/3.6). Tiles are real buttons with `--focus-ring`.

### 4.4 Kanban (`TaskKanbanBoard.tsx`)

- Columns: no vertical borders — 12px gutters; column body bg `--recess`, radius 8. Header 40px: status ring glyph 14px + name 13/600 `--ink` + count mono 12 `--muted-fg` (plain text, not a badge). One visual treatment for all three headers.
- Cards: `--surface`, radius 8, padding 12px, `--rim-1 + --hairline-double + --penumbra-1`. Row 1: list dot 6px + name 11 muted; Row 2: title 13/500, 2-line clamp; Row 3: due chip mono 11 + priority glyph (grays, glyph-only). Gray-500 borders and status-tinted card fills are gone; the card is a lit object, the column is a recess.
- Drag: overlay scale 1.03 + 2° tilt + `--penumbra-3` + rim brightened to rim-3 ("picked up into the light"); vacated slot dims to 40%; target gap animates open 180ms; drop = spring `{duration: 0.5, bounce: 0.2}`. Drop target (empty column while dragging): `--key-wash-app` + 1.5px dashed `--key-rim` full height.
- Empty column at rest: header with count "0", body empty except a ghost "+ New task" row (32px, muted, hover reveals).
- Menu: replace Schedule-no-op (TaskKanbanBoard.tsx:329,388) with a working date popover; add Edit and Move-to-list items.
- Mobile: `snap-x snap-mandatory`, next column peeks 24px, pager dots 6px under the board (active dot = key).

### 4.5 Calendar grid — the today treatment IS the brand

Geometry: hour slot 48px (24px per :30, half-hour line at 50% hairline opacity), gutter 56px, day header 56px, all-day lane min 28px.

- **Today column (week + month views):** bg `--today-col-bg`; dark adds `--today-cone` (120px falloff from the top — the light hangs above); both left/right column hairlines switch to `--today-hairline`. The all-day lane and header cell are EXCLUDED from the wash (the flood-fill was an audited defect). **Day view (single column): no wash at all** — the header circle + now-line carry today, preventing the whole-grid flood (critique §3.2).
- **Header date circle:** 24px fixed circle (width AND height locked — fixes the squished-sliver bug), filled `--key`, white mono numeral 12px; day name 11px mono uppercase above it, `--ink` for today / `--muted-fg` otherwise. Non-today dates: plain 12px mono `--ink-secondary`, no circle. Same treatment in mini-month and mobile day strip.
- **Now-line:** 2px `--key` across today's column only + `--now-line` glow; 6px dot at the column's left edge, glow `0 0 0 3px rgba(94,106,210,0.15)`; faint 1px continuation across other visible days at `rgba(94,106,210,0.12)`. In the gutter, the live time replaces the axis label it overlaps: mono 10px `--key` on a 2px-padded `--grid-bg` chip. Dot breathes (opacity 0.75↔1, 4s) — the app's only ambient motion.
- **Event chips:** recipe from §2.5 — 14% tint bg, 3px left bar, colored 12/500 title + 11 mono time on line two (line one only if <30min: "9:30 title"), radius 5px, no shadow at rest. Hover: bg to 20%, 150ms. Selected/dragging: solid C, white text, `--penumbra-2`. Past events: shadow rule (0.55 opacity, saturate 0.6). All-day bars: 20% tint, radius only on terminating ends. Replaces flat #3b82f6 white-text blocks and the "time - time - title" concatenation (title first, time second line).
- Weekends: 2% neutral wash. Month view: day numbers mono 12 right-top, "+N more" affordance styled as an 11px mono muted link.
- Delete the green today tokens (`--fc-today-bg-color` greens, `.day-header-number.today` green, the out-of-gamut `oklch(0.7 0.3 140)` pill).

### 4.6 Dialogs and sheets

- Overlay: dark `rgba(4,5,8,0.65)`, light `rgba(22,23,29,0.35)`. No backdrop blur here (reserved for Cmd+K).
- Dialog: `--overlay` surface, radius 12, padding 20px, `--rim-3 + --hairline-double + --penumbra-3`; title 15/600, description 13 muted; footer separated by `--hairline`, primary button right, destructive actions get filled `--destructive`. Enter 250ms `cubic-bezier(0.23,1,0.32,1)` scale 0.98→1 + fade; exit 180ms.
- Sheet (peek mode): 420px, same material, `cubic-bezier(0.32,0.72,0,1)` 300ms in / 250ms out. Keep the dual Sheet/Dialog peek-mode mount.
- <640px: all dialogs become full-width bottom sheets, max-height 92vh, fields stack single-column (fixes the clipped mobile Create Event, critique §3.9).
- Unify Create Calendar / Create List into one layout (icon-or-emoji tile + name input, the §2.5 12-swatch picker at 24px circles); fix "Create Task" → "Create list" button copy.

### 4.7 Cmd+K — the light switch

Opening the palette re-performs the hero: the room goes dark, the brightest surface in the app appears.

- Overlay: dialog overlay + `backdrop-filter: blur(8px)` (the one sanctioned blur).
- Panel: 560px wide, top 20vh, `--overlay` surface, radius 12, `--rim-3 + --hairline-double + --penumbra-3` + outer ring `0 0 0 1px var(--key-rim)` — the only always-on key rim in the app.
- Input row 52px, 15px General Sans, placeholder "Type a command or search" in `--faint-fg`. Result rows 36px: icon 16px, label 13/500, right-aligned kbd chips. Group labels 11px mono uppercase muted. Selected row: `--key-wash-app` + left bar (same tokens as selected TaskItem).
- Enter 150ms scale 0.98→1 + fade; exit 100ms fade. Navigation between results: no animation.
- Wire the existing `ui/command.tsx` (cmdk); seed commands: new task, new event, go to today, switch view (D/W/M/L), toggle theme, open settings. Global keys: `T` today, `D/W/M` views, `N` new task, `/` focus smart input.

### 4.8 Empty states

Pattern: 32px CSS-drawn glyph — five 4px vertical bars (the week), fourth bar in `--key-wash-stage` with a 2px key segment (the lit column; product-derived, no stock icon) — then Schibsted 18/500 heading, one 13px muted line, one verb-first secondary button. Copy set:

- Calendar week: "Nothing scheduled this week." / "Drag a task in or press N." [New event]
- Task list: "No tasks yet." / "Add one and give it a time." [Add task]
- Kanban column: 13px mono muted "Drop tasks here", vertically centered in the visible column height (not the top third).
- Search/Cmd+K: "No matches." / "Try fewer words."
- New account (replaces "No tasks match the current filters" on a fresh account): "Your week is empty." / "Start with the thing you keep putting off." [Add task]

### 4.9 Auth screens (landing↔app hinge)

Replace the rainbow conic gradient and the green cursor-glow (index.css:623-753) with the room: dark `--bg` + grain ::before, centered card = slab (`--surface`, radius 12, rim-3 recipe), `--key-rim-strong` on focus-within. Light theme: studio equivalent. Primary button: filled `--key` (the screens finally get a primary; critique §3.1). Floor-line under the card. Same fonts as app.

### 4.10 Mobile (390px)

- Day view default; horizontal date strip with mono day letters + date circles, today filled key.
- Tap targets ≥44px; row height 44px on touch; hover-only affordances get visible equivalents (⋯ always rendered at 40% opacity on touch devices).
- Shadows drop one tier (penumbra-3 → 2) for GPU economy; cone gradient off; grain off (it's landing-only anyway).
- Settings modal collapses to single pane with a nav list → detail push (fixes critique §3.10); sheets full-screen.
- Sidebar drawer 22rem unchanged; view switcher gets full labels in a bottom sheet instead of "M W D L" cryptic caps.

## 5. Motion grammar

Tokens in `@theme`: `--dur-fast: 120ms; --dur-med: 200ms; --dur-slow: 300ms; --ease-out: cubic-bezier(0.25,1,0.5,1); --ease-out-strong: cubic-bezier(0.23,1,0.32,1); --ease-sheet: cubic-bezier(0.32,0.72,0,1)`.

| Pattern                  | Duration / easing                                                                  | Notes                 |
| ------------------------ | ---------------------------------------------------------------------------------- | --------------------- |
| Hover                    | 0 on / 150ms off, ease-out                                                         | bg + opacity only     |
| Press                    | 120ms, scale 0.97                                                                  | buttons, chips        |
| Tooltip                  | 150ms fade                                                                         |                       |
| Popover/dropdown         | 180ms in / 120ms out, ease-out, translateY 4px + fade, transform-origin at trigger |                       |
| Dialog                   | 250/180ms, --ease-out-strong, scale 0.98                                           |                       |
| Sheet                    | 300/250ms, --ease-sheet                                                            |                       |
| List entrance            | 200ms fade + scale 0.97, stagger 40ms, cap 8 items                                 |                       |
| Reorder / kanban drop    | spring duration 0.5 bounce 0.2                                                     | dnd-kit dropAnimation |
| Completion               | timeline §4.2                                                                      | the one delight       |
| View/keyboard navigation | none                                                                               | instant, always       |

Hard rules: transform/opacity only (height only via grid-rows), never ease-in, never `transition: all`, hover gated `@media (hover:hover) and (pointer:fine)`, keyboard-initiated = no animation.

Light-specific choreography:

- **Switch-on (landing hero):** t0 room + H1 painted (H1 is the LCP, pure text). t200 slab: translateY 24→0, blur 12→0, opacity 0→1, 600ms `cubic-bezier(0.22,1,0.36,1)`. t400 key light: registered `@property --cone-o` 0→1 over 800ms with a bloom keyframe (`filter: brightness(1.08)` at 60% on the light layer only). t1000 floor-line fades in 300ms. Everything done at 1.3s (<1.6s budget).
- **Breathe (landing ambient):** light layers opacity 0.94↔1.0, 8s ease-in-out alternate, compositor-only. App equivalent: only the now-dot (§4.5).
- **Scroll-sweep (landing features):** sticky grid stage; cone translateX maps scroll progress across Mon→Fri via CSS scroll-driven animation (`animation-timeline: view()`); the lit column's chips go 0.55→1 opacity. Fallback (no scroll-timeline support): IntersectionObserver toggles `.lit-mon`…`.lit-fri`, 300ms transitions. Never scroll-jacked — native scroll speed throughout.
- **Reduced motion (`prefers-reduced-motion`):** all ambient loops off, cone rendered at final state fixed on today, sweep replaced by static lit-today grid, completion = instant + 150ms fade, entrances = simple fades. Every piece of content reachable with zero motion.

## 6. Landing page, section by section

Container: content max-width 1120px, letterbox side margins ≥48px desktop (the room's matte). Nav 56px: wordmark left (General Sans 600), links mono 12 uppercase, right: "Sign in" ghost + "Start planning" filled key with kbd chip `⏎`.

1. **Hero — the dark room** (100vh). Left-aligned H1 "Your week, placed." (Schibsted 64) over the room; one-sentence sub (General Sans 17); CTA "Start planning" + mono honesty line beneath: "FREE · SYNCS WITH GOOGLE CALENDAR · TUE 20:43" (live local time, real weekday). Below: the slab — the REAL DOM week grid (Mon–Fri, seeded believable events using the §2.5 chip recipe), rim-3 material, key light on the visitor's actual today column at `--key-wash-stage`, floor-line beneath. Motion: switch-on then breathe. Copy angle: state the object, let the light argue.
2. **Honesty strip.** One row, mono 12 uppercase, real facts: "4 CALENDAR VIEWS · NATURAL LANGUAGE DATES · REPEATING TASKS · GOOGLE SYNC". Static (ticker reserved for footer; one ambient loop per viewport max). No logo bar, no fake counts.
3. **Feature sweep — Mon→Fri** (the core scroll section). Sticky slab on the right (55% width), five copy blocks scroll on the left; the key light sweeps one column per block, and the block's feature demos in the lit column: **Mon** smart input (typed text, parse spans underline in key, task lands on the grid — 4s IO-gated loop on real DOM); **Tue** drag task→grid (chip arcs into a slot); **Wed** views (grid morphs W→D→M in the slab); **Thu** recurrence (chip stamps repeating copies down the column); **Fri** Google sync (second calendar's chips fade in with a different gel color). Day order = feature order: the sequence is real, so the structure earns itself. Copy angle: one verb-first claim per day + one concrete example line.
4. **The studio — light mode reveal.** Full-bleed self-contained section with `--bg` light values: the same slab, white studio, graphite penumbra, today column white with indigo rim. Two-up theme toggle rendered as the actual Settings control. Copy: "Both rooms, one light. Today stays the brightest column in either theme." Angle: theme parity as a demonstrated fact, not a bullet. (Page chrome does NOT flip — the section carries its own background.)
5. **The completion moment.** Centered single TaskItem at 1.5x scale runs the §4.2 timeline once per viewport entry. Copy: "Check it off. Done tasks step out of the way." Under it, mono: "UNDO STAYS FOR 5 SECONDS."
6. **Keyboard.** Dark section, a 3x4 grid of kbd caps (mono, --recess chips) with their actions; Cmd+K panel rendered as a physical card (rim-3). Copy: "Press Cmd K and type where you want to go."
7. **Closing — the room again.** H2 rhymes with the H1: "Everything has a time. Set yours." CTA "Start planning" + honesty microcopy "Free. No card." Floor-line below, then footer.
8. **Footer.** Mono 12, the one marquee (45s linear, pauses on hover/reduced-motion): the honesty facts + live "IT IS TUE 20:43 IN YOUR TIMEZONE". Links, theme toggle, wordmark.

Perf posture: slab is crawlable DOM (LCP = H1 text), grain is a ~200-byte data-URI, no WebGL/video/raster in the fold, fold weight <500KB, Lighthouse perf ≥0.95 / a11y = 1.0 targets stand.

## 7. Copy voice

Rules (enforced, not aspirational):

1. Sentence case everywhere except mono eyebrows/tickers (uppercase is a mono-only privilege).
2. Verb-first CTAs that name the action's object: "Start planning", "Add task", "New event". A flow keeps one name end to end (Publish → "Published").
3. Name what users control: week, task, day, grid, list. Never parser, NL engine, modal, RRULE.
4. Claims must be checkable this session: live clock, real feature counts, "Free. No card." No superlatives, no promotional adjectives (powerful, seamless, beautiful, magical are banned strings).
5. No em dashes, no semicolons, ASCII apostrophes only, no "not X but Y" constructions.
6. Errors: what happened + the fix, no apology, no internal codes (kills the raw "VALIDATION_ERROR" toasts).
7. Empty states invite one action.
8. h2s ≤ 6 words. Microcopy ≤ 10.

Ten sample lines (final copy, ready to ship):

1. H1: "Your week, placed."
2. Hero sub: "Taskflow is a task list and a calendar on one grid. Type a task, drop it on a day, and it has a time."
3. CTA + microcopy: "Start planning" / "FREE · SYNCS WITH GOOGLE CALENDAR · TUE 20:43"
4. Mon block: "Type it the way you say it. Ship the report friday 4pm lands on Friday at 4."
5. Tue block: "Drag a task onto the grid and it becomes time."
6. Today: "Today is the brightest column. You always know where you stand."
7. Keyboard: "Press Cmd K and type where you want to go."
8. Empty week: "Nothing scheduled this week. Drag a task in or press N."
9. Completion toast: "Done. Undo"
10. Closing: "Everything has a time. Set yours."

## 8. Cohesion audit — 10 landing↔app pairs

| #   | Landing                                                               | App                                                                             | Shared material                                                                                       |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Key light over the hero slab's today column (`--key-wash-stage`, 16%) | Today-column wash (`--key-wash-app`, 7%) + cone + brightened hairlines          | Same hue, same film construction, one variable apart. The landing is the app at stage intensity.      |
| 2   | Floor light-line under the slab                                       | Now-line + glow + gutter time chip                                              | Both are "where the light touches now": same gradient family, same key glow tokens.                   |
| 3   | Slab rim: `--rim-3 + --hairline-double + --penumbra-3`                | Identical recipe on dialogs, Cmd+K, drag overlays; rim-1 on every card          | One machined material system, three elevations.                                                       |
| 4   | Switch-on: room dims, the lit object appears                          | Cmd+K: overlay dims the app, the key-rimmed panel appears                       | Same dramaturgy, same overlay color, same 150ms/ease tokens.                                          |
| 5   | Hero honesty line with live local time (mono, key)                    | Live time label at the now-line gutter (mono, key)                              | The brand tells the actual time in both places, same face and size.                                   |
| 6   | Scroll-sweep lights Mon→Fri                                           | Arrow-key day navigation flashes a 200ms `--key-wash-app` on the focused column | Light follows attention in both.                                                                      |
| 7   | Studio section: light mode shown as the same room inverted            | Theme toggle: dark = elevation gets lighter, light = today gets whiter          | One inversion law ("white is the light in the studio") stated in tokens, demonstrated on the landing. |
| 8   | Completion demo (section 5)                                           | Real completion moment                                                          | Byte-identical timeline and tokens; the demo IS the spec.                                             |
| 9   | Schibsted hero + section heads                                        | Schibsted only at empty-state headings and the day-view date numeral            | The display face appears exactly where the product speaks, both sides.                                |
| 10  | Slab event chips (14% film, 3px bar, past-in-shadow)                  | Real calendar chips, tag pills, list dots                                       | One chip formula; the hero screenshot can be diffed against the app.                                  |

Bonus invariant: `--focus-ring` is the key at 55% everywhere — on the landing's CTAs and in every app surface, focus is literally where the light is.

## 9. Execution risks + three hardest details

Hardest three, with mitigations:

1. **Light-mode believability** (the craft bar). You cannot out-bright white — so the studio law makes white itself the light: canvas #F7F7F5, grid #FAFAF9, today #FFFFFF + 3% film + indigo hairlines, elevation via graphite penumbra only. Mitigation protocol: build the light week view first; screenshot at 1440; pass criteria (a) today identifiable inside 2s squint test, (b) oklch L delta today-vs-neighbor ≥0.015 measured off the screenshot, (c) chips at 14% still read on #FFFFFF, (d) penumbra-1 visible on #FAFAF9 but invisible in a print-grayscale check of text zones. If (a) fails, raise film to 4% and hairline alpha to 0.32 before touching anything else — never add a colored border box.
2. **Always-on today subtlety.** Too strong = ugly colored column; too weak = no brand. Caps are hard: 7% dark / 3% light, wash excluded from all-day lane + header, Day view gets no wash at all (the audited flood). A/B against `calendar-week-1440.png` and `calendar-week-dark-1440.png` baselines; the wash must survive JPEG screenshots (that is where users judge it).
3. **Alpha films over arbitrary user colors.** Chips are data-driven hexes (legacy #3b82f6 etc.), not tokens. The §2.5 recipe must be applied in `eventContent` render hooks + inline style vars, with the dark-text lightening via relative color syntax and a precomputed fallback map for the 12 curated swatches; legacy colors go through the same `color-mix` at runtime. Test with the ugliest inputs: #000, #fff, neon greens.

Remaining risks: (4) calendar.css `hsl(var())` dead rules — strip before any grid work or new values compound with resurrected ones; visual-diff after. (5) `@custom-variant dark` flips behavior for OS-dark users — retest both themes on every surface. (6) `.group/task` transition kill + FullCalendar Draggable forbids row transforms — completion has the calendarMode fade variant for this. (7) Font swap changes metrics app-wide — fallback descriptors are mandatory, spot-check 36px rows and 56px headers. (8) Scroll-timeline support — IO fallback specced. (9) Grain banding on low-DPI — cap opacity 0.04, overlay blend, test at 1x. (10) Key-vs-user-blue collision (#3b82f6 events near the indigo now-line) — now-line is the only 2px+glow+label element; curated palette excludes the 255–295 band. (11) `!important` wars (checkbox block index.css:347-368, calendar.css) — new component styles must land at equal or higher specificity or replace the blocks.

## 10. Self-critique (per frontend-design calibration)

Where the first draft drifted generic, and the fixes now baked in above:

1. **The concept's own H1 broke the voice rules.** "Your week, placed. Not just planned." is a "not X" construction — the exact AI-tell the copy rules ban. Fixed: H1 is "Your week, placed." alone; the sub carries the contrast by stating the mechanic instead of negating a competitor.
2. **#5e6ad2 + zinc is literally the "Linear theme" shadcn clone move.** The hex is owner-locked, so differentiation must come from usage: indigo is never paint, always light — solid fills capped at four elements, everything else alpha films, rims, and glows. No Linear-style solid-indigo sidebar active states, no indigo section headers. If the owner ever unlocks the hue, the first thing to explore is a 2–3 degree warm shift; until then the material system is the moat.
3. **Status ring risked being a Linear pie clone.** Redrawn as a light meter: no yellow in-progress, arc in the key, done = fully lit. One hue, on-law.
4. **Dark room + grain + mono ticker is itself congealing into a 2026 cliche cluster** (Resend descendants). Chanel rule applied — two accessories removed: the cursor-proximity rim-brightening effect (gimmick, lowest information) and grain in light mode (the studio stays clean paper). Ticker demoted to the footer only; the hero holds exactly one ambient loop (breathe).
5. **Green audit.** The old system spent green on today, success, Autotag, and the New List menu item with no logic. Now green exists only in `--success` toasts; today/current/focus are all the key. One light source per room.
6. **Empty states risked stock-icon genericism.** Glyph is now product-derived (the five-bar mini-week with the lit fourth bar), CSS-drawn, no icon library scenery.
7. **The studio flip section could read as a scroll gimmick.** Constrained: it is a self-backgrounded section, the page chrome never flips, no scroll-jack, and it exists to prove a checkable claim (theme parity) rather than to decorate.
8. **Residual honesty check.** The one place this spec still leans on register rather than invention is the dark hero composition (lit object over floor-line — Resend's grammar). Accepted deliberately because our lit object is the product's own working DOM grid and the light placement encodes today; if implementation ever swaps the slab for a screenshot or a decorative object, the concept collapses into pastiche and should be rejected in review.
