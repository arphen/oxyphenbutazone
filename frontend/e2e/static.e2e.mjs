import { launch, newPage, api, ok, sleep, assert, run, BASE } from './lib.mjs';

// Static site with NO API server: the app runs its own engine in the browser.
run(async () => {
  const browser = await launch([]);
  const { page } = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  const errs = page.errs, apiNet = [], bad = [];
  page.on('request', r => { if (r.url().includes('/api/')) apiNet.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  const call = (path, body) => api(page, path, body);

  console.log('1. Static site, no API server: Home -> Slovenščina, 2 players -> Start');
  await page.goto(BASE + '/?debug#/'); await page.waitForFunction(() => window.__oxy);
  await page.evaluate(() => window.__oxy.backend.ready);
  assert.equal(await page.getByRole('heading', { name: 'Odd One Out' }).count(), 1); ok('odd-one-out card shown (single player needs no laptop host)');
  await page.getByText('Slovenščina').click();
  await page.locator('.player-count-btn', { hasText: '2' }).first().click();
  await page.getByText(/Start 2-Player Game/).click();
  await page.waitForURL(/#\/game/); await page.waitForTimeout(1500);
  let g = await call('/api/game-state');
  assert.equal(g.language, 'slovenian'); assert.equal(g.playerCount, 2); assert.deepEqual(g.dictionaries, { csw21: false, nwl2023: false, enable: false, friendly: false, slovenian: true });
  ok(`local engine answered: language=${g.language}, players=${g.playerCount}, dictionaries=${JSON.stringify(g.dictionaries)}`);

  console.log('2. Play šola through the same /api/action the UI uses');
  await page.evaluate(() => window.__oxy.backend.engine.debugSetRack(1, ['š', 'o', 'l', 'a', 'e', 'i', 'n']));
  for (const col of [5, 6, 7, 8]) { const r = await call('/api/action', { type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col }); assert.ok(r.success, JSON.stringify(r)); }
  let r = await call('/api/action', { type: 'play-word', playerId: 1 });
  assert.ok(r.success, r.gameState.message); assert.equal(r.score, 18); ok(`"šola" accepted by the in-browser Slovenian dictionary, score=${r.score}`);
  await page.waitForTimeout(900);
  const letters = await page.locator('.tile-letter').allTextContents();
  assert.ok(['Š', 'O', 'L', 'A'].every(l => letters.includes(l)), letters.join('')); ok(`board UI shows the tiles: ${letters.join('')}`);

  console.log('3. Reload: the game is restored from local storage');
  await page.reload(); await page.waitForFunction(() => window.__oxy); await page.evaluate(() => window.__oxy.backend.ready);
  g = await call('/api/game-state');
  assert.equal(g.player1.score, 18); assert.equal(g.currentPlayer, 2); assert.equal(g.board[7][5].letter, 'š');
  ok(`after reload: player1 score=${g.player1.score}, current player=${g.currentPlayer}, board[7][5]="${g.board[7][5].letter}"`);

  console.log('4. Other pages work without a server');
  const words = await call('/api/words?dictionary=slovenian&length=5&startsWith=sk'); assert.ok(words.count > 10); ok(`/api/words works (slovenian, 5 letters, "sk…": ${words.count} words)`);
  const v = await call('/api/action', { type: 'validate-word', word: 'žoga' }); assert.equal(v.valid, true); ok('validate-word žoga = valid');
  const v2 = await call('/api/action', { type: 'validate-word', word: 'xyzzy' }); assert.equal(v2.valid, false); ok('validate-word xyzzy = invalid');
  await page.goto(BASE + '/?debug#/rack/2'); await page.waitForTimeout(1500);
  const tiles = await page.locator('.tile[data-index]').count(); assert.equal(tiles, 7); ok('phone rack view renders 7 tiles from the local engine');
  await page.goto(BASE + '/?debug#/flashcards'); await page.waitForTimeout(1500);
  ok('flashcards route loads');

  assert.equal(apiNet.length, 0, 'real network saw: ' + apiNet.join()); ok('no /api request ever reached the network');
  assert.equal(errs.length, 0, errs.join(' | ')); ok('no page errors');
  console.log('  (HTTP errors seen: ' + (bad.length ? bad.join(', ') : 'none') + ')');
  await browser.close();
});
