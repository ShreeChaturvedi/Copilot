# Closing suite spec — Closing.astro + Receipts.astro (rebuild) + Footer.astro

Owner: this spec governs three files — `landing/src/components/Closing.astro`,
`landing/src/components/Receipts.astro` (rebuilt), `landing/src/components/Footer.astro`. Reads on top of
`redesign-v2-direction.md` §4.6/§4.7/§4.8 and `design-brief.md` (tokens §2, type §3, motion §5). Copy is
verbatim except the one flagged settled-variant headline (§4.7 leading proposal, carried here unchanged,
still requires owner sign-off before it ships per project rule — prose changes are propose-then-approve).

**Accent decision (stated for the coherence audit):** aqua is NOT muted here either, matching `keys.md` and
`clock.md`. `--aqua` stays at its design-brief value and means exactly one thing across all three files:
live/placed. It appears only as: the CTA fill (`Start free`), the rim-flash on the chip when it lands, and
the one-shot now-line tick beneath the frame. The arrival path, the ghost grid, the receipt glyphs, and the
footer mark are all geometry, not signal — they render in `--line-dim` (dim aqua-phosphor per direction
§2.1), never in `--aqua` itself. This is the same split `keys.md` uses: neutral hardware/geometry, aqua only
where something is actually live or just placed.

---

## Concept

**THE LONG ARRIVAL.** The closing section performs the one thing the page has been withholding since the
hero: the idler chip's landing. It travels in from the same margin direction it idled in, along a drawn
line that draws ahead of it and undraws behind it, lands with the page's one rim-flash signal, and the
frame's floor ticks once — a last, quiet echo of the hero's now-line. That same stroke grammar (1.5px,
phosphor-dim, dashoffset draw-in) then carries down through the icon marquee's ten glyphs and into a single
12px mark in the footer, so the page's final three moments read as one closing paragraph in one hand, not
three unrelated widgets bolted to the bottom of the page.

Three directions were brainstormed for the arrival. **THE SETTLED RECORD** (runner-up): treat the frame as
a ledger — the frame's own border and gridlines draw in first as a wireframe, then the chip fades into
existence in place (no travel) alongside a mono line that types itself out ("SAT 10:00 — PLACED"),
leaning into a receipt/ledger reading of the closing beat. It lost on two counts: it does not satisfy the
owner's explicit leading idea (arrival _along a drawn path_, from the margin) — it materializes in place
instead of traveling — and a typewriter reveal is already TypeIt's signature move; reusing it here dilutes
the one section that owns typing as a device. **THE DOUBLE STAGE** (discarded early): a literal two-panel
diagram — a miniature ghost of the hero margin on one side, a dashed connector, the landed chip on the
other — was cut for being static (contradicts the MUST for _more_ animation here) and for stealing
ThreePlaces' brace/connector motif, which that section already owns. THE LONG ARRIVAL won because it is the
only one of the three that is actually a performance (not a diagram), it pays off the hero idler with real
spatial continuity (same object, same color, arriving from the same side it waited on), and it reuses the
page's existing fall-path grammar (§2.1, already proven in the hero spec) rather than inventing a new motion
primitive — the definition of "not generic," since a generic dark SaaS closing would just fade the app
screenshot up 20px and call it done.

Generic-trap check: a plain `opacity:0,translateY(20px)→opacity:1,translateY(0)` reveal on the chip (what a
templated build would ship) is explicitly rejected below — the chip must travel a directional vector that
echoes the hero idler's actual margin position, and a real (if decorative) curved SVG line must accompany
it, or the "long arrival" concept has nothing distinguishing it from a stock fade-in.

---

## Layout

### Closing.astro

Container: existing `.container` (max-width 1080px, 24px inline padding, 16px at ≤640px). Section: existing
`.section` vertical rhythm. `.closing-inner` stays a centered flex column, `gap: 36px`, three visible
children in order: `.arrival-stage` (wraps `.slot-frame`), `.floor` (new), `h2.display-section`,
`.cta-stack`. A fourth element, `.grid-ghost`, is a direct child of `<section class="closing">` (sibling of
`.container`), absolutely positioned behind everything (`z-index:0`; give `.container` `position:relative;
z-index:1` to sit above it).

**1440 (desktop), k=1 (see Motion timeline for k):**

```
┌──────────────────────────────────────────────────────────────────────┐
│                    (faint 5×6 line-grid ghost, barely visible)        │
│                                                                        │
│                                          ·  <- arrival path draws in  │
│                                        ,'    from upper-right margin  │
│                                      ,'                                │
│                        ┌───────────┐'                                 │
│                        │    SAT    │                                  │
│                        │ 10 AM ┌───┴──────┐                            │
│                        │       │10:00 Plan │ <- chip lands, rim-flash │
│                        │       │ the trip  │                          │
│                        │ 11 AM └───────────┘                          │
│                        └───────────┘                                  │
│                    ─────────●───────────────  <- floor, one-shot tick │
│                                                                        │
│                One task is still waiting. Give it a time.             │
│                                                                        │
│                          ┌─────────────┐                              │
│                          │  Start free │  <- machined aqua key         │
│                          └─────────────┘                              │
│                          NO CARD REQUIRED                              │
└──────────────────────────────────────────────────────────────────────┘
```

**390 (mobile), k≈0.43:** identical structure, arrival geometry scaled down (see Motion timeline); frame
stays 230px wide (unchanged from current implementation — it already fits 358px content width at 16px
container padding); headline wraps to 2-3 lines at its existing `max-width: 430px` cap (unaffected by this
spec).

```
┌────────────────────────────────┐
│   (ghost grid, very faint)      │
│                    ·            │
│              ┌───────────┐      │
│              │    SAT    │      │
│              │10 AM ┌────┴──┐   │
│              │      │10:00  │   │
│              │      │Plan.. │   │
│              │11 AM └───────┘   │
│              └───────────┘      │
│          ────●───────────       │
│                                  │
│  One task is still waiting.     │
│  Give it a time.                │
│                                  │
│      ┌─────────────┐            │
│      │  Start free │            │
│      └─────────────┘            │
│      NO CARD REQUIRED            │
└────────────────────────────────┘
```

### Receipts.astro

Full-bleed `<aside>`, unchanged outer geometry: hairline top/bottom, `padding-block: 28px` (was 18px — the
band needs more vertical room for icon+caption than it did for one text line). `.band` masks the edges
(§2.4 exact formula). `.track` is a flex row of 20 items (10 facts × 2, duplicated for the loop), each item
a flex column: 32×32px glyph, 8px gap, 11px mono caption. Gap between items: 56px.

**1440 and 390 (marquee — same structure, only the visible slice width differs, content scrolls):**

```
┌──────────────────────────────────────────────────────────────────────┐
│▓░  ⊞        ▤        ↻        ⇄        ⌨        ▭        ≡    ░▓│
│▓░ WEEK   NATURAL  RECURR-  GOOGLE   KEYBOARD  COMMAND   LIST   ░▓│
│▓░ GRID    DATES    ENCE     SYNC     FIRST      BAR              ░▓│
└──────────────────────────────────────────────────────────────────────┘
  ^mask-fade                                              mask-fade^
```

### Footer.astro

Unchanged flex row (`justify-content: space-between`). Add one 12px glyph (reuses the WEEK GRID symbol —
the most "brand" glyph, the page's core object) immediately before the "BUILT BY..." text, 8px gap,
`aria-hidden="true"`, static (no draw-in, no motion — a footer credit line is not a reveal moment).

```
[⊞] BUILT BY SHREE CHATURVEDI                                    GITHUB
```

---

## Visual spec

### Closing — arrival stage geometry (all values at k=1, desktop reference ≥900px viewport)

`.slot-frame` unchanged: 230px wide, `.s-head` 34px, `.s-body` 128px (total 162px), `overflow: visible`
(already set). Chip landing box (unchanged, existing CSS): `top:25%; height:37.5%` of `.s-body` → pixel
center in frame-local coords ≈ **(134, 90)** measuring from the frame's top-left corner.

**Offstage transform** (chip's starting state, applied via `.s-chip.offstage`):
`transform: translate(256px, -150px) rotate(10deg)` — up and to the right, echoing the hero idler's
position (idler sits to the right of the hero slab). This replaces the current implementation's
`translate(150px, -90px) rotate(9deg)` with a slightly longer throw to give the accompanying path room to
show real curvature.

**Arrival path** (new `<svg class="arrival-path">`, child of `.slot-frame`, `aria-hidden="true"`,
`pointer-events: none`):

- `viewBox="0 0 420 290"`, positioned `position:absolute; left:0; top:-190px; width:420px; height:290px;
overflow:visible`.
- Frame-local point `(x,y)` maps to svg-local `(x, y+190)`. Landing point (134,90) → svg-local **(134,280)**.
  Offstage start point, frame-local (390,-60) → svg-local **(390,130)**.
- One `<path>`, single stroke:
  `d="M390,130 Q260,90 134,280"` (quadratic, one control point pulling the arc up-left — a gentle downward
  sweep, not a straight diagonal).
- `stroke="var(--line-dim)"`, `stroke-width="1.5"`, `fill="none"`, `stroke-linecap="round"`,
  `vector-effect="non-scaling-stroke"`.
- `transform: scale(k)` applied via JS, `transform-origin: 134px 280px` (anchored at the landing point so
  only the start/curve shrinks toward it at narrow viewports, the endpoint never moves).

**Floor** (new, borrowed recipe from Hero's `.floor`): `height:1px; width:190px; margin:0 auto;
background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--aqua) 22%, transparent) 50%,
transparent);` — dimmer than Hero's version (22% vs 30%) since this one is static except for its one-shot
tick, not a permanent glow.

**Now-tick** (new, child of `.floor`): a 6px aqua dot, `position:absolute; top:50%; left:0; width:6px;
height:6px; border-radius:999px; background:var(--aqua); transform:translate(-50%,-50%); opacity:0;`. On
fire: translates from `left:0` to `left:100%` and fades out over its final 25% of travel — see Motion
timeline.

**Grid ghost** (new, sibling of `.container` inside `<section class="closing">`):

```css
.grid-ghost {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background-image:
    repeating-linear-gradient(
      to right,
      transparent 0,
      transparent calc(20% - 1px),
      color-mix(in oklab, var(--line-dim) 35%, transparent) calc(20% - 1px),
      color-mix(in oklab, var(--line-dim) 35%, transparent) 20%
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(16.66% - 1px),
      color-mix(in oklab, var(--line-dim) 35%, transparent) calc(16.66% - 1px),
      color-mix(in oklab, var(--line-dim) 35%, transparent) 16.66%
    );
  background-size: 640px 420px;
  background-position: center 40px;
  background-repeat: no-repeat;
  mask-image: radial-gradient(
    ellipse 60% 70% at center,
    black,
    transparent 85%
  );
}
```

5 columns × 6 rows, a faint patch rather than a full-bleed field (`background-repeat: no-repeat` + the
radial mask keep it from reading as a legible diagram — it must stay pre-conscious, a texture, not a chart).
Explicitly does NOT use any `--etch-*` token (etch is app-only per design-brief §2.5) — uses `--line-dim`
only, at a lower effective alpha (35% mix on top of the already-dim token) than the receipt glyphs, so the
background never competes with foreground content.

**CTA (de-glow, §2.7):** Closing consumes the shared `.btn-primary` from `global.css` unchanged — no local
override. Depends on the foundation change below (see needs_foundation): remove the neon
`box-shadow: 0 0 28px aqua`, replace with `var(--edge-machined), var(--shadow-penumbra)`. `--edge-machined`
already carries the inset top-highlight (`inset 0 0.5px 0 rgb(246 248 248/.08)`), so the "machined lit key"
read comes from combining that existing token with the new penumbra stack — no new recipe needed beyond
the two tokens. Hover → `--aqua-hover`. Active → `scale(0.97)` (already in `.btn:active`).

**Chip color:** stays `--hue-violet` (unchanged) — same object as the hero idler, same stored color, no new
decision needed; this is an existing cohesion pair, not something this spec introduces.

### Receipts — ten glyphs (shared sprite)

New shared partial: `landing/src/components/icons/Glyphs.astro` — exports a hidden `<svg style="display:
none" aria-hidden="true">` containing ten `<symbol>` defs, imported by both `Receipts.astro` and
`Footer.astro` (the only two consumers; not a foundation file, owned by this spec since both consumers are
mine). Every symbol: `viewBox="0 0 32 32"`, one `<path>` (never more than one — see DOM section for why),
`fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`,
`stroke-linejoin="round"`, `vector-effect="non-scaling-stroke"`. Instances set `color: var(--line-dim)`.
Render size everywhere: 32×32px.

| id        | fact           | `d`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `g-week`  | WEEK GRID      | `M7,8 H25 V24 H7 Z M7,13 H25 M11.5,8 V24 M16,8 V24 M20.5,8 V24`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `g-dates` | NATURAL DATES  | `M8,10 H24 V25 H8 Z M8,15 H24 M12,6 V10 M20,6 V10`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `g-loop`  | RECURRENCE     | `M22,11 A9,9 0 1 1 11,9.5 M11,9.5 L9,7 M11,9.5 L14,10.5`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `g-sync`  | GOOGLE SYNC    | `M9,13 A7,7 0 0 1 22,10 M22,10 L22,6 M22,10 L26,11 M23,19 A7,7 0 0 1 10,22 M10,22 L10,26 M10,22 L6,21`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `g-key`   | KEYBOARD FIRST | `M7,10 H25 V22 H7 Z M12,18 H16`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `g-cmd`   | COMMAND BAR    | `M6,12 H26 V20 H6 Z M10,14.5 L12.5,16 L10,17.5 M15,16 H19`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `g-list`  | LIST           | `M8,10 H10 M13,10 H24 M8,16 H10 M13,16 H24 M8,22 H10 M13,22 H24`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `g-board` | BOARD          | `M7,8 H14 V24 H7 Z M18,8 H25 V24 H18 Z M9,10 H12 V14 H9 Z`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `g-month` | MONTH          | 9 tiny circles (r=1.2), centers at x∈{10,16,22}×y∈{10,16,22}: `M8.8,10A1.2,1.2 0 1,0 11.2,10A1.2,1.2 0 1,0 8.8,10 M14.8,10A1.2,1.2 0 1,0 17.2,10A1.2,1.2 0 1,0 14.8,10 M20.8,10A1.2,1.2 0 1,0 23.2,10A1.2,1.2 0 1,0 20.8,10 M8.8,16A1.2,1.2 0 1,0 11.2,16A1.2,1.2 0 1,0 8.8,16 M14.8,16A1.2,1.2 0 1,0 17.2,16A1.2,1.2 0 1,0 14.8,16 M20.8,16A1.2,1.2 0 1,0 23.2,16A1.2,1.2 0 1,0 20.8,16 M8.8,22A1.2,1.2 0 1,0 11.2,22A1.2,1.2 0 1,0 8.8,22 M14.8,22A1.2,1.2 0 1,0 17.2,22A1.2,1.2 0 1,0 14.8,22 M20.8,22A1.2,1.2 0 1,0 23.2,22A1.2,1.2 0 1,0 20.8,22` |
| `g-now`   | NOW LINE       | `M8,16 A2.4,2.4 0 1,0 8.01,16 M8,16 H24`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Caption: `.g-caption { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color:
var(--ink-muted); text-align: center; }` (text already uppercase in the source array, no `text-transform`
needed).

### Footer glyph

`<svg width="12" height="12" viewBox="0 0 32 32" aria-hidden="true" class="foot-mark"><use
href="#g-week"/></svg>` (references the shared `Glyphs.astro` sprite), `color: var(--ink-muted)` (matches
the existing mono text color exactly, no separate tint), static, no dasharray/dashoffset styling applied —
fully drawn at all times.

---

## Motion timeline

`k = Math.min(1, window.innerWidth / 900)`, computed once on load and on resize (mirrors Hero's existing
scatter-scale pattern). All px values below are desktop reference (k=1); multiply travel distances by `k`
at run time. Rotation degrees and percentages are never scaled.

### Closing — default (non-pre-settled) path, triggered once via `window.TF.onVisible(stage, cb, {once:

true, threshold: 0.6})`on`.arrival-stage`

| t-offset | element                                      | from → to                                                                                         | duration | easing          | trigger                                                              |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | --------------- | -------------------------------------------------------------------- |
| t=0ms    | `.arrival-path` (path)                       | `stroke-dashoffset: L → 0` (L = `path.getTotalLength()`)                                          | 420ms    | `--ease-settle` | IO fires (frame 60% visible)                                         |
| t=80ms   | `.s-chip`                                    | `transform: translate(256k,-150k) rotate(10deg) → none`                                           | 700ms    | `--ease-settle` | same IO event, +80ms JS delay                                        |
| t=780ms  | `.s-chip`                                    | add `.is-flash` → `::after` rim ring `opacity: .6 → 0` (existing global `.flashable`/`rim-flash`) | 240ms    | `--ease-out`    | `transitionend` on chip's `transform`                                |
| t=780ms  | `.arrival-path` (path)                       | `stroke-dashoffset: 0 → -L` (undraws from its start, i.e. behind the chip)                        | 320ms    | `--ease-settle` | same `transitionend`                                                 |
| t=1040ms | `.now-tick`                                  | `left: 0% → 100%`; `opacity: 1` held then `1→0` over the final 120ms of travel                    | 480ms    | `--ease-settle` | `transitionend` on rim-flash pseudo-element (t≈1020ms) + 20ms buffer |
| —        | `h2[data-reveal]`, `.cta-stack[data-reveal]` | existing shared reveal (`opacity:0,translateY(14px) → opacity:1,translateY(0)`)                   | 500ms    | `--ease-out`    | existing shared scroll-reveal IO (unchanged, not owned by this spec) |

Total one-shot sequence: ~1.5s from entering view. Fires once; no replay on re-entry (matches the existing
implementation and the copy's "the page asks once" framing — this is the one place on the page that is
deliberately NOT a looping/replayable demo).

### Closing — pre-settled path (sessionStorage flag set, see DOM section)

No timeline runs. `.s-chip` never receives `.offstage`; `.arrival-path` is not drawn (dashoffset stays at
its drawn length, i.e. rendered but never animated — or simplest: not rendered into the DOM at all for this
branch, implementer's choice, visual result is identical either way); no rim-flash (it was "placed" earlier
in the session, this is not a placement event); `.now-tick` never fires. Headline swap (see Interaction
spec) happens regardless of this branch — it is a content decision, not a motion one.

### Receipts — ambient marquee

| t-offset                   | element                | from → to                                               | duration | easing          | trigger                                                                                                                                                          |
| -------------------------- | ---------------------- | ------------------------------------------------------- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| continuous                 | `.track`               | `transform: translate3d(0,0,0) → translate3d(-50%,0,0)` | 50s      | linear          | page load, gated by a persistent (non-once) visibility observer: `animation-play-state: paused` while `.band` is off-screen, `running` while any part is visible |
| once per item, first entry | each `.item`'s `<use>` | `stroke-dashoffset: len → 0`                            | 500ms    | `--ease-settle` | `window.TF.onVisible(item, cb, {once:true, threshold:0.5})`                                                                                                      |

`len` is computed once per glyph id at load by reading `getTotalLength()` off the real `<path>` living
inside the (invisible) `<symbol>` in `Glyphs.astro` — `<use>` elements cannot call `getTotalLength()`
themselves, but CSS presentation properties set on a `<use>` (via inline style) DO apply to its referenced
content, so `stroke-dasharray`/`stroke-dashoffset` set directly on each `<use>` element works correctly.
Cache the ten lengths in a plain object keyed by symbol id, computed once, reused for every one of the 20
`<use>` instances.

### Off-screen and reduced-motion behavior

- Marquee: pauses via the persistent IO the moment `.band` leaves the viewport in either direction (not a
  one-shot — this loop must stop consuming a compositor tick while scrolled away, per §2.6 "all ambient
  loops pause off-screen").
- `prefers-reduced-motion: reduce`: marquee `animation: none`; hide the duplicate half
  (`.track > :nth-child(n+11) { display: none }`, mirrors the current implementation's
  `.track :last-child { display:none }` pattern extended to 10 items) and let the single row wrap
  (`white-space: normal`, matches current reduced-motion CSS); every glyph renders fully drawn
  (`stroke-dashoffset: 0` set immediately, IO/draw-in code path skipped entirely — do not attach the
  observer at all when the media query matches, matching the existing early-out idiom used in Hero and the
  current Closing script).
- Closing: reduced motion skips the entire arrival timeline (early `return` before attaching the IO,
  identical structure to the current implementation's existing guard) — `.s-chip` renders in its natural,
  un-offstage CSS position from first paint, `.arrival-path` is not drawn, `.now-tick` never fires. The
  headline-swap check runs unconditionally, before the reduced-motion branch (see Interaction spec) — it is
  content, not motion.

---

## Interaction spec

**CTA (`Start free`):** hover → `background: var(--aqua-hover)` (existing `.btn-primary:hover`, unchanged).
Active/press → `transform: scale(0.97)` (existing `.btn:active`, unchanged). Focus-visible → global
`2px solid var(--aqua)` ring, `outline-offset: 1px` (unchanged, no local override). No new interactive
elements in Closing beyond the existing CTA link and the (unchanged) footer GitHub link — the arrival
chip, path, floor, tick, ghost grid, and all ten receipt glyphs are decorative and `aria-hidden`.

**Touch:** nothing draggable in these three files (unlike Hero/Keys). Standard tap-target sizing applies;
no special touch handling needed. Note for the foundation owner (not fixed here, `.btn` is shared): measured
`.btn` height at current padding/font values is ~38px, under the 44px mobile target — flagging, not fixing,
since `.btn` lives in `global.css`.

**sessionStorage contract (cross-file coordination — Hero owns the write side, this spec owns the read
side):** key `tf_idler_placed`, value `"1"`, written by Hero's drag handler the moment the visitor
successfully drops the idler chip onto a free grid slot (per direction §4.1/§4.7). Closing's `is:inline`
script reads it synchronously, in an inline script tag placed immediately after the `<h2>` element (so it
executes during initial parse, before the shared reveal IO has any chance to fire — the closing section is
far down the page, so there is no realistic race even without this ordering, but the ordering removes the
risk entirely rather than relying on scroll distance):

```js
(function () {
  var settled = sessionStorage.getItem('tf_idler_placed') === '1';
  var h2 = document.querySelector('#closing h2');
  if (settled && h2) h2.textContent = 'Every task has its time.';
  document.getElementById('closing').classList.toggle('is-presettled', settled);
})();
```

`.is-presettled` on the section drives the CSS/JS branch described in the Motion timeline (no offstage
class applied, arrival script's own IO setup is skipped if `.is-presettled` is present — check this class,
not sessionStorage again, inside the arrival script, so there is exactly one source of truth read once).

If the actual Hero implementation lands on a different key name, this is the one cross-file string that
must be reconciled at integration time — flagging explicitly since Hero.astro is a different agent's file.

**Keyboard:** no new focusable elements; tab order unchanged (CTA is still the only focusable node in this
section, GitHub link the only one in the footer).

---

## DOM + implementation strategy

### Closing.astro (element tree, additions marked NEW)

```
section.closing#closing
  div.grid-ghost (NEW, aria-hidden, sibling of .container)
  div.container.closing-inner
    div.arrival-stage (NEW wrapper, position:relative — purely a naming/clarity wrapper, no required layout change beyond what .slot-frame already has)
      div.slot-frame[role=img][aria-label unchanged]
        div.s-head > span.s-dow "SAT"
        div.s-body
          span.s-hour × 2
          div.chip.s-chip.flashable#closing-chip  (unchanged content)
          svg.arrival-path (NEW, aria-hidden, one <path>)
    div.floor (NEW)
      div.now-tick (NEW)
    h2.display-section[data-reveal]  (text mutated client-side per sessionStorage check)
    div.cta-stack[data-reveal]
      a.btn.btn-primary "Start free"
      p.mono-line "NO CARD REQUIRED"
```

Two `is:inline` scripts, in this order (order matters — the sessionStorage/headline script must run
before the arrival script reads `.is-presettled`):

1. **Headline/settled-state script** (~10 lines, shown above under Interaction spec) — always runs,
   independent of reduced-motion.
2. **Arrival script** (~45 lines): early-return on `prefers-reduced-motion: reduce` OR
   `#closing.is-presettled`; otherwise sets up `window.TF.onVisible(stage, cb, {once:true, threshold:0.6})`
   (foundation helper) and inside the callback: computes `k`, sets the chip's offstage transform inline,
   forces a reflow, then calls `window.TF.drawPath(pathEl, {duration:420})` for the initial draw (if the
   foundation's actual `drawPath` signature differs from `{delay, duration, undraw}` as described in
   direction §5, inline the equivalent 6-line dashoffset transition directly — the visual contract in the
   Motion timeline above is authoritative, the helper call is a convenience, not a hard dependency), starts
   the chip's `transform` transition 80ms later, and on that transition's `transitionend` adds `.is-flash`,
   fires the path's undraw, and schedules the `.now-tick` sweep.

Estimated JS size: ~1.3KB minified for the two scripts combined (headline check is trivial; arrival script
is the bulk, comparable to the existing Hero settle script which is already in the codebase at similar
complexity).

### Receipts.astro (element tree)

```
aside.receipts[aria-label="What ships today"]
  p.sr-only (updated text, see copy_changes)
  div.band[aria-hidden]
    div.track
      div.item × 10 (first pass)
        svg.g-icon[width=32,height=32] > use[href="#g-week"] ... etc.
        span.g-caption.mono "WEEK GRID"
      div.item × 10 (duplicate pass, identical markup, for the seamless loop)
```

Imports `Glyphs.astro` (new shared partial under `src/components/icons/`) for the `<symbol>` defs, rendered
once at the top of the component (Astro components can render another component's markup inline; the sprite
`<svg style="display:none">` is emitted once, both `Receipts.astro` and `Footer.astro` import the same
partial — Astro will emit it twice in the final HTML since each `.astro` file renders independently; that is
fine, ~1.4KB of duplicate inline SVG text is not worth a client-side dedup mechanism).

`is:inline` script (~55 lines): (1) compute `len` per glyph id via a temporary/hidden read of each
`<symbol>`'s `<path>.getTotalLength()`, cache in an object; (2) set `stroke-dasharray`/`stroke-dashoffset`
inline on every `<use>` from the cache; (3) attach one persistent `IntersectionObserver` to `.band` toggling
`.track`'s `animation-play-state` (running/paused) — NOT the one-shot `onVisible` helper, since this needs
continuous enter/exit, not a single fire; (4) attach one `window.TF.onVisible(item, cb, {once:true,
threshold:0.5})` per `.item` to transition that item's `<use>` to `stroke-dashoffset:0`. Early-return before
any of this under `prefers-reduced-motion: reduce`, instead setting every `<use>`'s dashoffset to `0`
directly and skipping the marquee animation entirely (handled by the CSS reduced-motion block, not JS, for
the animation itself — JS only needs to skip the draw-in wiring).

Estimated JS size: ~1.1KB minified.

### Footer.astro (element tree)

```
footer.footer
  div.container.foot-row
    div.foot-brand (NEW wrapper, flex, gap:8px, align-items:center)
      svg.foot-mark[width=12,height=12,aria-hidden] > use[href="#g-week"]
      span.mono.foot-text "BUILT BY SHREE CHATURVEDI"
    a.mono.foot-text.foot-link "GITHUB" (unchanged)
```

No script. Imports `Glyphs.astro` for the one `<use>` reference. Zero new JS.

### Why every glyph is exactly one `<path>`

`<use>` elements cannot host per-child stroke-dasharray (no shadow-DOM-style selector access into what a
`<use>` renders), so a glyph built from several independent `<path>`/`<line>`/`<circle>` primitives could
not be draw-in animated as one unit through a single `<use>` reference. Collapsing every glyph to one path
(using multiple `M` moveto commands for disconnected sub-strokes, and arc-pairs for the two circular
glyphs) means `stroke-dasharray`/`stroke-dashoffset` set on the `<use>` itself correctly drives the whole
glyph's draw-in in one CSS transition, with no per-primitive JS bookkeeping. This is a real, load-bearing
implementation constraint, not a style preference — do not "simplify" a glyph back into multiple elements
inside a symbol without also rebuilding the draw-in mechanism.

---

## Accessibility + reduced motion

- Closing's `.slot-frame` keeps its existing `role="img"` + `aria-label="A Saturday column with the task
Plan the trip settled at 10:00."` — unchanged by this spec, and correct for BOTH the animated and
  pre-settled paths (assistive tech never perceives the arrival animation either way, only the final DOM
  state, which is identical in both branches).
- `.arrival-path`, `.floor`, `.now-tick`, `.grid-ghost` are all `aria-hidden="true"` / decorative, none carry
  information not already stated in the frame's `aria-label`.
- Receipts: `aria-label="What ships today"` on the `<aside>` unchanged; `.band` stays `aria-hidden="true"`;
  the `sr-only` paragraph is the sole accessible description of the fact list (see copy_changes for its
  updated text — it must list all ten facts now, not five).
- Footer: the new mark is `aria-hidden="true"`, adds no information (the mono text next to it already says
  everything).
- Full reduced-motion behavior is specified inline in the Motion timeline section above; summarized: page
  renders fully settled, no JS-driven travel, marquee frozen with the duplicate half hidden and content
  wrapped, every glyph pre-drawn. Nothing is gated on JS running at all for content — only for the
  animations layered on top.

---

## Risks

1. **The arrival reads as a generic fade-up if the curve/vector is softened during build.** A lazy
   implementation collapses this to `opacity:0,translateY(20px)→1,0` because that's the path of least
   resistance for "something arrives." Guard: the offstage transform is a specific two-axis vector
   `(256px,-150px)` at 10° rotation, not a vertical nudge, and the decorative SVG curve is a required
   deliverable, not optional polish — a straight or absent line means this spec was not followed.
2. **CTA still reads glowy if only the blur radius is reduced instead of swapping the shadow recipe
   entirely.** Guard: `.btn-primary`'s box-shadow must be exactly `var(--edge-machined), var(--shadow-
penumbra)` — no standalone soft outer glow of any radius/opacity is permitted on this element, full stop.
3. **Receipt glyphs drift toward generic rounded-corner icon-font style** (the temptation to grab a Feather/
   Heroicons-style icon instead of hand-drawing the specified paths) and stop matching the hero fall-paths
   and clock dial. Guard: exact `d` attributes are given per glyph above; stroke stays 1.5px,
   `vector-effect: non-scaling-stroke`, color `var(--line-dim)`, never a filled icon, never a rounded-rect
   icon-tile background behind it (no chip-shaped container — see Concept section on why that would collide
   with the app's own chip semantics).
4. **The marquee reads as a text ticker wearing icon costumes** if captions get sized up or glyphs get
   sized down. Guard: glyph 32px is the dominant visual weight, caption 11px muted mono is secondary —
   ratio must stay roughly 3:1 in visual weight, matching the numbers given, not "eyeballed" during build.
5. **The grid ghost becomes a legible diagram** (reusing `--etch-line`/`--etch-strong` out of habit, since
   that's the existing "faint grid" pattern everywhere else in the app). Guard: this spec explicitly
   forbids any `--etch-*` token here — etch is app-only law (design-brief §2.5); use `--line-dim` at the
   specified extra-dim mix, and keep the radial mask so it never reads as more than a texture.
6. **The footer glyph becomes a one-off decorative flourish** invented fresh instead of reusing the shared
   sprite. Guard: it must be `<use href="#g-week">` referencing the exact same symbol Receipts uses — an
   eleventh, bespoke footer-only mark would break the "one hand" argument the whole Concept rests on.
7. **The settled-variant headline swap flashes the wrong text for a frame.** Guard: the sessionStorage read
   is a synchronous inline script placed immediately after the `<h2>`, not deferred, not wrapped in the
   arrival script's own IO callback — it must run during initial parse regardless of scroll position or
   motion preference.
