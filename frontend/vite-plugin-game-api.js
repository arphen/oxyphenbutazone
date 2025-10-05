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

              console.log('[API] Place tile request:', { playerId, letter, rackIndex, row, col });
              console.log('[API] Current board exists?', !!gameState.board);
              console.log('[API] Board dimensions:', gameState.board?.length, 'x', gameState.board?.[0]?.length);

              // Place tile on board
              if (gameState.board && gameState.board[row] && gameState.board[row][col]) {
                console.log('[API] Board cell before:', gameState.board[row][col]);
                gameState.board[row][col].letter = letter;
                gameState.board[row][col].isNew = true;
                console.log('[API] Board cell after:', gameState.board[row][col]);
              } else {
                console.error('[API] Invalid board position:', row, col);
              }

              // Remove tile from player's rack
              const player = playerId === '1' || playerId === 'player1' ? gameState.player1 : gameState.player2;
              console.log('[API] Player rack before:', player.rack);
              if (player.rack && player.rack.length > rackIndex) {
                player.rack.splice(rackIndex, 1);
                console.log('[API] Player rack after:', player.rack);
              } else {
                console.error('[API] Invalid rack index:', rackIndex, 'rack length:', player.rack?.length);
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Tile placed successfully' }));
            } catch (e) {
              console.error('[API] Error placing tile:', e);
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
