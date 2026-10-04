// URL helpers that work under any deployment path (GitHub Pages sub-path, laptop dev server) with hash routing.

/** URL of a file in public/ (sounds, word lists, ...), relative to wherever the app is served from. */
export function assetUrl(file) {
  return `${import.meta.env.BASE_URL}${file.replace(/^\/+/, '')}`;
}

/** Shareable absolute URL of an in-app route, e.g. appUrl('/rack/2') -> https://host/app/#/rack/2 */
export function appUrl(route) {
  return `${window.location.origin}${window.location.pathname}#${route.startsWith('/') ? route : `/${route}`}`;
}
