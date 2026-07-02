# App-split + landing scaffold plan — Taskflow Calendar

Owner decisions locked: static prerendered landing at `/`, React SPA at `/app`, single Vercel project (Hobby), `*.vercel.app` domain. Branch `finish-polish-deploy`. All file:line refs verified against the working tree 2026-07-01.

---

## 0. Verified facts and corrections to the recon dossier

- Router: `BrowserRouter`, **no basename** (`src/App.tsx:2,210`). Routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/google/callback`, `/` (protected → MainLayout), catch-all `*` → `Navigate to '/'` (App.tsx:288). `react-router-dom ^7.7.1` (basename fully supported).
- **Correction — the "4 hardcoded `/` redirect sites" need NO edits.** `login-form.tsx:39`, `Signup.tsx:64`, `PublicRoute.tsx:14` (default `redirectTo='/'`), `useAuthGuard.ts:234` (`useGuestOnly('/')`), plus `GoogleCallback.tsx:55,71`, `ProtectedRoute.tsx:14` (`'/login'`), and the App.tsx:288 catch-all all go through `navigate()`/`<Navigate>`, which are **basename-relative** in React Router. Setting `basename="/app"` fixes all of them at once.
- **The real code sites are the 3 OAuth redirect-URI constructions** that bypass the router: `src/components/login-form.tsx:59`, `src/pages/Signup.tsx:81`, `src/pages/GoogleCallback.tsx:34` — each builds `${window.location.origin}/auth/google/callback`.
- **Server-side OAuth lockstep hazard:** `api/auth/google/index.ts` POST **ignores** the `redirectUri` in the request body; the token exchange uses the `OAuth2Client` configured from `GOOGLE_REDIRECT_URI` (`packages/backend/src/services/GoogleOAuthService.ts:34-45`, `handleCallback` at :67). Google rejects a code exchange whose redirect_uri differs from the auth request's. So the frontend path change and the `GOOGLE_REDIRECT_URI` env change must ship in the same deploy.
- **VERCEL_URL-precedence bug confirmed** at `packages/backend/src/services/AuthService.ts:349-354`: `VERCEL_URL` (the per-deployment hash URL, not the canonical alias) wins over `FRONTEND_URL`, so reset emails link to ephemeral deployment URLs. Path also must become `/app/reset-password`.
- `vercel.json`: `framework: "vite"`, only rewrite is the no-op `/api/:path*` passthrough, **no SPA fallback**, no headers, no redirects.
- `vite.config.ts`: no `base`, `server.port: 5173, strictPort: true` (5173/5174 are held by unrelated projects locally — Vite must run on **5180**), `/api` proxied to Express dev server on 3001 (`scripts/dev-server.ts`).
- `index.html`: Google Fonts Inter (also re-imported at `src/index.css:2`), `/vite.svg` favicon, no meta description/OG/canonical. **No `public/` dir exists at repo root**, no robots.txt/sitemap/og image anywhere.
- Frontend API calls are all relative (`/api/...`, e.g. `src/services/api/auth.ts:132`) — unaffected by the base change.
- Raw anchors that point at app routes: `login-form.tsx:92` (`href="/forgot-password"`), `ForgotPassword.tsx:108`, `ResetPassword.tsx:172` (both `href="/login"`). Clicks are intercepted by `navigate()` handlers, so these only matter for middle-click/open-in-new-tab — still fix them.
- pdfjs worker is CDN-hosted (`PDFPreview.tsx:98-99`) — base-safe. Grep found **no other root-absolute asset references** in `src/`. No service worker, no manifest.
- CI (`.github/workflows/ci.yml`): one `checks` job (lint, frontend tests, backend mocked tests, `npm run build`) + one `backend-db` job. No Lighthouse anywhere.
- Vercel routing model (docs-verified): **filesystem matches are served before rewrites**; a rewrite fires only when no file in `outputDirectory` matches. Query strings survive rewrites and redirects. `headers` config supports per-path Cache-Control.

---

## 1. Landing build tooling — recommendation: Astro 5 sub-project at `landing/`

**Choose (a) Astro.** Reasons, weighed against the criteria:

- **Perf budget (P1-P4):** Astro `output: 'static'` ships zero JS by default. The reference ships a React 19 runtime for its `client:load` hero island; we ship none. Route JS stays under ~15 KB gzip of vanilla inline scripts (P3 ≤100 KB beaten outright), LCP is static HTML (P4), and the hero replica (below) makes fold media near-zero (P2 ≤500 KB vs the reference's 23 MB video).
- **Beat-the-reference symmetry:** the reference is Astro 5 + islands. Matching the framework means every technique in the recon catalog (scoped styles, IO/WAAPI reveals, `@property` gradient animations, view transitions) ports 1:1, and the diff is pure craft, not tooling.
- **Image/OG:** `astro:assets` with sharp (already in root devDependencies) gives avif/webp responsive images at build time for the deep-dive screenshots.
- **Fonts:** `@fontsource-variable/inter` self-hosted with `font-display: swap` — immediately beats both the reference posture and the SPA's Google Fonts request.
- **Motion tooling:** no framework islands needed. Entrance choreography, shimmer, marquee = CSS + tiny inline vanilla scripts. The one heavy section (pinned scrollytelling) lazy-imports GSAP + ScrollTrigger (~45 KB gz) inside an IntersectionObserver callback, exactly like the reference — it never counts against initial route JS.
- **Single-project orchestration:** Astro builds from `landing/` into `../dist` as one link in the root `buildCommand` chain. No second Vercel project, no framework-detection conflict (root `framework` is set explicitly, section 2).
- **Do NOT add `@astrojs/react`.** All 15 beat-criteria are achievable without a hydrated framework island; adding React would erase the P3 win. Astro leaves the door open if a real island is ever needed.

Why not the alternatives:

- **(b) plain static Vite build:** same zero-JS output is possible, but you hand-roll HTML partials, image pipeline, sitemap, and scoped styles for no size benefit. Slower iteration on a page whose bar is "beat a polished Astro site."
- **(c) hand-rolled HTML/CSS/JS:** maximal control, worst ergonomics. No components means the 10-section page becomes one 2,000-line file; no image pipeline; every meta/sitemap artifact manual. Rejected.

### Hero mechanism: rebuilt static replica of the week grid + smart input (not iframe, not screenshots)

- **Live iframe of `/app` — rejected.** It loads the full SPA (233 KB+ pre-gzip index chunk plus router/state chunks), immediately hits the auth wall (no demo mode exists in this app — `window.__DEMO__` short-circuiting would be new feature work across the API layer), makes LCP uncontrollable, and fails P2/P3/P4 by construction.
- **Screenshots — secondary use only.** A hero-as-screenshot reads as a mockup, and a retina-density capture of a dense week grid runs 200-400 KB. Fine for the feature deep-dives further down the page (thumbnail-size avif via `astro:assets`), wrong for the hero.
- **Replica — recommended.** Copy the app's real design tokens (the oklch custom properties in `src/index.css`) into the landing token file so the replica IS the product's visual language. Render a week grid with 6-8 realistic events as semantic HTML/CSS. Above it, a canned smart-input demo: a tiny vanilla script "types" `Lunch with Sam tomorrow at 1pm p1 #personal`, precomputed highlight spans light up in the real parser colors (chrono blue `#3b82f6`, priority/category colors from `smart-tags.css`), then the parsed event drops into the grid with a CSS transform. This demos the genuine hero feature (the NLP pipeline, `src/components/smart-input/parsers/`) better than a video, at ~0 media bytes, with a static-HTML LCP. This is also the D4 "ownable signature" (calendar-grid motif) the reference lacks.

---

## 2. Vercel single-project layout

### Target dist layout

```
dist/
  index.html              ← landing (Astro)
  _astro/                 ← landing hashed assets (css, js, images)
  favicon.svg  og.png  robots.txt  sitemap-index.xml  sitemap-0.xml
  app/
    index.html            ← SPA shell (all /app/* deep links fall back here)
    assets/               ← SPA hashed chunks (react, calendar, nlp, ...)
    vite.svg
api/                      ← serverless functions, untouched, NOT in dist
```

Build order is load-bearing: Astro cleans its `outDir` (`../dist`) at build start, so **landing must build before the SPA**; Vite then writes `dist/app` (its `emptyOutDir` clears only `dist/app`). Always build via the root chain, never `build:frontend` after a stale `build:landing`.

### Exact vercel.json

```json
{
  "version": 2,
  "framework": null,
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build:shared && npm run build:landing && npm run build:frontend",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@5.3.11"
    }
  },
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/app", "destination": "/app/index.html" },
    { "source": "/app/:path*", "destination": "/app/index.html" }
  ],
  "redirects": [
    { "source": "/login", "destination": "/app/login", "permanent": false },
    { "source": "/signup", "destination": "/app/signup", "permanent": false },
    {
      "source": "/forgot-password",
      "destination": "/app/forgot-password",
      "permanent": false
    },
    {
      "source": "/reset-password",
      "destination": "/app/reset-password",
      "permanent": false
    },
    {
      "source": "/auth/google/callback",
      "destination": "/app/auth/google/callback",
      "permanent": false
    }
  ],
  "headers": [
    {
      "source": "/app/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/app/index.html",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

Rationale:

- **How the routing works:** Vercel serves filesystem matches from `outputDirectory` first. `/` → `dist/index.html` (landing). `/app/assets/react-*.js` → served directly with the immutable header. Anything under `/app/*` with no file match (every SPA route: `/app/login`, `/app/reset-password?token=x`, ...) falls to the rewrite → `dist/app/index.html`. Query strings are preserved through rewrites, so the reset token survives a hard load.
- **`"framework": null`** replaces `"vite"`. The vite preset's implicit SPA handling was the only thing giving deep links a fallback today; after the split it would fall back to the WRONG shell (the landing's `dist/index.html`) for unknown paths. Everything the preset did is now explicit. Validate on the first preview deploy (checklist A).
- **Redirects keep old URLs alive:** any already-sent password-reset email (`/reset-password?token=...`) and existing bookmarks 307 to the `/app/*` equivalent with the query intact.
- **No root catch-all rewrite.** Unknown root paths 404 (correct for a marketing site). Astro can ship a styled `404.html` later.
- **Functions coexist untouched:** `api/**/*.ts` matches before any rewrite pattern can capture it (`/app/:path*` cannot match `/api/...`), and the explicit `/api/:path*` passthrough stays as belt-and-braces. Hobby-plan limits are unchanged — same function count, one build per deploy, one project.
- **`devCommand` removed** — with `framework: null` it isn't used by `vercel dev` builds the same way; local dev is npm scripts (section 4). Keep it out to avoid confusion (add back `"devCommand": "vite --port 5180"` only if `vercel dev` is actually used).

---

## 3. SPA rebase to /app — file-by-file

1. **`vite.config.ts`**
   - Add `base: '/app/'` (top level).
   - In `build`: add `outDir: 'dist/app'` (leave `emptyOutDir` default true — it only clears `dist/app`).
   - Change `server.port` from `5173` → `5180` (matches local reality; 5173/5174 are held by unrelated projects). Keep `strictPort` and the `/api` → 3001 proxy.
   - Side effect: dev server now serves the app at `http://localhost:5180/app/` — consistent with prod.

2. **`src/App.tsx:210`** — `<Router basename="/app">`. That is the entire router change. All `navigate()`/`<Navigate>` call sites resolve relative to the basename, so **no edits** at login-form.tsx:39, Signup.tsx:64, PublicRoute.tsx:14, useAuthGuard.ts:234, GoogleCallback.tsx:55/71, ProtectedRoute.tsx:14, or the App.tsx:288 catch-all. (Verify in checklist A anyway.)

3. **New helper** (suggest `src/lib/urls.ts`):

   ```ts
   export const googleRedirectUri = () =>
     new URL(
       `${import.meta.env.BASE_URL}auth/google/callback`,
       window.location.origin
     ).toString();
   ```

   `BASE_URL` is `'/app/'` in both dev and build once step 1 lands, so dev and prod always agree. Replace the three constructions:
   - `src/components/login-form.tsx:59`
   - `src/pages/Signup.tsx:81`
   - `src/pages/GoogleCallback.tsx:34`

4. **Raw anchors → `<Link>`** (basename-aware, no full reload; today they only matter for middle-click):
   - `src/components/login-form.tsx:92` (`/forgot-password`)
   - `src/pages/ForgotPassword.tsx:108` (`/login`)
   - `src/pages/ResetPassword.tsx:172` (`/login`)

5. **`index.html`** — no asset edits needed: Vite prefixes root-absolute URLs (`/vite.svg`, the module script) with `base` at build time. Optional polish while here: retitle to "Taskflow — Calendar & Tasks" and add `<meta name="robots" content="noindex">` (the app shell has no indexable content; the landing owns SEO).

6. **`packages/backend/src/services/AuthService.ts:349-354`** — fold in the triage-auth fix AND the path change:

   ```ts
   const baseUrl =
     process.env.FRONTEND_URL ||
     (process.env.VERCEL_URL
       ? `https://${process.env.VERCEL_URL}`
       : 'http://localhost:5180');
   const resetLink = `${baseUrl}/app/reset-password?token=${encodeURIComponent(token)}`;
   ```

   `FRONTEND_URL` (canonical alias) must win; `VERCEL_URL` is the per-deployment hash URL and remains only a preview fallback.

7. **`packages/backend/src/services/GoogleOAuthService.ts:36`** — dev-default redirect URI → `'http://localhost:5180/app/auth/google/callback'`.

8. **Config-default consistency** (not load-bearing for the main flow but keep them honest):
   - `lib/config/api.ts:65` — `REDIRECT_URI` default → `'http://localhost:5180/app/auth/google/callback'`.
   - `lib/config/env.ts:30` — `FRONTEND_URL` default → `'http://localhost:5180'`.

9. **Vercel env vars (production):**
   - `FRONTEND_URL=https://<project>.vercel.app` — NEW, required by fix 6.
   - `GOOGLE_REDIRECT_URI=https://<project>.vercel.app/app/auth/google/callback` — CHANGED.
   - **Google Cloud Console (owner action):** add the new authorized redirect URI; remove the old one after cutover. Ship the env flip, the console change, and the frontend deploy together — the server-side exchange uses `GOOGLE_REDIRECT_URI` and Google rejects mismatches (see section 0). OAuth on preview deploys stays broken (origin mismatch) exactly as today; document, don't fix.

10. **Asset-path fallout: none found.** pdfjs worker is CDN-pinned (`PDFPreview.tsx:98-99`); emoji-mart/fonts/chunks all go through Vite's hashed pipeline which honors `base`; all fetches are relative `/api` paths (same-origin, unprefixed by design — `/api` must NOT get the `/app` base). CORS middleware (`lib/middleware/cors.ts`) already allows `FRONTEND_URL` + `VERCEL_URL`; same-origin calls are unaffected.

11. **Tests:** grep `src/**/__tests__` for assertions on `window.location`/paths after the change; components under `MemoryRouter` are unaffected by basename. Expect zero-to-few fixes.

---

## 4. Local dev workflow

Ports: **landing (Astro) 4321**, **SPA (Vite) 5180** at `http://localhost:5180/app/`, **API (Express) 3001**, Postgres via `docker-compose`.

`package.json` (root) changes:

```jsonc
"workspaces": ["packages/*", "apps/*", "landing"],   // add landing
"scripts": {
  "dev:vite": "vite",                                 // port now 5180 via vite.config.ts
  "dev:landing": "npm run dev --workspace=landing",   // astro dev, port 4321
  "dev": "concurrently \"npm run dev:vite\" \"npm run dev:api\"",   // unchanged shape
  "dev:all": "concurrently \"npm run dev:landing\" \"npm run dev:vite\" \"npm run dev:api\"",
  "build:landing": "npm run build --workspace=landing",
  "build": "npm run build:shared && npm run build:landing && npm run build:frontend && npm run build:backend"
}
```

- Adding `landing` to workspaces means the existing root `npm install --legacy-peer-deps` (Vercel `installCommand`, CI) picks up Astro deps with zero pipeline changes.
- `landing/package.json` deps: `astro@^5`, `@astrojs/sitemap`, `@fontsource-variable/inter`, `@fontsource-variable/geist-mono` (if adopting mono eyebrows), `gsap` (lazy-loaded). `sharp` already sits in root devDeps for `astro:assets`.
- **Cross-nav in dev:** the landing's CTA href is `PUBLIC_APP_URL ?? '/app'` (Astro env); in `landing/.env.development` set `PUBLIC_APP_URL=http://localhost:5180/app`. In prod it stays the relative `/app`.
- **Testing the merged artifact + rewrites locally:** plain `npx serve dist` won't apply vercel.json rewrites. Use `vercel build && vercel dev`, or (simpler and what the checklist assumes) verify rewrites on a preview deploy. `npm run build && npx serve dist` is still useful for eyeballing the landing and Lighthouse dry-runs.

---

## 5. CI additions (`.github/workflows/ci.yml`)

1. **Existing `checks` job:** no yml change needed — its `npm run build` step now builds landing too once the root `build` script is updated (section 4).
2. **New `landing-lighthouse` job:**
   ```yaml
   landing-lighthouse:
     name: Landing Lighthouse budget
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with: { node-version: 22, cache: npm }
       - run: npm install --legacy-peer-deps
       - run: npm run build:landing
       - run: npx @lhci/cli@0.14.x autorun --config=landing/lighthouserc.json
   ```
   `landing/lighthouserc.json` (beats the reference's budget — theirs: perf ≥0.90 error, bp/seo warn-only):
   ```json
   {
     "ci": {
       "collect": {
         "staticDistDir": "./dist-preview-or-dist",
         "numberOfRuns": 3
       },
       "assert": {
         "assertions": {
           "categories:performance": ["error", { "minScore": 0.95 }],
           "categories:accessibility": ["error", { "minScore": 1 }],
           "categories:best-practices": ["error", { "minScore": 0.95 }],
           "categories:seo": ["error", { "minScore": 0.95 }]
         }
       }
     }
   }
   ```
   Note: `staticDistDir` must point at the landing output. Since Astro's `outDir` is `../dist` and the SPA half may be absent in this job, that's fine — LHCI only loads `/index.html`. Mobile emulation + throttling are LHCI defaults (matches P1's "mobile, throttled").
3. **SEO/social artifacts (landing side, beat criterion C3):**
   - Layout meta set: `<title>`, meta description, canonical, `og:title/description/type/url/image`, `twitter:card summary_large_image` + `twitter:image`. **Ship a real `og.png`** (1200x630, ≤100 KB, designed static asset in `landing/public/` — the reference declares the card but has no image; this is the easy win).
   - `@astrojs/sitemap` (requires `site` in `astro.config.mjs`); `landing/public/robots.txt` allowing all + `Sitemap:` pointer. Don't disallow `/app` (it's auth-walled; the SPA shell gets `noindex` instead, section 3.5).
   - `site`/canonical/OG URLs are wired through `PUBLIC_SITE_URL` + `astro.config.mjs site:` — needs the final `*.vercel.app` project URL (see Blockers).
4. **Phase-2 (optional, post-scaffold):** Playwright axe a11y spec + reduced-motion spec mirroring the reference's `a11y.spec.ts`/`reduced-motion.spec.ts`, and a contrast unit test over the landing token file (beat criteria D3/M3).

---

## 6. Ordered implementation steps

**Phase 1 — SPA rebase (independently shippable; landing not required):**

1. `vite.config.ts`: `base: '/app/'`, `outDir: 'dist/app'`, port 5180.
2. `src/App.tsx`: `basename="/app"`.
3. Add `src/lib/urls.ts` helper; swap the 3 OAuth redirect-URI sites (login-form.tsx:59, Signup.tsx:81, GoogleCallback.tsx:34).
4. Convert the 3 raw anchors to `<Link>`.
5. `AuthService.ts:349-354` precedence + path fix; `GoogleOAuthService.ts:36`, `lib/config/api.ts:65`, `lib/config/env.ts:30` defaults.
6. Root `package.json`: port/script updates (dev scripts only at this stage).
7. `vercel.json`: full config from section 2, PLUS a temporary root redirect `{ "source": "/", "destination": "/app", "permanent": false }` so the deploy stays functional before the landing exists.
8. Vercel env: set `FRONTEND_URL`, update `GOOGLE_REDIRECT_URI`; owner updates Google Cloud Console redirect URI. Deploy together.
9. Preview deploy → run **Checklist A**. Fix, then merge.

**Phase 2 — Landing scaffold:** 10. `landing/` Astro project: `astro.config.mjs` (`output: 'static'`, `outDir: '../dist'`, `site: PUBLIC_SITE_URL`, sitemap integration). Add `landing` to root workspaces; add `build:landing` to root `build` chain and to `buildCommand` (already in the section-2 vercel.json). 11. `landing/src/styles/tokens.css`: port the app's oklch tokens from `src/index.css` + named easings/durations (beat criteria D1/D2); self-host Inter Variable. 12. Sections in order: Nav, Hero (grid replica + typed smart-input demo), scrollytelling how-it-works (GSAP lazy-imported on visibility), feature deep-dives (avif screenshots via `astro:assets`), footer CTA, footer. Copy sourced from the recon dossier Part 2 — every claim maps to a file; do NOT reuse the README "738 tests" badge without re-running suites. 13. `landing/public/`: `robots.txt`, `og.png`, `favicon.svg`. 14. Meta/OG/canonical in the layout; sitemap builds green. 15. `landing/lighthouserc.json` + the new CI job. 16. Remove the temporary `/` → `/app` redirect from vercel.json. Landing goes live at `/`. 17. Preview deploy → run **Checklist B** + re-run the Checklist A OAuth/reset spot checks.

---

## 7. Verification checklist

**A — SPA rebase (on a preview deploy, except OAuth which needs prod):**

- [ ] Hard-load `/app` → redirects to `/app/login` (unauthenticated).
- [ ] **Hard-load `/app/reset-password?token=x`** → reset page renders, token present in params (query survived the rewrite).
- [ ] Old URL `/reset-password?token=x` → 307 → `/app/reset-password?token=x`.
- [ ] Login (email/password) → lands at `/app`; hard reload stays authenticated.
- [ ] Signup → lands at `/app`.
- [ ] **OAuth round-trip on production** (after env + console flip): Google button → consent → `/app/auth/google/callback` → success card → `/app` dashboard.
- [ ] Trigger forgot-password; emailed (or console-logged) link is `https://<canonical>/app/reset-password?token=...` — canonical alias, not a deployment-hash URL.
- [ ] `/api/health` 200; app network tab shows all API calls same-origin `/api/*`, zero 404s; chunks load from `/app/assets/*` with immutable cache headers.
- [ ] Unknown SPA path `/app/nope` → catch-all → `/app`.
- [ ] PDF attachment preview still works (CDN worker), emoji picker loads (lazy chunk under `/app/assets/`).
- [ ] `npm run test:frontend:run` green.

**B — Landing:**

- [ ] `curl https://<domain>/` returns full marketing HTML (copy is crawlable without JS).
- [ ] Lighthouse CI (mobile, 3 runs): perf ≥0.95, a11y = 1.0, best-practices ≥0.95, SEO ≥0.95 — all error-level.
- [ ] `og.png` returns 200; card validates in an unfurl checker; `sitemap-index.xml` and `robots.txt` 200.
- [ ] Fold media ≤500 KB and landing route JS ≤100 KB gzip (network tab; expect ~0 media / ~15 KB JS).
- [ ] `prefers-reduced-motion`: all content present, animations off.
- [ ] CTA "Get started" → `/app` → login page; **browser Back returns to the landing, Forward returns to the app** (two documents, native history — no SPA route interception at the boundary).
- [ ] 404 behavior at root (`/nope`) is acceptable (Vercel 404 or Astro `404.html`).

---

## 8. Blockers / owner actions

1. **Canonical site URL** — `FRONTEND_URL`, `GOOGLE_REDIRECT_URI`, Astro `site`, OG/canonical/sitemap all need the final `https://<project>.vercel.app`. Confirm the Vercel project name (or `vercel project ls`) before Phase 1 step 8; use a placeholder env locally until then.
2. **Google Cloud Console** redirect-URI update is an owner-console action and must land in the same window as the env flip + deploy, or OAuth breaks (`redirect_uri_mismatch`).
3. **`framework: null` validation** — the vite preset's implicit deep-link fallback is being replaced by explicit rewrites; one preview deploy validates it (Checklist A first three items). Low risk, but it is the one behavior we are asserting from docs rather than observed config.

Non-blockers: everything else is code in this repo; no new infrastructure, no plan upgrade, no new Vercel project.
