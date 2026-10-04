// How this copy of the app gets its game:
//  'http'  - a laptop dev server (vite + game API plugin) holds the game; phones and the board poll it.
//  'local' - the game lives in this browser (static build / GitHub Pages / offline phones). One device can play on
//            its own, host a peer-to-peer game, or join one.
// Dev server defaults to 'http', a production build to 'local'. Override with ?mode=local or ?mode=http (before the #).

export function resolveMode() {
  const forced = new URLSearchParams(window.location.search).get('mode');
  if (forced === 'http' || forced === 'local') return forced;
  return import.meta.env.DEV ? 'http' : 'local';
}
