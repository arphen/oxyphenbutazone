// word-cues.js — Afterglow S3/S6/S7 for the word-tile game.
//
// ITEMS are the words on the board (N grows into the dozens: the ramp's
// sweet spot). POLES are direction: horizontal owns the warm half of the hue
// wheel, vertical the cool half (R3). Rank is shared: the same word string in
// both directions wears each pole's hue in turn (§3.3).
// OPEN addresses (§10) are the anchor squares where a new word can begin:
// empty cells touching a tile (or the centre on an empty board). CLOSED
// things leave a remainder: committed tiles keep a trace of their word's hue
// in their ink (§9.4). Help (pass, exchange, invalid play) drains the charge.

export function isOccupied(cell) {
  return Boolean(cell && (cell.letter || cell.isBlank));
}

/** All H/V runs of 2+ tiles. A scored word always covers 2+ squares: a lone
 *  tile only scores as part of a longer run. */
export function scanWords(board) {
  const words = [];
  const size = board.length;
  const text = (r, c) => {
    const cell = board[r][c];
    return ((cell.isBlank ? cell.chosenLetter : cell.letter) || '').toUpperCase();
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isOccupied(board[r][c])) continue;
      // Horizontal run starts where the left neighbour is empty/off-board.
      if (
        (c === 0 || !isOccupied(board[r][c - 1])) &&
        c + 1 < size &&
        isOccupied(board[r][c + 1])
      ) {
        const cells = [];
        let cc = c;
        while (cc < size && isOccupied(board[r][cc])) {
          cells.push([r, cc]);
          cc++;
        }
        words.push({ text: cells.map(([rr, ccc]) => text(rr, ccc)).join(''), dir: 'h', cells });
      }
      // Vertical run starts where the upper neighbour is empty/off-board.
      if (
        (r === 0 || !isOccupied(board[r - 1][c])) &&
        r + 1 < size &&
        isOccupied(board[r + 1][c])
      ) {
        const cells = [];
        let rr = r;
        while (rr < size && isOccupied(board[rr][c])) {
          cells.push([rr, c]);
          rr++;
        }
        words.push({ text: cells.map(([rrr, cc]) => text(rrr, cc)).join(''), dir: 'v', cells });
      }
    }
  }
  return words;
}

/** Rank, not value (R2): distinct word strings sorted, index / (count − 1). */
export function rankWords(words) {
  const unique = [...new Set(words.map((w) => w.text))].sort();
  const span = unique.length > 1 ? unique.length - 1 : 1;
  const rankOf = new Map(unique.map((text, i) => [text, Math.round((i / span) * 1000) / 1000]));
  return words.map((w) => ({ ...w, rank: rankOf.get(w.text), pole: w.dir === 'h' ? 'a' : 'b' }));
}

/** Empty squares where a new word can begin: touching a tile, or the centre
 *  of an empty board. These are the notches (§10.1). */
export function scanAnchors(board) {
  const size = board.length;
  let anyTile = false;
  for (const row of board) {
    for (const cell of row) {
      if (isOccupied(cell)) {
        anyTile = true;
        break;
      }
    }
    if (anyTile) break;
  }
  if (!anyTile) {
    const centre = Math.floor(size / 2);
    return [[centre, centre]];
  }
  const anchors = [];
  const at = (r, c) => r >= 0 && c >= 0 && r < size && c < size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isOccupied(board[r][c])) continue;
      if (
        (at(r - 1, c) && isOccupied(board[r - 1][c])) ||
        (at(r + 1, c) && isOccupied(board[r + 1][c])) ||
        (at(r, c - 1) && isOccupied(board[r][c - 1])) ||
        (at(r, c + 1) && isOccupied(board[r][c + 1]))
      ) {
        anchors.push([r, c]);
      }
    }
  }
  return anchors;
}

/** Help counts across every seat's history. Invalid plays, exchanges and
 *  passes all cost the turn, so all three drain the charge (R25). */
export function countHelps(histories) {
  const counts = { pass: 0, exchange: 0, invalid: 0 };
  for (const history of histories) {
    for (const entry of history || []) {
      if (entry.action === 'pass') counts.pass++;
      else if (entry.action === 'exchange') counts.exchange++;
      else if (entry.action === 'invalid') counts.invalid++;
    }
  }
  return counts;
}

/** The charge the session has kept: full when no help was used, draining
 *  8% per help. Rounded to 3 decimals like every published number. */
export function computeLibido(counts) {
  const helps = counts.pass + counts.exchange + counts.invalid;
  return Math.round(Math.max(0, 1 - 0.08 * helps) * 1000) / 1000;
}

const key = (r, c) => `${r},${c}`;

/** A cheap snapshot of what is on the board: one string per square. */
export function snapshotBoard(board) {
  return (board || []).map((row) =>
    row.map((cell) =>
      isOccupied(cell)
        ? String(cell.isBlank ? cell.chosenLetter : cell.letter || '').toUpperCase()
        : ''
    )
  );
}

/** Squares whose letter changed since the snapshot (plus uncommitted tiles):
 *  committed tiles arrive once here; nothing re-animates afterwards. */
export function diffFresh(prevSnap, board) {
  const snap = snapshotBoard(board);
  const fresh = new Set();
  if (prevSnap && prevSnap.length === snap.length) {
    for (let r = 0; r < snap.length; r++) {
      for (let c = 0; c < snap[r].length; c++) {
        // Only arrivals light: a square that emptied leaves nothing behind.
        if ((snap[r][c] !== '' || board[r][c]?.isNew) && snap[r][c] !== prevSnap[r]?.[c]) {
          fresh.add(key(r, c));
        }
      }
    }
  } else if (prevSnap) {
    for (let r = 0; r < snap.length; r++) {
      for (let c = 0; c < snap[r].length; c++) {
        if (board[r][c]?.isNew) fresh.add(key(r, c));
      }
    }
  }
  return { snap, fresh };
}

/**
 * board: the 15x15 grid. historyEntries: chronological move entries with
 * { words: [{ word }], action }. freshKeys: "r,c" cells that just changed —
 * the words covering them are the active (latest) ones.
 */
export function computeWordCues(board, historyEntries = [], freshKeys = new Set()) {
  const words = rankWords(scanWords(board || []));
  const latest = new Set();
  const cell = {};
  const byText = new Map();
  for (const w of words) {
    if (!byText.has(w.text)) byText.set(w.text, []);
    byText.get(w.text).push(w);
  }

  for (const w of words) {
    const coversFresh = w.cells.some(([r, c]) => freshKeys.has(key(r, c)));
    if (coversFresh) latest.add(w);
    w.cells.forEach(([r, c], i) => {
      const k = key(r, c);
      const spill = i === 1 ? 1 : i === 2 ? 2 : 0;
      const prev = cell[k];
      // A crossing belongs to its longest word; the spill never outranks it.
      if (
        !prev ||
        w.cells.length > prev.length ||
        (w.cells.length === prev.length && w.dir === 'h' && prev.dir !== 'h')
      ) {
        cell[k] = {
          rank: w.rank,
          pole: w.pole,
          spill,
          latest: coversFresh,
          length: w.cells.length,
          dir: w.dir,
        };
      } else if (spill > 0 && spill > (prev.spill || 0)) {
        prev.spill = spill;
      }
      if (coversFresh) cell[k].latest = true;
    });
    const [sr, sc] = w.cells[0];
    const sk = key(sr, sc);
    if (!cell[sk].tick) cell[sk].tick = w.dir === 'h' ? 'e' : 's';
  }

  // History chips wear the same rank: match each played word to a board word
  // with the same string (uppercased: the engine stores lowercase, the board
  // reads uppercase). Invalid words never landed on the board, so they
  // stay unmatched — and a verdict needs no hue (R7).
  const pool = new Map([...byText.entries()].map(([text, list]) => [text, [...list]]));
  const entryCues = historyEntries.map((entry) => {
    const cues = [];
    for (const wordObj of entry.words || []) {
      const candidates = pool.get(String(wordObj.word || '').toUpperCase());
      const match = candidates && candidates.length ? candidates.shift() : null;
      if (match) cues.push({ rank: match.rank, pole: match.pole, latest: latest.has(match) });
    }
    return cues;
  });

  const sorted = (dir) =>
    words
      .filter((w) => w.dir === dir)
      .sort((a, b) => a.cells[0][0] - b.cells[0][0] || a.cells[0][1] - b.cells[0][1]);
  const h = sorted('h');
  const v = sorted('v');
  const territory = {
    aTop: h.length ? h[0].rank : 0,
    aBottom: h.length ? h[h.length - 1].rank : 1,
    bTop: v.length ? v[0].rank : 0,
    bBottom: v.length ? v[v.length - 1].rank : 1,
  };

  return { words, cell, entryCues, anchors: scanAnchors(board || []), territory };
}
