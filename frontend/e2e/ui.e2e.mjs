import { launch, newPage, api, ok, sleep, assert, noPageErrors, run, BASE } from './lib.mjs';

// The phone view driven through its real controls (taps on tiles, squares and buttons), not through the API.
// This catches wiring bugs the API-level suites cannot, e.g. a button sending the wrong kind of value.
run(async () => {
  const browser = await launch();
  const { page } = await newPage(browser, { hasTouch: true });
  const call = (path, body) => api(page, path, body);
  const engine = (fn, ...args) => page.evaluate(([src, args]) => new Function('e', 'args', src)(window.__oxy.backend.engine, args), [fn, args]);
  const cell = (r, c) => page.locator(`[data-board-row="${r}"][data-board-col="${c}"]`);
  const rackTile = (i) => page.locator(`[data-testid="rack"] .tile[data-index="${i}"]`);

  console.log('1. Phone view of player 1: tap a rack tile, then tap a board square');
  await page.goto(BASE + '/?debug#/rack/1');
  await page.waitForFunction(() => window.__oxy);
  await page.evaluate(() => window.__oxy.backend.ready);
  await call('/api/action', { type: 'restart', playerCount: 2, language: 'english' });
  await engine('e.debugSetRack(1, ["c","a","t","s","x","y","z"]); e.debugSetRack(2, ["d","o","g","e","i","n","r"]);');
  await page.waitForTimeout(900); // the view polls the game state
  assert.equal(await page.locator('[data-testid="rack"] .tile').count(), 7); ok('rack shows 7 tiles');
  await rackTile(0).tap();
  await cell(7, 6).tap();
  await page.waitForTimeout(300);
  let board = await engine('return e.getState().board[7][6]');
  assert.equal(board.letter, 'c'); assert.equal(board.isNew, true); ok('tap tile + tap square placed "c" at row 7, col 6 (UI sent a valid integer playerId)');

  console.log('2. Tap the tile you placed to take it back');
  await cell(7, 6).tap();
  await page.waitForTimeout(300);
  board = await engine('return e.getState().board[7][6]');
  assert.equal(board.letter, ''); assert.equal(await engine('return e.getState().player1.rack.length'), 7); ok('placed tile returned to the rack');

  console.log('3. Place CAT by taps and press Play');
  // a tile taken back goes to the end of the rack, so put the rack back in a known order
  await engine('e.debugSetRack(1, ["c","a","t","s","x","y","z"]);');
  await page.waitForTimeout(900);
  for (const [i, col] of [[0, 6], [0, 7], [0, 8]]) { await rackTile(i).tap(); await cell(7, col).tap(); await page.waitForTimeout(250); }
  await page.locator('[data-testid="play-btn"]').tap();
  await page.waitForTimeout(600);
  let s = await engine('return { score: e.getState().player1.score, turn: e.getState().currentPlayer, word: e.getState().board[7][7].letter }');
  assert.deepEqual(s, { score: 10, turn: 2, word: 'a' }); ok('Play button scored CAT = 10 and passed the turn');
  assert.match(await page.locator('[data-testid="turn-status"]').innerText(), /turn/i); ok('header shows whose turn it is: "' + (await page.locator('[data-testid="turn-status"]').innerText()).replace(/\s+/g, ' ') + '"');

  console.log('4. Recall (all) and Pass buttons');
  await page.goto(BASE + '/?debug#/rack/2'); await page.waitForTimeout(1000);
  await rackTile(0).tap(); await cell(8, 8).tap(); await page.waitForTimeout(250); // d under the T? just a placed tile
  assert.equal(await engine('return e.getState().board[8][8].isNew'), true);
  await page.locator('[data-testid="recall-btn"]').tap(); await page.waitForTimeout(400);
  assert.equal(await engine('return e.getState().board[8][8].isNew'), false); ok('Recall button took the tile back');
  await page.locator('[data-testid="pass-btn"]').tap(); await page.waitForTimeout(500);
  s = await engine('return { turn: e.getState().currentPlayer, passes: e.getState().consecutivePasses }');
  assert.deepEqual(s, { turn: 1, passes: 1 }); ok('Pass button passed the turn (player 2 -> player 1)');

  console.log('5. Not your turn: tapping does nothing harmful');
  await rackTile(0).tap(); await cell(6, 7).tap(); await page.waitForTimeout(400);
  assert.equal(await engine('return e.getState().board[6][7].letter'), ''); ok('player 2 cannot place while it is player 1\'s turn');

  console.log('6. Shuffle keeps the same tiles');
  const before = await engine('return [...e.getState().player2.rack].sort().join("")');
  await page.locator('[data-testid="shuffle-btn"]').tap(); await page.waitForTimeout(500);
  assert.equal(await engine('return [...e.getState().player2.rack].sort().join("")'), before); ok('Shuffle reordered without changing the tiles');

  noPageErrors(page, 'phone');
  await browser.close();
});
