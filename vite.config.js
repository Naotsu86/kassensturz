import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // WICHTIG für GitHub Pages (Repo-Name!)
  base: '/kassensturz/',

  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png'
      ],

      manifest: {
        name: 'Reise-Kasse',
        short_name: 'Reise-Kasse',
        description: 'Reiseausgaben fair aufteilen – komplett lokal.',
        theme_color: '#3b82f6',
        background_color: '#f6f7f9',
        display: 'standalone',

        // wichtig für PWA + GitHub Pages
        scope: '/kassensturz/',
        start_url: '/kassensturz/',

        icons: [
          {
            src: '/kassensturz/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/kassensturz/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
      }
    })
  ]
})
