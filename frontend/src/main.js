import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { resolveMode } from './net/mode'
import { installApi, setBackend } from './net/api'
import { createLocalBackend } from './net/localBackend'
import { initNet } from './net/session'
import { isDebug } from './utils/log'

const mode = resolveMode()
if (mode === 'local') {
  // No server: answer the app's /api/* calls from an engine running in this browser
  const backend = createLocalBackend()
  installApi()
  setBackend(backend)
  initNet(backend)
  if (isDebug()) window.__oxy = { backend } // test hook, only with ?debug
}

createApp(App).use(router).mount('#app')

// Installed/offline use: cache the whole app (including word lists) so it runs with no network
if (mode === 'local' && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
    console.warn('Offline support unavailable:', error?.message)
  })
}
