
import { gameApiPlugin } from '../frontend/vite-plugin-game-api-v2.js';

// Mock server and request/response
const mockServer = {
    middlewares: {
        use: (handler) => {
            mockHandler = handler;
        }
    }
};

let mockHandler = null;
const plugin = gameApiPlugin();
plugin.configureServer(mockServer);

async function sendRequest(url, method, body) {
    return new Promise((resolve, reject) => {
        const req = {
            url,
            method,
            headers: { host: 'localhost' },
            on: (event, callback) => {
                if (event === 'data') callback(JSON.stringify(body));
                if (event === 'end') callback();
            }
        };

        const res = {
            setHeader: () => { },
            end: (data) => resolve(JSON.parse(data)),
            statusCode: 200
        };

        mockHandler(req, res, () => { });
    });
}

async function test() {
    console.log('Starting test...');

    // 1. Restart game
    await sendRequest('/api/action', 'POST', { type: 'restart', playerCount: 2 });

    // 2. Get game state to find a player with a blank tile (or force one)
    let gameState = await sendRequest('/api/game-state', 'GET');

    // Force player 1 to have a blank tile and 'A'
    // We can't easily force rack via API without reorder-rack hack or modifying state directly
    // But we can use reorder-rack to set the rack if we know the structure?
    // No, reorder-rack only reorders existing tiles.

    // However, I can modify the plugin code to export the gameState for testing? 
    // Or I can just trust my analysis.

    // Let's try to place a blank tile using the API.
    // We need to know if player 1 has a blank.
    // If not, we can't play it.

    // Actually, handlePlaceTile checks if the tile is in the rack?
    // No! handlePlaceTile does NOT check if the letter is in the rack!
    // It only checks:
    // if (rackIndex < 0 || rackIndex >= player.rack.length)
    // And then:
    // player.rack.splice(rackIndex, 1);

    // It does NOT verify that player.rack[rackIndex] === letter.
    // This is a security flaw, but useful for testing.

    console.log('Placing blank tile as X...');
    // Place blank (letter='') at 7,7 (center) as 'x'
    await sendRequest('/api/action', 'POST', {
        type: 'place-tile',
        playerId: '1',
        letter: '',
        rackIndex: 0,
        row: 7,
        col: 7,
        chosenLetter: 'x'
    });

    // Place 'I' at 7,8
    await sendRequest('/api/action', 'POST', {
        type: 'place-tile',
        playerId: '1',
        letter: 'i',
        rackIndex: 0,
        row: 7,
        col: 8
    });

    // Play word "XI"
    console.log('Playing word XI...');
    await sendRequest('/api/action', 'POST', {
        type: 'play-word',
        playerId: '1'
    });

    // Now Player 2's turn.
    // Play "AX" using the existing X at 7,7.

    console.log('Player 2 placing A at 6,7...');
    await sendRequest('/api/action', 'POST', {
        type: 'place-tile',
        playerId: '2',
        letter: 'a',
        rackIndex: 0,
        row: 6,
        col: 7
    });

    console.log('Playing word AX...');
    const result = await sendRequest('/api/action', 'POST', {
        type: 'play-word',
        playerId: '2'
    });

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
        const history = result.gameState.player2.history;
        const lastMove = history[history.length - 1];
        console.log('Score:', lastMove.totalScore);
        console.log('Words:', lastMove.words);
    } else {
        console.log('Play failed:', result.error);
    }
}

test().catch(console.error);
