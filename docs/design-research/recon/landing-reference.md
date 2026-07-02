# Landing Recon Dossier — beat the Agentic AutoML landing with a Taskflow Calendar landing

Reference to beat: `/home/shree/Documents/courses/spring25-26/CSE449/repo/landing` (Astro 5 + React islands + Tailwind 3).
Target product: `/home/shree/dev/taskflow-calendar` (Vite SPA + Vercel serverless + Neon Postgres, branch `finish-polish-deploy`).
All paths absolute. All facts verified against files on disk 2026-07-01.

---

## PART 1 — Reference landing page, fully decomposed

### 1.1 Page assembly (section order)

`landing/src/pages/index.astro` (29 lines) renders, in order:

| #   | Component                                                   | Hydration                                     | File                                                            |
| --- | ----------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| 0   | `Root.astro` layout (theme bootstrap, meta)                 | static                                        | `src/layouts/Root.astro`                                        |
| 1   | `Nav.astro` — fixed frosted navbar                          | static + tiny inline script                   | `src/components/Nav.astro`                                      |
| 2   | `SkipLink.astro`                                            | static                                        | `src/components/SkipLink.astro`                                 |
| 3   | `Hero.astro` — pill + H1 + subhead + CTA                    | static + inline script                        | `src/components/Hero.astro`                                     |
| 4   | `AppPreviewFrame` — big product video frame                 | `client:load` React                           | `src/components/AppPreviewFrame.tsx`                            |
| 5   | `HowItWorks` — GSAP pinned scrollytelling, 7 phases         | `client:visible` React                        | `src/components/how-it-works/HowItWorks.tsx`                    |
| 6   | `FeaturesSection` — 3 alternating deep-dives                | copy static, visuals `client:only="react"`    | `src/components/FeaturesSection.astro` + `DeepDive.astro`       |
| 7   | `MetaCardRow` — 3 "foundations" cards                       | static + IO script, 1 `client:visible` island | `src/components/MetaCardRow.astro`                              |
| 8   | `IntegrationsMarquee` — logo marquee                        | static (pure CSS animation)                   | `src/components/IntegrationsMarquee.astro` + `MarqueeRow.astro` |
| 9   | `FooterCta` — big closing CTA                               | static                                        | `src/components/FooterCta.astro`                                |
| 10  | `Footer` — columns + giant SVG wordmark with metallic shine | static                                        | `src/components/Footer.astro` (359 lines)                       |

Other pages: `login.astro`, `mock-gmail.astro`, `newtab.astro` (demo scaffolding, not marketing).

### 1.2 Design tokens (`src/styles/theme.css`, 183 lines)

Dark is the DEFAULT theme (`<html class="dark">`, OS preference deliberately ignored; storage key `automl-ui-theme`, pre-hydration inline script in `Root.astro:23-43` to avoid FOUC).

Dark surfaces / text:

- `--bg: #0A0A0B`, `--surface-0: #0F1011`, `--surface-1: #131416`, `--surface-2: #1A1B1D`
- `--text: #F7F8F8`, `--text-muted: #8A8F98`, `--text-dim: #828794`
- `--border: hsl(0 0% 18%)`, `--border-strong: 0 0% 100% / 0.20`
- Nav glass: `rgba(10,10,11,0.80)` + `backdrop-filter: blur(20px)`
- CTA: `linear-gradient(180deg,#F7F8F8 0%,#E6E6E6 100%)` bg, `#0A0A0B` text (inverted button)
- Shimmer peak `#E2E6ED`, selection `rgba(255,255,255,0.18)`

Light: `#FFFFFF / #F7F8F8 / #F0F1F2 / #E8E9EB`; text `#0A0A0B / #4A4E54 / #5A5D64` — muted/dim values explicitly tuned to clear WCAG AA 4.5:1 and **guarded by a unit test** (`src/tests/contrast.test.ts`, referenced at theme.css:87-105).

Motion tokens (theme.css:14-25):

- `--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1)` (the workhorse)
- `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1)`
- `--ease-in-out-quint: cubic-bezier(0.86, 0, 0.07, 1)`, `--ease-in-out-expo: cubic-bezier(1,0,0,1)`
- `--ease-linear-default: cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `--dur-fast: 0.16s`, `--dur-med: 0.35s`, `--dur-slow: 0.60s`

Typography (what's actually used on the marketing shell — the Plus Jakarta Sans / Instrument Serif / Monaspace Neon entries in `tailwind.config.ts:14-18` are for the _embedded frontend components_, not the shell):

- Headings/UI: **Inter Variable** (self-hosted, `@fontsource-variable/inter`), intermediate variable weights `510` and `590`
- Eyebrows/subheads/nav links/mono accents: **Geist Mono Variable** (`@fontsource-variable/geist-mono`)
- H1: `clamp(40px, 6vw, 72px)`, weight 510, `letter-spacing -0.022em`, `line-height 1.06` (Hero.astro:175-182)
- Section H2: `clamp(32px, 3.5vw, 48px)` (DeepDive.module.css:29) / `clamp(28px,3.2vw,40px)` (marquee) / footer CTA `clamp(48px,7vw,72px)`
- Eyebrow pattern: 13px Geist Mono, uppercase, `letter-spacing 0.08em`, `--text-muted` (repeated identically in DeepDive.module.css:19-26, MetaCardRow.astro:165-172, IntegrationsMarquee.astro:84-91, FooterCta.astro:30-37)
- Body: 15–18px, `--text-muted`, line-height 1.55–1.6

Other tokens: border-radius flattened to **8px for every Tailwind size** (tailwind.config.ts:82-92), pills 999px, cards 12px, preview frame 16/17px; borders are `0.8px` hairlines; scrollbars globally hidden (theme.css:169-170); filmic **grain overlay** via inline SVG feTurbulence data-URI (`src/styles/grain.css` — body opacity 0.05, container overlay 0.07/0.10 with `mix-blend-mode: overlay`; disabled in light theme and reduced motion).

Signature copy/visual formula: **every headline is two lines — line 1 `--text` bright, line 2 `--text-muted`** ("Linear cadence", stated in `scenes.ts:2`).

### 1.3 Motion & interaction techniques (complete catalog)

1. **Hero entrance choreography** (Hero.astro): pill fade-in 100ms → conic-gradient **border trace** on pill via registered `@property --pill-sweep <angle>` animating 0→360deg over 1250ms ease-out-expo (lines 131-145) → H1 **deblur** entrance `blur(18px)→0 + translateY(14px) + scale(0.985)`, 780ms ease-out-quart, staggered 300ms/440ms per line (lines 183-205, 241-252) → subhead **word-by-word fade** (JS splits text into spans, 40ms stagger starting 900ms; lines 43-67) → CTA rise at 1600ms.
2. **Metallic shimmer text** on the word "agentically": `background-clip: text` gradient at `background-size: 400% 100%`, sweep-then-hold keyframes so loop restart is invisible (Hero.astro:207-239 — the comment explains the 400% trick).
3. **Auto-scroll hijack**: 3.2s after load, page smooth-scrolls so the pill is hidden and preview fills the fold; bails if user scrolled (Hero.astro:69-89). Opinionated; a con as much as a pro.
4. **Nav brand collapse**: "Agentic AutoML ToolChain" blur-crossfades to "AutoML" at 1.6s with width reserved so nothing shifts (Nav.astro:159-198).
5. **Rotating conic highlight border** on the app preview frame: `@property --border-angle` + conic-gradient + `mask-composite: exclude` 1px ring, 5s linear infinite (AppPreviewFrame.module.css:31-67).
6. **Cursor-proximity glow ring**: `useCursorOutline` hook (src/lib/useCursorOutline.ts) — rAF-throttled document mousemove writes `--outline-x/y/opacity`; listener only attached while element intersects viewport; 220px proximity falloff; CSS does a 24px-thick masked radial ring with `blur(14px)` (`src/styles/cursor-outline.css`, note the `isolation: isolate` trick). Disabled in light theme.
7. **Pinned scrollytelling** (HowItWorks.tsx:95-143): GSAP ScrollTrigger, `end: '+=600%'`, pin + tab list of 7 phase codes, progress bar via `scaleX(progress)`; **GSAP lazy-imported inside the effect** so non-scrollers never download it; ref-compare short-circuit to avoid setState at scroll rate.
8. **IO + WAAPI scroll reveals** everywhere else: IntersectionObserver at threshold 0.15-0.2, `node.animate([{opacity:0, translateY:24px} → visible], 500ms ease-out-quart)`, unobserve after fire (DeepDive.astro:70-108, MetaCardRow.astro:54-92, IntegrationsMarquee.astro:28-66).
9. **CSS marquee**: duplicated logo list, `translate3d(0→-50%)` 95s linear infinite, pause on hover, monochrome via `filter: invert()` variables, brighten per-logo on hover, edge fade gradients (MarqueeRow.astro:33-63).
10. **Giant footer wordmark** with SVG mask-driven metallic shine sweep (Footer.astro:106-164, themed stops at lines 331-334).
11. **Reduced-motion discipline**: single global kill file `src/styles/motion-policy.css` (all durations →0.01ms, marquee frozen at -25%, cursor glow → static border) PLUS per-component fallbacks (Hero.astro:331-356, HowItWorks renders a fully static `<ol>` list, PreviewLoop renders poster `<img>` only). Enforced by Playwright spec `src/tests/reduced-motion.spec.ts`.

### 1.4 Copy strategy

- Hero H1: "The fastest way to build production ML models, / _agentically_." Subhead: **"Upload your data. Describe your goal. Walk away."** — three imperative fragments, then the payoff sentence. (Hero.astro:18-26)
- Numbered mono eyebrows: `01 — CHAT`, `1.0 INGEST`, counter `01 / 07` — systems aesthetic.
- 7 phase headlines all follow bright/muted two-line formula (`how-it-works/scenes.ts:20-70`), e.g. "Train models in parallel. / The champion is chosen for you."
- Deep-dive kbd hints: `⌘K to open chat in any tab`, `Enter to advance`, `shift+enter to run` (FeaturesSection.astro:25-51) — implies product depth.
- Outcome-framed body copy: "You get the winner, not the search." (MetaCardRow.astro:17)
- Closing CTA is a pain-point: "Stop babysitting / your notebooks." (FooterCta.astro:6-9)
- Integration logos are **curation-justified in a code comment** — every logo maps to actual codebase usage (src/lib/integrationLogos.ts:1-14). Discipline worth copying.
- Copy is guarded by tests: `full-page-copy.test.ts`, `deep-dives-copy.test.ts`, `marketing-dom.test.ts`.
- Weak spot: the announcement pill claims "Now supporting GPT 5.4 class reasoning" — an invented model name (Hero.astro:10-11).

### 1.5 Performance posture

- Astro `output: 'static'` (astro.config.mjs:18); all marketing copy is in built HTML (SEO-safe).
- Islands budgeted: `client:load` only for the hero preview; `client:visible` for HowItWorks; `client:only` for deep-dive visuals (they mount REAL frontend app components via `@frontend` alias — astro.config.mjs:7,24 — which is why deps include monaco, recharts, react-router...).
- Self-hosted variable fonts (@fontsource), no Google Fonts request.
- Video strategy (`src/components/previews/PreviewLoop.tsx` + `previewManifest.ts`): webm+mp4 sources, webp poster, `preload="metadata"` explicitly chosen to keep LCP clean (manifest comment lines 32-36), IO-gated playback for phase videos (threshold 0.35), poster overlay until first real frame.
- **Lighthouse CI budget** (`lighthouserc.json`): performance ≥ 0.90 (error), accessibility = 1.0 (error), best-practices ≥ 0.95 (warn), SEO ≥ 0.90 (warn), 3 runs against `astro preview`.
- Test suite: axe a11y (`a11y.spec.ts`), contrast matrix (`contrast.test.ts`), reduced-motion Playwright, hero-motion, preview integration, demo-mode.
- `window.__AGENTIC_DEMO_MODE__ = true` inline flag so embedded app components short-circuit API calls (Root.astro:55-58).

### 1.6 Honest strengths / weaknesses

Strengths: coherent token system used with total discipline; real product UI as the demo (not mockups); serious a11y + reduced-motion engineering, all test-enforced; staged entrance choreography that feels expensive; copy in static HTML; Lighthouse CI in the repo.

Weaknesses (attack surface):

1. **Hero video is 23–25 MB per format** (`public/previews/hero-montage.webm` 25M, `.mp4` 23M — `du` verified). `preload=metadata` protects LCP but scrolling users still stream tens of MB.
2. `client:load` React island in the first fold pulls React 19 runtime immediately; deep-dives drag in heavy app deps (monaco-editor is in package.json).
3. **Auto-scroll hijack at 3.2s** — fights user expectations even with the bail-out.
4. **Light theme is second-class**: grain disabled, cursor glow disabled, glow PNG dark-tuned — the page's personality lives only in dark mode.
5. `twitter:card summary_large_image` declared but **no og:image exists** (Root.astro:50-53) — link unfurls are broken.
6. Invented claim in the pill ("GPT 5.4"); fictional `site: 'https://agentic-automl.dev'`.
7. Global hidden scrollbars (theme.css:169-170) — a11y-questionable on a marketing page.
8. Marquee 95s loop is so slow it reads as static; monochrome logo filter makes brands unrecognizable at a glance.
9. Aesthetic is a straight Linear.app clone — competent but not a distinct identity.

### 1.7 "Clearly stronger" — concrete, measurable criteria

Design

- D1: Dual theme with **full parity** — grain/glow/signature effects must have light-mode equivalents, not `display:none` (reference fails: grain.css:52-57, cursor-outline.css:58-63).
- D2: Token file with ≤ 4 surface steps, 3 text tiers, named easings/durations; zero hard-coded hex in components outside the token file (reference discipline, matched or better).
- D3: Contrast: every fg/bg pair ≥ 4.5:1 in BOTH themes, enforced by a unit test like `contrast.test.ts`.
- D4: An identity that is not a Linear clone — at least one ownable visual signature (e.g. calendar-grid motif, time-based hero) a reviewer can name.

Motion

- M1: ≥ 6 distinct techniques from the catalog above (entrance choreography, one registered-@property gradient animation, scroll reveals, one signature scroll section, one cursor-reactive effect, marquee or equivalent) — all `transform/opacity/filter`-only (compositor-friendly).
- M2: **No scroll hijacking** (beat reference by omission of Hero.astro:69-89 behavior).
- M3: Full `prefers-reduced-motion` fallback: static render path with all content present, verified by an automated test.
- M4: Entrance sequence completes ≤ 1.6s (reference: last element lands at 1600ms+500ms; don't be slower).

Performance (the clearest way to "clearly beat")

- P1: Lighthouse (mobile, throttled): Performance ≥ 0.95 error-level (reference asserts only ≥ 0.90), A11y = 1.0, Best-practices ≥ 0.95, SEO ≥ 0.95. Ship a `lighthouserc.json` equivalent.
- P2: Total above-the-fold media ≤ 500 KB (vs reference's 23 MB montage): use a webp/avif poster + short ≤ 2 MB loop, or a pure-CSS/SVG animated hero.
- P3: JS shipped by the landing route ≤ 100 KB gzip (reference ships React runtime + islands; a static page with vanilla inline scripts wins outright).
- P4: LCP element is static HTML/image, not a hydrated island.

Copy / SEO

- C1: Every claim verifiable in the repo (no "GPT 5.4" moments). Feature claims must map to files (Part 2 below is the source of truth). Do NOT reuse the README's "738 tests" badge without re-running the suites (was false at 2026-06-26 audit; fixed in commit `8673eb4` — verify before use).
- C2: Follow the winning formulas: two-line bright/muted headlines, verb-first imperative subhead, numbered mono eyebrows, real kbd hints (Taskflow genuinely has shortcuts — `src/hooks/useKeyboardShortcuts.ts`).
- C3: Complete OG/Twitter cards **including an actual og:image** (beat reference's missing image), real deployed URL, sitemap + meta description; marketing copy present in static HTML (curl-able).

---

## PART 2 — Taskflow Calendar: every showable capability (landing copy raw material)

Verified on branch `finish-polish-deploy` working tree (recent merges wf-g1…g8 landed real features; git log hashes cited).

### Smart input / NLP (the hero feature)

- **Multi-stage parsing pipeline with conflict resolution**: `src/components/smart-input/parsers/SmartParser.ts` — runs parsers by priority, detects overlapping spans, resolves, generates clean text + overall confidence.
- **Natural-language dates**: `parsers/ChronoDateParser.ts` (chrono-node, `forwardDate: true`, priority 10) — "tomorrow at 3pm", "next Friday", date **ranges** (start+end tags), date-only vs time-certain detection, per-tag confidence, blue `#3b82f6` tag color.
- **Priorities**: `parsers/PriorityParser.ts` (priority 8) — Todoist-style `p1/p2/p3` (conf 0.95), "urgent|critical|asap|emergency" (0.85), "no rush|someday|nice to have" (low), ~12 pattern groups with overlap suppression.
- **Entities + categories**: `parsers/CompromiseNLPParser.ts` (compromise.js, priority 6) — people/places/organizations NER plus 8 semantic category regex sets: work, personal, health, shopping, finance, social, travel, education.
- **Live syntax highlighting** of parsed spans: `src/components/smart-input/components/` — `HighlightedInput.tsx`, `OverlayHighlightedInput.tsx`, `InlineHighlightedInput.tsx`, `ParsedTags.tsx`, `smart-tags.css`; toggle via `SmartParsingToggle.tsx`; hook `hooks/useTextParser.ts`.
- **Voice input** (Web Speech API): `components/VoiceInputButton.tsx`, `VoiceInput.tsx` (react-speech-recognition 4.0), wired at `EnhancedTaskInput.tsx:498`.
- **File-drop inside the input**: `FileUploadZone.tsx`, `FileUploadButton.tsx`, `CompactFilePreview.tsx`.

### Calendar & events

- **FullCalendar 6.1 with 4 views**: `dayGridMonth | timeGridWeek | timeGridDay | listWeek` (`src/components/calendar/CalendarView.tsx:25`, default `timeGridWeek` line 61).
- **Multi-calendar** with color coding + visibility toggles: `CalendarList.tsx`, `useCalendars.ts`, `CreateCalendarDialog.tsx`; per-event color persisted (commit `5dd0298`, #29).
- **Recurring events**: `src/utils/recurrence.ts` (rrule 2.8 — `generateRRule`/`parseRRule`, daily/weekly/monthly/yearly, BYDAY, monthly by-date/by-weekday, COUNT/UNTIL); editor UI `src/components/dialogs/RecurrenceSection.tsx`; **server-side expansion of recurring masters into occurrences** (`aa80d58`, #8); **recurrence exceptions persisted** (`5dd0298`, #29).
- **Conflict detection**: endpoint `api/events/conflicts.ts`, wired into event dialogs (`8b8e89d`, #17/#19).
- **Drag & drop task→calendar scheduling**: react-dnd 16 + @dnd-kit/core 6.3, `src/components/providers/DndProvider.tsx`, FullCalendar interaction plugin.
- Event dialogs: `EventCreationDialog.tsx`, `EventDisplayDialog.tsx`, `EventOverview.tsx`, `ConsolidatedCalendarHeader.tsx`.

### Task management

- **Multi-pane resizable layout**: `src/components/layout/MainLayout.tsx` (lazy LeftPane/RightPane), `TaskFocusLayout.tsx` (CalendarSummaryPane + TaskFocusPane), `ResizableDivider.tsx`, `TaskPaneContainer.tsx` (1–3 panes with independent filtering — README:53).
- **Kanban board** with drag-drop status columns: `src/components/tasks/TaskKanbanBoard.tsx`.
- **Folder-grid view with hover previews** + list view: `TaskFolderGrid.tsx` (auth'd user fix `baabbc6`, #18), `TaskGroupList.tsx` (grouping by task list / due date / priority — `src/utils/dateGrouping.ts`).
- **Task detail sheet** with descriptions persisted end-to-end (`e7b9e8b`, #12): `TaskDetailSheet.tsx`.
- **Tags**: editor dialog + persistence (`252efe6` #20, `cadf296` #30); backend `api/tags/{index,[id],merge,cleanup,stats}.ts` — tag merge & cleanup are demo-able.
- **Task-list archiving** (`ae94981`, #11) and bulk operations (`api/tasks/bulk.ts`).
- **Attachments**: Vercel Blob upload (`api/upload/index.ts`, `api/attachments/*`), **image + PDF preview** (`smart-input/components/previews/PDFPreview.tsx` with pdfjs-dist 5.4, `ImagePreview.tsx`, `AttachmentPreviewDialog.tsx`), blob deletion on task delete (`5f05a95`, #9/#31).
- **Analytics dashboard**: `src/components/dialogs/TaskAnalyticsDialog.tsx` — recharts BarChart (~line 434), AreaChart (~line 473), completion-trend + distribution views incl. in-progress status (`252efe6`, #20); summary card `TaskAnalyticsSummary.tsx`; `api/tasks/stats.ts`, `api/task-lists/stats.ts`, `api/attachments/stats.ts`.
- **Keyboard shortcuts**: `src/hooks/useKeyboardShortcuts.ts` — modifier+`p`, `,` (settings), `/`, `?` (shortcut help), `q`; real kbd-hint material for deep-dive copy.
- **Emoji/icon picker** (emoji-mart, dist chunk `icon-picker` 228 KB), rich-text notes (pell), framer-motion 12 micro-animations, dark/light theme (`src/stores/themeStore.ts`), swipe detection for mobile (`useSwipeDetection.ts`).

### Auth & account

- JWT with access/refresh rotation + Google OAuth: `api/auth/{login,register,refresh,logout,me,google/*}.ts`; login persistence fixed (`ad3019d`, #6/#7).
- **Password reset flow** end-to-end (`0b3a5ea`, #10): pages `src/pages/{ForgotPassword,ResetPassword}.tsx`, `api/auth/{forgot-password,reset-password,change-password}.ts`.
- **RBAC** roles enforced in middleware (`7747e37`, #13, merge wf-g8-rbac).
- **Settings suite** (`e853d36`, #14/#15/#16): Profile, General, Preferences, Security, Calendar, Help (`src/components/settings/`), **data export** (`api/user/export.ts`) and delete-account.

### Backend talking points (credibility copy)

- Composable serverless middleware pipeline: CORS → request-id → rate-limit (read 100/min, write 30/min) → JWT auth → Zod validation (`lib/middleware/`, README:145-169).
- Pure SQL over `pg` (no ORM), 10 strategic indexes, in-memory TTL cache with pattern invalidation (`lib/services/`, `lib/config/`).
- Neon Postgres + Vercel serverless deploy target (memory: project-overview.md); SSL fix `c8878f3`.

### Numbers you may NOT claim without re-verifying

- "738 tests passing" (README badge) — was false at 2026-06-26 audit (111 backend failures); commit `8673eb4` claims the fix. Run `npm run test:all` before using any test count.
- Bundle-size claims in README ("Core ~180KB") — actual `dist/assets` (built 2026-06-26): `index` 233 KB, `calendar` 270 KB, `nlp` 400 KB, `pdf` 389 KB, `emoji` 475 KB, `analytics` 333 KB (pre-gzip, lazy chunks). Fine to say "aggressively code-split (12+ manual chunks — `vite.config.ts:39-112`)"; don't quote the README numbers.

---

## PART 3 — Where the landing page should live (technical placement)

### Current routing / deploy facts

- `src/App.tsx:278-285`: `/` is `ProtectedRoute → MainLayout`; unauthenticated users are redirected to `/login` (`src/components/auth/ProtectedRoute.tsx`, default `redirectTo='/login'`). Catch-all `*` → `Navigate to '/'` (App.tsx:288). **There is no unauthenticated marketing surface at all.**
- Hardcoded root redirects to update if the app moves: `src/components/login-form.tsx:39` (`navigate('/')`), `src/pages/Signup.tsx:64` (`navigate('/')`), `src/components/auth/PublicRoute.tsx` (default `redirectTo='/'`), `src/hooks/useAuthGuard.ts:234` (`useGuestOnly(redirectTo = '/')`). Router is `BrowserRouter` with **no basename** (App.tsx:2-6).
- `vercel.json`: `framework: "vite"`, `outputDirectory: "dist"`, functions `api/**/*.ts` on `@vercel/node@5.3.11`; the ONLY rewrite is the no-op `/api/:path*` passthrough. **No SPA fallback rewrite exists** — deep links like `/login` on a hard refresh depend on Vercel's vite preset behavior; when touching vercel.json, add an explicit fallback and keep `/api` excluded, e.g.:
  ```json
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
  ```
- Local dev: Vite must run on **5180** (`npx vite --port 5180 --strictPort`; 5173/5174 are held by unrelated projects — note `vite.config.ts:117` says `port: 5173, strictPort: true`, so the CLI flag override is mandatory). Dev API = `scripts/dev-server.ts` (Express) on 3001; `/api` proxied there (vite.config.ts:119-125). Postgres via repo `docker-compose.yml`.
- Fonts: the SPA loads Inter from Google Fonts (`index.html:8-10` + `src/index.css:2`) — a landing that self-hosts fonts (like the reference does with @fontsource) immediately beats this.

### Option A — Unauthenticated `/` route inside the SPA

Change `/` to render `<LandingPage>` when unauthenticated (or move the app to `/app` inside the same SPA).

- Pros: zero infra change; can reuse the app's Tailwind v4 tokens/components directly; one deploy.
- Cons — fails the "clearly stronger" perf criteria by construction:
  - LCP gated on React runtime + router + auth-store hydration (233 KB index chunk pre-gzip, plus fonts, plus the auth "Verifying your session..." spinner path in ProtectedRoute.tsx:17-27).
  - Marketing copy is client-rendered → no static HTML for crawlers/unfurlers; OG tags would be static in index.html but body copy isn't.
  - Violates P3/P4 (JS ≤ 100 KB, static LCP) and probably P1 on mobile.
- Verdict: only acceptable as a stopgap. Cannot "clearly beat" an Astro static page on performance.

### Option B — Static landing served by Vercel BEFORE the SPA (same project) — RECOMMENDED

Landing is a prebuilt static `index.html` (+ assets) at the domain root; the SPA moves under `/app`.

- Mechanics: Vercel serves filesystem matches before rewrites. Build the landing (hand-rolled HTML/CSS/vanilla-JS, or a tiny Astro subproject like the reference) into `dist/` root; build the SPA with `base: '/app/'` (vite.config.ts) + `<Router basename="/app">`; `buildCommand` becomes e.g. `npm run build:shared && npm run build:frontend && npm run build:landing` with the landing output copied over/into `dist/`. Rewrites: `/api/:path*` passthrough, `/app/(.*) → /app/index.html`, root stays static.
- Code changes required (small, enumerated above): basename + the 4 hardcoded `'/'` redirect sites + catch-all route.
- Pros: static HTML LCP (P1-P4 achievable), full SEO/OG control, same Vercel project (no new domain/account), landing and app share one deploy pipeline; landing "Get Started" → `/app` (ProtectedRoute then bounces to `/app/login` exactly as today).
- Cons: two build steps; design tokens duplicated between landing CSS and app Tailwind (mitigate: one shared CSS-custom-properties file); router/base change touches auth redirects (test login/signup/Google callback — callback path `/auth/google/callback` at App.tsx:272-275 must move to `/app/auth/google/callback` AND the Google OAuth redirect URI must be updated accordingly).
- Variant B2 (zero router changes): keep SPA at `/` but serve the landing at `/index.html` ONLY for logged-out users — not possible server-side without auth-aware edge logic; skip.

### Option C — Separate project / subdomain

Landing = its own Vercel project (e.g. `taskflow-landing.vercel.app` or `www.` on a custom domain), app stays untouched at its current URL.

- Pros: zero changes to the app (no basename, no redirect edits, no OAuth URI change); landing gets its own Lighthouse budget, its own framework (Astro), independent deploys; cleanest possible perf/SEO.
- Cons: with no custom domain the two live on unrelated `*.vercel.app` URLs (you cannot mint arbitrary subdomains of vercel.app) — the "product site" story is weaker; two projects to manage; CTA is a cross-origin link (fine — auth lives entirely in the app).
- Verdict: best if a custom domain exists or is planned (`taskflow.dev` style: `www` → landing project, `app.` → SPA project). Otherwise B.

### Recommendation

- **No custom domain (current state): Option B.** Static root landing + SPA at `/app` in the one existing Vercel project. It is the only option that hits P1–P4 without new infrastructure. Budget the router/base migration (4 redirect sites + basename + Google OAuth redirect URI) as its own tested change.
- **If a custom domain is on the table: Option C**, and skip the router migration entirely.
- Either way, build the landing itself as static-first (Astro like the reference, or plain HTML + vanilla inline scripts), self-hosted fonts, ≤ 500 KB fold media, copy drawn from Part 2, and ship a Lighthouse CI config asserting the P1 thresholds so "clearly stronger" is mechanically checkable.
