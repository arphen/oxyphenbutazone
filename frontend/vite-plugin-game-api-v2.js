import fs from 'fs';
import path from 'path';

// Single source of truth - all game state lives here
let gameState = null;

// Dictionary loaded once at startup
let dictionary = new Set();

// Initialize game state
function createInitialGameState() {
    return {
        board: createInitialBoard(),
        tileBag: initializeTileBag(),
        viewportCenter: { row: 7, col: 7 },
        player1: {
            playerName: 'Player 1',
            rack: [],
            score: 0,
            history: [],
            isCurrentPlayer: true
        },
        player2: {
            playerName: 'Player 2',
            rack: [],
            score: 0,
            history: [],
            isCurrentPlayer: false
        },
        currentPlayer: 1,
        consecutivePasses: 0,
        gameOver: false,
        winner: null,
        finalScores: null,
        message: '',
        messageType: '',
        gameId: generateGameId()
    };
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

function initializeTileBag() {
    const letterDistribution = [
        { letter: 'e', count: 12 }, { letter: 'a', count: 9 }, { letter: 'i', count: 9 },
        { letter: 'o', count: 8 }, { letter: 'n', count: 6 }, { letter: 'r', count: 6 },
        { letter: 't', count: 6 }, { letter: 'l', count: 4 }, { letter: 's', count: 4 },
        { letter: 'u', count: 4 }, { letter: 'd', count: 4 }, { letter: 'g', count: 3 },
        { letter: 'b', count: 2 }, { letter: 'c', count: 2 }, { letter: 'm', count: 2 },
        { letter: 'p', count: 2 }, { letter: 'f', count: 2 }, { letter: 'h', count: 2 },
        { letter: 'v', count: 2 }, { letter: 'w', count: 2 }, { letter: 'y', count: 2 },
        { letter: 'k', count: 1 }, { letter: 'j', count: 1 }, { letter: 'x', count: 1 },
        { letter: 'q', count: 1 }, { letter: 'z', count: 1 }, { letter: '', count: 2 } // blanks
    ];

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
    const values = {
        'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1, 'l': 1, 'n': 1, 's': 1, 't': 1, 'r': 1,
        'd': 2, 'g': 2, 'b': 3, 'c': 3, 'm': 3, 'p': 3,
        'f': 4, 'h': 4, 'v': 4, 'w': 4, 'y': 4, 'k': 5,
        'j': 8, 'x': 8, 'q': 10, 'z': 10, '': 0
    };
    return values[letter?.toLowerCase()] || 0;
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
    const player = playerId === '1' ? gameState.player1 : gameState.player2;

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
    const player = playerId === '1' ? gameState.player1 : gameState.player2;

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
    const player = playerId === '1' ? gameState.player1 : gameState.player2;

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

    // Add pass to history
    player.history.push({
        turnNumber: player.history.length + 1,
        action: 'pass',
        totalScore: 0
    });

    gameState.message = `${player.playerName} passed their turn`;
    gameState.messageType = 'info';

    // Check if game should end (2 consecutive passes)
    if (gameState.consecutivePasses >= 2) {
        endGame();
        return { success: true, gameOver: true };
    }

    // Switch player
    gameState.player1.isCurrentPlayer = !gameState.player1.isCurrentPlayer;
    gameState.player2.isCurrentPlayer = !gameState.player2.isCurrentPlayer;
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

    return { success: true };
}

function calculateFinalScores() {
    const player1RemainingValue = gameState.player1.rack.reduce((sum, letter) => sum + getLetterValue(letter), 0);
    const player2RemainingValue = gameState.player2.rack.reduce((sum, letter) => sum + getLetterValue(letter), 0);

    let finalScore1 = gameState.player1.score - player1RemainingValue;
    let finalScore2 = gameState.player2.score - player2RemainingValue;

    // If one player used all tiles, they get opponent's remaining tile values
    if (gameState.player1.rack.length === 0) {
        finalScore1 += player2RemainingValue;
    } else if (gameState.player2.rack.length === 0) {
        finalScore2 += player1RemainingValue;
    }

    return {
        player1: finalScore1,
        player2: finalScore2,
        player1Remaining: player1RemainingValue,
        player2Remaining: player2RemainingValue
    };
}

function endGame() {
    gameState.gameOver = true;
    const finalScores = calculateFinalScores();
    gameState.finalScores = finalScores;

    if (finalScores.player1 > finalScores.player2) {
        gameState.winner = 1;
        gameState.message = `Game Over! ${gameState.player1.playerName} wins ${finalScores.player1} - ${finalScores.player2}!`;
    } else if (finalScores.player2 > finalScores.player1) {
        gameState.winner = 2;
        gameState.message = `Game Over! ${gameState.player2.playerName} wins ${finalScores.player2} - ${finalScores.player1}!`;
    } else {
        gameState.winner = 0; // Tie
        gameState.message = `Game Over! It's a tie at ${finalScores.player1} - ${finalScores.player2}!`;
    }
    gameState.messageType = 'success';
}

function handlePlayWord(playerId) {
    const player = playerId === '1' ? gameState.player1 : gameState.player2;

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
    const invalidWords = newWords.filter(wordObj => !dictionary.has(wordObj.word.toLowerCase()));

    if (invalidWords.length > 0) {
        gameState.message = `Invalid word(s): ${invalidWords.map(w => w.word).join(', ')}`;
        gameState.messageType = 'error';

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
        gameState.player1.isCurrentPlayer = !gameState.player1.isCurrentPlayer;
        gameState.player2.isCurrentPlayer = !gameState.player2.isCurrentPlayer;
        gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

        return { success: false, error: 'Invalid words' };
    }

    // Calculate score
    let totalScore = 0;
    const wordScores = newWords.map(wordObj => {
        const score = calculateWordScore(wordObj);
        totalScore += score;
        return { word: wordObj.word, score };
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
    gameState.consecutivePasses = 0;

    // Refill rack
    fillRack(player);

    // Check if game should end (bag empty AND player used all tiles)
    if (gameState.tileBag.length === 0 && player.rack.length === 0) {
        endGame();
        return { success: true, score: totalScore, gameOver: true };
    }

    // Switch player
    gameState.player1.isCurrentPlayer = !gameState.player1.isCurrentPlayer;
    gameState.player2.isCurrentPlayer = !gameState.player2.isCurrentPlayer;
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

    // Message
    const wordDetails = wordScores.map(ws => `${ws.word} (${ws.score})`).join(', ');
    const bonusText = bingoBonus ? ' +50 BINGO!' : '';
    gameState.message = `Valid! ${wordDetails}${bonusText} = ${totalScore} points`;
    gameState.messageType = 'success';

    return { success: true, score: totalScore };
}

// Load dictionary
function loadDictionary() {
    try {
        const dictPath = path.join(process.cwd(), 'public', 'sowpods.txt');
        const content = fs.readFileSync(dictPath, 'utf-8');
        const words = content.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
        dictionary = new Set(words);
        console.log(`[Game API] Dictionary loaded: ${dictionary.size} words`);
    } catch (error) {
        console.error('[Game API] Failed to load dictionary:', error);
    }
}

export function gameApiPlugin() {
    return {
        name: 'game-api-v2',
        configureServer(server) {
            // Load dictionary on startup
            loadDictionary();

            // Initialize game
            gameState = createInitialGameState();
            fillRack(gameState.player1);
            fillRack(gameState.player2);
            console.log('[Game API] Game initialized');

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
                                    gameState = createInitialGameState();
                                    fillRack(gameState.player1);
                                    fillRack(gameState.player2);
                                    result = { success: true };
                                    break;
                                case 'reorder-rack':
                                    const player = action.playerId === '1' ? gameState.player1 : gameState.player2;
                                    if (Array.isArray(action.newRack)) {
                                        player.rack = action.newRack;
                                        result = { success: true };
                                    } else {
                                        result = { success: false, error: 'Invalid rack data' };
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

                next();
            });
        }
    };
}
