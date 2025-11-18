import fs from 'fs';
import path from 'path';

// Single source of truth - all game state lives here
let gameState = null;

// Dictionaries loaded once at startup
let csw21Dictionary = new Map(); // word -> definition
let nwl2023Dictionary = new Map(); // word -> definition
let slovenianDictionary = new Map(); // word -> definition
let activeDictionary = new Set(); // combined active words

// Initialize game state
function createInitialGameState(playerCount = 4, language = 'english') {
    // Update current language
    currentLanguage = language;

    const state = {
        board: createInitialBoard(),
        tileBag: initializeTileBag(language),
        viewportCenter: { row: 7, col: 7 },
        currentPlayer: 1,
        playerCount: playerCount,
        language: language,
        consecutivePasses: 0,
        gameOver: false,
        winner: null,
        finalScores: null,
        message: '',
        messageType: '',
        gameId: generateGameId()
    };

    // Create players dynamically based on playerCount
    for (let i = 1; i <= playerCount; i++) {
        state[`player${i}`] = {
            playerName: `Player ${i}`,
            rack: [],
            score: 0,
            history: [],
            isCurrentPlayer: i === 1
        };
    }

    return state;
}

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createInitialBoard() {
    const board = Array(15).fill(null).map(() =>
        Array(15).fill(null).map(() => ({
            letter: '',
            type: '',
            isNew: false,
            locked: false,
            isBlank: false,
            chosenLetter: ''
        }))
    );

    const specialSquares = {
        tw: [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]],
        dw: [[1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10], [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10]],
        tl: [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]],
        dl: [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]],
        center: [[7, 7]]
    };

    Object.entries(specialSquares).forEach(([type, positions]) => {
        positions.forEach(([row, col]) => {
            board[row][col].type = type;
        });
    });

    return board;
}

// Tile distributions for different languages
const TILE_DISTRIBUTIONS = {
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
            { letter: 'q', count: 1 }, { letter: 'z', count: 1 }, { letter: '', count: 2 }
        ],
        values: {
            'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1, 'l': 1, 'n': 1, 's': 1, 't': 1, 'r': 1,
            'd': 2, 'g': 2, 'b': 3, 'c': 3, 'm': 3, 'p': 3,
            'f': 4, 'h': 4, 'v': 4, 'w': 4, 'y': 4, 'k': 5,
            'j': 8, 'x': 8, 'q': 10, 'z': 10, '': 0
        }
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
            { letter: 'ž', count: 1 }, { letter: '', count: 2 }
        ],
        values: {
            'e': 1, 'a': 1, 'i': 1, 'o': 1, 'n': 1, 'r': 1, 's': 1, 'j': 1, 'l': 1, 't': 1,
            'd': 2, 'v': 2, 'k': 3, 'm': 3, 'p': 3, 'u': 3,
            'b': 4, 'g': 4, 'z': 4, 'č': 5, 'h': 5, 'š': 6, 'c': 8, 'f': 10, 'ž': 10, '': 0
        }
    }
};

// Current language for tile distribution
let currentLanguage = 'english';

function initializeTileBag(language = currentLanguage) {
    const distribution = TILE_DISTRIBUTIONS[language] || TILE_DISTRIBUTIONS.english;
    const letterDistribution = distribution.tiles;

    const bag = [];
    letterDistribution.forEach(({ letter, count }) => {
        for (let i = 0; i < count; i++) {
            bag.push(letter);
        }
    });

    // Shuffle
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    return bag;
}

function fillRack(player) {
    while (player.rack.length < 7 && gameState.tileBag.length > 0) {
        player.rack.push(gameState.tileBag.pop());
    }
}

function getLetterValue(letter) {
    const distribution = TILE_DISTRIBUTIONS[currentLanguage] || TILE_DISTRIBUTIONS.english;
    return distribution.values[letter?.toLowerCase()] || 0;
}

function getWordsFromBoard() {
    const words = [];
    const board = gameState.board;

    // Check horizontal words
    for (let row = 0; row < 15; row++) {
        let word = '';
        let tiles = [];
        for (let col = 0; col < 15; col++) {
            const square = board[row][col];
            if (square.letter || square.isBlank) {
                // Use chosenLetter for blanks, otherwise use letter
                const letterForWord = square.isBlank ? square.chosenLetter : square.letter;
                word += letterForWord;
                tiles.push({
                    row,
                    col,
                    letter: letterForWord,
                    isNew: square.isNew,
                    isBlank: square.isBlank
                });
            } else {
                if (word.length > 1) {
                    words.push({ word, tiles: [...tiles], direction: 'horizontal' });
                }
                word = '';
                tiles = [];
            }
        }
        if (word.length > 1) {
            words.push({ word, tiles, direction: 'horizontal' });
        }
    }

    // Check vertical words
    for (let col = 0; col < 15; col++) {
        let word = '';
        let tiles = [];
        for (let row = 0; row < 15; row++) {
            const square = board[row][col];
            if (square.letter || square.isBlank) {
                // Use chosenLetter for blanks, otherwise use letter
                const letterForWord = square.isBlank ? square.chosenLetter : square.letter;
                word += letterForWord;
                tiles.push({
                    row,
                    col,
                    letter: letterForWord,
                    isNew: square.isNew,
                    isBlank: square.isBlank
                });
            } else {
                if (word.length > 1) {
                    words.push({ word, tiles: [...tiles], direction: 'vertical' });
                }
                word = '';
                tiles = [];
            }
        }
        if (word.length > 1) {
            words.push({ word, tiles, direction: 'vertical' });
        }
    }

    return words;
}

function calculateWordScore(wordObj) {
    let score = 0;
    let wordMultiplier = 1;

    wordObj.tiles.forEach(tile => {
        // Blank tiles are always worth 0 points
        let letterScore = tile.isBlank ? 0 : getLetterValue(tile.letter);
        const square = gameState.board[tile.row][tile.col];

        if (tile.isNew) {
            if (square.type === 'dl') letterScore *= 2;
            if (square.type === 'tl') letterScore *= 3;
            if (square.type === 'dw' || square.type === 'center') wordMultiplier *= 2;
            if (square.type === 'tw') wordMultiplier *= 3;
        }

        score += letterScore;
    });

    return score * wordMultiplier;
}

function handlePlaceTile(playerId, letter, rackIndex, row, col, chosenLetter = null) {
    const player = gameState[`player${playerId}`];

    // Validate player exists
    if (!player) {
        console.error(`Player ${playerId} not found. Available players:`, Object.keys(gameState).filter(k => k.startsWith('player')));
        return { success: false, error: `Player ${playerId} not found` };
    }

    // Validate
    if (!player.isCurrentPlayer) {
        return { success: false, error: 'Not your turn' };
    }

    if (rackIndex < 0 || rackIndex >= player.rack.length) {
        return { success: false, error: 'Invalid rack index' };
    }

    if (gameState.board[row][col].letter || gameState.board[row][col].isBlank) {
        return { success: false, error: 'Square occupied' };
    }

    // Check if it's a blank tile
    const isBlank = letter === '';

    // Place tile
    if (isBlank) {
        gameState.board[row][col].isBlank = true;
        gameState.board[row][col].chosenLetter = chosenLetter || '';
        gameState.board[row][col].letter = '';
    } else {
        gameState.board[row][col].letter = letter;
        gameState.board[row][col].isBlank = false;
        gameState.board[row][col].chosenLetter = '';
    }
    gameState.board[row][col].isNew = true;
    player.rack.splice(rackIndex, 1);

    return { success: true };
}

function handleRecallTiles(playerId) {
    const player = gameState[`player${playerId}`];

    if (!player) {
        console.error(`Player ${playerId} not found in handleRecallTiles`);
        return { success: false, error: `Player ${playerId} not found` };
    }

    // Find all new tiles and return to rack
    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const square = gameState.board[row][col];
            if (square.isNew) {
                if (square.isBlank) {
                    player.rack.push('');
                    square.isBlank = false;
                    square.chosenLetter = '';
                } else if (square.letter) {
                    player.rack.push(square.letter);
                }
                square.letter = '';
                square.isNew = false;
            }
        }
    }

    gameState.message = 'Tiles recalled';
    gameState.messageType = 'info';

    return { success: true };
}

function handleSetBlankLetter(row, col, chosenLetter) {
    const square = gameState.board[row][col];

    if (!square.isBlank) {
        return { success: false, error: 'Not a blank tile' };
    }

    if (!square.isNew) {
        return { success: false, error: 'Cannot change locked blank' };
    }

    if (!chosenLetter || chosenLetter.length !== 1) {
        return { success: false, error: 'Invalid letter' };
    }

    square.chosenLetter = chosenLetter.toLowerCase();

    return { success: true };
}

function handlePass(playerId) {
    const player = gameState[`player${playerId}`];

    if (!player) {
        console.error(`Player ${playerId} not found in handlePass`);
        return { success: false, error: `Player ${playerId} not found` };
    }

    if (!player.isCurrentPlayer) {
        return { success: false, error: 'Not your turn' };
    }

    // Check if there are tiles on the board
    const hasNewTiles = gameState.board.some(row => row.some(cell => cell.isNew));
    if (hasNewTiles) {
        gameState.message = 'Cannot pass with tiles placed on board. Clear them first.';
        gameState.messageType = 'error';
        return { success: false, error: 'Tiles on board' };
    }

    // Increment consecutive passes
    gameState.consecutivePasses++;

    console.log(`[Pass] Player ${playerId} passed. Consecutive passes: ${gameState.consecutivePasses}/${gameState.playerCount}`);

    // Add pass to history
    player.history.push({
        turnNumber: player.history.length + 1,
        action: 'pass',
        totalScore: 0
    });

    gameState.message = `${player.playerName} passed their turn`;
    gameState.messageType = 'info';

    // Check if game should end (all players passed consecutively)
    if (gameState.consecutivePasses >= gameState.playerCount) {
        console.log(`[Pass] Game ending - all ${gameState.playerCount} players passed consecutively`);
        endGame();
        return { success: true, gameOver: true };
    }

    // Switch to next player
    switchToNextPlayer();

    return { success: true };
}

function switchToNextPlayer() {
    const previousPlayer = gameState.currentPlayer;

    console.log(`[Turn Switch DEBUG] Before: currentPlayer=${gameState.currentPlayer}, playerCount=${gameState.playerCount}, type=${typeof gameState.playerCount}`);

    // Set all players to not current
    for (let i = 1; i <= gameState.playerCount; i++) {
        gameState[`player${i}`].isCurrentPlayer = false;
    }

    // Move to next player (circular rotation)
    // If current is 3 and count is 3: (3 % 3) = 0, wrap to 1
    // If current is 1 and count is 3: (1 % 3) = 1, next is 2
    // If current is 2 and count is 3: (2 % 3) = 2, next is 3
    let nextPlayer = (gameState.currentPlayer % gameState.playerCount) + 1;

    console.log(`[Turn Switch DEBUG] Calculation: (${previousPlayer} % ${gameState.playerCount}) + 1 = ${nextPlayer}`);

    // Double-check the player exists, otherwise fall back to player 1
    if (!gameState[`player${nextPlayer}`]) {
        console.error(`[Turn Switch ERROR] Player ${nextPlayer} does not exist! Falling back to Player 1. Available:`, Object.keys(gameState).filter(k => k.startsWith('player')));
        nextPlayer = 1;
    }

    gameState.currentPlayer = nextPlayer;
    gameState[`player${gameState.currentPlayer}`].isCurrentPlayer = true;

    console.log(`[Turn Switch] Player ${previousPlayer} → Player ${gameState.currentPlayer} (${gameState.playerCount} players total)`);
}

function calculateFinalScores() {
    const finalScores = {};
    const remainingValues = {};
    let playerWithEmptyRack = null;
    let totalRemaining = 0;

    // Calculate remaining tile values for each player
    for (let i = 1; i <= gameState.playerCount; i++) {
        const player = gameState[`player${i}`];
        const remaining = player.rack.reduce((sum, letter) => sum + getLetterValue(letter), 0);
        remainingValues[`player${i}`] = remaining;
        remainingValues[`player${i}Remaining`] = remaining;

        if (player.rack.length === 0 && !playerWithEmptyRack) {
            playerWithEmptyRack = i;
        }
        totalRemaining += remaining;
    }

    // Calculate final scores
    for (let i = 1; i <= gameState.playerCount; i++) {
        const player = gameState[`player${i}`];
        let finalScore = player.score - remainingValues[`player${i}`];

        // If this player used all tiles, they get all opponents' remaining values
        if (playerWithEmptyRack === i) {
            finalScore += totalRemaining;
        }

        finalScores[`player${i}`] = finalScore;
    }

    return { ...finalScores, ...remainingValues };
}

function endGame() {
    gameState.gameOver = true;
    const finalScores = calculateFinalScores();
    gameState.finalScores = finalScores;

    // Find the winner(s)
    let highestScore = -Infinity;
    let winners = [];

    for (let i = 1; i <= gameState.playerCount; i++) {
        const score = finalScores[`player${i}`];
        if (score > highestScore) {
            highestScore = score;
            winners = [i];
        } else if (score === highestScore) {
            winners.push(i);
        }
    }

    if (winners.length === 1) {
        gameState.winner = winners[0];
        const winnerName = gameState[`player${winners[0]}`].playerName;
        const scoresText = Array.from({ length: gameState.playerCount }, (_, i) =>
            finalScores[`player${i + 1}`]
        ).join(' - ');
        gameState.message = `Game Over! ${winnerName} wins with ${highestScore} points! (${scoresText})`;
    } else {
        gameState.winner = 0; // Tie
        const winnerNames = winners.map(w => gameState[`player${w}`].playerName).join(' and ');
        gameState.message = `Game Over! It's a tie between ${winnerNames} at ${highestScore} points!`;
    }
    gameState.messageType = 'success';
}

function handlePlayWord(playerId) {
    const player = gameState[`player${playerId}`];

    if (!player) {
        console.error(`Player ${playerId} not found in handlePlayWord`);
        return { success: false, error: `Player ${playerId} not found` };
    }

    if (!player.isCurrentPlayer) {
        return { success: false, error: 'Not your turn' };
    }

    // Find new tiles
    const newTiles = [];
    const unassignedBlanks = [];
    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const square = gameState.board[row][col];
            if (square.isNew) {
                newTiles.push({ row, col, letter: square.letter, isBlank: square.isBlank });
                // Check if blank needs letter assignment
                if (square.isBlank && !square.chosenLetter) {
                    unassignedBlanks.push({ row, col });
                }
            }
        }
    }

    if (newTiles.length === 0) {
        gameState.message = 'No tiles placed!';
        gameState.messageType = 'error';
        return { success: false, error: 'No tiles placed' };
    }

    // Validate all blanks have chosen letters
    if (unassignedBlanks.length > 0) {
        gameState.message = 'Please assign letters to all blank tiles!';
        gameState.messageType = 'error';
        return { success: false, error: 'Unassigned blanks', unassignedBlanks };
    }

    // Check first move uses center
    const hasLockedTiles = gameState.board.some(row => row.some(cell => cell.letter && cell.locked));
    if (!hasLockedTiles) {
        const usesCenterSquare = newTiles.some(tile => tile.row === 7 && tile.col === 7);
        if (!usesCenterSquare) {
            gameState.message = 'First word must use the center square (★)!';
            gameState.messageType = 'error';
            return { success: false, error: 'Must use center square' };
        }
    }

    // Get words and validate
    const allWords = getWordsFromBoard();
    const newWords = allWords.filter(wordObj => wordObj.tiles.some(tile => tile.isNew));

    if (newWords.length === 0) {
        gameState.message = 'No valid words formed!';
        gameState.messageType = 'error';
        return { success: false, error: 'No valid words' };
    }

    // Check dictionary
    const invalidWords = newWords.filter(wordObj => !activeDictionary.has(wordObj.word.toLowerCase()));

    if (invalidWords.length > 0) {
        gameState.message = `Invalid word(s): ${invalidWords.map(w => w.word).join(', ')}`;
        gameState.messageType = 'error';

        // Add to history
        player.history.push({
            turnNumber: player.history.length + 1,
            action: 'invalid',
            words: invalidWords.map(w => ({
                word: w.word,
                score: 0,
                definition: 'Not in dictionary'
            })),
            totalScore: 0,
            timestamp: new Date().toLocaleTimeString()
        });

        // Return tiles to rack
        newTiles.forEach(tile => {
            const square = gameState.board[tile.row][tile.col];
            // Return blank tile (empty string) or regular letter
            if (square.isBlank) {
                player.rack.push('');
                square.isBlank = false;
                square.chosenLetter = '';
            } else {
                player.rack.push(tile.letter);
            }
            square.letter = '';
            square.isNew = false;
        });

        // Switch player (end turn)
        switchToNextPlayer();

        return { success: false, error: 'Invalid words' };
    }

    // Calculate score
    let totalScore = 0;
    const wordScores = newWords.map(wordObj => {
        const score = calculateWordScore(wordObj);
        totalScore += score;
        const definition = getDefinition(wordObj.word);
        return {
            word: wordObj.word,
            score,
            definition: definition || 'Definition not available'
        };
    });

    // Bingo bonus
    const bingoBonus = newTiles.length === 7 ? 50 : 0;
    totalScore += bingoBonus;

    // Update history
    player.history.push({
        turnNumber: player.history.length + 1,
        words: wordScores,
        bingoBonus: bingoBonus,
        totalScore: totalScore,
        timestamp: new Date().toLocaleTimeString()
    });

    player.score += totalScore;

    // Lock tiles
    newTiles.forEach(tile => {
        gameState.board[tile.row][tile.col].isNew = false;
        gameState.board[tile.row][tile.col].locked = true;
    });

    // Reset consecutive passes on successful play
    console.log(`[Play Word] Player ${playerId} played a word. Resetting consecutive passes from ${gameState.consecutivePasses} to 0`);
    gameState.consecutivePasses = 0;

    // Refill rack
    fillRack(player);

    // Check if game should end (bag empty AND player used all tiles)
    if (gameState.tileBag.length === 0 && player.rack.length === 0) {
        endGame();
        return { success: true, score: totalScore, gameOver: true };
    }

    // Switch player
    switchToNextPlayer();

    // Message
    const wordDetails = wordScores.map(ws => `${ws.word} (${ws.score})`).join(', ');
    const bonusText = bingoBonus ? ' +50 BINGO!' : '';
    gameState.message = `Valid! ${wordDetails}${bonusText} = ${totalScore} points`;
    gameState.messageType = 'success';

    return { success: true, score: totalScore };
}

function handleExchangeTiles(playerId, indices) {
    const player = gameState[`player${playerId}`];

    if (!player) {
        console.error(`Player ${playerId} not found in handleExchangeTiles`);
        return { success: false, error: `Player ${playerId} not found` };
    }

    if (!player.isCurrentPlayer) {
        return { success: false, error: 'Not your turn' };
    }

    if (indices.length === 0) {
        return { success: false, error: 'No tiles selected for exchange' };
    }

    if (gameState.tileBag.length < indices.length) {
        gameState.message = 'Not enough tiles in the bag to exchange.';
        gameState.messageType = 'error';
        return { success: false, error: 'Not enough tiles in bag' };
    }

    // Sort indices in descending order to avoid issues when removing from rack
    indices.sort((a, b) => b - a);

    const tilesToReturn = [];
    for (const index of indices) {
        if (index >= 0 && index < player.rack.length) {
            tilesToReturn.push(player.rack.splice(index, 1)[0]);
        }
    }

    // Add returned tiles back to the bag and shuffle
    gameState.tileBag.push(...tilesToReturn);
    for (let i = gameState.tileBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.tileBag[i], gameState.tileBag[j]] = [gameState.tileBag[j], gameState.tileBag[i]];
    }

    // Refill player's rack
    fillRack(player);

    // Add to history
    player.history.push({
        turnNumber: player.history.length + 1,
        action: 'exchange',
        count: tilesToReturn.length,
        totalScore: 0,
        timestamp: new Date().toLocaleTimeString()
    });

    // End turn
    switchToNextPlayer();
    gameState.consecutivePasses = 0; // Reset pass counter

    gameState.message = `${player.playerName} exchanged ${indices.length} tiles.`;
    gameState.messageType = 'info';

    return { success: true };
}


// Parse dictionary file with definitions
// Format: WORD definition [metadata]
function parseDictionaryFile(content) {
    const dictionary = new Map();
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Match format: WORD rest of line (with definition)
        const match = trimmed.match(/^(\S+)\s+(.+)$/);
        if (match) {
            const word = match[1].toLowerCase();
            const definition = match[2];
            dictionary.set(word, definition);
        } else {
            // Format: just WORD (no definition)
            const word = trimmed.toLowerCase();
            dictionary.set(word, null);
        }
    }

    return dictionary;
}

// Load dictionaries
function loadDictionaries() {
    try {
        // Load CSW21
        const csw21Path = path.join(process.cwd(), 'public', 'CSW21.txt');
        if (fs.existsSync(csw21Path)) {
            const content = fs.readFileSync(csw21Path, 'utf-8');
            csw21Dictionary = parseDictionaryFile(content);
            console.log(`[Game API] CSW21 Dictionary loaded: ${csw21Dictionary.size} words`);
        } else {
            console.warn('[Game API] CSW21.txt not found');
        }

        // Load NWL2023
        const nwl2023Path = path.join(process.cwd(), 'public', 'NWL2023.txt');
        if (fs.existsSync(nwl2023Path)) {
            const content = fs.readFileSync(nwl2023Path, 'utf-8');
            nwl2023Dictionary = parseDictionaryFile(content);
            console.log(`[Game API] NWL2023 Dictionary loaded: ${nwl2023Dictionary.size} words`);
        } else {
            console.warn('[Game API] NWL2023.txt not found');
        }

        // Load Slovenian dictionary
        const slovenianPath = path.join(process.cwd(), 'public', 'SLOVENIAN.txt');
        if (fs.existsSync(slovenianPath)) {
            const content = fs.readFileSync(slovenianPath, 'utf-8');
            slovenianDictionary = parseDictionaryFile(content);
            console.log(`[Game API] Slovenian Dictionary loaded: ${slovenianDictionary.size} words 🇸🇮`);
        } else {
            console.warn('[Game API] SLOVENIAN.txt not found');
        }

        // Initialize active dictionary with CSW21 by default
        updateActiveDictionary({ csw21: true, nwl2023: false, slovenian: false });

    } catch (error) {
        console.error('[Game API] Failed to load dictionaries:', error);
    }
}

// Update which dictionaries are active
function updateActiveDictionary(selection) {
    activeDictionary = new Set();

    if (selection.csw21) {
        for (const word of csw21Dictionary.keys()) {
            activeDictionary.add(word);
        }
    }

    if (selection.nwl2023) {
        for (const word of nwl2023Dictionary.keys()) {
            activeDictionary.add(word);
        }
    }

    if (selection.slovenian) {
        for (const word of slovenianDictionary.keys()) {
            activeDictionary.add(word);
        }
    }

    const activeNames = [];
    if (selection.csw21) activeNames.push('CSW21');
    if (selection.nwl2023) activeNames.push('NWL2023');
    if (selection.slovenian) activeNames.push('Slovenian 🇸🇮');

    // Determine language based on dictionary selection
    // If only Slovenian is selected, use Slovenian tiles
    // If mixed or only English dictionaries, use English tiles
    const newLanguage = (selection.slovenian && !selection.csw21 && !selection.nwl2023) ? 'slovenian' : 'english';

    // If language changed and game is in progress, warn that tiles won't change mid-game
    if (newLanguage !== currentLanguage && gameState) {
        console.log(`[Game API] Language changed from ${currentLanguage} to ${newLanguage}. Tile distribution will apply to next game.`);
        currentLanguage = newLanguage;
        if (gameState) {
            gameState.language = newLanguage;
        }
    }

    console.log(`[Game API] Active dictionary updated: ${activeDictionary.size} words (${activeNames.join(' + ')}), Language: ${currentLanguage}`);
}

// Get definition for a word from active dictionaries
function getDefinition(word) {
    const lowerWord = word.toLowerCase();

    // Try CSW21 first
    if (csw21Dictionary.has(lowerWord)) {
        return csw21Dictionary.get(lowerWord);
    }

    // Then try NWL2023
    if (nwl2023Dictionary.has(lowerWord)) {
        return nwl2023Dictionary.get(lowerWord);
    }

    // Then try Slovenian
    if (slovenianDictionary.has(lowerWord)) {
        return slovenianDictionary.get(lowerWord);
    }

    return null;
}

export function gameApiPlugin() {
    return {
        name: 'game-api-v2',
        configureServer(server) {
            // Load dictionaries on startup
            loadDictionaries();

            // Initialize game with 4 players by default, English language
            gameState = createInitialGameState(4, 'english');
            for (let i = 1; i <= gameState.playerCount; i++) {
                fillRack(gameState[`player${i}`]);
            }
            console.log('[Game API] Game initialized with', gameState.playerCount, 'players, language:', gameState.language);

            server.middlewares.use((req, res, next) => {
                // GET /api/game-state - Returns complete game state
                if (req.url === '/api/game-state' && req.method === 'GET') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(gameState));
                    return;
                }

                // POST /api/action - Handles all player actions
                if (req.url === '/api/action' && req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString();
                    });
                    req.on('end', () => {
                        try {
                            const action = JSON.parse(body);
                            let result;

                            switch (action.type) {
                                case 'place-tile':
                                    result = handlePlaceTile(action.playerId, action.letter, action.rackIndex, action.row, action.col, action.chosenLetter);
                                    break;
                                case 'set-blank-letter':
                                    result = handleSetBlankLetter(action.row, action.col, action.chosenLetter);
                                    break;
                                case 'recall':
                                    result = handleRecallTiles(action.playerId);
                                    break;
                                case 'play-word':
                                    result = handlePlayWord(action.playerId);
                                    break;
                                case 'pass':
                                    result = handlePass(action.playerId);
                                    break;
                                case 'update-viewport':
                                    gameState.viewportCenter = action.viewportCenter;
                                    result = { success: true };
                                    break;
                                case 'restart':
                                    const playerCount = action.playerCount || gameState.playerCount || 4;
                                    const language = action.language || currentLanguage || 'english';
                                    console.log(`[Restart] Creating new game with ${playerCount} players, language: ${language}`);
                                    gameState = createInitialGameState(playerCount, language);
                                    for (let i = 1; i <= gameState.playerCount; i++) {
                                        fillRack(gameState[`player${i}`]);
                                    }
                                    console.log(`[Restart] Game created. Current player: ${gameState.currentPlayer}, Language: ${gameState.language}, Available players:`, Object.keys(gameState).filter(k => k.startsWith('player')));
                                    result = { success: true };
                                    break;
                                case 'reorder-rack':
                                    const player = gameState[`player${action.playerId}`];
                                    if (player && Array.isArray(action.newRack)) {
                                        player.rack = action.newRack;
                                        result = { success: true };
                                    } else {
                                        result = { success: false, error: 'Invalid rack data or player' };
                                    }
                                    break;
                                case 'exchange-tiles':
                                    result = handleExchangeTiles(action.playerId, action.indices);
                                    break;
                                case 'update-dictionary':
                                    updateActiveDictionary(action.dictionaries);
                                    result = { success: true };
                                    break;
                                case 'validate-word':
                                    const wordToValidate = action.word?.toLowerCase();
                                    if (!wordToValidate) {
                                        result = { success: false, valid: false, error: 'No word provided' };
                                    } else {
                                        const isValid = activeDictionary.has(wordToValidate);
                                        console.log(`[Validate] Word: "${wordToValidate}", Valid: ${isValid}, Active Dict Size: ${activeDictionary.size}`);
                                        result = {
                                            success: true,
                                            valid: isValid,
                                            word: wordToValidate.toUpperCase()
                                        };
                                    }
                                    break;
                                default:
                                    result = { success: false, error: 'Unknown action' };
                            }

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ ...result, gameState }));
                        } catch (e) {
                            console.error('[Game API] Error handling action:', e);
                            res.statusCode = 400;
                            res.end(JSON.stringify({ success: false, error: e.message }));
                        }
                    });
                    return;
                }

                // GET /api/words?dictionary=csw21 - Returns all words from specified dictionary
                if (req.url?.startsWith('/api/words') && req.method === 'GET') {
                    const url = new URL(req.url, `http://${req.headers.host}`);
                    const dictionary = url.searchParams.get('dictionary');
                    const length = url.searchParams.get('length');
                    const contains = url.searchParams.get('contains');
                    const containsAny = url.searchParams.get('containsAny');
                    const startsWith = url.searchParams.get('startsWith');
                    const endsWith = url.searchParams.get('endsWith');
                    const excludes = url.searchParams.get('excludes');

                    let words = [];
                    if (dictionary === 'csw21') {
                        words = Array.from(csw21Dictionary.keys());
                    } else if (dictionary === 'nwl2023') {
                        words = Array.from(nwl2023Dictionary.keys());
                    } else if (dictionary === 'slovenian') {
                        words = Array.from(slovenianDictionary.keys());
                    } else {
                        // Return all active dictionary words
                        words = Array.from(activeDictionary);
                    }

                    // Apply filters
                    if (length) {
                        const targetLength = parseInt(length);
                        words = words.filter(w => w.length === targetLength);
                    }

                    if (contains) {
                        // Word must contain ALL specified letters
                        const containsLetters = contains.toUpperCase().split(',');
                        words = words.filter(w => {
                            const upper = w.toUpperCase();
                            return containsLetters.every(letter => upper.includes(letter.trim()));
                        });
                    }

                    if (containsAny) {
                        // Word must contain AT LEAST ONE of the specified letters
                        const containsLetters = containsAny.toUpperCase().split(',');
                        words = words.filter(w => {
                            const upper = w.toUpperCase();
                            return containsLetters.some(letter => upper.includes(letter.trim()));
                        });
                    }

                    if (startsWith) {
                        const prefix = startsWith.toUpperCase();
                        words = words.filter(w => w.toUpperCase().startsWith(prefix));
                    }

                    if (endsWith) {
                        const suffix = endsWith.toUpperCase();
                        words = words.filter(w => w.toUpperCase().endsWith(suffix));
                    }

                    if (excludes) {
                        const excludeLetters = excludes.toUpperCase().split(',');
                        words = words.filter(w => {
                            const upper = w.toUpperCase();
                            return !excludeLetters.some(letter => upper.includes(letter.trim()));
                        });
                    }

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ words, count: words.length }));
                    return;
                }

                next();
            });
        }
    };
}
