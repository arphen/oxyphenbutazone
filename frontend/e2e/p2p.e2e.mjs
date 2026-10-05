import { launch, newPage, api, ok, sleep, assert, run, BASE } from './lib.mjs';

// Two real browser contexts pair over a real WebRTC data channel using the actual Host/Join screens.
run(async () => {
  // Local IPs hidden behind mDNS names cannot be resolved inside a sandbox; real phones on one network can (that is what the real-phone checklist tests)
  const browser = await launch(['--disable-features=WebRtcHideLocalIpsWithMdns']);
  const mk = () => newPage(browser, { hasTouch: true });
  const A = await mk();
  const G = await mk(); // A = host, G = guest
  const hostApi = (path, body) =>
    A.page.evaluate(
      async ([path, body]) =>
        await (
          await fetch(
            path,
            body
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                }
              : undefined
          )
        ).json(),
      [path, body]
    );
  const guestApi = (path, body) =>
    G.page.evaluate(
      async ([path, body]) =>
        await (
          await fetch(
            path,
            body
              ? {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                }
              : undefined
          )
        ).json(),
      [path, body]
    );

  console.log('1. Host starts a 2-player English game and creates an invite');
  await A.page.goto(BASE + '/?debug#/host');
  await A.page.waitForFunction(() => window.__oxy);
  await A.page.evaluate(() => window.__oxy.backend.ready);
  await A.page.getByRole('button', { name: 'Start hosting' }).click();
  await A.page.getByRole('button', { name: /Invite player 2/ }).click();
  await A.page.locator('.signal-text').first().waitFor();
  const invite = await A.page.locator('.signal-text').first().inputValue();
  assert.match(invite, /^OXY[12]\.[A-Za-z0-9_-]+$/);
  ok(`invite created (${invite.length} chars)`);
  const qr = await A.page.locator('.signal-qr canvas, .signal-qr img').count();
  assert.ok(qr > 0);
  ok('invite QR rendered');

  console.log('2. Guest pastes the invite, gets an answer');
  await G.page.goto(BASE + '/?debug#/join');
  await G.page.locator('textarea.paste').fill(invite);
  await G.page.getByRole('button', { name: 'Join', exact: true }).click();
  await G.page.locator('.signal-text').waitFor();
  const answer = await G.page.locator('.signal-text').inputValue();
  assert.match(answer, /^OXY[12]\./);
  ok(`answer created (${answer.length} chars)`);

  console.log('3. Host pastes the answer -> real WebRTC data channel opens');
  await A.page.locator('textarea.paste').fill(answer);
  await A.page.getByRole('button', { name: 'Connect' }).click();
  await A.page.getByText('✓ Connected').waitFor({ timeout: 15000 });
  ok('host shows Player 2 connected');
  await G.page.waitForURL(/#\/rack\/2/, { timeout: 15000 });
  ok('guest jumped to its rack (/rack/2) by itself');
  await G.page.waitForTimeout(1200);
  assert.equal(await G.page.locator('.tile[data-index]').count(), 7);
  ok('guest rack shows 7 tiles, received over the data channel');
  assert.match(await G.page.locator('.conn-badge').innerText(), /Connected · Player 2/);
  ok('guest badge: "Connected · you are Player 2"');
  assert.match(await A.page.locator('.conn-badge').innerText(), /Hosting · 1 connected/);
  ok('host badge: "Hosting · 1 connected"');

  console.log('4. Host plays CAT; guest sees it');
  await hostApi('/api/action', { type: 'restart', playerCount: 2, language: 'english' }); // fresh game; guest receives pushed state
  await A.page.evaluate(() => {
    const e = window.__oxy.backend.engine;
    e.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    e.debugSetRack(2, ['o', 'd', 'g', 'e', 'i', 'n', 'r']);
  });
  await hostApi('/api/action', { type: 'update-viewport', viewportCenter: { row: 7, col: 7 } }); // pushes the new racks to the guest
  for (const col of [6, 7, 8])
    assert.ok(
      (await hostApi('/api/action', { type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col }))
        .success
    );
  let r = await hostApi('/api/action', { type: 'play-word', playerId: 1 });
  assert.ok(r.success && r.score === 10, JSON.stringify(r));
  ok('host played CAT for 10');
  await sleep(500);
  let gs = await guestApi('/api/game-state');
  assert.equal(gs.player1.score, 10);
  assert.equal(gs.currentPlayer, 2);
  assert.equal(gs.board[7][7].letter, 'a');
  ok('guest state updated: player1=10, board has CAT, its turn');

  console.log("5. Guest plays TO (vertical through the host's T) over the channel");
  r = await guestApi('/api/action', {
    type: 'place-tile',
    playerId: 2,
    rackIndex: 0,
    row: 8,
    col: 8,
  });
  assert.ok(r.success, JSON.stringify(r));
  r = await guestApi('/api/action', { type: 'play-word', playerId: 2 });
  assert.ok(r.success && r.score === 3, JSON.stringify(r));
  ok(`guest's play-word accepted by the host, score=${r.score}`);
  const hs = await hostApi('/api/game-state');
  assert.equal(hs.player2.score, 3);
  assert.equal(hs.currentPlayer, 1);
  ok('host state has player2=3, turn back to host');

  console.log('6. The guest cannot act as the host, or out of turn');
  r = await guestApi('/api/action', { type: 'pass', playerId: 1 });
  assert.equal(r.success, false);
  assert.match(r.error, /not your seat/i);
  ok(`pass as seat 1 refused: ${r.error}`);
  r = await guestApi('/api/action', { type: 'recall', playerId: 2 });
  assert.equal(r.success, false);
  ok(`recall out of turn refused: ${r.error}`);
  r = await guestApi('/api/action', { type: 'evil', playerId: 2 });
  assert.equal(r.success, false);
  ok(`unknown action refused: ${r.error}`);

  console.log(
    '7. Host page reloads (phone slept): game is restored, guest sees the loss, then rejoins'
  );
  await A.page.reload();
  await A.page.waitForFunction(() => window.__oxy);
  await A.page.evaluate(() => window.__oxy.backend.ready);
  await G.page.getByText(/Connection to host lost/).waitFor({ timeout: 20000 });
  ok('guest badge: "Connection to host lost"');
  await A.page.goto(BASE + '/?debug#/host');
  await A.page.waitForFunction(() => window.__oxy);
  await A.page.evaluate(() => window.__oxy.backend.ready);
  await A.page.getByRole('button', { name: /Continue it/ }).click();
  ok('"Continue it" offered after the reload');
  const hs2 = await hostApi('/api/game-state');
  assert.equal(hs2.player1.score, 10);
  assert.equal(hs2.player2.score, 3);
  ok('game restored: 10 - 3');
  await A.page.getByRole('button', { name: /Invite player 2/ }).click();
  const invite2 = await A.page.locator('.signal-text').first().inputValue();
  await G.page.getByRole('link', { name: 'Rejoin' }).click();
  await G.page.locator('textarea.paste').fill(invite2);
  await G.page.getByRole('button', { name: 'Join', exact: true }).click();
  await G.page.locator('.signal-text').waitFor();
  await A.page.locator('textarea.paste').fill(await G.page.locator('.signal-text').inputValue());
  await A.page.getByRole('button', { name: 'Connect' }).click();
  await G.page.waitForURL(/#\/rack\/2/, { timeout: 15000 });
  gs = await guestApi('/api/game-state');
  assert.equal(gs.player1.score, 10);
  assert.equal(gs.player2.score, 3);
  ok('guest rejoined and sees the same game (10 - 3)');

  console.log('8. A garbage invite is rejected with a friendly message');
  const G2 = await mk();
  await G2.page.goto(BASE + '/#/join');
  for (const junk of ['hello', 'OXY1.AAAA', 'OXY1.' + 'A'.repeat(9000)]) {
    await G2.page.locator('textarea.paste').fill(junk);
    await G2.page.getByRole('button', { name: 'Join', exact: true }).click();
    await G2.page.locator('.error').waitFor();
    const msg = await G2.page.locator('.error').innerText();
    ok(`"${junk.slice(0, 14)}…" -> "${msg}"`);
  }

  for (const [n, { page }] of Object.entries({ host: A, guest: G }))
    assert.equal(page.errs.length, 0, n + ' page errors: ' + page.errs.join('|'));
  ok('no page errors on either device');
  await browser.close();
});
