// Simple in-memory store for game state
let gameState = {
  board: [],
  viewportCenter: { row: 7, col: 7 },
  pendingMoves: [], // Store moves from mobile to be processed
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
              // Store the pending move
              gameState.pendingMoves.push(data);
              
              // Apply the move to the board immediately for mobile view
              const { row, col, letter, playerId } = data;
              if (gameState.board[row] && gameState.board[row][col]) {
                gameState.board[row][col].letter = letter;
                gameState.board[row][col].isNew = true;
                gameState.board[row][col].locked = false;
              }
              
              // Remove from player rack
              const playerKey = playerId === '1' ? 'player1' : 'player2';
              if (gameState[playerKey] && data.rackIndex !== undefined) {
                gameState[playerKey].rack[data.rackIndex] = null;
              }
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Tile placed' }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        } else if (req.url === '/api/pending-moves' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ moves: gameState.pendingMoves }));
          return;
        } else if (req.url === '/api/clear-pending-moves' && req.method === 'POST') {
          gameState.pendingMoves = [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }
        next();
      });
    }
  };
}
