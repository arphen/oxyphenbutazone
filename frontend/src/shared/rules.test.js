import { describe, it, expect } from 'vitest';
import * as R from './rules.js';

// Helper to place a tile on the board
const put = (board, row, col, letter, options = {}) => {
  Object.assign(board[row][col], { letter, isNew: true, ...options });
};

// Helper to lock all new tiles on the board
const lock = (board) => {
  board.forEach((row) =>
    row.forEach((cell) => {
      if (cell.isNew) {
        cell.isNew = false;
        cell.locked = true;
      }
    })
  );
};

// Simple LCG RNG for deterministic tests
const createSeededRng = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

describe('createTileBag', () => {
  it('english: 100 tiles total', () => {
    const bag = R.createTileBag('english');
    expect(bag.length).toBe(100);
  });

  it('english: exactly 2 blanks', () => {
    const bag = R.createTileBag('english');
    const blanks = bag.filter((letter) => letter === '');
    expect(blanks.length).toBe(2);
  });

  it('slovenian: count equals sum of distribution counts', () => {
    const dist = R.TILE_DISTRIBUTIONS.slovenian;
    const expectedCount = dist.tiles.reduce((sum, t) => sum + t.count, 0);
    const bag = R.createTileBag('slovenian');
    expect(bag.length).toBe(expectedCount);
  });

  it('seeded rng: two bags are identical', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    const bag1 = R.createTileBag('english', rng1);
    const bag2 = R.createTileBag('english', rng2);
    expect(bag1).toEqual(bag2);
  });

  it('every letter in english bag has an entry in values table', () => {
    const bag = R.createTileBag('english');
    const values = R.TILE_DISTRIBUTIONS.english.values;
    for (const letter of bag) {
      expect(values).toHaveProperty(letter);
    }
  });

  it('every letter in slovenian bag has an entry in values table', () => {
    const bag = R.createTileBag('slovenian');
    const values = R.TILE_DISTRIBUTIONS.slovenian.values;
    for (const letter of bag) {
      expect(values).toHaveProperty(letter);
    }
  });

  it('seeded rng with different seeds produces different bags', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(99);
    const bag1 = R.createTileBag('english', rng1);
    const bag2 = R.createTileBag('english', rng2);
    // Very unlikely to be identical with different seeds
    expect(bag1).not.toEqual(bag2);
  });
});

describe('letterValue', () => {
  describe('english', () => {
    it('q = 10', () => {
      expect(R.letterValue('english', 'q')).toBe(10);
    });

    it('z = 10', () => {
      expect(R.letterValue('english', 'z')).toBe(10);
    });

    it('Q = 10 (case-insensitive)', () => {
      expect(R.letterValue('english', 'Q')).toBe(10);
    });

    it('a = 1', () => {
      expect(R.letterValue('english', 'a')).toBe(1);
    });

    it('blank = 0', () => {
      expect(R.letterValue('english', '')).toBe(0);
    });

    it('undefined = 0', () => {
      expect(R.letterValue('english', undefined)).toBe(0);
    });

    it('null = 0', () => {
      expect(R.letterValue('english', null)).toBe(0);
    });

    it('unknown letter = 0', () => {
      expect(R.letterValue('english', '?')).toBe(0);
    });
  });

  describe('slovenian', () => {
    it('ž = 10', () => {
      expect(R.letterValue('slovenian', 'ž')).toBe(10);
    });

    it('ž in english = 0', () => {
      expect(R.letterValue('english', 'ž')).toBe(0);
    });

    it('č = 5', () => {
      expect(R.letterValue('slovenian', 'č')).toBe(5);
    });
  });
});

describe('scoreWord', () => {
  it('CAT at center: (c=3 + a=1 + t=1) * 2 (center dw) = 10', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    expect(words.length).toBe(1);
    expect(R.scoreWord(board, words[0], 'english')).toBe(10);
  });

  it('double-letter square: dl only counts under NEW tile', () => {
    const board = R.createBoard();
    put(board, 0, 3, 'a'); // dl at [0,3]
    put(board, 0, 4, 'b');
    put(board, 0, 5, 'c');
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    // a is on dl, so: (1*2) + 3 + 3 = 2 + 3 + 3 = 8
    expect(R.scoreWord(board, words[0], 'english')).toBe(8);
  });

  it('locked tile on premium square gets no bonus', () => {
    const board = R.createBoard();
    put(board, 7, 7, 'a');
    lock(board);
    put(board, 7, 8, '', { isBlank: true, chosenLetter: 'z' });
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    // center dw not re-applied: 1 (locked) + 0 (blank) = 1
    expect(R.scoreWord(board, words[0], 'english')).toBe(1);
  });

  it('blank on triple-letter scores 0', () => {
    const board = R.createBoard();
    put(board, 1, 5, '', { isBlank: true, chosenLetter: 'x' }); // tl at [1,5]
    put(board, 1, 6, 'a');
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    // blank on tl: 0 (not 0*3=0) + 1 = 1
    expect(R.scoreWord(board, words[0], 'english')).toBe(1);
  });

  it('two word multipliers multiply: dw * dw = 4', () => {
    const board = R.createBoard();
    // Row 4 has double-word squares at cols 4 and 10 and no letter premiums,
    // so a 7-tile word across cols 4-10 is worth (face value) * 2 * 2.
    'reading'.split('').forEach((letter, i) => put(board, 4, 4 + i, letter));
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    expect(words).toHaveLength(1);
    // r1 + e1 + a1 + d2 + i1 + n1 + g2 = 9, times 4
    expect(R.scoreWord(board, words[0], 'english')).toBe(36);
  });

  it('triple-word multiplier only when new tile on it', () => {
    const board = R.createBoard();
    // tw at [0,0]. Place word starting there.
    put(board, 0, 0, 'c');
    put(board, 0, 1, 'a');
    put(board, 0, 2, 't');
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    // (3 + 1 + 1) * 3 = 15
    expect(R.scoreWord(board, words[0], 'english')).toBe(15);
  });

  it('triple-word not applied if tile is locked', () => {
    const board = R.createBoard();
    // tw at [0,0]. Place c there, lock it, then add more tiles.
    put(board, 0, 0, 'c');
    lock(board);
    put(board, 0, 1, 'a');
    put(board, 0, 2, 't');
    const words = R.getWordsFromBoard(board).filter((w) => w.tiles.some((t) => t.isNew));
    // Word is "cat": c=3 (locked, no tw bonus) + a=1 + t=1 = 5
    expect(R.scoreWord(board, words[0], 'english')).toBe(5);
  });
});

describe('getWordsFromBoard', () => {
  it('finds horizontal word', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    const words = R.getWordsFromBoard(board);
    const horizontal = words.filter((w) => w.direction === 'horizontal');
    expect(horizontal.length).toBeGreaterThanOrEqual(1);
    const catWord = horizontal.find((w) => w.word === 'cat');
    expect(catWord).toBeDefined();
  });

  it('finds vertical word', () => {
    const board = R.createBoard();
    put(board, 6, 7, 'c');
    put(board, 7, 7, 'a');
    put(board, 8, 7, 't');
    const words = R.getWordsFromBoard(board);
    const vertical = words.filter((w) => w.direction === 'vertical');
    expect(vertical.length).toBeGreaterThanOrEqual(1);
    const catWord = vertical.find((w) => w.word === 'cat');
    expect(catWord).toBeDefined();
  });

  it('ignores single isolated tiles', () => {
    const board = R.createBoard();
    put(board, 7, 7, 'x');
    const words = R.getWordsFromBoard(board);
    // Single tile should not form a word
    expect(words.length).toBe(0);
  });

  it('blank uses chosenLetter in word text', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, '', { isBlank: true, chosenLetter: 'a' });
    put(board, 7, 8, 't');
    const words = R.getWordsFromBoard(board);
    const catWord = words.find((w) => w.word === 'cat');
    expect(catWord).toBeDefined();
  });

  it('finds both main word and cross-words', () => {
    const board = R.createBoard();
    // Place CAT horizontally at row 7, cols 6-8
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);
    // Place D vertically at col 6, rows 6-8: DCC (with C from CAT at [7,6])
    put(board, 6, 6, 'd');
    put(board, 8, 6, 'c');
    const words = R.getWordsFromBoard(board);
    const newWords = words.filter((w) => w.tiles.some((t) => t.isNew));
    // Should find DCC (vertical cross-word)
    const dccWord = newWords.find((w) => w.word === 'dcc' && w.direction === 'vertical');
    expect(dccWord).toBeDefined();
  });
});

describe('validatePlacement', () => {
  it('no-tiles error', () => {
    const board = R.createBoard();
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('no-tiles');
  });

  it('not-in-line error', () => {
    const board = R.createBoard();
    put(board, 7, 7, 'c');
    put(board, 8, 8, 'a');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not-in-line');
  });

  it('gap error', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 8, 't');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('gap');
  });

  it('no-center error on first move', () => {
    const board = R.createBoard();
    put(board, 3, 3, 'c');
    put(board, 3, 4, 'a');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('no-center');
  });

  it('first word covering center is ok', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('horizontal');
  });

  it('not-connected error: isolated play after first move', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);
    put(board, 2, 2, 'x');
    put(board, 2, 3, 'y');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not-connected');
  });

  it('single tile touching locked tile is ok', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);
    put(board, 8, 6, 'd');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
  });

  it('gap filled by locked tile is ok', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);
    // Add O above and W below C (col 6, rows 6, 8)
    put(board, 6, 6, 'o');
    put(board, 8, 6, 'w');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('vertical');
  });

  it('extends existing word at end is ok', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);
    put(board, 7, 9, 's');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
  });

  it('vertical play is ok', () => {
    const board = R.createBoard();
    put(board, 6, 7, 'c');
    put(board, 7, 7, 'a');
    put(board, 8, 7, 't');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('vertical');
  });

  it('first move of 1 tile covering centre returns ok', () => {
    const board = R.createBoard();
    put(board, 7, 7, 'a');
    const result = R.validatePlacement(board);
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('single');
  });
});

describe('calculateFinalScores', () => {
  it('nobody out: each player loses their own rack value', () => {
    const players = [
      { score: 100, rack: ['q'] }, // q = 10
      { score: 90, rack: ['z'] }, // z = 10
    ];
    const result = R.calculateFinalScores(players, 'english');
    // Player 1: 100 - 10 + 0 = 90
    // Player 2: 90 - 10 + 0 = 80
    expect(result.finalScores).toEqual([90, 80]);
  });

  it('one player out collects total of remaining tiles', () => {
    const players = [
      { score: 100, rack: [] }, // went out
      { score: 90, rack: ['q'] }, // q = 10
      { score: 80, rack: ['a', 'a'] }, // a = 1 each, total 2
    ];
    const result = R.calculateFinalScores(players, 'english');
    // Remaining: [0, 10, 2], total = 12
    // Player 1: 100 - 0 + 12 = 112
    // Player 2: 90 - 10 + 0 = 80
    // Player 3: 80 - 2 + 0 = 78
    expect(result.finalScores).toEqual([112, 80, 78]);
  });

  it('3 players: one out, others with racks', () => {
    const players = [
      { score: 100, rack: [] },
      { score: 80, rack: ['x', 'x'] },
      { score: 70, rack: ['a'] },
    ];
    // Remaining: [0, 16, 1], total = 17
    const result = R.calculateFinalScores(players, 'english');
    expect(result.finalScores[0]).toBe(100 + 17); // went out
    expect(result.finalScores[1]).toBe(80 - 16);
    expect(result.finalScores[2]).toBe(70 - 1);
  });

  it('4 players: one out', () => {
    const players = [
      { score: 100, rack: ['a'] },
      { score: 90, rack: ['b'] },
      { score: 80, rack: [] }, // went out
      { score: 70, rack: ['c'] },
    ];
    // Remaining: [1, 3, 0, 3], total = 7
    const result = R.calculateFinalScores(players, 'english');
    expect(result.finalScores[0]).toBe(100 - 1);
    expect(result.finalScores[1]).toBe(90 - 3);
    expect(result.finalScores[2]).toBe(80 + 7); // went out
    expect(result.finalScores[3]).toBe(70 - 3);
  });

  it('slovenian values for ž', () => {
    const players = [
      { score: 100, rack: [] },
      { score: 90, rack: ['ž'] }, // ž = 10 in Slovenian
    ];
    const result = R.calculateFinalScores(players, 'slovenian');
    expect(result.finalScores[0]).toBe(100 + 10);
    expect(result.finalScores[1]).toBe(90 - 10);
  });

  it('empty racks result in correct remaining', () => {
    const players = [
      { score: 100, rack: [] },
      { score: 90, rack: [] },
    ];
    const result = R.calculateFinalScores(players, 'english');
    expect(result.remaining).toEqual([0, 0]);
    expect(result.finalScores).toEqual([100, 90]);
  });
});

describe('integration tests', () => {
  it('complete first turn: place CAT, score, validate', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');

    const validation = R.validatePlacement(board);
    expect(validation.ok).toBe(true);

    const words = R.getWordsFromBoard(board);
    const newWords = words.filter((w) => w.tiles.some((t) => t.isNew));
    expect(newWords.length).toBe(1);

    const score = R.scoreWord(board, newWords[0], 'english');
    expect(score).toBe(10);
  });

  it('second turn: extend CAT to CATS', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);

    put(board, 7, 9, 's');
    const validation = R.validatePlacement(board);
    expect(validation.ok).toBe(true);

    const words = R.getWordsFromBoard(board);
    const newWords = words.filter((w) => w.tiles.some((t) => t.isNew));
    const catsWord = newWords.find((w) => w.word === 'cats');
    expect(catsWord).toBeDefined();
  });

  it('cross-word formation', () => {
    const board = R.createBoard();
    put(board, 7, 6, 'c');
    put(board, 7, 7, 'a');
    put(board, 7, 8, 't');
    lock(board);

    put(board, 6, 7, 'b');
    const validation = R.validatePlacement(board);
    expect(validation.ok).toBe(true);

    const words = R.getWordsFromBoard(board);
    const newWords = words.filter((w) => w.tiles.some((t) => t.isNew));
    const baWord = newWords.find((w) => w.word === 'ba');
    expect(baWord).toBeDefined();
  });
});
