// Simple in-memory store for game state
let gameState = {
  board: [],
  viewportCenter: { row: 7, col: 7 },
  player1: {
    playerName: 'Player 1',
    rack: [],
    score: 0,
    isCurrentPlayer: true
  },
  player2: {
    playerName: 'Player 2',
    rack: [],
    score: 0,
    isCurrentPlayer: false
  },
  pendingPlayRequest: null // Will be set to playerId when play is requested
};

export function gameApiPlugin() {
  return {
    name: 'game-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/api/rack/')) {
          const playerId = req.url.split('/api/rack/')[1];

          if (playerId === '1' || playerId === 'player1') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ...gameState.player1,
              board: gameState.board,
              viewportCenter: gameState.viewportCenter,
              pendingPlayRequest: gameState.pendingPlayRequest
            }));
            return;
          } else if (playerId === '2' || playerId === 'player2') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ...gameState.player2,
              board: gameState.board,
              viewportCenter: gameState.viewportCenter,
              pendingPlayRequest: gameState.pendingPlayRequest
            }));
            return;
          }
        } else if (req.url === '/api/game-state' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.player1) gameState.player1 = data.player1;
              if (data.player2) gameState.player2 = data.player2;
              if (data.board) gameState.board = data.board;
              if (data.viewportCenter) gameState.viewportCenter = data.viewportCenter;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        } else if (req.url === '/api/place-tile' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { playerId, letter, rackIndex, row, col } = data;

              // Place tile on board
              if (gameState.board && gameState.board[row] && gameState.board[row][col]) {
                gameState.board[row][col].letter = letter;
                gameState.board[row][col].isNew = true;
              }

              // Remove tile from player's rack
              const player = playerId === '1' || playerId === 'player1' ? gameState.player1 : gameState.player2;
              if (player.rack && player.rack.length > rackIndex) {
                player.rack.splice(rackIndex, 1);
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Tile placed successfully' }));
            } catch (e) {
              console.error('Error placing tile:', e);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        } else if (req.url === '/api/play-word' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const playerId = data.playerId;

              // Set pending play request flag
              gameState.pendingPlayRequest = playerId;

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Play word request sent' }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        } else if (req.url === '/api/clear-play-request' && req.method === 'POST') {
          // Called by desktop after processing the play request
          gameState.pendingPlayRequest = null;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        } else if (req.url === '/api/recall-tiles' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const playerId = data.playerId;

              // Move all new tiles back to rack
              const player = playerId === '1' || playerId === 'player1' ? gameState.player1 : gameState.player2;

              for (let row = 0; row < gameState.board.length; row++) {
                for (let col = 0; col < gameState.board[row].length; col++) {
                  const square = gameState.board[row][col];
                  if (square.isNew && square.letter) {
                    // Add letter back to rack
                    player.rack.push(square.letter);
                    // Clear the square
                    square.letter = '';
                    square.isNew = false;
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Tiles recalled' }));
            } catch (e) {
              console.error('Error recalling tiles:', e);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}
