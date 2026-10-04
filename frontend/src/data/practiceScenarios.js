/**
 * Practice Scenarios Database
 * 
 * Each scenario presents a specific board situation and rack for the player to find the optimal move.
 * Categories help players practice specific skills like unusual letters, short words, etc.
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
    },
    'extensions': {
        name: '3-Letter Extensions',
        description: 'Extend 2-letter words into 3-letter words',
        icon: '🌱'
    }
};

/**
 * Practice scenarios
 * 
 * Board representation:
 * - null: empty square
 * - string: letter on that square
 * 
 * Board is 15x15, coordinates are [row][col]
 */
export const practiceScenarios = [
    // V-WORDS CATEGORY
    {
        id: 'v-words-1',
        category: 'v-words',
        difficulty: 'easy',
        title: 'VAV: The Three-Letter V',
        description: 'Find the best spot to play VAV (a Hebrew letter)',
        board: [
            // Row 0
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, 'C', 'A', 'T', null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['V', 'A', 'V', 'E', 'R', 'S', 'T'],
        solutions: [
            {
                word: 'VAV',
                position: { row: 6, col: 6, direction: 'vertical' }, // Places V-A-V vertically ending at row 8, col 6
                tiles: [{ letter: 'V', row: 6, col: 6 }, { letter: 'A', row: 7, col: 6 }, { letter: 'V', row: 8, col: 6 }],
                score: 18, // V(4) + A(1) + V(4) = 9, doubled by DW at [6,6]
                explanation: 'VAV played vertically to the left of CAT, forming VAC. Uses the DW square.'
            }
        ],
        hints: [
            'VAV is a valid three-letter word (Hebrew letter)',
            'Look for premium squares near the existing word',
            'Can you form another word with the C in CAT?'
        ]
    },
    {
        id: 'v-words-2',
        category: 'v-words',
        difficulty: 'medium',
        title: 'VEX: Triple Letter Score',
        description: 'Maximize your V with a premium square',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, 'R', 'A', 'T', 'E', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['V', 'E', 'X', 'I', 'N', 'G', 'S'],
        solutions: [
            {
                word: 'VEX',
                position: { row: 5, col: 4, direction: 'vertical' },
                tiles: [{ letter: 'V', row: 4, col: 4 }, { letter: 'E', row: 5, col: 4 }, { letter: 'X', row: 6, col: 4 }],
                score: 30, // V(4) + E(1) + X(8) = 13, TL on V at [1,5] makes it 4+8=12 extra, total depends on exact calculation
                explanation: 'VEX uses the triple letter score and creates VE from RATE'
            }
        ],
        hints: [
            'VEX means to annoy or frustrate',
            'Position your V on a premium square',
            'The X is worth 8 points!'
        ]
    },

    // TWO-LETTER WORDS CATEGORY
    {
        id: 'two-letter-1',
        category: 'two-letter',
        difficulty: 'easy',
        title: 'Tight Spaces',
        description: 'Use short words to squeeze into small gaps',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, 'F', null, 'B', null, 'M', null, null, null, null, null],
            [null, null, null, null, null, 'L', null, 'R', null, 'A', null, null, null, null, null],
            [null, null, null, null, null, 'O', null, 'A', null, 'T', null, null, null, null, null],
            [null, null, null, null, null, 'W', null, 'T', null, 'S', null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['A', 'E', 'I', 'O', 'U', 'X', 'Y'],
        solutions: [
            {
                word: 'AX',
                position: { row: 6, col: 6, direction: 'horizontal' },
                tiles: [{ letter: 'A', row: 6, col: 6 }, { letter: 'X', row: 6, col: 8 }],
                score: 20, // Forms AX + multiple 2-letter words (OA, AB, EX, etc)
                explanation: 'Playing AX horizontally between columns creates multiple 2-letter words vertically'
            }
        ],
        hints: [
            'Look between the existing words',
            'Two-letter words: AX, OX, EX are all valid',
            'Each vertical pair will score points'
        ]
    },
    {
        id: 'two-letter-2',
        category: 'two-letter',
        difficulty: 'medium',
        title: 'QI is Valid!',
        description: 'The most important Q without U word',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, 'S', 'O', 'A', 'K', null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['Q', 'I', 'V', 'I', 'N', 'G', 'S'],
        solutions: [
            {
                word: 'QI',
                position: { row: 5, col: 6, direction: 'vertical' },
                tiles: [{ letter: 'Q', row: 5, col: 6 }, { letter: 'I', row: 6, col: 6 }],
                score: 22, // Q(10) + I(1) = 11, forming QI and extends to IS
                explanation: 'QI played vertically before SOAK, also making the S into SI'
            }
        ],
        hints: [
            'QI is a valid word (Chinese concept of life force)',
            'You don\'t need a U with Q!',
            'Two-letter Q words: QI, QAT, QOPH (3 letters)'
        ]
    },

    // Q WITHOUT U CATEGORY
    {
        id: 'q-no-u-1',
        category: 'q-no-u',
        difficulty: 'hard',
        title: 'QAT: The Tea Leaf',
        description: 'Learn this essential Q without U word',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, 'T', 'O', 'A', 'D', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['Q', 'A', 'T', 'S', 'I', 'N', 'G'],
        solutions: [
            {
                word: 'QATS',
                position: { row: 7, col: 4, direction: 'horizontal' },
                tiles: [
                    { letter: 'Q', row: 7, col: 4 },
                    { letter: 'A', row: 7, col: 5 },
                    { letter: 'T', row: 7, col: 6 },
                    { letter: 'S', row: 7, col: 7 }
                ],
                score: 26, // Q(10) + A(1) + T(1) + S(1) = 13, plus points for making QAT into QATS
                explanation: 'QATS hooks onto TOAD, forming the word with T shared'
            }
        ],
        hints: [
            'QAT (or QATS) is a plant whose leaves are chewed as a stimulant',
            'Can you extend an existing word?',
            'Remember: Q + A + T = QAT'
        ]
    },

    // HOOKS CATEGORY
    {
        id: 'hooks-1',
        category: 'hooks',
        difficulty: 'easy',
        title: 'S-Hook Master',
        description: 'Add an S to make a plural',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, 'B', 'O', 'O', 'K', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, 'H', 'A', 'T', null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['S', 'H', 'I', 'N', 'E', 'D', 'R'],
        solutions: [
            {
                word: 'SHINE',
                position: { row: 6, col: 8, direction: 'vertical' },
                tiles: [
                    { letter: 'S', row: 6, col: 8 },
                    { letter: 'H', row: 7, col: 8 },
                    { letter: 'I', row: 8, col: 8 },
                    { letter: 'N', row: 9, col: 8 },
                    { letter: 'E', row: 10, col: 8 }
                ],
                score: 24, // S(1) + H(4) + I(1) + N(1) + E(1) = 8, plus points for BOOKS and HAT -> HATS
                explanation: 'SHINE hooks the S onto BOOK (making BOOKS) and the I makes HAT into HATI (if valid) or forms new words'
            }
        ],
        hints: [
            'Look for places where S can pluralize',
            'BOOK can become BOOKS',
            'Can you form a vertical word that uses existing letters?'
        ]
    },
    {
        id: 'hooks-2',
        category: 'hooks',
        difficulty: 'medium',
        title: 'Front Hook Challenge',
        description: 'Add a letter to the front of a word',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, 'A', 'R', 'T', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['C', 'P', 'D', 'W', 'T', 'F', 'E'],
        solutions: [
            {
                word: 'CART',
                position: { row: 7, col: 5, direction: 'horizontal' },
                tiles: [{ letter: 'C', row: 7, col: 5 }],
                score: 6, // C(3) + ART already on board
                explanation: 'Adding C to the front of ART makes CART'
            },
            {
                word: 'PART',
                position: { row: 7, col: 5, direction: 'horizontal' },
                tiles: [{ letter: 'P', row: 7, col: 5 }],
                score: 6, // P(3) + ART
                explanation: 'Adding P to the front of ART makes PART'
            },
            {
                word: 'DART',
                position: { row: 7, col: 5, direction: 'horizontal' },
                tiles: [{ letter: 'D', row: 7, col: 5 }],
                score: 5, // D(2) + ART
                explanation: 'Adding D to the front of ART makes DART'
            }
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
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, 'C', 'A', 'T', 'S', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['D', 'O', 'G', 'S', 'L', 'E', 'D'],
        solutions: [
            {
                word: 'DOGS',
                position: { row: 7, col: 5, direction: 'horizontal' },
                tiles: [
                    { letter: 'D', row: 7, col: 5 },
                    { letter: 'O', row: 7, col: 6 },
                    { letter: 'G', row: 7, col: 7 },
                    { letter: 'S', row: 7, col: 8 }
                ],
                score: 18, // DOGS (6 points) + CD + AO + TG + SS
                explanation: 'DOGS played parallel below CATS creates 5 words: CD, AO, TG, SS, plus DOGS itself'
            }
        ],
        hints: [
            'Play a word directly below CATS',
            'Each letter pair vertically makes a two-letter word',
            'You\'ll score for DOGS plus all the 2-letter words!'
        ]
    },

    // BINGO CATEGORY
    {
        id: 'bingo-1',
        category: 'bingo',
        difficulty: 'hard',
        title: 'Seven-Letter Bonus',
        description: 'Use all 7 tiles for 50 extra points',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, 'S', null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['R', 'E', 'T', 'I', 'N', 'A', 'S'],
        solutions: [
            {
                word: 'RETINAS',
                position: { row: 7, col: 7, direction: 'horizontal' },
                tiles: [
                    { letter: 'R', row: 7, col: 6 },
                    { letter: 'E', row: 7, col: 7 },
                    { letter: 'T', row: 7, col: 8 },
                    { letter: 'I', row: 7, col: 9 },
                    { letter: 'N', row: 7, col: 10 },
                    { letter: 'A', row: 7, col: 11 },
                    { letter: 'S', row: 7, col: 12 }
                ],
                score: 57, // 7 points for letters + 50 bonus
                explanation: 'RETINAS uses all 7 tiles, earning the 50-point bingo bonus! Forms RETINAS through the S.'
            }
        ],
        hints: [
            'You have the letters for RETINAS',
            'Use all 7 tiles to get a 50-point bonus!',
            'Play through the existing S on the board'
        ]
    },

    // HIGH-VALUE LETTERS CATEGORY
    {
        id: 'jxz-1',
        category: 'j-x-z',
        difficulty: 'medium',
        title: 'J on Triple Letter',
        description: 'Maximize your J tile value',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, 'O', 'P', 'T', null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['J', 'O', 'Y', 'S', 'E', 'R', 'I'],
        solutions: [
            {
                word: 'JOY',
                position: { row: 5, col: 8, direction: 'vertical' },
                tiles: [
                    { letter: 'J', row: 5, col: 8 },
                    { letter: 'O', row: 6, col: 8 },
                    { letter: 'Y', row: 7, col: 8 }
                ],
                score: 35, // J(8)*3 on TL = 24, + O(1) + Y(4) = 29, plus JO forms with existing O
                explanation: 'JOY with J on the triple letter score at [5,9] maximizes the J value'
            }
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
        title: 'ZA on Double Word',
        description: 'ZA is a valid 2-letter word!',
        board: [
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, 'P', 'E', 'T', null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        ],
        rack: ['Z', 'A', 'X', 'I', 'N', 'G', 'E'],
        solutions: [
            {
                word: 'ZA',
                position: { row: 5, col: 7, direction: 'vertical' },
                tiles: [
                    { letter: 'Z', row: 5, col: 7 },
                    { letter: 'A', row: 6, col: 7 }
                ],
                score: 22, // Z(10) + A(1) = 11, doubled on DW = 22, plus forms ZE vertically with E
                explanation: 'ZA (slang for pizza) played vertically hits the double word score'
            }
        ],
        hints: [
            'ZA is a valid word (slang for pizza)',
            'It\'s one of the most useful 2-letter words',
            'Position it on a premium square!'
        ]
    }
];

// Add generated scenarios

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
