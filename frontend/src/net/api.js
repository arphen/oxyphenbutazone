// Serves the app's /api/* calls without a server.
//
// The views talk to the game through fetch('/api/...'), which the laptop dev server answers. In the static build
// (GitHub Pages / offline phones) there is no server, so this module installs a thin wrapper around window.fetch:
// /api/* requests are answered by the current "backend" (a local in-browser engine, or a remote host over WebRTC),
// everything else goes to the network untouched. With no backend set, nothing is intercepted (laptop dev mode).
//
// A backend is { kind, getState(), dispatch(action), words(query) }, all async.

import { safeJsonParse, MAX_ACTION_BYTES } from '../shared/protocol.js';

let backend = null;
let installed = false;

export const setBackend = (next) => {
  backend = next;
};
export const getBackend = () => backend;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function handle(url, init) {
  const route = url.pathname;
  const method = (init.method || 'GET').toUpperCase();

  if (route === '/api/game-state' && method === 'GET') return json(await backend.getState());

  if (route === '/api/action' && method === 'POST') {
    let action;
    try {
      action = safeJsonParse(typeof init.body === 'string' ? init.body : '', MAX_ACTION_BYTES);
    } catch (error) {
      return json({ success: false, error: error.message }, 400);
    }
    return json(await backend.dispatch(action));
  }

  if (route === '/api/words' && method === 'GET') {
    const query = {};
    for (const key of ['dictionary', 'length', 'contains', 'containsAny', 'startsWith', 'endsWith', 'excludes']) {
      const value = url.searchParams.get(key);
      if (value) query[key] = value.slice(0, 100);
    }
    return json(await backend.words(query));
  }

  // e.g. the odd-one-out multiplayer endpoints, which need the laptop host
  return json({ success: false, error: 'This needs the laptop host' }, 404);
}

export function installApi() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    } catch {
      return realFetch(input, init);
    }
    if (!backend || url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }
    try {
      return await handle(url, init);
    } catch (error) {
      return json({ success: false, error: error.message || 'Request failed' }, 500);
    }
  };
}
