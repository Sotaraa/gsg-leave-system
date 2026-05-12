import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // we surface our own update banner
      includeAssets: [
        'icons/*.svg', 'icons/*.png',
        'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png',
        'favicon-192x192.png', 'favicon-512x512.png',
        'Sotara.png',
      ],
      manifest: {
        name: 'LeaveHub — Staff Leave Management',
        short_name: 'LeaveHub',
        description: 'Multi-tenant staff leave management for schools and SMEs, powered by Sotara.',
        theme_color: '#0A2847',
        background_color: '#f0f7f8',
        display: 'standalone',
        orientation: 'any',            // works on phones in landscape + desktops
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'en-GB',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          // PNG (best compatibility — used by Android home-screen, splash, etc.)
          { src: 'favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          // SVG fallback (scales perfectly on Chrome-based desktops)
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
        // App shortcuts — long-press the installed icon to access these
        shortcuts: [
          {
            name: 'Submit Leave',
            short_name: 'Submit',
            description: 'Submit a new leave request',
            url: '/?view=employee&source=pwa-shortcut',
            icons: [{ src: 'favicon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Approvals',
            short_name: 'Approve',
            description: 'Review pending leave requests',
            url: '/?view=dept-head&source=pwa-shortcut',
            icons: [{ src: 'favicon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Admin Panel',
            short_name: 'Admin',
            description: 'Manage staff, requests and settings',
            url: '/?view=admin&source=pwa-shortcut',
            icons: [{ src: 'favicon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Calendar',
            short_name: 'Calendar',
            description: 'View team leave calendar',
            url: '/?view=calendar&source=pwa-shortcut',
            icons: [{ src: 'favicon-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Precache every static asset the build produces
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Stay below the default 2MB precache limit for individual files
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Critical for SPAs: every route falls back to index.html
        navigateFallback: '/index.html',
        // Don't intercept auth/SSO redirects — let Microsoft + Supabase handle them
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/auth/,
          /^\/.well-known/,
          /\/oauth/,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,             // wait for user click on update banner
        runtimeCaching: [
          // Google Fonts — CacheFirst (long TTL, immutable)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase REST — NetworkFirst so data stays fresh, but cached
          // copies are served instantly while offline. Tuned for the
          // admin panel which fetches staff lists, requests, settings etc.
          {
            urlPattern: /^https:\/\/uzmdqryhzijkmwedvwka\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 5,    // fall back to cache after 5s
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }, // 24h
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase storage / auth / realtime — pass through, no cache
          {
            urlPattern: /^https:\/\/uzmdqryhzijkmwedvwka\.supabase\.co\/(auth|realtime|storage)\/.*/i,
            handler: 'NetworkOnly',
          },
          // Microsoft Graph — never cache (sensitive personal data)
          {
            urlPattern: /^https:\/\/graph\.microsoft\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          // Microsoft login — never cache
          {
            urlPattern: /^https:\/\/login\.microsoftonline\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },    // SW disabled in dev to avoid cache confusion
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          msal: ['@azure/msal-browser'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
