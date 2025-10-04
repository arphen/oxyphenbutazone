import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { gameApiPlugin } from './vite-plugin-game-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), gameApiPlugin()],
  server: {
    host: true, // Enable network access
    port: 5174,
  },
})
