# Spec: "Type it. It lands." (`TypeIt.astro`)

Governing docs: `redesign-v2-direction.md` §1, §2, §4.2, `design-brief.md` §2/§3/§5/§6/§7. Baseline reviewed:
current `TypeIt.astro` + `/tmp/.../baseline/type-it.png`. Parser truth grounded directly in
`src/components/smart-input/parsers/{SmartParser,ChronoDateParser,PriorityParser,CompromiseNLPParser}.ts` and
their `__tests__` (read in full before writing this spec). Copy: h2 and body below are KEPT VERBATIM per the
owner MUST; everything else in this document (persona sentences, offer strings, chip labels, sr-only line) is
NEW copy introduced by this spec and is flagged for approval like any other new prose.

## Accent decision (for the coherence audit)

**Aqua stays the one live/placed signal, full strength, never muted.** It appears in exactly four moments,
all meaning the same thing — "this is what gets placed" — and nowhere else:

1. the chrono date/time span highlighted in the typed sentence (and its matching summary chip),
2. the offer row's accent (background wash + the ⏎ key),
3. the connecting drawn-line from the ⏎ key to the mini-column slot, and the rim flash when the chip lands,
4. the mini-column chip itself (`--chip-c: var(--aqua)`, identical to the shipped baseline).

Every OTHER tag kind (priority, person, location, semantic label) renders in a curated-ladder hue, never
aqua, so a viewer can tell at a glance which chip is "the thing being scheduled" versus "context the parser
noticed." This is the same separation `threeplaces.md` states for its traveler chip (aqua = system truth,
curated hue = user/content data) and the same rule `keys.md` and `hero.md` hold aqua to. Kind → hue map
(all values from design-brief §2.4's curated table, computed once, reused verbatim):

| Tag kind (shipped)            | Curated hue | Token                                              | oklch                   |
| ----------------------------- | ----------- | -------------------------------------------------- | ----------------------- |
| date / time / range (chrono)  | —           | `var(--aqua)`                                      | `oklch(0.72 0.125 182)` |
| priority: high                | red         | `var(--hue-red)`                                   | `oklch(0.64 0.15 25)`   |
| priority: low                 | slate       | `var(--hue-slate)` **(new, see needs_foundation)** | `oklch(0.64 0.03 210)`  |
| person (NER)                  | violet      | `var(--hue-violet)`                                | `oklch(0.64 0.15 305)`  |
| location (NER + bare-keyword) | green       | `var(--hue-green)`                                 | `oklch(0.64 0.15 135)`  |
| semantic label: personal      | orange      | `var(--hue-orange)`                                | `oklch(0.64 0.15 55)`   |
| semantic label: work          | blue        | `var(--hue-blue)`                                  | `oklch(0.64 0.145 235)` |

`project` (organization NER) is deliberately unused in the six personas below — it needs a recognizable
company name to fire reliably and every persona here is a private-life or generic-workplace sentence, so
forcing one in would read as invented. Not showing it is not dishonest (the MUST is "only show what the
parser does," not "show everything it can do").

---

## Concept: "Six Lives"

One composer box runs a real type → parse → hold → untype loop through six persona sentences, in the owner's
required weight order (student, school kid, mother, father, tech professional, business person), forever
while the section is on screen. Every sentence is grounded, word for word, in what the shipped parser
actually tags — verified against the parser source, not paraphrased from the direction doc's own examples
(two of which, "standup" and "review," turned out not to be in the shipped work-category regex and are
deliberately NOT used here). The intricacy the owner asked for comes from doing the reveal in two visible
layers instead of one: the recognized substring lights up inside the sentence itself, and a beat later a
small labeled chip pops into a summary row underneath it, connected for one instant by a thin drawn line —
the same instrument-line grammar the hero uses for its falling chips. That same drawn-line device carries the
placed chip from the ⏎ key into the mini Friday-style column at the end of every cycle, so this section
literally speaks the page's one recurring visual sentence ("a line draws, something arrives, it rim-flashes")
in miniature, rather than inventing its own local motion vocabulary.

Two directions were developed to this depth. The runner-up, **"The Desk"** — replace the single mini column
with a full five-day mini week strip that accumulates a faint ghost chip per persona as the loop advances, so
by persona six the visitor has watched a whole week fill in — lost on three counts: it multiplies the
DOM/animation surface for a section that must loop forever and stay IO-gated cheap; it duplicates the job
`ThreePlaces.astro` already owns (showing one object settle across multiple simultaneous surfaces), diluting
both sections' identities; and the owner's own phrasing, "the mini column," is singular — inventing a
multi-day accumulator reads as scope creep on a section whose MUST is capture speed, not week-building. A
third direction, **"Parse Theater"** (skip typing entirely — text fades in fully formed as muted ghost copy,
then a scanning sweep ignites each tag as it passes, Dreamtype's word-crossfade technique run wholesale) was
considered and cut outright: the owner MUST is explicit — "type -> parse-reveal -> hold -> untype -> next
persona" — and a sweep-over-static-text loop has no typing and no untyping, directly contradicting the
required architecture rather than sharpening it.

**Signature moment:** a visitor watches a school kid's "no rush" and a business person's board meeting pass
through the exact same three-tag grammar — a date, and two of {priority, person, location, label} — proving
the parser is one general engine reading six very different lives, not six scripted tricks wearing a costume.

---

## Layout

Container: existing `.container` (max-width 1080px, `padding-inline: 24px`, → 1032px content width at
≥1080 viewports; 16px inline padding ≤640px). Section: existing `.section` vertical rhythm. Two-column grid,
copy left / demo right, matching the shipped baseline's structure but re-proportioned for longer sentences:

**1440px (viewport; container caps at 1080):**

- `grid-template-columns: 400px minmax(0,1fr); gap: 64px; align-items: center;` → copy column 400px, demo
  column 1032 − 400 − 64 = **568px**.
- `.copy`: h2 `.display-section` (unchanged), body `.body-copy` `max-width: 40ch` (down slightly from 44ch —
  the narrower 400px column already wraps it at a reasonable measure).
- `.demo` (the `<figure>`): `display:flex; gap:24px; align-items:center;` → composer flexes, mini-column
  fixed 192px. Composer width = 568 − 24 − 192 = **352px**.
- `.composer` stack, top to bottom: input-well → chip-row (12px gap) → offer row (10px gap).
- `.input-well`: `padding:14px 16px; border-radius:8px; background:var(--surface-2); border:1px solid
var(--hairline-strong);` **fixed `min-height: 84px`** (reserves exactly 2 lines of 15px/1.6 Inter + padding
  — no persona sentence may cause this box to grow or shrink; verify at build against the longest persona,
  67 characters, and shorten wording — flagged for approval — if it ever wraps to 3 lines at 352px).
- `.chip-row`: `display:flex; flex-wrap:wrap; gap:8px; min-height:26px;` — always exactly 3 chips, so no
  height jump between personas.
- `.offer`: unchanged shape from baseline (`padding:10px 14px; border-radius:8px; background:
var(--aqua-film-08); box-shadow: inset 0 0 0 1px var(--aqua-rim);`).
- `.mini-col`: fixed **192px** wide, unchanged internal proportions from baseline (`mini-body` height 190px).

**390px (mobile):**

- Grid collapses to 1 column. `.copy` full width, body `max-width: none`.
- `.demo` becomes `flex-direction:column; align-items:center; gap:20px;`.
- `.composer` full width (`max-width: 358px`), `.input-well` same 84px reserved min-height (font drops to
  14px so the same 2-line budget still holds at the narrower width — verify at build).
- `.mini-col` centered, unchanged 192px width (fits inside 358px with room either side).

### Wireframe, 1440px (mid-reveal, illustrative — tech professional persona)

```
+------------------------------------------------------------------------------+
| container (1080, centered, 24px gutter)                                      |
|                                                                                |
|  Type it. It lands.              +----------------------------+  +--------+ |
|  Dates hide in the words you     | Send sprint report to      |  |  FRI   | |
|  already use. Taskflow reads     | [Diego] before [friday 5pm]|  |--------| |
|  them as you type, offers the    |  |                          |  | 4 PM   | |
|  slot, and one Enter places      |[DIEGO] [WORK] [FRI 5:00 PM] |  |        | |
|  the task on your week.          |   ·        ·        \       |  |[17:00  | |
|                                   |   ·        ·         `···>  |  | Sprint | |
|                                   | Place on Friday, 5:00 PM ⏎ |  | report]| |
|                                   +----------------------------+  | 6 PM   | |
|                                                                    +--------+ |
+------------------------------------------------------------------------------+
   [word] = inline highlighted span   [LABEL] = summary chip   ` `···>` = drawn
   connecting line from the ⏎ key to the mini-column landing slot (dashoffset draw)
```

### Wireframe, 390px (stacked, mid-hold — mother persona)

```
+----------------------------------+
| container (16px gutter)          |
|                                   |
| Type it. It lands.               |
| Dates hide in the words you      |
| already use. Taskflow reads      |
| them as you type, offers the     |
| slot, and one Enter places the   |
| task on your week.               |
|                                   |
| +-------------------------------+|
| | Take [Emma] to the [dentist]  ||
| | next tuesday 3pm               ||
| | [EMMA] [PERSONAL] [TUE 3:00PM]||
| | Place on Tuesday, 3:00 PM  ⏎  ||
| +-------------------------------+|
|                                   |
|          +----------+             |
|          |   TUE    |             |
|          |----------|             |
|          |  2 PM    |             |
|          | [15:00   |             |
|          |  Dentist]|             |
|          |  4 PM    |             |
|          +----------+             |
+----------------------------------+
```

---

## Visual spec

**Type.** Input text: Inter 400, 15px/1.6 (14px/1.55 ≤640px), `color: var(--ink)`. Caret: 1.5px × 18px bar,
`background: var(--ink-2)` while typing (solid, no blink — reset by every keystroke, standard editor
behavior), hidden entirely during `reveal`/`landing`/`hold`, reappears solid at the first keystroke of
`untyping`. During any idle sub-beat where it IS shown without new characters landing (there are none in this
design — the caret is only ever visible while text is actively changing), it would use the brief's hard-step
blink (`opacity 1` 0–49%, `0` 50–99%, 1.25s) — stated for completeness, not exercised by this spec's phases.

**Inline parse-run highlight** (the substring lit inside the typed sentence). Motion-law compliant: opacity
only, two stacked layers, never a `background-color`/`box-shadow` transition:

```html
<span class="ti-run" style="--chip-c:var(--hue-violet)">
  <span class="ti-run__base">Diego</span>
  <span class="ti-run__lit" aria-hidden="true">Diego</span>
</span>
```

```css
.ti-run {
  position: relative;
  display: inline-block;
}
.ti-run__base {
  color: var(--ink);
}
.ti-run__lit {
  position: absolute;
  inset: -1px -2px;
  opacity: 0;
  border-radius: 4px;
  padding: 0 2px;
  background: color-mix(in oklab, var(--chip-c) 20%, transparent);
  box-shadow: inset 0 0 0 0.5px
    color-mix(in oklab, var(--chip-c) 55%, transparent);
  color: oklch(from var(--chip-c) 0.86 min(c, 0.08) h);
}
.ti-run.is-lit .ti-run__lit {
  opacity: 1;
  transition: opacity 110ms var(--ease-out);
}
```

For the multi-word chrono span ("friday 5pm", "next tuesday 3pm", "tomorrow 9-11am") each word gets its own
`.ti-run` sharing one `data-group` id; radius-merge so the run reads as one pill, not two touching ones (the
Linear `:has()` idiom, simplified here since group membership is static/known at author time — no `:has()`
needed):

```css
.ti-run[data-group]:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.ti-run[data-group]:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
```

(applies to the `.ti-run__lit` layer via the same selector chain, since radius is set there).

**Summary chip** (chip-row). Pill, height 26px, `padding:4px 10px; border-radius:6px;` (design-brief radius
scale for chips/pills), `display:inline-flex; align-items:center; gap:5px;`. Icon 12×12px inline SVG,
`stroke:currentColor; stroke-width:1.25; fill:none; stroke-linecap:round; stroke-linejoin:round;` (icon
glyphs below). Label: for the date/time chip, Spline Sans Mono 500 11px (contains digits → mono-numeral law);
every other kind, Inter 600 11px uppercase, `letter-spacing:0.04em` (micro-label role, design-brief §3).

Two-layer bright-flash-then-settle (again opacity-only, never animating background/shadow directly):

```html
<span class="ti-chip" style="--chip-c:var(--hue-blue)">
  <span class="ti-chip__base"
    ><svg class="ti-chip__icon">…</svg
    ><span class="ti-chip__label">WORK</span></span
  >
  <span class="ti-chip__flash" aria-hidden="true"></span>
</span>
```

```css
.ti-chip {
  position: relative;
  opacity: 0;
  transform: scale(0.94);
}
.ti-chip.is-in {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}
.ti-chip__base {
  /* resting alpha-film formula, design-brief §2.4, present from the start */
  background: color-mix(in oklab, var(--chip-c) 24%, transparent);
  box-shadow: inset 0 0 0 0.5px var(--chip-c);
  color: oklch(from var(--chip-c) 0.82 min(c, 0.1) h);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 4px 10px;
}
.ti-chip__flash {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  background: color-mix(in oklab, var(--chip-c) 85%, white 10%);
  opacity: 1;
}
.ti-chip.is-in .ti-chip__flash {
  opacity: 0;
  transition: opacity 280ms var(--ease-settle);
}
```

The chip's own entrance (opacity/scale, 140ms) and its flash fade (280ms, longer, still running as the chip
settles into place) fire on the SAME class toggle (`is-in`), giving the exact "pop in hot, cool to resting
tint" read the owner asked for, using only transform/opacity.

**Chip icon glyphs** (12×12 viewBox `0 0 12 12`, `stroke-width:1.25`, no fill, `stroke-linecap/linejoin:round`
— precise enough to draw as-is):

- **Clock** (date/time): `<circle cx="6" cy="6" r="5"/><path d="M6 6V3.2M6 6h2.2"/>`
- **Alert** (priority): `<path d="M6 2.2v4.6"/><circle cx="6" cy="9.3" r="0.75" fill="currentColor" stroke="none"/>`
- **Person**: `<circle cx="6" cy="4" r="2"/><path d="M2.4 10c0-2 1.6-3.6 3.6-3.6S9.6 8 9.6 10"/>`
- **Pin** (location): `<path d="M6 1c-2.2 0-4 1.7-4 4 0 3 4 6.5 4 6.5s4-3.5 4-6.5c0-2.3-1.8-4-4-4z"/><circle cx="6" cy="5" r="1.3"/>`
- **Briefcase** (label: work): `<rect x="2" y="4.5" width="8" height="5.5" rx="1"/><path d="M4.5 4.5v-1a1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5v1"/>`
- **House** (label: personal): `<path d="M2 6.5 6 2.5l4 4"/><path d="M3.5 5.5V10h5V5.5"/>`

**Offer row.** Unchanged shape from baseline (`.offer`): `background:var(--aqua-film-08); box-shadow:inset 0
0 0 1px var(--aqua-rim); border-radius:8px; padding:10px 14px;`. Text 13px/500 Inter `var(--ink)`, EXCEPT the
time portion of the offer string, which is Spline Sans Mono per the mono-numeral law (e.g. "Place on
Friday, **5:00 PM**" — bold-weight difference not implied, just: the digits/time run in `<span class="mono">`
same as elsewhere on the page). `<kbd class="key mono">⏎</kbd>` unchanged from baseline (22px, `var(--edge-machined)`).

**Connecting line** (offer → mini column, REQUIRED tier). One shared `<svg class="ti-link" aria-hidden="true"
focusable="false">` absolutely positioned over the whole `.demo` figure (`inset:0; pointer-events:none;
overflow:visible;`), one `<path fill="none" stroke-width="1" vector-effect="non-scaling-stroke"
stroke-linecap="round">`. Color: dim phosphor per direction §2.1, `color-mix(in oklab, oklch(0.80 0.09 190)
30%, transparent)`, EXCEPT for the final 30% of the path nearest the mini column, which is `var(--aqua-rim)`
— the line visibly "catches" the aqua meaning right before the chip lands, same visual logic as the hero's
live-chip path. `d` is computed at runtime each cycle via `getBoundingClientRect()` on the `⏎` kbd (start) and
the mini-chip's slot (end, known before it's visible since its `top`/`height` are set from persona data before
reveal) — a plain quadratic curve, control point offset 24px toward the mini column's left edge so the line
arcs rather than running straight through the mini-column's own hairline border.

**Mini column.** Unchanged baseline shell (`width:192px; background:var(--surface-1); border-radius:10px;
box-shadow:var(--edge-machined),var(--shadow-2);`), `mini-body` height 190px. Placed chip:
`--chip-c:var(--aqua)` (identical formula to baseline), `border-radius:6px`. Standard (non-range) personas:
4-hour visible window, chip occupies the middle 25% (1 hour), two hour labels at 25%/75% (window-start +1h /
+3h) — exact baseline geometry, reused. The one range persona (student) uses a dedicated full-bleed
treatment: no padding hours, the visible window IS the range itself, hour labels sit at `top:2%` (range
start) and `top:96%` (range end), chip fills `top:4%; height:92%` — visually distinct from the point-in-time
personas, which is honest: a 2-hour block SHOULD look different from a 1-hour one.

---

## The six personas (verbatim, in the owner's required weight order)

Each row: input sentence exactly as it will be typed · the exact substrings that light up, left to right ·
the chip-row (same order) · offer text · mini-column data. Verified against the parser source: chrono-node
via `ChronoDateParser` (dates/times/ranges, `forwardDate:true`), `PriorityParser`'s literal regex list,
`CompromiseNLPParser`'s people/places NER, bare-keyword location list (`downtown|uptown|mall|center|office|
store|restaurant|bank|hospital|school|gym|park`), and the eight `taskCategories` regexes (work/personal/
health/shopping/finance/social/travel/education). Each sentence is deliberately kept to 3 displayed tags for
rhythm; where the real parser would additionally emit a same-span-losing tag via SmartParser's conflict
resolution (documented inline below), that tag is correctly never shown — this is not an omission, it is
what the shipped engine actually outputs.

**1. Student** — `"Study group at the library tomorrow 9-11am, midterm is important"`

- Reveal order: **library** (location, green) → **tomorrow 9-11am** (chrono range, aqua) → **important**
  (priority high, red). Note: "library" also matches the `education` category regex alongside "study," but
  `CompromiseNLPParser`'s own location NER tag (confidence 0.8) beats the resulting label tag (confidence
  ~0.62) in `SmartParser`'s conflict resolution since both spans coincide — so only the location tag survives,
  exactly as shown.
- Chip row: `LIBRARY` (green) · `SAT 9:00-11:00 AM` (aqua, mono) · `HIGH PRIORITY` (red)
- Offer: `Place tomorrow, 9:00-11:00 AM ⏎`
- Mini column: header `SAT` _(illustrative — "tomorrow" is relative; this demo is static/authored, not a live
  chrono invocation, same honesty tier as the shipped baseline's hardcoded "friday 4pm" mock)_, range fill
  09:00–11:00, chip title "Study group".

**2. School kid** — `"Play date with Jordan wednesday at 4pm, mom says no rush"`

- Reveal order: **Jordan** (person, violet) → **wednesday at 4pm** (chrono time, aqua) → **no rush**
  (priority low, slate).
- Chip row: `JORDAN` (violet) · `WED 4:00 PM` (aqua, mono) · `LOW PRIORITY` (slate)
- Offer: `Place on Wednesday, 4:00 PM ⏎`
- Mini column: header `WED`, window 2–6 PM, chip 4–5 PM, title "Play date".

**3. Mother** — `"Take Emma to the dentist next tuesday 3pm"`

- Reveal order: **Emma** (person, violet) → **dentist** (semantic label → Personal, orange — the shipped
  category regex tests `personal` before `health` and both match "dentist" with an equal score of 1, so
  `personal` wins by insertion-order precedence; this exact precedence is asserted in
  `CompromiseNLPParser.test.ts`) → **next tuesday 3pm** (chrono time, aqua).
- Chip row: `EMMA` (violet) · `PERSONAL` (orange) · `TUE 3:00 PM` (aqua, mono)
- Offer: `Place on Tuesday, 3:00 PM ⏎`
- Mini column: header `TUE`, window 1–5 PM, chip 3–4 PM, title "Dentist".

**4. Father** — `"Pick up cleats from the store asap, practice saturday 9am"`

- Reveal order: **store** (location, bare-keyword, green — note the bare word only, "the" is never part of
  the tagged span) → **asap** (priority high, red) → **saturday 9am** (chrono time, aqua).
- Chip row: `STORE` (green) · `HIGH PRIORITY` (red) · `SAT 9:00 AM` (aqua, mono)
- Offer: `Place on Saturday, 9:00 AM ⏎`
- Mini column: header `SAT`, window 7–11 AM, chip 9–10 AM, title "Practice".

**5. Tech professional** — `"Send sprint report to Diego before friday 5pm"`

- Reveal order: **report** (semantic label → Work, blue) → **Diego** (person, violet) → **friday 5pm**
  (chrono time, aqua).
- Chip row: `DIEGO` (violet) · `WORK` (blue) · `FRI 5:00 PM` (aqua, mono) _(chip-row order follows the
  reveal-order rule of "left to right in the sentence" loosely regrouped so the aqua time chip always anchors
  the row's right edge, matching every other persona — a small deliberate consistency win over strict
  positional order)_
- Offer: `Place on Friday, 5:00 PM ⏎`
- Mini column: header `FRI`, window 3–7 PM, chip 5–6 PM, title "Sprint report".

**6. Business person** — `"Board meeting at the office moved to next monday 10am"`

- Reveal order: **meeting** (semantic label → Work, blue) → **office** (location, bare-keyword, green —
  distinct span from "meeting" even though both feed the same work-category score) → **next monday 10am**
  (chrono time, aqua).
- Chip row: `OFFICE` (green) · `WORK` (blue) · `MON 10:00 AM` (aqua, mono)
- Offer: `Place on Monday, 10:00 AM ⏎`
- Mini column: header `MON`, window 8 AM–12 PM, chip 10–11 AM, title "Board meeting".

**sr-only fallback line** (static, never changes, read once): _"Animated demo: as you type a task, Taskflow
highlights the date, priority, and any person or place it recognizes, then places the task on the week. The
demo cycles through example sentences automatically."_

---

## Motion timeline

Shared constants: `TYPE_MS=38` (±6ms jitter per char, cheap organic feel), `BACKSPACE_MS=15`,
`TAG_STAGGER=110ms`, `HOLD_MS=1700`, `INTER_PERSONA_GAP=260ms`. Phase union:
`'typing' | 'reveal' | 'landing' | 'hold' | 'untyping'`. `t=0` = first keystroke of the persona.

| t-offset               | Element                                    | From → to                                                                   | Duration                    | Easing          | Trigger                                                                                                            |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0 → N×38ms             | `.ti-run__base` chars                      | append one char                                                             | per-char, instant paint     | n/a             | `setInterval`, phase=`typing`                                                                                      |
| throughout typing      | `.ti-caret`                                | solid, position follows last char                                           | n/a (repaint only)          | n/a             | reset every keystroke                                                                                              |
| typing end +0          | phase → `reveal`                           | —                                                                           | —                           | —               | last char appended                                                                                                 |
| reveal +0              | 1st `.ti-run.is-lit`                       | opacity 0→1                                                                 | 110ms                       | `--ease-out`    | phase enter                                                                                                        |
| reveal +0              | 1st `.ti-chip.is-in` (entrance)            | opacity 0→1, scale .94→1                                                    | 140ms                       | `--ease-out`    | same tick as its run lighting                                                                                      |
| reveal +0              | 1st `.ti-chip__flash`                      | opacity 1→0                                                                 | 280ms                       | `--ease-settle` | same tick                                                                                                          |
| reveal +110            | 2nd run + chip (identical pair above)      | —                                                                           | 110/140/280ms               | same            | `TAG_STAGGER` offset                                                                                               |
| reveal +220            | 3rd run + chip (identical pair above)      | —                                                                           | 110/140/280ms               | same            | `TAG_STAGGER` offset                                                                                               |
| reveal +220+280 ≈ +500 | phase → `landing`                          | —                                                                           | —                           | —               | last chip's flash settle completes                                                                                 |
| landing +0             | `.ti-link path`                            | dashoffset: length→0 (draws)                                                | 280ms                       | linear          | phase enter                                                                                                        |
| landing +0             | `.offer`                                   | opacity 0→1, translateY 6px→0                                               | 240ms                       | `--ease-settle` | phase enter (concurrent with line draw)                                                                            |
| landing +160           | `.key` (⏎)                                 | scale 1→0.97→1                                                              | 100ms+100ms                 | `--ease-out`    | fixed delay after offer visible                                                                                    |
| landing +160           | `.mini-chip-placed`                        | travel + settle (opacity/scale from a pre-set off-slot start to final slot) | 320ms                       | `--ease-settle` | same tick as kbd press                                                                                             |
| landing +480           | `.mini-chip-placed::after` (rim flash)     | opacity .35→0                                                               | 240ms                       | `--ease-out`    | chip travel end                                                                                                    |
| landing +480           | `.ti-link path`                            | opacity 1→0 (undraw-by-fade, short remaining length)                        | 240ms                       | `--ease-out`    | chip travel end                                                                                                    |
| landing +720           | phase → `hold`                             | —                                                                           | —                           | —               | rim flash + undraw complete                                                                                        |
| hold +0 → +1700        | nothing animates                           | static, fully legible frame                                                 | 1700ms                      | n/a             | dwell                                                                                                              |
| hold end               | phase → `untyping`                         | —                                                                           | —                           | —               | timer                                                                                                              |
| untyping +0            | `.mini-chip-placed` + `.ti-link`           | settle-out: translateY 6px, scale .985, fade                                | 240ms                       | `--ease-settle` | phase enter (design-brief completion mirror)                                                                       |
| untyping +0            | `.offer`                                   | opacity 1→0                                                                 | 160ms                       | `--ease-out`    | phase enter                                                                                                        |
| untyping +0 → end      | `.ti-run__base` chars                      | remove one char                                                             | per-char, `BACKSPACE_MS=15` | n/a             | `setInterval`                                                                                                      |
| untyping, per-tag      | `.ti-chip.is-in` / `.ti-run.is-lit`        | reverse of entrance, 140ms/110ms                                            | 140/110ms                   | `--ease-out`    | fires the instant backspacing crosses that tag's start index, in REVERSE stagger order (rightmost tag peels first) |
| untyping end +0        | phase → `typing`, persona index +1 (mod 6) | —                                                                           | —                           | —               | text empty                                                                                                         |
| typing +0 (after gap)  | mini column header/hour labels             | cross-fade to next persona's values                                         | 200ms                       | `--ease-out`    | `INTER_PERSONA_GAP=260ms` after untyping completes, before next typing starts                                      |

**Loop and off-screen behavior.** One persona cycle runs ≈6.2–7.6s depending on sentence length (longest,
student, ≈7.6s including the wider range-chip landing; shortest, mother, ≈6.2s). Six personas run
back-to-back forever while the section intersects the viewport, ≈42–44s per full lap, gated by
`window.TF.onVisible(root, cb, {once:false, threshold:0.3})`: on exit, clear every pending timer immediately
and freeze the DOM as-is; on re-entry, do NOT attempt to resume mid-phase — restart the CURRENT persona index
from `typing` with an empty string (matches the automl-pattern research's explicit "simplest-robust" guidance
for restartable loops, `research/automl-pattern/notes.md` §4). This is the section's one ambient loop for its
viewport (design-brief §2.6, max one visible loop per viewport) — no separate decorative background animation
is added.

**Reduced motion.** No timers are ever scheduled. The component script checks
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` (or `window.TF.reducedMotion` if the
foundation exposes it) before doing anything, and if true, renders persona 1 (student) directly in its fully
`hold`-phase state: full sentence present, all three `.ti-run.is-lit` / `.ti-chip.is-in` classes already
applied (flash layers already at opacity 0, no flash ever visible), offer row visible, mini-column chip
already landed with no rim-flash animation, caret not rendered at all. This matches the owner's explicit MUST
("reduced motion renders persona 1 fully parsed, static") and the page-wide CSS `@media
(prefers-reduced-motion: reduce)` rule (global.css) as a second, independent guard.

---

## Interaction spec

- **Hover** (pointer devices only, `@media (hover:hover)`): hovering anywhere on `.demo` pauses the phase
  timer chain — no NEW phase transition is scheduled while hovered (in-flight CSS transitions still complete
  naturally, so nothing snaps). Un-pauses on `pointerleave`. This is a SHOULD, not a MUST: cut it first if
  the implementation is tight on time, it changes nothing about honesty or the required architecture.
- **Press / drag**: none. Nothing in this figure is a real control.
- **Keyboard / focus**: zero focusable elements inside the figure (no `tabindex`, no real `<input>`, no real
  `<button>` — every element is a `<span>`/`<div>`/`<svg>`). Tab order skips straight from the copy block to
  whatever follows the section. This is intentional: the composer is a demonstration, not a form, and giving
  it fake focusability would create a tab stop that does nothing, which is worse than no tab stop.
- **Touch**: fully passive, identical to desktop minus the hover-pause affordance (no `hover:hover` match on
  touch, so the loop simply never pauses from touch input — a light tap elsewhere on the page doesn't need to
  fight the demo for it).

---

## DOM + implementation strategy

### Element tree (Astro-rendered static markup for ALL six personas' possible chip/run text; JS only toggles classes and swaps which persona's block is visible)

```html
<section class="section" id="type-it">
  <div class="container ti-grid">
    <div class="copy" data-reveal>
      <h2 class="display-section">Type it. It lands.</h2>
      <p class="body-copy">
        Dates hide in the words you already use. Taskflow reads them as you
        type, offers the slot, and one Enter places the task on your week.
      </p>
    </div>
    <figure
      class="demo"
      role="img"
      aria-label="Animated demo: as you type a task, Taskflow highlights the
      date, priority, and any person or place it recognizes, then places the task on the week. The demo
      cycles through example sentences automatically."
      data-reveal
      data-ti-root
    >
      <div class="composer">
        <div class="input-well" data-ti-input>
          <span data-ti-text></span
          ><span class="ti-caret" data-ti-caret aria-hidden="true"></span>
        </div>
        <div class="chip-row" data-ti-chips aria-hidden="true"></div>
        <div class="offer" data-ti-offer aria-hidden="true">
          <span class="offer-text" data-ti-offer-text></span>
          <kbd class="key mono" data-ti-kbd>&#9166;</kbd>
        </div>
      </div>
      <svg class="ti-link" aria-hidden="true" focusable="false">
        <path data-ti-path />
      </svg>
      <div class="mini-col" data-ti-mini>
        <div class="mini-head">
          <span class="dow mono" data-ti-dow>SAT</span>
        </div>
        <div class="mini-body" data-ti-minibody>
          <span class="mini-hour mono" data-ti-hourA></span>
          <span class="mini-hour mono" data-ti-hourB></span>
          <div
            class="chip mini-chip-placed"
            data-ti-placedchip
            style="--chip-c:var(--aqua)"
          >
            <span class="c-t mono" data-ti-placedtime></span>
            <span class="c-ti" data-ti-placedtitle></span>
          </div>
        </div>
      </div>
    </figure>
  </div>
</section>
```

The 6 persona objects (text, tag spans + kinds + colors, chip labels, offer string, mini-column geometry) live
as a plain JS array in the `<script is:inline>` — NOT six separate pre-rendered DOM blocks. The script builds
`.ti-run`/`.ti-chip` nodes per persona at cycle-start from the array and replaces `[data-ti-text]`'s children,
rather than Astro pre-rendering six hidden variants and toggling visibility (cheaper DOM, and the text-node
character-by-character typing needs a live string buffer regardless).

### Astro vs JS split

- Astro-rendered, static, never touched by JS: the whole `.copy` block, the `<figure>` shell, the SVG's
  `<path>` element (empty `d` until first computed), the mini-column shell markup (labels/chip text nodes
  start empty, filled by JS on first run).
- JS-driven (`is:inline`, this component only): persona data array; phase state machine; typing/backspacing
  intervals; building/tearing-down `.ti-run`/`.ti-chip` nodes per reveal; `getBoundingClientRect` measurement
  - `d` attribute computation for `.ti-link path`; mini-column chip travel/settle/reset; reduced-motion
    short-circuit.

### Needs from shared foundation (`global.css` / `motion.js`)

- `--hue-slate: oklch(0.64 0.03 210);` — global.css currently defines 8 of the 10 design-brief §2.4 curated
  hues (`--hue-red` through `--hue-magenta`) but is missing `--hue-slate` and `--hue-brown`. This section
  needs `--hue-slate` for the priority-low chip. Add it to the same block in `global.css`.
- `window.TF.onVisible(el, cb, {once:false, threshold})` — the enter/exit-toggling (non-latching) variant,
  same requirement `keys.md` and `clock.md` both state for their own ambient loops. This section is a third
  consumer; land it once in `motion.js`, not per-component.
- `window.TF.reducedMotion` (boolean, or an equivalent already-resolved flag) — checked once before ever
  scheduling a timer.
- `window.TF.drawPath(pathEl, {delay, duration, undraw})` per direction §5 — used for `.ti-link path`'s
  draw-then-fade. If the shared helper only supports full dashoffset undraw (not the opacity-fade variant
  spec'd above for the short final segment), a local one-off `path.style.opacity` transition is an acceptable
  substitute — flagged as an implementation choice, not a blocker.
- Everything else already exists and is reused as-is: `.container`, `.section`, `.display-section`,
  `.body-copy`, `.mono`, `[data-reveal]`, `.chip`, `--ease-settle`, `--ease-out`, `--aqua`, `--aqua-film-08`,
  `--aqua-rim`, `--edge-machined`, `--shadow-2`, `--hue-red/orange/green/blue/violet`.

### JS size estimate

Persona data array ≈1.6KB minified (6 objects: text, 3 tag descriptors each with span/kind/color/chip-label,
offer string, mini-column geometry). Phase state machine + DOM build/teardown + measurement/path logic
≈2.8KB minified. Total **≈4.4KB minified (~1.8KB gzipped)**, before the optional hover-pause affordance
(+≈0.2KB). Well under any per-component JS budget concern.

---

## Accessibility + reduced motion

- **Roles/labels**: the entire `<figure>` is `role="img"` with a single static `aria-label` (given in full
  above) that describes the MECHANISM, not any one frame — it never changes as personas cycle. Per `role=img`
  semantics this flattens all descendant content for assistive tech, so the six cycling sentences are never
  individually announced (correctly — announcing a new sentence every ~7s forever would be a live-region
  anti-pattern, not an accessibility win). All interior elements carry `aria-hidden="true"` defensively
  (chip-row, offer, svg, mini-column) even though `role=img` already covers it.
- **Focus order**: no focusable elements inside the figure at all (see Interaction spec). Tab skips from the
  copy block straight past the section.
- **Reduced motion, exact static rendering**: persona 1 (student) rendered fully in its `hold`-phase end
  state — see Motion timeline's "Reduced motion" entry for the exact DOM/class state. No caret. No flash
  layers ever visible (they start and stay at their settled opacity). No connecting-line draw, no chip
  travel, no rim flash — the mini-column chip is simply present, already landed. This is a real static frame
  a sighted reduced-motion user can read calmly, not a frozen mid-animation frame.
- **Color-only information**: every tag kind pairs its curated hue with an icon glyph AND a text label
  (chip-row) or with the underlying real word already present in the sentence (inline highlight) — nothing is
  conveyed by color alone.

---

## Risks

- **Visual clutter from stacking too many simultaneous devices** (inline highlight + connecting thread +
  chip pop + chip-row reflow + mini-column travel + rim flash) is the single biggest way this section ends up
  looking cheap instead of intricate. Guard: strict `TAG_STAGGER=110ms` sequencing, one consistent flow
  direction (sentence → chip row → offer → mini column, never backwards), and the connecting-line-per-tag
  idea from early drafts was deliberately cut down to ONE required connecting line (offer → mini column) —
  do not add per-tag threads from each inline span to its chip; that was considered and explicitly dropped
  from this spec as one moving part too many.
- **Looks like a generic typewriter demo** if the bright-flash-then-settle chip color and the offer→mini
  drawn line are the first things cut under time pressure. Guard: if something must be cut, cut the hover
  pause affordance and the icon glyphs before touching either of those two — they are what makes this section
  read as "the same instrument as the hero," not a stock component.
- **Parser assumptions not re-verified against a live build.** This spec's tag predictions (which chip wins
  each conflict, whether "library" fires as a location at all) are traced by hand against the current parser
  source, not executed. Before wiring, run all six sentences through `SmartParser.testParse()` in a throwaway
  script and confirm; if any sentence's real output differs from this spec, adjust wording minimally (flagged
  for copy approval per project convention) rather than inventing a tag kind to match the spec.
- **Input-well line-wrap jump.** The fixed 84px reserved height assumes every persona wraps to exactly 2
  lines at 352px (1440) / ~326px (390). Verify against actual rendered font metrics at build; if the longest
  sentence (student, 67 chars) wraps to 3 lines, shorten that persona's wording rather than growing the box
  (a growing box mid-cycle would violate the "no layout shift during typing" intent everywhere else on this
  page).
- **Mono-numeral law slip.** Every numeral in this section (chip times, offer times, mini-column hour labels
  and placed-chip time) must render in Spline Sans Mono; only the priority/person/location/label chip TEXT
  labels (no digits) may use Inter. Easy to slip on the offer-row string since it's one text node in the
  baseline markup — implementer must wrap the time portion in `<span class="mono">` explicitly.
