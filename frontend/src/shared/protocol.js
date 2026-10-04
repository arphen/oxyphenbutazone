// Untrusted-input handling shared by every device. Pure: no Vue, no I/O.
//
// Trust model: any peer (or anything that can reach the host) may be spoofed or compromised, so
//  - the HOST runs every incoming action through sanitizeAction() before the engine sees it, and
//  - a GUEST runs every state it receives through sanitizeGameState() before rendering it.
// Both rebuild objects from a whitelist (unknown keys are dropped, sizes and ranges are capped), so
// nothing attacker-shaped reaches the engine, the reactive UI state or storage.
//
// This is input hygiene, not anti-cheat: a host can still see everything and bend the rules.

import { BOARD_SIZE, RACK_SIZE } from './rules.js';

export const MAX_ACTION_BYTES = 4 * 1024;
export const MAX_STATE_BYTES = 1024 * 1024;
export const MAX_PLAYERS = 4;
export const ACTION_TYPES = [
  'place-tile',
  'set-blank-letter',
  'recall',
  'recall-tile',
  'play-word',
  'pass',
  'exchange-tiles',
  'reorder-rack',
  'update-viewport',
  'update-dictionary',
  'restart',
  'validate-word',
];

const LANGUAGES = ['english', 'slovenian'];
const SQUARE_TYPES = ['', 'tw', 'dw', 'tl', 'dl', 'center'];
const MESSAGE_TYPES = ['', 'info', 'success', 'error'];
const DICTIONARY_KEYS = ['csw21', 'nwl2023', 'slovenian'];
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]', 'g');
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
  }
}

const fail = (message) => {
  throw new ProtocolError(message);
};

// ---------------------------------------------------------------- parsing

/** JSON.parse with a size cap and without the keys that enable prototype pollution downstream. */
export function safeJsonParse(text, maxBytes = MAX_STATE_BYTES) {
  if (typeof text !== 'string') fail('Message is not text');
  // Cheap upper bound first (a UTF-16 code unit is at most 3 UTF-8 bytes) so huge inputs are never parsed.
  if (text.length > maxBytes) fail('Message too large');
  try {
    return JSON.parse(text, (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value));
  } catch {
    return fail('Message is not valid JSON');
  }
}

// ---------------------------------------------------------------- primitives

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function int(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be an integer from ${min} to ${max}`);
  return value;
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} is not allowed`);
  return value;
}

/** A string with control characters removed and a length cap (truncated, never rejected). */
export function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').slice(0, maxLength);
}

/** '' (a blank tile) or a single lowercase letter. Whether it fits the game's alphabet is checked by the engine. */
function tileLetter(value, label, { allowBlank }) {
  if (value === '' && allowBlank) return '';
  if (typeof value !== 'string' || [...value].length !== 1 || !/^\p{Ll}$/u.test(value)) {
    fail(`${label} must be a single lowercase letter`);
  }
  return value;
}

const cellCoord = (v, label) => int(v, 0, BOARD_SIZE - 1, label);
const playerIdOf = (v) => int(v, 1, MAX_PLAYERS, 'playerId');

// ---------------------------------------------------------------- actions

/**
 * Validate and rebuild an action received from a peer or over HTTP.
 * Returns { ok: true, action } with ONLY the whitelisted fields, or { ok: false, error }.
 */
export function sanitizeAction(raw) {
  try {
    if (!isPlainObject(raw)) fail('Action must be an object');
    const type = oneOf(raw.type, ACTION_TYPES, 'Action type');

    switch (type) {
      case 'place-tile': {
        const action = {
          type,
          playerId: playerIdOf(raw.playerId),
          rackIndex: int(raw.rackIndex, 0, RACK_SIZE - 1, 'rackIndex'),
          row: cellCoord(raw.row, 'row'),
          col: cellCoord(raw.col, 'col'),
        };
        // `letter` from the client is advisory only; the engine uses what is really in the rack at rackIndex.
        if (raw.letter !== undefined) action.letter = tileLetter(raw.letter, 'letter', { allowBlank: true });
        if (raw.chosenLetter !== undefined && raw.chosenLetter !== null && raw.chosenLetter !== '') {
          action.chosenLetter = tileLetter(raw.chosenLetter, 'chosenLetter', { allowBlank: false });
        }
        return { ok: true, action };
      }
      case 'set-blank-letter':
        return {
          ok: true,
          action: {
            type,
            row: cellCoord(raw.row, 'row'),
            col: cellCoord(raw.col, 'col'),
            chosenLetter: tileLetter(raw.chosenLetter, 'chosenLetter', { allowBlank: false }),
          },
        };
      case 'recall-tile':
        return {
          ok: true,
          action: {
            type,
            playerId: playerIdOf(raw.playerId),
            row: cellCoord(raw.row, 'row'),
            col: cellCoord(raw.col, 'col'),
          },
        };
      case 'recall':
      case 'play-word':
      case 'pass':
        return { ok: true, action: { type, playerId: playerIdOf(raw.playerId) } };
      case 'exchange-tiles': {
        if (!Array.isArray(raw.indices) || raw.indices.length === 0 || raw.indices.length > RACK_SIZE) {
          fail('indices must list 1-7 rack positions');
        }
        const indices = raw.indices.map((i) => int(i, 0, RACK_SIZE - 1, 'index'));
        if (new Set(indices).size !== indices.length) fail('indices must be distinct');
        return { ok: true, action: { type, playerId: playerIdOf(raw.playerId), indices } };
      }
      case 'reorder-rack': {
        if (!Array.isArray(raw.newRack) || raw.newRack.length > RACK_SIZE) fail('newRack must be an array of up to 7 tiles');
        const newRack = raw.newRack.map((t) => tileLetter(t, 'tile', { allowBlank: true }));
        return { ok: true, action: { type, playerId: playerIdOf(raw.playerId), newRack } };
      }
      case 'update-viewport': {
        if (!isPlainObject(raw.viewportCenter)) fail('viewportCenter is required');
        return {
          ok: true,
          action: {
            type,
            viewportCenter: { row: cellCoord(raw.viewportCenter.row, 'row'), col: cellCoord(raw.viewportCenter.col, 'col') },
          },
        };
      }
      case 'update-dictionary': {
        if (!isPlainObject(raw.dictionaries)) fail('dictionaries is required');
        const dictionaries = {};
        for (const key of DICTIONARY_KEYS) dictionaries[key] = raw.dictionaries[key] === true;
        if (!DICTIONARY_KEYS.some((key) => dictionaries[key])) fail('Select at least one dictionary');
        return { ok: true, action: { type, dictionaries } };
      }
      case 'restart': {
        const action = { type };
        if (raw.playerCount !== undefined) action.playerCount = int(raw.playerCount, 2, MAX_PLAYERS, 'playerCount');
        if (raw.language !== undefined) action.language = oneOf(raw.language, LANGUAGES, 'language');
        return { ok: true, action };
      }
      case 'validate-word': {
        if (typeof raw.word !== 'string' || !/^\p{L}{1,25}$/u.test(raw.word)) fail('word must be 1-25 letters');
        return { ok: true, action: { type, word: raw.word } };
      }
      default:
        return fail('Unknown action type');
    }
  } catch (error) {
    if (error instanceof ProtocolError) return { ok: false, error: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------- game state (host -> guest)

function cleanCell(cell) {
  if (!isPlainObject(cell)) fail('Board cell is malformed');
  return {
    letter: tileLetter(cell.letter ?? '', 'cell letter', { allowBlank: true }),
    type: oneOf(cell.type ?? '', SQUARE_TYPES, 'square type'),
    isNew: cell.isNew === true,
    locked: cell.locked === true,
    isBlank: cell.isBlank === true,
    chosenLetter: tileLetter(cell.chosenLetter ?? '', 'chosen letter', { allowBlank: true }),
  };
}

function cleanBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) fail('Board must have 15 rows');
  return board.map((row) => {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) fail('Board rows must have 15 cells');
    return row.map(cleanCell);
  });
}

const cleanTiles = (tiles, max, label) => {
  if (!Array.isArray(tiles) || tiles.length > max) fail(`${label} is malformed`);
  return tiles.map((t) => tileLetter(t, `${label} tile`, { allowBlank: true }));
};

function cleanHistoryEntry(entry) {
  if (!isPlainObject(entry)) fail('History entry is malformed');
  const clean = {
    turnNumber: int(entry.turnNumber, 0, 10000, 'turnNumber'),
    totalScore: int(entry.totalScore ?? 0, -10000, 10000, 'totalScore'),
  };
  if (entry.action !== undefined) clean.action = cleanString(entry.action, 20);
  if (entry.bingoBonus !== undefined) clean.bingoBonus = int(entry.bingoBonus, 0, 1000, 'bingoBonus');
  if (entry.count !== undefined) clean.count = int(entry.count, 0, RACK_SIZE, 'count');
  if (entry.timestamp !== undefined) clean.timestamp = cleanString(entry.timestamp, 40);
  if (entry.words !== undefined) {
    if (!Array.isArray(entry.words) || entry.words.length > 15) fail('History words are malformed');
    clean.words = entry.words.map((w) => {
      if (!isPlainObject(w)) fail('History word is malformed');
      return {
        word: cleanString(w.word, 25),
        score: int(w.score ?? 0, 0, 10000, 'word score'),
        definition: cleanString(w.definition, 600),
      };
    });
  }
  return clean;
}

function cleanPlayer(player) {
  if (!isPlainObject(player)) fail('Player is malformed');
  if (!Array.isArray(player.history) || player.history.length > 1000) fail('History is malformed');
  return {
    playerName: cleanString(player.playerName, 30),
    rack: cleanTiles(player.rack, RACK_SIZE, 'rack'),
    score: int(player.score, -100000, 100000, 'score'),
    history: player.history.map(cleanHistoryEntry),
    isCurrentPlayer: player.isCurrentPlayer === true,
  };
}

function cleanFinalScores(scores, playerCount) {
  if (scores === null || scores === undefined) return null;
  if (!isPlainObject(scores)) fail('finalScores is malformed');
  const clean = {};
  for (let i = 1; i <= playerCount; i++) {
    clean[`player${i}`] = int(scores[`player${i}`], -100000, 100000, 'final score');
    clean[`player${i}Remaining`] = int(scores[`player${i}Remaining`] ?? 0, 0, 1000, 'remaining value');
  }
  return clean;
}

/**
 * Rebuild a game state received from the host. Throws ProtocolError when the shape is unacceptable.
 * The result contains only known fields, so it is safe to put into reactive state and render.
 */
export function sanitizeGameState(raw) {
  if (!isPlainObject(raw)) fail('Game state must be an object');
  const playerCount = int(raw.playerCount, 2, MAX_PLAYERS, 'playerCount');

  const state = {
    board: cleanBoard(raw.board),
    tileBag: cleanTiles(raw.tileBag ?? [], 200, 'tileBag'),
    viewportCenter: {
      row: cellCoord(raw.viewportCenter?.row, 'row'),
      col: cellCoord(raw.viewportCenter?.col, 'col'),
    },
    currentPlayer: int(raw.currentPlayer, 1, playerCount, 'currentPlayer'),
    playerCount,
    language: oneOf(raw.language, LANGUAGES, 'language'),
    dictionaries: Object.fromEntries(DICTIONARY_KEYS.map((k) => [k, raw.dictionaries?.[k] === true])),
    consecutivePasses: int(raw.consecutivePasses ?? 0, 0, 100, 'consecutivePasses'),
    gameOver: raw.gameOver === true,
    winner: raw.winner === null || raw.winner === undefined ? null : int(raw.winner, 0, playerCount, 'winner'),
    finalScores: cleanFinalScores(raw.finalScores, playerCount),
    message: cleanString(raw.message, 300),
    messageType: oneOf(raw.messageType ?? '', MESSAGE_TYPES, 'messageType'),
    gameId: cleanString(raw.gameId, 16),
  };
  for (let i = 1; i <= playerCount; i++) state[`player${i}`] = cleanPlayer(raw[`player${i}`]);
  return state;
}

/** Wraps sanitizeGameState for callers that prefer a result object over exceptions. */
export function trySanitizeGameState(raw) {
  try {
    return { ok: true, state: sanitizeGameState(raw) };
  } catch (error) {
    if (error instanceof ProtocolError) return { ok: false, error: error.message };
    throw error;
  }
}
