import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Build-time helper for the static site:
//  - removes word lists named in OXY_EXCLUDE_LISTS (e.g. "csw21,nwl2023") from the output, so a public deployment can
//    leave out lists it must not redistribute,
//  - writes wordlists.json describing the lists that ARE shipped (the app picks its default list from it),
//  - generates sw.js (from sw.template.js) with the list of files to precache, so the installed app works offline.

const LISTS = { csw21: 'CSW21.txt', nwl2023: 'NWL2023.txt', enable: 'ENABLE.txt', friendly: 'FRIENDLY.txt', slovenian: 'SLOVENIAN.txt' };
// Big lists are cached the first time they are used instead of at install, to keep installing a phone quick
const LAZY = new Set(['CSW21.txt', 'NWL2023.txt']);

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

export function offlinePlugin() {
  let root;
  let outDir;
  return {
    name: 'oxy-offline',
    apply: 'build',
    // Defence in depth for the production build: even if hostile text ever reached the page, the browser refuses to run
    // inline scripts or talk to / load from any other origin. (Not applied in dev: Vite's hot reload needs more.)
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // Vue scoped styles and :style bindings
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n  <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const excluded = (process.env.OXY_EXCLUDE_LISTS || '').split(',').map((s) => s.trim()).filter(Boolean);
      for (const id of excluded) {
        if (!LISTS[id]) throw new Error(`OXY_EXCLUDE_LISTS: unknown word list "${id}"`);
        fs.rmSync(path.join(outDir, LISTS[id]), { force: true });
      }

      const lists = {};
      for (const [id, file] of Object.entries(LISTS)) {
        const full = path.join(outDir, file);
        if (fs.existsSync(full)) lists[id] = { file, bytes: fs.statSync(full).size };
      }
      fs.writeFileSync(path.join(outDir, 'wordlists.json'), JSON.stringify({ lists }));

      const files = walk(outDir).filter((f) => f !== 'sw.js' && !LAZY.has(f));
      const version = crypto
        .createHash('sha1')
        .update(files.map((f) => `${f}:${fs.statSync(path.join(outDir, f)).size}`).join('|'))
        .digest('hex')
        .slice(0, 10);
      const urls = ['./', ...files.map((f) => `./${f}`)];
      const template = fs.readFileSync(path.resolve(root, 'sw.template.js'), 'utf8');
      for (const token of ['__VERSION__', '__PRECACHE__']) {
        // exactly one occurrence, or the first replacement could land in a comment and leave the real one undefined
        if (template.split(token).length !== 2) throw new Error(`sw.template.js must contain ${token} exactly once`);
      }
      const worker = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls));
      fs.writeFileSync(path.join(outDir, 'sw.js'), worker);
      console.log(`[offline] ${urls.length} files precached (version ${version}); word lists shipped: ${Object.keys(lists).join(', ') || 'none'}`);
    },
  };
}
