import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';

const DEFAULT_API_TARGET = 'http://localhost:3001';
const PORT_FILE = resolve(process.cwd(), '.dev-api-port');

/** Resolve API target: API_PROXY_TARGET > .dev-api-port > :3001 */
function resolveApiTarget(): string {
  if (process.env.API_PROXY_TARGET) return process.env.API_PROXY_TARGET;
  try {
    if (existsSync(PORT_FILE)) {
      const port = readFileSync(PORT_FILE, 'utf-8').trim();
      if (/^\d+$/.test(port)) return `http://localhost:${port}`;
    }
  } catch {
    // fall through
  }
  return DEFAULT_API_TARGET;
}

/**
 * Proxies /api with a target re-read on every request so concurrent
 * `npm run dev` (API + Vite) works when the API probes off :3001.
 * API_PROXY_TARGET (E2E) still wins and is stable for the process.
 */
function dynamicApiProxy(): Plugin {
  return {
    name: 'dynamic-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();

        const target = new URL(resolveApiTarget());
        const proxyReq = http.request(
          {
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              host: target.host,
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (err) => {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Bad Gateway: API unreachable (${err.message})`);
        });

        req.pipe(proxyReq);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // SPA is served under /app (landing owns /). Vite prefixes root-absolute
  // asset URLs and import.meta.env.BASE_URL with this in dev and build.
  base: '/app/',
  plugins: [react(), tailwindcss(), dynamicApiProxy()],
  optimizeDeps: {
    include: [
      'react-resizable-panels',
      'react-dropzone',
      '@radix-ui/react-toggle',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Point @shared to the typed shared package source for dev
      '@shared': fileURLToPath(
        new URL('./packages/shared/src', import.meta.url)
      ),
    },
  },
  build: {
    // Emit into dist/app so the SPA and the landing (dist/) coexist in one
    // Vercel output dir. emptyOutDir defaults true and clears only dist/app.
    outDir: 'dist/app',
    // Enable minification and tree-shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Optimize chunk strategy for lazy loading
        manualChunks: {
          // Core React dependencies (loaded on initial page)
          react: ['react', 'react-dom'],

          // Router and state management (loaded on initial page)
          'react-router': ['react-router-dom'],
          'state-management': ['zustand', '@tanstack/react-query'],

          // UI component libraries (split by usage frequency)
          'radix-core': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
          ],
          'radix-extended': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-icons',
          ],

          // Calendar functionality (lazy loaded when needed)
          calendar: [
            '@fullcalendar/react',
            '@fullcalendar/core',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],

          // NLP and smart input (lazy loaded)
          nlp: ['chrono-node', 'compromise'],

          // Analytics visualization (lazy loaded)
          analytics: ['recharts'],

          // Emoji picker (lazy loaded)
          emoji: ['@emoji-mart/react', '@emoji-mart/data', 'emoji-mart'],

          // Rich text editor (lazy loaded)
          editor: ['pell', 'rangy'],

          // PDF viewer (lazy loaded)
          pdf: ['pdfjs-dist'],

          // Drag and drop (lazy loaded)
          dnd: ['react-dnd', 'react-dnd-html5-backend', '@dnd-kit/core'],

          // Animation library (lazy loaded)
          animation: ['framer-motion', '@use-gesture/react'],

          // Utility libraries
          utils: [
            'date-fns',
            'date-fns-tz',
            'uuid',
            'clsx',
            'class-variance-authority',
          ],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    // /api proxy is handled by dynamicApiProxy (re-reads .dev-api-port).
  },
});
