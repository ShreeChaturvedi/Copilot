# Hero spec — "TRUE COURSE"

Owner: Hero.astro. Governs `/home/shree/dev/taskflow-calendar/landing/src/components/Hero.astro` only.
Reads global.css tokens (existing) plus new foundation tokens listed below (owned by the foundation agent,
not this file).

---

## Concept

**TRUE COURSE.** Twenty chips fall out of chaos and each one settles on its own drawn trajectory — a thin
arc whose bow direction and depth are computed directly from that chip's own scatter rotation, so the line
looks like a course correction, not a decoration: the chip visibly "un-spins" as it travels the arc, landing
flat and true on the grid. The one idle chip in the margin is the same device turned into an invitation: drag
it (or any settled chip) onto the grid yourself and it settles exactly the way the other twenty did, rim
flash included. Nothing about the choreography is arbitrary — every curve, every duration, every stagger
step is derived from data already in the DOM (the scatter constants), never a fresh made-up flourish.

Two directions were developed to this depth. The runner-up, **COMET CAPTURE** (motion-blurred trailing
ghosts instead of clean instrument strokes, more particle-fx than diagram), lost on two counts: it fails the
direction doc's explicit test that fall paths must "explain the motion, not decorate it" — a blurred trail
reads as an effect, not a trajectory — and layered ghost-frame ​trailing is exactly the kind of per-frame
repaint work that produces jitter under 4x CPU throttle, the opposite of MUST (a). A third direction, a
literal PCB/orthogonal-trace grid of right-angle connector lines, was rejected without full development: with
twenty chips in flight at once, right-angle elbows overlapping across five columns reads as visual noise, not
an instrument drawing, and the direction doc's own reference (a compass-drawn quadratic bezier) already
implies smooth arcs, not orthogonal routing.

## Layout

Geometry is **unchanged from shipped Hero.astro** — none of the owner MUSTs ask for a re-layout, and the
brief protects H1/sub/CTA/honesty line/now-line/real dates exactly as shipped. This spec adds two layers
(an SVG overlay, a drag interaction layer) on top of the existing box model. Confirmed geometry, restated for
the implementer:

- `.container` max-width 1080px, padding-inline 24px (16px ≤640px).
- H1 `.display-hero` max-width 640px. Sub `.sub` max-width 52ch, margin-top 20px.
- `.cta-row` margin-top 32px, gap 24px.
- `.slab` margin-top 64px, `--cw: 20%` (5 columns desktop, `--cw: 33.333%` + `--dshift: 2` ≤640px → 3 visible
  columns, WED–FRI).
- `.slab-head` height 44px. `.slab-body` height 396px desktop, 340px ≤640px. Gutter 52px desktop, 44px
  ≤640px.
- `.floor` line 72% width, 36px below slab.
- `.idler`: `right:-128px; top:46%`, hidden `<1339px` (kept — see Interaction spec, "idler viewport scope").

### Wireframe, 1440px (mid-settle, illustrative)

```
+------------------------------------------------------------------------------+
|  container (1080, centered, 24px gutter)                                     |
|                                                                              |
|  Everything has a time.                                                     |
|  Taskflow is a task list and a calendar on one grid...                      |
|  [Start planning]   FREE - SYNCS WITH GOOGLE CALENDAR - DRAG A CHIP - TUE.. |
|                                                                              |
|   MON     TUE     WED    [THU]    FRI                          +----------+ |
|  .·˙  ↷  .·˙  ↷   ˙·.  ↷  ˙·.  ↷  .˙·                          | Plan the | |
|  ┊  [gym]┊     ┊[std]┊    ┊now║   ┊    ┊  <- fall-path arcs,   | trip     | |
|  ┊       ┊[std]┊     ┊    ┊###║   ┊[shp]  dim phosphor,        +----------+ |
|  ┊[dsgn] ┊     ┊[1:1]┊    ┊   ║   ┊    ┊  drawing/undrawing      idles,     |
|  ┊       ┊[ship]     ┊    ┊   ║   ┊[lch]  per chip                draggable |
|  ~~~~~~~~~~~~~~~~ floor light-line ~~~~~~~~~~~~~~~~                          |
+------------------------------------------------------------------------------+
```

### Wireframe, 390px (settled, reduced-motion path shown — matches static mobile render)

```
+----------------------------------+
| container (24px→16px gutter)     |
|                                   |
| Everything has                   |
| a time.                          |
| Taskflow is a task list...       |
| [Start planning]                 |
| FREE - SYNCS WITH GOOGLE CAL.    |
|                                   |
|  WED     [THU]     FRI           |
| ┊[dsgn]  ┊now║     ┊             |
| ┊        ┊###║     ┊[ship]       |
| ┊[dent]  ┊    ┊    ┊[call]       |
|                                   |
| (idler not rendered <1339px)     |
+----------------------------------+
```

## Visual spec

Accent decision (stated per direction §1 requirement): **Hero keeps full aqua as the live/placed signal,
unchanged.** The hero is the page's definitional anchor for "aqua = live and placed" (cohesion pairs
design-brief §8 #1/2/3/6/8 all point back to this section) — muting it here would break every other
section's claim to inherit the signal. What is muted is decoration around it: the fall-path geometry lines
are dim aqua-phosphor (per direction §2.1), never full aqua, except the live chip's own path. The CTA glow
is de-glowed globally per direction §2.7 (foundation-owned, see needs_foundation) — Hero does not re-add a
glow locally.

**Fall-path overlay** (`svg.fall-paths`, one per settle pass):

- One `<svg>` element, sibling of `.chips` inside `.cols`, `position:absolute; inset:0; overflow:visible;
pointer-events:none; z-index:1` (`.chips` stays `z-index:2` or default stacking after it in DOM order, so
  chip bodies paint over their own trailing line).
- No `viewBox`; paths are authored directly in the pixel space of `.cols` (see coordinate strategy below), so
  no scaling math is needed inside the SVG itself.
- Per chip: one `<path fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke">`, `d="M x1,y1 Q
cx,cy x2,y2"`.
  - `(x1,y1)` = chip's scatter origin (slot center + scaled dx,dy). `(x2,y2)` = chip's slot center.
  - Control point: let `mid = ((x1+x2)/2, (y1+y2)/2)`, `perp = normalize(-(y2-y1), x2-x1)`,
    `bow = clamp(|rotationDeg| * 2.2, 12, 60)` (px), `sign = rotationDeg < 0 ? -1 : 1`.
    `(cx,cy) = mid + perp * bow * sign`. **This is the load-bearing detail**: the arc's bow direction and
    depth come directly from the chip's own `data-r` scatter rotation, so a chip that entered rotated -14°
    draws a deeper, opposite-handed arc than one that entered at -4° — the line visibly documents the
    specific chip's fall, not a generic curve template.
  - Stroke width 1.25px. Color: `var(--line-dim)` for all background chips; the live chip's path uses
    `var(--line-live)` at 1.5px (see needs_foundation).
- Stroke-dash choreography (drawn ahead, undrawn behind): `pathLength = path.getTotalLength()`.
  `stroke-dasharray = "${pathLength} ${pathLength}"`. Animate `stroke-dashoffset` through three keyframes:
  `pathLength` (hidden) → `0` at 45% of the path's own duration (fully inscribed — "draws ahead" of the
  chip, which is still mid-flight under `--ease-settle`'s deceleration) → `-pathLength` at 100% (fully
  erased from its own start forward — "undraws behind"). Easing: **linear**, not `--ease-settle` — this is
  deliberate: the pen moves at a constant rate while the chip it's drawing decelerates into rest, so the two
  motions visually decouple (chip settles, line keeps drawing) instead of both easing together and pooling
  ink near the end. Same `delay`/`duration` values as the chip's own transform animation (see Motion
  timeline) — passed as the same JS object to both `chip.animate()` and the path's `animate()` call, so they
  cannot drift out of sync.
- SVG overlay is removed from the DOM ~100ms after the last chip's animation resolves (see DOM +
  implementation strategy). Paths never persist as static decoration.

**SVG overlay coordinate strategy** (how endpoints stay glued across breakpoints):

1. On script init (after DOM ready, before any transform is applied), read **one** `getBoundingClientRect()`
   on `.cols`. This is the only layout read in the whole entrance sequence.
2. Each chip's slot center is derived arithmetically from data already on the DOM node — `data-day` (0–4),
   plus two new build-time attributes `data-top` and `data-h` (numeric percentages, straight from Astro's
   existing `pos()` function, added purely so JS never parses the `style` attribute string):
   `slotX = colsRect.width * (day + 0.5) / columnCount` (columnCount = 5 desktop, 3 ≤640px, matching
   `--dshift`), `slotY = colsRect.height * (top + h/2) / 100`.
3. Scatter origin = `slotX + dx*k`, `slotY + dy*k`, reusing the exact `dx`/`dy`/`k` values the transform
   animation uses (§ Motion timeline) — same numbers, two consumers (chip transform, path endpoint), so a
   path can never end up detached from its chip.
4. Because both the chip's CSS position (`--d`, `top`, `height`, `--dshift`) and the path's math derive from
   the _same_ `.cols` rect and the _same_ day/time data, resizing the window before the entrance fires
   (e.g. mobile browser chrome collapsing) just re-runs the same computation correctly at any breakpoint —
   there is no separately-tuned "path breakpoint," only the one geometry.
5. Edge case: if a resize/orientation-change event fires _while_ the entrance is still in flight, cancel all
   in-flight chip and path animations, snap every chip to `transform:none` immediately, and skip drawing any
   remaining paths for that pass (never restart the choreography — restated MUST: "keep its grammar," a
   full replay on a mid-flight resize would violate "everything settled once, on load").

**Chip material**: unchanged, design-brief §2.4 dark alpha-film formula exactly as shipped (`.chip` class in
global.css) — 24% film, 0.5px full-alpha rim, lifted text. No change to resting/settled chip appearance.

**Lift state** (chip mid-drag, direction doc §4.1 spec, verbatim): background flips to solid `var(--chip-c)`,
text goes white (`#ffffff`, an explicit override of the lifted-text formula, matching the app's kanban
pick-up per design-brief §4.3), `box-shadow: var(--shadow-penumbra)` (needs_foundation), `transform: scale
1.03 rotate 1.5deg` layered on top of the drag-follow translate, 160ms transition into the lift state (matches
design-brief §4.3 pick-up timing), cursor `grabbing`.

**Drop-candidate ghost cell**: while dragging, the candidate slot renders a 1px dashed outline in
`var(--line-dim)` plus `var(--aqua-film-04)` wash, `border-radius: 6px`, no fill beyond the wash — visually
distinct from a placed chip (dashed + dim, never solid aqua — a candidate is not yet a live/placed fact).
Removed the frame after drop (either settled or spring-back).

**Idler**: no visual change to the resting chip (same violet fill/rim/label as shipped). Add `cursor: grab`
at rest, `cursor: grabbing` while lifted. No etch treatment (design-brief §2.5: etch is app-only, never the
landing — the settle is the hero's one signature, we do not add a second visual language for "unplaced").

## Motion timeline

All easing is `var(--ease-settle)` (`cubic-bezier(0.16,1,0.3,1)`) unless noted. `k` = `min(1, innerWidth /
1200)` (unchanged shrink factor for small screens). `i` = index among the 19 background chips in DOM order
(Monday→Friday, matches existing `slot` counter). `dist_i = hypot(dx_i, dy_i) * k`.

| t-offset                     | Element                             | From → To                                                                                                                                             | Duration                                                 | Easing          | Trigger                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| t=0                          | all 19 background chips + live chip | scatter transform applied via `translate3d(dx*k, dy*k, 0.0001px) rotate(r deg)`, `will-change:transform` set on all 20 in one batched loop            | — (instant, pre-paint)                                   | —               | page load, `DOMContentLoaded`, skipped entirely under reduced-motion                                                                                                                                              |
| t=0 (2×rAF later)            | background chip `i`                 | `translate3d(...) rotate(...)` → `translate3d(0,0,0.0001px) rotate(0)`                                                                                | `680 + clamp(dist_i*0.35, 0, 180)` ms, clamped [680,860] | `--ease-settle` | `chip.animate()` WAAPI, `delay = floor(i/2)*40` ms (max 360ms)                                                                                                                                                    |
| t=0 (2×rAF later)            | background chip `i`'s fall-path     | dashoffset `pathLen → 0 → -pathLen` (keyframes at 0%, 45%, 100%)                                                                                      | same duration as its chip                                | **linear**      | same WAAPI call batch, identical `{delay,duration}` object passed to both                                                                                                                                         |
| t=460ms                      | live (aqua) chip                    | scatter → `translate3d(0,0,0.0001px) rotate(0)`                                                                                                       | 780ms                                                    | `--ease-settle` | fixed delay, guarantees it starts after all background chips are mid/near-landed and finishes last                                                                                                                |
| t=460ms                      | live chip's fall-path               | dashoffset sweep, `var(--line-live)` stroke                                                                                                           | 780ms                                                    | linear          | same batch                                                                                                                                                                                                        |
| t≈1240ms                     | live chip lands                     | rim flash: `.is-flash` added, `::after` opacity `0.6→0`                                                                                               | 240ms                                                    | `--ease-out`    | `Promise.all(anims.map(a=>a.finished))` resolves for the live chip's animation specifically                                                                                                                       |
| t≈1300ms                     | `svg.fall-paths`                    | removed from DOM                                                                                                                                      | —                                                        | —               | `Promise.all` across _all_ 20 chip animations resolves + 100ms buffer                                                                                                                                             |
| t≈1260ms                     | all chips                           | `will-change`, inline `transform`/`transition` styles stripped in **one** batched loop (not per-chip listeners); `pointer-events` enabled on `.chips` | —                                                        | —               | same `Promise.all` resolution — this single bulk write is why the tail of the animation cannot jitter (see Risks)                                                                                                 |
| ongoing                      | `.idler`                            | CSS keyframe `idle-drift` 7s ease-in-out alternate, ±5px translateY, ±3° rotate                                                                       | 7000ms loop                                              | ease-in-out     | runs while hero section is in viewport; `animation-play-state: paused` off-screen via `window.TF.onVisible(heroSection, cb)` toggling a `.is-visible` class; killed entirely under reduced motion (existing rule) |
| on drop                      | any chip (incl. graduated idler)    | drag-follow position → snapped slot position                                                                                                          | 320ms (`--dur-4`)                                        | `--ease-settle` | pointerup, transform-only                                                                                                                                                                                         |
| on drop, success             | dropped chip                        | rim flash                                                                                                                                             | 240ms                                                    | `--ease-out`    | same `.flashable`/`.is-flash` mechanism, unchanged from shipped                                                                                                                                                   |
| on drop, no valid slot found | dragged chip                        | drag-follow position → original slot                                                                                                                  | 320ms                                                    | `--ease-settle` | pointerup, no flash                                                                                                                                                                                               |
| n/a                          | now-line, honesty clock             | text/position update                                                                                                                                  | —                                                        | —               | 60s interval + resize, unchanged from shipped; not a continuous animation, no jank surface                                                                                                                        |

Total worst case landing time: `460 + 780 = 1240ms` for the live chip; background chips land by at most
`360 + 860 = 1220ms`. Both inside the 1.3s brand-law ceiling with margin for the flash, which fires _after_
landing and is not counted against the 1.3s figure (matches how the shipped implementation already treats
the flash as a post-land effect).

**Why this cannot jitter at 4× CPU throttle** (MUST (a), concrete techniques):

1. **WAAPI, not CSS-transition-string mutation.** `Element.animate()` keyframes are built as plain objects
   once, in a single synchronous pass over all 20 chips — no per-element string concatenation loop building
   `transition` values, and the animation can run on the compositor thread independent of main-thread
   scripting once started.
2. **One-time layer promotion, batched.** `will-change:transform` is set on all 20 chips in one loop _before_
   any transform is written (same synchronous block as the initial scatter transform), so the browser
   creates all 20 compositor layers in a single style/layout pass, not staggered across frames.
3. **`translate3d(x,y,0.0001px)`**, not `translateZ(0)` — forces GPU compositing without the sub-pixel blur
   some engines introduce with an exact-zero Z (borrowed verbatim from the Forward recon finding).
4. **Zero layout reads mid-flight.** The only `getBoundingClientRect()` call in the whole sequence happens
   once, before the first transform is written. Every per-chip number after that (slot center, scatter
   origin, path bow, duration) is arithmetic on already-known data attributes — nothing forces a style
   recalc/layout during the 1.3s window.
5. **Single bulk cleanup, not N `transitionend` listeners.** The shipped implementation's failure mode: 20
   `transitionend` handlers fire in a staggered burst near t≈1.2-1.3s (since durations cluster), each
   mutating `style.willChange`/`style.transition` independently — a burst of interleaved style writes right
   as most chips are still compositing their final frame is a plausible dropped-frame cause under 4×
   throttle. Fix: use `Promise.all(anims.map(a => a.finished))`, then do ALL cleanup (strip `will-change`,
   enable `pointer-events`, remove the SVG) in one synchronous loop, once, after everything has already
   visually landed.
6. **`getTotalLength()` calls are batched** in the same up-front synchronous pass as the `getBoundingClientRect`
   read (20 calls, each sub-millisecond) — never interleaved with animation start, so they cannot cause a
   frame drop mid-sequence.
7. Verification target restated from design-brief §9.3.1: record the entrance under 4× CPU throttle (Chrome
   DevTools Performance panel), assert no frame in the recording exceeds 20ms. Do this before considering the
   hero done (see Risks).

## Interaction spec

**Drag activation:**

- Mouse (`pointerType === 'mouse'`): drag activates after 3px of movement following `pointerdown` on a
  `.gchip` or `.idler`. `setPointerCapture` on the chip. Cursor `grab` at rest, `grabbing` while active.
- Touch/pen: `pointerdown` starts a 350ms timer AND tracks movement. Drag activates on whichever comes
  first: (a) the 350ms timer elapses with total movement still <6px (long-press), or (b) horizontal movement
  exceeds 6px _and_ exceeds vertical movement (clear horizontal intent). If vertical movement exceeds 6px
  before either condition, abort — do not call `preventDefault`, let the browser scroll natively. Once
  activated: `preventDefault()` on subsequent `pointermove`, set `touch-action:none` on that one chip only
  (never globally, never in advance) so page scroll is never blocked except during an actual active drag of
  that element.
- Drag is **disabled entirely until the entrance settle completes** (`pointer-events:none` on `.chips` and
  `.idler` from load until the `Promise.all` bulk-cleanup step sets `pointer-events:auto`) — this is the
  answer to "how drag coexists with the entrance": it simply doesn't overlap. A visitor cannot grab a chip
  mid-flight.

**Drag math (grid-snap):**

- Cache `.cols` `getBoundingClientRect()` once at `pointerdown` (a discrete interaction start, not part of
  the ambient/entrance sequence — this read is fine).
- `colWidth = colsRect.width / columnCount` (5 desktop, 3 ≤640px). `rowHeight = colsRect.height / 20` (20
  half-hour rows spanning 08:00–18:00).
- On `pointermove` (rAF-throttled, not raw event rate): `candidateCol = clamp(round((pointerX - colsRect.left
  - dragOffsetX) / colWidth), 0, columnCount-1)`. `candidateRow = clamp(round((pointerY - colsRect.top -
    dragOffsetY) / rowHeight), 0, 20 - chipDurationRows)`. Chip follows the raw pointer via
`translate3d`; the ghost cell snaps to the rounded candidate.
- `chipDurationRows = chip's duration minutes / 30` (already known per chip; store as `data-dur-rows` at
  build time alongside existing `data-day`).
- **Collision → nearest free slot** (on `pointerup`):
  ```
  function findFreeSlot(day, desiredRow, durRows, self, allChips) {
    const maxRow = 20 - durRows;
    const occupied = allChips
      .filter(c => c !== self && c.day === day)
      .map(c => [c.startRow, c.startRow + c.durRows]);
    const free = row => row >= 0 && row <= maxRow &&
      !occupied.some(([s, e]) => row < e && row + durRows > s);
    if (free(desiredRow)) return desiredRow;
    for (let r = 1; r <= 6; r++) {           // search cap: 3 hours either side
      if (free(desiredRow - r)) return desiredRow - r;
      if (free(desiredRow + r)) return desiredRow + r;
    }
    return null;                              // nothing free nearby: spring back
  }
  ```
  Search is same-column only (never crosses days) — a wrong-day teleport would feel broken, not "solved."
  If `findFreeSlot` returns `null`, the chip springs back to its original slot (320ms, no flash).
- On a resolved slot: update the chip's `--d`, `top`, `height` inline custom properties/style to the new
  day/row (mirrors the same `pos()` math used at build time, computed in JS), then play the 320ms
  `--ease-settle` transform-only travel from its current drag-follow position to `transform:none` at the new
  slot, then rim flash.

**Idler → grid graduation** (the payoff mechanic):

- The idler is a `.chip` but not initially a `.gchip` (it has no day/row yet, and lives outside `.cols` in
  the page margin). Its drag handlers are identical to a normal chip's, except the drop target check is
  "was the pointer over `.cols` at `pointerup`?" rather than "did it move" (it always starts off-grid).
- On a successful drop inside `.cols`: reparent the idler `<div>` from its current position in `.container`
  into `#hero-slab .chips` (one DOM move, triggered by user action, not per-frame — cheap). Strip the
  `.idler` class (and its `idle-drift` animation) permanently, add `.gchip`, set `data-day`/`data-top`/
  `data-h`/`data-dur-rows` from the resolved slot, run the same 320ms settle + rim flash as any other drop.
  Set `sessionStorage.setItem('tf-idler-placed', '1')` at the moment the rim flash starts. **This is the
  cross-section contract**: `Closing.astro` reads this key (per direction §4.7) to decide whether to render
  its own arrival chip pre-settled and swap its headline. Key name and value are authoritative here; flag to
  the Closing section's author if they land on a different name.
- On a drop that misses `.cols` (idler released back in the margin, or dragged and let go off-target):
  spring back to the original margin position, 320ms, no flash, no reparenting, no sessionStorage write.
- Once graduated, the idler behaves as a normal draggable grid chip (can be re-dragged elsewhere). It does
  not "un-graduate" — there is no drag-back-to-the-margin affordance. Scope decision: this is a one-way
  payoff, not a full sandbox.

**Idler viewport scope**: idler stays hidden `<1339px` (unchanged breakpoint) — it needs open margin to read
as "off the grid," and neither tablet nor mobile widths have that margin. This is a deliberate scope
decision, not an oversight: mobile visitors get the settle and the drag-any-chip interaction, just not the
idler narrative device. The closing section's payoff copy must not assume the idler was ever seen (it
already doesn't — the default, undragged copy path is the common case).

**Honesty-line drag hint**: on the _first_ `pointerenter` of `#hero-slab` from a device with `(hover:
hover) and (pointer: fine)` (i.e., never on touch, matches "only if true, i.e. pointer device" from the
direction doc), the mono honesty line text gains a clause: `FREE - SYNCS WITH GOOGLE CALENDAR - DRAG A
CHIP` + the existing live clock suffix, unchanged after that. This fires once per page load, not on every
hover.

**Keyboard/focus**: no new tab stops. `.gchip` and `.idler` are not focusable (`tabindex` never set to `0`),
consistent with the slab's existing `role="img"` treatment, which already flattens its children out of the
accessibility tree. Drag is a pointer/touch-only enhancement layered on top of content that is otherwise
fully described by the slab's `aria-label`; see Accessibility section for the reasoning that this does not
lose information for assistive tech.

**Scroll coexistence**: outside of an active drag, nothing in this section touches `touch-action` or calls
`preventDefault` — the page scrolls normally over the hero, including over chips, at all times except the
brief window between a recognized touch-drag activation and its `pointerup`.

## DOM + implementation strategy

```
section.hero
  div.container
    h1.display-hero                          (Astro static, unchanged)
    p.sub.body-copy                          (unchanged)
    div.cta-row
      a.btn.btn-primary                      (unchanged; de-glow inherited from global.css)
      p.mono-line.honesty
        text node                            (JS-mutated: + "- DRAG A CHIP" once, + live clock always)
        span#hero-clock
    div.before-strip[aria-hidden]            (unchanged, reduced-motion only)
    div.slab#hero-slab[role=img][aria-label] (unchanged structure)
      div.slab-head ...                      (unchanged)
      div.slab-body
        div.gutter ...                       (unchanged)
        div.cols
          div.col × 5                        (unchanged)
          svg.fall-paths[aria-hidden][pointer-events:none]   <- NEW, JS-created, transient
            path × (up to 20)                                <- NEW, removed after settle
          div.chips
            div.chip.gchip × 19              (Astro static; + data-top/data-h/data-dur-rows, NEW attrs)
            div.chip.gchip.chip-live.flashable (unchanged, + same new attrs)
          div.nowline#nowline[hidden]        (unchanged)
    div.floor[aria-hidden]                   (unchanged)
    div.idler.chip[aria-hidden]              (unchanged markup; JS adds drag handlers + eventual
                                               reparent into .chips on graduation)
```

**Astro-rendered** (build time, unchanged plus 3 new numeric data attributes per chip): H1, sub, CTA, honesty
line skeleton, slab structure, all 20 chip DOM nodes at their final resting `top`/`height`/`left` with
`data-day`, `data-dx`, `data-dy`, `data-r` (existing) plus `data-top`, `data-h`, `data-dur-rows` (new,
trivial to add to the existing `pos()`/chip-map function — no new authored content, just exposing numbers
already computed for the inline `style` string).

**JS-driven** (all `is:inline`, three scripts as shipped, this spec's work lives in the first one plus one
new script):

1. **Entrance script** (extends the shipped settle script): batched `will-change` + scatter transform write
   → double-rAF → build `svg.fall-paths` + one `path` per chip (coordinate math per Visual spec) → fire
   `chip.animate()` + `path.animate()` per chip with shared timing objects → `Promise.all(...).then(bulkCleanup)`.
   Uses `window.TF.reducedMotion` (shared guard) for the early-return. Does **not** use the shared
   `window.TF.flipBetween` helper — the entrance's transforms are algebraic constants derived from
   build-time data, not two measured rects, so a generic FLIP helper adds an indirection with no benefit
   here.
2. **Drag script** (new): pointer handlers on `.gchip`/`.idler`, activation heuristic, ghost-cell rendering,
   `findFreeSlot`, drop settle (a manual two-number FLIP — current drag-follow transform → `none` — again
   not worth routing through the generic `flipBetween` helper since only a translate delta is involved, not
   a full rect comparison), idler reparent + sessionStorage write. Uses `window.TF.onVisible` to gate the
   idler's ambient drift loop and `window.TF.reducedMotion` to force near-zero WAAPI durations on drop
   when reduced motion is active (see Accessibility — WAAPI does not inherit the CSS media-query override).
3. **Honesty/date/now-line script** (shipped, unchanged) — extended by exactly one `pointerenter`-once
   listener for the drag hint text.

**Foundation dependency** (`window.TF`, from `src/scripts/motion.js`, not owned by this file): `TF.reducedMotion`
(boolean/guard), `TF.onVisible(el, cb, opts)`. `TF.drawPath` and `TF.flipBetween` exist in the shared helper
but are deliberately **not** used by Hero (see above) — noting this so the foundation agent doesn't treat
Hero as a required consumer of every helper.

**Size estimate**: entrance script ~55 lines (~1.1KB min), path/coordinate math ~35 lines (~0.7KB min), drag
script ~130 lines including collision search (~2.6KB min), honesty-hint addition ~8 lines. Total new/changed
JS ≈ 4.4KB minified (~1.7KB gzipped) on top of the existing ~1.6KB now-line/date script (unchanged). Well
inside the page's fold budget.

## Accessibility + reduced motion

- `#hero-slab` keeps `role="img"` and its existing `aria-label` verbatim ("A week on the Taskflow grid:
  twenty task chips settled into their time slots, Monday through Friday") — the count is unaffected by the
  idler (it is deliberately the one chip _not_ in that count).
- All `.gchip` and `.idler` nodes stay outside the accessible tree (flattened by the parent's `role="img"`),
  are never given `tabindex="0"`, and drag is never exposed as a keyboard interaction (design-brief §5
  "Never: keyboard-initiated animation"). This does not remove functionality for assistive tech: the slab's
  label already fully describes the settled end-state, and the drag interaction's narrative payoff (idler →
  closing section) is _also_ delivered in the closing section's plain-text copy regardless of whether a given
  visitor ever drags anything — AT users get the same story through prose, sighted pointer/touch users get it
  through play.
- `svg.fall-paths` and every `path` inside it: `aria-hidden="true"`, `focusable="false"`. Purely decorative,
  never conveys unique information (the settle destination is the same with or without the visible line).
- Reduced motion: the existing early-return (`prefers-reduced-motion: reduce` check at the top of the
  entrance script) means chips render at their authored resting position with **no** scatter transform ever
  applied — no scatter, no paths, no drift. This is unchanged from shipped behavior and must stay a hard
  early-return, not a shortened animation.
- Drag is **not** disabled under reduced motion (it's a discrete, user-initiated interaction, not ambient
  motion) — but the drop-settle transform must resolve in ~1ms, matching the rest of the site's reduced-motion
  contract. **Gotcha to flag explicitly**: global.css's blanket `@media (prefers-reduced-motion: reduce)`
  rule (`animation-duration/transition-duration: 0.01ms !important`) only touches CSS animations/transitions
  — it does **not** affect `Element.animate()` (WAAPI) calls. The drag script must check
  `window.TF.reducedMotion` itself and pass `duration: 1` to any WAAPI call it makes (the drop-settle) when
  true. The entrance script never reaches its WAAPI calls at all under reduced motion (early return), so this
  gotcha only applies to the drag script's drop animation.
- Idler ambient drift (`idle-drift` keyframe) is already killed under reduced motion in shipped CSS — kept.
- No motion sickness surface introduced: only `transform`/`opacity` change, no parallax, no scale-on-scroll,
  nothing scroll-jacked.

## Risks

1. **Regression to the old jitter** if an implementer reaches for the familiar "CSS transition string +
   `transitionend` listener per chip" pattern instead of WAAPI + `Promise.all` bulk cleanup. Guard: the
   Motion timeline's "why this cannot jitter" list is the literal implementation checklist — code review
   against it, and record a 4×-throttle trace before calling the section done (design-brief §9.3.1).
2. **Fall paths reading as decoration, not instrument lines**, if the control-point formula is simplified
   to a fixed bow instead of one derived from each chip's own `data-r`. Guard: the rotation-derived bow is
   not optional polish — it's the one thing that makes the line "explain the motion" per direction §2.1
   rather than being a generic curved-line hero flourish (the exact "generic dark SaaS" trap this brief
   warns against).
3. **The idler goes undiscovered.** If nobody drags it, the whole narrative device is invisible. Mitigated
   two ways: it's already visually singular (only chip drifting, only chip outside the grid, only chip with
   `cursor:grab`), and the closing section's copy is written to work whether or not it was ever touched — so
   an undiscovered idler degrades gracefully to "a nice detail some visitors find," not a broken narrative.
4. **Collision search producing a far-away "teleport."** An unbounded nearest-slot search could snap a chip
   three columns away from where the visitor actually dropped it, reading as broken rather than helpful.
   Guard: the search is same-day-only, capped at ±6 rows (3 hours), and falls back to a spring-back (not an
   ever-widening search) when nothing is free nearby.
5. **Touch drag fighting page scroll** is the single most common way this kind of interaction ships broken.
   Guard: the 6px/long-press activation heuristic plus per-element (never global) `touch-action:none` scoped
   strictly to the active-drag window. Test explicitly on iOS Safari and Android Chrome — their touch-action
   timing nuances differ and this is exactly the kind of bug that only shows up on real hardware.
6. **sessionStorage key drift.** If `Closing.astro`'s author independently invents a different key name than
   `tf-idler-placed`, the cross-section payoff silently never fires. This spec is the source of truth for the
   key name/value/timing; flag it explicitly during the coherence pass.
7. **Rim-flash color drifting per-chip.** Someone "fixing" the flash to match each chip's own hue (seems
   intuitive, is wrong) would break the aqua law's one-signal rule. Guard: flash reuses the shipped
   `.flashable`/`.is-flash` mechanism verbatim, which is already hardcoded to `--aqua` regardless of
   `--chip-c` — never derive the flash color from the chip.
