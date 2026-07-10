# Coherence audit — Taskflow landing v2 (2026-07-02)

Rigor pass over the seven section specs (nav, hero, typeit, threeplaces, keys, clock, closing) against
`redesign-v2-direction.md` and `design-brief.md`. Verdict: the page reads as ONE designed system. Accent law,
type roles, stroke grammar, honesty, and copy voice are coherent to a degree that is unusual for seven
independently-written specs. The problems are almost all at the seams the specs could not see: one broken
cross-file string, a shared-helper contract that is left ambiguous, a handful of always-running loops that
animate paint properties instead of opacity, and a few unclaimed foundation requirements. One MUST, ten
SHOULDs, a handful of NICEs. No spec needs a redesign.

Source verification done for this audit (all PASS):

- `src/utils/recurrence.ts` supports daily/weekly/monthly/yearly + INTERVAL + BYDAY + BYSETPOS → Clock's
  `RRULE - WEEKLY - MONTHLY - CUSTOM` and the four chip cadences (weekly, monthly-1st, every-other-day) are honest.
- `src/hooks/useGlobalShortcuts.ts` binds `⌘K, T, D, W, M, L, N`; `src/components/command/actions.ts` exports
  `actionGoToday/NewTask/SetCalendarView/ToggleTheme` → Keys' keys and Cmd+K rows are honest.
- Google Calendar sync ships (`src/hooks/useGoogleSync.ts`, `src/services/api/google.ts`, `GoogleCallback.tsx`)
  → `GOOGLE SYNC` receipt + hero `SYNCS WITH GOOGLE CALENDAR` are honest.
- Parser source confirms location bare-keywords, priority keywords (`asap`/`important`→high, `no rush`→low),
  and category regexes; TypeIt correctly EXCLUDES `standup`/`review` (which are not in the shipped work regex).
- `landing/src/styles/global.css`: all aqua tokens + `--edge-machined` exist; hue tokens present are red→magenta
  (8 of 10; `--hue-slate` and `--hue-brown` absent); `.btn-primary` still carries the neon glow
  (`box-shadow: 0 0 28px …aqua…` at line 264); `.section` has no `scroll-margin-top`.

---

## 1. One system

**Stroke grammar (§2.1): coherent.** Every drawn line is 1–1.5px, `vector-effect: non-scaling-stroke`, colored
`--line-dim` for geometry, full aqua reserved for live moments. Hero fall-paths (1.25/1.5px), TypeIt link (1px),
ThreePlaces hop-paths + bind bracket (1.25/1px), Clock dial (1–1.5px), Receipts glyphs (1.5px), Closing arrival
path + ghost grid (1.5px), nav logo rule/divider (1.2px) all comply.

- NICE: Keys' press-zone bracket ticks use `--hairline-strong`, the only drawn marker not on `--line-dim`.
- NICE: Clock hour-ticks (`--ink-muted`) and hand shaft (`--ink-2`) are deliberately brighter than the ring —
  a legible instrument hierarchy, acceptable.

**Easing vocabulary: coherent, one sanctioned exception.** `--ease-settle` and the brief-sanctioned `--ease-out`
are used everywhere; `linear` is used only where physically correct (pen draw, clock hand, marquee). The dreamtype
ease-out-back `cubic-bezier(0,0,.85,1.25)` appears exactly once — Keys' key-press release — and keys.md correctly
declares it "the one and only use in the whole redesign." No other spec uses a bounce/overshoot curve. Confirmed.

- NICE: Hero's idler drift keyframe is `ease-in-out` (contains ease-in; brief §5 says "No ease-in"). It is the
  shipped behavior, ambient, and IO/reduced-motion gated. Consider a symmetric non-ease-in drift for strict
  compliance, or grandfather it explicitly.

**Container rhythm: mostly coherent.** All content sections use `.container` (1080px / 24px→16px gutter).

- NICE: TypeIt is the only content section that puts copy in a LEFT column beside its demo; Hero, ThreePlaces,
  Keys, Clock all put the heading ABOVE the artifact. Confirm intentional or align TypeIt to copy-above.
- NICE: two-column gaps differ (TypeIt 64px vs Keys 48px) for structurally-similar side-by-side sections.
- NICE: Nav capsule caps at 1220px while content caps at 1080px, so at 1440 the logo's left edge sits ~70px
  left of the H1. Deliberate ("lit object in a quiet room") but verify it reads intentional, not misaligned.

**Surface materials: coherent.** Slab/panels/cards/keycaps/frame all use `--surface-1 + --edge-machined +
--shadow-penumbra` with one identical `--shadow-penumbra` fallback string across all specs. Nav glass capsule is
a deliberate distinct material. ThreePlaces introduces `--edge-machined-bright` (local); see foundation list.

## 2. Accent reconciliation — UNANIMOUS, no outliers

All seven specs independently landed on the SAME treatment: aqua is KEPT (not muted to graphite), full strength,
meaning live/placed only, CTA fill de-glowed, all connective geometry in `--line-dim`, all user data on the
curated hue ladder. There is no outlier to reconcile — the majority choice is the only choice present.

- Live/placed signal consistent everywhere: now-line/now-tick/clock-hand-tip/nav-dot all aqua = "now"; rim flash
  is the shared `.flashable`/`.is-flash` hardcoded to `--aqua` (Hero risk #7 and ThreePlaces risk #7 both guard
  against per-chip flash color); TypeIt chrono span + Keys today-disc + Cmd+K ring all aqua. Confirmed.
- User-hue chips on the curated ladder, 155–205 excluded: TypeIt (red/slate/violet/green/orange/blue),
  ThreePlaces (magenta), Keys (blue/violet/indigo/green/orange, aqua explicitly excluded), Clock
  (orange/violet/green/blue), Closing (violet) — all outside 155–205. `--hue-slate` at hue 210 chroma 0.03 sits
  just outside the band and reads gray, not aqua. Compliant.
- Clock's full-wheel OKLCH bloom sweeps through the 155–205 band (and hue 182) as the hand passes — this is the
  direction's explicitly-sanctioned "one full-color moment," it is a screen-blended light bloom (not a picker
  chip), and reduced-motion rests it on hue 182 deliberately. Sanctioned, not a violation. (Watch only that the
  momentary aqua-hued bloom coincides with the hand tip's own "now" aqua, which it does by construction.)

This dimension is the strongest part of the page's coherence.

## 3. Mono-numeral law and type roles — coherent

Every numeral (times, counts, durations, shortcuts) is Spline Sans Mono across all sections; TypeIt and the
Clock even call out the offer-string/meta-line traps explicitly. Serif (Sentient) never renders a digit, never
below 16px, never on interactive chrome — the one apparent exception, the nav wordmark, is vectorized Sentient
artwork the direction §4.0 explicitly authorizes for the logo (a logo is an identity mark, not a text label).
Non-numeric chip labels (WORK, DIEGO) correctly use Inter, not mono. No findings.

## 4. Ambient budget

Every always-running loop, in narrative order:

| #   | Section                         | Loop                                              | Period   | Off-screen          | Reduced motion   |
| --- | ------------------------------- | ------------------------------------------------- | -------- | ------------------- | ---------------- |
| —   | Nav (fixed, always in viewport) | **none** (clock dot static, digits tick once/min) | —        | —                   | —                |
| 1   | Hero                            | idler drift                                       | 7s       | IO-paused           | killed           |
| —   | ThreePlaces                     | none (one-shot relay, replay-on-reentry)          | —        | —                   | static end state |
| 2   | TypeIt                          | persona type→parse loop                           | ~42s lap | IO clears timers    | static persona 1 |
| 3   | Keys                            | rail drift + yoked press/FLIP                     | 24.5s    | IO + hover pause    | static row       |
| 4   | Clock                           | rAF hue/angle sweep + relights                    | 24s      | rAF fully cancelled | never starts     |
| 5   | Receipts                        | icon marquee                                      | 50s      | IO paused           | animation:none   |
| —   | Closing                         | none (one-shot arrival, no replay)                | —        | —                   | static settled   |

Within any single section's own viewport there is exactly ONE ambient loop (compliant). The Nav being
`position:fixed` and carrying ZERO loops is load-bearing: because it shares the viewport with every section, any
loop in the nav would break the budget for the whole page. nav.md's static-everything decision is correct and
should not be "livened up" later.

- SHOULD (adjacency): the loop-bearing sections Keys(3)→Clock(4)→Receipts(5) are consecutive, so at tall
  viewports a section boundary can put two loops partially on screen at once (Keys+Clock, or Clock+Receipts),
  violating "max one visible per viewport." Clock's ambient IO uses `threshold:0` (any intersection), the most
  aggressive. Fix: raise Clock's ambient threshold to ~0.4 (start only when the dial is the dominant element),
  and verify Keys↔Clock and Clock↔Receipts at 1440×1080 during the integration scroll test.

Nothing needs cutting; the counts are right, the seam needs a threshold and a test.

## 5. Motion budget

- Entrance ≤1.6s: Hero live chip lands ~1.24s; Clock entrance ≤1.3s; Closing arrival ~1.5s; nav instant; the
  `[data-reveal]` copy/panel reveals are 500–900ms everywhere. TypeIt/ThreePlaces/Keys run multi-second
  _performed demos_ (not entrances) that the owner's §4.2/§4.3/§4.4 direction explicitly asks to slow down —
  exempt from the entrance cap, consistent with TypeIt's ~42s loop not counting as an "entrance."
- Combined JS from spec estimates: nav 1.5 + hero 4.4 + typeit 4.4 + threeplaces 3.5 + keys 2.0 + clock 2.2 +
  closing-suite 2.4 + motion.js ≤6 ≈ **~26KB min** (≈28KB with the existing hero script). Well under 40KB. Sane.
- No scroll-jack anywhere: the §2.3 scroll-progress driver writes a custom property passively/rAF-throttled and
  never hijacks scroll; no section pins the viewport or intercepts the wheel; Hero drag sets `touch-action:none`
  only on the one dragged element during an active drag. Clean.
- Compositor-only (transform/opacity/clip-path, filter for blur only — brief §5 / direction §1):
  - SHOULD: **continuous loops that animate paint properties.** Clock chip relight and Keys keycap-press/chip
    transition `background` (color-mix film) AND `box-shadow`, and both ride always-running loops (Clock relights
    4×/rev forever; Keys presses 7×/lap forever). TypeIt already solved exactly this the compositor-clean way:
    a pre-rendered resting film with an opacity-faded overlay layer (`.ti-chip__flash`, `.ti-run__lit`). Unify on
    that technique — pre-render the lit/pressed face and crossfade it via opacity — so the always-running loops
    stay transform/opacity-only. This is both a perf fix and a one-system fix (three sections currently do the
    same effect three different ways).
  - SHOULD: **one-shot box-shadow transitions.** Nav `.is-scrolled` transitions `box-shadow`; ThreePlaces
    `.tp-surface.is-active` transitions `box-shadow`. Lower impact (one-shot, not looping) but same rule. Prefer
    a pre-rendered penumbra/bright-edge pseudo-element crossfaded via opacity. (The app brief itself animates
    box-shadow on hover, so this is a quality/consistency fix, not an owner-MUST violation.)
  - SHOULD: **Closing now-tick animates `left: 0%→100%`** — a layout property. Sweep it with
    `transform: translateX()` instead (the spec text says "translates" but names `left`; make it a transform).
  - Filters: all `filter:blur`/`backdrop-filter`/`drop-shadow` uses are STATIC (Clock bloom, nav/Keys glass,
    Clock hand-tip glow) — allowed. NICE: Clock hand-tip `drop-shadow(0 0 6px aqua)` at full strength is a touch
    brighter than the app now-line's sanctioned `0 0 8px @25%`; acceptable as the "now" dot but note it.

## 6. Honesty

Foundations verified above (recurrence, shortcuts, actions, Google sync, parser capabilities) — all honest.

- SHOULD: **TypeIt persona 1 (`library`) and persona 3 (`dentist`→personal) are not verified against the live
  parser.** `library` is NOT in the bare-keyword location list — it relies on compromise NER firing on "at the
  library" (the direction lists it as an example, but the spec itself flags it as unproven). And the "personal
  beats health" tie the spec attributes to `CompromiseNLPParser.test.ts` is actually asserted there for
  `"doctor appointment"` (personal wins by MATCH COUNT, two hits), not for the bare word `dentist` (one hit each,
  a different tiebreak path). Neither is dishonest by construction, but both are unproven. Run all six sentences
  through `SmartParser.testParse()` before wiring (typeit.md risk #3 already requires this); if any output
  differs, adjust wording minimally (flag for copy approval) rather than inventing a tag to match the spec.

Everything else — hero honesty line, receipts' ten facts, Keys' `5 TASKS` count and real week dates, Clock's
cadences, the fictional-but-labeled demo tasks (hero precedent) — is honest.

## 7. Foundation contract

See the unified list in section 10. Conflicts/gaps surfaced:

- MUST: **sessionStorage key mismatch** (Hero writes `tf-idler-placed`, Closing reads `tf_idler_placed`).
- SHOULD: **`onVisible` once:false contract is ambiguous** and five sections depend on it (see 10).
- SHOULD: **`--line-live` has no defined value** though Hero consumes it (see 10).
- SHOULD: **`scroll-margin-top` for `#type-it`/`#keys`** requested by nav, claimed by nobody (see 10).
- SHOULD: **de-glow `.btn-primary`** — glow confirmed present; Hero and Closing depend on its removal.
- NICE: **two specced foundation mechanisms have zero consumers** — the §2.3 scroll-progress driver
  (`registerProgress`/`--progress`) and the §2.5 blur-focus reveal (`[data-reveal="focus"]`). No section reads
  either. Drop them from the foundation build or assign a consumer.
- NICE: `--edge-machined-bright` (ThreePlaces) and the `drawPath` undraw sub-timing need decisions (see 10).

## 8. Copy

All new prose is correctly flagged propose-then-approve (personas, Clock h2/body, settled headline, sr-only
lines) per project rule. Voice scan:

- SHOULD: **ThreePlaces bind-label latent em dash.** The first code block (line ~153) renders
  `SAME OBJECT &mdash; SAME TIME`; the spec catches this one line later and the DOM tree (line ~245) uses the
  correct spaced hyphen `SAME OBJECT - SAME TIME`. A careless implementer copying the first block ships the em
  dash. Ship the hyphen; delete the `&mdash;` from the spec.
- No semicolons, no "not X but Y", no promotional adjectives in any shipped or proposed copy. The six persona
  strings are realistic user input (commas only). Clock's proposed body diverges slightly from the direction's
  §4.5 proposal wording; both are owner proposals, not a conflict.

## 9. Coverage — every owner MUST §4.0–4.8

Nav, Hero, TypeIt, ThreePlaces, Keys, Clock, Receipts, Closing, Footer: every enumerated owner MUST is addressed
(verified item by item — nav logo-not-a-button, hero smooth+paths+idler+drag, typeit loop+personas+parser-truth,
threeplaces legibility+endstate, keys cycling-rail+real-keycaps+app-response+FLIP-morph+real-shortcuts, clock
no-white+hue-sweep+real-copy, receipts icons-not-text, closing de-glow+more-animation, footer glyph). No
requirement is silently dropped EXCEPT via two cross-section execution gaps already listed:

- MUST: the idler→closing payoff (§4.1/§4.7) is fully specced on both sides but the sessionStorage key names
  don't match, so it silently never fires.
- SHOULD: the nav-anchor clearance (§4.0) needs `scroll-margin-top` on `#type-it`/`#keys`, unclaimed by either.

---

## 10. Unified foundation list (what the foundation agent should build)

Ownership per direction §5: foundation = `global.css` + `Layout.astro` + `motion.js` + `index.astro`.

### `global.css` — tokens and utilities

1. `--shadow-penumbra` = `0 0.6px 1.6px -1.5px rgb(0 0 0/.5), 0 2.3px 6px -3px rgb(0 0 0/.4), 0 10px 26px -4.5px rgb(0 0 0/.28)` (§2.2). Consumers: nav, hero, keys, clock, threeplaces, closing.
2. `--line-dim` = `color-mix(in oklab, oklch(0.80 0.09 190) 30%, transparent)` (§2.1). Consumers: all but keys' bracket. Confirmed absent today.
3. `--line-live` — **value undefined by any spec; foundation must set it.** Hero uses it for the live chip's fall-path at 1.5px. Per direction §4.1 ("the aqua chip's path may be `--aqua-rim`"), set `--line-live: var(--aqua-rim)` (or a brighter `color-mix(in oklab, var(--aqua) 60%, transparent)`). Decide and document.
4. `--hue-slate: oklch(0.64 0.03 210)` — TypeIt priority-low chip. Confirmed absent (global.css has red→magenta only). Add `--hue-brown: oklch(0.56 0.07 60)` too for ladder completeness (no current consumer).
5. De-glow `.btn-primary`: remove `box-shadow: 0 0 28px …aqua…` (confirmed at line 264), replace with `var(--edge-machined), var(--shadow-penumbra)` (§2.7). Hero and Closing depend on this; nav overrides locally as a safety net.
6. `scroll-margin-top: 96px` on `.section` (or specifically `#type-it`, `#keys`) — clears the fixed nav capsule (16 + 60 + clearance) for anchor jumps. Requested by nav, owned by nobody; put it in the foundation.
7. Edge-mask utility for horizontal rails: `mask-image: linear-gradient(to right, transparent, black 64px, black calc(100% - 64px), transparent)` (§2.4). Consumers: Keys rail, Receipts band. Both currently inline it; consolidate to one class.
8. `--edge-machined-bright` (ThreePlaces): `inset 0 0.5px 0 rgb(246 248 248/.16), 0 0 0 0.5px rgb(0 0 0/.5)`. Currently ThreePlaces-only. Keep local unless another section adopts the brighten-on-active pattern (Keys uses opacity, not this) — no promotion needed now.
9. Reduced-motion block: keep the existing `@media (prefers-reduced-motion: reduce)` `0.01ms` rule intact (nav, threeplaces, closing all rely on it). Note that it does NOT reach WAAPI or rAF — those paths self-guard via `TF.reducedMotion`.
10. DROP (no consumer): the blur-focus reveal utility `[data-reveal="focus"]` (§2.5) — no spec uses it. Either drop or assign to one hero-tier text moment.

### `motion.js` (`window.TF`) — target ≤6KB min

11. `TF.reducedMotion` (boolean). Consumers: hero, typeit, keys, clock, threeplaces, closing. Single source of truth for the JS-side reduced-motion guard.
12. `TF.onVisible(el, cb, {once, threshold})` — **nail the once:false contract.** Five consumers need enter AND exit (hero idler pause/resume, typeit `{once:false, threshold:0.3}`, keys pause/resume, clock ambient `{once:false, threshold:0}`, threeplaces replay-on-reentry). For `once:false`, invoke `cb` with a visibility boolean (or expose `{onEnter, onExit}`) on BOTH crossings. If left one-shot, four sections will each reimplement IO (fragmentation + budget blowout). Also expose `{once:true}` for closing arrival, receipts per-item draw-in, clock entrance.
13. `TF.drawPath(pathEl, {delay, duration, undraw})` — support an initial draw (dashoffset L→0) AND an independent undraw phase (dashoffset 0→−L) with its own `{delay, duration}`. ThreePlaces explicitly requires the undraw sub-timing; Closing needs draw+undraw; TypeIt needs a draw-then-opacity-fade variant (local fallback acceptable if the helper only does dashoffset). Hero does NOT consume this (builds its own) — don't treat hero as a required consumer.
14. `TF.flipBetween(el, fromRect, toRect, opts)` — one consumer (Keys chip FLIP). Hero explicitly does NOT use it. Build it lean.
15. `TF.ticker` shared rAF — one continuous rAF for the page. Consumer: Clock (registers its hue/angle write). If §2.3's scroll-progress driver is kept it also rides this ticker.
16. DROP or assign (no consumer): `registerProgress(el)` / `--progress` scroll-progress driver (§2.3). No spec reads `--progress`. The direction intended "syrupy section reveals" — either have one section adopt it or cut it from the build.

### `Layout.astro`

17. Load `motion.js` deferred; keep font preloads (sentient-300, inter-400, spline-mono-400), skip-link, `html.js` gate.

### Cross-file string contracts (not a file, but foundation must arbitrate)

18. **sessionStorage key: standardize on `tf-idler-placed`** (Hero declares itself authoritative). Fix Closing's read from `tf_idler_placed` to `tf-idler-placed`. Value `"1"` already matches on both sides.
19. Nav clock string format and hero honesty-clock string format must match (`THU 17:42`, weekday caps + 24h). Expose one formatter via `window.TF` and have both read it (nav.md already anticipates this).
