// Pure game rules: no Vue, no Vite, no I/O. Runs in Node (the dev-server plugin),
// in the browser, and under test.
//
// A board is a 15x15 array of cells shaped like:
//   { letter, type, isNew, locked, isBlank, chosenLetter }
// A blank tile has `letter: ''`, `isBlank: true`, and the letter it stands for in `chosenLetter`.

export const BOARD_SIZE = 15;
export const CENTER = { row: 7, col: 7 };
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;

const SPECIAL_SQUARES = {
  tw: [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]],
  dw: [[1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10], [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10]],
  tl: [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]],
  dl: [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]],
  center: [[7, 7]],
};

export const TILE_DISTRIBUTIONS = {
  english: {
    tiles: [
      { letter: 'e', count: 12 }, { letter: 'a', count: 9 }, { letter: 'i', count: 9 },
      { letter: 'o', count: 8 }, { letter: 'n', count: 6 }, { letter: 'r', count: 6 },
      { letter: 't', count: 6 }, { letter: 'l', count: 4 }, { letter: 's', count: 4 },
      { letter: 'u', count: 4 }, { letter: 'd', count: 4 }, { letter: 'g', count: 3 },
      { letter: 'b', count: 2 }, { letter: 'c', count: 2 }, { letter: 'm', count: 2 },
      { letter: 'p', count: 2 }, { letter: 'f', count: 2 }, { letter: 'h', count: 2 },
      { letter: 'v', count: 2 }, { letter: 'w', count: 2 }, { letter: 'y', count: 2 },
      { letter: 'k', count: 1 }, { letter: 'j', count: 1 }, { letter: 'x', count: 1 },
      { letter: 'q', count: 1 }, { letter: 'z', count: 1 }, { letter: '', count: 2 },
    ],
    values: {
      a: 1, e: 1, i: 1, o: 1, u: 1, l: 1, n: 1, s: 1, t: 1, r: 1,
      d: 2, g: 2, b: 3, c: 3, m: 3, p: 3,
      f: 4, h: 4, v: 4, w: 4, y: 4, k: 5,
      j: 8, x: 8, q: 10, z: 10, '': 0,
    },
  },
  slovenian: {
    tiles: [
      { letter: 'e', count: 11 }, { letter: 'a', count: 10 }, { letter: 'i', count: 9 },
      { letter: 'o', count: 8 }, { letter: 'n', count: 7 }, { letter: 'r', count: 6 },
      { letter: 's', count: 6 }, { letter: 'j', count: 4 }, { letter: 'l', count: 4 },
      { letter: 't', count: 4 }, { letter: 'd', count: 4 }, { letter: 'v', count: 4 },
      { letter: 'k', count: 3 }, { letter: 'm', count: 2 }, { letter: 'p', count: 2 },
      { letter: 'u', count: 2 }, { letter: 'b', count: 2 }, { letter: 'g', count: 2 },
      { letter: 'z', count: 2 }, { letter: 'č', count: 1 }, { letter: 'h', count: 1 },
      { letter: 'š', count: 1 }, { letter: 'c', count: 1 }, { letter: 'f', count: 1 },
      { letter: 'ž', count: 1 }, { letter: '', count: 2 },
    ],
    values: {
      e: 1, a: 1, i: 1, o: 1, n: 1, r: 1, s: 1, j: 1, l: 1, t: 1,
      d: 2, v: 2, k: 3, m: 3, p: 3, u: 3,
      b: 4, g: 4, z: 4, 'č': 5, h: 5, 'š': 6, c: 8, f: 10, 'ž': 10, '': 0,
    },
  },
};

export function getDistribution(language) {
  return TILE_DISTRIBUTIONS[language] || TILE_DISTRIBUTIONS.english;
}

/** Face value of a tile in the given language. Blank ('') and unknown letters are 0. */
export function letterValue(language, letter) {
  return getDistribution(language).values[(letter || '').toLowerCase()] || 0;
}

/** A shuffled bag of tiles. `rng` is injectable for deterministic tests. */
export function createTileBag(language = 'english', rng = Math.random) {
  const bag = [];
  for (const { letter, count } of getDistribution(language).tiles) {
    for (let i = 0; i < count; i++) bag.push(letter);
  }
  return shuffle(bag, rng);
}

export function shuffle(items, rng = Math.random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function createBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      letter: '',
      type: '',
      isNew: false,
      locked: false,
      isBlank: false,
      chosenLetter: '',
    }))
  );
  for (const [type, positions] of Object.entries(SPECIAL_SQUARES)) {
    for (const [row, col] of positions) board[row][col].type = type;
  }
  return board;
}

export function isOccupied(cell) {
  return Boolean(cell && (cell.letter || cell.isBlank));
}

/** The letter a cell contributes to a word (the chosen letter for a blank). */
export function cellLetter(cell) {
  return cell.isBlank ? cell.chosenLetter : cell.letter;
}

export function findNewTiles(board) {
  const tiles = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      if (cell.isNew) tiles.push({ row, col, letter: cell.letter, isBlank: cell.isBlank });
    }
  }
  return tiles;
}

/** Every run of 2+ tiles on the board, horizontal and vertical. */
export function getWordsFromBoard(board) {
  const words = [];

  const scanLine = (direction, outer) => {
    let word = '';
    let tiles = [];
    const flush = () => {
      if (word.length > 1) words.push({ word, tiles, direction });
      word = '';
      tiles = [];
    };
    for (let inner = 0; inner < BOARD_SIZE; inner++) {
      const row = direction === 'horizontal' ? outer : inner;
      const col = direction === 'horizontal' ? inner : outer;
      const cell = board[row][col];
      if (isOccupied(cell)) {
        const letter = cellLetter(cell);
        word += letter;
        tiles.push({ row, col, letter, isNew: cell.isNew, isBlank: cell.isBlank });
      } else {
        flush();
      }
    }
    flush();
  };

  for (let i = 0; i < BOARD_SIZE; i++) scanLine('horizontal', i);
  for (let i = 0; i < BOARD_SIZE; i++) scanLine('vertical', i);
  return words;
}

/** Score one word. Premium squares only count under tiles placed this turn; blanks score 0. */
export function scoreWord(board, wordObj, language) {
  let score = 0;
  let wordMultiplier = 1;

  for (const tile of wordObj.tiles) {
    let value = tile.isBlank ? 0 : letterValue(language, tile.letter);
    if (tile.isNew) {
      const { type } = board[tile.row][tile.col];
      if (type === 'dl') value *= 2;
      if (type === 'tl') value *= 3;
      if (type === 'dw' || type === 'center') wordMultiplier *= 2;
      if (type === 'tw') wordMultiplier *= 3;
    }
    score += value;
  }
  return score * wordMultiplier;
}

/**
 * Check that this turn's new tiles form a legal placement, independent of the dictionary:
 * one row or column, no gaps, covering the centre on the first move, and otherwise
 * touching a tile that was already locked.
 * Returns { ok: true, direction } or { ok: false, code, message }.
 */
export function validatePlacement(board) {
  const fail = (code, message) => ({ ok: false, code, message });
  const newTiles = findNewTiles(board);
  if (newTiles.length === 0) return fail('no-tiles', 'No tiles placed!');

  const rows = new Set(newTiles.map((t) => t.row));
  const cols = new Set(newTiles.map((t) => t.col));
  if (rows.size > 1 && cols.size > 1) {
    return fail('not-in-line', 'Tiles must all be in one row or one column.');
  }

  const direction = rows.size === 1 && cols.size > 1 ? 'horizontal'
    : cols.size === 1 && rows.size > 1 ? 'vertical'
    : 'single';

  if (direction !== 'single') {
    const horizontal = direction === 'horizontal';
    const fixed = horizontal ? [...rows][0] : [...cols][0];
    const positions = newTiles.map((t) => (horizontal ? t.col : t.row));
    for (let i = Math.min(...positions); i <= Math.max(...positions); i++) {
      const cell = horizontal ? board[fixed][i] : board[i][fixed];
      if (!isOccupied(cell)) return fail('gap', 'There are gaps between the tiles you placed.');
    }
  }

  const hasLocked = board.some((r) => r.some((c) => isOccupied(c) && c.locked));
  if (!hasLocked) {
    const coversCenter = newTiles.some((t) => t.row === CENTER.row && t.col === CENTER.col);
    if (!coversCenter) return fail('no-center', 'First word must use the center square (★)!');
    return { ok: true, direction };
  }

  const touchesLocked = newTiles.some(({ row, col }) =>
    [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
      const neighbour = board[row + dr]?.[col + dc];
      return isOccupied(neighbour) && neighbour.locked;
    })
  );
  if (!touchesLocked) {
    return fail('not-connected', 'Your word must connect to tiles already on the board.');
  }
  return { ok: true, direction };
}

/**
 * End-of-game adjustment: everyone loses the value of their remaining tiles, and a player who
 * went out collects the total of everyone's remaining tiles.
 * `players` is an array of { score, rack }. Returns { finalScores, remaining } (index-aligned).
 */
export function calculateFinalScores(players, language) {
  const remaining = players.map((p) =>
    p.rack.reduce((sum, letter) => sum + letterValue(language, letter), 0)
  );
  const total = remaining.reduce((a, b) => a + b, 0);
  const wentOut = players.findIndex((p) => p.rack.length === 0);
  const finalScores = players.map((p, i) => p.score - remaining[i] + (i === wentOut ? total : 0));
  return { finalScores, remaining };
}
