import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Local Express backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
