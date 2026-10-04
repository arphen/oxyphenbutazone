// Generate practice scenarios where a specific word is the optimal play
// ARCHITECTURE: Start with target word placement, then build valid scenario around it

// Helper: Create empty 15x15 board
function createEmptyBoard() {
    return Array(15).fill(null).map(() =>
        Array(15).fill(null).map(() => ({ letter: null, isBlank: false }))
    );
}

// Helper: Place word on board
function placeWordOnBoard(board, word, row, col, horizontal) {
    const letters = word.split('');
    letters.forEach((letter, i) => {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        if (r >= 0 && r < 15 && c >= 0 && c < 15) {
            board[r][c] = { letter: letter.toUpperCase(), isBlank: false, locked: true };
        }
    });
}

// Helper: Check if cell is in bounds
function inBounds(row, col) {
    return row >= 0 && row < 15 && col >= 0 && col < 15;
}

// Helper: Get cell content
function getCell(board, row, col) {
    if (!inBounds(row, col)) return null;
    return board[row][col];
}

// Helper: Check if a word can be formed from available letters
function canFormWord(word, availableLetters) {
    const letterCount = {};
    for (const letter of availableLetters) {
        letterCount[letter] = (letterCount[letter] || 0) + 1;
    }

    for (const letter of word.toUpperCase()) {
        if (!letterCount[letter] || letterCount[letter] === 0) {
            return false;
        }
        letterCount[letter]--;
    }
    return true;
}

// Helper: Build rack with specific letters plus random fillers
// Intelligently avoids creating other valid words from the same category
function buildRack(requiredLetters, fillerCount = 7, avoidWords = []) {
    const commonLetters = 'EARIOTNSLCUDPMHGBFYWKVXZJQ';
    const rack = [...requiredLetters.toUpperCase().split('')];

    if (avoidWords.length === 0) {
        // No words to avoid, just add common letters
        while (rack.length < fillerCount) {
            rack.push(commonLetters[Math.floor(Math.random() * commonLetters.length)]);
        }
    } else {
        // Try to find filler letters that DON'T create other words
        const maxAttempts = 100;
        let attempts = 0;

        while (rack.length < fillerCount && attempts < maxAttempts) {
            attempts++;

            // Try a random common letter
            const candidate = commonLetters[Math.floor(Math.random() * commonLetters.length)];
            const testRack = [...rack, candidate];

            // Check if adding this letter would allow forming any avoid words
            let wouldCreateWord = false;
            for (const word of avoidWords) {
                if (word.length === requiredLetters.length && canFormWord(word, testRack)) {
                    wouldCreateWord = true;
                    break;
                }
            }

            if (!wouldCreateWord) {
                rack.push(candidate);
                attempts = 0; // Reset attempts on success
            }
        }

        // If we couldn't find enough safe letters, pad with rare letters
        const rareLetters = 'JQXZK';
        while (rack.length < fillerCount) {
            rack.push(rareLetters[rack.length % rareLetters.length]);
        }
    }

    // Shuffle
    for (let i = rack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rack[i], rack[j]] = [rack[j], rack[i]];
    }

    return rack;
}

/**
 * CURATED ANCHOR WORDS - Common words for building scenarios; all of them are in the open ENABLE list (checked by a test)
 */
export const COMMON_ANCHOR_WORDS = [
    // 3-letter words
    'CAT', 'DOG', 'BAT', 'RAT', 'HAT', 'SAT', 'MAT', 'FAT', 'PAT', 'VAT',
    'ACE', 'AGE', 'ATE', 'ARE', 'AXE', 'APE',
    'BIG', 'BIT', 'BAD', 'BED', 'BUS', 'BOX',
    'CAR', 'CAN', 'CUT', 'COW', 'CUP',
    'DAY', 'DEN', 'DIG', 'DIM', 'DIN',
    'EAT', 'END', 'EGG', 'ELF', 'EAR',
    'FIT', 'FAN', 'FIG', 'FIN', 'FUR',
    'GOT', 'GUN', 'GUT', 'GYM',
    'HIT', 'HOT', 'HUG', 'HUM',
    'ICE', 'INK', 'INN',
    'JAM', 'JAR', 'JET', 'JOB', 'JOG', 'JOY',
    'KIT', 'KEY',
    'LAP', 'LAY', 'LEG', 'LET', 'LID', 'LIP', 'LOG', 'LOT',
    'MAN', 'MAP', 'MIX', 'MUD',
    'NET', 'NUT', 'NAP',
    'OAK', 'OAT', 'ODD', 'OIL', 'OLD', 'OWL',
    'PAN', 'PEN', 'PET', 'PIG', 'PIN', 'PIT', 'POT', 'PUB',
    'RAN', 'RED', 'RIG', 'ROD', 'ROT', 'RUG', 'RUN', 'RUT',
    'SAD', 'SAW', 'SET', 'SIT', 'SIX', 'SKY', 'SUN',
    'TAN', 'TAP', 'TAX', 'TEA', 'TEN', 'TIE', 'TIN', 'TIP', 'TOP', 'TOY', 'TUG',
    'VAN', 'VET', 'VIA',
    'WAR', 'WAX', 'WET', 'WIG', 'WIN', 'WIT',
    'YET', 'YES',
    'ZOO',

    // 4-letter words
    'GAME', 'GAIN', 'GATE', 'GAVE', 'GEAR',
    'HAVE', 'HELP', 'HERO', 'HIDE', 'HIGH', 'HOPE', 'HOST',
    'JUMP', 'JUST',
    'KEEP', 'KING', 'KITE',
    'LAKE', 'LAMP', 'LAND', 'LAST', 'LATE', 'LEAD', 'LEAP', 'LEFT', 'LIFE', 'LIFT', 'LIKE', 'LINE', 'LINK', 'LIVE', 'LONG', 'LOOK', 'LOST', 'LOVE',
    'MADE', 'MAKE', 'MALE', 'MANY', 'MARK', 'MATE', 'MEAN', 'MEET', 'MILE', 'MIND', 'MINE', 'MISS', 'MODE', 'MOON', 'MORE', 'MOST', 'MOVE',
    'NAME', 'NEAR', 'NECK', 'NEED', 'NEWS', 'NEXT', 'NICE', 'NINE',
    'OPEN', 'OVER',
    'PACE', 'PAGE', 'PAIN', 'PAIR', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PEAK', 'PICK', 'PILE', 'PINK', 'PLAN', 'PLAY', 'PLOT', 'PLUG', 'PLUS', 'POLE', 'POOL', 'POOR', 'PORT', 'POST', 'PULL', 'PURE', 'PUSH',
    'RACE', 'RAIN', 'RANK', 'RARE', 'RATE', 'READ', 'REAL', 'RELY', 'REST', 'RICE', 'RICH', 'RIDE', 'RING', 'RISE', 'RISK', 'ROAD', 'ROCK', 'ROLE', 'ROLL', 'ROOF', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'RULE', 'RUSH',
    'SAFE', 'SAID', 'SAIL', 'SALE', 'SALT', 'SAME', 'SAND', 'SAVE', 'SEAL', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SELF', 'SELL', 'SEND', 'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SIDE', 'SIGN', 'SING', 'SINK', 'SITE', 'SIZE', 'SKIN', 'SLIP', 'SLOW', 'SNOW', 'SOFT', 'SOIL', 'SOLD', 'SOLE', 'SOME', 'SONG', 'SOON', 'SORT', 'SOUL', 'SPOT', 'STAR', 'STAY', 'STEP', 'STOP', 'SUCH', 'SUIT', 'SURE',
    'TAKE', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE', 'TASK', 'TEAM', 'TEAR', 'TELL', 'TEND', 'TERM', 'TEST', 'TEXT', 'THAN', 'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'THUS', 'TIDE', 'TILL', 'TIME', 'TINY', 'TOLD', 'TONE', 'TOOK', 'TOOL', 'TOPS', 'TORN', 'TOUR', 'TOWN', 'TREE', 'TRIP', 'TRUE', 'TUNE', 'TURN', 'TWIN', 'TYPE',
    'UNIT', 'UPON', 'USED', 'USER',
    'VARY', 'VAST', 'VIEW', 'VOTE',
    'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WANT', 'WARD', 'WARM', 'WARN', 'WASH', 'WAVE', 'WAYS', 'WEAK', 'WEAR', 'WEEK', 'WELL', 'WENT', 'WERE', 'WEST', 'WHAT', 'WHEN', 'WIDE', 'WIFE', 'WILD', 'WILL', 'WIND', 'WINE', 'WING', 'WIRE', 'WISE', 'WISH', 'WITH', 'WOOD', 'WORD', 'WORE', 'WORK', 'WORN',
    'YARD', 'YEAR', 'YOUR',
    'ZERO', 'ZONE'
];

/**
 * Find anchor words that share letters with target word for hooks
 */
function findHookableWords(targetWord) {
    const target = targetWord.toUpperCase();
    const targetLetters = new Set(target.split(''));

    return COMMON_ANCHOR_WORDS.filter(anchor => {
        // Check if anchor shares at least one letter with target
        const anchorLetters = new Set(anchor.split(''));
        for (const letter of targetLetters) {
            if (anchorLetters.has(letter)) return true;
        }
        return false;
    });
}

/**
 * SCENARIO BUILDERS - Each guarantees a valid, solvable puzzle
 */

// SCENARIO 1: First word - play through center
function buildFirstWordScenario(targetWord, avoidWords = []) {
    const board = createEmptyBoard();
    const word = targetWord.toUpperCase();

    // Calculate center position
    const centerRow = 7;
    const centerCol = Math.floor((15 - word.length) / 2);

    // Rack needs all letters of target word
    const rack = buildRack(word, 7, avoidWords);

    return {
        board,
        rack,
        targetWord: word,
        hint: `Play "${word}" through the center star`,
        solution: {
            row: centerRow,
            col: centerCol,
            horizontal: true,
            word: word
        },
        description: 'Opening play',
        difficulty: 'beginner'
    };
}

// SCENARIO 2: Hook - play word perpendicular to anchor, sharing one letter
function buildHookScenario(targetWord, avoidWords = []) {
    const board = createEmptyBoard();
    const word = targetWord.toUpperCase();

    // Find anchor words that share a letter with target
    const hookableWords = findHookableWords(word);

    if (hookableWords.length === 0) {
        return buildFirstWordScenario(targetWord, avoidWords);
    }

    // Pick a random anchor word
    const anchorWord = hookableWords[Math.floor(Math.random() * hookableWords.length)];

    // Find shared letter
    let sharedLetter = null;
    let targetIndex = -1;
    let anchorIndex = -1;

    for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const foundIndex = anchorWord.indexOf(letter);
        if (foundIndex !== -1) {
            sharedLetter = letter;
            targetIndex = i;
            anchorIndex = foundIndex;
            break;
        }
    }

    if (!sharedLetter) {
        return buildFirstWordScenario(targetWord, avoidWords);
    }

    // Place anchor word vertically
    const anchorRow = 5;
    const anchorCol = 7;
    placeWordOnBoard(board, anchorWord, anchorRow, anchorCol, false); // vertical

    // Target word plays horizontally, sharing the letter at anchorRow + anchorIndex
    const targetRow = anchorRow + anchorIndex;
    const targetCol = anchorCol - targetIndex;

    // Player needs all letters except the shared one
    const requiredLetters = word.split('').filter((_, i) => i !== targetIndex).join('');
    const rack = buildRack(requiredLetters, 7, avoidWords);

    return {
        board,
        rack,
        targetWord: word,
        hint: `Hook "${word}" onto "${anchorWord}"`,
        solution: {
            row: targetRow,
            col: targetCol,
            horizontal: true,
            word: word
        },
        description: `Hook from "${anchorWord}"`,
        difficulty: 'intermediate',
        anchorWord: anchorWord
    };
}

// SCENARIO 3: Extension - add letters to beginning/end of existing word
function buildExtensionScenario(targetWord, avoidWords = []) {
    const board = createEmptyBoard();
    const word = targetWord.toUpperCase();

    if (word.length < 4) {
        // Too short for extension, use hook instead
        return buildHookScenario(targetWord, avoidWords);
    }

    // Find a valid anchor word that's a substring of the target
    // Try finding valid words from the end of target (for prefix extension)
    // or from the beginning (for suffix extension)

    // Strategy: Place a complete valid word that is part of the target word
    // For now, simplify by using hook scenario which guarantees valid words
    // Extension scenarios are complex because partial words must be valid

    // Fall back to hook scenario which is safer
    return buildHookScenario(targetWord, avoidWords);
}

/**
 * Main scenario generator - picks appropriate scenario type
 * @param {string} targetWord - The word to practice
 * @param {string} scenarioType - Type of scenario ('first-word', 'hook', 'extension', 'random')
 * @param {Array<string>} avoidWords - Words to avoid making possible with decoy tiles
 */
export function generatePracticeScenario(targetWord, scenarioType = 'random', avoidWords = []) {
    const word = targetWord.toUpperCase();

    const builders = {
        'first-word': buildFirstWordScenario,
        'hook': buildHookScenario,
        'extension': buildExtensionScenario
    };

    // If random, pick one intelligently based on word length
    if (scenarioType === 'random' || !builders[scenarioType]) {
        const types = ['first-word', 'hook', 'extension'];
        scenarioType = types[Math.floor(Math.random() * types.length)];
    }

    const builder = builders[scenarioType];
    const scenario = builder(word, avoidWords);

    // Add metadata
    scenario.createdAt = new Date().toISOString();
    scenario.scenarioType = scenarioType;

    return scenario;
}

/**
 * Generate multiple varied scenarios for practice
 */
export function generateMultipleScenarios(targetWord, count = 3, avoidWords = []) {
    const types = ['first-word', 'hook', 'extension'];
    const scenarios = [];

    for (let i = 0; i < count && i < types.length; i++) {
        scenarios.push(generatePracticeScenario(targetWord, types[i], avoidWords));
    }

    return scenarios;
}

/**
 * Validate if the played word matches the target
 */
export function validatePracticeWord(playedWord, targetWord) {
    return playedWord.toUpperCase() === targetWord.toUpperCase();
}
