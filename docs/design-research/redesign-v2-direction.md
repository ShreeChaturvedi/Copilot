# Landing v2 direction — dark editorial upgrade (2026-07-02)

This document governs the landing-page redesign. It sits ON TOP of `design-brief.md` (SETTLE, aqua): every token, type role, motion curve, honesty rule, and cohesion pair in that brief still binds unless this document explicitly amends it. Where the two disagree, THIS document wins. Owner direction: dark modern editorial, factory.ai-level effort, keep the copy voice (clear, simple, catchy), upgrade everything around it. The current page's weakness is too much text and too few assets, icons, animation, and moments of creativity.

Required reading for every design/implementation agent, in order:

1. This document.
2. `design-brief.md` sections 1-3, 5, 6, 7 (tokens, type, motion grammar, landing spec, copy voice).
3. The recon notes named in your section's assignment below, from `/home/shree/dev/taskflow-calendar/landing/research/<site>/notes.md`. All raw JS/CSS assets and screenshots live next to each notes file.
4. Current implementation: `/home/shree/dev/taskflow-calendar/landing/src/` (Astro, one component per section).

## 1. What stays true (non-negotiable)

- Token system verbatim from design-brief §2: `--void` page bg, surface ladder, chip alpha-film formula, curated hue ladder `oklch(0.64 0.15 H)`, machined edges, radius scale.
- The aqua law is RELAXED (owner, 2026-07-02): aqua-as-the-one-accent is no longer mandatory. Designers may mute the accent toward charcoal/graphite/dark-gray chrome (the Linear/Factory/108 monochrome register: off-white primary CTAs, graphite surfaces, hue rationed to a few moments). What survives in any treatment: ONE consistent "live/placed" signal used for the now-line, rim flash, parse highlights, and today (whether that signal is aqua, a dimmer aqua, or off-white is a design choice); it is never decoration; user-hue chips stay on the curated ladder. If a section keeps aqua, keep it meaning live/placed only.
- Three type voices: Sentient = time at rest (never <16px, never interactive, never a digit). Inter = the hand. Spline Sans Mono = every time-numeral, count, shortcut, annotation. Fonts shipped: Sentient 300/400, Inter 400-600 variable, Spline Sans Mono 400-500. No new font families.
- Motion grammar §5: `--ease-settle: cubic-bezier(0.16,1,0.3,1)` is THE brand curve. Nothing bounces. No ease-in. No `transition: all`. Transform/opacity/clip-path only (filter allowed for blur-focus reveals, used sparingly). Reduced motion wraps everything: page renders complete and settled without JS or motion.
- Honesty instruments: mono lines state only verifiable facts (real local clock, real dates, shipped features). The type-it demo may only show what the shipped parser does (see §4.3 parser truth).
- Perf budget §6: fold <=500KB, LCP = H1 text, entrance choreography done <=1.6s, no scroll-jack, Lighthouse perf >=0.95 / a11y 1.0. Static Astro, vanilla JS only, no animation libraries (no GSAP/Framer/Lenis). Astro `is:inline` scripts per component plus one shared helper file.
- Copy: the existing page copy is APPROVED AND KEPT VERBATIM except where §4 below explicitly replaces it (DayProgram section copy, type-it demo prompts, receipts ticker text). New copy follows design-brief §7 voice: plain verbs, sentence case, no promotional adjectives, no em dashes, no semicolons, ASCII only.

## 2. The v2 upgrade grammar (page-wide amendments)

These are new page-wide materials and motion devices, distilled from the recon. Use them consistently so the page reads as one system.

2.1 **Drawn instrument lines** (NEW page motif). Thin SVG paths (1-1.5px, `vector-effect: non-scaling-stroke`) that draw and undraw via stroke-dasharray/dashoffset. Appearances: hero fall-path traces, the three-places connector/brace, closing arrival path, icon marquee glyphs. Line color: `color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent)` (aqua-phosphor, dim) for geometry; full `--aqua` reserved for live moments per the aqua law. This amends design-brief §2.5: static etch backgrounds stay app-only, but drawn-line GEOMETRY is now the landing's connective tissue.

2.2 **Penumbra shadows.** Replace single box-shadows on floating objects (slab, keycaps, closing frame) with the 3-tier stack (from forward/factory recon): `0 0.6px 1.6px -1.5px rgb(0 0 0/.5), 0 2.3px 6px -3px rgb(0 0 0/.4), 0 10px 26px -4.5px rgb(0 0 0/.28)` (values tuned darker for the void). Token it as `--shadow-penumbra`.

2.3 **Continuous scroll-progress driver** (Linear mechanism, `research/linear/notes.md` Motion section). One shared ~1.5KB vanilla helper: on scroll (passive, rAF-throttled), compute 0..1 progress per registered element and write it to a `--progress` custom property; CSS reads it. Used for: section reveals that feel syrupy instead of snap-triggered, the clock section hue state, marquee edge behavior. IntersectionObserver stays for one-shot triggers (play-once demos). Both live in `src/scripts/motion.js` (new shared file) with a reduced-motion early-out.

2.4 **Edge fade masks.** Every horizontally scrolling/cycling rail (icon marquee, key rail) fades at both ends via `mask-image: linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)`. Nothing hard-clips.

2.5 **Blur-focus reveal** (Forward). For a FEW hero-tier text moments only: enter at `opacity:.001; filter:blur(10px); translateY(10px)` resolve to sharp over ~600ms `--ease-settle`. Do not apply to every reveal; default reveal stays the existing 14px rise.

2.6 **Two-tempo motion.** Fast layer: 240-880ms entrances on the brand curve. Slow ambient layer (the page breathes): idler drift, icon marquee ~50s linear, clock sweep ~24s linear, key rail drift. Max one ambient loop visible per viewport. All ambient loops pause off-screen (IO-gated) and die under reduced motion.

2.7 **Glass and metal recipes.** Nav capsule and keycaps get the inset top-highlight trick: `box-shadow: inset 0 1px 0 rgb(246 248 248/.10)` layered over `--edge-machined`. Hover on glass makes it MORE opaque, not lighter (Obsidian). CTA buttons: KILL the current neon glow (`box-shadow: 0 0 28px aqua`) everywhere. Primary CTA = filled `--aqua` with `--aqua-ink` text, machined edge, penumbra shadow, hover to `--aqua-hover`, active scale .97. It should read as a lit instrument key, not a neon sign.

2.8 **Numbered structure stays out.** No 01/02/03 section numbering (content is not a sequence). Eyebrows only where they add information.

## 3. Page narrative (section order and what each proves)

1. **Nav** — the instrument rail. Proves craft before a word is read.
2. **Hero** — chaos becomes a week (THE settle, now with traced paths and draggable chips). Proves the product's one loop.
3. **Type it. It lands.** — the smart input performs real parsing on a loop. Proves capture speed.
4. **One task, three places.** — one object across list/board/week, with an end state that binds them. Proves the data model.
5. **Plan without leaving the keys.** — cycling MacBook-grade keys drive a live app mock. Proves keyboard-first.
6. **It comes back around** (REPLACES "Thursday, as a program" light inversion) — the recurrence clock with OKLCH hue sweep. Proves RRULE recurrence, and carries the page's one full-color moment.
7. **Icon receipts** (REPLACES text ticker) — drawn glyphs of shipped features drifting in a masked rail.
8. **Closing** — the waiting chip finally lands; restyled CTA. The page asks once.
9. **Footer** — unchanged, hairline + mono.

The light-theme inversion section is CUT entirely (owner: blasting white mid-page is wrong). Light/dark parity is no longer argued on the landing.

## 4. Section requirements (owner asks are MUSTs)

### 4.0 Nav + logo (`Nav.astro`)

MUSTS: icon must not read as a button; icon+wordmark read as ONE designed logo; nav bar dramatically more crafted; study `research/navbars/notes.md` (10-site teardown + 3 concepts) and `research/linear/notes.md` nav teardown.
Direction: two candidate shapes — (A) floating machined capsule inset from edges (Raycast/Obsidian recipe on SETTLE tokens: transparent bg + blur(8-12) + hairline + inset top highlight, height 60-64, radius 12; progressive blur ladder retired or moved under the capsule) vs (B) full-width state-machine bar (Linear: transparent until scrolled, then 1px hairline fades in; blur always on; keep the existing progressive blur ladder). Logo: redraw as a single SVG lockup — a week-grid/chip mark whose geometry relates to the wordmark letterforms; wordmark either vectorized Sentient 400 paths (opentype.js route: download Sentient TTF from Fontshare, convert once, commit the path) or an HTML lockup so optically tuned it reads drawn (tight tracking, shared baseline, mark aligned to cap-height). The mark's aqua bar = the settled chip. Consider the honesty instrument: live mono clock (`THU 17:42`) in the right cluster. Links get pill-highlight hover (Linear) not underlines. Three-tier CTA hierarchy: text link (Sign in), filled aqua (Start free, de-glowed). Mobile: links collapse; keep 44px targets.

### 4.1 Hero (`Hero.astro`)

MUSTS: (a) settle animation SMOOTH (currently jittery); (b) thin curved paths tracing each chip's fall — lines draw then undraw, staggered start AND duration; (c) "Plan the trip" idler gets a real purpose or dies; (d) chips DRAGGABLE (no persistence needed; drag -> snap to a free slot -> rim flash).
Direction: smoothness = WAAPI or single-transition FLIP with precomputed transforms, `translate3d`, layers promoted before start and released after, stagger 40ms, all landed <=1.3s, zero layout reads mid-flight; test at 4x CPU throttle, no frame >20ms (design-brief §9.3.1). Fall paths: one SVG overlay spanning the slab area; per chip a quadratic bezier from scatter origin to slot; stroke draws ahead of the chip and undraws behind it (dashoffset animation synced to the chip's delay/duration); dim phosphor tone per §2.1, the aqua chip's path may be `--aqua-rim`. Idler purpose (leading idea, agents may beat it): the idler IS the drag tutor and the narrative tension — one unplaced chip idling in the margin; it is draggable onto the grid, settles + flashes where dropped; if never dragged it keeps waiting, and the closing section pays it off ("One task is still waiting."). Drag implementation: pointer events on chips, grid snap (5 columns x 30-min rows via math, no library), lift state = solid `--chip-c` + white text + penumbra + scale 1.03 rotate 1.5deg (matches app §4.3 pickup), release = 320ms settle + rim flash. Touch: drag enabled but never blocks vertical scroll (activate after 6px horizontal intent or long-press). Keep: H1, sub, CTA row, honesty clock, real dates, now-line. The mono honesty line may gain `DRAG A CHIP` hint after first hover of the slab (only if true, i.e. pointer device).

### 4.2 Type it, it lands (`TypeIt.astro`)

MUSTS: real animation loop (type -> parse-reveal -> hold -> untype -> next persona), fluid and intricate tag reveals, more complex real-world prompts, personas weighted to students first plus school kids, mothers, dads, tech professionals, business people.
Parser truth (the demo may show ONLY these, verified in `src/components/smart-input/parsers/`): chrono-node dates/times/ranges with forwardDate ("friday 4pm", "tomorrow morning", "jun 12 9-11am", "next tuesday"); PriorityParser keywords (urgent/asap/important -> HIGH, "when possible"/someday -> LOW); CompromiseNLPParser people ("with Ana"), places/locations ("at the library"), semantic labels (doctor/dentist/family/grocery -> personal, standup/review -> work-ish). Recurrence phrasing is NOT parsed by the smart input (RRULE is set in the dialog) — do not show "every week" being tagged.
Architecture (from `research/automl-pattern/notes.md`, follow it): single Phase union state machine, one persona array, char-interval typing 35-45ms (backspace 12-18ms), caret = 1.5px bar with the hard-step blink (Linear: opacity 1 at 0-49%, 0 at 50-99%, 1.25s), tag chips pop with 100ms ease-out + bright-flash-then-settle color (placeholder-char-in idiom), adjacent parse spans use the Linear `:has()` radius-merge so multi-token highlights read as one; loop gated by a visibility observer (pause off-screen, never a one-shot latch); reduced motion renders persona 1 fully parsed, static. The offer row ("Place on Friday, 4:00 PM ⏎") updates per persona and the mini column shows the chip landing each cycle, then resets during untype. Personas (5-6, in weight order): student, school kid, mother, father, tech professional, business person. Each prompt is one nuanced sentence a real person would type, exercising a different parser capability (person, place, priority, range). Keep h2 + body copy verbatim.

### 4.3 One task, three places (`ThreePlaces.astro`)

MUSTS: legibility (currently unclear what is happening); an end state (currently the traveler just vanishes). Owner's brace idea: a drawn curly brace sweeping across, visually connecting the three views (explicitly optional — beat it if you can).
Direction: slow the choreography down and spotlight it: the three panels render dim (60% opacity); the traveler performs list -> board -> week with a longer beat per anchor (~700ms dwell), the ACTIVE panel lifts to full opacity + machined edge brightens while the others stay dim; the `|-- 90 MIN --|` dimension annotation rides along (keep, it is brand). Between anchors, a drawn instrument line traces the hop path (draw ahead, undraw behind, per §2.1). End state candidates: (1) under-brace: after the final land, an SVG curly brace draws left-to-right spanning all three panels with a centered mono label beneath (e.g. `SAME OBJECT - SAME TIME`), then holds; (2) triple-pulse: all three instances rim-flash in sequence and a persistent hairline connects them. The brace fits SCHEMATIC's dimension-annotation heritage; agents choose and justify. Panels themselves get real content upgrades: the list panel shows 3 rows (the traveler's row + 2 muted), board shows 2 columns with the card in TODO, week fragment as-is — so each surface reads as a real place, not an empty specimen box. Replays on re-entry (not once): IO toggles, full reset between runs, ~10s cycle with a visible progress hairline under the stage (Obsidian slider pattern) OPTIONAL if it aids legibility. Keep h2 + body copy verbatim.

### 4.4 Plan without leaving the keys (`Keys.astro`)

MUSTS: keys CYCLE through a rail fading at left/right edges; each key looks like a REAL MacBook key (materials so convincing users want to touch them — this is the entire point); as each key arrives and presses, the right side shows the actual app responding; transitions morph through each other, never stitched clips.
Direction: layout = key rail (left, ~40%) + app stage (right, ~60%). Rail: keys drift leftward continuously (transform loop) with §2.4 edge masks; the key hitting the center "press zone" presses itself (translateY 2px + shadow compression + face brightness dip), fires the app stage. MacBook key material (build one `.keycap-xl` component, ~72-84px): rounded 10-12px, layered gradients for the concave face (subtle radial highlight upper-left), side walls via inset shadows (light top inset, dark bottom inset 2px), penumbra drop shadow, legend in Spline Sans Mono centered (⌘K two-glyph layout: small ⌘ above-left conventions optional), `@media (max-resolution:1.5dppx)` fallback per token system. Reference recipes: forward triple-shadow, supply108 glass bevel (`inset 0 -1px 1px rgb(0 0 0/.05), inset 0 1px 0 rgb(255 255 255/.08)`), dreamtype `--ease-out-back cubic-bezier(0,0,.85,1.25)` reserved solely for the key-press release. App stage: ONE mock component whose chips/rows FLIP between layouts (day/week/month/list/command-bar states for T, D, W, M, L, N, ⌘K): the same 4-6 chip elements re-layout via FLIP transforms (measure both layouts, transform-play), 480ms on the brand curve, so views morph through each other — never crossfade-only, never video. ⌘K raises the command bar overlay over the mock with the void scrim (design-brief §4.6). N spawns a new row that settles in. Real shortcuts only (`useGlobalShortcuts.ts`: ⌘K, T, D, W, M, L, N). Cycle ~3.5s per key, IO-gated, pauses off-screen. Reduced motion: static key row + static week view. Keep h2 + body copy verbatim.

### 4.5 The recurrence clock (`DayProgram.astro` -> rename concept; REPLACES light-mode showcase)

MUSTS: no white blast — stays on the void; a sweeping clock hand drives a rainbow-hue radial gradient where hues shift and blend smoothly (OKLCH); copy/framing must communicate something real (light mode as a feature is banned).
Direction (leading concept, agents may sharpen): **recurrence performed**. A large drawn-line clock dial (instrument lines per §2.1: tick ring, hairline hand); the hand sweeps continuously (~24s/rev, linear, a clock hand does not ease). A radial/conic gradient bloom keyed to the hand angle drifts through the CURATED HUE LADDER — the sweep interpolates `oklch(0.64 0.15 h)` around the wheel (the product's own list colors, in oklab/oklch space via `in oklch longer hue` gradient interpolation or a rAF-written `--hue` custom property; see automl notes hue-cycling snippet). The bloom sits BEHIND the dial via `mix-blend-mode: screen` (Obsidian technique) so chrome stays monochrome and only the light is colored; chroma kept moderate so it reads editorial not carnival. Around the dial, 3-4 recurring chips at their hours ("Standup MON 9:00 - weekly", "Rent 1st - monthly", "Gym - every other day"): as the hand passes each, it re-lights (film brightens + rim flash) — recurrence enacted. Copy REPLACED (proposal, final wording flagged to owner): h2 `It comes back around.` body `Repeat a task weekly, monthly, or on your own rule. When its time comes back, Taskflow puts it back on the grid.` mono receipt `RRULE - WEEKLY - MONTHLY - CUSTOM`. Honesty: RRULE recurrence genuinely ships (`src/utils/recurrence.ts`). Hue mechanics: single rAF loop writes `--clock-angle`; hand rotation AND gradient hue read from it (never two unsynced animations). Reduced motion: static dial at a fixed pleasant angle, static soft bloom, chips lit.

### 4.6 Icon receipts (`Receipts.astro` REBUILT)

MUSTS: the scrolling TEXT is cut; if anything scrolls it is ICONS.
Direction: a slow marquee (~50s linear, duplicated track, §2.4 edge masks, pauses off-screen) of drawn-line glyphs (1.5px stroke, phosphor-dim, 28-32px) each with an 11px mono caption beneath: WEEK GRID, NATURAL DATES, RECURRENCE, GOOGLE SYNC, KEYBOARD FIRST, COMMAND BAR, LIST, BOARD, MONTH, NOW LINE. Glyphs custom-drawn inline SVG in one shared sprite (week grid fragment, calendar chip, loop arrow, sync arrows, keycap, ⌘ bar, list rows, board columns, month dots, now-line dot+line) — same stroke grammar as the hero paths and the clock dial. Each glyph draws itself in (dashoffset) the first time it enters the viewport. Facts only (all shipped). sr-only sentence kept for a11y.

### 4.7 Closing (`Closing.astro`)

MUSTS: CTA must not look like a neon sign (de-glow per §2.7); more effort/animation on the app component.
Direction: the payoff scene. The SAT slot frame sits center; the "Plan the trip" chip arrives from the hero's margin direction along a DRAWN PATH (the same instrument-line grammar: path draws, chip travels it, path undraws, rim flash, then the nowline ticks once beneath) — if the visitor already dragged the idler into the hero grid, the closing chip renders pre-settled and the headline swaps to the settled variant (`Every task has its time.` — flag as copy proposal) via a sessionStorage flag; default experience unchanged otherwise. Headline + CTA stack unchanged in structure; `Start free` restyled per §2.7 (machined aqua key, no glow); `NO CARD REQUIRED` mono stays. Consider a faint week-grid hairline ghost behind the section (very dim, non-etch geometry) to close the loop with the hero slab. Keep copy verbatim except the optional settled-variant headline.

### 4.8 Footer (`Footer.astro`)

Unchanged content. May inherit the drawn-glyph mark at 12px before the builder credit. Nothing else.

## 5. Shared foundation (built FIRST, one owner)

- `src/styles/global.css`: add `--shadow-penumbra`, keycap material tokens, phosphor line tokens (`--line-dim`, `--line-live`), marquee/rail mask utility, de-glowed `.btn-primary`, blur-focus reveal utility (`[data-reveal="focus"]`), progress-driven reveal hooks. Nothing existing removed without reason; light `.theme-light` block may be deleted with the section that used it.
- `src/scripts/motion.js` (NEW, loaded once, deferred): reduced-motion guard, `onVisible(el, cb, {once, threshold})`, scroll-progress driver (`registerProgress(el, opts)` writing `--progress`), `drawPath(pathEl, {delay, duration, undraw})` helper for stroke-dash choreography, tiny FLIP helper (`flipBetween(el, fromRect, toRect, opts)`), and a shared rAF ticker. Target <6KB min. Section scripts stay `is:inline` per component but may import nothing — they read `window.TF` set by motion.js (Astro static, no bundler coupling for inline scripts).
- `Layout.astro`: load motion.js, keep font preloads, keep skip-link and `html.js` gate.

File ownership (implementation phase, disjoint): foundation = global.css + Layout.astro + motion.js + index.astro; then one agent per component file. No agent touches another's file; shared needs route through the foundation file contract above.

## 6. QA gates

Per design-brief §9.1: every section agent screenshots its own section at 1440 and 390 against the LIVE dev server (Astro, port 4321), critiques against this direction + its spec, iterates before finishing. Playwright-cli sandbox note: run all playwright commands with cwd `/home/shree/dev/taskflow-calendar` so screenshots can be written into the repo (`landing/research/_qa/<section>/`). Full-page integration gate afterward: hero smoothness at 4x CPU throttle, reduced-motion pass, keyboard-only pass, 360px overflow check, Lighthouse.
