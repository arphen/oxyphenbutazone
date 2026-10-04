import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGamePersistence } from './useGamePersistence.js';

const CURRENT_KEY = 'oxyphenbutazone_current_game';
const HISTORY_KEY = 'oxyphenbutazone_games';

let storage;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

const gameState = (overrides = {}) => ({
  board: [],
  player1: { playerName: 'Alice', score: 10, rack: ['a', 'b', 'c'], isCurrentPlayer: false },
  player2: { playerName: 'Bob', score: 3, rack: ['d', 'e', 'f'], isCurrentPlayer: true },
  currentPlayer: 2,
  message: null,
  gameOver: false,
  ...overrides,
});

describe('session round-trips (refresh mid-game loses nothing)', () => {
  it('start -> move -> reload (new instance) -> move -> complete -> history', () => {
    const first = useGamePersistence();
    const id = first.startNewGame(gameState());
    expect(typeof id).toBe('string');
    first.saveMove(gameState(), 'play-word', { playerId: '1', scoreBefore: 0, wordsFormed: [] });

    // The page reloads: a new composable instance picks up the same storage
    const reloaded = useGamePersistence();
    const current = reloaded.getCurrentGame();
    expect(current).not.toBeNull();
    expect(current.moves).toHaveLength(1);
    expect(current.moves[0].action).toBe('play-word');
    expect(current.status).toBe('in-progress');

    reloaded.saveMove(gameState({ currentPlayer: 1 }), 'pass', { playerId: '2', scoreBefore: 3 });
    expect(reloaded.getCurrentGame().moves).toHaveLength(2);

    reloaded.completeGame(gameState({ gameOver: true, winner: 1 }));
    expect(reloaded.getCurrentGame()).toBeNull(); // cleared from "current"
    const history = reloaded.getAllGames();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].moves).toHaveLength(2);
    expect(history[0].metadata.winner).toBe(1);

    // Completing twice does not duplicate history
    reloaded.resumeGame(history[0].id);
    reloaded.completeGame(gameState({ gameOver: true, winner: 1 }));
    expect(reloaded.getAllGames()).toHaveLength(1);
  });

  it('resume and delete round-trip through history', () => {
    const p = useGamePersistence();
    const id = p.startNewGame(gameState());
    p.completeGame(gameState({ gameOver: true }));
    expect(p.getCurrentGame()).toBeNull();

    const resumed = p.resumeGame(id);
    expect(resumed).not.toBeNull();
    expect(p.getCurrentGame().id).toBe(id);
    p.deleteGame(id);
    expect(p.getAllGames()).toHaveLength(0);
    expect(p.getCurrentGame()).toBeNull();
    expect(p.resumeGame('missing')).toBeNull();
  });
});

describe('corrupt storage falls back safely', () => {
  it('half-written current game is quarantined (removed) and reads as null', () => {
    storage.set(CURRENT_KEY, '{"v":1,"id":"game_1","data":{');
    const p = useGamePersistence();
    expect(p.getCurrentGame()).toBeNull();
    expect(storage.has(CURRENT_KEY)).toBe(false); // quarantined so a fresh game can start
    // ...and a fresh game can indeed start afterwards
    expect(p.startNewGame(gameState())).toMatch(/^game_/);
    expect(p.getCurrentGame()).not.toBeNull();
  });

  it('an unknown envelope version reads as null', () => {
    storage.set(CURRENT_KEY, JSON.stringify({ v: 999, id: 'game_1', data: { id: 'game_1', moves: [] } }));
    expect(useGamePersistence().getCurrentGame()).toBeNull();
  });

  it('a current game with the wrong shape reads as null', () => {
    storage.set(CURRENT_KEY, JSON.stringify({ v: 1, id: 'game_1', data: { moves: 'not-an-array' } }));
    expect(useGamePersistence().getCurrentGame()).toBeNull();
  });

  it('corrupt history reads as [] and valid entries survive alongside garbage', () => {
    storage.set(HISTORY_KEY, 'nope{');
    expect(useGamePersistence().getAllGames()).toEqual([]);
    storage.set(
      HISTORY_KEY,
      JSON.stringify({ v: 1, games: [{ id: 'good', moves: [], status: 'completed' }, 42, null, { id: 7 }] })
    );
    expect(useGamePersistence().getAllGames()).toEqual([{ id: 'good', moves: [], status: 'completed' }]);
  });

  it('legacy formats (bare array history, unenveloped current game) still load', () => {
    storage.set(HISTORY_KEY, JSON.stringify([{ id: 'legacy', moves: [], status: 'completed' }]));
    expect(useGamePersistence().getAllGames()).toHaveLength(1);
    storage.set(CURRENT_KEY, JSON.stringify({ id: 'legacy-current', data: { id: 'legacy-current', moves: [] } }));
    const p = useGamePersistence();
    expect(p.getCurrentGame().id).toBe('legacy-current');
  });
});

describe('full or unavailable storage never breaks playing', () => {
  const failingStore = () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    });
  };

  it('start/save/complete do not throw when writes fail', () => {
    failingStore();
    const p = useGamePersistence();
    expect(() => {
      const id = p.startNewGame(gameState());
      p.saveMove(gameState(), 'pass', { playerId: '1', scoreBefore: 10 });
      p.completeGame(gameState({ gameOver: true }));
      p.deleteGame(id);
    }).not.toThrow();
  });
});
