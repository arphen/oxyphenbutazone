import { describe, expect, it } from 'vitest';
import {
  computeLibido,
  computeWordCues,
  countHelps,
  diffFresh,
  rankWords,
  scanAnchors,
  scanWords,
  snapshotBoard,
} from './useWordCues';

const empty = () => ({ type: 'normal' });
const tile = (letter) => ({ type: 'normal', letter, locked: true });
const boardOf = (rows) =>
  rows.map((row) => [...row].map((ch) => (ch === '.' ? empty() : tile(ch))));

// CAT across row 1, CAR down column 0: C shared, A shared diagonally? No —
// rows: row0: C . . / row1: C A T / row2: R . .
// H word: CAT (1,0-2). V word: CAR? col0 rows0-2 = C,C,R — not CAR. Build:
// row0: . A . / row1: C A T / row2: . R .  → H: CAT; V: AR? col1 rows0-2 = A,A,R (3-run "AAR").
// Simpler fixture: H "HI" at row 0, V "HE" at col 0 sharing H.
const fixture = () =>
  boardOf([
    ['H', 'I', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['E', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ...Array.from({ length: 13 }, () => Array(15).fill('.')),
  ]);

describe('scanWords', () => {
  it('finds both directions and shares the crossing cell', () => {
    const words = scanWords(fixture());
    expect(words).toHaveLength(2);
    const h = words.find((w) => w.dir === 'h');
    const v = words.find((w) => w.dir === 'v');
    expect(h.text).toBe('HI');
    expect(v.text).toBe('HE');
    expect(h.cells).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(v.cells).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it('ignores lone tiles', () => {
    const board = boardOf(Array.from({ length: 15 }, () => Array(15).fill('.')));
    board[7][7] = tile('Z');
    expect(scanWords(board)).toHaveLength(0);
  });
});

describe('rankWords', () => {
  it('ranks distinct strings and spans 0..1', () => {
    const ranked = rankWords([
      { text: 'ZEBRA', dir: 'h', cells: [] },
      { text: 'APPLE', dir: 'v', cells: [] },
      { text: 'MANGO', dir: 'h', cells: [] },
    ]);
    expect(ranked.find((w) => w.text === 'APPLE').rank).toBe(0);
    expect(ranked.find((w) => w.text === 'ZEBRA').rank).toBe(1);
    expect(ranked.find((w) => w.text === 'MANGO').rank).toBe(0.5);
  });

  it('gives each pole its own arc for the same string', () => {
    const ranked = rankWords([
      { text: 'HI', dir: 'h', cells: [] },
      { text: 'HI', dir: 'v', cells: [] },
    ]);
    expect(ranked[0].rank).toBe(ranked[1].rank);
    expect(ranked[0].pole).toBe('a');
    expect(ranked[1].pole).toBe('b');
  });
});

describe('scanAnchors', () => {
  it('offers the centre on an empty board', () => {
    const board = boardOf(Array.from({ length: 15 }, () => Array(15).fill('.')));
    expect(scanAnchors(board)).toEqual([[7, 7]]);
  });

  it('marks empty neighbours of tiles', () => {
    const anchors = scanAnchors(fixture());
    expect(anchors).toContainEqual([0, 2]);
    expect(anchors).toContainEqual([1, 1]);
    expect(anchors).not.toContainEqual([0, 0]);
  });
});

describe('computeWordCues', () => {
  it('paints ticks, spill and ink trace, and matches history chips', () => {
    const board = fixture();
    const cues = computeWordCues(
      board,
      [{ words: [{ word: 'HI' }, { word: 'HE' }] }],
      new Set(['0,1'])
    );
    // Start ticks: east for H, south for V.
    expect(cues.cell['0,0'].tick).toBe('e');
    // The second cell of each word spills flat; the third would step down.
    expect(cues.cell['0,1'].spill).toBe(1);
    // Fresh cells name the latest words on both surfaces.
    expect(cues.cell['0,1'].latest).toBe(true);
    expect(cues.cell['1,0'].latest).toBe(false);
    // Chips wear the board's own ranks: HI is rank 1 (pole a), HE rank 0 (b).
    expect(cues.entryCues[0]).toEqual([
      { rank: 1, pole: 'a', latest: true },
      { rank: 0, pole: 'b', latest: false },
    ]);
    // Territory corners come from what is on screen.
    expect(cues.territory).toEqual({ aTop: 1, aBottom: 1, bTop: 0, bBottom: 0 });
  });

  it('matches lowercase history words to uppercase board words', () => {
    // The engine stores lowercase; the board reads uppercase. Matching must
    // bridge the case or no chip ever wears its rank (R26).
    const board = fixture();
    const cues = computeWordCues(board, [{ words: [{ word: 'hi' }, { word: 'he' }] }], new Set());
    expect(cues.entryCues[0]).toEqual([
      { rank: 1, pole: 'a', latest: false },
      { rank: 0, pole: 'b', latest: false },
    ]);
  });

  it('leaves invalid words unmatched: a verdict needs no hue', () => {
    const cues = computeWordCues(fixture(), [{ action: 'invalid', words: [{ word: 'ZZZ' }] }]);
    expect(cues.entryCues[0]).toHaveLength(0);
  });
});

describe('helps and libido', () => {
  it('counts every costly action and drains 8% each', () => {
    const counts = countHelps([
      [{ action: 'pass' }, { action: 'play' }],
      [{ action: 'exchange' }, { action: 'invalid', words: [] }],
    ]);
    expect(counts).toEqual({ pass: 1, exchange: 1, invalid: 1 });
    expect(computeLibido(counts)).toBe(0.76);
    expect(computeLibido({ pass: 0, exchange: 0, invalid: 0 })).toBe(1);
    expect(computeLibido({ pass: 20, exchange: 0, invalid: 0 })).toBe(0);
  });
});

describe('snapshot and fresh diff', () => {
  it('names only the squares that changed', () => {
    const before = boardOf(Array.from({ length: 15 }, () => Array(15).fill('.')));
    const { snap } = diffFresh(null, before);
    const after = boardOf(Array.from({ length: 15 }, () => Array(15).fill('.')));
    after[7][7] = tile('Z');
    after[7][8] = { type: 'normal', letter: 'Q', isNew: true };
    const next = diffFresh(snap, after);
    expect(next.fresh.has('7,7')).toBe(true);
    expect(next.fresh.has('7,8')).toBe(true);
    expect(next.fresh.has('0,0')).toBe(false);
    expect(snapshotBoard(after)[7][7]).toBe('Z');
  });
});
