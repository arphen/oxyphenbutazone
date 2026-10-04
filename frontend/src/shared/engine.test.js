import { describe, it, expect } from 'vitest';
import { createEngine } from './engine.js';
import { createDictionaryStore } from './dictionary.js';
import { TILE_DISTRIBUTIONS, getAlphabet } from './rules.js';

// Simple LCG RNG for deterministic tests
const createSeededRng = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

// Tiny inline dictionaries. CAT is in both English lists with different definitions (CSW21 must win);
// DOG is NWL2023-only; AT has no definition.
const CSW21 = ['cat a small feline', 'cot a small bed', 'at', 'to', 'ta', 'cottage a small house'].join('\n');
const NWL2023 = ['cat nwl-feline', 'dog a canine'].join('\n');
const SLOVENIAN = ['miza table', 'stol chair'].join('\n');

const makeStore = () => {
  const store = createDictionaryStore();
  store.load('csw21', CSW21);
  store.load('nwl2023', NWL2023);
  store.load('slovenian', SLOVENIAN);
  return store;
};

const makeEngine = (seed = 12345) => createEngine(makeStore(), { random: createSeededRng(seed) });

/** A started game for `playerCount` players (language optional). */
const newGame = (playerCount = 2, language, seed) => {
  const engine = makeEngine(seed);
  const action = { type: 'restart', playerCount };
  if (language) action.language = language;
  const result = engine.dispatch(action);
  expect(result.success).toBe(true);
  return engine;
};

/** Put the tile `letter` (from the player's real rack) on the board. Asserts the placement succeeded. */
const place = (engine, playerId, letter, row, col, chosenLetter) => {
  const rack = engine.getState()[`player${playerId}`].rack;
  const rackIndex = rack.indexOf(letter);
  expect(rackIndex).toBeGreaterThanOrEqual(0);
  const action = { type: 'place-tile', playerId, rackIndex, row, col };
  if (chosenLetter) action.chosenLetter = chosenLetter;
  const result = engine.dispatch(action);
  expect(result.success).toBe(true);
  return result;
};

/** Place a whole word starting at (row, col). `blanks` maps an index in the word to the letter the blank stands for. */
const placeWord = (engine, playerId, word, row, col, direction = 'horizontal', blanks = {}) => {
  [...word].forEach((ch, i) => {
    const r = direction === 'vertical' ? row + i : row;
    const c = direction === 'horizontal' ? col + i : col;
    if (i in blanks) place(engine, playerId, '', r, c, blanks[i]);
    else place(engine, playerId, ch, r, c);
  });
};

const play = (engine, playerId) => engine.dispatch({ type: 'play-word', playerId });
const pass = (engine, playerId) => engine.dispatch({ type: 'pass', playerId });

const newTileCells = (engine) => {
  const cells = [];
  engine.getState().board.forEach((row, r) => row.forEach((cell, c) => { if (cell.isNew) cells.push([r, c]); }));
  return cells;
};
const lockedCount = (engine) => engine.getState().board.flat().filter((c) => c.locked).length;
const sortedTiles = (tiles) => [...tiles].sort();

/** Lock a tile directly on the live board (to set up positions that would take many turns to reach). */
const lockTile = (engine, row, col, letter) => {
  Object.assign(engine.getState().board[row][col], { letter, locked: true, isNew: false });
};

describe('initial state', () => {
  it('a fresh engine is a 4-player english game with the default CSW21 selection', () => {
    const engine = makeEngine();
    const s = engine.getState();
    expect(s.playerCount).toBe(4);
    expect(s.language).toBe('english');
    expect(s.currentPlayer).toBe(1);
    expect(s.dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: false });
    expect(s.gameOver).toBe(false);
    expect(s.winner).toBeNull();
    expect(s.finalScores).toBeNull();
    expect(s.consecutivePasses).toBe(0);
    expect(s.viewportCenter).toEqual({ row: 7, col: 7 });
    expect(s.gameId).toMatch(/^[A-Z0-9]{1,6}$/);
  });

  it.each([
    [2, 86],
    [3, 79],
    [4, 72],
  ])('restart with %i players: racks of 7 and bag of 100 - 7*players = %i', (players, bagSize) => {
    const engine = newGame(players);
    const s = engine.getState();
    expect(s.playerCount).toBe(players);
    for (let i = 1; i <= players; i++) {
      expect(s[`player${i}`].rack).toHaveLength(7);
      expect(s[`player${i}`].score).toBe(0);
      expect(s[`player${i}`].history).toEqual([]);
      expect(s[`player${i}`].playerName).toBe(`Player ${i}`);
    }
    expect(s[`player${players + 1}`]).toBeUndefined();
    expect(s.tileBag).toHaveLength(bagSize);
    expect(bagSize).toBe(100 - 7 * players);
  });

  it('only player 1 is current at the start', () => {
    const s = newGame(3).getState();
    expect(s.player1.isCurrentPlayer).toBe(true);
    expect(s.player2.isCurrentPlayer).toBe(false);
    expect(s.player3.isCurrentPlayer).toBe(false);
  });

  it('racks + bag hold exactly the english distribution (100 tiles, 2 blanks)', () => {
    const s = newGame(3).getState();
    const all = [...s.player1.rack, ...s.player2.rack, ...s.player3.rack, ...s.tileBag];
    expect(all).toHaveLength(100);
    expect(all.filter((t) => t === '')).toHaveLength(2);
    expect(all.filter((t) => t === 'e')).toHaveLength(12);
    expect(all.filter((t) => t === 'q')).toHaveLength(1);
  });

  it('the board starts empty with premium squares in place', () => {
    const s = makeEngine().getState();
    expect(s.board).toHaveLength(15);
    expect(s.board.flat().every((c) => c.letter === '' && !c.isNew && !c.locked && !c.isBlank)).toBe(true);
    expect(s.board[7][7].type).toBe('center');
    expect(s.board[0][0].type).toBe('tw');
    expect(s.board[7][3].type).toBe('dl');
  });

  it('is deterministic for the same seed', () => {
    const a = newGame(2, undefined, 99).getState();
    const b = newGame(2, undefined, 99).getState();
    expect(a.player1.rack).toEqual(b.player1.rack);
    expect(a.player2.rack).toEqual(b.player2.rack);
    expect(a.tileBag).toEqual(b.tileBag);
  });

  it('differs for different seeds', () => {
    const a = newGame(2, undefined, 1).getState();
    const b = newGame(2, undefined, 2).getState();
    expect(a.tileBag).not.toEqual(b.tileBag);
  });

  it('dispatch results carry the live game state', () => {
    const engine = makeEngine();
    const result = engine.dispatch({ type: 'update-viewport', viewportCenter: { row: 1, col: 2 } });
    expect(result.gameState).toBe(engine.getState());
    expect(result.gameState.viewportCenter).toEqual({ row: 1, col: 2 });
  });

  it('exposes the dictionary store', () => {
    const engine = makeEngine();
    expect(engine.dictionary.has('cat')).toBe(true);
  });
});

describe('place-tile', () => {
  it('moves the rack tile onto the board as a new tile', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 1, row: 7, col: 7 });
    expect(result.success).toBe(true);
    const s = engine.getState();
    expect(s.board[7][7]).toMatchObject({ letter: 'a', isNew: true, locked: false, isBlank: false });
    expect(s.player1.rack).toEqual(['c', 't', 'x', 'y', 'z', 'q']);
  });

  it('ignores a client-supplied letter and uses the rack tile', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, letter: 'z' });
    expect(result.success).toBe(true);
    expect(engine.getState().board[7][7].letter).toBe('c');
    expect(engine.getState().player1.rack).not.toContain('c');
    expect(engine.getState().player1.rack).toContain('z'); // the real z is still in the rack
  });

  it('a blank in the rack stays a blank even if the client claims a letter', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['', 'a', 't', 'x', 'y', 'z', 'q']);
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, letter: 'q' });
    expect(engine.getState().board[7][7]).toMatchObject({ letter: '', isBlank: true, chosenLetter: '', isNew: true });
  });

  it('a chosenLetter is ignored for a normal tile', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'z' });
    expect(engine.getState().board[7][7]).toMatchObject({ letter: 'c', isBlank: false, chosenLetter: '' });
  });

  it('refuses when it is not the player\'s turn', () => {
    const engine = newGame(2);
    const before = [...engine.getState().player2.rack];
    const result = engine.dispatch({ type: 'place-tile', playerId: 2, rackIndex: 0, row: 7, col: 7 });
    expect(result).toMatchObject({ success: false, error: 'Not your turn' });
    expect(engine.getState().player2.rack).toEqual(before);
    expect(newTileCells(engine)).toEqual([]);
  });

  it('refuses an unknown player seat', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'place-tile', playerId: 3, rackIndex: 0, row: 7, col: 7 });
    expect(result).toMatchObject({ success: false, error: 'Player 3 not found' });
  });

  it('refuses a rack index beyond the current rack', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 2, row: 7, col: 7 });
    expect(result).toMatchObject({ success: false, error: 'Invalid rack index' });
    expect(engine.getState().player1.rack).toEqual(['c', 'a']);
  });

  it('refuses an occupied square (new tile or locked tile) and keeps the rack', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 7);
    const again = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7 });
    expect(again).toMatchObject({ success: false, error: 'Square occupied' });
    expect(engine.getState().player1.rack).toHaveLength(6);
    expect(engine.getState().board[7][7].letter).toBe('c');
  });

  it('refuses a square holding a blank tile', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, '', 7, 7, 'e');
    const again = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7 });
    expect(again).toMatchObject({ success: false, error: 'Square occupied' });
  });
});

describe('first move placement rules', () => {
  it('rejects a first word that does not cover the centre (no-center) and leaves the tiles on the board', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 3, 3);
    const result = play(engine, 1);
    expect(result.success).toBe(false);
    expect(result.code).toBe('no-center');
    expect(result.error).toMatch(/center/);
    expect(newTileCells(engine)).toEqual([[3, 3], [3, 4], [3, 5]]);
    expect(engine.getState().player1.rack).toHaveLength(4);
    expect(engine.getState().currentPlayer).toBe(1);
    expect(engine.getState().player1.score).toBe(0);
    expect(engine.getState().messageType).toBe('error');
  });

  it('rejects tiles that are not in one line (not-in-line) and keeps them placed', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 7);
    place(engine, 1, 'a', 8, 8);
    const result = play(engine, 1);
    expect(result.success).toBe(false);
    expect(result.code).toBe('not-in-line');
    expect(newTileCells(engine)).toEqual([[7, 7], [8, 8]]);
    expect(engine.getState().currentPlayer).toBe(1);
    expect(lockedCount(engine)).toBe(0);
  });

  it('rejects tiles with a gap between them (gap), horizontal and vertical', () => {
    const horizontal = newGame(2);
    horizontal.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(horizontal, 1, 'c', 7, 6);
    place(horizontal, 1, 't', 7, 8); // (7,7) left empty
    const h = play(horizontal, 1);
    expect(h.success).toBe(false);
    expect(h.code).toBe('gap');
    expect(newTileCells(horizontal)).toEqual([[7, 6], [7, 8]]);

    const vertical = newGame(2);
    vertical.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(vertical, 1, 'c', 6, 7);
    place(vertical, 1, 't', 8, 7);
    const v = play(vertical, 1);
    expect(v.success).toBe(false);
    expect(v.code).toBe('gap');
    expect(vertical.getState().currentPlayer).toBe(1);
  });

  it('a gap does not stop the player from filling it and then playing', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 6);
    place(engine, 1, 't', 7, 8);
    expect(play(engine, 1).code).toBe('gap');
    place(engine, 1, 'a', 7, 7);
    const result = play(engine, 1);
    expect(result.success).toBe(true);
    expect(result.score).toBe(10);
  });

  it('refuses play-word with no tiles placed', () => {
    const engine = newGame(2);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: false, error: 'No tiles placed' });
    expect(engine.getState().message).toBe('No tiles placed!');
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('a single tile on the centre forms no word and stays on the board', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 7);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: false, error: 'No valid words' });
    expect(newTileCells(engine)).toEqual([[7, 7]]);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('refuses play-word when it is not your turn', () => {
    const engine = newGame(2);
    expect(play(engine, 2)).toMatchObject({ success: false, error: 'Not your turn' });
  });

  it('refuses play-word for an unknown seat', () => {
    const engine = newGame(2);
    expect(play(engine, 4)).toMatchObject({ success: false, error: 'Player 4 not found' });
  });
});

describe('connected placement (after the first word)', () => {
  const afterCat = () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    expect(play(engine, 1).success).toBe(true);
    return engine;
  };

  it('rejects a word not touching any locked tile (not-connected) and keeps the tiles', () => {
    const engine = afterCat();
    engine.debugSetRack(2, ['c', 'o', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 2, 'cot', 1, 1);
    const result = play(engine, 2);
    expect(result.success).toBe(false);
    expect(result.code).toBe('not-connected');
    expect(result.error).toMatch(/connect/);
    expect(newTileCells(engine)).toEqual([[1, 1], [1, 2], [1, 3]]);
    expect(engine.getState().currentPlayer).toBe(2);
    expect(engine.getState().player2.score).toBe(0);
  });

  it('does not require covering the centre again', () => {
    const engine = afterCat();
    engine.debugSetRack(2, ['c', 'o', 'z', 'x', 'y', 'z', 'q']);
    placeWord(engine, 2, 'co', 5, 8, 'vertical'); // c(5,8), o(6,8) above the locked t(7,8) -> "cot"
    const result = play(engine, 2);
    expect(result.success).toBe(true);
  });

  it('diagonal contact is not a connection', () => {
    const engine = afterCat();
    engine.debugSetRack(2, ['t', 'o', 'z', 'x', 'y', 'z', 'q']);
    placeWord(engine, 2, 'to', 8, 9); // (8,9) is diagonal to t(7,8); (8,10) is further away
    const result = play(engine, 2);
    expect(result.success).toBe(false);
    expect(result.code).toBe('not-connected');
  });
});

describe('scoring a legal word', () => {
  it('first word CAT across the centre: (3+1+1) * 2 = 10, locks tiles, refills the rack, passes the turn', () => {
    // C(7,6) plain 3, A(7,7) centre (DW) 1, T(7,8) plain 1 -> letters 5, word multiplier 2 -> 10
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    const bagBefore = engine.getState().tileBag.length; // 86
    placeWord(engine, 1, 'cat', 7, 6);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: true, score: 10 });
    expect(result.gameOver).toBeUndefined();

    const s = engine.getState();
    expect(s.player1.score).toBe(10);
    // tiles locked, no new tiles
    expect(newTileCells(engine)).toEqual([]);
    for (const [col, letter] of [[6, 'c'], [7, 'a'], [8, 't']]) {
      expect(s.board[7][col]).toMatchObject({ letter, locked: true, isNew: false });
    }
    // rack refilled to 7 from the bag: the 4 leftover tiles stay, 3 new ones come from the bag
    expect(s.player1.rack).toHaveLength(7);
    expect(s.player1.rack.slice(0, 4)).toEqual(['x', 'y', 'z', 'q']);
    expect(s.tileBag).toHaveLength(bagBefore - 3);
    // turn passes
    expect(s.currentPlayer).toBe(2);
    expect(s.player1.isCurrentPlayer).toBe(false);
    expect(s.player2.isCurrentPlayer).toBe(true);
    expect(s.consecutivePasses).toBe(0);
    expect(s.messageType).toBe('success');
    expect(s.message).toBe('Valid! cat (10) = 10 points');
  });

  it('records a history entry with word, score, CSW21 definition and total', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    const [entry] = engine.getState().player1.history;
    expect(entry).toMatchObject({
      turnNumber: 1,
      totalScore: 10,
      bingoBonus: 0,
      words: [{ word: 'cat', score: 10, definition: 'a small feline' }], // CSW21 beats NWL2023's "nwl-feline"
    });
    expect(typeof entry.timestamp).toBe('string');
  });

  it('uses "Definition not available" when the word has no definition', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 't', 'x', 'y', 'z', 'q', 'q']);
    placeWord(engine, 1, 'at', 7, 7);
    expect(play(engine, 1).success).toBe(true);
    // A(7,7) centre DW 1 + T(7,8) 1 = 2 * 2 = 4
    expect(engine.getState().player1.history[0].words).toEqual([{ word: 'at', score: 4, definition: 'Definition not available' }]);
    expect(engine.getState().player1.score).toBe(4);
  });

  it('a vertical first word works too: C(5,7) A(6,7) T(7,7 centre) = 5 * 2 = 10', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 5, 7, 'vertical');
    expect(play(engine, 1)).toMatchObject({ success: true, score: 10 });
  });

  it('second word extends a locked tile and applies a double-letter on the new tile only', () => {
    // Locked CAT at row 7 cols 6..8. Player 2 plays vertical COT down col 8: C(5,8) plain 3, O(6,8) DL 1*2=2, T(7,8) locked 1 -> 6
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    engine.debugSetRack(2, ['c', 'o', 'z', 'q', 'q', 'q', 'q']);
    placeWord(engine, 2, 'co', 5, 8, 'vertical');
    const result = play(engine, 2);
    expect(result).toMatchObject({ success: true, score: 6 });
    expect(engine.getState().player2.score).toBe(6);
    expect(engine.getState().player1.score).toBe(10);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('scores every word formed: horizontal TO plus the two vertical words AT and TO', () => {
    // Locked CAT row 7 cols 6..8 (a at col 7, t at col 8). Player 2 places T(8,7) and O(8,8).
    //  horizontal "to": T(8,7) plain 1 + O(8,8) DL 1*2 = 3
    //  vertical   "at": A(7,7) locked 1 + T(8,7) plain 1 = 2
    //  vertical   "to": T(7,8) locked 1 + O(8,8) DL 2 = 3
    //  total 8
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    engine.debugSetRack(2, ['t', 'o', 'z', 'q', 'q', 'q', 'q']);
    placeWord(engine, 2, 'to', 8, 7);
    const result = play(engine, 2);
    expect(result).toMatchObject({ success: true, score: 8 });
    const words = engine.getState().player2.history[0].words;
    expect(words.map((w) => `${w.word}:${w.score}`).sort()).toEqual(['at:2', 'to:3', 'to:3']);
  });

  it('a triple-word square multiplies by 3: C,A locked at (7,12),(7,13), T on TW (7,14) = (3+1+1)*3 = 15', () => {
    const engine = newGame(2);
    lockTile(engine, 7, 12, 'c');
    lockTile(engine, 7, 13, 'a');
    engine.debugSetRack(1, ['t', 'z', 'z', 'z', 'z', 'z', 'z']);
    place(engine, 1, 't', 7, 14);
    expect(play(engine, 1)).toMatchObject({ success: true, score: 15 });
  });

  it('a triple-letter square triples only the new tile: C new on TL (5,5), A,T locked = 3*3 + 1 + 1 = 11', () => {
    const engine = newGame(2);
    lockTile(engine, 5, 6, 'a');
    lockTile(engine, 5, 7, 't');
    engine.debugSetRack(1, ['c', 'z', 'z', 'z', 'z', 'z', 'z']);
    place(engine, 1, 'c', 5, 5);
    expect(play(engine, 1)).toMatchObject({ success: true, score: 11 });
  });

  it('premium squares under already-locked tiles do not count again: C locked on DL (6,6); A(6,7) plain, T(6,8) DL -> 3 + 1 + 1*2 = 6', () => {
    const engine = newGame(2);
    lockTile(engine, 6, 6, 'c');
    engine.debugSetRack(1, ['a', 't', 'z', 'z', 'z', 'z', 'z']);
    place(engine, 1, 'a', 6, 7);
    place(engine, 1, 't', 6, 8);
    expect(play(engine, 1)).toMatchObject({ success: true, score: 6 });
  });

  it('a double-word square multiplies the whole word: vertical CAT, C new on DW (4,4), A,T locked at (5,4),(6,4) = (3+1+1)*2 = 10', () => {
    // A and T locked below the DW square at (4,4).
    const engine = newGame(2);
    lockTile(engine, 5, 4, 'a');
    lockTile(engine, 6, 4, 't');
    engine.debugSetRack(1, ['c', 'z', 'z', 'z', 'z', 'z', 'z']);
    place(engine, 1, 'c', 4, 4);
    expect(play(engine, 1)).toMatchObject({ success: true, score: 10 });
  });

  it('a bingo (7 tiles) adds 50: COTTAGE across row 7 cols 7..13', () => {
    // C(7,7) centre DW 3, O(7,8) 1, T(7,9) 1, T(7,10) 1, A(7,11) DL 1*2=2, G(7,12) 2, E(7,13) 1
    // letters = 3+1+1+1+2+2+1 = 11, word x2 = 22, bingo +50 = 72
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'o', 't', 't', 'a', 'g', 'e']);
    const bagBefore = engine.getState().tileBag.length;
    placeWord(engine, 1, 'cottage', 7, 7);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: true, score: 72 });
    const s = engine.getState();
    expect(s.player1.score).toBe(72);
    expect(s.player1.history[0]).toMatchObject({ bingoBonus: 50, totalScore: 72 });
    expect(s.player1.history[0].words).toEqual([{ word: 'cottage', score: 22, definition: 'a small house' }]);
    expect(s.message).toBe('Valid! cottage (22) +50 BINGO! = 72 points');
    expect(s.player1.rack).toHaveLength(7); // refilled with all 7
    expect(s.tileBag).toHaveLength(bagBefore - 7);
  });

  it('a 6-tile play gets no bingo bonus', () => {
    const engine = newGame(2);
    lockTile(engine, 7, 13, 'e');
    engine.debugSetRack(1, ['c', 'o', 't', 't', 'a', 'g', 'z']);
    placeWord(engine, 1, 'cottag', 7, 7); // plus locked 'e' at (7,13) -> "cottage" with 6 new tiles
    // C(7,7) 3 + O 1 + T 1 + T 1 + A(7,11) DL 2 + G 2 + E locked 1 = 11, x2 = 22, no bonus
    expect(play(engine, 1)).toMatchObject({ success: true, score: 22 });
    expect(engine.getState().player1.history[0].bingoBonus).toBe(0);
  });

  it('consecutivePasses resets to 0 after a successful play', () => {
    const engine = newGame(3);
    pass(engine, 1);
    expect(engine.getState().consecutivePasses).toBe(1);
    engine.debugSetRack(2, ['c', 'a', 't', 'z', 'z', 'z', 'z']);
    placeWord(engine, 2, 'cat', 7, 6);
    expect(play(engine, 2).success).toBe(true);
    expect(engine.getState().consecutivePasses).toBe(0);
  });
});

describe('invalid words', () => {
  it('returns tiles to the rack, logs an invalid history entry, scores nothing and passes the turn', () => {
    const engine = newGame(2);
    const original = ['c', 'a', 'x', 'y', 'z', 'q', 'q'];
    engine.debugSetRack(1, original);
    placeWord(engine, 1, 'cax', 7, 6);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: false, error: 'Invalid words' });

    const s = engine.getState();
    expect(newTileCells(engine)).toEqual([]);
    expect(s.board[7].every((c) => c.letter === '' && !c.locked)).toBe(true);
    expect(sortedTiles(s.player1.rack)).toEqual(sortedTiles(original));
    expect(s.player1.score).toBe(0);
    expect(s.player1.history).toHaveLength(1);
    expect(s.player1.history[0]).toMatchObject({
      turnNumber: 1,
      action: 'invalid',
      totalScore: 0,
      words: [{ word: 'cax', score: 0, definition: 'Not in dictionary' }],
    });
    expect(s.currentPlayer).toBe(2);
    expect(s.player2.isCurrentPlayer).toBe(true);
    expect(s.message).toBe('Invalid word(s): cax');
    expect(s.messageType).toBe('error');
  });

  it('lists all the invalid words when several are formed', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    // P2: x at (8,7) and y at (8,8) -> "xy" horizontal, "ax" vertical, "ty" vertical: all invalid
    engine.debugSetRack(2, ['x', 'y', 'q', 'q', 'q', 'q', 'q']);
    placeWord(engine, 2, 'xy', 8, 7);
    const result = play(engine, 2);
    expect(result.success).toBe(false);
    const entry = engine.getState().player2.history[0];
    expect(entry.action).toBe('invalid');
    expect(entry.words.map((w) => w.word).sort()).toEqual(['ax', 'ty', 'xy']);
    expect(engine.getState().message).toMatch(/^Invalid word\(s\): /);
  });

  it('a rejected word still counts as a turn but does not touch consecutivePasses', () => {
    const engine = newGame(2);
    pass(engine, 1);
    engine.debugSetRack(2, ['c', 'a', 'x', 'q', 'q', 'q', 'q']);
    placeWord(engine, 2, 'cax', 7, 6);
    play(engine, 2);
    expect(engine.getState().consecutivePasses).toBe(1);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('a blank used in an invalid word goes back to the rack as a blank', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', '', 'q', 'q', 'q', 'q']);
    placeWord(engine, 1, 'cax', 7, 6, 'horizontal', { 2: 'x' });
    expect(engine.getState().board[7][8]).toMatchObject({ isBlank: true, chosenLetter: 'x' });
    const result = play(engine, 1);
    expect(result.success).toBe(false);
    const s = engine.getState();
    expect(s.player1.rack).toHaveLength(7);
    expect(s.player1.rack).toContain('');
    expect(s.board[7][8]).toMatchObject({ isBlank: false, chosenLetter: '', letter: '', isNew: false });
  });
});

describe('blank tiles', () => {
  it('play-word with an unassigned blank is refused with unassignedBlanks and keeps the tiles', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', '', 'q', 'q', 'q', 'q']);
    place(engine, 1, 'c', 7, 6);
    place(engine, 1, 'a', 7, 7);
    place(engine, 1, '', 7, 8); // no chosen letter
    const result = play(engine, 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unassigned blanks');
    expect(result.unassignedBlanks).toEqual([{ row: 7, col: 8 }]);
    expect(newTileCells(engine)).toEqual([[7, 6], [7, 7], [7, 8]]);
    expect(engine.getState().currentPlayer).toBe(1);
    expect(engine.getState().message).toBe('Please assign letters to all blank tiles!');
  });

  it('chosenLetter at placement time works: blank T scores 0 -> (3+1+0)*2 = 8, board shows blank', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', '', 'q', 'q', 'q', 'q']);
    placeWord(engine, 1, 'cat', 7, 6, 'horizontal', { 2: 't' });
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: true, score: 8 });
    const cell = engine.getState().board[7][8];
    expect(cell).toMatchObject({ isBlank: true, chosenLetter: 't', letter: '', locked: true, isNew: false });
    expect(engine.getState().player1.history[0].words[0]).toMatchObject({ word: 'cat', score: 8 });
  });

  it('set-blank-letter assigns a letter after placement and then play works', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', '', 'q', 'q', 'q', 'q']);
    place(engine, 1, 'c', 7, 6);
    place(engine, 1, 'a', 7, 7);
    place(engine, 1, '', 7, 8);
    expect(play(engine, 1).error).toBe('Unassigned blanks');
    const set = engine.dispatch({ type: 'set-blank-letter', row: 7, col: 8, chosenLetter: 't' });
    expect(set.success).toBe(true);
    expect(engine.getState().board[7][8].chosenLetter).toBe('t');
    expect(play(engine, 1)).toMatchObject({ success: true, score: 8 });
  });

  it('set-blank-letter can reassign a blank that is still new', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['', 'a', 'q', 'q', 'q', 'q', 'q']);
    place(engine, 1, '', 7, 7, 'e');
    const set = engine.dispatch({ type: 'set-blank-letter', row: 7, col: 7, chosenLetter: 'x' });
    expect(set.success).toBe(true);
    expect(engine.getState().board[7][7].chosenLetter).toBe('x');
  });

  it('refuses a chosenLetter outside the english alphabet when placing, and keeps the blank in the rack', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['', 'a', 'q', 'q', 'q', 'q', 'q']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'č' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a letter in this game's alphabet/);
    expect(engine.getState().player1.rack).toHaveLength(7);
    expect(engine.getState().board[7][7].isBlank).toBe(false);
    expect(newTileCells(engine)).toEqual([]);
  });

  it('refuses an out-of-alphabet letter in set-blank-letter', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['', 'a', 'q', 'q', 'q', 'q', 'q']);
    place(engine, 1, '', 7, 7, 'e');
    const result = engine.dispatch({ type: 'set-blank-letter', row: 7, col: 7, chosenLetter: 'č' });
    expect(result).toMatchObject({ success: false, error: 'Invalid letter' });
    expect(engine.getState().board[7][7].chosenLetter).toBe('e'); // unchanged
  });

  it('set-blank-letter refuses a non-blank square and an empty square', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 'q', 'q', 'q', 'q', 'q']);
    place(engine, 1, 'c', 7, 7);
    expect(engine.dispatch({ type: 'set-blank-letter', row: 7, col: 7, chosenLetter: 'x' })).toMatchObject({
      success: false,
      error: 'Not a blank tile',
    });
    expect(engine.dispatch({ type: 'set-blank-letter', row: 0, col: 0, chosenLetter: 'x' })).toMatchObject({
      success: false,
      error: 'Not a blank tile',
    });
    expect(engine.getState().board[7][7].letter).toBe('c');
  });

  it('set-blank-letter refuses a locked blank', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', '', 'q', 'q', 'q', 'q']);
    placeWord(engine, 1, 'cat', 7, 6, 'horizontal', { 2: 't' });
    play(engine, 1);
    const result = engine.dispatch({ type: 'set-blank-letter', row: 7, col: 8, chosenLetter: 'x' });
    expect(result).toMatchObject({ success: false, error: 'Cannot change locked blank' });
    expect(engine.getState().board[7][8].chosenLetter).toBe('t');
  });

  it('slovenian games accept slovenian letters for blanks: MIZA with a blank I: (3+0+4+1)*2 = 16', () => {
    // slovenian values: m=3, z=4, a=1; M(7,6) plain, blank(7,7) centre DW, Z(7,8), A(7,9) plain
    const engine = newGame(2, 'slovenian');
    expect(engine.getState().language).toBe('slovenian');
    engine.debugSetRack(1, ['m', '', 'z', 'a', 'q', 'q', 'q']);
    placeWord(engine, 1, 'miza', 7, 6, 'horizontal', { 1: 'i' });
    expect(play(engine, 1)).toMatchObject({ success: true, score: 16 });
    expect(engine.getState().player1.history[0].words[0].definition).toBe('table');
  });

  it('a slovenian blank may stand for č', () => {
    const engine = newGame(2, 'slovenian');
    expect(getAlphabet('slovenian')).toContain('č');
    engine.debugSetRack(1, ['', 'a', 'q', 'q', 'q', 'q', 'q']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'č' });
    expect(result.success).toBe(true);
    expect(engine.getState().board[7][7]).toMatchObject({ isBlank: true, chosenLetter: 'č' });
  });

  it('a slovenian blank cannot stand for w (not in the slovenian alphabet)', () => {
    const engine = newGame(2, 'slovenian');
    engine.debugSetRack(1, ['', 'a', 'q', 'q', 'q', 'q', 'q']);
    const result = engine.dispatch({ type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7, chosenLetter: 'w' });
    expect(result.success).toBe(false);
    expect(engine.getState().player1.rack).toHaveLength(7);
  });
});

describe('recall', () => {
  it('returns normal tiles and blanks to the rack and clears the board', () => {
    const engine = newGame(2);
    const original = ['c', 'a', '', 'q', 'q', 'z', 'z'];
    engine.debugSetRack(1, original);
    place(engine, 1, 'c', 7, 6);
    place(engine, 1, 'a', 7, 7);
    place(engine, 1, '', 7, 8, 'e');
    expect(engine.getState().player1.rack).toHaveLength(4);
    const result = engine.dispatch({ type: 'recall', playerId: 1 });
    expect(result.success).toBe(true);
    const s = engine.getState();
    expect(sortedTiles(s.player1.rack)).toEqual(sortedTiles(original));
    expect(s.player1.rack).toContain('');
    expect(newTileCells(engine)).toEqual([]);
    expect(s.board[7][8]).toMatchObject({ isBlank: false, chosenLetter: '', letter: '', isNew: false });
    expect(s.board[7][6]).toMatchObject({ letter: '', isNew: false });
    expect(s.message).toBe('Tiles recalled');
    expect(s.messageType).toBe('info');
    expect(s.currentPlayer).toBe(1);
  });

  it('with nothing placed it is a harmless success', () => {
    const engine = newGame(2);
    const rack = [...engine.getState().player1.rack];
    expect(engine.dispatch({ type: 'recall', playerId: 1 }).success).toBe(true);
    expect(engine.getState().player1.rack).toEqual(rack);
  });

  it('never touches locked tiles', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    engine.debugSetRack(2, ['t', 'o', 'z', 'z', 'z', 'z', 'z']);
    place(engine, 2, 't', 8, 7);
    engine.dispatch({ type: 'recall', playerId: 2 });
    expect(lockedCount(engine)).toBe(3);
    expect(engine.getState().player2.rack).toHaveLength(7);
  });

  it('a player who is not on turn cannot recall the current player\'s tiles', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 7);
    const result = engine.dispatch({ type: 'recall', playerId: 2 });
    expect(result.success).toBe(false);
    expect(engine.getState().board[7][7].isNew).toBe(true);
    expect(engine.getState().player2.rack).toHaveLength(7);
  });

  it('refuses an unknown seat', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'recall', playerId: 3 })).toMatchObject({ success: false, error: 'Player 3 not found' });
  });
});

describe('pass and game end by passing', () => {
  it('increments consecutivePasses, records a pass entry and moves to the next player', () => {
    const engine = newGame(2);
    const result = pass(engine, 1);
    expect(result.success).toBe(true);
    const s = engine.getState();
    expect(s.consecutivePasses).toBe(1);
    expect(s.player1.history).toEqual([{ turnNumber: 1, action: 'pass', totalScore: 0 }]);
    expect(s.currentPlayer).toBe(2);
    expect(s.message).toBe('Player 1 passed their turn');
    expect(s.messageType).toBe('info');
    expect(s.gameOver).toBe(false);
  });

  it('refuses a pass when it is not your turn', () => {
    const engine = newGame(2);
    expect(pass(engine, 2)).toMatchObject({ success: false, error: 'Not your turn' });
    expect(engine.getState().consecutivePasses).toBe(0);
  });

  it('refuses a pass with tiles placed on the board', () => {
    const engine = newGame(2);
    place(engine, 1, engine.getState().player1.rack[0], 7, 7);
    const result = pass(engine, 1);
    expect(result).toMatchObject({ success: false, error: 'Tiles on board' });
    expect(engine.getState().consecutivePasses).toBe(0);
    expect(engine.getState().currentPlayer).toBe(1);
    expect(engine.getState().messageType).toBe('error');
  });

  it('turn order cycles 1 -> 2 -> 3 for 3 players and isCurrentPlayer follows', () => {
    const engine = newGame(3);
    expect(engine.getState().currentPlayer).toBe(1);
    pass(engine, 1);
    expect(engine.getState().currentPlayer).toBe(2);
    expect(engine.getState().player2.isCurrentPlayer).toBe(true);
    expect(engine.getState().player1.isCurrentPlayer).toBe(false);
    pass(engine, 2);
    expect(engine.getState().currentPlayer).toBe(3);
    expect(engine.getState().player3.isCurrentPlayer).toBe(true);
  });

  it('turn order wraps 3 -> 1 after a non-pass turn (exchange) so the game is not over', () => {
    const engine = newGame(3);
    pass(engine, 1);
    pass(engine, 2);
    engine.dispatch({ type: 'exchange-tiles', playerId: 3, indices: [0] });
    expect(engine.getState().currentPlayer).toBe(1);
    expect(engine.getState().player1.isCurrentPlayer).toBe(true);
    expect(engine.getState().gameOver).toBe(false);
  });

  it('turn order wraps 4 -> 1 and isCurrentPlayer flags follow', () => {
    const engine = newGame(4);
    pass(engine, 1);
    pass(engine, 2);
    pass(engine, 3);
    expect(engine.getState().currentPlayer).toBe(4);
    expect(engine.getState().player4.isCurrentPlayer).toBe(true);
    expect(engine.getState().player3.isCurrentPlayer).toBe(false);
    expect(engine.getState().gameOver).toBe(false);
  });

  it('the game ends when every player has passed in a row (2 players), with rack-value deductions', () => {
    // P1 holds Q+Z = 10+10 = 20, P2 holds A+B = 1+3 = 4; nobody went out.
    // final: P1 = 0 - 20 = -20, P2 = 0 - 4 = -4 -> P2 wins
    const engine = newGame(2);
    engine.debugSetRack(1, ['q', 'z']);
    engine.debugSetRack(2, ['a', 'b']);
    expect(pass(engine, 1).gameOver).toBeUndefined();
    const last = pass(engine, 2);
    expect(last).toMatchObject({ success: true, gameOver: true });
    const s = engine.getState();
    expect(s.gameOver).toBe(true);
    expect(s.finalScores).toEqual({ player1: -20, player1Remaining: 20, player2: -4, player2Remaining: 4 });
    expect(s.winner).toBe(2);
    expect(s.message).toContain('Player 2 wins with -4 points');
    expect(s.messageType).toBe('success');
  });

  it('needs all 3 players to pass in a 3-player game', () => {
    const engine = newGame(3);
    pass(engine, 1);
    pass(engine, 2);
    expect(engine.getState().gameOver).toBe(false);
    expect(pass(engine, 3).gameOver).toBe(true);
    expect(engine.getState().gameOver).toBe(true);
  });

  it('an intervening play resets the pass count so the game does not end', () => {
    const engine = newGame(2);
    pass(engine, 1);
    engine.debugSetRack(2, ['c', 'a', 't', 'z', 'z', 'z', 'z']);
    placeWord(engine, 2, 'cat', 7, 6);
    play(engine, 2);
    pass(engine, 1);
    expect(engine.getState().gameOver).toBe(false);
    expect(engine.getState().consecutivePasses).toBe(1);
  });

  it('equal final scores are a tie (winner 0)', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a']);
    engine.debugSetRack(2, ['e']); // both worth 1
    pass(engine, 1);
    pass(engine, 2);
    const s = engine.getState();
    expect(s.finalScores.player1).toBe(-1);
    expect(s.finalScores.player2).toBe(-1);
    expect(s.winner).toBe(0);
    expect(s.message).toMatch(/tie between Player 1 and Player 2 at -1 points/);
  });

  it('actions after game over are refused', () => {
    const engine = newGame(2);
    pass(engine, 1);
    pass(engine, 2);
    expect(engine.getState().gameOver).toBe(true);
    const result = pass(engine, engine.getState().currentPlayer);
    expect(result.success).toBe(false);
  });
});

describe('exchange-tiles', () => {
  const multiset = (engine, playerId) =>
    sortedTiles([...engine.getState()[`player${playerId}`].rack, ...engine.getState().tileBag]);

  it('swaps the chosen tiles, keeps the others, preserves rack+bag tiles, ends the turn', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const before = multiset(engine, 1);
    const bagSize = engine.getState().tileBag.length;
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [0, 1] });
    expect(result.success).toBe(true);
    const s = engine.getState();
    expect(s.player1.rack).toHaveLength(7);
    expect(s.tileBag).toHaveLength(bagSize); // 2 out, 2 in
    expect(multiset(engine, 1)).toEqual(before);
    for (const kept of ['c', 'd', 'e', 'f', 'g']) expect(s.player1.rack).toContain(kept);
    expect(s.currentPlayer).toBe(2);
    expect(s.player1.history).toHaveLength(1);
    expect(s.player1.history[0]).toMatchObject({ turnNumber: 1, action: 'exchange', count: 2, totalScore: 0 });
    expect(s.message).toBe('Player 1 exchanged 2 tiles.');
    expect(s.messageType).toBe('info');
  });

  it('can exchange the whole rack', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [0, 1, 2, 3, 4, 5, 6] });
    expect(result.success).toBe(true);
    expect(engine.getState().player1.rack).toHaveLength(7);
    expect(engine.getState().player1.history[0].count).toBe(7);
    expect(engine.getState().tileBag).toHaveLength(86);
  });

  it('resets consecutivePasses to 0', () => {
    const engine = newGame(3);
    pass(engine, 1);
    expect(engine.getState().consecutivePasses).toBe(1);
    engine.dispatch({ type: 'exchange-tiles', playerId: 2, indices: [0] });
    expect(engine.getState().consecutivePasses).toBe(0);
    expect(engine.getState().currentPlayer).toBe(3);
  });

  it('refuses when the bag has fewer tiles than requested, changing nothing', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    engine.getState().tileBag = ['z'];
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [0, 1] });
    expect(result).toMatchObject({ success: false, error: 'Not enough tiles in bag' });
    expect(engine.getState().player1.rack).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(engine.getState().tileBag).toEqual(['z']);
    expect(engine.getState().currentPlayer).toBe(1);
    expect(engine.getState().player1.history).toEqual([]);
    expect(engine.getState().message).toBe('Not enough tiles in the bag to exchange.');
  });

  it('is allowed when the bag has exactly as many tiles as are exchanged', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    engine.getState().tileBag = ['x', 'y'];
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [5, 6] });
    expect(result.success).toBe(true);
    expect(engine.getState().player1.rack).toHaveLength(7);
    expect(engine.getState().tileBag).toHaveLength(2);
    expect(sortedTiles([...engine.getState().player1.rack, ...engine.getState().tileBag])).toEqual(
      sortedTiles(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x', 'y'])
    );
  });

  it('refuses when it is not your turn', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 2, indices: [0] });
    expect(result).toMatchObject({ success: false, error: 'Not your turn' });
    expect(engine.getState().player2.history).toEqual([]);
  });

  it('refuses an empty or duplicate index list at validation', () => {
    const engine = newGame(2);
    const before = JSON.stringify(engine.getState());
    expect(engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [] }).success).toBe(false);
    expect(engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [1, 1] }).success).toBe(false);
    expect(JSON.stringify(engine.getState())).toBe(before);
  });

  it('refuses an exchange while tiles are placed on the board', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    place(engine, 1, 'c', 7, 7);
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [0] });
    expect(result.success).toBe(false);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('refuses an exchange index that is not a tile in the current rack', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c']);
    const result = engine.dispatch({ type: 'exchange-tiles', playerId: 1, indices: [6] });
    expect(result.success).toBe(false);
    expect(engine.getState().player1.history).toEqual([]);
  });
});

describe('game end by emptying the rack with an empty bag', () => {
  const endingGame = () => {
    const engine = newGame(2);
    engine.getState().tileBag = [];
    engine.debugSetRack(1, ['c', 'a', 't']);
    engine.debugSetRack(2, ['q', 'a']); // remaining value 10 + 1 = 11
    placeWord(engine, 1, 'cat', 7, 6);
    return engine;
  };

  it('ends the game, adjusts scores: player out gains the others\' remaining value', () => {
    // P1 plays CAT: (3+1+1)*2 = 10, goes out. P2 keeps Q(10)+A(1) = 11.
    // P1 final = 10 - 0 + 11 = 21; P2 final = 0 - 11 = -11; P1 wins.
    const engine = endingGame();
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: true, score: 10, gameOver: true });
    const s = engine.getState();
    expect(s.gameOver).toBe(true);
    expect(s.player1.score).toBe(10); // raw score is untouched; adjustment lives in finalScores
    expect(s.finalScores).toEqual({ player1: 21, player1Remaining: 0, player2: -11, player2Remaining: 11 });
    expect(s.winner).toBe(1);
    expect(s.message).toBe('Game Over! Player 1 wins with 21 points! (21 - -11)');
    expect(s.messageType).toBe('success');
    expect(s.player1.rack).toEqual([]);
  });

  it('the turn does not switch when the game ends', () => {
    const engine = endingGame();
    play(engine, 1);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('does not end while the bag still has tiles, even if the rack could be emptied', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't']);
    const bagBefore = engine.getState().tileBag.length;
    placeWord(engine, 1, 'cat', 7, 6);
    const result = play(engine, 1);
    expect(result.gameOver).toBeUndefined();
    expect(engine.getState().gameOver).toBe(false);
    expect(engine.getState().player1.rack).toHaveLength(7); // refilled from the bag
    expect(engine.getState().tileBag).toHaveLength(bagBefore - 7);
  });

  it('does not end when the bag is empty but the player still has tiles', () => {
    const engine = newGame(2);
    engine.getState().tileBag = [];
    engine.debugSetRack(1, ['c', 'a', 't', 'x']);
    placeWord(engine, 1, 'cat', 7, 6);
    const result = play(engine, 1);
    expect(result.success).toBe(true);
    expect(result.gameOver).toBeUndefined();
    expect(engine.getState().gameOver).toBe(false);
    expect(engine.getState().currentPlayer).toBe(2);
  });

  it('with 3 players, going out collects the sum of both opponents\' tiles', () => {
    // P2 holds Z(10), P3 holds K(5)+A(1)=6 -> total 16; P1 scores 10 playing CAT and goes out -> 10 + 16 = 26
    const engine = newGame(3);
    engine.getState().tileBag = [];
    engine.debugSetRack(1, ['c', 'a', 't']);
    engine.debugSetRack(2, ['z']);
    engine.debugSetRack(3, ['k', 'a']);
    placeWord(engine, 1, 'cat', 7, 6);
    play(engine, 1);
    expect(engine.getState().finalScores).toEqual({
      player1: 26, player1Remaining: 0,
      player2: -10, player2Remaining: 10,
      player3: -6, player3Remaining: 6,
    });
    expect(engine.getState().winner).toBe(1);
  });
});

describe('reorder-rack', () => {
  const rackOf = ['a', 'b', 'c', '', 'e', 'f', 'g'];

  it('accepts a permutation (including a blank)', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, rackOf);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['g', 'f', 'e', '', 'c', 'b', 'a'] });
    expect(result.success).toBe(true);
    expect(engine.getState().player1.rack).toEqual(['g', 'f', 'e', '', 'c', 'b', 'a']);
  });

  it('accepts the identical order', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, rackOf);
    expect(engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: [...rackOf] }).success).toBe(true);
    expect(engine.getState().player1.rack).toEqual(rackOf);
  });

  it('accepts a permutation of a rack shortened by placed tiles', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x']);
    place(engine, 1, 'c', 7, 7);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['x', 't', 'a'] });
    expect(result.success).toBe(true);
    expect(engine.getState().player1.rack).toEqual(['x', 't', 'a']);
  });

  it('rejects a changed tile (same length)', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, rackOf);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'b', 'c', '', 'e', 'f', 'z'] });
    expect(result).toMatchObject({ success: false, error: 'Rack can only be reordered, not changed' });
    expect(engine.getState().player1.rack).toEqual(rackOf);
  });

  it('rejects a missing tile (shorter rack)', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, rackOf);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'b', 'c', '', 'e', 'f'] });
    expect(result.success).toBe(false);
    expect(engine.getState().player1.rack).toEqual(rackOf);
  });

  it('rejects an extra tile (longer than the current rack, still within 7)', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c']);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'b', 'c', 'd'] });
    expect(result.success).toBe(false);
    expect(engine.getState().player1.rack).toEqual(['a', 'b', 'c']);
  });

  it('rejects a duplicated tile replacing a different one', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b', 'c']);
    const result = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'a', 'b'] });
    expect(result.success).toBe(false);
    expect(engine.getState().player1.rack).toEqual(['a', 'b', 'c']);
  });

  it('rejects swapping a blank for a letter', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', '']);
    expect(engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'z'] }).success).toBe(false);
    expect(engine.getState().player1.rack).toEqual(['a', '']);
  });

  it('rejects 8 tiles at validation and an unknown seat in the engine', () => {
    const engine = newGame(2);
    const eight = engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack: ['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'] });
    expect(eight.success).toBe(false);
    const ghost = engine.dispatch({ type: 'reorder-rack', playerId: 4, newRack: [] });
    expect(ghost).toMatchObject({ success: false, error: 'Player not found' });
  });

  it('does not alias the caller array into the rack', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['a', 'b']);
    const newRack = ['b', 'a'];
    engine.dispatch({ type: 'reorder-rack', playerId: 1, newRack });
    newRack.push('z');
    expect(engine.getState().player1.rack).toEqual(['b', 'a']);
  });
});

describe('dispatch with ctx.playerId (seat pinning)', () => {
  it.each([
    ['pass', { type: 'pass', playerId: 1 }],
    ['play-word', { type: 'play-word', playerId: 1 }],
    ['recall', { type: 'recall', playerId: 1 }],
    ['place-tile', { type: 'place-tile', playerId: 1, rackIndex: 0, row: 7, col: 7 }],
    ['exchange-tiles', { type: 'exchange-tiles', playerId: 1, indices: [0] }],
    ['reorder-rack', { type: 'reorder-rack', playerId: 1, newRack: [] }],
  ])('%s for another seat is refused with "That is not your seat" and changes nothing', (_name, action) => {
    const engine = newGame(2);
    const before = JSON.stringify(engine.getState());
    const result = engine.dispatch(action, { playerId: 2 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('That is not your seat');
    expect(JSON.stringify(engine.getState())).toBe(before);
  });

  it('the same seat is served normally', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'pass', playerId: 1 }, { playerId: 1 }).success).toBe(true);
    expect(engine.getState().currentPlayer).toBe(2);
  });

  it('a seat is only pinned against its own player-bound actions: playerId 2 acting on turn 2', () => {
    const engine = newGame(2);
    pass(engine, 1);
    expect(engine.dispatch({ type: 'pass', playerId: 2 }, { playerId: 2 }).success).toBe(true);
  });

  it('a pinned seat still gets the normal turn check', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'pass', playerId: 2 }, { playerId: 2 });
    expect(result).toMatchObject({ success: false, error: 'Not your turn' });
  });

  it('seat-less actions work for any pinned seat', () => {
    const engine = newGame(2);
    engine.debugSetRack(1, ['c', 'a', 't', 'x', 'y', 'z', 'q']);
    expect(engine.dispatch({ type: 'update-viewport', viewportCenter: { row: 3, col: 4 } }, { playerId: 2 }).success).toBe(true);
    expect(engine.getState().viewportCenter).toEqual({ row: 3, col: 4 });
    expect(engine.dispatch({ type: 'validate-word', word: 'cat' }, { playerId: 2 })).toMatchObject({ success: true, valid: true });
    expect(
      engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: true, slovenian: false } }, { playerId: 2 }).success
    ).toBe(true);
    place(engine, 1, 'c', 7, 7);
    // set-blank-letter carries no seat of its own, but only the player on turn may change a blank: seat 2 is refused
    // for turn reasons (not as "not your seat"), while the player on turn reaches the handler
    expect(
      engine.dispatch({ type: 'set-blank-letter', row: 7, col: 7, chosenLetter: 'x' }, { playerId: 2 })
    ).toMatchObject({ success: false, error: 'Not your turn' });
    expect(
      engine.dispatch({ type: 'set-blank-letter', row: 7, col: 7, chosenLetter: 'x' }, { playerId: 1 })
    ).toMatchObject({ success: false, error: 'Not a blank tile' });
    expect(engine.dispatch({ type: 'restart', playerCount: 3 }, { playerId: 2 }).success).toBe(true);
    expect(engine.getState().playerCount).toBe(3);
  });

  it('an empty ctx or no ctx pins nothing', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'pass', playerId: 1 }, {}).success).toBe(true);
    expect(engine.dispatch({ type: 'pass', playerId: 2 }).success).toBe(true);
  });
});

describe('restart: players, language and dictionaries', () => {
  it('a plain restart keeps language and player count and resets everything else', () => {
    const engine = newGame(3, 'slovenian');
    pass(engine, 1);
    engine.dispatch({ type: 'restart' });
    const s = engine.getState();
    expect(s.language).toBe('slovenian');
    expect(s.playerCount).toBe(3);
    expect(s.dictionaries).toEqual({ csw21: false, nwl2023: false, slovenian: true });
    expect(s.currentPlayer).toBe(1);
    expect(s.consecutivePasses).toBe(0);
    expect(s.player1.history).toEqual([]);
    expect(s.player1.rack).toHaveLength(7);
    expect(s.gameOver).toBe(false);
    expect(s.finalScores).toBeNull();
  });

  it('restart with playerCount changes only the count', () => {
    const engine = newGame(4);
    engine.dispatch({ type: 'restart', playerCount: 2 });
    expect(engine.getState().playerCount).toBe(2);
    expect(engine.getState().player3).toBeUndefined();
    expect(engine.getState().language).toBe('english');
  });

  it('restart after a game is over starts a fresh, playable game', () => {
    const engine = newGame(2);
    pass(engine, 1);
    pass(engine, 2);
    expect(engine.getState().gameOver).toBe(true);
    engine.dispatch({ type: 'restart' });
    expect(engine.getState().gameOver).toBe(false);
    expect(engine.getState().winner).toBeNull();
    expect(pass(engine, 1).success).toBe(true);
  });

  it('restart to slovenian: slovenian dictionary only, slovenian tiles, slovenian words valid, english invalid', () => {
    const engine = newGame(2, 'slovenian');
    const s = engine.getState();
    expect(s.language).toBe('slovenian');
    expect(s.dictionaries).toEqual({ csw21: false, nwl2023: false, slovenian: true });
    expect(engine.dictionary.getSelection()).toEqual({ csw21: false, nwl2023: false, slovenian: true });
    expect(engine.dictionary.has('miza')).toBe(true);
    expect(engine.dictionary.has('cat')).toBe(false);
    const alphabet = getAlphabet('slovenian');
    const tiles = [...s.player1.rack, ...s.player2.rack, ...s.tileBag];
    expect(tiles).toHaveLength(100);
    expect(tiles.filter((t) => t !== '').every((t) => alphabet.includes(t))).toBe(true);
    expect(tiles.filter((t) => t === 'č')).toHaveLength(1);
    expect(TILE_DISTRIBUTIONS.slovenian.tiles.find((t) => t.letter === 'č').count).toBe(1);
  });

  it('slovenian game rejects an english word as not in the dictionary', () => {
    const engine = newGame(2, 'slovenian');
    engine.debugSetRack(1, ['c', 'a', 't', 'q', 'q', 'q', 'q']);
    placeWord(engine, 1, 'cat', 7, 6);
    const result = play(engine, 1);
    expect(result).toMatchObject({ success: false, error: 'Invalid words' });
  });

  it('restart to english from slovenian goes to CSW21 by default', () => {
    const engine = newGame(2, 'slovenian');
    engine.dispatch({ type: 'restart', language: 'english' });
    expect(engine.getState().language).toBe('english');
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: false });
    expect(engine.dictionary.has('cat')).toBe(true);
    expect(engine.dictionary.has('miza')).toBe(false);
  });

  it('english restart keeps an existing NWL2023 preference', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: true, slovenian: false } });
    engine.dispatch({ type: 'restart', language: 'english' });
    expect(engine.getState().dictionaries).toEqual({ csw21: false, nwl2023: true, slovenian: false });
    expect(engine.dictionary.has('dog')).toBe(true);
    expect(engine.dictionary.has('cot')).toBe(false);
  });

  it('english restart drops slovenian from a mixed selection', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: true } });
    engine.dispatch({ type: 'restart', language: 'english' });
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: false });
  });

  it('a plain restart of an english game with a mixed selection keeps it (only repairs unsuitable ones)', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: true } });
    engine.dispatch({ type: 'restart' });
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: true });
  });

  it('a plain restart repairs a selection that cannot suit the language (english with slovenian only)', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: false, slovenian: true } });
    engine.dispatch({ type: 'restart' });
    expect(engine.getState().language).toBe('english');
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: false });
  });

  it('a plain restart repairs a slovenian game whose selection lost slovenian', () => {
    const engine = newGame(2, 'slovenian');
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: false } });
    engine.dispatch({ type: 'restart' });
    expect(engine.getState().language).toBe('slovenian');
    expect(engine.getState().dictionaries).toEqual({ csw21: false, nwl2023: false, slovenian: true });
  });

  it('a plain restart of a slovenian game keeps a selection that includes slovenian', () => {
    const engine = newGame(2, 'slovenian');
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: true } });
    engine.dispatch({ type: 'restart' });
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: true });
  });

  it('rejects an unknown language or bad player counts without changing the game', () => {
    const engine = newGame(2);
    const before = JSON.stringify(engine.getState());
    for (const bad of [{ language: 'klingon' }, { playerCount: 1 }, { playerCount: 5 }, { playerCount: '3' }]) {
      const result = engine.dispatch({ type: 'restart', ...bad });
      expect(result.success).toBe(false);
    }
    expect(JSON.stringify(engine.getState())).toBe(before);
  });
});

describe('update-dictionary', () => {
  const playDog = (engine) => {
    engine.debugSetRack(1, ['d', 'o', 'g', 'q', 'q', 'q', 'q']);
    placeWord(engine, 1, 'dog', 7, 6);
    return play(engine, 1);
  };

  it('changes validation immediately: DOG is invalid under CSW21 and valid after switching to NWL2023', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'validate-word', word: 'dog' }).valid).toBe(false);
    const rejected = playDog(engine);
    expect(rejected).toMatchObject({ success: false, error: 'Invalid words' });

    // player 2's turn now; switch dictionaries and let player 2 try again
    const update = engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: true, slovenian: false } });
    expect(update.success).toBe(true);
    expect(engine.dispatch({ type: 'validate-word', word: 'dog' }).valid).toBe(true);
    engine.debugSetRack(2, ['d', 'o', 'g', 'q', 'q', 'q', 'q']);
    placeWord(engine, 2, 'dog', 7, 6);
    // D(7,6) 2 + O(7,7) centre 1 + G(7,8) 2 = 5, x2 = 10
    expect(play(engine, 2)).toMatchObject({ success: true, score: 10 });
  });

  it('updates gameState.dictionaries but never gameState.language', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: false, nwl2023: false, slovenian: true } });
    expect(result.success).toBe(true);
    expect(engine.getState().dictionaries).toEqual({ csw21: false, nwl2023: false, slovenian: true });
    expect(engine.getState().language).toBe('english');
    // tiles keep the english distribution, even though only the slovenian list is active
    expect(engine.getState().player1.rack.every((t) => t === '' || getAlphabet('english').includes(t))).toBe(true);
  });

  it('a slovenian game keeps language slovenian when english dictionaries are selected', () => {
    const engine = newGame(2, 'slovenian');
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: false, slovenian: false } });
    expect(engine.getState().language).toBe('slovenian');
    expect(engine.getState().dictionaries.csw21).toBe(true);
    expect(engine.dictionary.has('cat')).toBe(true);
  });

  it('does not affect tiles, scores or turn order', () => {
    const engine = newGame(2);
    const rack = [...engine.getState().player1.rack];
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: true, slovenian: false } });
    expect(engine.getState().player1.rack).toEqual(rack);
    expect(engine.getState().currentPlayer).toBe(1);
  });

  it('an empty selection is refused and the previous selection is kept', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'update-dictionary', dictionaries: {} });
    expect(result.success).toBe(false);
    expect(engine.getState().dictionaries).toEqual({ csw21: true, nwl2023: false, slovenian: false });
    expect(engine.dictionary.has('cat')).toBe(true);
  });

  it('a union of lists accepts words from either', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-dictionary', dictionaries: { csw21: true, nwl2023: true, slovenian: false } });
    expect(engine.dispatch({ type: 'validate-word', word: 'dog' }).valid).toBe(true);
    expect(engine.dispatch({ type: 'validate-word', word: 'cottage' }).valid).toBe(true);
  });
});

describe('validate-word', () => {
  it('reports valid words with the uppercased word and success true', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'validate-word', word: 'cat' })).toMatchObject({ success: true, valid: true, word: 'CAT' });
  });

  it('is case-insensitive', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'validate-word', word: 'CaT' })).toMatchObject({ valid: true, word: 'CAT' });
  });

  it('reports invalid words as success with valid false', () => {
    const engine = newGame(2);
    expect(engine.dispatch({ type: 'validate-word', word: 'zzz' })).toMatchObject({ success: true, valid: false, word: 'ZZZ' });
  });

  it('refuses digits, spaces, empty and over-long input', () => {
    const engine = newGame(2);
    for (const word of ['c4t', 'c t', '', 'a'.repeat(26), '<b>', undefined, 7]) {
      const result = engine.dispatch({ type: 'validate-word', word });
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    }
  });

  it('does not change the game', () => {
    const engine = newGame(2);
    const before = JSON.stringify(engine.getState());
    engine.dispatch({ type: 'validate-word', word: 'cat' });
    expect(JSON.stringify(engine.getState())).toBe(before);
  });
});

describe('update-viewport', () => {
  it('stores the new centre', () => {
    const engine = newGame(2);
    engine.dispatch({ type: 'update-viewport', viewportCenter: { row: 2, col: 12 } });
    expect(engine.getState().viewportCenter).toEqual({ row: 2, col: 12 });
  });

  it('refuses an out-of-range centre and keeps the old one', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'update-viewport', viewportCenter: { row: 15, col: 0 } });
    expect(result.success).toBe(false);
    expect(engine.getState().viewportCenter).toEqual({ row: 7, col: 7 });
  });
});

describe('invalid actions never throw', () => {
  const junk = [
    null,
    undefined,
    [],
    ['pass'],
    'x',
    '',
    0,
    42,
    NaN,
    true,
    10n,
    Symbol('s'),
    () => {},
    new Date(0),
    {},
    { type: 'place-tile' },
    { type: 'nope' },
    { type: '__proto__' },
    { type: 'constructor', playerId: 1 },
    { type: ['pass'], playerId: 1 },
    { type: { toString: () => 'pass' }, playerId: 1 },
    { type: 'pass' },
    { type: 'pass', playerId: 1e308 },
    { type: 'pass', playerId: Infinity },
    { type: 'pass', playerId: -0.5 },
    { type: 'place-tile', playerId: 1, rackIndex: 0, row: 1e9, col: -1e9 },
    { type: 'place-tile', playerId: 1, rackIndex: Number.MAX_SAFE_INTEGER, row: 7, col: 7 },
    { type: 'exchange-tiles', playerId: 1, indices: '0123' },
    { type: 'exchange-tiles', playerId: 1, indices: new Array(1e6) },
    { type: 'reorder-rack', playerId: 1, newRack: [['a']] },
    { type: 'update-viewport', viewportCenter: { row: 'a' } },
    { type: 'update-dictionary', dictionaries: {} },
    { type: 'restart', playerCount: 1e9 },
    { type: 'restart', language: { toString: () => 'english' } },
    { type: 'validate-word', word: 'a'.repeat(1e5) },
    JSON.parse('{"__proto__":{"type":"pass","playerId":1}}'),
    JSON.parse('{"type":"__proto__","playerId":1,"constructor":{"prototype":{"x":1}}}'),
    Object.assign(Object.create(null), { type: 'pass' }),
  ];

  it('returns {success:false, error} for every junk input and leaves the state untouched', () => {
    expect(junk.length).toBeGreaterThanOrEqual(30);
    const engine = newGame(2);
    const before = JSON.stringify(engine.getState());
    for (const input of junk) {
      let result;
      expect(() => { result = engine.dispatch(input); }).not.toThrow();
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.gameState).toBe(engine.getState());
    }
    expect(JSON.stringify(engine.getState())).toBe(before);
  });

  it('junk together with a ctx behaves the same', () => {
    const engine = newGame(2);
    for (const input of junk) {
      let result;
      expect(() => { result = engine.dispatch(input, { playerId: 1 }); }).not.toThrow();
      expect(result.success).toBe(false);
    }
  });

  it('a valid action smuggling __proto__ is served and pollutes nothing', () => {
    const engine = newGame(2);
    const action = JSON.parse('{"type":"pass","playerId":1,"__proto__":{"polluted":true},"constructor":{"x":1}}');
    const result = engine.dispatch(action);
    expect(result.success).toBe(true);
    expect({}.polluted).toBeUndefined();
    expect(engine.getState().polluted).toBeUndefined();
  });

  it('extra fields on a valid action are ignored', () => {
    const engine = newGame(2);
    const result = engine.dispatch({ type: 'pass', playerId: 1, score: 9999, isCurrentPlayer: false, extra: {} });
    expect(result.success).toBe(true);
    expect(engine.getState().player1.score).toBe(0);
    expect(engine.getState().player1.extra).toBeUndefined();
  });

  it('actions that pass validation but are impossible return an error rather than throwing', () => {
    const engine = newGame(2);
    for (const action of [
      { type: 'place-tile', playerId: 4, rackIndex: 0, row: 0, col: 0 },
      { type: 'set-blank-letter', row: 0, col: 0, chosenLetter: 'a' },
      { type: 'recall', playerId: 3 },
      { type: 'play-word', playerId: 4 },
      { type: 'pass', playerId: 3 },
      { type: 'exchange-tiles', playerId: 4, indices: [0] },
      { type: 'reorder-rack', playerId: 3, newRack: [] },
    ]) {
      let result;
      expect(() => { result = engine.dispatch(action); }).not.toThrow();
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    }
  });
});
