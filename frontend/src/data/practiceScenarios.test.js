import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { practiceCategories, practiceScenarios, getRandomScenario, getScenarioById, getScenariosByCategory } from './practiceScenarios.js';
import { evaluatePlay, findSolution, scenarioCells } from './practiceCheck.js';
import { COMMON_ANCHOR_WORDS, generatePracticeScenario } from './scenarioGenerator.js';
import { WORD_CATEGORIES } from './wordCategories.js';
import { createDictionaryStore } from '../shared/dictionary.js';

// The open list the public build ships: everything in Practice Mode has to work with just this
const enableText = fs.readFileSync(new URL('../../public/ENABLE.txt', import.meta.url), 'utf8');
const enable = createDictionaryStore();
enable.load('enable', enableText);
const enableWords = new Set(enable.words({ dictionary: 'enable' }).words);
const inEnable = (word) => enableWords.has(word.toLowerCase());

function solutionCells(scenario, solution) {
  const cells = scenarioCells(scenario);
  for (const { letter, row, col } of solution.tiles) cells[row][col] = { ...cells[row][col], letter, isNew: true };
  return cells;
}

describe('the ENABLE list used by these tests', () => {
  it('is the real list: it has common words and lacks the newer ones the open list never had', () => {
    expect(enable.size('enable')).toBeGreaterThan(150000);
    expect(inEnable('vav')).toBe(true);
    expect(inEnable('qi')).toBe(false);
    expect(inEnable('za')).toBe(false);
  });
});

describe('practice scenarios', () => {
  it('are the 11 hand-written ones, each in a listed category, and every category has some', () => {
    expect(practiceScenarios.map((s) => s.id)).toEqual([
      'v-words-1', 'v-words-2', 'two-letter-1', 'two-letter-2', 'q-no-u-1', 'hooks-1', 'hooks-2', 'parallel-1', 'bingo-1', 'jxz-1', 'jxz-2',
    ]);
    for (const scenario of practiceScenarios) expect(practiceCategories[scenario.category], scenario.id).toBeTruthy();
    for (const id of Object.keys(practiceCategories)) expect(getScenariosByCategory(id).length, id).toBeGreaterThan(0);
    expect(getRandomScenario('no-such-category')).toBeNull();
    expect(getScenarioById('hooks-2').category).toBe('hooks');
  });

  it('do not mention a specific word list or the removed generated scenarios', () => {
    expect(JSON.stringify(practiceScenarios) + JSON.stringify(practiceCategories)).not.toMatch(/csw|nwl|collins|tournament|generated/i);
  });

  for (const scenario of practiceScenarios) {
    describe(scenario.id, () => {
      it('has a 15x15 board of capital letters, a 7 tile rack, three hints and a solution', () => {
        expect(scenario.board).toHaveLength(15);
        for (const row of scenario.board) {
          expect(row).toHaveLength(15);
          for (const cell of row) expect(cell === null || /^[A-Z]$/.test(cell)).toBe(true);
        }
        expect(scenario.rack).toHaveLength(7);
        for (const letter of scenario.rack) expect(letter).toMatch(/^[A-Z]$/);
        expect(scenario.hints).toHaveLength(3);
        expect(scenario.solutions.length).toBeGreaterThan(0);
        expect(scenario.title && scenario.description).toBeTruthy();
      });

      it('only uses words that are in the open ENABLE list (so it works with any list, ENABLE included)', () => {
        const board = scenario.board;
        for (const solution of scenario.solutions) {
          const play = evaluatePlay(solutionCells(scenario, solution));
          expect(play.ok, `${solution.word}: ${play.message}`).toBe(true);
          for (const { word } of play.words) expect(enableWords.has(word.toLowerCase()), `${scenario.id}: ${word}`).toBe(true);
        }
        // the words already on the board are real words too
        const rows = board.map((row) => row.map((c) => c || ' ').join('').split(/\s+/)).flat().filter((w) => w.length > 1);
        for (const word of rows) expect(enableWords.has(word.toLowerCase()), word).toBe(true);
      });

      it('has solutions that fit: empty squares, tiles from the rack, a legal play that spells the word and scores what it says', () => {
        for (const solution of scenario.solutions) {
          const left = [...scenario.rack];
          for (const { letter, row, col } of solution.tiles) {
            expect(scenario.board[row][col], `${solution.word} lands on a tile`).toBeNull();
            const at = left.indexOf(letter);
            expect(at, `${solution.word} needs a ${letter} the rack does not have`).toBeGreaterThanOrEqual(0);
            left.splice(at, 1);
          }
          const play = evaluatePlay(solutionCells(scenario, solution));
          expect(play.ok).toBe(true);
          expect(play.words.map((w) => w.word)).toContain(solution.word);
          expect(play.score, `${solution.word} score`).toBe(solution.score);
          expect(findSolution(scenario, play.words)?.word).toBe(solution.word);
          expect(solution.explanation).toBeTruthy();
        }
      });
    });
  }

  it('hooks-2 lists every letter of the rack that hooks onto the front of ART', () => {
    const scenario = getScenarioById('hooks-2');
    const hooks = scenario.rack.filter((letter) => inEnable(letter + 'art'));
    expect(hooks.sort()).toEqual(scenario.solutions.map((s) => s.word[0]).sort()); // C, D, P, T
    for (const letter of scenario.rack) expect(inEnable('art' + letter)).toBe(false); // and nothing hooks onto the back
  });

  it('bingo-1 lists every seven-letter word that the rack spells', () => {
    const scenario = getScenarioById('bingo-1');
    const key = (word) => [...word.toLowerCase()].sort().join('');
    const rackKey = key(scenario.rack.join(''));
    const anagrams = [...enableWords].filter((w) => w.length === 7 && key(w) === rackKey).map((w) => w.toUpperCase());
    expect(scenario.solutions.map((s) => s.word).sort()).toEqual(anagrams.sort());
    expect(anagrams).toHaveLength(9); // ANESTRI ANTSIER NASTIER RATINES RETAINS RETINAS RETSINA STAINER STEARIN
  });
});

describe('flashcard categories with only ENABLE installed', () => {
  const words = (category) => enable.words({ dictionary: 'enable', ...WORD_CATEGORIES[category].apiQuery }).words.sort();

  it('every category has words', () => {
    for (const id of Object.keys(WORD_CATEGORIES)) expect(words(id).length, id).toBeGreaterThan(0);
  });

  it('are the right words (hand-checked against the lists)', () => {
    expect(words('three-letter-q')).toEqual(['qat', 'qua', 'suq']);
    expect(words('q-without-u')).toEqual([
      'faqir', 'faqirs', 'qaid', 'qaids', 'qanat', 'qanats', 'qat', 'qats', 'qindar', 'qindarka', 'qindars', 'qintar', 'qintars',
      'qoph', 'qophs', 'qwerty', 'qwertys', 'sheqalim', 'sheqel', 'tranq', 'tranqs',
    ]);
    expect(words('three-letter-v')).toEqual(expect.arrayContaining(['vav', 'vex', 'vow', 'vug']));
    expect(words('three-letter-j')).toEqual(expect.arrayContaining(['jab', 'joy', 'jug']));
    expect(words('three-letter-x')).toEqual(expect.arrayContaining(['axe', 'box', 'zax']));
    expect(words('three-letter-z')).toEqual(expect.arrayContaining(['zip', 'zoo', 'zax']));
    expect(words('two-letter-all')).toEqual(expect.arrayContaining(['ax', 'ox', 'xi', 'xu', 'jo']));
    expect(words('two-letter-all').every((w) => w.length === 2)).toBe(true);
    expect(words('four-letter-high-value')).toEqual(expect.arrayContaining(['jazz', 'quiz', 'zinc', 'jinx']));
    // only what ENABLE itself knows: the newer words are not there
    expect(words('two-letter-all')).not.toContain('qi');
    expect(words('three-letter-z')).not.toContain('zen');
  });
});

describe('generated flashcard scenarios', () => {
  it('only use anchor words that are in the open ENABLE list', () => {
    const missing = COMMON_ANCHOR_WORDS.filter((word) => !enableWords.has(word.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('give the player every tile the word needs, whatever the category', () => {
    const letters = (word) => [...word].sort().join('');
    for (const id of Object.keys(WORD_CATEGORIES)) {
      for (const word of words(id).slice(0, 12)) {
        const upper = word.toUpperCase();
        for (const type of ['first-word', 'hook', 'extension']) {
          const scenario = generatePracticeScenario(upper, type, []);
          const rack = [...scenario.rack];
          // the tiles to place are the word's letters minus the one it shares with the anchor word (hooks)
          const need = [...upper];
          if (scenario.anchorWord) {
            const { row, col } = scenario.solution;
            const shared = need.findIndex((letter, i) => scenario.board[row][col + i]?.letter === letter && scenario.board[row][col + i]?.locked);
            expect(shared, `${upper} crosses ${scenario.anchorWord}`).toBeGreaterThanOrEqual(0);
            need.splice(shared, 1);
          }
          for (const letter of need) {
            const at = rack.indexOf(letter);
            expect(at, `${upper} (${type}) needs ${letter}`).toBeGreaterThanOrEqual(0);
            rack.splice(at, 1);
          }
          expect(letters(scenario.targetWord)).toBe(letters(upper));
        }
      }
    }
  });

  function words(id) {
    return enable.words({ dictionary: 'enable', ...WORD_CATEGORIES[id].apiQuery }).words;
  }
});
