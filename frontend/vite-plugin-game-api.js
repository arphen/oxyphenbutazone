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
  }
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
              viewportCenter: gameState.viewportCenter
            }));
            return;
          } else if (playerId === '2' || playerId === 'player2') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ...gameState.player2,
              board: gameState.board,
              viewportCenter: gameState.viewportCenter
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
              const player = playerId === '1' ? gameState.player1 : gameState.player2;
              if (player.rack && player.rack.length > rackIndex) {
                player.rack.splice(rackIndex, 1);
              }
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Tile placed successfully' }));
            } catch (e) {
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
