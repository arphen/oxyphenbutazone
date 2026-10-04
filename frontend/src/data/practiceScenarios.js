/**
 * Practice Scenarios Database
 *
 * Each scenario presents a specific board situation and rack for the player to find a strong move.
 * Categories help players practice specific skills like unusual letters, short words, etc.
 *
 * Every word used here is in the open ENABLE list, so the scenarios work with whichever list the player has
 * (the public build ships only ENABLE). src/data/practiceScenarios.test.js re-checks each scenario against the
 * game rules: the solutions fit the board and the rack, every word they form is a word, and the scores are right.
 */

export const practiceCategories = {
    'v-words': {
        name: '3-Letter V Words',
        description: 'Practice playing words with the challenging V tile',
        icon: '🎯'
    },
    'two-letter': {
        name: '2-Letter Words',
        description: 'Master the essential two-letter words for tight spaces',
        icon: '✌️'
    },
    'q-no-u': {
        name: 'Q Without U',
        description: 'Learn rare Q words that don\'t need a U',
        icon: '🔮'
    },
    'hooks': {
        name: 'Front & Back Hooks',
        description: 'Add letters to existing words to form new ones',
        icon: '🪝'
    },
    'parallel-play': {
        name: 'Parallel Plays',
        description: 'Score big by playing parallel to existing words',
        icon: '⚡'
    },
    'bingo': {
        name: 'Bingo Practice',
        description: 'Use all 7 tiles for a 50-point bonus',
        icon: '🎰'
    },
    'j-x-z': {
        name: 'High-Value Letters',
        description: 'Maximize points with J, X, and Z',
        icon: '💎'
    }
};

const SIZE = 15;

/** An empty 15x15 board (null = empty square) with the given words laid on it: [word, row, col, 'horizontal'|'vertical']. */
function boardWith(...words) {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (const [word, row, col, direction] of words) {
        [...word].forEach((letter, i) => {
            if (direction === 'horizontal') board[row][col + i] = letter;
            else board[row + i][col] = letter;
        });
    }
    return board;
}

/**
 * A solution that plays `word` from (row, col): the tiles to place are the squares of the word that are still empty
 * on `board` (the others are already there).
 */
function play(board, word, row, col, direction, score, explanation) {
    const tiles = [];
    [...word].forEach((letter, i) => {
        const r = direction === 'horizontal' ? row : row + i;
        const c = direction === 'horizontal' ? col + i : col;
        if (!board[r][c]) tiles.push({ letter, row: r, col: c });
    });
    return { word, position: { row, col, direction }, tiles, score, explanation };
}

/**
 * Practice scenarios
 *
 * Board representation:
 * - null: empty square
 * - string: letter on that square
 *
 * Board is 15x15, coordinates are [row][col]
 */
const vav = boardWith(['CAT', 7, 7, 'horizontal']);
const vex = boardWith(['RATE', 6, 6, 'horizontal']);
const squeeze = boardWith(['BEAT', 7, 5, 'horizontal']);
const jo = boardWith(['BOAT', 7, 5, 'horizontal']);
const qat = boardWith(['TOAD', 7, 5, 'horizontal']);
const sHook = boardWith(['BOOK', 7, 4, 'horizontal']);
const frontHook = boardWith(['ART', 7, 6, 'horizontal']);
const parallel = boardWith(['MATE', 7, 5, 'horizontal']);
const bingo = boardWith();
const joy = boardWith(['TOP', 6, 8, 'horizontal']);
const zit = boardWith(['PET', 6, 2, 'horizontal']);

export const practiceScenarios = [
    // V-WORDS CATEGORY
    {
        id: 'v-words-1',
        category: 'v-words',
        difficulty: 'easy',
        title: 'VAV: The Three-Letter V',
        description: 'Find a strong spot to play VAV (a Hebrew letter)',
        board: vav,
        rack: ['V', 'A', 'V', 'E', 'R', 'S', 'T'],
        solutions: [
            play(vav, 'VAV', 6, 8, 'vertical', 17,
                'VAV runs down through the A of CAT, with both Vs on double letter squares: 8 + 1 + 8 = 17 points.')
        ],
        hints: [
            'VAV is a valid three-letter word (Hebrew letter)',
            'VAV has an A in the middle, and CAT has one too',
            'Put the Vs on the double letter squares next to CAT'
        ]
    },
    {
        id: 'v-words-2',
        category: 'v-words',
        difficulty: 'medium',
        title: 'VEX: Triple Letter Score',
        description: 'Maximize your V with a premium square',
        board: vex,
        rack: ['V', 'E', 'X', 'I', 'N', 'G', 'S'],
        solutions: [
            play(vex, 'VEX', 5, 9, 'vertical', 21,
                'VEX goes down through the E of RATE with the V on the triple letter square: 12 + 1 + 8 = 21 points.')
        ],
        hints: [
            'VEX means to annoy or frustrate',
            'RATE ends in an E, and VEX has an E in the middle',
            'The V is worth 4 points: put it on a triple letter square'
        ]
    },

    // TWO-LETTER WORDS CATEGORY
    {
        id: 'two-letter-1',
        category: 'two-letter',
        difficulty: 'easy',
        title: 'Tight Spaces',
        description: 'Use short words to score in several directions at once',
        board: squeeze,
        rack: ['A', 'E', 'I', 'O', 'U', 'X', 'Y'],
        solutions: [
            play(squeeze, 'AX', 8, 5, 'horizontal', 38,
                'AX under BE makes three words at once: AX, BA and EX. The X sits on a double letter square and counts twice, in AX and in EX.')
        ],
        hints: [
            'Look for two letters you can play right under a word',
            'Every letter you put under BEAT also makes a two-letter word going down',
            'Two-letter words ending in X: AX, EX, OX'
        ]
    },
    {
        id: 'two-letter-2',
        category: 'two-letter',
        difficulty: 'medium',
        title: 'JO: The Short J Word',
        description: 'JO is one of the few two-letter words with a J',
        board: jo,
        rack: ['J', 'I', 'E', 'N', 'R', 'S', 'T'],
        solutions: [
            play(jo, 'JO', 6, 6, 'vertical', 17,
                'JO played down onto the O of BOAT, with the J on a double letter square: 16 + 1 = 17 points.')
        ],
        hints: [
            'JO is a valid word (a sweetheart, in Scots)',
            'You have no O in your rack: use the one on the board',
            'Put the J on a premium square'
        ]
    },

    // Q WITHOUT U CATEGORY
    {
        id: 'q-no-u-1',
        category: 'q-no-u',
        difficulty: 'hard',
        title: 'QAT: The Tea Leaf',
        description: 'Learn this essential Q without U word',
        board: qat,
        rack: ['Q', 'A', 'T', 'S', 'I', 'N', 'G'],
        solutions: [
            play(qat, 'QAT', 5, 5, 'vertical', 32,
                'QAT ends on the T of TOAD, with the Q on a triple letter square: 30 + 1 + 1 = 32 points.')
        ],
        hints: [
            'QAT is a plant whose leaves are chewed as a stimulant',
            'You do not need a U: use the T on the board',
            'Remember: Q + A + T = QAT, and the Q wants a triple letter square'
        ]
    },

    // HOOKS CATEGORY
    {
        id: 'hooks-1',
        category: 'hooks',
        difficulty: 'easy',
        title: 'S-Hook Master',
        description: 'Add an S to make a plural, and play a long word down from it',
        board: sHook,
        rack: ['S', 'H', 'I', 'N', 'E', 'D', 'R'],
        solutions: [
            play(sHook, 'SHINE', 7, 8, 'vertical', 23,
                'The S of SHINE hooks onto BOOK to make BOOKS: SHINE scores 12 and BOOKS 11, 23 points in all.')
        ],
        hints: [
            'Look for places where S can pluralize',
            'BOOK can become BOOKS',
            'Play a word that starts with S right after BOOK, going down'
        ]
    },
    {
        id: 'hooks-2',
        category: 'hooks',
        difficulty: 'medium',
        title: 'Front Hook Challenge',
        description: 'Add a letter to the front of a word',
        board: frontHook,
        rack: ['C', 'P', 'D', 'T', 'E', 'I', 'O'],
        solutions: [
            play(frontHook, 'CART', 7, 5, 'horizontal', 6, 'Adding C to the front of ART makes CART.'),
            play(frontHook, 'PART', 7, 5, 'horizontal', 6, 'Adding P to the front of ART makes PART.'),
            play(frontHook, 'DART', 7, 5, 'horizontal', 5, 'Adding D to the front of ART makes DART.'),
            play(frontHook, 'TART', 7, 5, 'horizontal', 4, 'Adding T to the front of ART makes TART.')
        ],
        hints: [
            'ART can have many letters added to the front',
            'Think: CART, PART, DART, TART...',
            'Multiple solutions exist!'
        ]
    },

    // PARALLEL PLAY CATEGORY
    {
        id: 'parallel-1',
        category: 'parallel-play',
        difficulty: 'medium',
        title: 'Parallel Power',
        description: 'Score multiple words at once by playing parallel',
        board: parallel,
        rack: ['D', 'O', 'G', 'S', 'L', 'E', 'D'],
        solutions: [
            play(parallel, 'EGOS', 8, 5, 'horizontal', 22,
                'EGOS played right under MATE makes four two-letter words at once: ME, AG, TO and ES, plus EGOS itself.')
        ],
        hints: [
            'Play a word directly below MATE',
            'Each letter pair going down must make a two-letter word',
            'You will score for the long word plus all the two-letter words!'
        ]
    },

    // BINGO CATEGORY
    {
        id: 'bingo-1',
        category: 'bingo',
        difficulty: 'hard',
        title: 'Seven-Letter Bonus',
        description: 'Use all 7 tiles for 50 extra points',
        board: bingo,
        rack: ['R', 'E', 'T', 'I', 'N', 'A', 'S'],
        // All seven-letter anagrams of the rack. Starting in column 3 puts the first tile on a double letter square.
        solutions: ['ANESTRI', 'ANTSIER', 'NASTIER', 'RATINES', 'RETAINS', 'RETINAS', 'RETSINA', 'STAINER', 'STEARIN'].map(word =>
            play(bingo, word, 7, 3, 'horizontal', 66,
                `${word} uses all 7 tiles, earning the 50-point bingo bonus! The first word doubles on the centre star.`)
        ),
        hints: [
            'These seven letters make several seven-letter words',
            'Use all 7 tiles to get a 50-point bonus!',
            'The first word must cover the centre star'
        ]
    },

    // HIGH-VALUE LETTERS CATEGORY
    {
        id: 'jxz-1',
        category: 'j-x-z',
        difficulty: 'medium',
        title: 'J on Triple Letter',
        description: 'Maximize your J tile value',
        board: joy,
        rack: ['J', 'Y', 'S', 'E', 'R', 'I', 'T'],
        solutions: [
            play(joy, 'JOY', 5, 9, 'vertical', 29,
                'JOY goes down through the O of TOP, with the J on the triple letter square: 24 + 1 + 4 = 29 points.')
        ],
        hints: [
            'J is worth 8 points',
            'Triple letter score makes it worth 24!',
            'Short words with J: JAB, JAM, JAR, JAW, JOY, JUG...'
        ]
    },
    {
        id: 'jxz-2',
        category: 'j-x-z',
        difficulty: 'hard',
        title: 'ZIT on a Double Word',
        description: 'Put your Z on a double word square',
        board: zit,
        rack: ['Z', 'A', 'X', 'I', 'N', 'G', 'E'],
        solutions: [
            play(zit, 'ZIT', 4, 4, 'vertical', 24,
                'ZIT ends on the T of PET, with the Z on a double word square: (10 + 1 + 1) x 2 = 24 points.')
        ],
        hints: [
            'ZIT is a valid word',
            'Your rack has no T: use the one on the board',
            'Position your Z on a premium square!'
        ]
    }
];

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(categoryId) {
    return practiceScenarios.filter(scenario => scenario.category === categoryId);
}

/**
 * Get a random scenario from a category
 */
export function getRandomScenario(categoryId = null) {
    const scenarios = categoryId
        ? getScenariosByCategory(categoryId)
        : practiceScenarios;

    if (scenarios.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * scenarios.length);
    return scenarios[randomIndex];
}

/**
 * Get scenario by ID
 */
export function getScenarioById(id) {
    return practiceScenarios.find(scenario => scenario.id === id);
}
