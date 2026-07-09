import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // We register + surface the update prompt ourselves via useRegisterSW.
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'og-image.svg',
        'offline.html',
        'icons/apple-touch-icon.png',
        'icons/apple-touch-icon-152.png',
        'icons/apple-touch-icon-167.png',
      ],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        id: '/',
        name: 'SmartReception AI',
        short_name: 'SmartReception',
        description:
          'Enterprise AI Reception Platform — automate WhatsApp conversations, appointment booking, lead capture, and customer care with a 24/7 AI receptionist.',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: '#090B14',
        background_color: '#090B14',
        lang: 'en',
        dir: 'ltr',
        categories: ['business', 'productivity', 'communication'],
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Open your business overview',
            url: '/dashboard?source=pwa-shortcut',
            icons: [{ src: '/icons/shortcut-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Conversations',
            short_name: 'Inbox',
            description: 'Jump to the conversation inbox',
            url: '/conversations?source=pwa-shortcut',
            icons: [{ src: '/icons/shortcut-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Appointments',
            short_name: 'Appointments',
            description: 'View and manage appointments',
            url: '/appointments?source=pwa-shortcut',
            icons: [{ src: '/icons/shortcut-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Settings',
            short_name: 'Settings',
            description: 'Open workspace settings',
            url: '/settings?source=pwa-shortcut',
            icons: [{ src: '/icons/shortcut-96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
        screenshots: [
          {
            src: '/icons/screenshot-wide.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'SmartReception AI — enterprise dashboard',
          },
          {
            src: '/icons/screenshot-narrow.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'SmartReception AI — on mobile',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('/react/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
