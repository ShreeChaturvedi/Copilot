# Spec: "One task, three places." (`ThreePlaces.astro`)

Governing docs: `redesign-v2-direction.md` §2 (upgrade grammar), §4.3 (this section's MUSTs), `design-brief.md` §2/§3/§5/§6. Baseline reviewed: current `ThreePlaces.astro` + `/tmp/.../baseline/places.png`.

## Accent decision (for the coherence audit)

**Aqua stays the one live/placed signal, used exactly as the design-brief intends it, nowhere else.** In this section aqua paints only: the `|-- 90 MIN --|` dimension annotation, the drawn hop-path lines (dim aqua-phosphor while traveling, full aqua at the moment of arrival), the rim flash on each landing, and the end-state instrument bracket + its mono label. The traveling task itself renders in its own curated hue — magenta, `var(--hue-magenta)` (`oklch(0.64 0.15 335)`), matching the current implementation — and is **never** aqua-tinted. This mirrors the app's own separation: `--chip-c` is user data (identity), aqua is system truth (now, focus, placed, proven). If another section makes the opposite call (e.g. lets its "traveler" or hero object itself be the aqua object), that's fine as long as _aqua's meaning_ — live/placed/proof, never decoration — holds; this doc is the record for reconciling that at the coherence pass. Active-panel "lift" (opacity + edge-brighten) is deliberately **not** aqua-tinted — it stays tonal/monochrome so the aqua devices (annotation, path, bracket) don't compete with a colored spotlight.

## Concept: "The Relay"

Three real panels sit dim and quiet. A single colored chip — the one you can already see sitting in all three, faintly — visibly hops list → board → week, each stop held long enough to read, each panel lighting up only when it's the one being visited. A thin drawn line traces every hop and burns away behind it. When the chip lands in its final home, a horizontal instrument bracket — built from the same tick-mark grammar as the `90 MIN` annotation, not a decorative curly brace — draws itself under all three panels at once and holds, with a mono label: **same object, same time**. That bracket is the permanent proof; nothing vanishes, the diagram just finishes.

Runner-up ("Triple Exposure + Signal Tether" — render all three instances at full brightness simultaneously from frame one, with a permanent thin tether connecting them and an occasional pulse traveling along it) lost because it trades away the thing the owner explicitly asked to keep: a traveler that visibly performs a journey and then gets bound. Tether-only is arguably _more_ instantly legible at a glance, but it reads as a comparison table, not a demonstrated fact — and the owner's brief frames this section around fixing a _sequence_ problem (unclear choreography, no ending), not a layout problem. A third direction (morph one card in place through list/card/chip shapes via FLIP, filmstrip-style, no side-by-side panels) was cut outright: it's the generic "one element re-skins itself" SaaS trope, it removes the "three real places at once" spatial read the section's own name promises, and Keys.astro already owns FLIP-morphing as its signature move — doubling it here would blur both sections' identities.

## Layout

Container: existing `.container` (max-width 1080px, `padding-inline: 24px`, box-sizing: border-box → 1032px content width at ≥1080 viewports).

**Stage grid, 1440px:** 3 columns, `gap: 32px` (up from 24px — richer content needs room), `align-items: start` (changed from `align-items: end` — panels are now height-matched, so top-aligning reads as three gauges mounted at the same rail, not a jagged skyline). Column width = (1032 − 64) / 3 ≈ **323px**.

Each panel = `.panel-label` (11px mono, unchanged, always full opacity — the label is the wayfinding layer, never dims) + a content surface (`.tp-surface`, new shared class) targeting **~208px** height across all three, so List/Board/Week read as matched instrument readouts:

| Panel | Structure                                                                                                                                                      | Target size (1440) |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| LIST  | `.tp-surface.obj-list-panel`: 3 rows — active row (44px) + 2 muted sibling rows (40px each) + 8px row gaps + 14px padding                                      | 323×208            |
| BOARD | `.tp-surface.obj-board-panel`: 2 column wells (TODO / DOING), gap 10px, each well ~150px tall; TODO holds the traveler's home card, DOING holds one muted card | 323×208            |
| WEEK  | `.tp-surface.obj-grid` (existing): header 32px + body bumped from 150px→176px for height parity                                                                | 323×208            |

Hop-path SVG overlay: one `<svg class="hop-paths">` absolutely positioned over the full `.stage` bounding box, `pointer-events: none`, z-index between the panels (z:1) and the traveler (z:5).

End-state bracket: full-width `<svg class="bind-bracket">` + `.bind-label`, positioned `top: calc(100% + 28px)` under the stage, height 40px, spanning the same 1032px (or 323×3+gaps) width as the stage.

**ASCII wireframe, 1440:**

```
+-------------------- container 1032px --------------------------+
| One task, three places.                                         |
| Schedule a task once. The list row, the board card, and the     |
| calendar chip stay one object: same color, same radius, same    |
| mono time.                                                       |
|                                                                   |
|  LIST                  BOARD                  WEEK               |
| +----------------+   +----------------+   +----------------------+
| |o Interview loop|   | TODO    DOING  |   |         THU          |
| |  THU 10:30·90MIN|  | +-----+ +----+ |   |-----------------------|
| |----------------|   | |Intv.| |Groc| |   | 10 AM                 |
| |o Design review |   | |loop | |ery |  |   | 11 AM  [10:30 Intv.] |
| |  9:00 AM       |   | +-----+ +----+ |   | 12 PM                 |
| |----------------|   |                |   |                       |
| |o Grocery run   |   |                |   |                       |
| |  2:00 PM       |   |                |   |                       |
| +----------------+   +----------------+   +----------------------+
|         |------------- SAME OBJECT — SAME TIME -------------|     |
+-------------------------------------------------------------------+
```

(bracket ticks sit under each panel's horizontal center; drawn only after the hop sequence completes — see Motion.)

**390px:** `.stage` stacks to 1 column (existing `max-width: 860px` breakpoint kept, tune to `1fr`, panel width = `min(380px, 100% )`, gap raised to **32px** vertical, from 24px — the hop arcs need vertical room between stacked panels). Board's 2 columns stay side-by-side inside the single-column panel (they don't stack — a 2-up board reads fine at 330px). Bracket rotates 90°: a **vertical** instrument line runs down one side (right edge, 20px inset) of the stacked stage with 3 horizontal ticks at each panel's vertical center + 2 end ticks; label sits centered below the whole stack.

```
+-- container 358px --+
| One task, three...   |
| Schedule a task...    |
|                        |
| LIST                    |
| +--------------------+ |
| |o Interview loop     | |
| |  THU 10:30 · 90 MIN | |
| |----------------------|
| |o Design review 9:00A| |
| |----------------------|
| |o Grocery run   2:00P| |
| +--------------------+ | |
|    ·  (vertical hop)  ||
| BOARD                  ||
| +--------------------+ ||
| |TODO       DOING     |·|
| |[Interview][Grocery] |·|
| +--------------------+ ||
|    ·  (vertical hop)  ||
| WEEK                   ||
| +--------------------+ ||
| |        THU          |·|
| |----------------------|
| | 10/11/12  [Interview]||
| +--------------------+·|
|      SAME OBJECT       |
|      SAME TIME         |
+------------------------+
```

## Visual spec

**Panel surface (`.tp-surface`, applied to `.obj-list-panel`, `.obj-board-panel`, `.obj-grid`):**

```css
.tp-surface {
  background: var(--surface-1);
  border-radius: 10px;
  box-shadow: var(--edge-machined);
  opacity: 0.6;
  transition:
    opacity 300ms var(--ease-out),
    box-shadow 300ms var(--ease-out);
}
.tp-surface.is-active {
  opacity: 1;
  box-shadow: var(--edge-machined-bright), var(--shadow-penumbra);
}
```

`--edge-machined-bright` (new, local to this component or promoted to global.css if other sections want it): `inset 0 0.5px 0 rgb(246 248 248 / 0.16), 0 0 0 0.5px rgb(0 0 0 / 0.5)` — doubles the inset highlight alpha of `--edge-machined` (0.08→0.16), the literal "edge brightens" the direction calls for. No color shift — chrome stays monochrome, aqua stays reserved for the devices above.

**List panel content** (padding 14px, flex column, gap 8px):

- Row 1 (active/home slot, 44px): unchanged from baseline — 16px ring `border: 1.5px solid var(--chip-c)` (magenta), title 13px/500 Inter, due chip `THU 10:30 · 90 MIN` (11px mono pill, chip-c film).
- Row 2/3 (muted siblings, 40px each): ring unfilled `border: 1.5px solid var(--hairline-strong)` (no chip-c — color is reserved for the one tracked object), title 13px/500 `var(--ink-2)`, plain mono time (no pill background, no film) 11px `var(--ink-muted)`, right-aligned. Copy: "Design review" · 9:00 AM, "Grocery run" · 2:00 PM.

**Board panel content:** two column wells `background: var(--surface-2); border-radius: 6px; padding: 8px; min-height: 150px`. Column header 11px/600 caps `var(--ink-muted)`: "TODO" / "DOING". TODO well holds the traveler's home card (`#tp-board`, unchanged anatomy: `--surface-1` + edge-machined + 3px left bar `var(--chip-c)`). DOING well holds one muted card: `border-left: 3px solid var(--hairline-strong)` (no chip-c), title `var(--ink-2)` "Grocery run", meta 11px mono `var(--ink-muted)` "2:00 PM" — same task reappearing here is intentional, it reads as one real, consistent task set across surfaces rather than disconnected demo props.

**Week panel:** unchanged structure per the MUST ("week fragment stays") — only the body height token moves 150px→176px for panel-height parity; hour labels, chip position (`top:25%; height:50%`), and content are verbatim baseline.

**Traveler** (`#tp-traveler`): kept as the current simple fixed-size pill — do **not** reshape/resize it between hops (see Risks — this was deliberately simplified down from an earlier FLIP-morph idea). Same DOM/content as baseline: mono time + title, `.chip.flashable` (6px radius, chip-c film + rim per §2.4 formula, this radius is the literal thing "same radius" in the body copy refers to — the traveler pill itself never changes shape, so the claim is trivially, visibly true). Position: `transform: translate(x,y)` computed each hop from `centerOn(anchorEl)`, unchanged math from baseline.

**Hop-path SVG** (`.hop-paths`, one shared `<svg>` per stage, `viewBox` matching stage pixel size, `preserveAspectRatio="none"`, `aria-hidden="true"`):

```html
<svg class="hop-paths">
  <path class="hop-path" id="hop-1" pathLength="1" d="" />
  <path class="hop-path" id="hop-2" pathLength="1" d="" />
</svg>
```

```css
.hop-path {
  fill: none;
  stroke: var(--line-dim); /* dim aqua-phosphor, direction §2.1 */
  stroke-width: 1.25px;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
```

`d` is set at runtime per hop: `M {x1} {y1} Q {(x1+x2)/2} {min(y1,y2) - 40} {x2} {y2}` — a quadratic arc bowing 40px above the straight line between anchor centers (both computed relative to the stage's bounding rect at the instant the hop starts). Using SVG's native `pathLength="1"` means `stroke-dashoffset` is always a clean 0–1 fraction regardless of actual arc length — no `getTotalLength()` math needed.

Draw: dashoffset `1 → 0`. Undraw (after the hop lands): dashoffset `0 → -1` (with `stroke-dasharray: 1`, a single dash spanning the whole path — negative offset uncovers the path from its **start**, i.e. the trailing end erases first while the leading end near the traveler stays visible longest, exactly the "draws ahead, undraws behind" grammar from §2.1).

The traveler moves in a **straight-line translate**, not literally along the arc (avoids `offset-path` as a hard requirement). Optional polish, not required: sync the traveler to the same bezier via `offset-path: path("M...")` / `offset-distance: 0%→100%` behind a `@supports (offset-path: path("M0 0"))` guard, falling back to the straight-line translate everywhere else.

**End-state bracket** (`.bind-bracket`, one `<svg>` below the stage):

```html
<svg class="bind-bracket" aria-hidden="true">
  <path class="bind-line" pathLength="1" d="M 0 8 H {stageWidth}" />
  <path class="bind-tick" pathLength="1" d="M 0 2 V 14" />
  <!-- left end -->
  <path class="bind-tick" pathLength="1" d="M {listCenterX} 2 V 14" />
  <path class="bind-tick" pathLength="1" d="M {boardCenterX} 2 V 14" />
  <path class="bind-tick" pathLength="1" d="M {weekCenterX} 2 V 14" />
  <path class="bind-tick" pathLength="1" d="M {stageWidth} 2 V 14" />
  <!-- right end -->
</svg>
<span class="bind-label mono">SAME OBJECT &mdash; SAME TIME</span>
```

Wait — per copy voice (no em dash), the label separator must be a spaced hyphen, not an em dash: **`SAME OBJECT - SAME TIME`**. Stroke/fill: solid `var(--aqua)` (not the dim phosphor — this is the final proof, matching the existing `.dim`/`.dim-line` mid-hop annotation's own full-strength aqua, so the two devices read as one instrument family), line + ticks 1px, ticks 6px tall (identical proportions to the existing `.dim-line::before` end-ticks — deliberately reused so the bracket reads as "the dimension annotation, now spanning everything" rather than a new decorative element). Label: 11px mono `var(--aqua)`, centered, 10px below the line.

This is the "beat" on the owner's curly-brace idea: same _intent_ (a drawn shape that visibly binds all three panels, held as an end state), executed in the schematic dimension-annotation vocabulary the section (and the brand) already owns, rather than a swooping cursive `{` — which would read as generic math-textbook clip art on a page that has spent its whole motion budget on drawn instrument lines.

## Motion timeline

All times in ms, relative to the sequence's IO-trigger reset (t=0). Curve names refer to `--ease-settle: cubic-bezier(0.16,1,0.3,1)` and `--ease-out: cubic-bezier(0.25,1,0.5,1)`.

| t         | Element                    | From → To                                                                                             | Duration   | Easing          | Trigger                                                    |
| --------- | -------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | --------------- | ---------------------------------------------------------- |
| 0         | reset (no transition)      | all panels opacity 1/bracket drawn → panels 0.6, traveler hidden, paths cleared, bracket dashoffset 1 | instant    | —               | IO enter (first time) or re-arm on re-entry                |
| 0         | traveler                   | opacity 0 → 1, parked at List anchor center                                                           | 200ms      | `--ease-out`    | sequence start                                             |
| 0         | LIST `.tp-surface`         | opacity 0.6 → 1, edge → bright                                                                        | 300ms      | `--ease-out`    | sequence start                                             |
| 0–700     | —                          | DWELL AT LIST                                                                                         | 700ms hold | —               | —                                                          |
| 700       | LIST `.tp-surface`         | opacity 1 → 0.6, edge → dim                                                                           | 300ms      | `--ease-out`    | hop 1 start                                                |
| 700       | BOARD `.tp-surface`        | opacity 0.6 → 1, edge → bright                                                                        | 300ms      | `--ease-out`    | hop 1 start (finishes 300ms before landing — anticipation) |
| 700       | `#hop-1` path              | dashoffset 1 → 0 (draw)                                                                               | 480ms      | `--ease-settle` | hop 1 start                                                |
| 700       | traveler                   | translate: List-center → Board-center                                                                 | 480ms      | `--ease-settle` | hop 1 start                                                |
| 780       | `.dim` (90 MIN annotation) | opacity 0 → 1                                                                                         | 160ms      | `--ease-out`    | 80ms into hop 1                                            |
| 1180      | traveler                   | rim flash opacity .5 → 0 (pseudo-element)                                                             | 240ms      | `--ease-out`    | hop 1 lands                                                |
| 1180      | `#hop-1` path              | dashoffset 0 → -1 (undraw)                                                                            | 240ms      | `--ease-out`    | hop 1 lands                                                |
| 1180–1880 | —                          | DWELL AT BOARD (`.dim` stays visible, static)                                                         | 700ms hold | —               | —                                                          |
| 1880      | BOARD `.tp-surface`        | opacity 1 → 0.6, edge → dim                                                                           | 300ms      | `--ease-out`    | hop 2 start                                                |
| 1880      | WEEK `.tp-surface`         | opacity 0.6 → 1, edge → bright                                                                        | 300ms      | `--ease-out`    | hop 2 start                                                |
| 1880      | `#hop-2` path              | dashoffset 1 → 0 (draw)                                                                               | 480ms      | `--ease-settle` | hop 2 start                                                |
| 1880      | traveler                   | translate: Board-center → Week-center                                                                 | 480ms      | `--ease-settle` | hop 2 start                                                |
| 2360      | traveler                   | rim flash opacity .5 → 0                                                                              | 240ms      | `--ease-out`    | hop 2 lands                                                |
| 2360      | `#hop-2` path              | dashoffset 0 → -1 (undraw)                                                                            | 240ms      | `--ease-out`    | hop 2 lands                                                |
| 2600      | `.dim` annotation          | opacity 1 → 0                                                                                         | 200ms      | `--ease-out`    | final land settled                                         |
| 2600      | traveler                   | opacity 1 → 0 (real `#tp-grid` chip takes over)                                                       | 200ms      | `--ease-out`    | final land settled                                         |
| 3000–3700 | `.bind-line`               | dashoffset 1 → 0                                                                                      | 700ms      | `--ease-settle` | 200ms settle-beat after handoff                            |
| ~3080     | tick (list)                | scale .5→1, opacity 0→1                                                                               | 120ms      | `--ease-out`    | draw crosses list-center x                                 |
| ~3350     | tick (board)               | scale .5→1, opacity 0→1                                                                               | 120ms      | `--ease-out`    | draw crosses board-center x                                |
| ~3620     | tick (week)                | scale .5→1, opacity 0→1                                                                               | 120ms      | `--ease-out`    | draw crosses week-center x                                 |
| 3620–3860 | `.bind-label`              | opacity 0→1, translateY 6px→0                                                                         | 240ms      | `--ease-out`    | overlaps tail of line draw                                 |
| 3860+     | —                          | HOLD (resting end state)                                                                              | indefinite | —               | until IO exit                                              |

**No ambient loop.** This is a one-shot performed sequence per viewport entry, matching the hero settle's precedent (§5's ambient inventory — idler chip 7s, now-line drift, ticker 45s — does not include this section, and it shouldn't: TypeIt/Keys/DayProgram already carry the page's continuous-loop budget).

**Replay policy — replay-on-reentry, not play-once, not auto-cycling.** Play-once was rejected: a visitor who scrolls past mid-sequence (or scrolls up to re-read the copy) would find a dead, already-resolved diagram on any later look — worse than never animating. Continuous auto-cycling (10s loop + progress rail, the Obsidian pattern) was rejected: the dwell beats (700ms × 2) plus reading the h2/body above already ask for several seconds of attention, and a 10s auto-restart while the section is still in view will very likely interrupt an attentive reader mid-thought — that fights the page's "happens once you arrive, then holds" rhythm (receipts marquee is the page's one true continuous ambient loop, and it's decorative texture, not a legibility device). Replay-on-reentry — a fresh IO "enter" event (crossing back above a ~20% visibility threshold after having been below it) resets instantly and replays the full sequence — gives repeatability without ever interrupting a stationary reader, and needs no progress rail: there is nothing "about to happen" while the visitor sits still, the bracket end-state **is** the stable resting frame.

**Off-screen:** IO "exit" (visibility drops below threshold) clears any pending `setTimeout`s and snaps (no transition) back to the t=0 reset state, so the next "enter" always starts clean regardless of where the sequence was interrupted.

**Reduced motion:** see Accessibility — static end state renders directly, no timeline runs at all.

## Interaction spec

No required interactivity — this is a proven/observed demonstration, not a manipulable one (Hero already owns the page's "touch things" budget via its draggable chips). No focusable elements live inside the stage.

Optional, recommended, cheap addition: `@media (hover: hover)` — hovering anywhere over `.stage` pauses the running sequence exactly where it is (clear the next scheduled `setTimeout`, record elapsed-in-current-leg), `mouseleave` resumes from that point (reschedule the remainder). Lets a curious visitor freeze on "board" and actually read the card. This must not restart the sequence from zero on resume — that would punish the exact curiosity it's rewarding.

Keyboard: none required (no focusable descendants; `role="img"` correctly removes the subtree from the a11y tree, see below).

Touch: no hover-pause on touch (no hover state exists); the sequence simply plays on scroll-into-view, same as desktop otherwise.

## DOM + implementation strategy

```
<section class="section" id="places">
  <div class="container">
    <div class="copy" data-reveal>            <!-- Astro-rendered, verbatim h2/body -->
      <h2 class="display-section">…</h2>
      <p class="body-copy">…</p>
    </div>
    <div class="stage" id="places-stage" role="img" aria-label="…" data-reveal>
      <svg class="hop-paths" aria-hidden="true">…</svg>          <!-- JS writes `d` + dashoffset -->
      <div class="panel">
        <span class="panel-label">LIST</span>
        <div class="tp-surface obj-list-panel" id="tp-list-panel">
          <div class="obj-list" id="tp-list">…</div>             <!-- traveler's home row -->
          <div class="obj-list-muted">…Design review…</div>
          <div class="obj-list-muted">…Grocery run…</div>
        </div>
      </div>
      <div class="panel">
        <span class="panel-label">BOARD</span>
        <div class="tp-surface obj-board-panel" id="tp-board-panel">
          <div class="board-col"><span class="col-label">TODO</span>
            <div class="obj-card" id="tp-board">…</div></div>
          <div class="board-col"><span class="col-label">DOING</span>
            <div class="obj-card-muted">…Grocery run…</div></div>
        </div>
      </div>
      <div class="panel">
        <span class="panel-label">WEEK</span>
        <div class="tp-surface obj-grid">…(baseline structure, taller body)…</div>
      </div>
      <div class="traveler chip flashable" id="tp-traveler" aria-hidden="true">…</div>
    </div>
    <svg class="bind-bracket" id="tp-bracket" aria-hidden="true">…</svg>
    <span class="bind-label mono" id="tp-bind-label">SAME OBJECT - SAME TIME</span>
  </div>
</section>
<script is:inline> … </script>
```

All panel content (rows, cards, labels, chip colors, real week fragment) is **Astro-rendered, static HTML** — present and readable with zero JS, matching the reduced-motion/no-JS resting state exactly (see below). Only these are JS-driven: the traveler's position/opacity/flash, the two hop-path `d`/dashoffset values, the `.tp-surface.is-active` class toggles, the `.dim` annotation visibility, and the bracket's draw/ticks/label.

Script stays `is:inline` per component convention, reads `window.TF` from the shared `motion.js`:

- `TF.drawPath(pathEl, opts)` — dashoffset choreography (draw + optional undraw phase). **Needs an undraw phase with its own delay/duration** on top of whatever the direction's foundation summary implies — flag this to whoever builds `motion.js` first.
- Reduced-motion guard — this component keeps the existing inline `matchMedia('(prefers-reduced-motion: reduce)')` check at top of its IIFE (matches baseline) rather than assuming a `TF.reducedMotion` flag exists; adopt the shared flag if/when motion.js ships one, it's a one-line swap.
- IO for enter/exit: the direction's `onVisible(el, cb, {once, threshold})` is described as once-oriented. This component needs **both** enter and exit signals (for replay-on-reentry + clean reset), so it should either get an extended `onVisible({once:false})` mode from motion.js, or — simpler, and what this spec assumes by default — run its own small local `IntersectionObserver` (≈10 lines, threshold 0.2, no shared dependency). Flagged as an open question for whoever owns motion.js's final shape.

No FLIP helper needed (deliberately — see Risks: the traveler does not resize/reshape between hops).

Estimated inline script size: **~3.5KB minified** (timeline sequencing via chained `setTimeout`s matching baseline's existing style, `centerOn()` rect math reused from baseline, hop-path `d` string construction, bracket tick-position calc, hover-pause bookkeeping, IO wiring, reduced-motion early-return).

## Accessibility + reduced motion

`role="img"` on `.stage` (unchanged pattern) removes its subtree from the accessibility tree; the composed `aria-label` carries the full picture for AT users:

> "The task Interview loop, Thursday 10:30, 90 minutes, shown three ways: as a list row alongside two other tasks, as a board card in a two-column board, and as a chip on the week grid. All three share the same magenta color, radius, and time. A drawn line traces the task hopping from list to board to week, then a measurement bracket beneath all three confirms it: same object, same time."

(old baseline label: "The task Interview loop, Thursday 10:30, 90 minutes, shown three ways: as a list row, as a board card, and as a chip on the week grid. All three share the same magenta color and the same time." — superseded by the above.)

**Static/no-JS/reduced-motion rendering is identical and is the CSS default**, not a special-cased override — following the same idiom as `html.js [data-reveal]` in global.css (content is complete without JS; JS only _arms_ a pre-animation state and animates back to the resting one). Concretely:

- `.tp-surface` defaults to `opacity: 1` with the bright edge (`--edge-machined-bright, --shadow-penumbra`) — the "dim to 0.6" state only exists as a class (`.tp-surface:not(.is-active)` under an `html.js.tp-armed` ancestor) that JS adds right before it starts the timeline, and only if motion is allowed.
- `.traveler` defaults to `display: none` — JS un-hides it only when it's about to animate.
- `.hop-path` defaults un-rendered (`d=""`, invisible) — JS draws only during an active run.
- `.dim` (annotation) is **visible by default**, statically parked under the WEEK chip (not animating) — a static fact worth keeping even for reduced-motion users.
- `.bind-line`/`.bind-tick` default to `stroke-dashoffset: 0` (fully drawn) and `.bind-label` defaults to `opacity: 1, transform: none` — the proof is present from first paint.

So `@media (prefers-reduced-motion: reduce)` needs almost no component-specific overrides beyond guaranteeing the JS never adds the `.tp-armed`/pre-animation classes in the first place (handled by the existing top-of-script `matchMedia` early return, which now simply means "never arm, never hide the traveler, never clear the bracket" — the default CSS already is the correct reduced-motion picture).

## Risks

1. **Generic curly-brace clip art.** A swoopy cursive `{` reads as a math-textbook decoration bolted onto an otherwise instrument-grade page. Guard: the bracket is built from the exact tick-and-hairline grammar of the existing `90 MIN` dimension annotation (same stroke weight, same 6px tick height, same mono label styling, same full-strength `--aqua`) — it must look like the same measuring instrument, zoomed out, not a new decorative shape.
2. **A resizing/reshaping traveler that looks jumpy or squishes text mid-flight.** An earlier version of this concept had the traveler FLIP-morph its width/height between a row shape, a card shape, and a chip shape. Cut deliberately: it's extra implementation risk (avoiding animated width/height means either an inverse-scale FLIP trick or a hidden mid-flight resize snap, both fiddly) for a benefit the color+radius+mono-time already deliver, and it duplicates Keys.astro's own FLIP-morph signature move. Guard: keep the traveler a fixed-size pill, translate-only.
3. **Sibling/context rows looking randomly styled ("placeholder gray").** Guard: exact neutral recipe specified above (unfilled `--hairline-strong` ring, `--ink-2` title, plain mono time with no pill/film) — no chip-c anywhere on non-traveling content, so color hierarchy reads as "this one is the tracked object" rather than looking unfinished.
4. **Panel spotlight timing drifting out of sync** (e.g. the destination panel finishing its brighten _after_ the traveler already lands, reading as a late, broken flicker instead of an anticipatory light-up). Guard: the timeline table above locks panel-brighten start = hop start, panel-brighten finish = 180ms _before_ landing, on both hops — implement from the table, not by feel.
5. **Hop-path geometry computed once and never revisited**, breaking under resize/orientation change or when the mobile single-column layout is active. Guard: anchor rects and the arc control point are recomputed fresh at the start of every leg (not cached across the whole run), exactly as the existing baseline's `centerOn()` already does — extend that pattern, don't replace it.
6. **Overlapping runs from IO threshold flicker** (rapid partial scroll near the boundary re-firing enter before a prior run finished). Guard: a simple `isPlaying` flag; an "enter" event while a run is active is a no-op, and "exit" always hard-clears all pending timeouts before any future "enter" can start a new run.
7. **Aqua leaking onto the chip's own identity color** (e.g. someone tints the traveler's rim or fill toward aqua "for emphasis"). Guard: explicit token audit — traveler background/rim/text always resolve through the `.chip` alpha-film formula off `--chip-c`; only the rim-flash pseudo-element, the dimension annotation, the hop-path stroke, and the end-state bracket are permitted to reference `--aqua`/`--line-dim`.
