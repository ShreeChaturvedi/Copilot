# Taskflow Calendar — Design Brief (SETTLE, aqua)

Version 1.0, 2026-07-01. This is the single normative spec for the app redesign (issue #28) and the landing page. It is the SETTLE system (`specs/spec-settle.md`) re-based from indigo to the aqua family, with two vectors merged in from the other concepts: SCHEMATIC's dimension annotations, mono-numeral law, and etch-as-emptiness, and KEYLIGHT's brightest-surface-is-now today treatment and Cmd+K switch-on. Where this brief and an older spec disagree, this brief wins. Every color was computed sRGB<->OKLCH with WCAG contrast checks (validator: `docs/design-research/color-math.mjs`, run it with node; all values below are in-gamut and pass their stated gates).

Required reading for every implementation agent: this brief, `recon/design-system-map.md` (file paths, landmines), `recon/research-app-ui.md` (register), `recon/ui-audit/critique.md` (defects to erase). The three concept specs are background, not authority.

---

## 1. Thesis

**Chaos becomes a week.** A scattered task has no time. The product's one loop is giving it one: type it, drag it, and it settles onto the grid. The landing performs that loop as the brand (twenty chips glide into their slots in 1.3 seconds under "Everything has a time."), and the app performs it all day at instrument intensity.

The aqua law replaces the indigo law: **aqua means live and placed, nothing else.** The now-line, the today column, the primary CTA, the focus ring, the parse-span underline, the rim flash when a chip lands. Aqua is never decoration, never a wash behind content, never a section background. And in the dark theme aqua is literally the light: it is bright, and ink sits on it (dark text on aqua fills). In the light theme it is the instrument's deep enamel and white sits on it. One hue, two intensities, per the room.

Three voices, one job each: Sentient (serif) is time at rest. Spline Sans Mono is time at work: **if it is a numeral, it is mono** (every time, count, duration, shortcut, fraction, both surfaces, no exceptions). Inter is the hand that moves things. The serif never touches working chrome: never below 16px, never on an interactive element, never rendering a digit.

Emptiness has a language too (merged from SCHEMATIC): an empty surface renders a faint etched drawing of its filled state. Unbuilt is etched, placed is filmed, done settles out.

## 2. Token table (exact, both themes)

Implement in `src/index.css` under `:root` / `.dark`, exposed via `@theme inline`. Prerequisites before ANY token lands (each its own commit, visual-diff both themes after): add `@custom-variant dark (&:is(.dark *));` right after the tailwind import (issue #47), strip every `hsl(var(--*))` wrapper in calendar.css/index.css and the invalid `oklch(var(--chart-N))` wrappers (issue #49), delete the dead `tailwind.config.js` theme, rescope the `.group/task` transition kill (index.css:599-607) to an `.is-dragging` class toggled by the FullCalendar Draggable callbacks, remove the `button[role='checkbox']` `!important` block (index.css:347-368), delete the Vite-template `h1`/light-scheme leftovers (index.css:95-108).

### 2.1 Surfaces (aqua-cast neutrals, hue 190-210; the sea at night, not the sky)

| Token               | Light                              | Dark                               | Use                                                                                  |
| ------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `--void`            | `oklch(0.155 0.009 200)` `#080d0e` | same                               | Landing night bg, dialog/Cmd+K scrim base. Identical in both themes: night is night. |
| `--background`      | `oklch(0.988 0.002 200)` `#fafbfc` | `oklch(0.174 0.008 200)` `#0c1112` | App canvas. Dark = void + one step.                                                  |
| `--surface-1`       | `oklch(1 0 0)` `#ffffff`           | `oklch(0.197 0.012 202)` `#0f1718` | Cards, kanban cards, popovers.                                                       |
| `--surface-2`       | `oklch(0.971 0.003 200)` `#f3f6f6` | `oklch(0.220 0.014 203)` `#131d1d` | Row hover, column wells, input wells.                                                |
| `--surface-3`       | `#ffffff` + shadow                 | `oklch(0.242 0.015 204)` `#172223` | Dialogs, Cmd+K, menus.                                                               |
| `--hairline`        | `oklch(0.932 0.005 200)` `#e5e9ea` | `oklch(0.279 0.019 202)` `#1e2c2d` | 1px borders, grid lines.                                                             |
| `--hairline-strong` | `oklch(0.893 0.008 200)` `#d6ddde` | `oklch(0.332 0.023 203)` `#283a3b` | Inputs, dividers under headers.                                                      |

### 2.2 Ink

| Token     | Light                              | Dark                               |
| --------- | ---------------------------------- | ---------------------------------- |
| `--ink`   | `oklch(0.206 0.012 210)` `#11191a` | `oklch(0.978 0.003 190)` `#f6f8f8` |
| `--ink-2` | `oklch(0.361 0.016 210)` `#344042` | `oklch(0.874 0.012 195)` `#cdd8d8` |
| `--muted` | `oklch(0.542 0.019 210)` `#637275` | `oklch(0.649 0.015 200)` `#859292` |
| `--faint` | `oklch(0.699 0.015 210)` `#94a1a3` | `oklch(0.509 0.012 200)` `#5e6868` |

Verified: ink/ink-2/muted all pass 4.5:1 on their canvas and one surface step up (worst case muted-on-surface-2 light 4.58, muted-on-surface-3 dark 5.05). `--faint` fails AA by design: placeholders and disabled only, never information that exists nowhere else.

### 2.3 The aqua set (the one accent; means live/placed)

Two intensities of one hue (182). The dark theme's accent is bright and carries ink (aqua is the light source). The light theme's accent is deep and carries white (aqua is enamel). Both directions were contrast-verified.

| Token            | Light                                               | Dark                                         | Checks                                                               |
| ---------------- | --------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `--aqua`         | `oklch(0.53 0.088 182)` `#1a7c70`                   | `oklch(0.72 0.125 182)` `#1bbeaa`            | vs own canvas 4.87 / 8.09 (passes as ring, line, and 11px mono text) |
| `--aqua-ink`     | `#ffffff`                                           | `oklch(0.174 0.008 200)` `#0c1112`           | text on aqua fills: 5.04 / 8.34                                      |
| `--aqua-hover`   | `oklch(0.49 0.085 182)` `#0c7064` (deeper)          | `oklch(0.76 0.115 182)` `#48c9b6` (brighter) | hover always moves toward higher contrast with its background        |
| `--aqua-film-04` | `color-mix(in oklab, var(--aqua) 5%, transparent)`  | 6% mix                                       | today-column wash (light uses 5, dark 6; tune note in 9.2)           |
| `--aqua-film-08` | 8% mix                                              | 16% mix                                      | selected rows, drop-target wash, active keycap                       |
| `--aqua-rim`     | `color-mix(in oklab, var(--aqua) 40%, transparent)` | 44% mix                                      | rim flash ring, Cmd+K panel ring, today column hairlines             |
| `--focus-ring`   | `2px solid var(--aqua)`, outline-offset 1px         | same                                         | EVERY focusable surface, including task rows, chips, folder cards    |

Retire green-as-today entirely (calendar.css greens at 6-22, 61-71, 106-107, 117). `--success` remaps to `var(--aqua)`: confirmation and done are the same word as placed. In-progress amber `oklch(0.75 0.14 85)` `#d6a62e`. `--destructive` keeps `oklch(0.577 0.245 27.325)`; red now means only errors/overdue/delete. `themeStore.ts:48` meta theme-color: `#fafbfc` / `#0c1112`.

### 2.4 Chip alpha-film formula (THE shared material, unchanged from SETTLE)

One stored color `--chip-c` per list/calendar (user data, not tokens). Everything derives at runtime; never store tints. Relative-color syntax is proven in this repo (smart-tags.css).

Dark (identical on landing hero and app dark calendar):

```css
background: color-mix(in oklab, var(--chip-c) 24%, transparent);
box-shadow: inset 0 0 0 0.5px var(--chip-c); /* full-alpha rim */
color: oklch(from var(--chip-c) 0.82 min(c, 0.1) h); /* lifted text */
```

Light:

```css
background: color-mix(in oklab, var(--chip-c) 12%, transparent);
border-left: 3px solid var(--chip-c);
color: oklch(from var(--chip-c) 0.5 c h); /* sunk text */
```

States: selected/dragging = solid `var(--chip-c)` + white text; past = 55% opacity + `saturate(0.65)`; radius 6px everywhere a chip appears. Verified across all ten curated hues below: dark text-on-film worst case 6.83, light worst case 4.88, all pass 4.5. Runtime guard for legacy stored colors: if derived contrast < 4.5, fall back to `--ink` text + a 32% film.

Curated picker palette (replaces raw Tailwind hexes in color-picker.tsx and both create dialogs). Equal lightness; **the 155-205 hue band is excluded so no user color impersonates the aqua**:

| name    | oklch                   | hex       |
| ------- | ----------------------- | --------- |
| red     | `oklch(0.64 0.15 25)`   | `#d8625c` |
| orange  | `oklch(0.64 0.15 55)`   | `#cf6f19` |
| yellow  | `oklch(0.72 0.14 95)`   | `#c0a320` |
| green   | `oklch(0.64 0.15 135)`  | `#629f39` |
| blue    | `oklch(0.64 0.145 235)` | `#0d97d5` |
| indigo  | `oklch(0.60 0.15 275)`  | `#6875d8` |
| violet  | `oklch(0.64 0.15 305)`  | `#a272d4` |
| magenta | `oklch(0.64 0.15 335)`  | `#c265b0` |
| brown   | `oklch(0.56 0.07 60)`   | `#936b4a` |
| slate   | `oklch(0.64 0.03 210)`  | `#789296` |

### 2.5 Etch (emptiness language, merged from SCHEMATIC; app-only)

| Token           | Light                                             | Dark                                                         |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `--etch-line`   | `color-mix(in oklab, var(--ink) 6%, transparent)` | `color-mix(in oklab, oklch(0.80 0.09 190) 12%, transparent)` |
| `--etch-strong` | 12% ink                                           | 20% of the same aqua-phosphor                                |
| `--etch-text`   | 35% ink                                           | 45% aqua-phosphor. Always `aria-hidden`, always redundant.   |

Dark etch is phosphor-aqua, not white (white hairlines on near-black read as scratches). Dashed 1px = planned/not-yet-real. Scope: empty states, drop placeholders, first-run ghosts. The etch does NOT appear on the landing (the landing's signature is the settle; one signature per surface).

### 2.6 Shadows and machined edges (unchanged structure)

| Token             | Value                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-1`      | light `0 1px 2px -1px rgb(17 25 26 / .10)`; dark none (rim carries the edge)                                                                                      |
| `--shadow-2`      | light `0 1px 2px -1px rgb(17 25 26 / .10), 0 4px 10px -4px rgb(17 25 26 / .08), 0 16px 32px -12px rgb(17 25 26 / .06)`; dark `0 8px 24px -12px rgb(0 0 0 / .6)`   |
| `--shadow-3`      | light `0 2px 4px -2px rgb(17 25 26 / .12), 0 12px 24px -8px rgb(17 25 26 / .10), 0 32px 64px -16px rgb(17 25 26 / .08)`; dark `0 16px 48px -16px rgb(0 0 0 / .7)` |
| `--edge-machined` | light `inset 0 0 0 0.5px rgb(255 255 255 / .9), 0 0 0 0.5px rgb(17 25 26 / .14)`; dark `inset 0 0.5px 0 rgb(246 248 248 / .08), 0 0 0 0.5px rgb(0 0 0 / .5)`      |

Cards, dialogs, keycaps, the landing grid slab all use the machined edge; one implied light source. `@media (max-resolution: 1.5dppx)` overrides 0.5px shadows to 1px at half alpha.

Radius scale (replaces the six-radius mess): 6px chips and pills, 8px buttons/inputs/kanban cards, 10px folder cards/popovers, 12px dialogs/Cmd+K, 16px mobile bottom sheets. `--radius: 0.5rem` base. Full-round only: status rings, today disc, tag pills.

## 3. Type roles (locked: Sentient, Inter, Spline Sans Mono)

| Role            | Face/weight              | Size / lh / tracking                      | Where                                                                                                                                                                            |
| --------------- | ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero display    | Sentient 300             | clamp(44px, 6.5vw, 72px) / 1.05 / -0.02em | Landing H1 only. If it reads wiry over the void at first build, step to Sentient 400 and -0.025em.                                                                               |
| Section display | Sentient 400             | 32-40px / 1.1 / -0.01em                   | Landing h2, day-program title                                                                                                                                                    |
| In-app voice    | Sentient 400             | 18-20px / 1.3                             | Empty-state first line, calendar month name, day-complete line. Never <16px, never interactive, never a digit.                                                                   |
| Reading body    | Inter 400                | 16px / 1.6                                | Landing paragraphs                                                                                                                                                               |
| UI base         | Inter 400/500            | 13px / 20px                               | App rows, buttons, dialogs, menus (500 = titles/labels)                                                                                                                          |
| UI meta         | Inter 400                | 12px / 16px, `--muted`                    | Secondary lines                                                                                                                                                                  |
| Micro label     | Inter 600                | 11px / caps / +0.06em                     | Eyebrows, sidebar group labels, weekday headers                                                                                                                                  |
| View title      | Inter 600                | 16-18px / -0.01em                         | Task-view headers, dialog titles                                                                                                                                                 |
| Time & counts   | Spline Sans Mono 400/500 | 11-13px / 1                               | Hour gutter, chip times, due chips, counts, keycaps, dimension annotations, landing ticker + honesty line. **Every numeral that denotes time or quantity, mono. No exceptions.** |

Loading: self-host all woff2 in `/public/fonts` (kills the double Google fetch at index.html:8-10 + index.css:2). Landing preloads sentient-300, inter-400, spline-mono-400 (latin subset, ~90KB). App preloads Inter 400/500 + Spline 400; Sentient 400 loads async with a size-adjusted Georgia fallback (`size-adjust: 106%; ascent-override: 92%`, regenerate with fontpie at build). `font-feature-settings: "cv05"` on Inter globally, `"tnum"` where Inter renders adjacent numerals. Weights shipped: Sentient 300+400, Inter 400/500/600, Spline 400/500. Nothing else.

## 4. The settle language, surface by surface

Global grammar: anything that acquires a time or place SETTLES IN (travel via transform, land, aqua rim flash). Anything finished SETTLES OUT (sink 6px, fade, siblings close the gap). Nothing bounces, ever.

### 4.1 TaskItem (`src/components/tasks/TaskItem.tsx` + DueDateBadge, StatusBadge)

- Grid: `[16px ring] 10px [title 1fr] 8px [meta] [28px menu]`. Min-height 36px, padding 6px 12px, radius 6px.
- Title 13px/500 Inter. Meta second line only when data exists: due chip 20px pill, 11px mono, proximity ink (overdue `--destructive`, today `--aqua`, later `--muted`; kills the hardcoded `#3b82f6`/`#ef4444` in DueDateBadge.tsx:116-169); with a duration the chip reads `THU 14:00 · 90 MIN`; tags max 2 + `+N` mono (replace the infinite ScrollArea).
- Status ring: 16px circle, 1.5px stroke. Rest `--hairline-strong`; hover = the row's list color at 60%; in-progress = amber 270° arc; done = filled with the LIST color + check in white. Completion belongs to the chip system, not a borrowed brand glyph (Linear fills with brand; we do not).
- Completion moment: click -> ring stroke draws 160ms -> fill pops scale 0.9->1.0 120ms -> check draws 120ms -> title strikes, row to 55% opacity -> HOLD 800ms (second click reverses) -> settle out: inner wrapper `translateY(6px) scale(0.985)` + fade 240ms `--ease-settle` -> siblings FLIP-close 200ms transform-only.
- CONSTRAINT: rows in calendarMode keep `transform: none` (FullCalendar Draggable). All settle-out motion = CSS keyframe ANIMATIONS on an INNER wrapper, never the row root; in calendarMode the settle-out is opacity-only 160ms. The old global transition kill is rescoped per section 2 prerequisites.
- Hover: `--surface-2` instant on / 150ms off; actions (3-dot + NEW quick-schedule calendar icon, giving every row a visible path to a date, fixing #45) fade in opacity-only, `@media (hover: hover)` gated. Selected: `--aqua-film-08` + 2px inset left aqua bar. Focus-visible: `--focus-ring`. Fix the dead `opacity-[${...}]` class (line 388) and tag template classes (512-513).

### 4.2 Folder cards (`TaskFolderGrid.tsx` + `new-folder.css`, rebuilt)

Kill the clip-path manila folder. A folder is a settled chip at rest: same material, bigger.

- Card: min-height 132px, radius 10px, `--surface-1` + `--edge-machined`, chip formula's 3px bar on the TOP edge in `--chip-c`. Content: 28px icon tile (12% film, lucide glyph, no emoji default), name 14px/600, count `3 open` 12px mono `--muted`.
- Hover: translateY(-2px) + `--shadow-2` 150ms. Preview: default view fades OUT 120ms first, THEN previews fade in 160ms (sequenced, fixes the double-exposure #53); name stays pinned visible.
- New-list tile: dashed 1px `--hairline-strong`, no top bar. Click -> kanban: card scales 0.98 as the board fades in; the segmented control gains a real board state + back chevron labeled with the list name (fixes #56).

### 4.3 Kanban (`TaskKanbanBoard.tsx`)

- Columns: gutters (16px), not rules (delete `border-r`). Header 28px: status glyph + label 13px/600 `--ink` + count 12px mono `--muted` plain (kill the Badge and the amber/green header text).
- Card: `--surface-1`, radius 8px, `--edge-machined`, padding 10px 12px, 3px left bar `--chip-c` (the card is the same object as the calendar chip). Footer: due chip 11px mono + colorless priority glyph. Kill the gray-500 prison-card look.
- Dropped card SETTLES: pick-up 160ms scale 1.03 + rotate 1.5deg + `--shadow-3`; vacated slot keeps a dashed etch placeholder (`--etch-strong`, same height); drop = dnd-kit `dropAnimation {duration: 320, easing: cubic-bezier(0.16,1,0.3,1)}` and ON LAND a pre-rendered inset ring in `--aqua` plays opacity .35 -> 0 over 240ms (the rim flash). Transform+opacity only.
- Empty column: rest = ghost `+ New task` row; during drag = full-height dashed etch target + `--aqua-film-04`.
- Mobile: column `calc(100vw - 56px)` with next-column peek, scroll-snap, 3 pager dots.
- Wire the Schedule menu item (#44) to the schedule dialog; a drop onto a date is the same settle+flash.

### 4.4 Calendar (`calendar.css`, `CalendarView.tsx`, `ConsolidatedCalendarHeader.tsx`)

- Event chips: section 2.4 formula verbatim via `eventContent` render hooks (stop inlining backgroundColor at CalendarView.tsx:185-217). Line 1 = `09:30` 11px mono then title 12px/500 (fixes the time-time-title concatenation); <30min single line. New/dropped-in chip enters scale(0.97) + fade -> identity 240ms + rim flash. Idempotent across the `key={slotMinTime}` remounts: animate only events flagged newly-created this session.
- **Today, the KEYLIGHT vector at instrument intensity: the brightest surface is now.** Column wash `--aqua-film-04`; the column's own left/right hairlines switch to `--aqua-rim` while other days stay `--hairline`; header = weekday 11px caps 600 + date in a FIXED 24px aqua disc (width and height locked, fixes the squished pill #55), numeral in `--aqua-ink` 13px mono. The wash excludes the all-day lane and header cell; Day view gets NO wash (the disc + now-line carry it; the flood was an audited defect). One treatment everywhere including month view and mini-month.
- Now-line: 2px solid `--aqua` across today's column, 6px dot at the left edge; live time in the gutter 11px mono `--aqua` on a small canvas-colored chip occluding the nearest hour label; 1px ghost at 20% across other visible days. Dark theme may add `0 0 8px` aqua at 25% on the line only; light theme no glow. Position updates once per minute via one interval driving `transform: translateY` only. (Replaces the red destructive line.)
- **Dimension annotations (SCHEMATIC vector).** While dragging a chip: a floating `|-- 90 MIN --|` annotation (SSM 11 `--aqua`, 1px extension lines with end ticks, CSS pseudo-elements) beside the chip. While resizing: live start/end times pin to the chip's top/bottom edges. This is the data model drawn under the cursor.
- Gutter: 11px mono `--faint`, `9 AM` style; :30 gridlines at half opacity; weekend wash neutral 2%.
- Month view: day numbers 12px mono top-right, today = the aqua disc; events as 18px film bars; `+2 more` 11px mono. Fix the header/grid misalignment (#43) before restyling.
- Header: month name Sentient 400 18px + year 13px Inter `--muted` baseline-aligned; ViewSwitcher keeps the sliding indicator, labels 12px/500 with kbd tooltips; Today = outline chiclet + `T` keycap. Keyboard: `T` today, `D/W/M/L` views, arrows navigate.

### 4.5 Dialogs, sheets (`ui/dialog.tsx`, `ui/sheet.tsx`, consumers)

- Material: `--surface-3`, radius 12px, `--edge-machined`, padding 20px, footer over a hairline, right-aligned actions, primary = filled aqua with `--aqua-ink` text (disabled = 40% opacity aqua, never gray).
- Scrim: `--void` at 60% + `backdrop-filter: blur(4px)`. Enter `translateY(8px) scale(0.98)` + fade 240ms `--ease-settle`; exit 160ms fade. Sheet slide 280ms. Peek-mode dual render stays.
- Below 640px every dialog becomes a bottom sheet: radius 16 16 0 0, max-h 92vh, drag handle (fixes #46).
- TaskDetailSheet gains permanent field rows (fixes #45): each unset field renders etched: label SSM 11 `--etch-text` (`SCHEDULE`, `PRIORITY`, `LIST`, `TAGS`) + ghost value. Unset fields are drawn, not hidden.
- Unify Create Calendar / Create List into one anatomy: icon tile + name row, the ten 24px swatches, `Create list` button copy (fixes the "Create Task" bug).

### 4.6 Cmd+K (wire existing `ui/command.tsx`) — the switch-on (KEYLIGHT vector)

Opening the palette re-performs the landing hero: the room goes dark, the brightest surface appears.

- Scrim: `--void` at 60% + `backdrop-filter: blur(8px)` (the ONE sanctioned heavy blur in the app).
- Panel 560px, radius 12px, top 20vh, `--surface-3`, `--edge-machined`, plus outer ring `0 0 0 1px var(--aqua-rim)` — the only always-on aqua rim anywhere.
- Input 15px Inter; rows 36px/13px, 16px icons; group labels 11px caps; right-aligned keycaps (18px, `--surface-2` + machined edge, 11px mono). Opens translateY(-4px) scale(0.98) -> identity 200ms; exit 100ms. Result navigation: no animation.
- Commands: new task, new event, go to today, switch view, toggle theme, open settings — pulled from the real shortcut map in `useKeyboardShortcuts.ts`, never invented. Product-native move: the input parses date grammar; with a task selected, typing `tomorrow 9am` offers `Place on Wed, Jul 2, 9:00 AM`, and accepting fires the calendar settle+flash.
- Global keys: `Cmd+K`, `T` today, `D/W/M/L` views, `N` new task, number keys set visible day count.

### 4.7 Empty states (etch + serif, merged)

Pattern: the etched drawing of the filled state (`--etch-strong`, e.g. three dashed row skeletons, or one ghost chip at tomorrow 09:00 labeled `DRAG A TASK HERE` SSM 11) + ONE Sentient 400 18px line + one Inter 13px `--muted` action line. Max one serif line per surface; if an empty state cannot offer an action it does not get the serif. Filter-empty (not data-empty) skips the etch: plain "No tasks match. Clear filters." with the action inline.

### 4.8 Auth screens

The rainbow conic gradient and green cursor-glow die (index.css:623-753). Auth = the room: `--background` canvas, centered 400px card (`--surface-1`, machined edge, `--shadow-2`), one filled aqua primary (the screens finally get one), focus-within lifts the card's rim to `--aqua-rim`. Same tokens both themes, same fonts as the app.

### 4.9 Mobile (390px, systemwide)

Single pane under 768px. Rows min 44px; hover-only affordances get visible equivalents (3-dot at 40% opacity on touch). Settings collapses to list -> detail push (fixes #48). Create Event full-screen sheet (fixes #46). Kanban pager per 4.3. View switcher 44px targets + aria-labels. No horizontal overflow at 360px. Shadows drop one tier on touch devices.

## 5. Motion grammar

Tokens in `@theme`: `--ease-settle: cubic-bezier(0.16, 1, 0.3, 1)` (the ONE brand curve, landing FLIP and app alike); `--ease-out: cubic-bezier(0.25, 1, 0.5, 1)`; `--dur-1: 100ms` press, `--dur-2: 150ms` hover-off, `--dur-3: 240ms` dialogs/reveals, `--dur-4: 320ms` travel, `--dur-5: 480ms` signature moments only.

| Interaction                                 | Spec                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hover                                       | instant on, 150ms off, hover-capable pointers only                                                         |
| Press                                       | scale 0.97, 100ms                                                                                          |
| Menu/popover/tooltip                        | 150-200ms fade + 4px settle                                                                                |
| Dialog / Cmd+K                              | 240ms in (translate 8px + scale 0.98 + fade), 160ms out                                                    |
| List item enter                             | scale 0.97 + fade 200ms, stagger 30ms, max 8 then instant                                                  |
| Settle travel (drop, schedule, chip create) | 320ms `--ease-settle`, transform-only, ends with rim flash                                                 |
| Rim flash ("placed")                        | pre-rendered 1px aqua inset ring, opacity .35 -> 0, 240ms, on a pseudo-element (never animate box-shadow)  |
| Completion                                  | 4.1 timeline; keyframes on inner wrapper, never transitions, never the draggable root                      |
| Ambient                                     | landing only: idler chip 7s, now-line drift, ticker 45s. In-app ambient: none.                             |
| Never                                       | ease-in, `transition: all`, height/margin animation (grid-rows only), keyboard-initiated animation, bounce |

Landing FLIP settle: ~20 chips are real DOM nodes absolutely positioned at their FINAL slots; one pass assigns initial `transform: translate(dx,dy) rotate(r)` from precomputed constants, then a rAF flip to `transform: none` with `transition: transform 900ms var(--ease-settle)`, stagger 40ms, all landed by 1.3s. `will-change: transform` applied at start, removed on transitionend. Last chip is AQUA, lands last, rim flash on land. ~2KB vanilla helper, no library.

Reduced motion: landing renders pre-settled with a small static "before" strip; app travel/FLIP become 120ms crossfades; completion keeps ring fill + strike without movement; rim flash becomes a 240ms static ring at 20%. The media query wraps the whole grammar.

## 6. Landing, section by section

Page bg `--void`; chips use the 2.4 dark formula; CTAs filled `--aqua` with `--aqua-ink` text (the glowing switch-on CTA over the night); progressive blur ladder under the sticky nav. Budget: fold <=500KB, LCP = the H1 text, entrances done <=1.6s, no scroll-jack, Lighthouse perf >=0.95 / a11y 1.0.

| #   | Section                         | Content / motion / copy angle                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------ |
| 0   | Nav                             | 64px; wordmark Inter 600 14px; links 13px `--muted`; `Sign in` ghost + `Start free` aqua                                                                                                                                                                                                                                                                                                                                   |
| 1   | Hero                            | Sentient H1 "Everything has a time." + one-sentence sub + CTA `Start planning` + mono honesty line `FREE - SYNCS WITH GOOGLE CALENDAR - TUE 20:43` (real local time). Below: the real DOM week grid slab (`--surface-1` dark + machined edge + floor light-line), ~20 scattered chips -> THE settle, last chip aqua + rim flash, then one unplaced chip idles in the right margin (7s drift). No feature copy in the fold. |
| 2   | "Type it. It lands."            | Real smart-input typing `Email vendor friday 4pm`, parse spans underline in aqua, chip settles onto a mini Friday column. 4s IO-gated loop. SHIPS ONLY after the parser fix (#39) verifies.                                                                                                                                                                                                                                |
| 3   | "One task, three places"        | List row, board card, calendar chip: visibly the SAME object (same bar, radius, mono time). Chip FLIPs list -> board -> grid once on entry, 320ms hops, with the `                                                                                                                                                                                                                                                         | -- 90 MIN -- | ` dimension annotation appearing during the hop. |
| 4   | "Plan without leaving the keys" | Machined keycap cluster of REAL shortcuts (T, D/W/M/L, Cmd+K); keycaps press themselves once, IO-gated.                                                                                                                                                                                                                                                                                                                    |
| 5   | "Thursday, as a program"        | THEME INVERSION: renders on light `--background` with light-formula chips; an editorial agenda of one day (Sentient "Thursday" 36px + rows of mono time, title, film chip). Proves light/dark parity on one page.                                                                                                                                                                                                          |
| 6   | Receipts                        | Mono ticker 45s: `4 CALENDAR VIEWS - NATURAL DATES - RRULE RECURRENCE - GOOGLE SYNC - KEYBOARD FIRST` (facts only, verified shipped at merge time).                                                                                                                                                                                                                                                                        |
| 7   | Closing                         | Back to void. The margin idler finally settles into a slot above the CTA. Sentient: "One task is still waiting. Give it a time." CTA `Start free` + mono `NO CARD REQUIRED`.                                                                                                                                                                                                                                               |
| 8   | Footer                          | Hairline, mono links 11px, "Built by Shree Chaturvedi" + GitHub link. Nothing else.                                                                                                                                                                                                                                                                                                                                        |

## 7. Copy voice

Plain verbs, sentence case, active voice; the interface explains, never sells. No em dashes, no semicolons, ASCII only (mono separators are spaced hyphens), no "not X but Y", no promotional adjectives (smart, powerful, beautiful, seamless), CTAs start with a verb, an action keeps one name through its flow (`Place` -> `Placed`), errors say what happened and what to do (no `VALIDATION_ERROR` reaching a toast), numbers are always real (live clock, true counts). Mono lines state only verifiable facts; if a fact cannot be verified this session, it is not set in mono.

Samples: H1 `Everything has a time.` / sub `Taskflow is a task list and a calendar on one grid. Type a task, give it a time, and your week fills in.` / empty calendar `Nothing scheduled. The week is open.` + `Press C to create an event.` / day complete `That's everything for today.` / closing `One task is still waiting. Give it a time.` Fix in-app copy debt: `Create list`, task-sheet aria-labels say task, `NO DUE DATE` becomes `No date`, error toasts translated (#58).

## 8. Cohesion pairs (landing <-> app, enforced in the integration pass)

1. Hero chips = dark calendar chips, one formula, same tokens.
2. FLIP settle 900ms = kanban/schedule travel 320ms, one curve (`--ease-settle`).
3. Last chip's aqua rim flash = the flash on every in-app placement.
4. Sentient hero = month name, empty states, day-complete line. Serif is time at rest, never below 16px.
5. Mono honesty line/ticker = hour gutter, chip times, counts, keycaps. Every time-numeral mono.
6. Aqua CTA + hero now-line = app now-line, today disc, focus ring, parse spans. Aqua = live/placed, nothing else.
7. Landing void `#080d0e` = app dark canvas one step up; the dialog scrim IS the void.
8. The margin idler chip = the sidebar's unscheduled tasks; drag-in performs the hero motion for real.
9. Grid slab + keycaps machined edges = cards, dialogs, Cmd+K, keycap hints. One material.
10. Chips settle IN (chaos -> placed) = completed tasks settle OUT (sink, fade, gap closes). Mirrored signature.

## 9. Execution protocol and risks

### 9.1 Per-agent working protocol (non-negotiable)

Every surface agent works against the live app (Vite :5180) with playwright-cli headless, screenshots its surface at 1440px and 390px in BOTH themes, critiques its own shots against this brief, and iterates before finishing. No surface ships on a first render. Both themes must be toggled via the in-app toggle (after the `@custom-variant` fix it follows the class, not the OS). Commits small, conventional format, one surface per branch.

### 9.2 Tune points (single-variable, compare, keep the winner)

- Light today wash: start 5%; if the column fails a 2s squint test at 1440, go 6% + hairline alpha 0.32 before anything else. Dark cap 6%.
- Sentient 300 hero over the void: if wiry, 400 + tracking -0.025em.
- Dark aqua CTA: if it reads minty against neighboring chips, drop L to 0.70 (recheck ink contrast >=7).

### 9.3 Hardest details (mitigations specced)

1. Hero FLIP on mobile: build the hero FIRST as an isolated page; 4x CPU throttle; assert no frame >20ms during the settle; <=480px scatters 12 chips, not 20. Do not build sections 2-7 until this passes.
2. Completion settle-out under the transition-kill + Draggable constraints: keyframes on an inner wrapper; calendarMode = opacity-only; verify drag-to-calendar mirrors after (the kill rule existed because ghosting was real).
3. Chip films over arbitrary legacy colors: clamped relative-color text + the <4.5:1 runtime fallback; validate the ten curated hues at build time by script, not eyeballs.
4. FullCalendar coupling: chips move to `eventContent` without breaking drag mirrors (`--default-calendar-color`) or `key={slotMinTime}` remounts.
5. `@custom-variant dark` + hsl-unwrap are behavior-changing: land them alone, visual-diff every surface both themes, THEN restyle.

## 10. Changelog vs the three concept specs

- Indigo `#5e6ad2` -> aqua `oklch(0.72 0.125 182)` dark / `oklch(0.53 0.088 182)` light, per the locked green/aqua decision (seeds: the old today-green hue family and the product's calendar-blue, resolved to hue 182). Neutrals re-cast from hue 274-286 to 190-210. All contrast checks re-run; the Helmholtz problem (aqua reads brighter than indigo at equal L) is resolved by the two-intensity accent with `--aqua-ink` per theme.
- Merged IN from SCHEMATIC: dimension annotations on drag/resize, the absolute mono-numeral law, etch-as-emptiness (app-only, plus the kanban vacated-slot etch).
- Merged IN from KEYLIGHT: today column as the brightest surface (wash + aqua column hairlines + fixed disc, no cone), Cmd+K switch-on (blur-8 scrim + the only always-on aqua rim), hover-moves-toward-contrast rule.
- CUT: KEYLIGHT grain, cone gradient, breathe loop, Schibsted/General Sans; SCHEMATIC FIG numbering, full-page landing etch, `DONE 14:32` stamp (one completion signature is enough); SETTLE's `--paper` token (S5 uses the app's light `--background` directly).
- `--success` remapped to the aqua (was green): done/confirmed/placed is one word. Completion rings fill with the LIST color, not the accent.
