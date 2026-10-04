import { describe, it, expect } from 'vitest';
import { evaluatePlay, findInvalidWords, findSolution, sameTiles, scenarioCells } from './practiceCheck.js';
import { getScenarioById } from './practiceScenarios.js';

// Put tiles on a scenario's cells the way Practice Mode does when the player drops them
function place(cells, tiles) {
  for (const { letter, row, col } of tiles) cells[row][col] = { ...cells[row][col], letter, isNew: true };
  return cells;
}

describe('scenarioCells', () => {
  const cells = scenarioCells(getScenarioById('v-words-1')); // CAT on row 7, columns 7-9

  it('marks the scenario tiles as fixed and leaves the rest empty', () => {
    expect(cells).toHaveLength(15);
    expect(cells.every((row) => row.length === 15)).toBe(true);
    expect(cells[7].slice(7, 10).map((c) => [c.letter, c.isPracticeOriginal])).toEqual([['C', true], ['A', true], ['T', true]]);
    expect(cells.flat().filter((c) => c.letter)).toHaveLength(3);
    expect(cells.flat().some((c) => c.isNew)).toBe(false);
  });

  it('puts the premium squares where the real board has them', () => {
    expect(cells[7][7].type).toBe('center');
    expect(cells[6][8].type).toBe('dl'); // the squares above and below the A of CAT
    expect(cells[8][8].type).toBe('dl');
    expect(cells[4][4].type).toBe('dw');
    expect(cells[0][0].type).toBe('tw');
    expect(cells[5][9].type).toBe('tl');
    expect(cells[7][8].type).toBe(''); // a plain square
  });

  it('gives every call its own copy, so a played tile never leaks into the scenario', () => {
    const first = scenarioCells(getScenarioById('v-words-1'));
    first[0][0].letter = 'Z';
    expect(scenarioCells(getScenarioById('v-words-1'))[0][0].letter).toBe('');
    expect(getScenarioById('v-words-1').board[0][0]).toBeNull();
  });
});

describe('evaluatePlay', () => {
  it('scores VAV through the A of CAT with both Vs on double letter squares: 8 + 1 + 8', () => {
    const cells = place(scenarioCells(getScenarioById('v-words-1')), [
      { letter: 'V', row: 6, col: 8 },
      { letter: 'V', row: 8, col: 8 },
    ]);
    expect(evaluatePlay(cells)).toEqual({ ok: true, words: [{ word: 'VAV', score: 17 }], score: 17 });
  });

  it('counts every cross word: AX under BE of BEAT makes AX, BA and EX (17 + 4 + 17)', () => {
    const cells = place(scenarioCells(getScenarioById('two-letter-1')), [
      { letter: 'A', row: 8, col: 5 },
      { letter: 'X', row: 8, col: 6 }, // X on the double letter square at (8,6)
    ]);
    const play = evaluatePlay(cells);
    expect(play.ok).toBe(true);
    expect(Object.fromEntries(play.words.map((w) => [w.word, w.score]))).toEqual({ AX: 17, BA: 4, EX: 17 });
    expect(play.score).toBe(38);
  });

  it('adds the 50 point bonus for using all seven tiles', () => {
    // RETINAS from column 3: the first tile is on the double letter square (7,3) and the word crosses the centre star
    const tiles = [...'RETINAS'].map((letter, i) => ({ letter, row: 7, col: 3 + i }));
    const play = evaluatePlay(place(scenarioCells(getScenarioById('bingo-1')), tiles));
    expect(play).toEqual({ ok: true, words: [{ word: 'RETINAS', score: 16 }], score: 66 }); // (7 + 1) x 2 + 50
  });

  it('rejects a play with no tiles', () => {
    expect(evaluatePlay(scenarioCells(getScenarioById('v-words-1')))).toEqual({ ok: false, message: 'No tiles placed!' });
  });

  it('rejects tiles with a gap, tiles in two directions, and tiles that touch nothing', () => {
    const gap = place(scenarioCells(getScenarioById('v-words-1')), [
      { letter: 'V', row: 6, col: 8 },
      { letter: 'V', row: 9, col: 8 }, // (8,8) is left empty
    ]);
    expect(evaluatePlay(gap).ok).toBe(false);
    expect(evaluatePlay(gap).message).toMatch(/gaps/);

    const bent = place(scenarioCells(getScenarioById('v-words-1')), [
      { letter: 'V', row: 6, col: 8 },
      { letter: 'V', row: 8, col: 9 },
    ]);
    expect(evaluatePlay(bent).message).toMatch(/one row or one column/);

    const floating = place(scenarioCells(getScenarioById('v-words-1')), [{ letter: 'V', row: 1, col: 1 }]);
    expect(evaluatePlay(floating).message).toMatch(/connect/);
  });

  it('requires the first word of an empty board to cover the centre star', () => {
    const off = place(scenarioCells(getScenarioById('bingo-1')), [
      { letter: 'A', row: 3, col: 3 },
      { letter: 'T', row: 3, col: 4 },
    ]);
    expect(evaluatePlay(off).ok).toBe(false);
    expect(evaluatePlay(off).message).toMatch(/center/);
  });

  it('treats the scenario tiles as fixed: they do not earn premium squares or count as the player\'s', () => {
    // TOP is on row 6 columns 8-10; JOY down column 9 uses the O. Only J (triple letter at (5,9)) and Y are new.
    const cells = place(scenarioCells(getScenarioById('jxz-1')), [
      { letter: 'J', row: 5, col: 9 },
      { letter: 'Y', row: 7, col: 9 },
    ]);
    expect(evaluatePlay(cells)).toEqual({ ok: true, words: [{ word: 'JOY', score: 29 }], score: 29 }); // 8 x 3 + 1 + 4
  });
});

describe('findInvalidWords', () => {
  it('returns the played words the list does not know, once each', async () => {
    const asked = [];
    const known = new Set(['AX', 'EX']);
    const invalid = await findInvalidWords(
      [{ word: 'AX' }, { word: 'BA' }, { word: 'EX' }, { word: 'BA' }],
      async (word) => { asked.push(word); return known.has(word); }
    );
    expect(invalid).toEqual(['BA']);
    expect(asked.sort()).toEqual(['AX', 'BA', 'EX']);
  });

  it('is empty when every word is valid', async () => {
    expect(await findInvalidWords([{ word: 'VAV' }], async () => true)).toEqual([]);
  });
});

describe('findSolution and sameTiles', () => {
  const scenario = getScenarioById('hooks-2'); // ART on row 7 columns 6-8; C, P, D, T in front are solutions

  it('finds the solution whose word was played, whichever one it is', () => {
    expect(findSolution(scenario, [{ word: 'PART' }]).word).toBe('PART');
    expect(findSolution(scenario, [{ word: 'DART' }, { word: 'XX' }]).word).toBe('DART');
    expect(findSolution(scenario, [{ word: 'WART' }])).toBeNull();
    expect(findSolution(scenario, [])).toBeNull();
  });

  it('knows whether the player used exactly the solution\'s tiles', () => {
    const part = scenario.solutions.find((s) => s.word === 'PART');
    const right = place(scenarioCells(scenario), [{ letter: 'P', row: 7, col: 5 }]);
    expect(sameTiles(right, part)).toBe(true);
    const wrongLetter = place(scenarioCells(scenario), [{ letter: 'C', row: 7, col: 5 }]);
    expect(sameTiles(wrongLetter, part)).toBe(false);
    const extra = place(scenarioCells(scenario), [{ letter: 'P', row: 7, col: 5 }, { letter: 'E', row: 9, col: 9 }]);
    expect(sameTiles(extra, part)).toBe(false);
  });
});
