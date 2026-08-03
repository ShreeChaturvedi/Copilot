// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Canonical URL for canonical/OG/sitemap. Default is the Vercel production
// host. GitHub Pages builds override with PUBLIC_SITE_URL + PUBLIC_BASE_PATH
// so assets resolve under /taskflow-calendar/ on github.io.
const site = process.env.PUBLIC_SITE_URL ?? 'https://taskflow-calendar.vercel.app';
// Astro base: must start with / and must not end with / (except root '/').
const rawBase = process.env.PUBLIC_BASE_PATH ?? '/';
const base = rawBase === '/' ? '/' : rawBase.replace(/\/$/, '');

export default defineConfig({
  site,
  base,
  output: 'static',
  // Builds into the repo-root dist/ that Vercel serves. Astro cleans this
  // directory at build start, so the landing MUST build before the SPA
  // (which writes dist/app with emptyOutDir scoped to dist/app only).
  outDir: '../dist',
  integrations: [sitemap()],
  build: {
    // One page; inlining the stylesheet removes the render-blocking request.
    inlineStylesheets: 'always',
  },
});
