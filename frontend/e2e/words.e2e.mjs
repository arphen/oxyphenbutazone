import { launch, newPage, api, ok, assert, noPageErrors, run, BASE } from './lib.mjs';

// The public build ships no CSW21: the host imports it from a file, and everything (the host's own games and a
// guest's word checks) then uses that list. The guest never needs the list: words are checked on the host's phone.
run(async () => {
  const browser = await launch(['--disable-features=WebRtcHideLocalIpsWithMdns']);
  const { page: host } = await newPage(browser, { hasTouch: true });
  const { page: guest } = await newPage(browser, { hasTouch: true });
  const hostApi = (path, body) => api(host, path, body);
  const guestApi = (path, body) => api(guest, path, body);

  // A small CSW-style file: "WORD definition [metadata]", a licence comment line, and one word only this list has
  const triples = [];
  for (const a of 'abcdefghij') for (const b of 'aeiou') for (const c of 'rstln') triples.push(`${a}${b}${c} a made-up three-letter word [n ${a}${b}${c}S]`);
  const file = Buffer.from(['# a licence header line that is not a word', ...triples, 'ZZYZX a made-up word for this test [n ZZYZXES]'].join('\n'));

  console.log('1. Host: the public build has no CSW21, so import it from a file');
  await host.goto(BASE + '/?debug#/words');
  await host.waitForFunction(() => window.__oxy);
  await host.evaluate(() => window.__oxy.backend.ready);
  const card = host.locator('[data-list="csw21"].card');
  assert.match(await card.locator('.status').innerText(), /Not installed/); ok('CSW21 shows "Not installed"');
  assert.equal(await hostApi('/api/game-state').then((g) => g.dictionaries.enable), true); ok('the host starts on the open ENABLE list');
  await card.locator('input[type=file]').setInputFiles({ name: 'csw.txt', mimeType: 'text/plain', buffer: file });
  await card.locator('.status', { hasText: 'Imported' }).waitFor();
  ok('status: "' + (await card.locator('.status').innerText()).replace(/\s+/g, ' ') + '"');
  const state = await hostApi('/api/game-state');
  assert.deepEqual(state.dictionaries, { csw21: true, nwl2023: false, enable: false, slovenian: false });
  assert.equal(state.message, 'CSW21 imported; now using it.'); ok(`importing switched the game to it by itself: "${state.message}"`);
  assert.equal((await hostApi('/api/action', { type: 'validate-word', word: 'zzyzx' })).valid, true);
  assert.equal((await hostApi('/api/action', { type: 'validate-word', word: 'dog' })).valid, false); ok('the host now plays by the imported list ("zzyzx" valid, ENABLE-only "dog" not)');

  console.log('2. Host a new game: it uses the imported list, no extra steps');
  await host.goto(BASE + '/?debug#/host');
  await host.waitForFunction(() => window.__oxy);
  await host.evaluate(() => window.__oxy.backend.ready);
  await host.getByRole('button', { name: 'Start hosting' }).click();
  await host.getByRole('button', { name: /Invite player 2/ }).click();
  assert.equal((await hostApi('/api/game-state')).dictionaries.csw21, true); ok('the new hosted game is on CSW21');

  console.log('3. A guest with NO word list joins; its word checks run on the host\'s list');
  await guest.goto(BASE + '/?debug#/join');
  await guest.locator('textarea.paste').fill(await host.locator('.signal-text').first().inputValue());
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await guest.locator('.signal-text').waitFor();
  await host.locator('textarea.paste').fill(await guest.locator('.signal-text').inputValue());
  await host.getByRole('button', { name: 'Connect' }).click();
  await guest.waitForURL(/#\/rack\/2/, { timeout: 15000 });
  const own = await guest.evaluate(() => window.__oxy.backend.listStatus()); // the guest device's own lists (not the active game)
  assert.deepEqual([own.csw21.imported, own.csw21.loaded], [false, false]); ok('the guest has no CSW21 on its own device');
  assert.equal((await guestApi('/api/action', { type: 'validate-word', word: 'zzyzx' })).valid, true);
  assert.equal((await guestApi('/api/action', { type: 'validate-word', word: 'dog' })).valid, false); ok('guest "validate-word": zzyzx valid, dog invalid, answered by the host\'s imported list');

  console.log('4. The import survives a reload');
  await host.goto(BASE + '/?debug#/words');
  await host.reload();
  await host.waitForFunction(() => window.__oxy);
  await host.evaluate(() => window.__oxy.backend.ready);
  assert.match(await host.locator('[data-list="csw21"].card .status').innerText(), /Imported/); ok('still "Imported" after a reload');
  assert.equal((await hostApi('/api/action', { type: 'validate-word', word: 'zzyzx' })).valid, true); ok('and still valid');

  noPageErrors([host, guest], 'host/guest');
  await browser.close();
});
