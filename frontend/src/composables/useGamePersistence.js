import { ref } from 'vue';
import { debug, logWarn, logError } from '../utils/log';

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
// Envelope version for both keys. Unknown versions are discarded (safe
// fallback to "no saved games") rather than trusted: storage is untrusted
// input and may hold a half-write from a crash or a newer format.
const SCHEMA_VERSION = 1;

/** Best-effort localStorage write: a full/quota-blocked store must never break playing. */
function trySet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        logWarn('[GamePersistence] Could not write to storage:', error?.message);
        return false;
    }
}

function safeParse(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** A stored game needs at least an id and a moves array; anything else is corruption, not a game. */
function isGameData(data) {
    return !!data && typeof data === 'object' && typeof data.id === 'string' && Array.isArray(data.moves);
}

/** Unwrap { v, games } (current) or a bare array (saves from before envelopes). */
function unwrapHistory(parsed) {
    if (Array.isArray(parsed)) return parsed.filter(isGameData);
    if (parsed && typeof parsed === 'object' && parsed.v === SCHEMA_VERSION && Array.isArray(parsed.games)) {
        return parsed.games.filter(isGameData);
    }
    return null; // unknown version or shape: caller falls back to []
}

/** Unwrap { v, id, data } (current) or { id, data } (legacy). Returns { id, data } or null. */
function unwrapCurrent(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed.v === undefined ? { v: SCHEMA_VERSION, ...parsed } : parsed;
    if (envelope.v !== SCHEMA_VERSION || typeof envelope.id !== 'string' || !isGameData(envelope.data)) return null;
    return { id: envelope.id, data: envelope.data };
}

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
                dictionary: gameState.dictionaries || { csw21: true, nwl2023: false, enable: false, friendly: false, slovenian: false },
                language: gameState.language || 'english'
            }
        };

        // Save to localStorage (best-effort: the game in memory keeps working when storage is full)
        trySet(CURRENT_GAME_KEY, JSON.stringify({ v: SCHEMA_VERSION, id: gameId, data: gameData }));

        return gameId;
    };

    /**
     * Record a move in the current game
     */
    const recordMove = (moveData) => {
        if (!currentGameId.value) {
            logWarn('[GamePersistence] No active game to record move');
            return;
        }

        const currentGame = getCurrentGame();
        if (!currentGame) {
            logError('[GamePersistence] Current game not found');
            return;
        }

        const move = {
            moveNumber: currentGame.moves.length + 1,
            timestamp: new Date().toISOString(),
            ...moveData
        };

        currentGame.moves.push(move);
        currentGame.lastMoveAt = move.timestamp;

        // Update in localStorage (best-effort: a refresh may lose this move when storage is full, nothing else)
        trySet(CURRENT_GAME_KEY, JSON.stringify({
            v: SCHEMA_VERSION,
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
            logError('[GamePersistence] saveMove called but no currentGameId! Attempting to recover...');
            // Try to get from localStorage
            const stored = getCurrentGame();
            if (!stored) {
                logError('[GamePersistence] Cannot save move - no game session found. Creating new game...');
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
            logWarn('[GamePersistence] No current game ID to complete');
            return;
        }

        const currentGame = getCurrentGame();
        if (!currentGame) {
            logWarn('[GamePersistence] Current game not found');
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
        try {
            localStorage.removeItem(CURRENT_GAME_KEY);
        } catch {
            /* storage unavailable */
        }
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

        // Store in localStorage (best-effort)
        try {
            trySet(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, games }));
            debug(`[GamePersistence] Successfully saved ${games.length} games to localStorage`);
        } catch (error) {
            logError('[GamePersistence] Error saving to localStorage:', error);
        }
    };

    /**
     * Get all saved games (never throws; corruption falls back to whatever is still valid)
     */
    const getAllGames = () => {
        try {
            const games = unwrapHistory(safeParse(localStorage.getItem(STORAGE_KEY)));
            return games ?? [];
        } catch (e) {
            logError('[GamePersistence] Error loading games:', e);
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
     * Get current active game (null when absent or corrupt; corruption is quarantined so a fresh game can start)
     */
    const getCurrentGame = () => {
        try {
            const data = localStorage.getItem(CURRENT_GAME_KEY);
            if (!data) return null;

            const current = unwrapCurrent(safeParse(data));
            if (!current) {
                logWarn('[GamePersistence] Stored current game is corrupt or from another version; starting fresh');
                try {
                    localStorage.removeItem(CURRENT_GAME_KEY);
                } catch {
                    /* ignore */
                }
                return null;
            }
            currentGameId.value = current.id;
            return current.data;
        } catch (e) {
            logError('[GamePersistence] Error loading current game:', e);
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
        trySet(CURRENT_GAME_KEY, JSON.stringify({ v: SCHEMA_VERSION, id: gameId, data: game }));

        return game;
    };

    /**
     * Delete a game from history
     */
    const deleteGame = (gameId) => {
        const games = getAllGames();
        const filtered = games.filter(g => g.id !== gameId);
        trySet(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, games: filtered }));

        // If deleting current game, clear it
        if (currentGameId.value === gameId) {
            try {
                localStorage.removeItem(CURRENT_GAME_KEY);
            } catch {
                /* ignore */
            }
            currentGameId.value = null;
        }
    };

    /**
     * Clear all game history
     */
    const clearAllGames = () => {
        if (typeof confirm === 'function' && !confirm('Are you sure you want to delete all saved games? This cannot be undone.')) {
            return false;
        }
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CURRENT_GAME_KEY);
        } catch {
            /* storage unavailable */
        }
        currentGameId.value = null;
        return true;
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
            logWarn('[GamePersistence] captureBoard: board is null/undefined');
            return [];
        }

        if (!Array.isArray(board) || board.length === 0) {
            logWarn('[GamePersistence] captureBoard: board is empty or not an array', board);
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
