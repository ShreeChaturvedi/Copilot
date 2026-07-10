# Nav + logo spec — `Nav.astro` (v2)

Governs: `landing/src/components/Nav.astro`. Reads design-brief §2/§3/§5/§6 tokens and redesign-v2-direction
§1, §2, §4.0. This file is the single source of truth for the nav; the implementation agent builds exactly
what is written here.

**Accent decision (binding for cross-section coherence):** aqua is KEPT, not muted to graphite, but it is
severely rationed. In the entire nav there are exactly two aqua surfaces: (1) the logo's one filled chip —
"the settled chip" — inside an otherwise monochrome grid mark, and (2) the `Start free` CTA fill. Every other
surface (links, wordmark, clock digits, dividers, hover states, borders) is pure ink/graphite. This mirrors
the design-brief law verbatim ("aqua means live and placed, nothing else") rather than relaxing it: the nav's
one moment of color is not decoration, it is the brand thesis drawn in miniature. Other section agents:
match this — aqua = the one live/placed signal, full "off-white monochrome CTA" register is NOT what nav
does, keep aqua as the CTA fill everywhere on the page, just de-glowed (§2.7).

---

## Concept

**Name: The Instrument Capsule.**

The nav is one machined object floating in the void above the page, not a bar painted across it: a glass
capsule with a hairline edge and a single inset top-highlight that casts no shadow until content actually
scrolls beneath it, at which point it visibly lifts off the page like a lit panel over a lit room. Its logo
is one vector lockup, drawn from the product's own week-grid geometry — a header rule, one column divider,
and a single aqua-filled cell — so the mark's only color is literally "a cell with a task placed in it," the
same idea the whole product sells. Every other surface in the rail reads as engraved chrome (hover = a soft
pill of ink, never an underline); the CTA is the only other lit surface, a machined key you press, not a
sign that glows.

**Why the runner-up (full-width Linear-style transparent bar) lost:** it is the exact pattern already
running on Linear, Vercel, Stripe, and Factory.ai in this same research set (§ Motion/Nav teardown notes),
so shipping it here reads as the generic dark-SaaS default the redesign brief explicitly tells agents to
replace. A full-bleed bar also has no edge for the page's own machined/penumbra material system (§2.2, §2.7)
to land on — there is nothing to cast a shadow, nothing to bevel. The capsule gives the nav actual
object-hood: before a visitor reads a word, they see something built, not a CSS bar.

**Signature moment:** the logo. One SVG, one filled aqua cell inside a two-line grid glyph, fused edge to
edge with a real vectorized "Taskflow" wordmark set in the product's own Sentient 400 — not an icon next to
text, one drawn unit, and the only splash of color in the whole rail says exactly what the product does.

---

## Layout

### Geometry table

| Property                                | 1440 (desktop, >=721px)                                   | 390 (mobile, <=720px)                                                     |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Capsule position                        | `fixed`, `top: calc(16px + env(safe-area-inset-top,0px))` | same                                                                      |
| Capsule side inset                      | `left/right: calc(20px + env(safe-area-inset-*,0px))`     | same, but inner padding tightens (below)                                  |
| Capsule max-width                       | 1220px, `margin-inline:auto`                              | n/a (fluid to viewport - insets)                                          |
| Capsule height                          | 60px                                                      | 60px                                                                      |
| Capsule radius                          | 12px (matches dialog/Cmd+K radius scale, brief §2.6)      | 12px                                                                      |
| Capsule inline padding                  | 20px                                                      | 16px                                                                      |
| z-index                                 | 100                                                       | 100                                                                       |
| Logo SVG render size                    | width 122 height 20                                       | same (no shrink)                                                          |
| Nav links (`How it works`,`Shortcuts`)  | visible, 13px, gap 4px (padding-driven)                   | `display:none`                                                            |
| Cluster gap (clock/divider/sign-in/CTA) | 14px                                                      | n/a — clock, divider, sign-in hidden                                      |
| Hamburger                               | `display:none`                                            | `display:flex`, 44x44 hit box                                             |
| CTA padding                             | 9px 16px                                                  | 9px 14px                                                                  |
| Mobile menu panel                       | n/a                                                       | fixed, same L/R insets as capsule, top `calc(16px+60px+8px)`, radius 12px |

At 1440 the capsule is 1220px wide (viewport 1440 minus 2×20px inset would be 1400, but the 1220 cap wins,
leaving 110px of void on each side — deliberate: this is a "lit object in a quiet room," not a bar that
fights the viewport edge). At 390 the capsule is `390 - 40 = 350px` wide (inset always wins under 1260px
viewport).

### ASCII wireframe, 1440

```
void ── 16px ──────────────────────────────────────────────────────────────
      20px  ┌──────────────── capsule, 1220px max, 60px tall, r12 ──────────┐  20px
            │ [grid-mark]Taskflow   How it works  Shortcuts        ● THU 17:42 │ Sign in [Start free] │
            └───────────────────────────────────────────────────────────────┘
void ── content starts >=96px below capsule top (scroll-margin, see Risks) ─
```

### ASCII wireframe, 390

```
void ─ 16px ────────────────────────────────
   20px ┌── capsule, 350px, 60px, r12 ──┐ 20px
        │ [grid-mark]Taskflow   [≡][Start free] │
        └───────────────────────────────┘
                     │ tap ≡
                     ▼
        ┌───────────────────────────────┐
        │ How it works              44px│
        │ Shortcuts                 44px│
        │ ─────────────────────────────  │
        │ Sign in                   44px│
        └───────────────────────────────┘
```

---

## Visual spec

### Logo — the single SVG lockup

One `<svg>` contains BOTH the mark and the wordmark as one drawn artifact — not an icon node next to a text
node. This is the literal "single-SVG lockup" recipe from Linear/Resend, built the same way: real vector
letterform outlines, not a system font rendered live.

**Wordmark generation (already done — use this path verbatim).** Source: Fontshare Sentient, static
instance `Sentient-Regular.ttf` (=weight 400, the "in-app voice" / "section display" face per brief §3).
Text `"Taskflow"`, design size 24px em, tracking **-0.01em**, extracted with `opentype.js@1.3.4`
(`font.charToGlyph(ch).getPath(x,0,24)` per glyph, x advanced by `advanceWidth*(24/unitsPerEm) + trackingPx`
per char, `path.toPathData(2)`). Computed metrics at this size: cap-height (from `T`) = 16.44, full ink
bbox y: -18 (ascenders of k/l/f) to 0.24 (descender overshoot), ink bbox x: 0.53 to 102.67, tracked total
width 102.58. Regeneration script (only needed if the text, weight, or tracking ever changes):

```js
// node, opentype.js@1.3.4, Sentient-Regular.ttf from the Fontshare "Sentient" family zip
const opentype = require('opentype.js');
const font = opentype.loadSync('./Sentient-Regular.ttf');
function buildTrackedPath(str, size, trackingEm) {
  let x = 0;
  const trackingPx = trackingEm * size;
  const full = new opentype.Path();
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    full.commands.push(...g.getPath(x, 0, size).commands);
    x += g.advanceWidth * (size / font.unitsPerEm) + trackingPx;
  }
  return full;
}
buildTrackedPath('Taskflow', 24, -0.01).toPathData(2); // -> the `d` string below
```

**The literal `d` attribute (paste verbatim, do not reflow/reformat the string):**

```
M11.09-0.65L11.09 0L4.27 0L4.27-0.65L5.35-1.08Q5.98-1.34 6.20-1.61Q6.43-1.87 6.43-2.35L6.43-2.35L6.43-15.22L4.30-15.22Q3.46-15.22 3.01-14.87Q2.57-14.52 1.94-13.42L1.94-13.42L1.18-12.02L0.53-12.02L0.86-16.44L14.50-16.44L14.83-12.02L14.18-12.02L13.42-13.42Q12.79-14.52 12.35-14.87Q11.90-15.22 11.06-15.22L11.06-15.22L8.95-15.22L8.95-2.35Q8.95-1.85 9.16-1.60Q9.36-1.34 10.01-1.08L10.01-1.08L11.09-0.65ZM19.92 0.24L19.92 0.24Q18.24 0.24 17.22-0.67Q16.20-1.58 16.20-3.10L16.20-3.10Q16.20-5.54 19.18-6.55L19.18-6.55Q20.81-7.10 23.30-7.22L23.30-7.22L23.30-7.92Q23.30-11.11 21.05-11.11L21.05-11.11Q20.02-11.11 19.34-10.68L19.34-10.68Q18.77-10.30 18.17-8.57L18.17-8.57L17.30-8.57L16.58-10.70Q18.94-12.29 21.34-12.29L21.34-12.29Q23.59-12.29 24.62-11.26Q25.66-10.22 25.66-7.87L25.66-7.87L25.66-2.93Q25.66-2.30 25.86-2.04Q26.06-1.78 26.66-1.70L26.66-1.70L27.53-1.61L27.65-0.98L24.53 0.24L24 0.24L23.40-1.54Q22.78-0.72 21.83-0.24Q20.88 0.24 19.92 0.24ZM20.83-1.44L20.83-1.44Q22.22-1.44 23.30-2.64L23.30-2.64L23.30-6.24Q21.74-6.17 20.74-5.88L20.74-5.88Q18.65-5.30 18.65-3.48L18.65-3.48Q18.65-2.54 19.25-1.99Q19.85-1.44 20.83-1.44ZM33.29 0.24L33.29 0.24Q30.72 0.24 28.97-1.03L28.97-1.03L29.26-3.82L29.90-3.82L30.46-2.69Q31.44-0.89 33.41-0.89L33.41-0.89Q34.49-0.89 35.14-1.40Q35.78-1.92 35.78-2.78L35.78-2.78Q35.78-3.55 35.14-4.14Q34.49-4.73 32.71-5.42L32.71-5.42Q29.21-6.79 29.21-9.05L29.21-9.05Q29.21-10.51 30.38-11.40Q31.56-12.29 33.48-12.29L33.48-12.29Q35.59-12.29 37.44-11.45L37.44-11.45L37.18-8.86L36.53-8.86Q36.07-9.70 35.59-10.25L35.59-10.25Q34.80-11.16 33.50-11.16L33.50-11.16Q32.52-11.16 31.93-10.74Q31.34-10.32 31.34-9.65Q31.34-8.98 31.98-8.45Q32.62-7.92 34.42-7.15L34.42-7.15Q36.31-6.34 37.14-5.45Q37.97-4.56 37.97-3.41L37.97-3.41Q37.97-1.78 36.67-0.77Q35.38 0.24 33.29 0.24ZM45.67-0.62L45.67 0L39.60 0L39.60-0.62L40.56-0.98Q41.09-1.20 41.28-1.48Q41.47-1.75 41.47-2.33L41.47-2.33L41.47-14.33Q41.47-15.05 41.26-15.36Q41.04-15.67 40.54-15.79L40.54-15.79L39.65-15.98L39.65-16.61L43.25-18L43.82-17.66L43.82-7.34L44.98-7.34Q45.89-7.34 46.61-8.21L46.61-8.21L48.07-9.94Q48.55-10.49 48.55-10.75L48.55-10.75Q48.55-10.99 48-11.18L48-11.18L47.18-11.42L47.18-12.05L52.39-12.05L52.39-11.42L51.34-11.09Q50.69-10.87 50.38-10.63Q50.06-10.39 49.42-9.67L49.42-9.67L47.35-7.32L50.69-2.11Q51.26-1.22 51.91-1.01L51.91-1.01L53.04-0.62L53.04 0L49.27 0L45.38-6.22L43.82-6.22L43.82-2.33Q43.82-1.73 44.00-1.46Q44.18-1.20 44.71-0.98L44.71-0.98L45.67-0.62ZM60.26-0.62L60.26 0L53.71 0L53.71-0.62L54.67-0.98Q55.20-1.20 55.39-1.48Q55.58-1.75 55.58-2.33L55.58-2.33L55.58-10.75L53.52-10.75L53.52-11.76L55.51-12.10Q55.37-13.49 55.37-13.94L55.37-13.94Q55.37-15.86 56.45-16.93Q57.53-18 59.50-18L59.50-18Q61.10-18 62.71-17.33L62.71-17.33L62.47-14.95L61.87-14.95Q60.70-16.87 59.52-16.87L59.52-16.87Q57.84-16.87 57.84-14.40L57.84-14.40Q57.84-13.01 57.91-12.05L57.91-12.05L61.10-12.05L61.10-10.75L57.94-10.75L57.94-2.33Q57.94-1.78 58.18-1.52Q58.42-1.27 59.23-0.98L59.23-0.98L60.26-0.62ZM68.21-0.62L68.21 0L62.14 0L62.14-0.62L63.10-0.98Q63.62-1.20 63.82-1.48Q64.01-1.75 64.01-2.33L64.01-2.33L64.01-14.33Q64.01-15.05 63.79-15.36Q63.58-15.67 63.07-15.79L63.07-15.79L62.18-15.98L62.18-16.61L65.78-18L66.36-17.66L66.36-2.33Q66.36-1.73 66.54-1.46Q66.72-1.20 67.25-0.98L67.25-0.98L68.21-0.62ZM75.84 0.24L75.84 0.24Q73.15 0.24 71.51-1.48Q69.86-3.19 69.86-6.02L69.86-6.02Q69.86-8.76 71.56-10.52Q73.25-12.29 75.84-12.29L75.84-12.29Q78.53-12.29 80.16-10.56Q81.79-8.83 81.79-6L81.79-6Q81.79-3.26 80.11-1.51Q78.43 0.24 75.84 0.24ZM73.36-2.27Q74.28-0.89 75.84-0.89Q77.40-0.89 78.31-2.26Q79.22-3.62 79.22-6L79.22-6Q79.22-8.40 78.31-9.78Q77.40-11.16 75.84-11.16Q74.28-11.16 73.36-9.78Q72.43-8.40 72.43-6.02Q72.43-3.65 73.36-2.27ZM92.64-8.64L89.47-0.36L88.15 0.24L84.46-9.77Q84.24-10.34 84.02-10.60Q83.81-10.85 83.33-11.09L83.33-11.09L82.66-11.42L82.66-12.05L88.54-12.05L88.54-11.42L87.84-11.21Q86.93-10.94 86.93-10.42L86.93-10.42Q86.93-10.13 87.05-9.79L87.05-9.79L89.33-3.24L92.45-11.59L93.79-12.05L97.18-3.34L99.48-9.79Q99.62-10.18 99.62-10.42L99.62-10.42Q99.62-10.94 98.71-11.21L98.71-11.21L98.02-11.42L98.02-12.05L102.67-12.05L102.67-11.42L101.90-11.04Q101.45-10.82 101.23-10.57Q101.02-10.32 100.82-9.79L100.82-9.79L97.39-0.36L96.14 0.24L92.64-8.64Z
```

Fill: `var(--ink)`. No hover recolor (the mark is a static identity, not an interactive link target for hover
feedback beyond the standard `:active{opacity:.8}` tap dip).

**The mark (icon), same coordinate space as the wordmark path above, drawn to its left:**

- Bounding box: x `[-19, -5]` (width 14), y `[-16.44, 0]` (height 16.44 — exactly the wordmark's own
  cap-height, sharing the exact same baseline y=0. This is the literal "mark aligned to cap-height, shared
  baseline" the direction doc asks for, not an approximation).
- Gap between icon's right edge (x=-5) and the wordmark's first ink (x=0.53): 5.53 units — tight, less than
  one letter-stem width, reads as one lockup.
- Element A, top rule: `<line x1="-19" y1="-16.44" x2="-5" y2="-16.44">` — the header-row edge of a week
  grid, sitting exactly on the cap-height line (so it optically continues the top of the wordmark's "T").
- Element B, column divider: `<line x1="-12" y1="-16.44" x2="-12" y2="0">` — one day-column boundary,
  splitting the icon into two 7-unit-wide cells.
- Both A and B: `stroke: var(--line-dim, color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent))`
  (phosphor-dim, the same tone the rest of the page's drawn instrument lines use — §2.1), `stroke-width:
1.2`, `fill: none`, `stroke-linecap: butt`.
- Element C, the settled chip: `<rect x="-11.2" y="-10.2" width="5.6" height="4" rx="1.3" fill="var(--aqua)">`
  — sits inside the right-hand cell, centered on the icon's vertical middle. This is the ONLY aqua pixel in
  the whole logo: the mark's literal illustration of the brand thesis ("chaos becomes a week" — one cell,
  out of an otherwise empty grid, has something placed in it).

**Combined SVG:**

```html
<svg
  viewBox="-20 -19 123.67 20.24"
  width="122"
  height="20"
  role="img"
  aria-hidden="true"
>
  <line x1="-19" y1="-16.44" x2="-5" y2="-16.44" class="nav-logo__rule" />
  <line x1="-12" y1="-16.44" x2="-12" y2="0" class="nav-logo__rule" />
  <rect
    x="-11.2"
    y="-10.2"
    width="5.6"
    height="4"
    rx="1.3"
    class="nav-logo__chip"
  />
  <path d="[the d string above]" class="nav-logo__word" />
</svg>
```

```css
.nav-logo__rule {
  stroke: var(
    --line-dim,
    color-mix(in oklab, oklch(0.8 0.09 190) 30%, transparent)
  );
  stroke-width: 1.2;
  fill: none;
}
.nav-logo__chip {
  fill: var(--aqua);
}
.nav-logo__word {
  fill: var(--ink);
}
```

No container plate. No background rect. No border/stroke around the whole mark. This is the fix for the
"reads as a button" defect in the current implementation (`rect x=0.5 y=0.5 w=15 h=15 rx=4 fill=surface-2
stroke=hairline-strong` — a rounded-square icon tile sitting next to plain text is exactly what makes it
read as a UI button). Removing the plate and fusing icon-linework directly with the vector wordmark in one
`<svg>` is the whole fix.

### Capsule material (glass + machined edge, §2.7)

```css
.nav-capsule {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: calc(20px + env(safe-area-inset-left, 0px));
  right: calc(20px + env(safe-area-inset-right, 0px));
  max-width: 1220px;
  margin-inline: auto;
  height: 60px;
  border-radius: 12px;
  padding-inline: 20px;
  z-index: 100;
  overflow: visible; /* never :hidden — see Risks, focus-ring clipping */
  background: color-mix(in oklab, var(--void) 55%, transparent);
  backdrop-filter: blur(10px) saturate(1.1);
  -webkit-backdrop-filter: blur(10px) saturate(1.1);
  border: 1px solid color-mix(in oklab, var(--ink) 8%, transparent);
  box-shadow: inset 0 1px 0 rgb(246 248 248 / 0.1); /* resting: top highlight only, no cast shadow */
  transition:
    border-color 200ms var(--ease-out),
    box-shadow 200ms var(--ease-out);
}
.nav-capsule.is-scrolled {
  border-color: color-mix(in oklab, var(--ink) 14%, transparent);
  box-shadow:
    inset 0 1px 0 rgb(246 248 248 / 0.1),
    var(
      --shadow-penumbra,
      0 0.6px 1.6px -1.5px rgb(0 0 0/0.5),
      0 2.3px 6px -3px rgb(0 0 0/0.4),
      0 10px 26px -4.5px rgb(0 0 0/0.28)
    );
}
@media (max-width: 720px) {
  .nav-capsule {
    padding-inline: 16px;
  }
}
```

Reasoning for the scroll state: at rest there is nothing "under" the capsule yet (it floats over the empty
top of the void), so it casts no shadow — only the resting glass reads. Once the page scrolls beneath it
(threshold 8px), the penumbra shadow fades in, because now there is something to cast a shadow onto. This is
physically motivated, not decorative — it is the same "light is the material" logic the page's other
surfaces use (penumbra shadows, machined edges).

The progressive blur ladder in the CURRENT `Nav.astro` (three stacked masked spans melting content under a
hard bar edge) is RETIRED for this component, on purpose: a capsule has no long straight edge to melt
content into (there is void on all four sides), so the ladder has no surface to attach to. Its job is done
instead by the capsule's own `backdrop-filter: blur(10px)` — content passing behind the glass is already
softened, not hidden. If hero content (a flying chip, a drawn fall-path) ever crosses under the capsule's
screen rect on a short viewport, it stays visible-through, dimmed by the blur — the nav never gets an opaque
fallback background. This is deliberate: "never fill the bar solid" (navbars synthesis, point 1).

### Nav links (`How it works`, `Shortcuts`)

```css
.nav-links {
  display: flex;
  gap: 4px;
}
.nav-links a {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  font: 400 13px/1 var(--font-sans);
  color: var(--ink-muted);
  text-decoration: none;
  background: transparent;
  transition:
    background-color 150ms var(--ease-out),
    color 150ms var(--ease-out);
}
@media (hover: hover) {
  .nav-links a:hover {
    color: var(--ink);
    background: color-mix(in oklab, var(--ink) 7%, transparent);
  }
}
```

Pill-highlight hover, not underline, per the owner MUST. Instant on / 150ms off (brief §5 hover rule) —
achieved by leaving `transition` symmetric at 150ms (the "instant on" is a perceptual convention many teams
skip in practice with a single symmetric transition; if strict instant-on is wanted, split into
`transition-property: background-color; transition-duration: 0ms` on `:hover` and `150ms` on the base rule).

### Right cluster: clock, divider, sign-in, CTA

```css
.nav-cluster {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: 32px;
}
.nav-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--ink-muted);
}
.nav-clock__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--aqua);
  flex: none;
}
.nav-divider {
  width: 1px;
  height: 16px;
  background: var(--hairline-strong);
}
.nav-signin {
  padding: 8px 12px;
  border-radius: 8px;
  font: 500 13px/1 var(--font-sans);
  color: var(--ink-2);
  text-decoration: none;
  transition:
    background-color 150ms var(--ease-out),
    color 150ms var(--ease-out);
}
@media (hover: hover) {
  .nav-signin:hover {
    color: var(--ink);
    background: color-mix(in oklab, var(--ink) 7%, transparent);
  }
}
@media (max-width: 720px) {
  .nav-clock,
  .nav-divider,
  .nav-signin {
    display: none;
  }
}
```

Clock dot: static, NOT pulsing. See Motion timeline for why (ambient-loop budget already spent by the
hero's idler/now-line in the same fold).

### CTA — `Start free`

De-glowed per direction §2.7. Overridden LOCALLY in Nav's own `<style>` regardless of what `global.css`'s
shared `.btn-primary` currently does, so this component is correct even if the foundation pass hasn't landed
the de-glow yet:

```css
.nav-cta {
  padding: 9px 16px;
  border-radius: 8px;
  font: 500 13px/1 var(--font-sans);
  background: var(--aqua);
  color: var(--aqua-ink);
  box-shadow:
    var(--edge-machined),
    var(
      --shadow-penumbra,
      0 0.6px 1.6px -1.5px rgb(0 0 0/0.5),
      0 2.3px 6px -3px rgb(0 0 0/0.4),
      0 10px 26px -4.5px rgb(0 0 0/0.28)
    );
  transition:
    background-color 150ms var(--ease-out),
    transform 100ms var(--ease-out);
}
.nav-cta:hover {
  background: var(--aqua-hover);
}
.nav-cta:active {
  transform: scale(0.97);
}
@media (max-width: 720px) {
  .nav-cta {
    padding: 9px 14px;
  }
}
```

No `box-shadow: 0 0 28px aqua` anywhere. It reads as a lit key, not a sign.

### Mobile hamburger + menu

```css
.nav-burger {
  display: none;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  background: none;
  border: 0;
  padding: 0;
}
@media (max-width: 720px) {
  .nav-burger {
    display: flex;
  }
}
.nav-burger__l1,
.nav-burger__l2 {
  position: absolute;
  width: 20px;
  height: 1.6px;
  background: var(--ink);
  border-radius: 1px;
  transition: transform 200ms var(--ease-settle);
}
.nav-burger__l1 {
  transform: translateY(-4px);
}
.nav-burger__l2 {
  transform: translateY(4px);
}
.nav-burger.is-open .nav-burger__l1 {
  transform: translateY(0) rotate(45deg);
}
.nav-burger.is-open .nav-burger__l2 {
  transform: translateY(0) rotate(-45deg);
}

.nav-mobile-menu {
  position: fixed;
  top: calc(16px + 60px + 8px + env(safe-area-inset-top, 0px));
  left: calc(20px + env(safe-area-inset-left, 0px));
  right: calc(20px + env(safe-area-inset-right, 0px));
  background: var(--surface-3);
  border-radius: 12px;
  box-shadow: var(--edge-machined), var(--shadow-2);
  padding: 8px;
  z-index: 99;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 180ms var(--ease-settle),
    transform 180ms var(--ease-settle);
}
.nav-mobile-menu[data-open] {
  opacity: 1;
  transform: translateY(0);
}
.nav-mobile-menu a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 12px;
  border-radius: 8px;
  font: 500 15px/1.2 var(--font-sans);
  color: var(--ink);
  text-decoration: none;
}
.nav-mobile-menu a:active {
  background: color-mix(in oklab, var(--ink) 7%, transparent);
}
.nav-mobile-menu hr {
  border: 0;
  height: 1px;
  background: var(--hairline);
  margin: 6px 4px;
}
@media (min-width: 721px) {
  .nav-mobile-menu,
  .nav-burger {
    display: none;
  }
}
```

---

## Motion timeline

| t-offset / trigger                                                                                                    | Element                        | From -> to                                                                                                       | Duration                         | Easing                                         | Notes                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page load (no delay)                                                                                                  | Nav capsule, logo, links, CTA  | fully rendered, no entrance animation                                                                            | 0ms                              | n/a                                            | Deliberate: no fade/settle-in for nav. It should read as immediately "there," authoritative, not chrome that flickers in. All entrance-choreography budget (brief §6, <=1.6s) belongs to the hero. |
| `scrollY > 8px` (passive scroll listener, own inline script, no rAF needed for a binary threshold)                    | `.nav-capsule`                 | resting border/shadow -> `.is-scrolled` border/shadow                                                            | 200ms                            | `var(--ease-out)`                              | Toggle only; reverses below 8px.                                                                                                                                                                   |
| Fixed timer, `1500ms` after `DOMContentLoaded` (self-contained, does not depend on the hero's own timeline finishing) | Logo chip (`.nav-logo__chip`)  | rim-flash: reuses the shared `.flashable`/`.is-flash` utility (global.css) applied to the chip's own pseudo-ring | 240ms                            | `var(--ease-out)` (per `rim-flash` keyframe)   | One-shot, never repeats. Echoes the hero's "last chip lands, flashes aqua" motif in miniature, in the logo itself. P2 — cut first if any budget pressure; nav is complete and correct without it.  |
| Hover (`@media (hover:hover)` only)                                                                                   | Nav links, Sign in             | color/bg pill fade in                                                                                            | 150ms (on and off, see CSS note) | `var(--ease-out)`                              |                                                                                                                                                                                                    |
| `:active` on any nav link/CTA/logo                                                                                    | respective element             | `scale(0.97)` (buttons) / `opacity:.8` (logo, plain links)                                                       | 100ms                            | `var(--ease-out)`                              |                                                                                                                                                                                                    |
| Hamburger tap                                                                                                         | `.nav-burger` lines            | hamburger -> X                                                                                                   | 200ms                            | `var(--ease-settle)`                           |                                                                                                                                                                                                    |
| Hamburger tap (open)                                                                                                  | `.nav-mobile-menu`             | `opacity:0 translateY(-4px)` -> `opacity:1 translateY(0)`                                                        | 180ms in / 150ms out             | `var(--ease-settle)` in, `var(--ease-out)` out | Focus moves to first panel link on open; returns to hamburger on close.                                                                                                                            |
| Live clock                                                                                                            | `#nav-clock-time` text content | re-render `"THU 17:42"` string                                                                                   | instant (text swap)              | n/a                                            | Aligned to the next minute boundary via one `setTimeout`, then `setInterval(60000)`. No fade/crossfade on digit change (a flourish here would compete with the hero's own now-line motif).         |

**Ambient loops:** none. The clock dot is intentionally static (no breathing/pulse animation) — the brief's
two-tempo rule caps ambient loops at one per viewport, and the hero (same fold, first screen) already owns
one (the idler chip drift / now-line). Adding a second pulsing element in the nav directly above it would
break that budget. Liveness in the nav is proven by the digits changing once a minute, not by decoration.

**Reduced motion:** the global `prefers-reduced-motion: reduce` block in `global.css` already zeroes all
`transition-duration`/`animation-duration` to `0.01ms`, which correctly collapses the scroll-state
border/shadow change, hover pills, hamburger morph, and menu open/close to instant — no bespoke override
needed for those. The ONE exception is the logo's one-shot rim-flash: the shared `.is-flash` keyframe animates
opacity `0.6 -> 0`, and forcing its duration to `0.01ms` would make it invisible (contradicts brief §5's own
rule that reduced motion turns a rim flash into "a 240ms static ring at 20%," i.e. still visible). Nav adds a
scoped local override so its own instance is correct regardless of what the shared utility does elsewhere:

```css
@media (prefers-reduced-motion: reduce) {
  .nav-logo__chip-flash::after {
    animation: none;
    opacity: 0.2;
  }
}
```

---

## Interaction spec

- **Hover** (`@media (hover:hover)` gated, so touch never gets a stuck hover state): nav links and Sign-in
  get the pill background per Visual spec; CTA darkens to `--aqua-hover`; logo gets no hover treatment at
  all (static identity, not a nav item).
- **Press:** all buttons/links `scale(0.97)` 100ms on `:active` except the plain-text logo/nav-links, which
  dip to `opacity:.8` (a scale on running text looks like a glitch).
- **Focus-visible:** relies entirely on the existing global rule (`:focus-visible{outline:2px solid
var(--aqua);outline-offset:1px}`) — no nav-specific override. This is why `.nav-capsule` must never get
  `overflow:hidden`: a focus ring on a link near the capsule's rounded corner would otherwise be clipped by
  the parent's own clip box. Tab order: logo -> How it works -> Shortcuts -> Sign in -> Start free (desktop);
  logo -> hamburger -> Start free, then (if menu open) the three panel links, in DOM order (mobile).
- **Keyboard, hamburger:** a disclosure button, `aria-expanded` toggled, `aria-controls="nav-mobile-menu"`.
  `Enter`/`Space` opens and moves focus to the first panel link. `Escape` while the panel is open closes it
  and returns focus to the hamburger. Clicking/tapping outside the panel closes it. No focus trap (it is a
  disclosure, not a modal) — Tab from the last panel link continues naturally into page content.
- **Touch:** hamburger and CTA are 44x44px minimum hit area (hamburger's icon glyph is visually ~20px,
  centered inside the full 44px button box — never shrink the tappable box to match the glyph). Mobile menu
  links are 44px min-height rows. No drag/swipe gestures on the nav.
- **Live clock accessibility:** the whole `.nav-clock` cluster is `aria-hidden="true"`. It is a decorative
  honesty flourish, not information unique to this control (unlike the hero's own honesty line, which the
  hero spec should expose to AT if it carries unique claims) — an `aria-live` region ticking every 60s would
  be a genuine nuisance for screen-reader users. This is a deliberate omission, not an oversight.

---

## DOM + implementation strategy

### Element tree

```html
<header class="nav" data-nav>
  <nav class="nav-capsule" aria-label="Main" data-nav-capsule>
    <a class="nav-logo" href="/" aria-label="Taskflow, home">
      <svg
        class="nav-logo__svg"
        viewBox="-20 -19 123.67 20.24"
        width="122"
        height="20"
        aria-hidden="true"
      >
        <!-- rule, divider, chip, wordmark path — see Visual spec -->
      </svg>
    </a>

    <div class="nav-links">
      <a href="#type-it">How it works</a>
      <a href="#keys">Shortcuts</a>
    </div>

    <div class="nav-cluster">
      <p class="nav-clock" aria-hidden="true">
        <span class="nav-clock__dot"></span>
        <span id="nav-clock-time"></span>
      </p>
      <span class="nav-divider" aria-hidden="true"></span>
      <a class="nav-signin" href="/app/login">Sign in</a>
      <a class="btn nav-cta" href="/app/signup">Start free</a>
      <button
        class="nav-burger"
        aria-expanded="false"
        aria-controls="nav-mobile-menu"
        aria-label="Open menu"
        data-nav-burger
      >
        <span class="nav-burger__l1"></span>
        <span class="nav-burger__l2"></span>
      </button>
    </div>
  </nav>

  <div class="nav-mobile-menu" id="nav-mobile-menu" hidden data-nav-menu>
    <a href="#type-it">How it works</a>
    <a href="#keys">Shortcuts</a>
    <hr />
    <a href="/app/login">Sign in</a>
  </div>
</header>

<noscript
  ><style>
    .nav-clock {
      display: none;
    }
  </style></noscript
>

<script is:inline>
  // ~60-70 lines, see below. No import — self-contained, no dependency on motion.js.
</script>
```

- Astro-rendered (static): the entire markup above, including the logo SVG (path baked at build time, zero
  runtime font loading — the wordmark needs no network font, it is pre-vectorized).
- JS-driven (this component's own `is:inline` script, non-deferred so the clock has no flash-of-empty-text):
  1. Scroll listener (`passive:true`) toggling `.is-scrolled` at an 8px threshold. ~8 lines.
  2. Clock: compute `"THU 17:42"`-style string (weekday abbrev caps + 24h `HH:MM`, matching the hero's own
     honesty-line format so the two never visually disagree — both are reading the same `Date()`, just
     independently formatted; use one shared format function if the hero's spec exposes one via
     `window.TF`, otherwise duplicate the ~6-line formatter locally). Set on load, then align to the next
     minute boundary with one `setTimeout`, then `setInterval(60000)`. ~15 lines.
  3. Mobile menu: toggle `hidden`/`data-open`, `aria-expanded`, focus management, `Escape` handler,
     outside-click handler. ~25 lines.
  4. One-shot logo rim-flash: `setTimeout(1500)` adds `.is-flash` to the chip's flash pseudo-element once,
     never repeats. ~5 lines.
  - Total estimate: ~60-70 lines, ~1.2-1.5KB minified. Does not need the shared `motion.js` (no rAF ticker,
    no IntersectionObserver, no FLIP) — everything here is a one-shot timer or a passive scroll listener.
    The only foundation dependency is the CSS custom properties below.

### Needs from the shared foundation (`global.css` / `Layout.astro`)

- `--shadow-penumbra` exact value (direction §2.2): `0 0.6px 1.6px -1.5px rgb(0 0 0/.5), 0 2.3px 6px -3px
rgb(0 0 0/.4), 0 10px 26px -4.5px rgb(0 0 0/.28)`. Nav has a `var(--shadow-penumbra, <same value>)` fallback
  so it renders correctly even if the foundation commit lands after this component's.
- `--line-dim` exact value (direction §2.1): `color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent)`.
  Same defensive fallback used in the logo's rule/divider strokes.
- `global.css`'s shared `.btn-primary` should also drop its `box-shadow:0 0 28px...` glow per §2.7 — nav
  does not depend on this (it fully overrides its own CTA styling locally) but every other CTA on the page
  does, so this is a cross-section flag, not a nav blocker.
- Whoever owns `#type-it` and `#keys` (TypeIt.astro, Keys.astro) needs `scroll-margin-top: 96px` on those
  section roots — see Risks below, this is the anchor-jump-under-the-capsule problem.
- Confirm the existing reduced-motion block in `global.css` stays intact; nav relies on it for every
  transition it does NOT locally override.

---

## Accessibility + reduced motion

- Landmarks: one `<header>`, one `<nav aria-label="Main">` (matches current implementation's pattern — a
  single nav landmark for the whole bar, including logo and CTAs, which is a common and acceptable choice).
  The mobile menu panel is a plain `<div>` (not a second nav landmark) tied to the hamburger via
  `aria-controls`/`aria-expanded`; its links are removed from the accessibility tree via the `hidden`
  attribute when closed, so there is never a duplicate-landmark or duplicate-link-name problem, and no
  duplicate tab stops.
- Logo: the SVG carries `aria-hidden="true"` (its wordmark is vector artwork now, not real text); the
  accessible name for the "go home" link comes from `aria-label="Taskflow, home"` on the `<a>`.
- Hamburger: `aria-expanded` true/false, `aria-label` swaps `"Open menu"` / `"Close menu"`,
  `aria-controls="nav-mobile-menu"`.
- Clock: `aria-hidden="true"` on the whole cluster (see Interaction spec for reasoning).
- Contrast: `--aqua` on `--void`-tinted glass and `--aqua-ink` on `--aqua` both already pass per brief §2.3
  (8.09 / 8.34). `--ink-muted` nav-link resting color against the glass capsule needs a spot-check once
  implemented (the capsule's background is a 55%-mixed void, close to `--void` itself, where `--ink-muted`
  is already verified >=4.5:1 per brief §2.2 — no new risk, but confirm at the first screenshot).
- Reduced motion exact static rendering: capsule renders in whichever scroll state it is actually in
  (scrolled or not) with the transition simply not animated (0.01ms, effectively instant) — there is no
  separate "reduced motion appearance," because the state itself is not decorative. The mobile menu still
  opens/closes (functionally required), just without the animated glide. The logo's one-shot rim-flash
  becomes a static 20%-opacity ring per the scoped override above, still fires once at 1500ms, never loops.
  No ambient loops exist to disable in the first place.
- No new font network requests: the wordmark is baked path data; the mono clock uses the already-loaded
  Spline Sans Mono webfont.

---

## Risks

1. **The logo re-reading as a button.** This is the exact defect being fixed — the guard is structural, not
   optional: no background rect/plate behind the mark, no border/stroke around its bounding box, no hover
   background on `.nav-logo` itself. If a future edit adds a container `div` with padding+radius+background
   around the `<svg>` "to make it clickable," that reintroduces the bug. The link's hit target is the `<a>`
   itself (117x20-ish, small but consistent with Linear/Resend's own logo hit sizes) — do not pad it into a
   visible button shape to enlarge the target; if a bigger tap target is wanted, use invisible padding via
   `::before` extending the hit area without a visible box.
2. **CTA glow creeping back in.** Anyone copying `.btn-primary` from `global.css` verbatim before the
   foundation de-glow lands will reintroduce the neon `0 0 28px` shadow. Nav's `.nav-cta` class is a full
   local override for exactly this reason — do not delete it in favor of the shared class until `global.css`
   confirms the glow is gone everywhere.
3. **Corrupted path data.** The wordmark `d` string is ~4.2KB of dense, comma-less path commands. Any
   reflow/line-wrap/whitespace edit by an editor's auto-formatter will silently corrupt the glyph shapes.
   Store it as one unbroken string (a `const NAV_WORDMARK_D = "..."` in the component's frontmatter, or a
   `.svg` partial file) and never hand-edit it.
4. **Anchor jumps landing under the capsule.** `#type-it` and `#keys` are floating-nav-covered without a
   `scroll-margin-top` fix on the target sections (the capsule's total footprint is `16 + 60 = 76px`, plus
   clearance). This is listed under Needs from foundation above — flag it again here because it is easy to
   miss since the fix lives in a file this component doesn't own.
5. **Looking like generic glassmorphism instead of a machined instrument.** The border/highlight values are
   deliberately subtle (`rgb(...,.10)` inset highlight, 8-14% ink border) — if implemented with even
   slightly-off alpha values, it can read as "just a rounded div with a blur," losing the intended "lit
   object" quality. Guard: screenshot at 1440 in the live dev server and confirm the inset top-highlight
   reads as one crisp bright hairline along the top edge, not a general glow; compare directly against the
   Raycast reference screenshot in `landing/research/navbars/shots/04-raycast-top.png`.
6. **Ambient-loop budget collision with the hero.** If the hero spec independently adds its own idling
   element near the top of the viewport (the margin idler chip, the now-line) at the same time this nav
   ships a pulsing clock dot, the page would show two ambient loops in one fold, violating the two-tempo
   rule. Nav's dot is static specifically to leave that budget to the hero — do not add a pulse animation to
   `.nav-clock__dot` later without removing an ambient loop elsewhere in the same fold.
7. **44px targets slipping on mobile.** The hamburger's icon glyph is small (20px) sitting inside a 44px box
   — a careless refactor that sizes the button to `fit-content` instead of a fixed `44x44` would silently
   shrink the tap target below the MUST. Keep the box dimensions explicit, not content-sized.
