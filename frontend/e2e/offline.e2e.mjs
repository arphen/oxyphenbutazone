import { launch, newPage, api, ok, sleep, assert, run, BASE } from './lib.mjs';

// Install the (public-style) build, cut the network, reload and play.
run(async () => {
  const browser = await launch([]);
  const { context: ctx, page } = await newPage(browser);
  const errs = page.errs;
  const call = (path, body) => api(page, path, body);

  console.log('1. First visit (online): install, and a public-style build without CSW21/NWL2023');
  await page.goto(BASE + '/?debug#/'); await page.waitForFunction(() => window.__oxy); await page.evaluate(() => window.__oxy.backend.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }); });
  ok('service worker installed and controlling the page');
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return (await c.keys()).map(r => new URL(r.url).pathname.replace(/^\//, '')); });
  assert.ok(cached.some(f => f.endsWith('.js')) && cached.includes('ENABLE.txt') && cached.includes('SLOVENIAN.txt') && cached.includes('sounds/click1.mp3') && cached.includes('manifest.webmanifest'), cached.join());
  ok(`${cached.length} files precached incl. both word lists, sounds, manifest`);
  assert.ok(!cached.some(f => /CSW21|NWL2023/.test(f))); ok('copyrighted lists are not in the cache');
  const mani = await (await page.request.get(BASE + '/manifest.webmanifest')).json(); assert.equal(mani.name, 'Oxyphenbutazone'); ok('manifest: ' + mani.name);

  console.log('2. Default word list is the open one, because CSW21 is not shipped');
  let g = await call('/api/game-state');
  assert.deepEqual(g.dictionaries, { csw21: false, nwl2023: false, enable: true, slovenian: false }); ok('default selection = ENABLE only');
  assert.equal((await call('/api/action', { type: 'validate-word', word: 'cat' })).valid, true);
  assert.equal((await call('/api/action', { type: 'validate-word', word: 'xyzzy' })).valid, false); ok('validate-word: cat valid, xyzzy invalid');

  console.log('3. Asking for a list that is not installed is handled gracefully');
  await call('/api/action', { type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, enable: false, slovenian: false } });
  g = await call('/api/game-state');
  assert.equal(g.dictionaries.enable, true); assert.equal(g.dictionaries.csw21, false); assert.match(g.message, /not installed/i); ok(`fell back to ENABLE: "${g.message}"`);
  assert.equal((await call('/api/action', { type: 'validate-word', word: 'cat' })).valid, true); ok('words still validate after the fallback');

  console.log('4. Network OFF: reload and play');
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.__oxy); await page.evaluate(() => window.__oxy.backend.ready);
  assert.equal(await page.locator('h1.game-title').innerText(), 'Oxyphenbutazone'); ok('app boots from the cache with no network (headline "Oxyphenbutazone")');
  const r = await call('/api/action', { type: 'restart', playerCount: 2, language: 'slovenian' });
  assert.equal(r.gameState.language, 'slovenian'); assert.deepEqual(r.gameState.dictionaries, { csw21: false, nwl2023: false, enable: false, slovenian: true }); ok('offline: new Slovenian game started, Slovenian list loaded from cache');
  assert.equal((await call('/api/action', { type: 'validate-word', word: 'šola' })).valid, true); ok('offline: "šola" valid');
  const words = await call('/api/words?dictionary=slovenian&length=4'); assert.ok(words.count > 100); ok(`offline: practice word queries work (${words.count} four-letter words)`);
  await page.goto(BASE + '/?debug#/rack/1'); await page.waitForTimeout(1500);
  assert.equal(await page.locator('.tile[data-index]').count(), 7); ok('offline: phone rack view renders');
  const sound = await page.evaluate(async () => (await fetch('sounds/click1.mp3', { headers: { Range: 'bytes=0-99' } })).status); assert.equal(sound, 206); ok('offline: audio Range request answered from cache (206) - what Safari needs');
  assert.equal(errs.length, 0, errs.join('|')); ok('no page errors');
  await browser.close();
});
