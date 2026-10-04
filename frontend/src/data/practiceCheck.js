// Pure helpers for Practice Mode: turn a scenario into board cells, and judge a play on those cells with the real
// game rules (placement, words formed, premium squares, bingo bonus). No Vue, no network: the dictionary check is
// handed in by the caller, so this works with whichever word list the player has.

import { BINGO_BONUS, RACK_SIZE, createBoard, getWordsFromBoard, scoreWord, validatePlacement } from '../shared/rules.js';

/** The board cells of a scenario, ready to show: scenario tiles are `isPracticeOriginal`, premium squares have a `type`. */
export function scenarioCells(scenario) {
  const template = createBoard();
  return scenario.board.map((row, r) =>
    row.map((letter, c) => ({
      letter: letter || '',
      type: template[r][c].type,
      isNew: false,
      isPracticeOriginal: Boolean(letter),
    }))
  );
}

/** Cells as Practice Mode keeps them -> a board for the rules module (scenario tiles are locked, the player's are new). */
function toRulesBoard(cells) {
  const board = createBoard();
  cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell.letter) return;
      board[r][c].letter = cell.letter.toLowerCase();
      board[r][c].locked = Boolean(cell.isPracticeOriginal);
      board[r][c].isNew = Boolean(cell.isNew) && !cell.isPracticeOriginal;
    })
  );
  return board;
}

/**
 * Judge the tiles the player has placed.
 * Returns { ok: false, message } when the placement is not legal (gap, not in one line, not touching the scenario's
 * tiles, first word off the centre star), otherwise { ok: true, words: [{ word, score }], score } where `words` are
 * every word that uses a new tile (upper case) and `score` includes the bingo bonus for using all seven tiles.
 */
export function evaluatePlay(cells) {
  const board = toRulesBoard(cells);
  const placement = validatePlacement(board);
  if (!placement.ok) return { ok: false, message: placement.message };

  const words = getWordsFromBoard(board)
    .filter((w) => w.tiles.some((t) => t.isNew))
    .map((w) => ({ word: w.word.toUpperCase(), score: scoreWord(board, w, 'english') }));
  const newTiles = board.flat().filter((cell) => cell.isNew).length;
  const score = words.reduce((sum, w) => sum + w.score, 0) + (newTiles === RACK_SIZE ? BINGO_BONUS : 0);
  return { ok: true, words, score };
}

/**
 * Which of the played words are not in the player's word list.
 * @param validate async (word) => boolean
 */
export async function findInvalidWords(words, validate) {
  const unique = [...new Set(words.map((w) => w.word))];
  const verdicts = await Promise.all(unique.map(async (word) => ({ word, valid: await validate(word) })));
  return verdicts.filter((v) => !v.valid).map((v) => v.word);
}

/** The scenario's solution whose word was played, if any. */
export function findSolution(scenario, playedWords) {
  const played = new Set(playedWords.map((w) => w.word));
  return scenario.solutions.find((solution) => played.has(solution.word.toUpperCase())) || null;
}

/** Did the player put exactly the solution's tiles on exactly its squares? */
export function sameTiles(cells, solution) {
  const placed = [];
  cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.isNew && cell.letter) placed.push(`${r},${c},${cell.letter.toUpperCase()}`);
    })
  );
  const wanted = solution.tiles.map((t) => `${t.row},${t.col},${t.letter.toUpperCase()}`);
  return placed.length === wanted.length && wanted.every((key) => placed.includes(key));
}
