// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Canonical URL for canonical/OG/sitemap. Placeholder default until the
// Vercel project URL is confirmed (app-split-plan §8 blocker 1); override
// with PUBLIC_SITE_URL at build time.
const site = process.env.PUBLIC_SITE_URL ?? 'https://taskflow-calendar.vercel.app';

export default defineConfig({
  site,
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
