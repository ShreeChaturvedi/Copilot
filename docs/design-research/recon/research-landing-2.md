# Landing-page design research, round 2 — Taskflow Calendar

Recon date: 2026-07-01 (evening session). Owner direction after round 1: "You should look at other sites, not just Linear. Great examples are Midday, Obsidian, https://forward.framer.ai/, etc." This dossier tears down that register and proposes 3 NEW landing concepts.

Method: playwright-cli headless Chrome, 1440x900, per-site extraction script `extract2.js` (extends round-1 `extract.js` with gradients, box-shadow glows, backdrop-filters, filters, grain hints, canvas/WebGL detection, and running CSS animations). Raw dumps: `site-{midday,obsidian,forward,warp,resend,cursor,clerk}.json`. Screenshots: `hero-{midday,midday-dark,obsidian,forward,warp,resend,cursor,clerk}.png`. All in this directory. Everything below marked [observed] came from computed styles or the screenshot. Round-1 dossier: `research-landing.md`. Beat-the-reference criteria (D1-D4, M1-M4, P1-P4, C1-C3): `landing-reference.md` §1.7.

Sites 4-6 rationale: warp.dev, resend.com, cursor.com were picked as closest to what Midday/Obsidian/Forward share (material depth, texture, characterful display type, product-as-object). clerk.com added as a 7th because its schematic-etch background and dedicated-numerals font are directly relevant to a calendar product. linear.app was covered in round 1 and skipped.

---

## 1. Site-by-site teardowns

### 1.1 Midday — midday.ai (finance OS)

Caveat first: the owner cited Midday for the mono/monochrome engineering-craft lane. The live site has since softened into a serif editorial light-first design (announcement pill: "Midday is joining Ramp" — another indie tool exiting, same graveyard pattern as round-1 §1.9). The monochrome-craft DNA survives in its charts, grain, and dark mode.

- Hero thesis [observed]: white page, centered announcement pill ("Midday is joining Ramp →"), giant SERIF headline "The business stack for modern founders", one-sentence subhead listing concrete verbs (send invoices, reconcile, export clean books), single dark CTA "Start your trial" with honesty microcopy under it: "14-day free trial · Cancel anytime". Below: a row of grayscale integration glyphs, then the signature object — a DARK, heavily grain-textured product screenshot panel floating on the white page with a huge soft shadow. The dark app frame on the light page is the brand moment.
- Fonts (verified @font-face): Hedvig Letters Serif (display, Google Fonts) + Hedvig Letters Sans (body). H1: 72px / 400 / -1.8px / line-height 1.0. A matched serif+sans pair from one type family, both free.
- Palette (verified): light bg #FFFFFF, ink #121212. Dark mode (toggled live via footer "Light/Dark mode" switch): bg #0D0D0D, text #FAFAFA. Chart tokens are strict monochrome: bars #000, grid #E6E6E6, axis text #707070, forecast line #666. One accent found anywhere: green #22C55E at 23% alpha as a pulse-glow ring (system-status dot family).
- Motion (verified animations): fadeInBlur 0.35s ease-out, fadeInScale 0.4s ease-out (entrances), marquee-left 30s / marquee-right 28s linear (dual-direction logo marquees), pulse-glow 2s cubic-bezier(0.4,0,0.6,1) (status dot). Transitions 0.15-0.2s cubic-bezier(0.4,0,0.2,1). Two-tempo pattern: sub-400ms entrances plus multi-second ambient loops.
- Signature element: the grainy dark product slab on white, with `drop-shadow(rgba(0,0,0,0.6) 0px 30px 60px)` [computed]. Product photographed like an object, page kept as a clean paper mat.
- Texture/material: visible film grain baked into the product frame art (not a CSS overlay — grainHints came back empty, the grain is in the raster). Backdrop blur 12px nav. `grayscale(1)` on all third-party logos. Monochrome charting as texture.
- Transferable to a calendar: (a) the honesty microcopy line under the CTA, (b) time-saved receipts as copy — their h3s are literally "45 minutes per week", "1-2 hours per week" per feature, a quantified-outcome pattern a task+calendar app can copy credibly, (c) dark-product-slab-on-light-page inverts nicely for Taskflow's light app: a LIGHT week grid photographed on a dark room could be ours, (d) strict monochrome chrome so the product's event chips are the only color.

### 1.2 Obsidian — obsidian.md (notes, dark community-credibility)

- Hero thesis [observed]: near-black page, LEFT-aligned two-line H1 "Sharpen your thinking." with plain-spoken subhead "The free and flexible app for your private thoughts.", one purple CTA that is platform-aware ("Get Obsidian for Linux (AppImage)" — it sniffed the headless Linux UA) + text link "More platforms". Right half of the fold: empty dark space. Below, a full product window (dark theme, real notes, real graph view) overlapped by an iPhone frame, both fading into the page via a to-top gradient. An animated canvas renders their note-graph constellation — the product's own data structure used as atmosphere.
- Fonts (verified): system-ui stack throughout (ui-sans-serif, -apple-system...; Inter registered as fallback @font-face). H1: 60px / 600 / -1.2px / 1.0. Zero webfont spend, the brand lives in color and the graph instead. (Anti-pattern for us per round-1 §5.10 default-type tell, but proof that atmosphere can carry a page.)
- Palette (verified root vars + computed): bg #0F0F0F, text #EEEEEE, accent purple #A882FF (CTA), full utility ramp defined (--color-blue #027AFF, --color-green #44CF6E, --color-red #FB464C...) but only purple is spent on chrome.
- Motion [observed]: canvas graph drifts slowly (ambient, multi-second). CSS transitions `transform 1s, box-shadow 2s ease-in-out` on the floating product frames (slow hover float). No entrance choreography detected — the page is calm, the canvas breathes.
- Signature element: the graph constellation. The product's data model as the page's living background.
- Texture/material: glass edges everywhere — cards use `rgba(255,255,255,0.1) 0 0 0 1px inset` rings (1px inner glass border) + deep soft shadows `rgba(0,0,0,0.25) 0 25px 50px -12px`. Gradient fade `linear-gradient(to top, #0F0F0F, transparent)` melts product shots into the room. Dark room + rim-lit panels.
- Transferable to a calendar: (a) platform/context-aware CTA (Taskflow: detect signed-out vs returning), (b) inset 1px glass ring + deep shadow as the panel material for a dark hero, (c) THE BIG ONE: use the product's own data structure as atmosphere — for a calendar that is the week grid's hairlines and chips, i.e. a faint living calendar texture behind content, (d) h2 cadence "Spark ideas. Sync securely. Publish instantly." — three two-word verb pairs, a voice pattern that maps to "Capture fast. Place in time. Ship your week."

### 1.3 Forward — forward.framer.ai (Framer conference template, the premium-motion reference)

- Hero thesis [observed]: a letterboxed cinema frame. Dark #0D0D0D page acts as a matte border, inside it a full-bleed cinematic photograph — dancers in long-exposure motion blur that turns human figures into an organic pink/lavender/cyan aurora. Centered over it: eyebrow "3-day AI & Design conference", all-caps H1 "FORWARD 2026", subhead, two ghost-button CTAs (GET TICKETS / VIEW SCHEDULE). Below the frame, a mono-spaced fact ticker: "JUNE 14-16 OSAKA CONVENTION CENTER".
- Fonts (verified): Satoshi (Fontshare!) display, 82px / 500 / normal tracking / 1.0. Inter body. Validates the round-1 Fontshare shortlist lane at premium quality.
- Palette (verified): page #0D0D0D, white text. All hue comes from the photograph (motion-blur pinks #E8B4C8-family, lavender, steel blue — sampled from screenshot, the CSS itself is monochrome). Gradient count in CSS: one radial. The "gradient" is photography.
- Motion choreography [observed computed styles; Framer runtime]: the trademark technique is the PROGRESSIVE BLUR LADDER — eight stacked layers with backdrop-filter blur at doubling strengths: 0.078125 / 0.15625 / 0.3125 / 0.625 / 1.25 / 2.5 / 5 / 10px [verified]. Content scrolling under the ladder melts gradually instead of hitting a hard fade — this is most of why Framer sites feel "deep". Physical shadows are three-tier layered: `rgba(0,0,0,0.17) 0 0.6px 1.57px -1.5px, rgba(0,0,0,0.14) 0 2.29px 5.95px -3px, rgba(0,0,0,0.02) 0 10px ...` (penumbra stack, reads as real light). Speaker/partner imagery normalized via `grayscale(1) invert(...)` filters. Scroll reveals are Framer springs (JS-driven, not CSS keyframes, hence empty animatedProps).
- Signature element: photograph-as-gradient inside a letterbox matte. Plus the schedule section itself: day-by-day agenda tables (Day 1 / Tue, May 4 / session rows) — a conference site is literally selling a calendar, and it sells it as an editorial program, not a grid.
- Texture/material: progressive blur, penumbra shadow stacks, monochrome-normalized imagery, generous letterbox margins as "frame" material.
- Transferable to a calendar: (a) progressive blur ladder under the sticky nav and over the hero product shot (cheap, CSS-only, GPU-friendly), (b) penumbra 3-tier shadows for the product slab instead of one blurry box-shadow, (c) the agenda-as-editorial-program layout is a genuinely fresh way to render "your week" in a lower section (rows, not grid), (d) letterboxing the hero product shot inside a matte border to make it feel projected.

### 1.4 Warp — warp.dev (agentic dev environment; light register-match)

- Hero thesis [observed]: light, blue-tinted paper. Split fold: LEFT a giant three-line H1 "From the terminal to the cloud, with any agent", RIGHT a small justified paragraph (the "spec block" — body copy doing subhead duty). CTAs are set in MONOSPACE: black "Download" (with a keyboard-hint chip "D" on the nav twin) + underlined mono "Contact Sales". Below: a lavender-washed panel holding a real Warp Desktop window (title bar, traffic lights, agent task list, live session). Bottom edge: an uppercase mono fact ticker marquee "SELF-HOST OR WARP-HOST · CONNECT ANY TOOL · OWN YOUR DATA · ANY INFERENCE PROVIDER · ANY MODEL" with inline logos.
- Fonts (verified): "theFuture" display (custom), 72px / 400 / -2.52px / 1.1. Matter body. Azeret Mono + Hack for mono. Instrument Serif loaded as an accent face. Nav GitHub star count "63k" as live social proof.
- Palette (verified, oklch): html bg oklch(0.9925 0.0018 220) ≈ #FBFDFE (barely-blue paper), ink oklch(0.07 0.007 220) ≈ #0B0D0F. Product panel wash: soft lavender (#EEEBFA-family, sampled). Hairline inset rings `rgb(31,31,31) 0 0 0 1px inset`.
- Motion (verified): warp-lite-story-reveal 0.32s cubic-bezier(0.16,1,0.3,1), warp-lite-composer-reveal 0.24s same easing (that bezier = easeOutExpo-family, snappy-decelerate), scroll-left 50s linear (ticker). Micro-transitions 0.15-0.3s. The product window types/streams its own demo content.
- Signature element: mono type promoted from metadata to CHROME — buttons, nav, tickers all mono. Plus the keyboard-hint chip on the CTA.
- Texture/material: flat paper + one tinted panel + 1px inset hairlines. Depth is typographic, not photographic.
- Transferable to a calendar: (a) keyboard-hint chip on the primary CTA (Taskflow genuinely has shortcuts, `src/hooks/useKeyboardShortcuts.ts` — criteria C2), (b) the uppercase mono fact ticker as the honesty layer ("4 CALENDAR VIEWS · NL DATE PARSING · RRULE RECURRENCE · GOOGLE SYNC"), (c) split hero with spec-block paragraph right, (d) 0.24-0.32s easeOutExpo reveal register matches Taskflow's existing 0.2/0.3s tokens.

### 1.5 Resend — resend.com (email API; the purest dark lit-object site)

- Hero thesis [observed]: pure black void. Left: announcement pill with a prismatic gradient border, serif H1 "Email for developers" (two lines, 96px Domaine), two-line subhead, "Get started" + "Documentation". Right: the signature — a 3D obsidian-black cube (their logomark) built of glossy sub-cubes, slowly rotating, lit like a product photograph so only its edges and one face catch light. Under it, a faint horizontal light-beam line runs across the "floor". The object IS the brand; the page is a photo studio.
- Fonts (verified preloads): Domaine (display serif, Klim), Inter Variable body, Commit Mono (code), ABC Favorit (UI accents). H1: 96px / 400 / -0.96px / 1.0. Serif-over-engineering at the largest scale seen in either round.
- Palette (verified): bg #000000 (true black, breaking the round-1 "never #000" rule and making it work via the lit object), text #F0F0F0. Accent = one prismatic gradient: `linear-gradient(112.8deg, rgba(2,252,239,0.44), rgba(255,181,43,0.44), rgba(160,43,254,0.44))` — cyan/amber/violet at 44% alpha, spent ONLY on the pill border and small UI edges. Full Radix alpha scales in root vars (--violet-a1..a12, --green-a*, --amber-a* etc.) — color as translucent film over black, never solid.
- Motion (verified animations): hero-text-slide-up-fade 1s ease-in-out, webgl-scale-in-fade 1s (cube entrance), rotate 30s linear (cube idle), open-scale-up-fade 1.5s, plop 1s, scroll-x 180s (marquee). Two-tempo again: ~1s entrances, 30-180s ambient. Backdrop blur 25px on nav.
- Signature element: the lit cube in the void + the floor light-line (`linear-gradient(90deg, transparent, rgba(143,143,143,0.67) 50%, transparent)`).
- Texture/material: WebGL gloss, alpha-film color, blur(3-10px) glows behind panels, conic-gradient dial elements. Section h2 voice: "Integrate tonight", "Reach humans, not spam folders", closing "Email reimagined. Available today."
- Transferable to a calendar: (a) alpha-scale accent discipline — indigo #5e6ad2 as a translucent film (8-44% alpha) over dark surfaces rather than solid fills, (b) the floor light-line under a floating product slab, (c) one lit object: for Taskflow the "object" should be the week grid itself, glass-slabbed and edge-lit (no 3D mascot cube — that would be a cliche for us), (d) closing-line pattern "X reimagined. Available today." maps to "Your week, placed. Available now." (final copy TBD).

### 1.6 Cursor — cursor.com (AI coding agent; light atmospheric)

- Hero thesis [observed]: warm paper page. Small, almost understated H1 (26px! "Cursor is your coding agent for building ambitious software."), two CTAs (platform-aware "Download for Linux ⤓" + "Request a demo →"). The fold is dominated by the artwork: a Hudson-River-School-style romantic landscape painting (misty valley, mountains) with a REAL "Cursor Desktop" product window floating over it, agent task list running, plus a nested "Cursor CLI" window. Fine art supplies the atmosphere, the product supplies the proof. "Ambitious software" is argued by the sublime landscape.
- Fonts (verified preloads): CursorGothic (custom gothic sans, body+display), Berkeley Mono (same commercial mono as Linear), EB Garamond + Lato loaded, KaTeX faces (docs pages). H1 26px / 400 / -0.325px — deliberate anti-hero typography, the painting does the talking.
- Palette (verified): bg #F7F7F4 (warm paper, theme-color meta confirms), ink #26251E (warm near-black). Task-type pastel ramp in root vars: --color-timeline-thinking #DFA88F, grep #9FC9A2, read #9FBBE0, edit #C0A8DD — categorical data colors that stay muted on paper.
- Motion (verified): shimmer 2.5s linear (loading text), transitions 0.14-0.2s cubic-bezier(0.25,1,0.5,1) (easeOutQuart-family). Product window streams fake-live agent output (typed content, progressing tasks). Very low motion elsewhere — the liveness is IN the product window.
- Signature element: fine-art landscape under a working product window. Also the shadow craft: `rgba(0,0,0,0.14) 0 28px 70px, rgba(0,0,0,0.1) 0 14px 32px` + 0.5px rings — window sits ON the painting like glass on canvas.
- Texture/material: painting texture (raster art), oklab-space grays, layered penumbra shadows, 0.5px hairlines.
- Transferable to a calendar: (a) the pastel categorical ramp is exactly an event-chip palette for light mode (their 4 hues even read calendar-ish), (b) a working, streaming product window as the hero's motion source (Taskflow: a task typed in smart-input, parsed live with highlighted spans, then placed on the grid), (c) evocative-backdrop-under-real-window structure, though for one-brand discipline our backdrop must be system-generated (grid, light), not a painting, (d) proof that light mode can be atmospheric — relevant since Taskflow's app is light-first.

### 1.7 Clerk — clerk.com (auth components; the schematic-material site)

- Hero thesis [observed]: cool gray-white page whose background is an ETCHED SCHEMATIC — a faint technical wiring diagram (traces, component outlines, dimension ticks) drawn at ~4-6% contrast across the whole fold, as if the product were blueprinted onto the page. Centered H1 "More than authentication, Complete User Management" (Suisse Intl 64px/700/-1.6px), subhead, violet CTA "Start building for free" + "Build with agents". Below: real UI components rendered as physical cards (their actual <SignUp/> components), and buttons literally labeled `<SignUp />`, `<UserButton />` — code as nav.
- Fonts (verified preloads): Suisse Intl (display+body, commercial), PLUS a dedicated numerals font: geistNumbers (Geist variable subset just for figures) listed FIRST in the body stack, plus Soehne Mono / Geist Mono. A company that ships a separate font for tabular numbers.
- Palette (verified): bg #F7F7F8, ink #000, accent violet #6C47FF (CTA), wash gradients `rgba(58,212,253,0.08) → rgba(98,72,246,0.15)` (sky-cyan into violet, sub-15% alpha), dark panels #131316/#19191B/#212126 for contrast sections.
- Motion (verified): transitions 0.3s cubic-bezier(0.4,0.36,0,1) and 0.45s cubic-bezier(0.33,1,0.68,1) — slower, heavier easing than the dev-tool norm, feels "engineered". Progressive blur ladder here too: backdrop blur 1/2/3/4/5/6/8/10px stacked. Canvas present (hero schematic lines animate subtly).
- Signature element: the etched schematic background + components-as-physical-cards.
- Texture/material: double-hairline card material — `rgba(255,255,255,0.9) 0 0 0 0.5px inset` (inner light edge) + `rgba(19,19,22,0.15) 0 0 0 0.5px` (outer dark edge) + soft drop — this two-ring 0.5px sandwich is what makes their cards read as machined objects. SVG filter shadows for logos.
- Transferable to a calendar: (a) the 0.5px double-hairline material is a perfect upgrade for Taskflow's card/panel system in BOTH themes (beats reference D1 parity), (b) dedicated tabular-numerals treatment — round 1 already flagged tnum as a calendar requirement, Clerk proves shipping a numerals-first stack is a brand move, (c) schematic-etch background of the actual week grid at 4-6% contrast = product-as-blueprint atmosphere with near-zero perf cost, (d) real components rendered as physical cards = Taskflow's event chips/dialogs as touchable objects.

---

## 2. Synthesis — what this register shares that the round-1 canon (Linear / Notion Calendar) lacks

Round 1's canon (Linear, Raycast, Vercel, Notion Cal) is GRAPHIC: flat hued-black or white planes, Inter-family type, color as paint, motion as reveal. The Midday/Obsidian/Forward register (with Warp/Resend/Cursor/Clerk confirming) is PHOTOGRAPHIC. Name it precisely:

**The register: "lit objects in quiet rooms" — product-photography logic applied to a landing page.**

Its five laws, none of which the round-1 canon follows:

1. **Light is the material, not color.** Resend's cube is lit, Midday's slab casts a 60px shadow, Forward's photo IS a light field, Clerk's cards have a 0.5px light edge on top and dark edge below (a consistent implied light source), Cursor's window sits on a sunlit painting. Depth comes from lighting physics: penumbra shadow stacks (3 layers at increasing blur/decreasing alpha), inner light rims, floor light-lines, blur glows. Linear has zero implied light source.
2. **Texture is explicit and named.** Film grain (Midday raster, and the Astro reference's feTurbulence), progressive blur ladders (Forward 0.08→10px, Clerk 1→10px), glass inset rings (Obsidian), machined double hairlines (Clerk), painting raster (Cursor). Surfaces have material identity: obsidian, glass, paper, canvas. The canon's surfaces are unnamed flats.
3. **A characterful display face carries voice; mono is promoted to chrome.** Hedvig Letters Serif, Domaine, Satoshi, theFuture, CursorGothic, Suisse — nobody leads with Inter. Simultaneously mono stops being a metadata garnish and becomes structural: Warp's mono CTAs and ticker, Clerk's numerals font, Cursor's Berkeley Mono. Type roles: voice face + working sans + load-bearing mono.
4. **One object with mass, not a gradient wash.** Every site has exactly one thing that feels physical: cube, graph constellation, blurred dancers, terminal window, painting+window, schematic. The canon's signature elements (aurora rays, orbs) are made of light with no mass. The object is always product-derived or product-adjacent, never decorative 3D.
5. **Two-tempo motion.** Fast layer: 0.24-0.4s easeOutExpo/Quart entrances and reveals (same register as round 1). PLUS a slow ambient layer the canon lacks: rotate 30s, marquee 28-50-180s, pulse-glow 2s, canvas drift, blur-ladder scroll melt. The page breathes between interactions. Motion budget is still disciplined — the ambient layer is one or two loops, always compositor-only.

Also confirmed across the register: honesty microcopy as a material ("14-day free trial · Cancel anytime", "63k", platform-aware CTAs, "45 minutes per week" receipts) and voice-matched h2 systems ("Spark ideas. Sync securely. Publish instantly.").

Register fit check against Taskflow constraints: Instrument Panel+ is Linear-school precision with indigo #5e6ad2. The move is NOT to abandon the panel discipline, it is to LIGHT the panel: keep round 1's grid precision, add law 1 (light source), law 2 (one named texture per theme), law 3 (mono as chrome — the app's time digits already want this), law 4 (the week grid as the massive object), law 5 (one ambient loop). Dark and light must get material parity (reference weakness D1: its grain and glow are dark-only).

---

## 3. Three NEW landing concepts for Taskflow Calendar

Shared constraints honored by all three: Instrument Panel+ system (indigo #5e6ad2 accent, light+dark full parity, one brand across landing and app), real product UI inside the first two viewports, no round-1 §5 cliches (no cream+terracotta, no acid-green-on-black, no purple gradient text, no fake logos, no scroll-jack, no 3D clocks, no non-product month-grid graphics), static-first build (criteria P1-P4: Lighthouse perf ≥0.95, a11y 1.0, fold media ≤500KB, LCP static), entrances complete ≤1.6s (M4), prefers-reduced-motion static path (M3). Type pairings draw on the round-1 shortlist (§4). All hexes below are final proposals, contrast-check per D3 before shipping.

### Concept 1 — "KEYLIGHT"

- Thesis: the week grid as a lit object in a dark room. One key light hangs over the REAL Taskflow week view, rendered as a glass slab floating in an indigo-hued near-black void. The light is not decoration, it is the argument: the lit column is TODAY. The light pools onto the floor as a thin beam (Resend's floor line), grain sits on the room's walls (never on the product), and the slab has Clerk's 0.5px double-hairline rim plus a Forward-style 3-tier penumbra shadow. Light mode inverts the photograph: a white studio, the same slab casting graphite shadows on paper, today-column lit warm-white with an indigo rim. Full material parity between themes (beats reference D1).
- Palette: room #0B0C10 (indigo-hued near-black), slab surface #101216, ink #F7F8F8, muted #8A8F98, key light = indigo #5e6ad2 with alpha films rgba(94,106,210,0.16) wash / rgba(94,106,210,0.44) rim (Resend alpha discipline), floor line rgba(138,143,152,0.5). Light mode: studio #F7F7F5, slab #FFFFFF, ink #16171D, shadows rgba(22,23,29,0.14/0.10/0.04) 3-tier, indigo unchanged. Event chips: the app's real chip colors, desaturated ~20% in dark.
- Type: Schibsted Grotesk display (64-72px, weight 500, -3% tracking, lh 1.0) + General Sans body + Spline Sans Mono for time digits, the fact ticker, and the CTA keyboard chip. (Round-1 recipe B, "quiet systems".)
- Signature element: the today-column as the page's only light source. Nameable in one phrase: "the week under a key light."
- Hero sketch (1440x900):
  ```
  +--------------------------------------------------------------+
  | taskflow        Features  Pricing        [Sign in] [Start k] |   <- mono nav, kbd chip
  |                                                              |
  |   Your week, placed.                    ..grain............. |   <- H1 left, 2 lines,
  |   Not just planned.                     ..(room texture).... |      line2 muted
  |   General Sans sub, one sentence.                            |
  |   [Start planning  ⏎]   TUE 20:43 · FREE · SYNCS GOOGLE      |   <- mono honesty line
  |            ___________________________________               |
  |           /   MON   TUE   WED  ||THU|| FRI    \  <- 0.5px    |
  |          |  09:00 [design rev] ||####||        |    dbl rim  |
  |          |  11:00             ||#####|| [ship] |             |
  |          |  14:00 [1:1]       ||####||        |             |
  |           \___________________||_____||_______/             |
  |            ~~~~~~~ floor light-line ~~~~~~~~~                |
  +--------------------------------------------------------------+
        THU column = brightest surface on the page (key light)
  ```
- Motion plan (≥6 techniques, M1): (1) entrance: room fades from black, slab rises 24px + deblurs 12px→0, 600ms easeOutQuart, done by 1.2s, (2) key light "switch-on": a registered @property angle/opacity animates the light cone over the today column, 800ms, starts at 400ms, (3) ambient: light breathes ±6% intensity on an 8s loop (opacity only, compositor-safe), (4) scroll: the key light sweeps Mon→Fri linked to scroll progress through the features section — each feature section "lights" the day it narrates (meaningful sequence, passes the numbered-grid cliche test), implemented with CSS scroll-driven animations, no hijack (M2), (5) cursor proximity: the slab's rim brightens within 200px of pointer (rAF-throttled CSS vars, matches reference technique 6 but with light-mode parity), (6) IO reveals at 250ms easeOutQuart for everything else, (7) mono ticker of real facts, 45s linear loop. Reduced motion: light on, no sweep, all content static.
- Perf: slab is the real DOM week grid (HTML/CSS, no screenshot needed — copy is crawlable, LCP is text), grain is one 200-byte SVG feTurbulence data-URI on the room only, no WebGL, no video. Fold weight well under 500KB.

### Concept 2 — "SCHEMATIC"

- Thesis: the calendar as an engineering drawing that becomes the real product where you look at it. The whole hero background is a blueprint etch of the Taskflow week grid — hairline column traces, hour ticks, dimension annotations set in mono ("|— 90 MIN —|", "07:00", "W27") at 4-6% contrast (Clerk's etch, but of OUR product, satisfying D4 ownability). The real product window sits on top, and its columns align pixel-perfect with the etched traces beneath, so drawing and product read as one object at two levels of finish. Indigo is the "live ink": everything interactive or current (now-line, CTA, parsed smart-input spans) is indigo, everything drawn is graphite. This is Instrument Panel+ made literal: the landing is the instrument's technical drawing, the app is the instrument.
- Palette: light-first (matches the shipped app): paper #FAFAF9, graphite ink #191B22, etch lines rgba(25,27,34,0.06), dimension text rgba(25,27,34,0.35), live indigo #5e6ad2, indigo wash rgba(94,106,210,0.12), chip pastels from the app. Dark: board #0C0D12, phosphor etch rgba(154,163,255,0.10), ink #EDEEF3, indigo unchanged (parity: the etch exists in both themes, D1).
- Type: General Sans as the single voice face (display 64px weight 600 -2.5% AND body — one-family discipline) + Spline Sans Mono promoted to co-lead: every annotation, dimension, time digit, eyebrow, and the CTA microcopy is mono (the Warp move). No serif. This is the most "one system with the app" pairing: the app adopts General Sans + Spline Sans Mono and the brand is whole.
- Signature element: dimension-annotated time. Durations drawn like machine tolerances: `09:30 |——— DEEP WORK · 90 MIN ———| 11:00`.
- Hero sketch:
  ```
  +--------------------------------------------------------------+
  | ▤ taskflow      FEATURES  PRICING   [SIGN IN] [START — free] |
  |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |  <- etched hour ticks
  | :Tasks, placed in time.:       ETCH: |—— W27 ——|             |
  | :One grid for both.    :        .    .    .    .    .        |
  |  mono: NL DATES · RRULE · 4 VIEWS · GOOGLE SYNC              |
  |  [Start planning free]  [⌘K try the input]                   |
  |  .    .    +===========================+    .    .           |
  |  07:00 ----| MON  TUE  WED  THU  FRI   |---- 07:00 --------  |  <- etch lines run
  |  09:00 ----| [standup]     ‖now‖       |---- 09:00 --------  |     THROUGH & align
  |  11:00 ----|      [review] ‖####‖      |---- 11:00 --------  |     with real grid
  |            +===========================+                     |
  |         |—————— DEEP WORK · 90 MIN ——————|   <- dimension    |
  +--------------------------------------------------------------+
  ```
- Motion plan: (1) entrance: etch lines DRAW (SVG stroke-dashoffset, 700ms easeOutExpo, staggered by column) then the product window fades up at 500ms, complete 1.4s, (2) the now-line (indigo) is real: positioned from the visitor's actual clock, ticks per minute — the honesty device and ambient layer in one, (3) smart-input demo runs inside the real window: text types itself, parse spans highlight (indigo underlines), the task slides onto Thursday — 4s loop, IO-gated, pure CSS/JS on real DOM, (4) hover on any feature card lights the corresponding etched region (indigo wash 200ms), (5) scroll reveals 250ms easeOutQuart, (6) registered @property conic sweep on the CTA border, one pass at load (reference technique 1, matched), (7) progressive blur ladder (4 steps) under the sticky nav. Reduced motion: etch pre-drawn, demo replaced by a static parsed-state frame. No scroll-jack.
- Perf: everything is SVG + real DOM. Zero raster in the fold. This is the cheapest of the three concepts and the safest bet for perf ≥0.95 and the strongest one-brand story.

### Concept 3 — "SETTLE"

- Thesis: chaos becomes a week, on load, in front of you. The hero opens with the visitor's dread state: two dozen task chips scattered across a deep-indigo night void at random rotations (a constellation, Obsidian's atmosphere made of OUR data). Within 1.2 seconds every chip glides into its slot on the real week grid — the entire product pitch (tasks + calendar in one place) performed as one motion, no copy needed. The settled grid IS the interactive real UI. Serif display voice gives it the editorial calm of Midday/Resend: "Everything has a time." Light mode: chips settle onto white paper with penumbra shadows, same choreography (parity D1).
- Palette: night #0B0C10, ink #F7F8F8, muted #8A8F98, chips = the app's real event-chip colors as 24% alpha films with full-alpha 0.5px rims (Resend alpha discipline, keeps the void quiet), indigo #5e6ad2 for the now-line, CTA, and the one chip that settles LAST (the "your next task" chip). Light: paper #FBFBFA, ink #16171D, chips at full luminance, graphite shadows.
- Type: Sentient display (Fontshare flare-serif, 64-72px weight 300-400, -2% tracking — the Domaine/Hedvig serif-over-engineering lane, free) + General Sans body + Spline Sans Mono digits/ticker. (Round-1 recipe A.)
- Signature element: the settle choreography itself — self-demonstrating motion in the Jitter sense, but arguing a calendar: disorder → placed time.
- Hero sketch (mid-animation):
  ```
  +--------------------------------------------------------------+
  | ✳ taskflow                          [Sign in]  [Start free]  |
  |     [call mom]˟                ˟[ship v2]                    |
  |          Everything has a time.        ˟[gym]                |
  |   ˟[taxes]     Serif H1, chips drifting around/behind it     |
  |                [Start planning free]                         |
  |        mono: TUE 20:43 · YOUR WEEK BUILDS IN 1.2s            |
  |   +------------------------------------------------+        |
  |   |        MON    TUE    WED    THU    FRI          |        |
  |   | 09:00        [standup]      ‖now‖               |        |
  |   | 11:00  [taxes→settling...]  ‖    ‖              |        |
  |   | 14:00                [gym→] ‖    ‖   [ship v2→] |        |
  |   +------------------------------------------------+        |
  |          chips arc downward into their real slots            |
  +--------------------------------------------------------------+
  ```
- Motion plan: (1) the settle: ~20 chips, each a real DOM node, transform-only FLIP animation from scattered start positions to grid slots, 900ms, staggered 40ms, cubic-bezier(0.16,1,0.3,1), everything landed by 1.3s (M4 met), (2) the last chip lands with a 2-frame indigo rim flash (the "placed" moment), (3) ambient: settled grid's now-line drifts in real time + one unplaced chip idles in the margin, floating on a 7s loop, waiting (narrative tension), (4) scroll: sections reveal at 250ms easeOutQuart; a mid-page section re-runs a micro-settle for the drag-and-drop feature (IO-gated, once), (5) cursor: hovering a settled chip lifts it 2px and casts a slightly longer shadow (150ms) — the grid is discoverable as real UI, (6) mono facts ticker 45s, (7) progressive blur under nav. Reduced motion: chips render pre-settled, a static "before" strip shows the scattered state as a small inset (all content present, M3). No scroll-jack (M2).
- Perf: chips are styled DOM, no canvas, no video. Slightly heavier JS than concepts 1-2 (a ~2KB vanilla FLIP helper), still trivially under the 100KB budget (P3). The settle must be sampled on mobile early: 20 concurrent transforms is fine, but verify no layout thrash (transform/opacity only).

### Recommendation order

Schematic first (strongest one-brand story with Instrument Panel+, cheapest to hit perf 0.95/a11y 1.0, ownable signature D4), Settle second (best pure design-award swing, motion IS the pitch, slightly more JS risk), Keylight third (most atmospheric and most in the owner-cited register, but its argument depends on executing light physics well in BOTH themes, the highest craft bar).

All three reuse: honesty mono line under the CTA (real local time, real facts), platform/context-aware CTA, two-tempo motion (≤400ms reveals + one ambient loop), closing section that rhymes with the H1, event chips as the only color, 0.5px double-hairline panel material, and full light/dark parity.

---

## Appendix — files and reproduction

- Extraction: `playwright-cli -s=land2 open --browser=chrome`, `resize 1440 900`, `goto <url>`, wait 2.5-3s, `playwright-cli -s=land2 --raw run-code --filename=extract2.js > site-<name>.json`, `screenshot --filename=hero-<name>.png`. Midday dark mode captured by clicking its footer theme toggle before the second screenshot.
- This round's files (all in this directory): `extract2.js`; `site-{midday,obsidian,forward,warp,resend,cursor,clerk}.json`; `hero-midday.png`, `hero-midday-dark.png`, `hero-obsidian.png`, `hero-forward.png`, `hero-warp.png`, `hero-resend.png`, `hero-cursor.png`, `hero-clerk.png`.
- URLs: https://midday.ai · https://obsidian.md · https://forward.framer.ai/ · https://www.warp.dev · https://resend.com · https://cursor.com · https://clerk.com
- Caveats: Midday, Warp, and Cursor have all redesigned toward light/serif since their "dark engineering" reputations formed — the register synthesis (§2) is drawn from what the live sites actually do now, verified 2026-07-01. Forward is a Framer TEMPLATE (title: "Conference & Event Framer Template"), so treat it as a technique library (progressive blur, penumbra shadows, letterboxing), not a brand to emulate. Framer/React runtime sites hide their scroll motion from computed-style dumps; motion notes for Forward beyond the blur ladder are [observed static + Framer-runtime inference].
