<template>
  <div id="app">
    <ConnectionBadge />
    <router-view />
  </div>
</template>

<script>
import ConnectionBadge from './components/ConnectionBadge.vue';

const THEME_KEY = 'oxy-theme';

function resolveTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable — fall through to OS preference */
  }
  return null;
}

export default {
  name: 'App',
  components: { ConnectionBadge },
  mounted() {
    // Explicit [data-theme] override wins; otherwise the CSS layer follows
    // prefers-color-scheme on its own. Expose a test hook for agents/e2e.
    const theme = resolveTheme();
    if (theme) document.documentElement.dataset.theme = theme;
    window.__oxyTheme = {
      set: (mode) => {
        if (mode === 'light' || mode === 'dark') {
          document.documentElement.dataset.theme = mode;
          try {
            localStorage.setItem(THEME_KEY, mode);
          } catch {
            /* ignore */
          }
        } else {
          delete document.documentElement.dataset.theme;
          try {
            localStorage.removeItem(THEME_KEY);
          } catch {
            /* ignore */
          }
        }
      },
      get: () => document.documentElement.dataset.theme || 'system',
    };
  },
};
</script>

<style>
#app {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  background: var(--surface-0);
  color: var(--ink);
  min-height: 100vh;
}
</style>
