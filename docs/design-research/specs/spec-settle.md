# SETTLE — Taskflow Calendar brand-system specification

Version 1.0, 2026-07-01. Deepens Concept 3 "SETTLE" (recon/research-landing-2.md) into one system with the locked app direction "Instrument Panel+" (recon/research-app-ui.md §9-A + Things completion + keyboard-first calendar). Written for implementation agents: every value is final unless marked (tune). Grounding: recon/design-system-map.md (file paths, landmines), recon/ui-audit/critique.md (defects this system must repair). Repo is read-only for this spec; paths cited are implementation targets.

---

## 1. Thesis and why it is native to this product

**Thesis: chaos becomes a week.** A scattered task has no time. The product's one loop is giving it one: type it, drag it, and it settles onto the grid. SETTLE performs that loop as the brand. The landing opens with ~20 task chips scattered in a night void and, in 1.3 seconds, every chip glides into its real slot on the week grid under the serif line "Everything has a time." The app is the instrument that does the same thing all day.

Why native, not decorative:

- The settle motion is the product's core interaction (unscheduled -> placed), so the landing's signature animation is a demo, not an ornament. Section 5 reuses the identical easing and rim-flash when a real user schedules, drops, or completes a task.
- The night void is the calendar at rest: a week before anything is placed. The app's dark theme is the same room one lamp brighter (section 2 ladder shares one hue).
- The serif is the voice of time at rest (headlines, month names, empty states, the end of a day). The mono face is time at work (clock digits, durations, counts, keyboard). Inter is the hand that moves things. Three voices, one job each.
- Indigo #5e6ad2 means exactly one thing everywhere: **now / placed**. The now-line, the today pill, the primary CTA, the focus ring, and the flash when a chip lands. Never a decorative wash.

The tension resolved (landing serif warmth vs Instrument Panel discipline): the serif never touches working chrome. It appears in-app only at rest moments, >=16px, never on an interactive element, never rendering a number. Everything a user operates is 13px Inter or 11-13px mono at instrument density. The warmth frames the instrument, it never softens it.

## 2. Shared token table (light AND dark, exact)

All values computed sRGB<->OKLCH this session. Implement in `src/index.css` `@theme`/`:root`/`.dark`. Prerequisites before any token lands (from design-system-map §2-3, ui-audit §4): add `@custom-variant dark (&:is(.dark *));`, strip every `hsl(var(--*))` wrapper in calendar.css/index.css, delete dead `tailwind.config.js` theme, fix the two dead template-literal classes in TaskItem.tsx (388, 512-513). These change current rendering; visual-diff both themes.

### 2.1 Surface ladders

| Token                          | Light                                | Dark                                 | Notes                                                                                            |
| ------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `--void`                       | `#0B0C10` / `oklch(0.155 0.009 274)` | same                                 | Landing night bg, app modal scrim base, deepest layer. Identical in both themes: night is night. |
| `--background`                 | `#FBFBFC` / `oklch(0.988 0.001 286)` | `#0F1014` / `oklch(0.174 0.008 274)` | App canvas. Dark = void + one step.                                                              |
| `--surface-1` (card/raised)    | `#FFFFFF` / `oklch(1 0 0)`           | `#14151B` / `oklch(0.197 0.012 278)` | Cards, kanban cards, popovers.                                                                   |
| `--surface-2` (recessed/hover) | `#F5F5F7` / `oklch(0.971 0.003 286)` | `#191A21` / `oklch(0.220 0.014 279)` | Row hover, column bg, input wells.                                                               |
| `--surface-3` (overlay)        | `#FFFFFF` + shadow                   | `#1E1F27` / `oklch(0.242 0.015 280)` | Dialogs, Cmd+K, menus.                                                                           |
| `--hairline`                   | `#E8E8EC` / `oklch(0.932 0.005 286)` | `#262832` / `oklch(0.279 0.019 276)` | 1px borders, grid lines.                                                                         |
| `--hairline-strong`            | `#DBDBE1` / `oklch(0.893 0.008 286)` | `#333542` / `oklch(0.332 0.023 278)` | Inputs, dividers under headers.                                                                  |
| `--paper` (landing light)      | `#FAFAFB` / `oklch(0.985 0.001 286)` | n/a                                  | Landing light sections only.                                                                     |

One family: every neutral carries hue 274-286 at chroma 0.001-0.023 (indigo-cast grays). The current warm-free zinc tokens are replaced wholesale. Landing and app share this ladder; the landing simply lives one layer deeper (`--void`) than the app ever rests at.

### 2.2 Ink ladder

| Token                 | Light                                | Dark                                 |
| --------------------- | ------------------------------------ | ------------------------------------ |
| `--ink` (foreground)  | `#16171D` / `oklch(0.206 0.012 278)` | `#F7F8F8` / `oklch(0.978 0.001 197)` |
| `--ink-2` (secondary) | `#3A3D46` / `oklch(0.361 0.016 271)` | `#D0D6E0` / `oklch(0.874 0.015 261)` |
| `--muted`             | `#6B6F7B` / `oklch(0.542 0.019 271)` | `#8A8F98` / `oklch(0.649 0.015 262)` |
| `--faint`             | `#9A9EA8` / `oklch(0.699 0.015 268)` | `#62666D` / `oklch(0.509 0.012 262)` |

### 2.3 Indigo set (the one accent; means now/placed)

| Token              | Value                                                 | Use                                                                                             |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `--indigo`         | `#5e6ad2` / `oklch(0.567 0.159 275)`                  | Primary buttons, now-line, today pill, selected states, parse-span underlines.                  |
| `--indigo-hover`   | `#828fff` / `oklch(0.691 0.164 276)`                  | Hover on indigo controls (dark); light hover = `oklch(0.51 0.159 275)`.                         |
| `--indigo-film-04` | `color-mix(in oklab, var(--indigo) 4%, transparent)`  | Today column wash (light). Dark uses 6%.                                                        |
| `--indigo-film-08` | 8% mix                                                | Selected row bg, drop-target wash.                                                              |
| `--indigo-film-16` | 16% mix                                               | Landing panel washes, active kbd keycap.                                                        |
| `--indigo-rim`     | `color-mix(in oklab, var(--indigo) 44%, transparent)` | Rim-flash ring, announcement-pill border (Resend 44% discipline).                               |
| `--focus-ring`     | `2px solid var(--indigo)` outer, offset 1px           | Every focusable surface incl. task rows, chips, folder cards (fixes critique §3.11 focus gaps). |

Retire green-as-today entirely (calendar.css lines 6-22, 106, 117 greens). `--success oklch(0.6 0.15 145)` = `#3a9742` stays but means only "done/success". In-progress amber `oklch(0.75 0.14 85)` = `#d6a62e`. Destructive keeps `oklch(0.577 0.245 27.325)`.

### 2.4 Chip alpha-film formula (THE shared material)

One stored color `--chip-c` per list/calendar (user-picked). Everything derives; never store tints. Relative-color syntax is already proven in this repo (smart-tags.css).

Dark (identical on landing hero and app dark calendar):

```css
background: color-mix(in oklab, var(--chip-c) 24%, transparent);
box-shadow: inset 0 0 0 0.5px var(--chip-c); /* full-alpha 0.5px rim */
color: oklch(
  from var(--chip-c) 0.82 min(c, 0.1) h
); /* lifted text, e.g. blue -> #81cffc */
```

Light:

```css
background: color-mix(in oklab, var(--chip-c) 12%, transparent);
border-left: 3px solid var(--chip-c);
color: oklch(from var(--chip-c) 0.5 c h); /* sunk text, e.g. blue -> #006dab */
```

States: selected/dragging = solid `var(--chip-c)` + white text; past = 55% opacity; radius 6px everywhere a chip appears (event chip, hero chip, tag pill core).

Curated picker palette (replaces raw Tailwind hexes in color-picker.tsx and both create dialogs; equal-lightness, hue band 250-300 reserved for indigo):
`oklch(0.64 0.15 25)` #d8625c red, `(0.64 0.15 55)` #cf6f19 orange, `(0.72 0.14 95)` #c0a320 yellow, `(0.64 0.15 145)` #47a34e green, `(0.64 0.13 175)` #00a588 teal, `(0.64 0.13 205)` #00a2b1 cyan, `(0.64 0.15 235)` #0098d9 blue, `(0.64 0.15 305)` #a272d4 violet, `(0.64 0.15 335)` #c265b0 magenta, `(0.64 0.03 277)` #878b9f slate.

### 2.5 Shadows and machined edges

| Token                       | Value                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-1` (rest)         | light `0 1px 2px -1px rgb(22 23 29 / .10)`; dark: none (rim instead)                                                                                                              |
| `--shadow-2` (lift/hover)   | light `0 1px 2px -1px rgb(22 23 29 / .10), 0 4px 10px -4px rgb(22 23 29 / .08), 0 16px 32px -12px rgb(22 23 29 / .06)` (penumbra 3-tier); dark `0 8px 24px -12px rgb(0 0 0 / .6)` |
| `--shadow-3` (overlay/drag) | light `0 2px 4px -2px rgb(22 23 29 / .12), 0 12px 24px -8px rgb(22 23 29 / .10), 0 32px 64px -16px rgb(22 23 29 / .08)`; dark `0 16px 48px -16px rgb(0 0 0 / .7)`                 |
| `--edge-machined`           | light `inset 0 0 0 0.5px rgb(255 255 255 / .9), 0 0 0 0.5px rgb(22 23 29 / .14)`; dark `inset 0 0.5px 0 rgb(247 248 248 / .08), 0 0 0 0.5px rgb(0 0 0 / .5)`                      | Clerk double-hairline: light edge above, dark edge below, one implied light source. Cards, dialogs, keycaps, the landing grid slab. |

Radius scale (replaces the six-radius mess, critique §3.11): 6px chips/pills-core, 8px buttons/inputs/kanban cards, 10px folder cards/popovers, 12px dialogs/Cmd+K. `--radius: 0.5rem` base. Full-round only: status rings, today pill, tag pills.

## 3. Type roles

Three faces total. General Sans (from the concept sketch) is dropped: one working sans across landing and app beats two, and Inter is already the app's native face at 13px density (see §10 for the self-critique on this call).

| Role            | Face/weight              | Size / lh / tracking                      | Where                                                                                                                                                             |
| --------------- | ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero display    | Sentient 300             | clamp(44px, 6.5vw, 72px) / 1.05 / -0.02em | Landing H1 only                                                                                                                                                   |
| Section display | Sentient 400             | 32-40px / 1.1 / -0.01em                   | Landing h2, landing day-program title                                                                                                                             |
| In-app voice    | Sentient 400             | 18-20px / 1.3 / 0                         | Empty-state first line, calendar month name, day-complete line, onboarding welcome. HARD RULES: never <16px, never on an interactive element, never a digit.      |
| Reading body    | Inter 400                | 16px / 1.6                                | Landing paragraphs                                                                                                                                                |
| UI base         | Inter 400/500            | 13px / 20px                               | App rows, buttons, dialogs, menus (500 = titles/labels)                                                                                                           |
| UI meta         | Inter 400                | 12px / 16px, `--muted`                    | Secondary lines, descriptions                                                                                                                                     |
| Micro label     | Inter 600                | 11px / caps / +0.06em                     | Section eyebrows, sidebar group labels, weekday headers                                                                                                           |
| View title      | Inter 600                | 16-18px / -0.01em                         | Task-view headers, dialog titles                                                                                                                                  |
| Time & counts   | Spline Sans Mono 400/500 | 11-13px / 1                               | Hour gutter, chip times, due chips, counts, kbd hints, landing ticker + honesty line, dimension annotations. Digits that denote time or quantity are ALWAYS mono. |

Loading strategy: self-host all woff2 in `/public/fonts` (kills the double Google fetch, index.html:8-10 + index.css:2). Landing preloads `sentient-300`, `inter-400`, `spline-mono-400` (3 files, ~90KB total, latin subset). App preloads Inter 400/500 + Spline 400 only; Sentient 400 loads async `font-display: swap` with fallback `Georgia` plus `size-adjust: 106%; ascent-override: 92%;` (tune against Sentient metrics) so empty states reflow <1px. `font-feature-settings: "cv05"` on Inter globally, `"tnum"` wherever Inter renders adjacent numerals (settings, analytics). Weights shipped: Sentient 300+400, Inter 400/500/600, Spline Sans Mono 400/500. Nothing else.

## 4. The settle language, surface by surface (app)

Global grammar first (details per surface below): anything that acquires a time or a place SETTLES IN (travel via transform, land, rim flash). Anything that is finished SETTLES OUT (sink 6px, fade, siblings close the gap). Nothing bounces. Bounce max 0 across the app.

### 4.1 TaskItem (`src/components/tasks/TaskItem.tsx` + DueDateBadge, StatusBadge)

- Grid: `[16px ring] 10px gap [title 1fr] 8px gap [meta cluster] [28px menu]`. Row min-height 36px, padding 6px 12px, radius 6px.
- Title 13px/500 Inter. Meta second line only when data exists (12px): due chip = 20px pill, 11px mono, date-proximity ink (overdue destructive, today indigo, later muted; kills hardcoded #3b82f6/#ef4444 in DueDateBadge.tsx:116-169); tags max 2 visible + `+N` (11px mono) — replace the infinite horizontal ScrollArea.
- Status ring (replaces bare CircularCheckbox as default; keep the settings toggle): 16px circle, 1.5px stroke. Rest = `--hairline-strong`; hover = `--chip-c` (the row's list color) at 60%; in-progress = 270-degree arc in amber; done = filled `--chip-c` + white check. The ring fills with the LIST color, not a generic brand hue — completion and the chip system share one identity (ownable; Linear fills with brand indigo, we do not).
- Completion moment (the Things steal, timeline): 0ms click -> ring stroke draws 160ms (SVG dashoffset) -> fill pops scale 0.9->1.0 120ms (overlapping) -> check draws 120ms -> title strikes + row to 55% opacity -> HOLD 800ms grace (second click reverses everything) -> settle out: inner wrapper `translateY(6px) scale(0.985)` + fade 240ms `--ease-settle` -> siblings FLIP-close the gap 200ms transform-only.
- CONSTRAINT (design-system-map §9.1, index.css:599-607): the row root in calendarMode must keep `transform: none` (FullCalendar Draggable) and the global `.group/task * { transition: none !important }` kills transitions. Therefore: all settle-out motion runs as CSS keyframe ANIMATIONS (unaffected by the transition kill) on an INNER wrapper div, never the row root. In calendarMode the settle-out is opacity-only, 160ms, zero transforms.
- Hover: bg `--surface-2` instant on / 150ms off; actions (3-dot, quick-schedule calendar icon — NEW, gives every row a visible path to a date, fixing critique bug 8) fade in opacity-only, absolutely positioned right, `@media (hover: hover)` gated. Selected: `--indigo-film-08` bg + 2px inset left indigo bar. Focus-visible: `--focus-ring`.
- Completed rows visible (filter permitting): 55% opacity via a real class (fixes dead `opacity-[${...}]` at line 388).

### 4.2 Folder cards (`TaskFolderGrid.tsx` + `new-folder.css` — rebuilt)

Kill the clip-path manila folder (detached-tab defect, critique §3.5). New metaphor: **a folder is a settled chip at rest** — same material, bigger.

- Card: min-height 132px, radius 10px, `--surface-1` + `--edge-machined`, and the chip formula's 3px bar moved to the TOP edge in `--chip-c` (full width, follows top radius). Content: 28px icon tile (12% film bg, full-color lucide glyph — kill the 📁 emoji default), name 14px/600, count `3 open` 12px mono `--muted`.
- Hover: translateY(-2px) + `--shadow-2`, 150ms. Preview fix (double-exposure bug): default view fades OUT 120ms first, THEN previews fade in 160ms (sequenced, not simultaneous); previews = up to 3 rows of 12px with 10px status rings. Name stays visible (12px/600 pinned top-left during preview) — never hide the folder's identity.
- New-list tile: dashed 1px `--hairline-strong`, radius 10px, NO top bar (fixes the stray floating tab), centered plus + `New list` 13px.
- Click -> kanban: the tapped card scales 0.98 (120ms) as the board fades in 200ms; the Folder|List|Board segmented control gains a real `board` state with active pill + a back chevron labeled with the list name (fixes no-back-affordance, critique bug 13).

### 4.3 Kanban (`TaskKanbanBoard.tsx`)

- Columns: DELETE `border-r border-border` — gutters (16px) not rules. Column bg transparent; header 28px row = status glyph 14px (ring / arc / check, glyph-neutral except done check in `--success` at 70%) + label 13px/600 `--ink` (kill the amber/green header text) + count 12px mono `--muted` plain text (kill the Badge) + hover-revealed `+` and `...`.
- Card: `--surface-1`, radius 8px, `--edge-machined`, padding 10px 12px, 3px left bar `--chip-c` (both themes — the card is the same object as the calendar chip). Row 1 title 13px/500 clamp-2; footer: due chip 11px mono + priority glyph (gray bars, colorless). Kill the gray-500 fill/border prison-card look.
- **The dropped card SETTLES (full spec):** pick-up = 160ms scale 1.03 + rotate 1.5deg + `--shadow-3` (dnd-kit DragOverlay); during drag the vacated slot collapses 200ms and the hovered gap opens 200ms ease-out; drop = dnd-kit `dropAnimation: { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }`, scale->1, rotate->0, shadow->rest; ON LAND a pre-rendered pseudo-element ring (`inset 0 0 0 1px var(--indigo)`) plays opacity 0.35 -> 0 over 240ms — the rim flash, identical to the landing's last chip. Transform+opacity only end to end.
- Empty column: rest = ghost `+ New task` row at bottom (12px `--faint`); during drag = full-height target, dashed 1px + `--indigo-film-04`, label `Drop a task here` 12px.
- Mobile: column width `calc(100vw - 56px)` so 40px of the next column always peeks, scroll-snap kept, 3 pager dots (4px, `--faint`/active `--indigo`) under the board.
- Wire the Schedule menu item (no-op at :329, :388) to the schedule dialog; a drop onto a date there = the same settle+flash.

### 4.4 Calendar (`calendar.css`, `CalendarView.tsx`, `ConsolidatedCalendarHeader.tsx`)

- Event chips: the §2.4 formula verbatim via `eventContent` render hook (stop inlining backgroundColor at CalendarView.tsx:185-217). Anatomy: radius 6px, padding 2px 6px, line 1 = `09:30` 11px mono then title 12px/500 Inter (fixes "9:30 AM - 10:00 AM - Te..." concatenation); <30min = single line `09:30 Standup`. All-day/multi-day: film bar, rim, radius only on terminating ends. New event created or task dropped in: chip enters `scale(0.97)` + fade -> identity 240ms `--ease-settle` + rim flash (the hero motion, performed live).
- Now-line: 2px solid `--indigo` across today's column, 6px dot at the left edge, live time label in the gutter 11px mono `--indigo`; other visible days get a 1px ghost at 20% alpha. (Replaces red destructive line; red now means only errors.)
- Today: column wash `--indigo-film-04` light / 6% dark (kills the green flood, critique §3.2); header = weekday 11px caps Inter 600 `--muted` + date number in a fixed 24px filled indigo circle, white 13px mono (fixed w/h flex-center — fixes the squished-sliver pill). One today treatment, one hue, everywhere including month view.
- Gutter labels: 11px mono `--faint`, `9 AM` style. Weekend wash: neutral 2%. :30 gridlines at half opacity. Hairlines = `--hairline` (dark hairlines become visible again once hsl() wrappers are stripped).
- Month view: day numbers 12px mono top-right, today = filled indigo circle; events as 18px film bars; `+2 more` 11px mono. (Header/grid offset is a functional bug — file/fix per the standing gh-issue rule before restyling.)
- Header: month name Sentient 400 18px + year 13px Inter `--muted`, baseline-aligned (the one daily-visible serif); view switcher keeps the sliding indicator, labels 12px/500 with tooltips carrying kbd hints; Today = outline chiclet + `T` keycap 10px mono. Keyboard: `T` today, `D/W/M/L` views, arrows navigate (extend useKeyboardShortcuts.ts).

### 4.5 Dialogs (`ui/dialog.tsx`, `ui/sheet.tsx`, create dialogs)

- Material: `--surface-3`, radius 12px, `--edge-machined`, padding 20px, footer separated by `--hairline` with right-aligned actions, primary = filled indigo (fixes "no visible primary" and gray-disabled ambiguity: disabled = 40% opacity indigo, not gray).
- Scrim: `--void` at 60% + `backdrop-filter: blur(4px)`. Enter: `translateY(8px) scale(0.98)` + fade -> identity 240ms `--ease-settle`; exit 160ms fade. Sheet: slide 280ms `--ease-settle` (down from 500ms). Peek-mode dual render stays.
- Unify Create Calendar / Create List into ONE anatomy: icon-or-emoji tile + name input row, 10 curated swatches (24px, gap 8px), same placeholder tone, correct button labels (`Create list`, fixes the "Create Task" copy bug).

### 4.6 Cmd+K (wire existing `ui/command.tsx`)

- Panel 560px, radius 12px, top 20vh, `--void` scrim, `--edge-machined`. Input 15px Inter; result rows 36px/13px with 16px icons; group labels 11px caps; right-aligned kbd hints in 18px keycaps (surface-2 + machined edge, 11px mono). Opens `translateY(-4px) scale(0.98)` -> identity 200ms settle.
- Product-native differentiator: the input parses date grammar. With a task selected, typing `tomorrow 9am` offers `Place on Wed, Jul 2, 9:00 AM`; accepting fires the calendar settle+flash. Cmd+K is where keyboard-first and settle meet.

### 4.7 Empty states

Pattern everywhere: one Sentient 400 18px line + one Inter 13px `--muted` line + one action (verb-first). Max one serif line per surface. Examples in §7. Fixes bare-sentence emptiness (critique §3.4) and gives the serif its main in-app home.

### 4.8 Mobile

- Settings: collapse to list -> detail push navigation (fixes the 100px-wide broken pane). Create Event: single-column stack, full-width fields, sticky footer (fixes viewport clip). Kanban pager per §4.3. View switcher: keep M/W/D/L but 44px touch targets + aria-labels.
- Motion budget: settle grammar identical but stagger counts capped (see §5 reduced/mobile notes and §9 sample check).

## 5. Motion grammar

Tokens (in `@theme`): `--ease-settle: cubic-bezier(0.16, 1, 0.3, 1)` (easeOutExpo family — the ONE brand curve, landing FLIP and app alike); `--ease-out: cubic-bezier(0.25, 1, 0.5, 1)`; durations `--dur-1: 100ms` press, `--dur-2: 150ms` hover-off, `--dur-3: 240ms` menus/dialogs/reveals, `--dur-4: 320ms` travel (drop, schedule, FLIP), `--dur-5: 480ms` signature moments only.

| Interaction                                        | Spec                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Hover                                              | instant on, 150ms off, ease-out, hover-capable pointers only                                                                          |
| Press                                              | scale 0.97, 100ms                                                                                                                     |
| Menu/popover/tooltip                               | 150-200ms fade + 4px settle                                                                                                           |
| Dialog / Cmd+K                                     | 240ms in (translate 8px + scale 0.98 + fade), 160ms out                                                                               |
| List item enter                                    | scale 0.97 + fade, 200ms, stagger 30ms, max 8 staggered then instant                                                                  |
| Settle travel (kanban drop, schedule, chip create) | 320ms `--ease-settle`, transform-only, ends with rim flash                                                                            |
| Rim flash ("placed")                               | pre-rendered 1px indigo inset ring, opacity 0.35 -> 0, 240ms; compositor-safe (opacity on pseudo-element, never animating box-shadow) |
| Completion                                         | §4.1 timeline; keyframe animations on inner wrapper, never transitions, never the draggable root                                      |
| Ambient (landing only)                             | unplaced chip idle 7s loop, now-line real-time drift, ticker 45s linear. Zero ambient loops in-app.                                   |
| Never                                              | ease-in, `transition: all`, height/margin animation, keyboard-initiated animation >200ms, bounce                                      |

**Landing FLIP settle spec:** ~20 chips are real DOM nodes absolutely positioned at their FINAL grid slots. On load, one pass assigns each an initial `transform: translate(dx, dy) rotate(r)` (scatter, precomputed constants — no layout reads), then a rAF flip to `transform: none` with `transition: transform 900ms var(--ease-settle)`, stagger 40ms by index, all landed by 1.3s. Transform-only proof: positions never change in layout, one style write per chip, no measurement after first paint, `will-change: transform` applied at start and removed on `transitionend`. Last chip = indigo, lands last (stagger slot 19), rim flash on land. Helper: ~2KB vanilla, no library.

**Reduced-motion path (`prefers-reduced-motion: reduce`):** landing renders pre-settled with a small static inset strip showing the scattered "before" (all content present); app: all travel/FLIP replaced by 120ms opacity crossfade, completion keeps ring fill + strike with no movement, rim flash becomes a 240ms static ring at 20% then gone, dialogs fade only. Currently only auth-bg and FC honor this (design-system-map §11) — the media query wraps the whole grammar.

## 6. Landing, section by section

Page bg `--void`; type per §3; every chip uses §2.4 dark formula; CTAs filled indigo, verb-first; progressive blur ladder (4 steps, 1/2/4/8px) under the sticky nav. Budget: fold <=500KB, LCP = the H1 text, entrances done <=1.6s, no scroll-jack.

| #   | Section                         | Content / layout                                                                                                                                                                                                                                                                                                                                                                                                | Motion                                                                                                                          | Copy angle                                                                                                                                  |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Nav                             | 64px; wordmark Inter 600 14px; links 13px `--muted`; `Sign in` ghost + `Start free` indigo with `S` keycap                                                                                                                                                                                                                                                                                                      | blur ladder only                                                                                                                | quiet                                                                                                                                       |
| 1   | Hero                            | Centered Sentient H1 "Everything has a time." + one-sentence sub (Inter 16px) + CTA `Start planning` + mono honesty line `FREE - SYNCS WITH GOOGLE CALENDAR - TUE 20:43` (real local time). Below: the real DOM week grid as a slab (`--surface-1` + `--edge-machined` + floor light-line `linear-gradient(90deg, transparent, rgb(138 143 152 / .5), transparent)`), ~20 chips scattered across the whole fold | THE settle (§5): all landed 1.3s; last chip indigo + rim flash; then one unplaced chip idles in the right margin, 7s drift loop | The pitch performed, no feature copy in the fold                                                                                            |
| 2   | "Type it. It lands."            | Split: copy left, right = the real smart-input component typing `Email vendor friday 4pm`, parse spans underline in indigo, a chip settles onto a mini Friday column                                                                                                                                                                                                                                            | 4s IO-gated loop, runs once then on re-enter                                                                                    | The input is the fastest way to give a task a time. DEPENDENCY: ships only after smart parsing works (dead end-to-end today, critique §3.8) |
| 3   | "One task, three places"        | Three panels: list row, board card, calendar chip — visibly the SAME object (same color bar, same radius, same mono time)                                                                                                                                                                                                                                                                                       | on first IO entry the chip FLIPs list -> board -> grid once, 320ms hops                                                         | Move it anywhere and everywhere agrees                                                                                                      |
| 4   | "Plan without leaving the keys" | Keycap cluster (machined-edge keycaps, 11px mono) of REAL shortcuts: T, D/W/M/L, Cmd+K, Cmd+F                                                                                                                                                                                                                                                                                                                   | keycaps press themselves in sequence, once, IO-gated                                                                            | honesty: only shipped shortcuts appear                                                                                                      |
| 5   | "Thursday, as a program"        | THEME INVERSION: this section renders on `--paper` with light-formula chips — an editorial agenda of one day (Sentient "Thursday" 36px + rows: mono time, title, film chip). Proves light/dark parity on one page                                                                                                                                                                                               | rows reveal 250ms stagger                                                                                                       | the week as something you can read, Forward's program pattern                                                                               |
| 6   | Receipts                        | Mono ticker marquee 45s: `4 CALENDAR VIEWS - NATURAL DATES - RRULE RECURRENCE - GOOGLE SYNC - KEYBOARD FIRST` + one short paragraph                                                                                                                                                                                                                                                                             | ticker only                                                                                                                     | facts, no adjectives                                                                                                                        |
| 7   | Closing                         | Back to `--void`. The margin idler chip finally settles into a single slot above the CTA. Sentient: "One task is still waiting. Give it a time." CTA `Start free` + mono `NO CARD REQUIRED`                                                                                                                                                                                                                     | one 900ms settle + rim flash, IO-gated                                                                                          | rhymes with the hero; the unplaced chip = you                                                                                               |
| 8   | Footer                          | hairline, mono links 11px                                                                                                                                                                                                                                                                                                                                                                                       | none                                                                                                                            |                                                                                                                                             |

## 7. Copy voice

Rules: plain verbs, sentence case, active voice; the interface explains, never sells. No em dashes, no semicolons, ASCII only (so no middot — mono separators are spaced hyphens), no "not X but Y" constructions, no promotional adjectives (smart, powerful, beautiful, seamless), CTAs start with a verb, an action keeps one name through its whole flow (`Place` on the button -> `Placed` in the confirmation), errors say what happened and what to do, numbers are always real (live clock, true counts). NOTE: the concept sketch's "Your week, placed. Not just planned." is banned by the not-X-but-Y rule; it does not ship.

Ten sample lines:

1. H1: `Everything has a time.`
2. Hero sub: `Taskflow is a task list and a calendar on one grid. Type a task, give it a time, and your week fills in.`
3. CTA pair: `Start planning` / `Start free`
4. Honesty line (mono): `FREE - SYNCS WITH GOOGLE CALENDAR - TUE 20:43`
5. Section h2: `Type it. It lands.`
6. Feature line: `Drag a task onto Thursday. It becomes part of Thursday.`
7. Empty calendar (app): `Nothing scheduled. The week is open.` + `Press C to create an event.`
8. Empty list (app): `No tasks yet.` + `Add one below and give it a time.`
9. Day complete (app, serif): `That's everything for today.`
10. Closing: `One task is still waiting. Give it a time.`

Also fix in-app copy debt: `Create list` (not "Create Task"), task sheet aria-labels say task not event, kill `NO DUE DATE` shouting (-> `No date` 11px caps label), error toasts translate codes (`Couldn't add the task. Pick a list and try again.` instead of `VALIDATION_ERROR: ...`).

## 8. Cohesion audit: 10 landing<->app pairs

| #   | Landing side                                                                     | App side                                                                                                          | The shared thing                                                             |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Hero chips: 24% film + 0.5px full-alpha rim, radius 6, mono time + Inter title   | Dark-mode calendar event chips, same formula from the same tokens (§2.4)                                          | The chip is ONE component; the hero literally renders the app's chip         |
| 2   | FLIP settle, 900ms, `cubic-bezier(0.16, 1, 0.3, 1)`                              | Kanban drop / schedule / chip-create travel, 320ms, same curve                                                    | `--ease-settle`, the one brand curve                                         |
| 3   | Last chip lands with indigo rim flash                                            | Rim flash on every drop, placement, and created event                                                             | "placed" has one visual word                                                 |
| 4   | Sentient H1 and section heads                                                    | Sentient month name, empty states, day-complete line                                                              | serif = time at rest, both sides, never below 16px                           |
| 5   | Mono honesty line + ticker + chip times                                          | Hour gutter, chip times, counts, kbd keycaps                                                                      | Spline Sans Mono = every digit that means time                               |
| 6   | Indigo CTA, now-line on the hero grid, last chip                                 | Now-line, today pill, primary buttons, focus ring, parse spans                                                    | indigo = now/placed, nothing else                                            |
| 7   | Page void `#0B0C10`                                                              | Dark canvas `#0F1014` one ladder step up, dialog scrim = the void itself                                          | one night, hue 274-286 across every neutral                                  |
| 8   | The one unplaced chip idling in the margin                                       | The sidebar task list: unscheduled tasks waiting beside the grid, drag-in = the hero motion performed by the user | the margin IS the sidebar; the narrative tension is the product's todo state |
| 9   | Grid slab + keycaps: `--edge-machined` double hairline + penumbra `--shadow-2/3` | Cards, kanban cards, dialogs, Cmd+K, keycap hints: same tokens                                                    | one material system, one implied light source                                |
| 10  | Hero chips settle IN (chaos -> placed)                                           | Completed tasks settle OUT (sink 6px + fade + gap close)                                                          | mirrored signature: arriving into time, leaving when done                    |

## 9. Execution risks and the 3 hardest details

Risks (ordered): (1) hsl(var()) strip + `@custom-variant dark` are behavior-changing prerequisites — dormant styles appear and `dark:` utilities start following the toggle for OS-dark users; visual-diff every surface both themes before restyling. (2) FullCalendar coupling: chips must move to `eventContent` hooks without breaking drag mirrors (`--default-calendar-color`) or the `key={slotMinTime}` remounts (settle-in must be idempotent across remounts: animate only events flagged newly-created this session). (3) Sentient FOUT in-app: mitigated by size-adjusted Georgia fallback and serif appearing only at rest moments. (4) Indigo collision with user-picked blues/violets: picker palette excludes hue 250-300; now-line stays distinguishable (solid + dot + gutter label vs films). (5) Smart-input landing section depends on the parser actually working (dead today) — sequence behind that fix or cut S2. (6) Per the standing rule, every defect this spec repairs that is a live bug (month-view offset, schedule no-op, mobile dialogs/settings, folder hover) gets a gh issue when implementation starts.

Three hardest details, with mitigations:

1. **The hero FLIP on mobile (the 20-transform sample check).** Risk: 20 concurrent 900ms transforms jank on mid-range phones. Mitigation: build the hero FIRST as an isolated page and sample before any polish — Chrome DevTools 4x CPU throttle + a real Android, assert no frame >20ms during the 1.3s window (transform/opacity only, will-change applied then removed, zero layout reads after first paint). Fallback ladder already specced: <=480px scatter 12 chips instead of 20; reduced-motion path renders pre-settled. Do not proceed to sections 2-7 until this sample passes.
2. **Completion settle-out inside the transition-kill and Draggable constraints.** index.css:599-607 nukes transitions inside `.group/task`, and FullCalendar Draggable rows must never carry transforms. Mitigation: all completion motion = keyframe animations (immune to the transition kill) on an inner wrapper; calendarMode degrades to opacity-only; verify drag-to-calendar still produces clean mirrors after the change (that kill rule exists because ghosting was real).
3. **Chip film legibility across 10 user hues x 2 themes x arbitrary legacy colors.** 24%/12% films with derived text can fail contrast for old stored hexes (users predate the curated palette). Mitigation: derive text via relative color with clamped lightness (dark L=0.82, light L=0.50); validate all 10 curated hues both themes against 4.5:1 at build time (script, not eyeballs); runtime guard for legacy colors — if derived contrast <4.5:1, fall back to `--ink` text + stronger 32% film. Sample one real seeded account before rollout.

## 10. Self-critique (where this drifted generic, and the fixes)

Ran the calibration check: would a default pass at "dark landing + productivity app" produce this? Findings and corrections applied above:

- **Near-black + single accent is AI-default cluster #2.** As sketched, SETTLE could collapse into "black page, indigo glow". Fix already in the system: indigo is rationed to now/placed (never a wash or gradient), the color story is carried by many-hued user chips as translucent films, and S5 inverts the page to paper mid-scroll — the landing is two-theme, which the default never is.
- **Status rings were a straight Linear lift.** Derivative as specced in Direction A. Fixed in §4.1: the ring fills with the row's LIST color so completion belongs to the chip system, not to a borrowed brand glyph.
- **Dropping General Sans is a deliberate deviation from the concept sketch** (4 faces -> 3). Reason: one working sans across landing and app is the strongest cohesion move available, Inter is already native at 13px, and the personality budget is fully spent on Sentient + mono + settle. Risk: Inter body reads default; mitigation: Inter never appears above 16px on the landing except UI labels — all display is serif, all facts are mono. Flagging this explicitly for the owner since it edits the approved sketch.
- **The unplaced idler chip could be a gimmick** (decoration pretending to be narrative). Kept only because it resolves: it is the sidebar metaphor (pair 8) and it settles in the closing section. Rule added: it never animates on scroll, never follows the cursor — it just waits.
- **Serif empty states risk preciousness at scale.** Capped: one serif line per surface, the second line always plain Inter with an action. If an empty state cannot offer an action, it does not get the serif.
- **"Everything has a time." + agenda rows could read as any calendar ad.** The specific defense is honesty instrumentation the template never has: the hero clock is the visitor's real time, the now-line is live, shortcuts shown are real, and the ticker lists only shipped facts. If any of those become fake during implementation, cut the element rather than fake it.
- Remaining open risk I could not resolve on paper: whether Sentient 300 at 72px over `#0B0C10` has enough optical weight against 24%-film chips (thin serifs can go wiry on dark). Decide at first build: if wiry, step hero to Sentient 400 and tighten tracking to -0.025em. Tune one variable, compare, keep the winner.
