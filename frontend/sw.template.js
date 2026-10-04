// Service worker for the installed app. Generated into dist/sw.js by vite-plugin-offline.js, which fills in the
// version and the list of files to precache. Strategy: everything the app needs is cached when the app is installed,
// then served cache-first, so it works with no network at all. Other same-origin files (e.g. a word list that was not
// precached) are cached the first time they are fetched.

const CACHE = 'oxy-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // All files come from the same build, so one failing means a broken install: fail it and let the browser retry
      await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('oxy-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// Safari asks for audio with Range requests and refuses a plain 200 for them, so answer ranges from the cached body.
async function rangeResponse(request, cached) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!match) return cached;
  const body = await cached.arrayBuffer();
  const start = match[1] === '' ? Math.max(0, body.byteLength - Number(match[2])) : Number(match[1]);
  const end = match[1] !== '' && match[2] !== '' ? Math.min(Number(match[2]), body.byteLength - 1) : body.byteLength - 1;
  if (start > end || start >= body.byteLength) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.byteLength}` } });
  }
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${body.byteLength}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreSearch: ?debug / ?mode=... must not miss the cached copy
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return request.headers.has('range') ? rangeResponse(request, cached) : cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic' && !request.headers.has('range')) cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (request.mode === 'navigate') {
          const shell = (await cache.match('./index.html')) || (await cache.match('./'));
          if (shell) return shell;
        }
        throw error;
      }
    })()
  );
});
