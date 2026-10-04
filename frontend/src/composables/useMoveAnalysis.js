/**
 * Move Analysis Composable
 * 
 * Provides functionality to analyze moves and find the best possible play
 * for a given board state and rack.
 */

import { ref } from 'vue';
import { debug, logError } from '../utils/log';

export function useMoveAnalysis() {
    const analyzing = ref(false);
    const analysisProgress = ref(0);
    const analysisError = ref(null);

    /**
     * Find the best possible move for a given rack and board state
     * 
     * This is a simplified heuristic approach that:
     * 1. Tries common word patterns
     * 2. Tests high-value positions
     * 3. Returns the highest scoring valid move found
     * 
     * @param {Array} rack - Player's tile rack
     * @param {Array} board - Current board state
     * @param {Object} gameState - Full game state for validation
     * @returns {Object} - Best move found with score, word, position
     */
    const findBestMove = async (rack, board, gameState) => {
        analyzing.value = true;
        analysisProgress.value = 0;
        analysisError.value = null;

        try {
            debug('[MoveAnalysis] Finding best move for rack:', rack);

            // Find all empty positions on the board where we could place tiles
            const placements = findValidPlacements(board);
            debug('[MoveAnalysis] Found', placements.length, 'potential placement positions');

            let bestMove = null;
            let highestScore = 0;

            // Strategy 1: Try to use all 7 tiles (bingo bonus)
            // Strategy 2: Try to use 6 tiles
            // Strategy 3: Try to use 5 tiles
            // Strategy 4: Try shorter words

            // For now, we'll use a heuristic approach:
            // Test placing tiles at premium squares and connecting to existing words

            const totalTests = Math.min(placements.length * rack.length, 100);
            let testsPerformed = 0;

            // Test each placement position with different combinations
            for (const placement of placements.slice(0, 20)) { // Limit to 20 positions
                for (let wordLength = Math.min(rack.length, 7); wordLength >= 2; wordLength--) {
                    // Try both horizontal and vertical orientations
                    for (const direction of ['horizontal', 'vertical']) {
                        const move = await testMove(
                            rack,
                            board,
                            placement.row,
                            placement.col,
                            wordLength,
                            direction,
                            gameState
                        );

                        testsPerformed++;
                        analysisProgress.value = Math.min((testsPerformed / totalTests) * 100, 99);

                        if (move && move.score > highestScore) {
                            highestScore = move.score;
                            bestMove = move;
                            debug('[MoveAnalysis] New best move found:', move);
                        }

                        // Stop if we found a bingo (7 tiles)
                        if (bestMove && bestMove.tilesUsed === 7) {
                            analysisProgress.value = 100;
                            analyzing.value = false;
                            return bestMove;
                        }
                    }
                }
            }

            analysisProgress.value = 100;
            analyzing.value = false;

            if (!bestMove) {
                debug('[MoveAnalysis] No valid moves found');
                return {
                    found: false,
                    message: 'No valid moves found. Consider passing or exchanging tiles.'
                };
            }

            return {
                found: true,
                ...bestMove
            };

        } catch (error) {
            logError('[MoveAnalysis] Error finding best move:', error);
            analysisError.value = error.message;
            analyzing.value = false;
            return {
                found: false,
                error: error.message
            };
        }
    };

    /**
     * Find all valid positions where tiles could be placed
     */
    const findValidPlacements = (board) => {
        const placements = [];

        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                const cell = board[row][col];

                // Empty cell that is either:
                // 1. Adjacent to an existing tile
                // 2. On a premium square
                // 3. The center square if board is empty
                if (!cell.letter) {
                    const hasAdjacentTile = checkAdjacentTiles(board, row, col);
                    const isPremium = cell.type !== 'normal';
                    const isCenter = row === 7 && col === 7;
                    const isEmpty = isBoardEmpty(board);

                    if (hasAdjacentTile || isPremium || (isCenter && isEmpty)) {
                        placements.push({
                            row,
                            col,
                            isPremium,
                            isCenter,
                            hasAdjacentTile
                        });
                    }
                }
            }
        }

        // Sort by priority: center > adjacent to tiles > premium squares
        placements.sort((a, b) => {
            if (a.isCenter) return -1;
            if (b.isCenter) return 1;
            if (a.hasAdjacentTile && !b.hasAdjacentTile) return -1;
            if (!a.hasAdjacentTile && b.hasAdjacentTile) return 1;
            if (a.isPremium && !b.isPremium) return -1;
            if (!a.isPremium && b.isPremium) return 1;
            return 0;
        });

        return placements;
    };

    /**
     * Check if a position has adjacent tiles
     */
    const checkAdjacentTiles = (board, row, col) => {
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1] // up, down, left, right
        ];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (newRow >= 0 && newRow < board.length &&
                newCol >= 0 && newCol < board[0].length &&
                board[newRow][newCol].letter) {
                return true;
            }
        }

        return false;
    };

    /**
     * Check if board is empty
     */
    const isBoardEmpty = (board) => {
        for (const row of board) {
            for (const cell of row) {
                if (cell.letter) return false;
            }
        }
        return true;
    };

    /**
     * Test a specific move by attempting to place tiles and validate
     * 
     * Note: This is a simplified version. For a complete implementation,
     * you would need the backend to provide a "suggest moves" API endpoint
     * that uses the game's dictionary and scoring rules.
     */
    const testMove = async (rack, board, startRow, startCol, length, direction, gameState) => {
        // For now, return null as we need backend support
        // A full implementation would:
        // 1. Generate possible letter combinations from the rack
        // 2. Place them on a test board
        // 3. Call the backend to validate and score
        // 4. Return the move if valid

        // TODO: Implement with backend support
        return null;
    };

    /**
     * Analyze a move that was actually played
     * Compare it to the best possible move
     */
    const analyzeMoveQuality = async (playedMove, rack, board, gameState) => {
        const bestMove = await findBestMove(rack, board, gameState);

        if (!bestMove.found) {
            return {
                rating: 'N/A',
                message: 'Could not determine best move'
            };
        }

        const scoreDiff = bestMove.score - playedMove.score;
        const percentage = (playedMove.score / bestMove.score) * 100;

        let rating;
        if (percentage >= 95) {
            rating = 'Excellent';
        } else if (percentage >= 80) {
            rating = 'Good';
        } else if (percentage >= 60) {
            rating = 'Okay';
        } else {
            rating = 'Weak';
        }

        return {
            rating,
            playedScore: playedMove.score,
            bestScore: bestMove.score,
            scoreDiff,
            percentage: percentage.toFixed(1),
            bestMove,
            message: scoreDiff === 0
                ? 'Perfect! You found the best move.'
                : `You could have scored ${scoreDiff} more points.`
        };
    };

    return {
        analyzing,
        analysisProgress,
        analysisError,
        findBestMove,
        analyzeMoveQuality
    };
}
