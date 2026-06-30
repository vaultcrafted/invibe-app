import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logotipo.png', 'Logo.png', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'Invibe Staff',
        short_name: 'Invibe',
        description: 'Gestionale staff Invibe Summer 2026',
        theme_color: '#1E6BF1',
        background_color: '#1E6BF1',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // App (codice, immagini, font): risponde subito dalla cache e aggiorna in background
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'invibe-shell',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // Dati Supabase (letture): rete prima, se offline serve l'ultima copia salvata
            urlPattern: ({ url }) => url.href.includes('.supabase.co/rest'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'invibe-dati',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // File nello Storage (attestati, immagini)
            urlPattern: ({ url }) => url.href.includes('.supabase.co/storage'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'invibe-storage',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ]
})
