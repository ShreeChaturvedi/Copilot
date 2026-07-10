# Section spec — "It comes back around" (recurrence clock)

Owner: this section (`DayProgram.astro` → replace wholesale; suggested rename `RecurrenceClock.astro`, `id="clock"`). Governs implementation for the page's ONE full-color moment. All copy below is a PROPOSAL — flag to owner before it ships verbatim (per project rule: prose changes are propose-then-approve).

---

## Concept

**COMET DIAL.** A drawn instrument dial (ring, ticks, four hour numerals) sits on the void with a single hairline hand sweeping it once every 24 seconds, linear, no ease. The hand does not itself change color — chrome stays monochrome — but it drags a comet of light behind it: a soft trailing wedge and a brighter head, both rendered as one moving `oklch(0.64 0.15 h)` swatch where `h` is locked to the hand's own rotation angle, screen-blended into the void so it reads as glow, not paint. Four real recurring tasks sit at their literal clock hour outside the ring; each is dim until the comet sweeps through its mark, at which point it brightens to its full list color and rim-flashes — recurrence, enacted once per revolution, in front of you.

Two directions were developed. Runner-up, **ORBITAL RING**: drop the hand and hour numerals entirely, reduce the dial to a bare ring with a single traveling dot ("read head") and chips as beads snapping past a fixed gate at 12 o'clock — more abstract, more radar-screen. It lost because it under-delivers the owner's explicit "sweeping clock hand" instruction (a dot has no pivot, no shaft, nothing to call a hand) and it drops numerals entirely, which fights the brief's absolute mono-numeral law (a time-themed instrument with zero numerals reads as a loading spinner, not a clock). Comet Dial keeps a real hand and just four disciplined mono numerals (12/3/6/9, not a full face) — enough to read as an instrument, not enough to read as a cartoon wall clock.

The generic-SaaS-clock trap and how this spec avoids it: no hour+minute hand pair (only one hand — this isn't telling time, it's performing one loop), no full 1-12 numeral face, no skeuomorphic bezel/glass/shadow on the dial itself (it's a drawn line diagram, per §2.1, not a rendered object), and the color moment is a moving comet, not a static rainbow disc sitting under the dial like a color-picker wheel.

---

## Layout

Container: existing `.container` (max-width 1080px, 24px inline padding, 16px at ≤640px). Section: existing `.section` vertical rhythm (`clamp(72px, 10vw, 120px)` padding-block). Structure is copy-block-first (left-aligned, matches every other section), then the dial stage centered below it — this is the one section where the artifact is bilaterally symmetric, so it breaks from the page's left-weighted content flow deliberately, the same way Keys/Hero center their one hero object.

**1440 (desktop):**

- `.copy` block: max-width 620px, left edge = container edge (no centering).
- `.dial-stage`: `width: clamp(320px, 42vw, 620px)`, square (`aspect-ratio: 1`), `margin: 64px auto 0`.
- Dial SVG sits centered inside the stage with 90px of margin on all sides at the 620px reference size (dial diameter = stage − 180px = 440px at full size, scales proportionally via `%`-based inset, see Visual spec).
- Four chips sit in that 90px margin ring, one per cardinal edge of the stage box.

```
┌──────────────────────────────────────────────────────────┐
│  It comes back around.                                    │
│  Set a task to repeat weekly, monthly, or on your own      │
│  rule. When its time comes around again, Taskflow puts     │
│  it back on the grid.                                      │
│  RRULE - WEEKLY - MONTHLY - CUSTOM                          │
│                                                              │
│                     ┌───────────┐                           │
│                     │   Rent    │  <- top, 0°               │
│                     │1ST·MONTHLY│                           │
│                     └─────┬─────┘                           │
│                           │                                 │
│   ┌───────────┐      ,·''¯¯¯''·,      ┌──────────────┐      │
│   │  Standup  ├─────( 9    ·   3 )─────┤ 1:1 with Sam │      │
│   │MON09·WKLY │      `·,_____,·'       │FRI15·WEEKLY  │      │
│   └───────────┘           │            └──────────────┘      │
│                     ┌─────┴─────┐                            │
│                     │    Gym    │  <- bottom, 180°           │
│                     │EVERY OTHER│                            │
│                     │    DAY    │                            │
│                     └───────────┘                            │
└──────────────────────────────────────────────────────────┘
```

**390 (mobile):**

- `.dial-stage` collapses to dial-only, `width: min(72vw, 260px)`, centered, `margin: 40px auto 0`.
- The four chips leave the radial layout and flow as a static `2×2` grid BELOW the stage (`.dial-chip-list`, `display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 28px`), leader lines hidden (`display:none`). Same DOM, same JS-driven `.is-lit` class — only CSS position changes at the breakpoint (`max-width: 640px`, matching the codebase's existing breakpoint).

```
┌────────────────────────────┐
│ It comes back around.      │
│ Set a task to repeat        │
│ weekly, monthly, or on      │
│ your own rule. When its     │
│ time comes around again,    │
│ Taskflow puts it back       │
│ on the grid.                │
│ RRULE - WEEKLY - MONTHLY -  │
│ CUSTOM                      │
│                              │
│         ,·''¯¯¯''·,         │
│        ( 9    ·   3 )       │
│         `·,_____,·'         │
│                              │
│ ┌────────────┐┌────────────┐│
│ │ Rent       ││1:1 w/ Sam  ││
│ │1ST·MONTHLY ││FRI15·WKLY  ││
│ ├────────────┤├────────────┤│
│ │ Standup    ││ Gym        ││
│ │MON09·WKLY  ││EVERY OTHER ││
│ └────────────┘└────────────┘│
└────────────────────────────┘
```

---

## Visual spec

### Dial (SVG, drawn instrument lines per direction §2.1)

`viewBox="0 0 440 440"`, center `(220,220)`. All strokes: `fill:none; vector-effect:non-scaling-stroke`.

- **Ring**: `<circle cx="220" cy="220" r="170">`, stroke 1.5px, color `var(--line-dim)` (needs foundation token; literal value `color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent)` per direction §2.1 — use that literal if `--line-dim` isn't landed yet).
- **60 minute ticks**: radial lines from r=164 to r=170, 1px, `var(--line-dim)`, one every 6°. Render as a single `<g>` of 60 `<line>`s generated in the Astro frontmatter (no JS needed, static markup).
- **12 hour ticks**: radial lines from r=152 to r=170, 1.25px, `var(--ink-muted)` (brighter than minute ticks — these are the "named" positions).
- **Hub**: `<circle cx="220" cy="220" r="5">`, fill `var(--surface-2)`, stroke 1px `var(--line-dim)`.
- **Hand** (`<g class="dial-hand">`, `transform-origin: 220px 220px`, `transform: rotate(var(--clock-angle))`):
  - Shaft: `<line x1="220" y1="220" x2="220" y2="34">` (length 186 = ring radius 170 + 16px overshoot, chronograph-style), stroke 1.5px, `var(--ink-2)`.
  - Tip: `<circle cx="220" cy="34" r="4">`, fill `var(--aqua)`, plus `filter: drop-shadow(0 0 6px var(--aqua))`. **This is the section's one deliberate aqua touch on chrome** — it reads as "now," identical in meaning to the app's now-line dot (design-brief §4.4). Everything else on the dial is monochrome; the rainbow lives only in the bloom layer below.

### Cardinal numerals (HTML overlay, not SVG — crisp mono type)

Four `<span class="mono dial-label">` positioned via `position:absolute` at `top/right/bottom/left: calc(50% - <radius>px)` math (radius 132 from center, converted per stage's own px size). 11px Spline Sans Mono, `var(--ink-muted)`, no letter-spacing change. Text: `12`, `3`, `6`, `9`. These are the only numerals on the face — no 1/2/4/5/7/8/10/11. This is the mono-numeral law satisfied at instrument-minimum, not a full clock face.

### The bloom (behind the dial, `mix-blend-mode: screen`, per Obsidian/Forward notes)

Two stacked `position:absolute; inset:0` layers, z-index below the SVG, both `mix-blend-mode: screen`, both reading `var(--clock-hue)` (a bare number 0–360, written by the same rAF loop that writes `--clock-angle`; `--clock-hue` is numerically identical to the angle in degrees — no separate mapping function, per the automl hue-cycling technique).

1. **`.dial-bloom-trail`** (comet tail):

   ```css
   background: conic-gradient(
     from calc(var(--clock-angle) - 130deg) at 50% 50%,
     transparent 0deg,
     oklch(0.64 0.15 var(--clock-hue) / 0.55) 96deg,
     oklch(0.64 0.15 var(--clock-hue) / 0.18) 120deg,
     transparent 134deg,
     transparent 360deg
   );
   filter: blur(36px);
   ```

   This paints a ~134°-wide fading wedge trailing the hand (peak brightness ~34° behind the tip, tapering to nothing by 134° behind) — the "comet tail."

2. **`.dial-bloom-core`** (comet head, brighter, tighter): a `radial-gradient` centered at the tip's live position, written by the same JS frame as two percentage custom properties `--tip-x`/`--tip-y` (computed from the same angle: `x = 50 + 39*sin(angleRad)`, `y = 50 - 39*cos(angleRad)`, both in `%` of the stage box):
   ```css
   background: radial-gradient(
     circle at var(--tip-x) var(--tip-y),
     oklch(0.64 0.15 var(--clock-hue) / 0.85) 0%,
     oklch(0.64 0.15 var(--clock-hue) / 0.3) 20%,
     transparent 50%
   );
   filter: blur(18px);
   ```

Both layers scoped strictly inside `.dial-stage` — the hue variable never bleeds to page scope.

**Chroma discipline** (how the rainbow stays editorial, not carnival): (a) lightness and chroma are hard-locked at `0.64`/`0.15` — the exact curated-ladder constants, never derived from anything else, so the sweep can never oversaturate; (b) only ONE hue is visible at any instant (a moving swatch, not a static multi-stop rainbow wheel) — you never see the full spectrum simultaneously, which is what would read as a color-picker toy; (c) `mix-blend-mode: screen` against the near-black void naturally desaturates highlights and crushes the shadows, so even a saturated momentary hue reads as glow, not paint; (d) both bloom layers are capped opacity (core ≤0.85, trail ≤0.55) and generously blurred (18px/36px), so edges are soft light, never a hard-edged colored shape; (e) the effect is scoped to this one section's DOM subtree only — no other section ever sees a hue variable in this range.

### Chips

Chip markup reuses the existing chip alpha-film formula (design-brief §2.4) and rim-flash utility (`global.css` `.flashable`/`.is-flash`, already shipped — no new CSS needed for the flash itself).

- **Resting (dim, not yet lit this revolution)**: `background: color-mix(in oklab, var(--surface-2) 55%, transparent); box-shadow: inset 0 0 0 1px var(--line-dim); opacity: 0.62;` Title 12px/500 Inter `var(--ink-muted)`. Meta line mono 10px, `letter-spacing: 0.02em`, `var(--ink-muted)`.
- **Lit** (`.is-lit`, JS-toggled on angle-crossing): background/rim animate to the full §2.4 dark formula using the chip's own `--chip-c` (`background: color-mix(in oklab, var(--chip-c) 24%, transparent); box-shadow: inset 0 0 0 0.5px var(--chip-c);`), text lifts to the formula's derived color, opacity → 1, plus `--shadow-penumbra` (needs foundation token; literal fallback `0 0.6px 1.6px -1.5px rgb(0 0 0/.5), 0 2.3px 6px -3px rgb(0 0 0/.4), 0 10px 26px -4.5px rgb(0 0 0/.28)`) for a slight "placed object" lift, plus the existing `.is-flash` rim-flash pseudo-element firing once.
- Sizing: pill `min-width: 128px`, `padding: 8px 12px`, `border-radius: 6px` (chip law).
- Leader line: 1px, `var(--line-dim)`, 36–40px long, connecting the ring's outer edge to the chip's inner edge (a plain absolutely-positioned div per side, `background: linear-gradient(<direction>, var(--line-dim), transparent)`).

Four chips, positioned at their literal clock hour (design decision: dial position = the task's real scheduled hour, mod 12):

| Position | Angle | Title        | Meta (mono)          | `--chip-c`          |
| -------- | ----- | ------------ | -------------------- | ------------------- |
| top      | 0°    | Rent         | `1ST · MONTHLY`      | `var(--hue-orange)` |
| right    | 90°   | 1:1 with Sam | `FRI 15:00 · WEEKLY` | `var(--hue-violet)` |
| bottom   | 180°  | Gym          | `EVERY OTHER DAY`    | `var(--hue-green)`  |
| left     | 270°  | Standup      | `MON 09:00 · WEEKLY` | `var(--hue-blue)`   |

### Type

- h2: `.display-section` (existing, Sentient 400, `clamp(28px,3.4vw,38px)`).
- Body: `.body-copy` (existing, Inter 400 16px, `var(--ink-2)`).
- Mono receipt: `.mono-line` (existing, Spline Sans Mono 12px caps, `var(--ink-muted)`), separator style `-` (spaced hyphen, matches the hero honesty line convention — chip-internal meta lines use `·` matching the existing `09:00 · 30 MIN` convention; the two separator styles already coexist on the page and are kept distinct on purpose: `·` joins a pair on one object, `-` joins items in a list).

---

## Motion timeline

All durations in ms unless noted. `t=0` for the entrance table is "dial stage crosses 40% visible" (IO threshold). `t=0` for the ambient table is "entrance sequence complete, sweep begins."

### Entrance (plays once per page load, IO-gated, `threshold:0.4`)

| t-offset | Element                 | From → To                                                                                 | Duration | Easing          | Trigger                                                                                                                                                               |
| -------- | ----------------------- | ----------------------------------------------------------------------------------------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0        | `.copy [data-reveal]`   | opacity 0/translateY(14px) → 1/0                                                          | 500ms    | `--ease-out`    | existing global `[data-reveal]` mechanism, no new code                                                                                                                |
| 80       | `.dial-ring`            | stroke-dashoffset: circumference → 0                                                      | 900ms    | `--ease-settle` | JS sets `stroke-dasharray` to computed circumference on mount, animates via WAAPI or a CSS class toggle                                                               |
| 260      | 12 hour ticks (`<g>`)   | opacity 0 → 1, scale 0.9→1 (transform-origin center)                                      | 400ms    | `--ease-settle` | same reveal pass                                                                                                                                                      |
| 340      | 60 minute ticks (`<g>`) | opacity 0 → 1 (group, no stagger)                                                         | 400ms    | `--ease-out`    | same pass                                                                                                                                                             |
| 420      | 4 cardinal labels       | opacity 0/translateY(6px) → 1/0, stagger 40ms                                             | 300ms    | `--ease-out`    | same pass                                                                                                                                                             |
| 500      | hub + hand              | opacity 0 → 1, hand pre-set to `--clock-angle:0deg` (resting, pointing to Rent/top)       | 300ms    | `--ease-out`    | same pass                                                                                                                                                             |
| 700      | 4 chips + leader lines  | opacity 0/translateY(10px) → 1/0, stagger 60ms; leader line stroke-draws 0→100% alongside | 400ms    | `--ease-out`    | same pass                                                                                                                                                             |
| 900      | bloom layers            | opacity 0 → 1                                                                             | 400ms    | `--ease-out`    | same pass                                                                                                                                                             |
| 900      | ambient loop            | —                                                                                         | —        | —               | rAF loop starts (see below); `prevAngle` initialized at `-1deg` so the Rent chip (0°) fires its first relight immediately as the sweep begins — the entrance's payoff |

Total entrance: ≤1.3s, matches page-wide entrance budget.

### Ambient loop (continuous while `.dial-stage` intersects viewport; IO-gated pause/resume; reduced-motion: never starts)

| t-offset (loop-local, repeats every 24000ms) | Element                                 | From → To                                          | Duration                                                                           | Easing                                    | Trigger                                                  |
| -------------------------------------------- | --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| running                                      | `--clock-angle`                         | 0deg → 360deg (wraps to 0)                         | 24000ms/rev                                                                        | linear (a clock hand never eases)         | single rAF, one continuous write                         |
| running                                      | `--clock-hue`                           | 0 → 360 (numerically = angle)                      | 24000ms/rev                                                                        | linear                                    | same rAF write, same frame                               |
| running                                      | `.dial-bloom-trail`, `.dial-bloom-core` | repaint every frame reading the two vars above     | continuous                                                                         | n/a (not a CSS animation, just var reads) | same rAF                                                 |
| 0                                            | Rent chip → `.is-lit`                   | dim → full formula + rim-flash → decay back to dim | brighten 220ms `--ease-out`, hold 700ms, decay 480ms `--ease-settle` (~1.4s total) | see durations                             | angle-crossing detection (prevAngle < 0° ≤ currentAngle) |
| 6000                                         | Sam chip → `.is-lit`                    | same shape                                         | same                                                                               | same                                      | crossing detection at 90°                                |
| 12000                                        | Gym chip → `.is-lit`                    | same shape                                         | same                                                                               | same                                      | crossing detection at 180°                               |
| 18000                                        | Standup chip → `.is-lit`                | same shape                                         | same                                                                               | same                                      | crossing detection at 270°                               |
| 24000                                        | loop wraps                              | —                                                  | —                                                                                  | —                                         | angle continues 360°→0°≡360°, Rent fires again           |

**Off-screen behavior**: `IntersectionObserver` on `.dial-stage` (via `window.TF.onVisible(el, cb, {once:false, threshold:0})`). On exit, cancel the rAF (stop calling it entirely, don't just freeze via CSS) and record elapsed-visible-time-so-far. On re-entry, resume the angle calculation from the same elapsed-visible-time (never wall-clock-since-mount), so returning to the section never shows a jump — it resumes exactly where it paused.

**Reduced motion**: rAF never starts. `--clock-angle: 315deg` (static, a "10:30" position — a deliberately pleasant static angle, not an arbitrary stop-mid-sweep). `--clock-hue: 182` (the brand's own aqua hue — the static frame rests on the page's one live color instead of an arbitrary rainbow value, a deliberate tie-back to brand). Bloom layers render at fixed opacity (core 0.5, trail 0.3, no filter animation — `filter:blur()` is a static value regardless of motion state so this costs nothing extra). All 4 chips render permanently in their `.is-lit` (full-brightness) state — direction's explicit "chips lit" requirement. Entrance draw-in is skipped via the existing global `@media (prefers-reduced-motion:reduce)` rule (durations forced to 0.01ms) — no separate reduced-motion branch needed for the entrance table, only for the JS-driven ambient loop (which the global CSS rule cannot reach, since it's rAF-driven, not CSS-animation-driven — this is why the component script must also check `window.TF.reducedMotion` before ever starting the rAF).

---

## Interaction spec

This is a decorative instrument (see Accessibility below), so there is no primary interactive affordance — the spec below is a restrained hover-only flourish, not a control.

- **Hover** (`@media (hover:hover) and (pointer:fine)` only): hovering an individual `.dial-chip` previews its lit state immediately via a pure-CSS `:hover` rule mirroring `.is-lit`'s resting→full transition (no JS), so a visitor can inspect all four without waiting up to 24s for the sweep. Instant on, 150ms off, matching the motion grammar's standard hover timing. This does not pause or affect the ambient loop — it is purely additive, non-destructive to the "instrument keeps running" read.
- **Press**: n/a, nothing is clickable.
- **Keyboard/focus**: the entire `.dial-stage` subtree is `aria-hidden="true"` and contains zero focusable elements (no `tabindex`, no interactive tags) — it is never reachable by Tab and never receives focus-visible styling. This is intentional: the accessible content lives in a separate sr-only block (see Accessibility).
- **Touch**: `.dial-chip { pointer-events: none }` outside the `(hover:hover)` media query, so touch taps never trigger or stick a hover state (no sticky-hover artifact). Touch users experience the ambient loop only, identical to what a mouse user sees without hovering.

---

## DOM + implementation strategy

### Element tree (Astro-rendered static markup; JS only toggles classes/vars)

```
<section class="section clock" id="clock" aria-labelledby="clock-h2">
  <div class="container">
    <div class="copy" data-reveal>
      <h2 id="clock-h2" class="display-section">It comes back around.</h2>
      <p class="body-copy">Set a task to repeat weekly, monthly, or on your own rule.
        When its time comes around again, Taskflow puts it back on the grid.</p>
      <p class="mono-line">RRULE - WEEKLY - MONTHLY - CUSTOM</p>
    </div>

    <div class="dial-stage" data-clock-root aria-hidden="true">
      <div class="dial-bloom-trail"></div>
      <div class="dial-bloom-core"></div>

      <svg class="dial-svg" viewBox="0 0 440 440">
        <circle class="dial-ring" cx="220" cy="220" r="170" />
        <g class="dial-ticks-minor"><!-- 60 <line>, Astro-generated in frontmatter --></g>
        <g class="dial-ticks-major"><!-- 12 <line>, Astro-generated --></g>
        <circle class="dial-hub" cx="220" cy="220" r="5" />
        <g class="dial-hand">
          <line class="hand-shaft" x1="220" y1="220" x2="220" y2="34" />
          <circle class="hand-tip" cx="220" cy="34" r="4" />
        </g>
      </svg>

      <div class="dial-labels">
        <span class="mono dial-label" data-pos="top">12</span>
        <span class="mono dial-label" data-pos="right">3</span>
        <span class="mono dial-label" data-pos="bottom">6</span>
        <span class="mono dial-label" data-pos="left">9</span>
      </div>

      <div class="dial-chips">
        <!-- 4x, Astro .map() over a frontmatter array -->
        <div class="dial-chip flashable" data-pos="top" data-angle="0" style="--chip-c: var(--hue-orange)">
          <div class="dial-chip-leader" data-pos="top"></div>
          <span class="dial-chip-title">Rent</span>
          <span class="dial-chip-meta mono">1ST · MONTHLY</span>
        </div>
        <!-- right: 1:1 with Sam / FRI 15:00 · WEEKLY / --hue-violet -->
        <!-- bottom: Gym / EVERY OTHER DAY / --hue-green -->
        <!-- left: Standup / MON 09:00 · WEEKLY / --hue-blue -->
      </div>
    </div>

    <div class="sr-only">
      <p>Taskflow repeats tasks automatically on a schedule you set.</p>
      <ul>
        <li>Standup repeats every Monday at 9:00 AM.</li>
        <li>1:1 with Sam repeats every Friday at 3:00 PM.</li>
        <li>Gym repeats every other day.</li>
        <li>Rent repeats on the 1st of every month.</li>
      </ul>
    </div>
  </div>
</section>
```

### Astro vs JS split

- **Astro-rendered (static, zero JS)**: h2/body/mono copy, the 60+12 tick `<line>` elements (generate with `Array.from({length:60})` in frontmatter, computing `x1/y1/x2/y2` from `angle = i*6deg`), the 4 chip DOM nodes and their copy/hue (from a frontmatter array, same pattern as the current `DayProgram.astro` `rows` array), the sr-only list, the ring/hub/hand SVG shapes at their resting geometry.
- **JS-driven (`is:inline` component script)**: (1) one rAF loop writing `--clock-angle` and `--clock-hue` onto `.dial-stage`, (2) angle-crossing detection against the 4 chips' `data-angle`, toggling `.is-lit` + `.is-flash` (reusing the existing global `rim-flash` keyframe — no new keyframe needed), (3) computing and writing `--tip-x`/`--tip-y` each frame for the bloom core, (4) IO-gating start/stop via `window.TF.onVisible`, (5) the reduced-motion branch (skip the loop, set the three static custom properties once, add `.is-lit` to all 4 chips permanently).
- **Shared foundation dependency**: this script should register its per-frame work with `window.TF`'s shared rAF ticker if one exists (per direction §5, motion.js ships "a shared rAF ticker") rather than calling its own `requestAnimationFrame` loop, to keep the page's total number of independent rAF loops at one. If the shared ticker isn't available at implementation time, fall back to a local `requestAnimationFrame` loop gated the same way.
- **Size estimate**: ~2.2KB minified/ungzipped for this section's inline script (angle/hue math, crossing detection, IO wiring, reduced-motion branch) — in line with the hero's ~2KB FLIP helper precedent.

### Needs from shared foundation (`global.css` / `motion.js`)

- `--line-dim` token (dim aqua-phosphor line color for landing-only drawn geometry, direction §2.1: `color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent)`). This spec uses the literal value as a fallback if the token isn't landed yet.
- `--shadow-penumbra` token (direction §2.2, 3-tier stack) for the lit-chip lift. Literal fallback given above.
- `window.TF.onVisible(el, cb, {once:false, threshold})` — repeatable visibility callback (not one-shot) to start/stop the ambient rAF.
- `window.TF.reducedMotion` (boolean) or equivalent — checked once before ever starting the rAF loop.
- Optionally `window.TF.ticker` shared rAF registration, per direction §5's "shared rAF ticker" — this section is a good first consumer of it.
- Everything else needed already exists and is reused as-is: `.container`, `.section`, `.display-section`, `.body-copy`, `.mono-line`, `.mono`, `[data-reveal]`, `.chip`/`.flashable`/`.is-flash`/`@keyframes rim-flash`, `--ease-settle`, `--ease-out`, `--hue-orange/violet/green/blue`, `--aqua`, `--ink-muted`, `--ink-2`, `--surface-2`.

---

## Accessibility + reduced motion

- **Roles/labels**: `.dial-stage` (the entire SVG + chips visual) is `aria-hidden="true"` — it is a decorative instrument, not a data table, and trying to make an animated radial diagram individually navigable would be worse than describing it in prose. The section itself is `aria-labelledby="clock-h2"`. Immediately after the visual, a `.sr-only` block (real DOM, not `aria-hidden`) gives a screen-reader user the same facts in linear prose: one lead sentence plus a 4-item list naming each task and its real cadence in plain English ("Standup repeats every Monday at 9:00 AM."). This matches the pattern already specified for Icon Receipts (§4.6, "sr-only sentence kept for a11y"), extended to a short list here because there are four distinct facts worth stating individually rather than one run-on sentence.
- **Focus order**: zero focusable elements inside `.dial-stage` (no `tabindex`, no `<a>`/`<button>`); Tab skips straight from the mono receipt line to whatever follows the section. The `.sr-only` list is plain text, not interactive, so it doesn't create extra tab stops either — it's read, not tabbed.
- **Reduced motion, exact static rendering**: `--clock-angle:315deg` (hand parked at a deliberately chosen "10:30" position, not mid-animation-looking), `--clock-hue:182` (the page's own aqua hue — ties the static frame back to brand rather than freezing on an arbitrary rainbow color), bloom opacity fixed at 0.5 (core) / 0.3 (trail) with no per-frame writes at all, all 4 chips permanently `.is-lit` (full brightness, fully legible, no half-dim state — satisfies the direction's explicit "chips lit" reduced-motion requirement). The entrance draw-in is skipped via the existing global reduced-motion rule (durations forced to 0.01ms); the component script additionally must check `window.TF.reducedMotion` before starting its rAF loop, since that global CSS rule has no power over JS-driven custom-property writes.
- **Contrast**: chip title text (12px/500 Inter) in both dim (`--ink-muted` ~4.5:1 on `--void`-adjacent film) and lit (formula-derived lifted color, verified ≥6.8:1 per design-brief §2.4) states passes AA. Mono meta lines are decorative-adjacent but still legible at `--ink-muted` on the dim film. Cardinal numerals at `--ink-muted` on the void pass comfortably (support text, not the only source of the fact — the sr-only list carries the real information).

---

## Risks

1. **Reads as a generic stock "clock" icon.** Guard: single hand only (no hour/minute pair), only 4 numerals (not a full 1–12 face), no skeuomorphic bezel/glass — the dial is a drawn instrument line diagram per §2.1, and the signature move (comet trail + head, not a static rainbow disc) is not something a generic template would ship.
2. **Rainbow bloom oversaturates into "carnival."** Guard: L/C hard-locked at `0.64`/`0.15` (never derived elsewhere), only one hue visible at any instant (moving swatch, not a static multi-stop wheel), `mix-blend-mode:screen` against near-black naturally desaturates, opacity capped (core ≤0.85, trail ≤0.55), generous blur (18/36px) keeps edges soft. Spot-check at t=6s/12s/18s/24s during QA, not just t=0.
3. **Two unsynced animations drifting out of phase** (the classic bug this exact mechanism invites — hand rotating on one clock, gradient hue-shifting on another). Guard: ONE rAF loop writes both `--clock-angle` and `--clock-hue` in the same frame from the same elapsed-time source; nothing else animates independently; no `@keyframes`/CSS `animation` shorthand anywhere near the hand or bloom. QA check: freeze the tab for 5s via devtools throttling, confirm hand position and bloom hue are still in exact lockstep on resume.
4. **Chip relight feels random/unmotivated** if triggering is proximity/dwell-based instead of a clean crossing event, or if the trigger window is wide enough to fire early/late relative to the visible tick mark. Guard: exact prev-frame/current-frame angle-crossing detection (not a tolerance window), and the chip's `data-angle` must exactly match its dial position's angle (0/90/180/270) so the relight visibly coincides with the hand passing the mark, not near it.
5. **Perf**: two full-bleed blurred `mix-blend-mode:screen` layers plus a 60fps custom-property write plus an SVG transform is real GPU/CPU work. Guard: IO-gate the rAF fully off (don't just visually pause) when `.dial-stage` isn't intersecting; static blur radii (never animate the `filter` value itself, only position/hue vars, which are compositor/paint-cheap in comparison); reduced motion removes the rAF entirely. QA check: 4x CPU throttle, confirm no dropped frames while the section is in view and zero CPU work while it's scrolled past.
6. **Chip text washed out by the bloom bleeding into the chip zone.** Guard: chips sit in the stage's outer 90px margin, outside the ring where the bloom is centered and where its blur falls off; chips also have their own opaque-enough background (film formula, not transparent) so any residual bloom bleed-through stays subordinate to the chip's own material. QA check: screenshot at the moment a chip is mid-relight (brightest bloom + brightest chip coincide) and confirm the mono meta line is still legible.
7. **Symmetric cardinal chip placement reading as a decorative mandala rather than real data.** Mitigated by grounding: each chip's position is its literal scheduled hour (this is stated in the spec and should be preserved in implementation, not silently changed to "whatever fits") — the symmetry is a property of a real clock face, not an invented decoration.
