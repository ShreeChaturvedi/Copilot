# Landing-page design research dossier — Taskflow Calendar

Recon date: 2026-07-01. All fonts/colors below were extracted live from computed styles and @font-face rules via playwright-cli (script: `/tmp/claude-1000/-home-shree-dev-taskflow-calendar/2cdfd83b-7236-42de-8c5d-8820fdc28e12/scratchpad/recon/extract.js`). Raw per-site JSON dumps and full-viewport hero screenshots (1440x900) sit next to this file as `site-<name>.json` and `hero-<name>.png`. Motion notes marked [observed] were seen in screenshots/snapshots; notes marked [reputation] are from general knowledge of these well-documented sites and should be spot-checked before citing in copy.

## Context this research serves

- Product: Taskflow Calendar — a Vite + Vercel-serverless + Neon Postgres calendar/tasks app. The live app UI (see `/home/shree/dev/taskflow-calendar/loggedin-calendar.png`) is a clean, light, Google-Calendar-style week grid: white background, gray hairlines (Tailwind gray ramp, `tailwind.config.js` defines gray 50 #f9fafb → 950 #0a0a0a, darkMode: 'class'), a soft green "today" column highlight, blue action buttons, left sidebar with Add Task + Upcoming Tasks. No custom fontFamily is configured — the app currently renders in the Tailwind default system stack. Existing app animation tokens: fade-in 0.2s ease-in-out, slide-in 0.3s ease-out (`tailwind.config.js` under `animation`).
- Goal: a landing page that clearly beats "a strong Astro-built reference." NOTE: no Astro project, `*.astro` file, or landing/marketing directory exists anywhere in `/home/shree/dev/taskflow-calendar` (checked 2026-07-01: `grep -ril astro` over json/md/ts/tsx and `find -iname "*landing*" -o -iname "*marketing*"` both return nothing outside node_modules). The parent workflow must supply the reference's URL or path; until then, treat the cross-cutting bar in section 3 as the thing to beat.

---

## 1. Site-by-site teardowns

### 1.1 Linear — linear.app (dark, systems-tool canon)

- Hero thesis [observed]: dark viewport, big left-aligned two-line headline "The product development system for teams and agents" with one quiet subhead ("Purpose-built for planning and building products. Designed for the AI era."), a right-aligned "New · Coding Sessions →" liveness link, and below it a full-bleed screenshot of the actual app in dark theme — an issue view with an embedded AI-agent session panel (model tag "Opus 4.8" visible). The product IS the hero art; marketing page and app are visually indistinguishable.
- Fonts (verified): "Inter Variable" for everything; mono is "Berkeley Mono" (commercial, Berkeley Graphics). H1: 64px / weight 510 (variable-axis, not 500) / letter-spacing -1.408px / line-height 64px (1.0).
- Palette (verified): bg #08090A (meta theme-color #08090a), text #F7F8F8. Near-black with a blue-gray hue, never #000.
- Motion [reputation]: restrained scroll-reveal fades/translates (~200-400ms ease-out), no scrolljacking; product screenshots swap/parallax subtly. The restraint is the brand.
- Section order (verified h2 sequence): "A new species of product tool…" → "Make product operations self-driving" → "Define the product direction" → "Move work forward across teams and agents" → "Review PRs and agent output" → "Understand progress at scale" → "Changelog" → closing "Built for the future. Available today."
- CTA strategy: one persistent white "Sign up" pill in nav + closing section. No mid-scroll CTA spam.
- Signature element: weight-510 Inter at line-height 1.0 + dark product screenshot as hero art. Copy voice: declarative systems-speak.

### 1.2 Amie — amie.so (light, playful; NOTE: pivoted to "AI Note Taker")

- Hero thesis [observed]: white page, giant left headline "AI Note Taker" followed by "without a bot" set in orange text on a marker-yellow highlight sweep — the differentiator literally highlighted. Blue iOS-style pill "Get started" + white "Request a demo" (mic icon). A dated changelog line ("Feb 16: private meeting notes, apple reminders sync, audio improvements") sits above a full real-product embed screenshot.
- Fonts (verified @font-face): Inter (var) body; Averia Serif Libre (Google Fonts — soft, fuzzy-edged serif) loaded as the accent face.
- Palette (verified root vars): bg #FAFAFA, --foreground #262626, --color-amie-pink #F6A6A6; hero highlight = warm yellow block + orange text.
- Motion [reputation]: Amie's calendar-era landing was famous for draggable live calendar events with spring physics; current page is calmer — hover springs and product video.
- Section order (verified): "How it works" → Start recording → Get organized → Automate your workflows → referral FAQ.
- CTA strategy: "Get started" repeated; demo as secondary. Changelog date in hero = actively-developed signal.
- Signature element: the marker-highlight on the differentiator phrase; Apple-grade softness (large radii, pill buttons).
- Strategic note: Amie moved off "joyful calendar" positioning entirely — the calendar-app graveyard is real (see Rise, 1.9).

### 1.3 Arc / Dia — arc.net (playful editorial, browser)

- Hero thesis [observed]: the whole viewport is framed in blurple #3139FB (verified theme-color rgba(49,57,251,1)) with scalloped postage-stamp edges; inside, a pastel aurora-gradient card holds a serif headline "Meet Dia, the next evolution of Arc" (EB Garamond is in the loaded face list; headline renders serif), a dark pill CTA "Try Dia →" with the app icon, and a product screenshot. Scrolling reveals a giant testimonial set as the page's actual h1: "Arc is the Chrome replacement I've been waiting for." in Marlin Soft SQ.
- Fonts (verified @font-face list — unusually rich): Marlin, Marlin Soft Basic, Marlin Soft SQ (custom soft-rounded sans), Sohne Breit + Sohne Breit Extrafett, EB Garamond, ABC Favorit Mono, ABC Oracle, Exposure VAR, Space Mono, Inter. H1 metrics: 700 weight, -1.6px tracking.
- Palette (verified): body bg cream #FFFCEC, blurple #3139FB, black text, pink/peach/sky aurora gradients.
- Motion [observed static + reputation]: gradient hue drift, quote carousel; bouncy, toy-like.
- CTA strategy: platform-specific "Download Arc for Mac / Windows" — zero ambiguity about what happens on click.
- Signature element: scalloped blurple frame + testimonial-as-hero (social proof promoted to headline).

### 1.4 Raycast — raycast.com (dark, launcher/productivity canon)

- Hero thesis [observed]: near-black viewport filled with diagonal red/coral aurora light streaks (grainy, cinematic); centered H1 "Your shortcut to everything." + two-line subhead; two download pills (Mac primary, "Windows (beta)" secondary); beneath them a monospace metadata line: "v1.104.20 | macOS 13+ | Install via homebrew". Floating rounded-rect nav bar.
- Fonts (verified): Inter everywhere (H1 64px/600/normal tracking/1.1); JetBrains Mono is --monospace-font; GeistMono also loaded.
- Palette (verified root vars): grey ramp --grey-50 #E6E6E6 → --grey-900 #07080A (body bg); accents --blue-dark #56C2FF, red rgba(255,99,99,1), yellow hsl(43,100%,60%); bg layers rgb(16,17,17) / rgb(24,25,26).
- Motion [reputation]: scroll-triggered reveals per section, inline animated launcher demos, hover glow on keyboard-key components.
- Section order (verified h2s — note the aphorism voice): "Take shortcuts, not detours." → "It's not about saving time." → "There's an extension for that." → "Your Mac just got smarter." → "Built for professionals like you." → "Don't repeat yourself." → "Stay in the loop." → closing "Take the short way."
- CTA strategy: Download persistent in nav; closing echo CTA. The mono version line is a credibility device worth stealing.
- Signature element: aurora-ray artwork + the launcher window rendered center-stage; h2s that are all short imperatives.

### 1.5 Reflect — reflect.app (dark, note-taking; nearest aesthetic cousin to a "thinking tools" calendar)

- Hero thesis [observed]: deep-space background; announcement pill "✨ New: Our AI integration just landed"; centered H1 "Think better with Reflect" (AeonikPro 72px/500/1.11); subhead "Never miss a note, idea or connection."; behind and below, glowing constellation arcs and their signature luminous orb, then a dark product screenshot that includes a calendar month panel.
- Fonts (verified): AeonikPro display (commercial), "Inter V" body.
- Palette (verified): body bg rgb(3,0,20) = #030014 (violet-black), white text, purple/violet glows. (The #007AFF found in root vars is a Swiper library default — not brand.)
- Motion [reputation]: slow ambient orb pulse (multi-second loops), parallax starfield, scroll reveals; video walkthrough with play button [observed].
- Section order (verified): Notes with an AI assistant → Give your brain superpowers → Never lose information → Hardened security → Get more out of your meetings → Use Reflect with other apps → "Loved by thinkers" (testimonial wall) → indie-team section → academy → closing repeats the hero H1 verbatim.
- CTA strategy: "Start free trial" gradient-bordered in nav; "Start your 14-day trial" mid-page; pricing framed as "one plan one price."
- Signature element: the orb. Every screenshot of this site is recognizable from it alone.

### 1.6 Vercel — vercel.com (light, engineering-monochrome canon)

- Hero thesis [observed]: #FAFAFA viewport on a strict grid: left, "Agentic Infrastructure" in Geist 64px weight 400 with aggressive -3.84px tracking; center, the black triangle logomark under a soft light-beam glow; right, a Geist Mono uppercase ledger: "FOR CODING AGENTS / TO SHIP APPS AND AGENTS / AUTOMATED BY AGENTS"; CTAs "Deploy Now" (solid black) + "Talk to Sales" (outline); customer logo bar across the bottom (Blackbox.ai, Charles Schwab, DoorDash, OpenAI, Supreme, Weather Co, Polymarket).
- Fonts (verified): GeistSans + Geist Mono, plus a preloaded GeistPixel display family (Circle/Grid/Line/Square/Triangle variants) used as accent display type in the 2026 refresh. Roboto Mono also in faces.
- Palette (verified): bg #FAFAFA, text #171717, black CTAs. Disciplined monochrome; color only in customer logos/product shots.
- Motion [reputation]: minimal; glow/beam on the triangle, grid-line draws, no scroll theatrics.
- Section order (verified h2s): "Build agents on infrastructure that thinks like them" → "Ship apps that scale from zero to millions instantly" → product/tooling sections.
- CTA strategy: dual-track "Deploy Now" (self-serve) vs "Talk to Sales" (enterprise) — clean intent split.
- Signature element: mono-uppercase annotations as a layout material (engineering-drawing aesthetic); the triangle as a light source.

### 1.7 Family — family.co (light, character-driven; crypto wallet but THE reference for scroll choreography)

- Hero thesis [observed]: white; centered "Your favorite crypto wallet." in the custom Family typeface (68px/500/-1.36px/1.1); subhead; pills "Download on iOS" (black, Apple mark) + "Watch the Video"; flanked by two clusters of hand-drawn characters and objects (blue cloud creature, hearts, coins, gears, cat sticker) that float with idle animation.
- Fonts (verified preloads): Family (custom, Regular/Medium/SemiBold), LFE Sans (Regular→Bold), Inter fallback body.
- Palette (verified root vars — warm and toy-like): --app-green #34C759, --app-blue #018DFF, --app-pink #F966AC, --graphic-gold #F5B442, --graphic-orange #FF5310, --graphic-stone #F2EBE0, --graphic-yellow-pale #F6F4EF, --graphic-gray #E2D6C5 (warm), --heading #343433, --body #494440, --body-muted #848281.
- Motion [reputation — Family's site is a canonical scroll-choreography example]: scroll-linked phone/device sequences, per-card "Watch the demo" inline videos [observed in buttons], idle float loops in hero.
- Section order (verified): "Explore Ethereum in a whole new way." → three demo cards (each with Watch the demo) → FAQ → closing "Download for iOS".
- CTA strategy: single platform CTA repeated; "Get Started" black pill in nav.
- Signature element: the character illustration system — instantly ownable, impossible to template.

### 1.8 Notion Calendar — notion.com/product/calendar (light; the direct competitor page)

- Hero thesis [observed]: white; centered app icon + "Notion Calendar" label; H1 "It's time." (NotionInter 64px/700/-2.125px/1.0 — a two-word pun doing all the work); subhead "All of your commitments, now in one place. Meet the beautifully designed, fully integrated calendar for your work and life."; black "Get Notion Calendar free" + outline "Download for macOS"; pastel doodle-icon cards (laptop, basketball, anchor-cat, checklist, bike, mug) scattered at the viewport edges; below, MacBook + iPhone frames showing a colorful week view with a video play button.
- Fonts (verified): NotionInter (custom Inter build, Regular→Bold preloads); Lyon Text (editorial serif) and iA Writer Mono also in the face list (used elsewhere on notion.com).
- Palette (verified): pure white bg, text rgba(0,0,0,0.95), grays #F9F9F8/#F6F5F4; color arrives only via product-shot event chips (peach/blue/lavender/mint) and doodle cards.
- Motion [observed static]: mostly still; video demo carries the motion. Hover pops on doodles [reputation].
- Section order (verified h2s — benefit-led, work/life framing): "Time management, simplified." → "See your schedule at a glance" → "Built-in scheduling" → "Work across time zones" → "Modern design" → "Available in 12 languages" → "Fully integrated with your Notion workspace." → "Manage your time and work, together." → "Connect and create Notion docs" → "Update project timelines" → "Work and life, playing nice." → "See all your commitments in the same place" → "Connect multiple calendars" → "No more double bookings" → "Easy-to-use mobile app" → "Designed to work with your favorite tools." (Notion, Google Calendar, Google Meet, Zoom, Apple Calendar, other providers) → Desktop App / Mobile App downloads.
- CTA strategy: "Get Notion Calendar free" — free-first, repeated; platform downloads secondary.
- Signature element: "It's time." — the shortest possible calendar pitch. Product screenshot = proof of "beautifully designed."
- Beat-this note: this page is competent but conservative (centered symmetric hero, mostly static). A distinctive signature + real motion clears it.

### 1.9 Rise — risecalendar.com (DEAD — cautionary tale, not a design reference)

- Verified 2026-07-01: the site is a farewell letter. H2 "Sunsetting Rise", announcement dated January 27th, 2025; product ran until March 31st, 2025. Page title still reads "Rise — Projects, tasks, time. Together." Body font Inter, white bg, text #1E2A29.
- Their own post-mortem headings (verified): "Building a calendar that helps have more time for important things" → "being the destination calendar" → "Iterating on Flexible events" → "2024: launching Projects" → "Fundraising while being in the 'death zone'" → "Why didn't you just charge for Rise?" → "The future of tools for work".
- Lesson for Taskflow positioning: standalone "beautiful calendar" is a graveyard category (Rise dead, Amie pivoted to AI notes, Cron survived only by becoming Notion Calendar). The landing should sell an outcome (tasks + time in one place), not calendar beauty.
- The pre-shutdown design is archived at https://web.archive.org/web/20240715000000/https://www.risecalendar.com/ (redirects to nearest snapshot) — not fetched during this recon because the tool-safety classifier was temporarily down at the end of the session; fetch it there if the old Rise design is needed.

### 1.10 Daylight — daylightcomputer.com (Awwwards showcase: awwwards.com/sites/daylight; ecomdesignawards.com winner)

- Hero thesis [observed]: full-bleed photograph — the DC-1 tablet lying on sunlit grass with real leaf shadows; serif overlay headline "The computer, de-invented" top-left; sub "Meet DC-1. A new kind of computer, designed for deep focus and wellbeing."; uppercase amber ORDER NOW buttons; video thumbnail bottom-left; newsletter card bottom-right; film-grain texture over everything.
- Fonts (verified via next/font internals): ABC Arizona Flare (flare serif, H1 60px / weight 300 / -4.2px / 1.0), ABC Room + ABC Room Extended (sans body/labels).
- Palette (verified): theme-color #FAF5F2 (warm paper), ink rgb(23,25,15) = #17190F (green-black), saturated amber CTA (in the --graphic family, ~#F5B442–#FFA620 range on screen — sampled from screenshot, not a published token).
- Motion [reputation, widely documented]: scroll-linked light-temperature shift (page warms from daylight to amber "blue-light-free" mode as you scroll) — motion that IS the product argument.
- Section order (verified): "A distraction-free space for learning & creativity" → "With all the apps you need" → "it's a computer you can use outside" → "Dive deeper into Daylight" → "What people are saying" → "Daylight is a Public Benefit Co."
- CTA strategy: e-commerce ORDER NOW in caps, plus stock/shipping line ("IN STOCK · SHIPS IN 3-5 BUSINESS DAYS") — urgency through logistics facts.
- Signature element: sunlight as design system. Photography + grain + amber = zero-template look.

### 1.11 Mintlify — mintlify.com (dev-tool; featured on recent.design, the successor feed to godly.website, week of 2026-07-01)

- Hero thesis [observed]: white; left column: live stat pill "Agent traffic 60.3325%" (ticking decimal), serif H1 "The knowledge infrastructure agents build on" (arizonaFlare 50px/400/-2px/1.04), subhead with bolded audience nouns, black "Get started →" + "Sign up with Google"; right half: an embedded, functional-looking docs product UI; background: fine green wireframe mesh curves sweeping through the corner.
- Fonts (verified): ABC Arizona Flare display serif (same face as Daylight — this serif-over-engineering look is a 2025-26 wave), Inter body, Paper Mono + Geist Mono for code/labels.
- Palette (verified): white bg (lab(100 0 0)), black text, mint/emerald green mesh + logo accents.
- Section order (verified): logo wall ("Join 20,000+ of the world's most ambitious companies…") → "One platform for your entire knowledge stack" → enterprise scale section → YC/startups section → case studies (Anthropic, Coinbase, HubSpot, AT&T) → "Trusted by teams building for agents." → Latest updates → closing echo of the H1.
- CTA strategy: "Get started" + Google OAuth one-click — minimum-friction dev signup; "Contact sales" in nav for the enterprise track.
- Signature element: live ticking stat in the hero pill + serif display over engineering mesh.

### 1.12 Jitter — jitter.video (Awwwards SOTD: awwwards.com/sites/jitter; Product Hunt Design Tool of the Year 2024)

- Hero thesis [observed]: pure typographic statement on white — announcement pill "Jitter AI: Build your own creative tools · Learn more", then "Design in motion. Now with AI." in TWK Lausanne 80px/800/-2.4px/0.9, one lilac pill CTA "Try Jitter for free", logo bar (Huge, Spotify, AKQA, Linktree, 27b, Ogilvy). Nothing else. Below the fold, template cards that auto-play motion.
- Fonts (verified): TWK Lausanne display (commercial), Inter body, Euclid Circular B in faces.
- Palette (verified): white, near-black #19171C text, lilac CTA; product colors only inside the animated cards.
- Motion [reputation + product]: the page is the demo — every card is a running animation; hero text itself animates in on load. For a motion tool this is signature-with-meaning.
- Section order (verified): "From idea to motion in seconds" → "Supercharge your creativity" → "Details worth obsessing over" → customer quote → "Where teams scale motion" → collaboration/export features → "Never start from scratch again" (400+ templates) → "Loved by the best creative teams" → "Try Jitter today" → newsletter.
- CTA strategy: one brand-colored pill, same verb everywhere ("Try Jitter for free" / "Get started for free").
- Signature element: giant 800-weight typographic hero where the page itself performs the product.

---

## 2. Award-space picks summary (godly.website is dead — it 301s to recent.design now)

- godly.website redirects to recent.design (verified 2026-07-01). Picks used here: Daylight (awwwards.com/sites/daylight), Jitter (awwwards.com/sites/jitter, SOTD), Mintlify (featured on recent.design's current websites feed). Fey.com — formerly the most-cited dark productivity site — now redirects to a "Fey joined Wealthsimple" note (verified), so it's out as a live reference.

## 3. Cross-cutting patterns — the bar the Taskflow landing must clear

1. Hero = one of exactly two theses: (a) product-as-proof — real UI in the first or second viewport (Linear, Amie, Notion Calendar, Mintlify, Arc), or (b) typographic statement + one signature artwork (Jitter, Raycast, Vercel, Reflect, Daylight). Nobody uses generic 3D blobs, stock illustration, or fake dashboards.
2. Headlines are 2-6 word declaratives with tight negative tracking (-2% to -6% of font size) and line-height ~1.0, set at 60-80px, weights 400-600 on dark (Linear 510, Vercel 400, Raycast 600) — only playful brands go 700+ (Notion Calendar 700, Jitter 800).
3. Type systems are two-role or three-role: one hard-working sans OR a flare-serif display over a neutral sans, plus a mono for metadata/credibility texture (Berkeley Mono, JetBrains Mono, Geist Mono, iA Writer Mono, Paper Mono). The mono metadata line (Raycast's "v1.104.20 | macOS 13+ | Install via homebrew") is the cheapest credibility device on any of these pages.
4. Dark heroes are hued near-blacks: #08090A (Linear), #07080A (Raycast), #030014 (Reflect) — never #000. Light heroes: #FFFFFF or #FAFAFA with #171717–#262626 text. Accent counts are low (1-2), except deliberately toy-like brands (Family).
5. Announcement pill above the H1 = liveness signal (Reflect "New: AI integration", Jitter AI pill, Mintlify live stat, Linear "New · Coding Sessions", Amie's dated changelog line).
6. Section h2s carry the same voice as the H1 (Raycast's imperative aphorisms; Notion Calendar's benefit statements). The closing section repeats or rhymes with the hero headline (Reflect and Mintlify repeat it verbatim).
7. Exactly one signature element each: orb (Reflect), triangle-as-light-source (Vercel), aurora rays (Raycast), scalloped blurple frame (Arc), character world (Family), marker highlight (Amie), sunlight/grain (Daylight), ticking stat (Mintlify), self-demonstrating motion (Jitter). Everything else on those pages is quiet.
8. CTAs: specific verbs ("Download for Mac", "Get Notion Calendar free", "Deploy Now", "Order now"), one primary action repeated, a second track only for enterprise/sales. Free-first wording where a free tier exists.
9. Motion budget: either restrained reveals (200-400ms ease-out, consistent with Taskflow's existing 0.2s/0.3s tokens) or ONE orchestrated scroll-linked sequence that argues the product (Family's device scenes, Daylight's light-temperature shift). Never both, never scattered effects.

## 4. Font shortlist (Google Fonts / Fontshare; per brief, excluding Inter, Roboto, Space Grotesk, Arial, system stacks)

All free for commercial use. Calendar-specific requirement: strong tabular figures (time digits "09:30" must not wobble) — check `font-feature-settings: "tnum"` renders correctly for whichever body face wins.

1. Sentient (Fontshare, variable) — display flare-serif. The affordable stand-in for ABC Arizona Flare (the Daylight/Mintlify serif-over-engineering look). Light weights at 60-72px with -2% tracking give "time, considered" editorial gravity without cream-and-terracotta cliche. Pairs with General Sans.
2. General Sans (Fontshare, variable) — body/UI workhorse. Neutral-warm grotesk, tighter apertures than Inter so it doesn't read default; has tabular numerals; holds up at 14-16px UI sizes. The Inter-replacement for both landing body and (optionally) the app.
3. Schibsted Grotesk (Google, variable) — display sans for a darker "quiet systems" direction. Designed for a Nordic news house; distinctive a/g/y forms; sets beautifully at 64px weight 500 with -3% tracking (the Linear register without borrowing Inter).
4. Bricolage Grotesque (Google, variable with optical-size axis) — characterful display for a friendlier light direction (the Notion-Calendar/Amie lane). Its opsz axis gives real display cuts at 64px+; too spicy for body — display only.
5. Spline Sans Mono (Google, variable) — the mono. Designed for UI, slightly narrow, excellent tabular digits — exactly the texture for "07:00 → 09:30", keyboard shortcuts, version lines, date eyebrows. Alternative: Fragment Mono (Google; Helvetica-flavored, rounder, one weight).
6. Zodiak (Fontshare, variable) — higher-contrast display serif alternative to Sentient if the direction wants more drama; only at 48px+, never in body.

Pairing recipes (pick one per direction):

- A. "Editorial engineering" (light, matches the app's light UI): Sentient display + General Sans body + Spline Sans Mono digits/labels.
- B. "Quiet systems" (dark hero, Linear/Raycast lane): Schibsted Grotesk display + General Sans body + Spline Sans Mono metadata.
- C. "Friendly precision" (light, Notion Cal/Amie lane): Bricolage Grotesque display + General Sans (or Hanken Grotesk, Google) body + Fragment Mono accents.

## 5. AI-slop cliches — hard avoid list

From the brief, the frontend-design skill's calibration notes, and what template-generated pages in this space actually look like:

1. Cream background near #F4F1EA + high-contrast serif display + terracotta accent (the current AI default look #1).
2. Near-black + single acid-green (or vermilion) accent (AI default look #2).
3. Broadsheet cosplay: hairline rules everywhere, zero border-radius, dense newspaper columns (AI default look #3).
4. Purple gradient on white — hero blobs, purple→blue gradient text on one keyword, glassmorphism cards over mesh gradients.
5. "01 / 02 / 03" numbered feature grids where the numbers encode no real sequence. (Numbering is fine only if content is genuinely ordered — e.g., a day timeline.)
6. Emoji-as-feature-icons; three-column "Fast / Secure / Simple" checkmark grids; features named by implementation ("Postgres-backed sync") instead of outcome.
7. Fake social proof: invented logos, testimonial cards with AI-generated avatars, "Trusted by 10,000+ teams" with no referent.
8. Scroll-jacked full-page snap sections with dot pagination; scattered parallax on every element; hover-lift + shadow on every card.
9. Centered-everything symmetric layout with equal vertical rhythm throughout — no grid tension, reads templated even when clean.
10. Default type: any of the banned faces untouched, default tracking/leading at display sizes (huge text with letter-spacing 0 and line-height 1.5 is an instant tell).
11. Calendar-specific slop: 3D floating clocks/hourglasses, "time is money" copy, stock photos of teams pointing at whiteboards, a generic month-grid graphic that isn't the actual product.
12. Copy tells (see /home/shree/.claude/CLAUDE.md writing rules): em dashes, "not X but Y" constructions, "supercharge/unlock/seamless/effortless", self-describing sections ("Why choose us?").

## 6. Recommended directions for Taskflow Calendar (for the parent agent to choose from)

Grounding: the real product is a light, precise week grid with a green today-column and tasks that become time blocks. The strongest un-fakeable asset is the grid itself.

- Direction A — "The week, as proof" (product-as-proof, Linear/Amie pattern, light). Hero: short declarative ("Tasks, placed in time." register — final copy TBD), with the REAL week view embedded beneath, where a task visibly drags itself from the sidebar into Thursday 9:00 in a 400ms spring on load. Palette: white + gray hairlines from the app, the app's today-green as the single accent, near-black #171717 text. Type: recipe A (Sentient + General Sans + Spline Sans Mono). Signature: the today-column highlight sweeping across the embedded week as time-of-day advances on scroll.
- Direction B — "Hour-ruler" (typographic statement + meaningful scroll device). A vertical hour ruler (06:00→18:00 in Spline Sans Mono) runs the page's left margin; scroll progress = the day advancing; each landing section sits "at" an hour and the ruler's now-line (today-green) crosses section boundaries as you scroll. This is a numbered/sequential device where the sequence MEANS something (satisfies the cliche test). Dark variant sits in the Linear/Raycast lane (#0A0B0D-family bg, green now-line); light variant matches the app.
- Direction C — "It's on the calendar" (friendly-precision, competes head-on with Notion Calendar's "It's time."). Bricolage Grotesque display, real event chips as design material (the pastel chips from the product shot become the page's only color), CTA "Start planning free" with a mono metadata line ("Web · Free · Google Calendar sync") under it.
- CTA guidance regardless of direction: primary verb-specific CTA repeated (nav + close), announcement pill or dated changelog line above the H1 for liveness, closing section that rhymes with the hero headline.
- Motion guidance: stay in the app's existing 200-300ms register for reveals; spend the entire remaining motion budget on the single signature (A's drag-in or B's ruler). Respect prefers-reduced-motion.

## 7. Open questions for the repo owner

1. Where is the strong Astro-built reference (URL or path)? It is not in /home/shree/dev/taskflow-calendar. "Clearly beat" needs the artifact.
2. Light-first landing to match the shipped app, or dark hero (Linear/Raycast lane) with the light product shot as contrast? The app supports dark mode via class, but the verified product screenshot is light.
3. Is adopting the landing's body face (General Sans) inside the app itself in scope? Today the app ships the Tailwind default system stack, and hero-to-app font continuity is part of what makes Linear/Vercel feel whole.

## Appendix — reproduction

- Extraction: `cd <this dir> && playwright-cli open <url>` then `playwright-cli --raw run-code --filename=extract.js` (dumps computed h1/body/mono font-family, h1 metrics, body bg/color, meta theme-color, font preloads, @font-face families, :root color vars, h2/h3 order, button/CTA texts). Screenshots: `playwright-cli resize 1440 900 && playwright-cli screenshot --filename=hero-<name>.png`. Raycast's webfonts never settle in headless, so its shot was taken via raw CDP: `Page.captureScreenshot` through `page.context().newCDPSession(page)` (see hero-raycast.jpg).
- Files in this directory: site-{linear,amie,arc,raycast,reflect,vercel,family,notioncal,rise,fey,daylight,mintlify,jitter}.json; hero-{linear,amie,arc,reflect,vercel,family,notioncal,rise,daylight,mintlify,jitter}.png, hero-raycast.jpg.
- Award verification sources: https://www.awwwards.com/sites/daylight , https://www.awwwards.com/sites/jitter , https://www.ecomdesignawards.com/websites/daylight-computers , https://recent.design/websites (godly.website 301s here).
