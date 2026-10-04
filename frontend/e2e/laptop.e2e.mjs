import { launch, newPage, ok, assert, run, BASE } from './lib.mjs';

// Laptop-host mode (vite dev server + game API plugin, started with OXY_TEST=1 for the rack hook).
const act = async (a) => (await fetch(BASE + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) })).json();
const setRack = (playerId, rack) => fetch(BASE + '/api/dev/set-rack', { method: 'POST', body: JSON.stringify({ playerId, rack }) });
const state = async () => (await fetch(BASE + '/api/game-state')).json();

run(async () => {
  const browser = await launch([]);
  const { page: desktop } = await newPage(browser, { viewport: { width: 1280, height: 800 } });
  const errs = desktop.errs;

  console.log('1. Home -> choose Slovenščina -> start 2-player game');
  await desktop.goto(BASE + '/'); await desktop.getByText('Slovenščina').click();
  await desktop.getByText(/Start 4-Player Game/).click().catch(() => {});
  await desktop.getByRole('button', { name: /^\s*2\s*👤👤/ }).click().catch(() => {});
  // re-pick in the correct order: choose 2 players then start
  await desktop.goto(BASE + '/'); await desktop.getByText('Slovenščina').click();
  await desktop.locator('.player-count-btn', { hasText: '2' }).first().click();
  await desktop.getByText(/Start 2-Player Game/).click();
  await desktop.waitForURL(/\/game/); await desktop.waitForTimeout(1500);
  let g = await state();
  assert.equal(g.language, 'slovenian'); assert.equal(g.playerCount, 2);
  assert.deepEqual(g.dictionaries, { csw21: false, nwl2023: false, enable: false, slovenian: true });
  ok(`language=${g.language}, dictionaries=${JSON.stringify(g.dictionaries)}, players=${g.playerCount}`);
  assert.equal(g.tileBag.length + 14, 100); ok('Slovenian bag: 100 tiles total');
  assert.match(await desktop.locator('.tile-language').first().evaluate(e => e.textContent).catch(() => '🇸🇮 Slovenian'), /Sloven/);
  assert.equal(errs.length, 0, errs.join('|')); ok('no page errors on /game');

  console.log('2. Play šola (š=6 o=1 l=1 a=1) across the centre, centre is a double-word -> (6+1+1+1)*2 = 18');
  await setRack(1, ['š', 'o', 'l', 'a', 'e', 'i', 'n']);
  for (const [i, col] of [5, 6, 7, 8].entries()) {
    const gs = await state(); const letter = gs.player1.rack[0];
    const r = await act({ type: 'place-tile', playerId: 1, letter, rackIndex: 0, row: 7, col }); assert.ok(r.success, JSON.stringify(r));
  }
  let r = await act({ type: 'play-word', playerId: 1 });
  assert.ok(r.success, r.gameState.message); assert.equal(r.score, 18);
  ok(`"šola" accepted by the Slovenian dictionary, score=${r.score}`);

  console.log('3. Invalid / illegal things are rejected');
  await setRack(2, ['', 'x', 'q', 'a', 'e', 'i', 'n']);
  r = await act({ type: 'reorder-rack', playerId: 2, newRack: ['z','z','z','z','z','z','z'] });
  assert.equal(r.success, false); ok(`rack reorder that changes tiles rejected: ${r.error}`);
  r = await act({ type: 'place-tile', playerId: 2, letter: 'q', rackIndex: 99, row: 7, col: 9 });
  assert.equal(r.success, false); ok(`out-of-range rackIndex rejected: ${r.error}`);
  r = await act({ type: 'place-tile', playerId: 2, letter: 'q', rackIndex: 1, row: 7, col: 9 });
  assert.ok(r.success); assert.equal(r.gameState.board[7][9].letter, 'x');
  ok('claimed letter "q" ignored: the tile placed is the rack tile "x"');
  await act({ type: 'recall', playerId: 2 });
  await fetch(BASE + '/api/action', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"type":"validate-word","word":"ab","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}' });
  assert.equal(({}).polluted, undefined); ok('__proto__ in body does not pollute');
  const big = await fetch(BASE + '/api/action', { method: 'POST', body: 'x'.repeat(20000) }); assert.equal(big.status, 413); ok('oversized body -> 413');
  const bad = await fetch(BASE + '/api/action', { method: 'POST', body: '{not json' }); assert.equal(bad.status, 400); ok('invalid JSON -> 400');
  await setRack(2, ['', 'x', 'q', 'a', 'e', 'i', 'n']);
  await setRack(2, ['', 'x', 'q', 'a', 'e', 'i', 'n']);
  r = await act({ type: 'place-tile', playerId: 2, letter: '', rackIndex: 0, row: 7, col: 9, chosenLetter: 'w' });
  assert.equal(r.success, false); ok(`blank as "w" rejected: ${r.error}`);
  r = await act({ type: 'place-tile', playerId: 2, letter: '', rackIndex: 0, row: 7, col: 9, chosenLetter: 'š' });
  assert.ok(r.success); ok('blank as "š" accepted');
  r = await act({ type: 'set-blank-letter', row: 7, col: 9, chosenLetter: 'y' }); assert.equal(r.success, false); ok('changing blank to "y" rejected');
  r = await act({ type: 'recall', playerId: 2 });

  console.log('4. Language is fixed for the game; dictionary changes cannot flip it');
  await act({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, enable: false, slovenian: false } });
  g = await state(); assert.equal(g.language, 'slovenian'); assert.deepEqual(g.dictionaries, { csw21: true, nwl2023: false, enable: false, slovenian: false });
  ok('after switching to CSW21 mid-game: language still slovenian');
  r = await act({ type: 'restart' }); assert.equal(r.gameState.language, 'slovenian'); assert.equal(r.gameState.playerCount, 2);
  ok(`plain restart keeps language (${r.gameState.language}) and player count`);
  assert.deepEqual(r.gameState.dictionaries, { csw21: false, nwl2023: false, enable: false, slovenian: true });
  ok('restart repairs a selection that cannot suit the language (csw21-only -> slovenian)');
  await act({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, enable: false, slovenian: true } });
  r = await act({ type: 'restart' });
  assert.deepEqual(r.gameState.dictionaries, { csw21: true, nwl2023: false, enable: false, slovenian: true });
  ok('restart keeps a selection that already includes slovenian (csw21+slovenian union)');

  console.log('5. Phone rack view: picker offers the Slovenian alphabet; values are Slovenian');
  await act({ type: 'restart', playerCount: 2, language: 'slovenian' });
  g = await state(); assert.deepEqual(g.dictionaries, { csw21: false, nwl2023: false, enable: false, slovenian: true });
  ok('switching to slovenian via restart selects the Slovenian dictionary');
  const { page: phone } = await newPage(browser, { hasTouch: true });
  const perrs = phone.errs;
  await phone.goto(BASE + '/#/rack/1'); await phone.waitForTimeout(1500);
  const picker = await phone.evaluate(async () => {
    const vm = document.querySelector('.tile[data-index]').__vueParentComponent;
    let c = vm; while (c && !c.proxy?.alphabet) c = c.parent;
    c.proxy.showBlankPicker = true; await c.proxy.$nextTick();
    return [...document.querySelectorAll('.letter-btn')].map(b => b.textContent.trim());
  });
  assert.deepEqual(picker, 'ABCČDEFGHIJKLMNOPRSŠTUVZŽ'.split('')); ok(`blank picker shows: ${picker.join('')}`);
  assert.equal(perrs.length, 0, perrs.join('|')); ok('no page errors on /rack/1');

  console.log('6. English game still works');
  await act({ type: 'restart', playerCount: 2, language: 'english' });
  g = await state(); assert.equal(g.language, 'english'); assert.deepEqual(g.dictionaries, { csw21: true, nwl2023: false, enable: false, slovenian: false });
  ok('english restart -> csw21 + english tiles');
  await phone.reload(); await phone.waitForTimeout(1200);
  const en = await phone.evaluate(async () => {
    let c = document.querySelector('.tile[data-index]').__vueParentComponent; while (c && !c.proxy?.alphabet) c = c.parent;
    c.proxy.showBlankPicker = true; await c.proxy.$nextTick(); return document.querySelectorAll('.letter-btn').length;
  });
  assert.equal(en, 26); ok('english blank picker has 26 letters');
  await act({ type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: true, enable: false, slovenian: true } });
  r = await act({ type: 'restart', playerCount: 2, language: 'english' });
  assert.deepEqual(r.gameState.dictionaries, { csw21: false, nwl2023: true, enable: false, slovenian: false });
  ok('new english game keeps the NWL2023 preference and drops slovenian');
  await browser.close();
});
