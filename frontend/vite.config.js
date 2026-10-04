import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { gameApiPlugin } from './vite-plugin-game-api-v2.js'
import { offlinePlugin } from './vite-plugin-offline.js'

// https://vite.dev/config/
export default defineConfig({
  // Relative base + hash routing: the built site works from any sub-path (e.g. GitHub Pages) and offline.
  base: './',
  plugins: [vue(), gameApiPlugin(), offlinePlugin()],
  server: {
    host: true, // Enable network access
    port: 5174,
  },
})
