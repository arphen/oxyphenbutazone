import { ref } from 'vue';
import { debug, warn, error } from '../utils/log';

/**
 * Game Persistence Composable
 * 
 * Handles saving and loading games to localStorage (currently) and can be extended
 * to support backend database storage. Stores complete game history including:
 * - Move-by-move history with board states
 * - Player racks at each move
 * - Scores and score deltas
 * - Timestamps
 * - Game metadata
 */

const STORAGE_KEY = 'oxyphenbutazone_games';
const CURRENT_GAME_KEY = 'oxyphenbutazone_current_game';

export function useGamePersistence() {
    const currentGameId = ref(null);

    /**
     * Initialize a new game session
     */
    const startNewGame = (gameState) => {
        const gameId = generateGameId();
        currentGameId.value = gameId;

        const gameData = {
            id: gameId,
            startedAt: new Date().toISOString(),
            lastMoveAt: new Date().toISOString(),
            status: 'in-progress', // in-progress, completed, abandoned
            moves: [],
            initialState: captureGameSnapshot(gameState),
            metadata: {
                player1Name: gameState.player1?.playerName || 'Player 1',
                player2Name: gameState.player2?.playerName || 'Player 2',
                dictionary: gameState.dictionary || { sowpods: true, twl: false }
            }
        };

        // Save to localStorage
        localStorage.setItem(CURRENT_GAME_KEY, JSON.stringify({ id: gameId, data: gameData }));

        return gameId;
    };

    /**
     * Record a move in the current game
     */
    const recordMove = (moveData) => {
        if (!currentGameId.value) {
            warn('[GamePersistence] No active game to record move');
            return;
        }

        const currentGame = getCurrentGame();
        if (!currentGame) {
            error('[GamePersistence] Current game not found');
            return;
        }

        const move = {
            moveNumber: currentGame.moves.length + 1,
            timestamp: new Date().toISOString(),
            ...moveData
        };

        currentGame.moves.push(move);
        currentGame.lastMoveAt = move.timestamp;

        // Update in localStorage
        localStorage.setItem(CURRENT_GAME_KEY, JSON.stringify({
            id: currentGameId.value,
            data: currentGame
        }));

        debug(`[GamePersistence] Recorded move ${move.moveNumber}`, move);
    };

    /**
     * Save a complete move with all context
     */
    const saveMove = (gameState, action, metadata = {}) => {
        debug('[GamePersistence] saveMove called with:', {
            action,
            hasBoardInGameState: !!gameState?.board,
            boardLength: gameState?.board?.length,
            player1: gameState?.player1,
            player2: gameState?.player2,
            metadata
        });

        // Ensure we have a current game
        if (!currentGameId.value) {
            error('[GamePersistence] saveMove called but no currentGameId! Attempting to recover...');
            // Try to get from localStorage
            const stored = getCurrentGame();
            if (!stored) {
                error('[GamePersistence] Cannot save move - no game session found. Creating new game...');
                startNewGame(gameState);
            }
        }

        const playerId = metadata.playerId || gameState.currentPlayer;
        const player = playerId === 1 || playerId === '1' ? gameState.player1 : gameState.player2;

        const moveData = {
            playerId: String(playerId),
            action: action, // 'play-word', 'pass', 'exchange', 'recall'

            // Board state before move (if tiles were placed)
            boardStateBefore: metadata.boardStateBefore || null,

            // Board snapshot after move
            boardState: captureBoard(gameState.board),

            // Tiles placed (for play-word actions)
            tilesPlaced: metadata.tilesPlaced || [],

            // Player state before move
            rackBefore: metadata.rackBefore || [],

            // Player state after move
            rackAfter: [...(player?.rack || [])],
            scoreBefore: metadata.scoreBefore || 0,
            scoreAfter: player?.score || 0,
            scoreDelta: (player?.score || 0) - (metadata.scoreBefore || 0),

            // Words formed
            wordsFormed: metadata.wordsFormed || [],

            // Validation result
            valid: metadata.valid !== false,

            // For exchange actions
            tilesExchanged: metadata.tilesExchanged || null,

            // Message/result
            message: gameState.message || null,

            // Full game state snapshot (for replay)
            gameStateSnapshot: captureGameSnapshot(gameState)
        };

        debug('[GamePersistence] saveMove:', {
            action,
            playerId: moveData.playerId,
            scoreDelta: moveData.scoreDelta,
            currentGameId: currentGameId.value
        });

        recordMove(moveData);
    };

    /**
     * Mark current game as completed
     */
    const completeGame = (finalGameState) => {
        if (!currentGameId.value) {
            warn('[GamePersistence] No current game ID to complete');
            return;
        }

        const currentGame = getCurrentGame();
        if (!currentGame) {
            warn('[GamePersistence] Current game not found');
            return;
        }

        // Check if already completed to avoid duplicate processing
        if (currentGame.status === 'completed') {
            debug('[GamePersistence] Game already completed, skipping');
            return;
        }

        currentGame.status = 'completed';
        currentGame.completedAt = new Date().toISOString();
        currentGame.finalState = captureGameSnapshot(finalGameState);
        currentGame.metadata.finalScore1 = finalGameState.player1?.score || 0;
        currentGame.metadata.finalScore2 = finalGameState.player2?.score || 0;
        currentGame.metadata.winner = finalGameState.winner || null;

        debug(`[GamePersistence] Completing game ${currentGame.id}:`, {
            moves: currentGame.moves.length,
            status: currentGame.status,
            finalScore1: currentGame.metadata.finalScore1,
            finalScore2: currentGame.metadata.finalScore2,
            winner: currentGame.metadata.winner
        });

        // Move from current game to saved games
        saveToHistory(currentGame);

        // Clear current game
        localStorage.removeItem(CURRENT_GAME_KEY);
        currentGameId.value = null;

        debug(`[GamePersistence] Game saved to history. Total games:`, getAllGames().length);
    };

    /**
     * Save game to history
     */
    const saveToHistory = (gameData) => {
        const games = getAllGames();

        // Check if game already exists (update it)
        const existingIndex = games.findIndex(g => g.id === gameData.id);
        if (existingIndex >= 0) {
            debug(`[GamePersistence] Updating existing game in history at index ${existingIndex}`);
            games[existingIndex] = gameData;
        } else {
            debug(`[GamePersistence] Adding new game to history`);
            games.push(gameData);
        }

        // Sort by date (most recent first)
        games.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

        // Store in localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
            debug(`[GamePersistence] Successfully saved ${games.length} games to localStorage`);
        } catch (error) {
            error('[GamePersistence] Error saving to localStorage:', error);
        }
    };

    /**
     * Get all saved games
     */
    const getAllGames = () => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            error('[GamePersistence] Error loading games:', e);
            return [];
        }
    };

    /**
     * Get a specific game by ID
     */
    const getGame = (gameId) => {
        const games = getAllGames();
        return games.find(g => g.id === gameId);
    };

    /**
     * Get current active game
     */
    const getCurrentGame = () => {
        try {
            const data = localStorage.getItem(CURRENT_GAME_KEY);
            if (!data) return null;

            const { id, data: gameData } = JSON.parse(data);
            currentGameId.value = id;
            return gameData;
        } catch (e) {
            error('[GamePersistence] Error loading current game:', e);
            return null;
        }
    };

    /**
     * Resume a game (set it as current)
     */
    const resumeGame = (gameId) => {
        const game = getGame(gameId);
        if (!game) return null;

        currentGameId.value = gameId;
        localStorage.setItem(CURRENT_GAME_KEY, JSON.stringify({ id: gameId, data: game }));

        return game;
    };

    /**
     * Delete a game from history
     */
    const deleteGame = (gameId) => {
        const games = getAllGames();
        const filtered = games.filter(g => g.id !== gameId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

        // If deleting current game, clear it
        if (currentGameId.value === gameId) {
            localStorage.removeItem(CURRENT_GAME_KEY);
            currentGameId.value = null;
        }
    };

    /**
     * Clear all game history
     */
    const clearAllGames = () => {
        if (confirm('Are you sure you want to delete all saved games? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CURRENT_GAME_KEY);
            currentGameId.value = null;
            return true;
        }
        return false;
    };

    /**
     * Export game data (for future backend sync)
     */
    const exportGame = (gameId) => {
        const game = getGame(gameId);
        if (!game) return null;

        return {
            ...game,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    };

    /**
     * Helper: Capture a snapshot of the game state
     */
    const captureGameSnapshot = (gameState) => {
        const capturedBoard = captureBoard(gameState.board);
        debug('[GamePersistence] captureGameSnapshot:', {
            inputBoardExists: !!gameState?.board,
            inputBoardLength: gameState?.board?.length,
            capturedBoardLength: capturedBoard?.length,
            player1Rack: gameState.player1?.rack,
            player2Rack: gameState.player2?.rack
        });

        return {
            board: capturedBoard,
            player1: {
                score: gameState.player1?.score || 0,
                rack: [...(gameState.player1?.rack || [])],
                isCurrentPlayer: gameState.player1?.isCurrentPlayer || false
            },
            player2: {
                score: gameState.player2?.score || 0,
                rack: [...(gameState.player2?.rack || [])],
                isCurrentPlayer: gameState.player2?.isCurrentPlayer || false
            },
            currentPlayer: gameState.currentPlayer,
            message: gameState.message || null,
            gameOver: gameState.gameOver || false
        };
    };

    /**
     * Helper: Capture board state (only essential data)
     */
    const captureBoard = (board) => {
        if (!board) {
            warn('[GamePersistence] captureBoard: board is null/undefined');
            return [];
        }

        if (!Array.isArray(board) || board.length === 0) {
            warn('[GamePersistence] captureBoard: board is empty or not an array', board);
            return [];
        }

        const captured = board.map(row =>
            row.map(cell => ({
                letter: cell.letter || null,
                isBlank: cell.isBlank || false,
                chosenLetter: cell.chosenLetter || null,
                locked: cell.locked || false,
                isNew: cell.isNew || false,
                type: cell.type || 'normal'
            }))
        );

        debug('[GamePersistence] captureBoard: captured', captured.length, 'rows');
        return captured;
    };

    /**
     * Helper: Generate unique game ID
     */
    const generateGameId = () => {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Try to load current game on init
    const currentGame = getCurrentGame();
    if (currentGame) {
        debug(`[GamePersistence] Resumed game ${currentGameId.value}`);
    }

    return {
        currentGameId,
        startNewGame,
        saveMove,
        recordMove,
        completeGame,
        getAllGames,
        getGame,
        getCurrentGame,
        resumeGame,
        deleteGame,
        clearAllGames,
        exportGame
    };
}
