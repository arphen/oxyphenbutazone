import { launch, newPage, api, ok, assert, noPageErrors, run, BASE } from './lib.mjs';

// Minimal reliable end-to-end (see README.md): home load, host-create -> guest-join via
// code/URL (happy path), rejoin after reload, a practice move with a score update on a
// mobile viewport, and a word-list BYOD import smoke test.
//
// Paste flow only, no real camera (scan.e2e covers the fake-camera path). Every wait is
// explicit (testids / engine state / URL); each journey gets an isolated storage context.
run(async () => {
  // WebRTC in a sandbox needs real candidates, not mDNS names (same as p2p.e2e).
  const browser = await launch(['--disable-features=WebRtcHideLocalIpsWithMdns']);
  const call = (page, path, body) => api(page, path, body);
  const pages = [];

  const open = async (page, hash) => {
    await page.goto(BASE + '/?debug#' + hash);
    await page.waitForFunction(() => window.__oxy);
    await page.evaluate(() => window.__oxy.backend.ready);
  };
  const fresh = async (options = { hasTouch: true }) => {
    const { page } = await newPage(browser, options);
    pages.push(page);
    return page;
  };

  console.log('1. Home loads (mobile viewport)');
  const home = await fresh();
  await open(home, '/');
  await home.getByTestId('home-title').waitFor();
  assert.equal(await home.getByTestId('home-title').innerText(), 'Oxyphenbutazone');
  await home.getByRole('heading', { name: 'Odd One Out' }).waitFor();
  await home.getByTestId('start-game-btn').waitFor();
  assert.equal(await home.getByTestId('start-game-btn').isEnabled(), true);
  ok('home: title, Odd One Out card, Start button');

  console.log('2. Host creates an invite; guest joins through the invite link');
  const host = await fresh();
  await open(host, '/host');
  await host.getByTestId('host-start').click();
  await host.getByTestId('host-invite-btn').click();
  await host.getByTestId('signal-text').first().waitFor();
  const invite = await host.getByTestId('signal-text').first().inputValue();
  assert.match(invite, /^OXY[12]\.[A-Za-z0-9_-]+$/);
  ok(`invite created (${invite.length} chars)`);

  // The QR/link form: opening the host's link prefills the invite box.
  const guest = await fresh();
  await guest.goto(BASE + `/?debug#/join?c=${encodeURIComponent(invite)}`);
  await guest.waitForFunction(() => window.__oxy);
  await guest.evaluate(() => window.__oxy.backend.ready);
  assert.equal(await guest.getByTestId('join-invite').inputValue(), invite);
  ok('invite link prefills the guest invite box');
  await guest.getByTestId('join-submit').click();
  await guest.getByTestId('signal-text').waitFor();
  const answer = await guest.getByTestId('signal-text').inputValue();
  assert.match(answer, /^OXY[12]\./);
  ok(`answer created (${answer.length} chars)`);

  await host.getByTestId('host-answer').fill(answer);
  await host.getByTestId('host-connect').click();
  await host.getByText('✓ Connected').waitFor({ timeout: 15000 });
  await guest.waitForURL(/#\/rack\/2/, { timeout: 15000 });
  await guest.getByTestId('rack').waitFor();
  assert.equal(await guest.locator('.tile[data-index]').count(), 7);
  assert.match(await guest.getByTestId('conn-badge').innerText(), /Connected · you are Player 2/);
  ok('guest paired: auto-moved to /rack/2 with 7 tiles');

  console.log('3. A scored move, then the host reloads and the guest rejoins');
  await call(host, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
  await host.evaluate(() => window.__oxy.backend.engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']));
  for (const col of [6, 7, 8]) {
    const r = await call(host, '/api/action', { type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col });
    assert.ok(r.success, JSON.stringify(r));
  }
  const played = await call(host, '/api/action', { type: 'play-word', playerId: 1 });
  assert.ok(played.success && played.score === 10, JSON.stringify(played));
  ok('host played CAT for 10');

  await host.reload();
  await host.waitForFunction(() => window.__oxy);
  await host.evaluate(() => window.__oxy.backend.ready);
  await guest.getByText(/Connection to host lost/).waitFor({ timeout: 20000 });
  ok('guest reports the lost connection');
  await open(host, '/host');
  await host.getByTestId('host-resume').click();
  assert.equal((await call(host, '/api/game-state')).player1.score, 10);
  ok('host resumed the same game after reload (P1 = 10)');
  await host.getByTestId('host-invite-btn').click();
  await host.getByTestId('signal-text').first().waitFor();
  const invite2 = await host.getByTestId('signal-text').first().inputValue();
  await guest.getByRole('link', { name: 'Rejoin' }).click();
  await guest.getByTestId('join-invite').waitFor();
  await guest.getByTestId('join-invite').fill(invite2);
  await guest.getByTestId('join-submit').click();
  await guest.getByTestId('signal-text').waitFor();
  await host.getByTestId('host-answer').fill(await guest.getByTestId('signal-text').inputValue());
  await host.getByTestId('host-connect').click();
  await guest.waitForURL(/#\/rack\/2/, { timeout: 15000 });
  assert.equal((await call(guest, '/api/game-state')).player1.score, 10);
  ok('guest rejoined and sees the same score (P1 = 10)');

  console.log('4. Practice move on a phone viewport: tap places a tile, Play scores');
  const phone = await fresh(); // default viewport is 390x844 with touch
  assert.equal(await phone.evaluate(() => window.innerWidth), 390);
  await open(phone, '/rack/1');
  await call(phone, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
  await phone.evaluate(() => window.__oxy.backend.engine.debugSetRack(1, ['c', 'a', 't', 's', 'x', 'y', 'z']));
  await phone.waitForFunction(
    () => document.querySelector('[data-testid="rack"] .tile .letter')?.textContent.trim() === 'C'
  );
  await phone.locator('[data-testid="rack"] .tile[data-index="0"]').tap();
  await phone.locator('[data-board-row="7"][data-board-col="6"]').tap();
  await phone.waitForFunction(() => window.__oxy.backend.engine.getState().board[7][6].letter === 'c');
  ok('tap tile + tap square placed "c" at row 7, col 6');
  for (const col of [7, 8]) {
    const r = await call(phone, '/api/action', { type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col });
    assert.ok(r.success, JSON.stringify(r));
  }
  await phone.waitForFunction(() => !document.querySelector('[data-testid="play-btn"]').disabled);
  await phone.getByTestId('play-btn').tap();
  await phone.waitForFunction(() => window.__oxy.backend.engine.getState().player1.score === 10);
  const strip = await phone.getByTestId('score-strip').innerText();
  assert.match(strip, /P1\s*10/);
  assert.match(strip, /P2\s*0/);
  ok(`Play scored CAT = 10, strip shows both seats: "${strip.replace(/\s+/g, ' ')}"`);
  await phone.goto(BASE + '/?debug#/freeplay');
  await phone.locator('.alphabet-grid .letter-tile').first().waitFor();
  assert.equal(await phone.getByTestId('list-problem').count(), 0);
  assert.equal((await call(phone, '/api/action', { type: 'validate-word', word: 'cat' })).valid, true);
  ok('free play loads on the open list (CAT valid, no missing-list warning)');

  console.log('5. Word-list BYOD import smoke (tiny fixture)');
  const words = await fresh({ viewport: { width: 1280, height: 800 } });
  await open(words, '/words');
  const card = words.locator('[data-list="csw21"]');
  await card.getByTestId('word-status').waitFor();
  assert.match(await card.getByTestId('word-status').innerText(), /Not installed/);
  const fixture = [
    '# smoke fixture, not a real word list',
    'cat a small domestic animal',
    'rat a rodent',
    'bat a flying mammal',
    'cot a small bed',
    'cut to divide',
    'cart a small vehicle',
    'cater to provide',
    'caterer one who provides food',
    'catering providing food',
    'caterers providers of food',
    'zzyzxsmoke a made-up word for this test',
  ].join('\n');
  await card.getByTestId('word-import').setInputFiles({ name: 'smoke-csw.txt', mimeType: 'text/plain', buffer: Buffer.from(fixture) });
  await words.waitForFunction(
    () => document.querySelector('[data-list="csw21"] [data-testid="word-status"]')?.textContent.includes('Imported')
  );
  ok('tiny CSW21-style file imported');
  assert.equal((await call(words, '/api/action', { type: 'validate-word', word: 'zzyzxsmoke' })).valid, true);
  assert.equal((await call(words, '/api/action', { type: 'validate-word', word: 'dog' })).valid, false);
  ok('game uses the imported list (zzyzxsmoke valid, dog not)');
  await words.reload();
  await words.waitForFunction(() => window.__oxy);
  await words.evaluate(() => window.__oxy.backend.ready);
  await words.waitForFunction(
    () => document.querySelector('[data-list="csw21"] [data-testid="word-status"]')?.textContent.includes('Imported')
  );
  assert.equal((await call(words, '/api/action', { type: 'validate-word', word: 'zzyzxsmoke' })).valid, true);
  ok('import survives a reload');

  noPageErrors(pages, 'smoke');
  await browser.close();
});
