// The game engine: all rules, turn handling and state transitions. Pure and environment-free, so the exact same
// code runs in the Vite dev server (laptop host), in a phone's browser (P2P host) and under test.
//
// Every action goes through dispatch(), which validates it first (see protocol.js).

import {
    createBoard,
    createTileBag,
    shuffle,
    getWordsFromBoard,
    scoreWord,
    getAlphabet,
    TILE_DISTRIBUTIONS,
    validatePlacement,
    calculateFinalScores as computeFinalScores,
    RACK_SIZE,
    BINGO_BONUS,
} from './rules.js';
import { sanitizeAction } from './protocol.js';
import { selectionForNewGame, defaultSelectionFor } from './dictionary.js';
import { debug, logError, logWarn } from '../utils/log.js';

/**
 * @param dict    a dictionary store (see dictionary.js)
 * @param options { random }  injectable RNG for deterministic tests
 */
export function createEngine(dict, { random = Math.random } = {}) {
    let gameState = null;

    // Initialize game state
    function createInitialGameState(playerCount = 4, language = 'english') {
        const state = {
            board: createBoard(),
            tileBag: createTileBag(language, random),
            viewportCenter: { row: 7, col: 7 },
            currentPlayer: 1,
            playerCount: playerCount,
            language: language,
            dictionaries: dict.getSelection(),
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




    function fillRack(player) {
        while (player.rack.length < RACK_SIZE && gameState.tileBag.length > 0) {
            player.rack.push(gameState.tileBag.pop());
        }
    }



    function handlePlaceTile(playerId, rackIndex, row, col, chosenLetter = null) {
        const player = gameState[`player${playerId}`];

        // Validate player exists
        if (!player) {
            logError(`Player ${playerId} not found. Available players:`, Object.keys(gameState).filter(k => k.startsWith('player')));
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

        // The tile placed is whatever is really in the rack at that position (a client-supplied letter is ignored)
        const letter = player.rack[rackIndex];

        // Check if it's a blank tile
        const isBlank = letter === '';

        if (isBlank && chosenLetter && !getAlphabet(gameState.language).includes(chosenLetter.toLowerCase())) {
            return { success: false, error: `'${chosenLetter}' is not a letter in this game's alphabet` };
        }

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
            logError(`Player ${playerId} not found in handleRecallTiles`);
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

        if (!chosenLetter || chosenLetter.length !== 1 || !getAlphabet(gameState.language).includes(chosenLetter.toLowerCase())) {
            return { success: false, error: 'Invalid letter' };
        }

        square.chosenLetter = chosenLetter.toLowerCase();

        return { success: true };
    }

    function handlePass(playerId) {
        const player = gameState[`player${playerId}`];

        if (!player) {
            logError(`Player ${playerId} not found in handlePass`);
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

        debug(`[Pass] Player ${playerId} passed. Consecutive passes: ${gameState.consecutivePasses}/${gameState.playerCount}`);

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
            debug(`[Pass] Game ending - all ${gameState.playerCount} players passed consecutively`);
            endGame();
            return { success: true, gameOver: true };
        }

        // Switch to next player
        switchToNextPlayer();

        return { success: true };
    }

    function switchToNextPlayer() {
        const previousPlayer = gameState.currentPlayer;

        debug(`[Turn Switch DEBUG] Before: currentPlayer=${gameState.currentPlayer}, playerCount=${gameState.playerCount}, type=${typeof gameState.playerCount}`);

        // Set all players to not current
        for (let i = 1; i <= gameState.playerCount; i++) {
            gameState[`player${i}`].isCurrentPlayer = false;
        }

        // Move to next player (circular rotation)
        // If current is 3 and count is 3: (3 % 3) = 0, wrap to 1
        // If current is 1 and count is 3: (1 % 3) = 1, next is 2
        // If current is 2 and count is 3: (2 % 3) = 2, next is 3
        let nextPlayer = (gameState.currentPlayer % gameState.playerCount) + 1;

        debug(`[Turn Switch DEBUG] Calculation: (${previousPlayer} % ${gameState.playerCount}) + 1 = ${nextPlayer}`);

        // Double-check the player exists, otherwise fall back to player 1
        if (!gameState[`player${nextPlayer}`]) {
            logError(`[Turn Switch ERROR] Player ${nextPlayer} does not exist! Falling back to Player 1. Available:`, Object.keys(gameState).filter(k => k.startsWith('player')));
            nextPlayer = 1;
        }

        gameState.currentPlayer = nextPlayer;
        gameState[`player${gameState.currentPlayer}`].isCurrentPlayer = true;

        debug(`[Turn Switch] Player ${previousPlayer} → Player ${gameState.currentPlayer} (${gameState.playerCount} players total)`);
    }

    function calculateFinalScores() {
        const players = Array.from({ length: gameState.playerCount }, (_, i) => gameState[`player${i + 1}`]);
        const { finalScores, remaining } = computeFinalScores(players, gameState.language);
        const result = {};
        finalScores.forEach((score, i) => { result[`player${i + 1}`] = score; });
        remaining.forEach((value, i) => { result[`player${i + 1}Remaining`] = value; });
        return result;
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
            logError(`Player ${playerId} not found in handlePlayWord`);
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

        // Placement legality: one line, no gaps, centre on first move, connected afterwards
        const placement = validatePlacement(gameState.board);
        if (!placement.ok) {
            gameState.message = placement.message;
            gameState.messageType = 'error';
            return { success: false, error: placement.message, code: placement.code };
        }

        // Get words and validate
        const allWords = getWordsFromBoard(gameState.board);
        const newWords = allWords.filter(wordObj => wordObj.tiles.some(tile => tile.isNew));

        if (newWords.length === 0) {
            gameState.message = 'No valid words formed!';
            gameState.messageType = 'error';
            return { success: false, error: 'No valid words' };
        }

        // Check dictionary
        const invalidWords = newWords.filter(wordObj => !dict.has(wordObj.word));

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
            const score = scoreWord(gameState.board, wordObj, gameState.language);
            totalScore += score;
            const definition = dict.definition(wordObj.word);
            return {
                word: wordObj.word,
                score,
                definition: definition || 'Definition not available'
            };
        });

        // Bingo bonus
        const bingoBonus = newTiles.length === RACK_SIZE ? BINGO_BONUS : 0;
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
        debug(`[Play Word] Player ${playerId} played a word. Resetting consecutive passes from ${gameState.consecutivePasses} to 0`);
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
            logError(`Player ${playerId} not found in handleExchangeTiles`);
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
        shuffle(gameState.tileBag, random);

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



    function handleReorderRack(playerId, newRack) {
        const player = gameState[`player${playerId}`];
        if (!player) return { success: false, error: 'Player not found' };

        // The new order must contain exactly the same tiles as the current rack
        const sorted = (tiles) => [...tiles].sort().join('|');
        if (newRack.length !== player.rack.length || sorted(newRack) !== sorted(player.rack)) {
            return { success: false, error: 'Rack can only be reordered, not changed' };
        }
        player.rack = newRack;
        return { success: true };
    }

    function startGame(playerCount, language) {
        gameState = createInitialGameState(playerCount, language);
        for (let i = 1; i <= gameState.playerCount; i++) {
            fillRack(gameState[`player${i}`]);
        }
    }

    /**
     * Validate and apply one action.
     * @param rawAction untrusted input
     * @param ctx       { playerId } when the caller's seat is known (P2P): player-bound actions for another seat are refused
     * @returns the action result plus the full resulting gameState (same shape the HTTP API always returned)
     */
    function dispatch(rawAction, ctx = {}) {
        const parsed = sanitizeAction(rawAction);
        if (!parsed.ok) return { success: false, error: parsed.error, gameState };
        const action = parsed.action;

        if (ctx.playerId !== undefined && action.playerId !== undefined && action.playerId !== ctx.playerId) {
            return { success: false, error: 'That is not your seat', gameState };
        }

        let result;
        switch (action.type) {
            case 'place-tile':
                result = handlePlaceTile(action.playerId, action.rackIndex, action.row, action.col, action.chosenLetter);
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
            case 'restart': {
                const playerCount = action.playerCount || gameState.playerCount || 4;
                const languageChosen = Object.hasOwn(TILE_DISTRIBUTIONS, action.language);
                const language = languageChosen ? action.language : (gameState?.language || 'english');
                const current = dict.getSelection();
                dict.setSelection(languageChosen ? selectionForNewGame(language, current) : defaultSelectionFor(language, current));
                debug(`[Restart] Creating new game with ${playerCount} players, language: ${language}`);
                startGame(playerCount, language);
                result = { success: true };
                break;
            }
            case 'reorder-rack':
                result = handleReorderRack(action.playerId, action.newRack);
                break;
            case 'exchange-tiles':
                result = handleExchangeTiles(action.playerId, action.indices);
                break;
            case 'update-dictionary':
                dict.setSelection(action.dictionaries);
                // The tile language is fixed for the game; only the dictionaries can change mid-game.
                gameState.dictionaries = dict.getSelection();
                result = { success: true };
                break;
            case 'validate-word': {
                const valid = dict.has(action.word);
                result = { success: true, valid, word: action.word.toUpperCase() };
                break;
            }
        }
        return { ...result, gameState };
    }

    startGame(4, 'english');

    return {
        dispatch,
        getState: () => gameState,
        dictionary: dict,
        /** Test/debug hook: set a player's rack directly. Not reachable through dispatch(). */
        debugSetRack(playerId, rack) {
            gameState[`player${playerId}`].rack = [...rack];
        },
    };
}
