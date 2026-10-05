// Deterministic seeding for the design suite (guide §17.4 #4: control the data).
// Builds the same mid-game board on every run: CAT (H), CAR (V), RAT (H),
// TA (V) + AT (H) — five distinct word strings across both poles, so the
// identity, territory and economy probes always measure the same thing.
export const api = {
  async call(page, path, body) {
    return page.evaluate(
      async ([path, body]) =>
        (
          await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).json(),
      [path, body]
    );
  },

  async ready(page) {
    await page.waitForFunction(() => window.__oxy?.backend?.ready);
  },

  async setRack(page, playerId, rack) {
    await page.evaluate(
      ([p, r]) => window.__oxy.backend.engine.debugSetRack(p, r),
      [playerId, rack]
    );
  },

  async place(page, playerId, rackIndex, row, col) {
    const result = await api.call(page, '/api/action', {
      type: 'place-tile',
      playerId,
      rackIndex,
      row,
      col,
    });
    if (!result.success) throw new Error(`place-tile failed: ${JSON.stringify(result)}`);
  },

  async playWord(page, playerId) {
    const result = await api.call(page, '/api/action', { type: 'play-word', playerId });
    if (!result.success) throw new Error(`play-word failed: ${JSON.stringify(result)}`);
    return result;
  },

  /** Restart a 2-player English game and play the fixed cluster. Ends with
   *  five distinct words on the board; it is player 1's turn. */
  async seedBoard(page) {
    await api.call(page, '/api/action', { type: 'restart', playerCount: 2, language: 'english' });
    // 1. CAT across row 7 through the centre.
    await api.setRack(page, 1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    await api.place(page, 1, 0, 7, 7);
    await api.place(page, 1, 0, 7, 8);
    await api.place(page, 1, 0, 7, 9);
    await api.playWord(page, 1);
    // 2. CAR down column 7 through the C.
    await api.setRack(page, 2, ['a', 'r', 'x', 'y', 'z', 'q', 'j']);
    await api.place(page, 2, 0, 8, 7);
    await api.place(page, 2, 0, 9, 7);
    await api.playWord(page, 2);
    // 3. RAT across row 9 through the R.
    await api.setRack(page, 1, ['a', 't', 'x', 'y', 'z', 'q', 'j']);
    await api.place(page, 1, 0, 9, 8);
    await api.place(page, 1, 0, 9, 9);
    await api.playWord(page, 1);
    // 4. O at (8,9): vertical TOT through the two T's, nothing else touched.
    await api.setRack(page, 2, ['o', 'x', 'y', 'z', 'q', 'j', 'k']);
    await api.place(page, 2, 0, 8, 9);
    await api.playWord(page, 2);
  },

  async wordCount(page) {
    return page.evaluate(
      () => window.__oxy.backend.engine.getState().board.flat().filter(Boolean).length
    );
  },
};
