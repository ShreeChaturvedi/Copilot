# Keys — "Plan without leaving the keys." — Section spec v2

Owner section 4.4 / narrative slot 5. Governs `landing/src/components/Keys.astro`. Reads on top of
`redesign-v2-direction.md` §4.4 and `design-brief.md` (tokens §2, type §3, motion §5). Copy (h2 + body) is
verbatim, unchanged from current implementation.

**Accent decision (stated for the coherence audit):** aqua is NOT muted in this section. `--aqua` stays at
its design-brief value and means exactly one thing here, same as everywhere else: live/placed. It never
touches the physical keycap material (a real MacBook key doesn't glow when you press it — that would be a
lie the honesty law forbids). It appears only in the app-stage's own product chrome, in the same four places
the app already uses it: the today disc/nowline (T/D), the new-row rim flash (N), and the Cmd+K panel's
single sanctioned aqua ring (⌘K, design-brief §4.6). Keycap materials are pure graphite/charcoal
(`--surface-1`/`--surface-2` neutrals). This keeps Keys visually inert (all-neutral hardware) except for the
one live signal lighting up on the other side of the section, which is the whole argument of "press a key,
watch the app answer."

---

## Concept

**KEY DECK.** An instrument-grade row of MacBook keycaps drifts continuously right-to-left through a fixed
press zone; the key crossing that zone presses itself, and in the same instant a live app mock on the right
morphs — the same five task chips re-laid-out, FLIP-style — into the view or action that key actually
performs in the shipped app. The keyboard is the cause, the app is the visible effect, both on screen at
once, at typewriter-drift speed rather than snapped-in slides. Copy already frames this ("plan without
leaving the keys") — the layout makes cause and effect a single eye-span instead of a claim.

Two directions were developed. **Runner-up — "TYPE BAR":** a full-width keyboard deck stacked ABOVE a
full-width app-stage below it (mirroring real desk geometry: keyboard under your hands, screen above). It
lost because proving "keyboard-first" depends on seeing the keypress and the app's reaction in one glance;
stacking them vertically forces a scan between two disconnected eye-lines and makes the keyboard — a
non-reading element — compete with the section's own h2/body copy for the top of the section, which the
side-by-side KEY DECK never has to do.

---

## Layout

Container: the shared `.container` (max-width 1080px, 24px inline padding, centered). Inside it, a new
`.keys-layout` grid sits below the existing `.copy` block.

**Desktop ≥1024px** (numbers given at 1440 viewport, where `.container` renders at its 1080px cap):

```
.keys-layout {
  display: grid;
  grid-template-columns: 400px 1fr;   /* rail 400px, app-stage fills remainder (632px at 1080 container) */
  gap: 48px;
  align-items: center;
  margin-top: 48px;
}
```

- Rail column: fixed 400px. Rail viewport (the masked visible strip) is the full 400px, height 160px.
- App-stage column: `1fr` (632px at 1080-wide container). Stage card is full column width, fixed height
  400px (40px header + 16px padding + 288px canvas + 16px padding, rounded to 400 for a clean number — see
  Visual spec for the exact box model).

ASCII wireframe, 1440 (content shown at the 1080px container cap):

```
+---------------------------- container (1080px) ----------------------------+
| Plan without leaving the keys.                                             |
| The whole calendar answers the keyboard. Jump to today, switch views,      |
| start a task, or open the command bar and type where it should go.        |
|                                                                             |
| +-------- rail 400x160 --------+   +---------- app stage 632x400 -------+ |
| |edge  ¦     [D]  [W]     ¦edge|   | WEEK           mono: JUL 6 - JUL 10 | |
| |fade  ¦  bracket brackets¦fade|   | +---------------------------------+ | |
| |          ^ press zone        |   | | MON  TUE  WED  THU  FRI          | | |
| |     (rail-center, x=200)     |   | | 9         [blue]      [orange]   | | |
| +-------------------------------+   | | 12   [violet]    [green]        | | |
|   keys drift right -> left,         | | 15                     [indigo] | | |
|   labels ride under each key        | +---------------------------------+ | |
|                                      +---------------------------------------+ |
+------------------------------------------------------------------------------+
```

**Mobile ≤640px** (390px viewport, `.container` padding drops to 16px → 358px content width). Stack:
rail full-width on top, app-stage full-width below, both scaled down. No horizontal two-column split below
1024px (the rail-plus-stage side-by-side reading only works with room to see both at once; below that width
they stack and the reader scans top-to-bottom, which is fine because at this width there is no competing eye
line — the section is already a vertical scroll).

```
.keys-layout { grid-template-columns: 1fr; gap: 28px; }   /* @media (max-width: 1023px) */
```

```
+------- 390px viewport (content 358px) -------+
| Plan without leaving the keys.                |
| The whole calendar answers the keyboard...    |
|                                                |
| +------- rail 358x120 -------+                |
| |fade   [T]    [D]    fade   |                |
| |         ^ press zone        |                |
| +------------------------------+                |
|                                                |
| +------- app stage 358x260 --+                |
| | WEEK         JUL 6          |                |
| | +--------------------------+ |                |
| | |M  T  W  T  F            | |                |
| | |      [x]      [x]       | |                |
| | |  [x]      [x]           | |                |
| | +--------------------------+ |                |
| +--------------------------------+                |
+------------------------------------------------+
```

Rail at mobile: keycap 56×56 (down from 80×80), gap 24px (down from 32px), rail viewport height 120px. App
stage at mobile: card 358×260 (40px header + canvas 358×204 minus padding), chrome type drops one size step
(11px→10px mono), month-grid cells shrink proportionally. All geometry below is formula-driven (see Motion
timeline), so mobile is a re-measure, not a re-derivation.

Breakpoint: 1024px is the cut (matches the two-column-to-stack pattern used elsewhere on this page; below it
there isn't width for a legible 400px rail beside a legible app-stage).

---

## Visual spec

### The keycap (`.keycap-xl`)

One component, reused for all 7 keys (⌘K included — **kept at real MacBook proportions, not squared off**,
because "look like a real key" is the literal point of the section). Two sizes: standard 80×80px (T, D, W,
M, L, N), wide 132×80px (⌘K). Mobile: 56×56 / 92×56.

Material stack, outer element:

```css
.keycap-xl {
  position: relative;
  width: 80px;
  height: 80px; /* 132x80 for .keycap-xl--wide */
  border-radius: 11px;
  isolation: isolate; /* so the socket pseudo-element stacks correctly */
  background:
    radial-gradient(
      120% 140% at 30% 18%,
      rgb(246 248 248 / 0.05),
      transparent 55%
    ),
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--surface-2) 100%, white 4%) 0%,
      var(--surface-2) 46%,
      color-mix(in oklab, var(--surface-2) 100%, black 12%) 100%
    );
  box-shadow:
    var(--edge-machined),
    inset 0 1px 0 rgb(246 248 248 / 0.1),
    /* top face highlight, catches the implied light */ inset 0 -3px 0
      rgb(0 0 0 / 0.45),
    /* bottom skirt — the key's "wall" depth cue */ inset 1px 0 0
      rgb(246 248 248 / 0.03),
    /* left wall, faint */ inset -1px 0 0 rgb(0 0 0 / 0.25),
    /* right wall, shaded away from the light */ var(--shadow-penumbra); /* 3-tier penumbra, direction §2.2 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 22px; /* 18px for --wide (⌘K, two glyphs) */
  font-weight: 500;
  color: var(--ink);
  transition:
    transform 90ms var(--ease-out),
    box-shadow 90ms var(--ease-out),
    background 90ms var(--ease-out);
}

/* the socket: a darker recessed plate sitting behind/below the face, implies
   a switch housing the key travels into (forward/supply108 triple-shadow lineage) */
.keycap-xl::before {
  content: '';
  position: absolute;
  inset: 2px -2px -7px -2px;
  background: var(--surface-1);
  border-radius: inherit;
  z-index: -1;
  box-shadow: inset 0 -2px 4px rgb(0 0 0 / 0.5);
}
```

Pressed state (`.is-pressed`, added by JS at the scheduled moment — see Motion timeline):

```css
.keycap-xl.is-pressed {
  transform: translateY(2px);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--surface-2) 92%, black) 0%,
    color-mix(in oklab, var(--surface-2) 86%, black) 100%
  ); /* face brightness dips */
  box-shadow:
    var(--edge-machined),
    inset 0 1px 0 rgb(246 248 248 / 0.05),
    inset 0 -1px 0 rgb(0 0 0 / 0.5),
    /* skirt collapses to 1px: the key sits low */ 0 0.5px 1px -0.5px
      rgb(0 0 0 / 0.4); /* shadow compresses toward the surface */
}
```

Press-in transition: `transform 90ms var(--ease-out)` (inherited from the base rule, already applied when
`.is-pressed` is added). Release transition (**this is the one and only use of the dreamtype ease-out-back
in the whole redesign** — reserved per the direction doc): JS swaps the inline `transition` to
`transform 220ms cubic-bezier(0,0,.85,1.25), box-shadow 160ms var(--ease-out), background 160ms var(--ease-out)`
immediately before removing `.is-pressed`, giving the key a small mechanical rebound as it returns to rest —
the only overshoot anywhere on the page.

`@media (max-resolution: 1.5dppx)`: bump the 0.5px inset lines in `--edge-machined` per the existing global
override (already handled by the token, no component-local change needed); additionally step the skirt inset
from `-3px`/`-1px` to `-4px`/`-2px` so the depth cue survives at low DPI.

Legend: `⌘K` rendered as one string, not stacked glyphs (matches current shipped markup, simplest and
legible at 18px in a 132px-wide key). Legend color `--ink` at rest; unchanged when pressed (materials
respond, color does not — no aqua on the key, per the accent decision above).

Label under each key: unchanged from current implementation — 12px Inter, `--ink-muted`, centered, sits in
normal flow below the keycap (real text, not decorative, see Accessibility).

### The rail

```css
.rail {
  position: relative;
  height: 160px;
} /* 120px mobile */
.rail-viewport {
  position: relative;
  overflow: hidden;
  height: 100%;
  mask-image: linear-gradient(
    to right,
    transparent,
    black 64px,
    black calc(100% - 64px),
    transparent
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    black 64px,
    black calc(100% - 64px),
    transparent
  );
}
.track {
  position: absolute;
  top: 24px;
  left: 0;
  display: flex;
  align-items: flex-start;
  gap: 32px;
  list-style: none;
  margin: 0;
  padding: 0;
  will-change: transform;
}
```

(24px mobile mask inset, not 64, since the viewport itself is only 358px — `mask-image: linear-gradient(to
right, transparent, black 24px, black calc(100% - 24px), transparent)`.)

Press-zone bracket marks (static, decorative, `aria-hidden`): two 1px hairline ticks, one above and one below
the rail-viewport, centered at x=200px (rail-center), 12px tall, `var(--hairline-strong)`, no fill — a
schematic viewfinder cue borrowed from the page's own dimension-annotation grammar (ThreePlaces' `|-- 90 MIN
--|`), so the visitor's eye knows where to watch without a spotlight cliché:

```css
.rail-bracket {
  position: absolute;
  left: 200px;
  width: 1px;
  height: 12px;
  background: var(--hairline-strong);
}
.rail-bracket-t {
  top: 0;
}
.rail-bracket-b {
  bottom: 0;
}
```

(Mobile: `left: 179px` — half of 358px.)

### The app stage

One card, same slab grammar as the hero (`--surface-1` + `--edge-machined` + `--shadow-penumbra`), smaller:

```css
.stage-card {
  background: var(--surface-1);
  border-radius: 12px;
  box-shadow: var(--edge-machined), var(--shadow-penumbra);
  height: 400px; /* 260px mobile */
  display: flex;
  flex-direction: column;
}
.stage-header {
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--hairline);
}
.stage-view {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}
.stage-date {
  font-size: 11px;
  color: var(--ink-muted);
} /* mono, real dates — see below */
.stage-canvas {
  position: relative;
  flex: 1;
  margin: 16px;
} /* 568x288 at desktop, 326x148 mobile */
```

Chip material (`.mock-chip`): the existing `.chip` alpha-film formula verbatim (`background: color-mix(in
oklab, var(--chip-c) 24%, transparent); box-shadow: inset 0 0 0 0.5px var(--chip-c); color: oklch(from
var(--chip-c) 0.82 min(c,0.1) h); border-radius: 6px`), `position: absolute`, geometry set per-view (see
Motion timeline). Colors: five curated hues already in `global.css` — blue, violet, indigo, green, orange —
deliberately excluding the sixth curated hues used elsewhere (magenta, yellow) so this section's palette
reads as its own small set, and excluding aqua entirely (aqua stays reserved).

Chip content: `<span class="c-t mono">{time}</span><span class="c-ti">{title}</span>`, identical markup to
Hero/ThreePlaces chips — the same object grammar carried a third time (cohesion pair, design-brief §8.9).

Task set (5 persistent chips, reused across every view via FLIP, never re-created):

| #   | title         | day | start | dur | hue    |
| --- | ------------- | --- | ----- | --- | ------ |
| 0   | Standup       | MON | 09:00 | 30m | blue   |
| 1   | Design review | TUE | 11:00 | 60m | violet |
| 2   | Ship v2       | WED | 14:00 | 90m | indigo |
| 3   | Gym           | THU | 08:30 | 45m | green  |
| 4   | Budget pass   | FRI | 16:00 | 30m | orange |

"Today" for the Day/T view = chip #2 (Ship v2, Wed) — arbitrary but fixed, so the demo always tells the same
small story. The N-spawned sixth chip is **"Email vendor"** — the exact title of the hero's aqua live chip
(`Hero.astro`'s `liveChip`), a deliberate callback: the task the visitor watched land in the hero reappears,
freshly "created," in this section's keyboard demo. Its hue is aqua (it is, at that instant, newly placed).

Chrome per view (all mono, `--ink-muted` unless noted):

- **Week** (`W`): day headers `MON TUE WED THU FRI` (11px caps 600) in a 40px header row inside the canvas;
  hour gutter `9 / 12 / 15` (11px mono) at left, 40px wide; 5 columns of `(568-40)/5 ≈ 105.6px` each; hour
  gridlines via the same `repeating-linear-gradient` recipe as Hero's `.cols`. `--stage-date` reads the real
  Mon-Fri dates of the current week (`JUL 6 - JUL 10` style, computed client-side, same helper pattern as
  `Hero.astro`'s date script — honesty law: real dates, fictional demo tasks, exactly Hero's own precedent).
- **Day** (`T`, `D`): single column, x 40-500px (460px wide), today's chip (#2) at natural size inside it;
  the other 4 chips recede to an "orbit dock" — four 48×16px color tabs (no text, `.chip` fill only) stacked
  at x 512-560px, 8px gaps, top-aligned. `T` additionally rim-flashes the day header's date disc (24px aqua
  disc, same fixed-size disc as the app's today treatment, design-brief §4.4) since T's real action is "jump
  to today"; `D` shows the identical layout without the flash (switching views doesn't re-announce "today").
  `--stage-date` reads the real day name + date (`WED JUL 8`).
- **Month** (`M`): a 7×3 CSS grid (`grid-template-columns: repeat(7,1fr); grid-template-rows: repeat(3,1fr);
gap: 1px; background: var(--hairline)` — the gap-as-gridline trick), cells `var(--surface-1)`. Row 2 (the
  current week) renders at full opacity with day numbers (10px mono, top-right of cell) and each chip
  collapsed to a 24×4px color bar at the cell's bottom edge (the film formula still applies, just at a sliver
  height — design-brief's "18px film bar" scaled down for the mock's size, noted as a deliberate reduction,
  not a token violation). Rows 1 and 3 render at 45% opacity with numbers only, no chips — an intentional dim
  treatment that echoes ThreePlaces' active/dim panel language (cross-section coherence). `--stage-date`
  reads the real month + year.
- **List** (`L`, and `N`'s resting view): 5 rows, each 40px tall with 6px gaps, full canvas width, anatomy =
  `TaskItem` grammar (16px ring in `--chip-c` + 13px/500 title + `THU 14:00 · 90 MIN`-style mono due chip,
  right-aligned) — literally `ThreePlaces.astro`'s `.obj-list` row, third reuse. `--stage-date` reads
  "5 TASKS" (a real, verifiable count of the demo set) rather than a date.
- **⌘K**: no chrome change to the chips underneath — whatever view was showing stays exactly where it was,
  now covered. See Interaction spec.

---

## Motion timeline

Everything below fires once the section's IO trigger arms it (see DOM + implementation), and repeats until
the section scrolls out of view. One lap = all 7 keys, ≈24.5s. `t` is lap-relative (loop resets to `t=0`
seamlessly — the track's animated distance equals exactly one lap of key-center spacing, so `t=24.5s` and
`t=0` are pixel-identical, per the doubled-track marquee technique already used for `.rail-viewport`'s edge
masks elsewhere on the page).

Rail geometry (desktop numbers; mobile scales by the 56/80 = 0.7 factor and re-measures, not re-derives):
keycap centers, in DOM order, are spaced by `key_i.width/2 + 32 + key_(i+1).width/2`. Press-zone x = 200px
(rail-viewport center). Lap distance = sum of all 7 spacings = 836px (⌘K's extra 52px width vs. a standard
key adds ~26px to each of its two neighboring gaps). Track keyframes:
`@keyframes rail-drift { from { transform: translateX(0); } to { transform: translateX(-836px); } }`,
`836px / 24.5s ≈ 34.1px/s`. Press time for key _i_ = (cumulative center-to-center distance from ⌘K to key
_i_) / 34.1, giving:

| key        | press time (t)            | app action begins                |
| ---------- | ------------------------- | -------------------------------- |
| ⌘K         | 0.00s                     | Cmd+K overlay opens              |
| T          | 4.04s                     | Day view, today disc rim-flashes |
| D          | 7.33s                     | Day view (no flash)              |
| W          | 10.61s                    | Week view                        |
| M          | 13.89s                    | Month view                       |
| L          | 17.17s                    | List view                        |
| N          | 20.45s                    | New row spawns into List         |
| (⌘K again) | 24.50s = next lap's 0.00s | Cmd+K overlay opens              |

(Gaps land at ~3.3-4.0s, averaging 3.5s — matches the direction doc's "~3.5s per key" as a mean, not a
literal constant; computed from real key geometry so it never drifts out of sync with what's on screen, and
recomputes automatically on resize since it reads live `offsetLeft`/`offsetWidth`, not hardcoded pixels.)

| t-offset (relative to each key's press time `t_i`)                     | element                                                        | from → to                                                                                                                                                                     | duration                                      | easing                                                         | trigger                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `t_i - 0.10s`                                                          | pressed key                                                    | `translateY(0)` → `translateY(2px)`, face gradient → dip variant, skirt inset `-3px` → `-1px`                                                                                 | 90ms                                          | `--ease-out`                                                   | JS `setTimeout`, scheduled at lap start                            |
| `t_i` (key fully depressed)                                            | app-stage                                                      | current view/chips → target view/chips (FLIP, see below)                                                                                                                      | 480ms                                         | `--ease-settle`                                                | same schedule, fired in the same callback as the press             |
| `t_i + 0.02s`                                                          | stage chrome (headers/gutter/grid lines not carried by a chip) | opacity 1 → 0 → (new chrome) → 1                                                                                                                                              | 200ms total, cross-fade at the 100ms midpoint | `--ease-out`                                                   | chained off the FLIP start                                         |
| `t_i + 0.06s`                                                          | pressed key                                                    | `.is-pressed` removed; transition swapped to the release triple before removal                                                                                                | 220ms transform / 160ms shadow+bg             | `cubic-bezier(0,0,.85,1.25)` transform, `--ease-out` shadow/bg | JS `setTimeout`                                                    |
| `t_i` (T only)                                                         | today date disc                                                | rim-flash: pre-rendered inset ring opacity .6→0                                                                                                                               | 240ms                                         | `--ease-out`                                                   | `.is-flash` class, existing `.flashable` utility                   |
| `t_i` (N only)                                                         | new 6th chip                                                   | enters `scale(0.97) + opacity 0` → identity, existing 5 rows FLIP down 46px to make room                                                                                      | 200ms (enter) / 480ms (FLIP)                  | `--ease-out` (enter) / `--ease-settle` (FLIP)                  | same schedule                                                      |
| `t_i + 0.24s` (N only)                                                 | new 6th chip                                                   | rim-flash (it was just placed)                                                                                                                                                | 240ms                                         | `--ease-out`                                                   | chained after its FLIP lands                                       |
| `0.00s` (⌘K only)                                                      | stage canvas                                                   | scrim fades in: `background: color-mix(in oklab, var(--void) 60%, transparent)`, `backdrop-filter: blur(8px)`                                                                 | 200ms                                         | `--ease-out`                                                   | same schedule                                                      |
| `0.00s + 0.06s` (⌘K only)                                              | cmd-k panel                                                    | `translateY(-4px) scale(0.98)` → identity + fade, ring `0 0 0 1px var(--aqua-rim)` present from frame 1 (never animated in — it's the "always-on" ring per design-brief §4.6) | 200ms                                         | `--ease-settle`                                                | chained                                                            |
| `3.20s` (i.e. ⌘K holds ~3.2s before the next key's anticipatory press) | cmd-k panel + scrim                                            | fade out                                                                                                                                                                      | 100ms                                         | `--ease-out`                                                   | JS `setTimeout`, scheduled relative to ⌘K's own press time         |
| continuous                                                             | `.track`                                                       | `translateX(0)` → `translateX(-836px)`                                                                                                                                        | 24500ms                                       | `linear`                                                       | CSS `@keyframes rail-drift`, `animation-iteration-count: infinite` |

FLIP mechanics (shared by every non-⌘K key): before changing anything, read each of the 5 `.mock-chip`
elements' current `getBoundingClientRect()`. Apply the target view's inline geometry (top/left/width/height
per the Visual spec's per-view table) plus the target chrome's visibility. Read the new rects. For each chip,
compute the delta, set `transform: translate(dx,dy) scale(sx,sy)` immediately (no transition), force a
style flush, then set `transition: transform 480ms var(--ease-settle)` and clear the transform to `none`.
Text inside each chip (`.c-t`, `.c-ti`) is never separately faded — `overflow: hidden` on the chip lets the
label organically clip as the box shrinks toward Month view's 24×4px bar and organically reveal as it grows
back toward List's full-width row. This is the literal mechanism behind "views morph through each other":
nothing crossfades, one set of boxes changes shape and position and the text rides along, clipping and
un-clipping as a side effect of the box's own size change — never a separate opacity choreography on the
label.

**Ambient/loop summary:** one loop (the rail drift + its yoked press/FLIP schedule), period 24.5s, linear
drift + eased individual key presses/FLIPs riding on top (two-tempo motion, direction §2.6: this is the
section's one ambient loop). IO-gated: pauses (both the CSS animation via `animation-play-state: paused` and
the JS scheduler via `clearTimeout`/stored elapsed time) when `.keys-layout` leaves the viewport, and resumes
from the same phase, not from zero, when it re-enters (implementation detail below). Hover-pause: same
pause/resume pair, triggered by `:hover` on `.keys-layout` (desktop, `@media (hover: hover)` only) — a
deliberate "let me look" affordance, not required by the MUSTs but cheap and matches the page's general
politeness toward examination.

**Reduced motion:** no drift, no presses, no FLIP. Rail renders as a static row (`display: flex`, no
`position: absolute`/track/mask — the 7 keys simply laid out left to right, unpressed, exactly the current
shipped baseline's static row). App stage renders permanently in the **Week** view (all 5 chips in their
week-grid slots, full chrome, no dimming) — this doubles as the component's zero-JS/pre-hydration state (see
DOM + implementation), so "reduced motion" and "JS hasn't run yet" are the same rendered output by
construction, never two code paths to maintain.

---

## Interaction spec

- **Hover (desktop, `hover: hover` only):** hovering anywhere in `.keys-layout` pauses the rail drift and the
  press/FLIP scheduler (see pause/resume below); moving off resumes from the same phase. No visual change to
  individual keys on hover (they are not buttons; hovering the rail is "let me examine this," not "let me
  interact with this key").
- **Press/drag:** none. Keys are not draggable or clickable — the whole point is that they press _themselves_,
  proving the app answers the keyboard, not the mouse. A future click-to-preview affordance was considered
  and rejected: it would imply the rail is a control surface, undercutting the "hands off the mouse" thesis.
- **Keyboard/focus:** no new focusable elements. The rail and app-stage are non-interactive decoration
  reinforcing text that already exists in the DOM (see Accessibility) — nothing here should receive
  `tabindex` or appear in the tab order. `:focus-visible` styling is inherited globally but never triggered
  since nothing here is focusable.
- **Touch:** identical ambient behavior to desktop (no hover-pause, since there's no hover state to trigger
  it); IO-gating and reduced-motion behave the same. No tap gesture is bound to individual keys (avoids a
  dead-end affordance where tapping a non-interactive-looking key does nothing, which reads as broken rather
  than restrained — the safer choice on a touch surface where "is this tappable" is a real question).
- **Pause/resume mechanics (shared by IO-gating and hover-pause):** a single `pause()`/`resume()` pair.
  `pause()`: add `.is-paused` to `.track` (`animation-play-state: paused`), record
  `elapsedMs = performance.now() - lapStartTime`, clear every pending `setTimeout` for the current lap.
  `resume()`: remove `.is-paused` (CSS resumes the drift from its own paused computed position automatically
  — no manual transform math needed there), then re-schedule only the remaining press/FLIP events in the
  current lap using `pressTime_i - elapsedMs` as each new delay (events already fired this lap are skipped).
  This keeps the CSS drift and the JS schedule phase-locked indefinitely, including across repeated
  pause/resume from scrolling in and out.

---

## DOM + implementation strategy

```
section#keys > .container
  .copy[data-reveal]                       (unchanged: h2 + body-copy)
  .keys-layout[data-reveal]
    .rail#keys-rail[role=img][aria-label]
      .rail-viewport                        (mask-image edge fade)
        .rail-bracket.rail-bracket-t / -b   (static, aria-hidden)
        ul.track#keys-track
          li.keyunit[data-key=cmdk] > kbd.keycap-xl.keycap-xl--wide.mono[aria-hidden] + span.keylabel
          li.keyunit[data-key=t] > kbd.keycap-xl.mono[aria-hidden] + span.keylabel
          ... d, w, m, l, n ...
          <!-- lap-2 duplicate: same 7 <li>, each wrapped with aria-hidden="true" on the <li> itself
               (the labels would otherwise be announced twice) -->
    .app-stage#keys-stage
      .stage-card
        .stage-header
          span.stage-view.mono#stage-view-label   (WEEK / DAY / MONTH / LIST / ⌘K)
          span.stage-date.mono#stage-date-label   (real computed date/count string)
        .stage-canvas#stage-canvas
          .chrome-week#chrome-week / .chrome-day#chrome-day / .chrome-month#chrome-month
             (three chrome partials, toggled via [hidden]; List view uses no chrome partial,
              rows are self-sufficient)
          .mock-chip[data-chip=0..4]            (5 persistent chips, absolutely positioned, restyled per view)
          .mock-chip.is-spawn[data-chip=5][hidden]   (the N row, inserted into flow on first N press)
          .cmdk-overlay#cmdk-overlay[hidden]
            .cmdk-scrim
            .cmdk-panel
              .cmdk-input.mono
              ul.cmdk-rows > li ("Go to today" kbd:T / "New task" kbd:N / "Switch view" kbd:D W M L /
                                  "Toggle theme")
```

Astro-rendered (static, no JS): the entire tree above, including all 5 persistent chips positioned at their
**Week-view** geometry inline (this is both the SSR/no-JS state and the reduced-motion state — one markup
serves both, per the Motion timeline note). The 14 `<li>` (7 real + 7 aria-hidden duplicates for the seamless
loop) are also Astro-rendered — no client-side cloning.

JS-driven (`is:inline`, this component only): everything under Motion timeline and Interaction spec —
geometry measurement (`offsetLeft`/`offsetWidth` per key, computed once on mount and on resize), the
press/FLIP scheduler (a small array of `{key, offset, action}` objects and one recursive `setTimeout` chain
per lap, re-armed at `t=24.5s`), the five per-view layout tables (plain objects: `view -> chipIndex ->
{top,left,width,height}` in canvas-local px, plus which chrome partial is visible and what
`--stage-view`/`--stage-date` should read), the FLIP execution (reads rects, applies target layout, inverts,
plays — this calls `window.TF.flipBetween(el, fromRect, toRect, {duration: 480, easing: 'var(--ease-settle)'})`
from the shared foundation rather than reimplementing FLIP locally), the Cmd+K overlay show/hide, the N-spawn
row creation, the today-date computation (same pattern as `Hero.astro`'s inline date script — real Monday of
the current week, offset per view), and pause/resume wiring for IO + hover.

Size estimate: ~140-170 lines of `is:inline` JS (layout tables are the bulk — 5 views × 5 chips ×
4 numbers, plus chrome toggling and the scheduler), roughly 3.5-4.5KB unminified / ~2KB after minification —
on top of the shared `motion.js` foundation (`onVisible`, `flipBetween`), which this component imports
nothing from directly (per the `is:inline` contract) but calls via `window.TF`.

---

## Accessibility + reduced motion

- `#keys-rail` carries `role="img"` and `aria-label="Seven keyboard shortcuts: Command bar, Today, Day,
Week, Month, List, New task."` — the glyph inside each `<kbd>` (`⌘K`, `T`, `D`, `W`, `M`, `L`, `N`) is
  `aria-hidden="true"` since it's visually redundant with the always-visible `.keylabel` text sitting right
  below it in normal document flow (never hidden, never only-on-hover) — screen reader users get the same
  seven labels sighted users get, just via real text instead of glyph-reading, with zero extra markup burden.
  The duplicate lap-2 `<li>` elements are `aria-hidden="true"` in full (glyph and label both) so the list
  isn't announced twice.
- `#keys-stage` carries `role="img"` and one static `aria-label` summarizing the whole demo:
  `"A mock of the Taskflow app answering each shortcut: Today and Day open a single day, Week shows the
five-day grid, Month shows the month, List shows the task list, New task adds a row, and Cmd+K opens the
command bar."` This is a decorative, illustrative widget reinforcing copy that already fully states the
  point (`h2` + body) — per WCAG 2.2.2 (Pause, Stop, Hide), continuously-animating decorative content with an
  equivalent static/text description doesn't require an on-page pause control; the description here plus the
  section's own prose is that equivalent, so no pause button is added to the UI.
- Nothing in this section is keyboard-focusable (no `tabindex`, no interactive roles) — it never enters the
  tab order, consistent with it being illustrative rather than operable.
- `prefers-reduced-motion: reduce`: rail renders as a static flex row (baseline layout, no track/mask/drift),
  no key ever gets `.is-pressed`, app-stage renders permanently in Week view with full chrome and no dimming.
  This is the same markup Astro emits before any JS runs (see DOM + implementation) — the reduced-motion path
  and the no-JS path are identical by construction, so there is exactly one static rendering to verify, not
  two.
- Contrast: all text sits on `--surface-1`/`--surface-2` using `--ink`/`--ink-muted`, already contrast-
  verified in the design brief (§2.2). Chip text uses the brief's `oklch(from var(--chip-c) 0.82 min(c,0.1)
h)` formula, verified ≥4.5:1 for all curated hues (§2.4).

---

## Risks

1. **Flat, cartoon keycaps if the material stack is trimmed.** The whole section's argument is "materials
   convincing enough to want to touch" — a single flat box-shadow reads as a rounded button, not a key.
   Guard: implement every layer in the keycap recipe (radial highlight, linear face gradient, 4-sided inset
   walls, the recessed socket pseudo-element, the 3-tier penumbra) exactly as specced; screenshot one key at
   200% zoom during QA and compare against the recipe, not just the section thumbnail.
2. **Jump-cut layout swaps standing in for FLIP.** It's much cheaper to just toggle `display`/`opacity`
   between five pre-built view markups than to measure-invert-play five chips. That reads as slides, exactly
   what the MUST forbids ("never a series of stitched clips, never crossfade-only"). Guard: the same 5 DOM
   chip nodes must persist across every view swap (never removed/recreated except the 6th N-chip's one-time
   birth); if a code review finds five separate view containers with their own copies of the chips, it's
   wrong regardless of how good it looks frozen.
3. **Press/FLIP schedule drifting out of sync with the visible key position.** Hardcoding "press every
   3.5s" against a CSS animation whose real per-key timing varies (⌘K is wider) will eventually show a key
   pressing before or after it's actually centered in the press zone, which breaks the section's entire
   cause-and-effect legibility. Guard: compute press times from real measured key geometry (as specced), not
   a flat interval; re-verify after any change to `.keycap-xl`'s width/gap tokens, since those numbers feed
   directly into the schedule.
4. **A command bar that looks like every other Cmd+K demo on the internet.** Guard: rows must be the actual
   shipped actions from `actions.ts` (Go to today, New task, Switch view, Toggle theme), not invented "AI
   command" flavor text; keep the aqua ring as the only color in the panel — no gradient border, no glow.
5. **Five chips changing size/position simultaneously reading as noise instead of a legible morph.** Guard:
   stagger the FLIP's `transition-delay` by 20ms per chip index (0, 20, 40, 60, 80ms) so the eye can track a
   small cascade rather than five things jumping at once, while keeping duration/easing identical across all
   five so it still reads as one motion, not five uncoordinated ones.
6. **Month view illegible at mock scale.** Five chips as 4px bars in a cramped 7×3 grid can turn to visual
   mud. Guard: keep the dim/bright row treatment (only the current week's row is full-opacity and holds
   chips; the other two rows are numbers-only at 45% opacity) so there's only one row of real content to
   parse, not 21 competing cells.
7. **The idle rail reading as aimless if the bracket bookends and press zone aren't sharp.** Guard: the
   bracket ticks must be crisp 1px hairlines exactly at the geometric press-zone center used by the JS
   scheduler (not eyeballed) — misalignment between "the mark on screen" and "where the key actually presses"
   is the single easiest way to make the whole mechanic feel broken rather than precise.
