# Scrabble Trainer - Two-Player Game

A full-featured two-player Scrabble game with mobile rack viewing and real-time synchronization.

## Features

### Core Gameplay
- **15x15 Scrabble Board** with all premium squares (Triple Word, Double Word, Triple Letter, Double Letter)
- **Two-Player Turn System** with visual indicators
- **SOWPODS Dictionary** validation (267,751 official Scrabble words)
- **Complete Scoring System**:
  - Letter point values (1-10 points)
  - Premium square multipliers
  - BINGO bonus (+50 points for using all 7 tiles)
- **Live Score Preview** shows points before playing
- **Score History** with Excel-style modal showing turn-by-turn breakdown

### Mobile Integration
- **QR Code System** for easy mobile access
- **Mobile Rack View** with real-time sync (2-second polling)
- **5x5 Scrollable Board View** centered on clicked position
- **Drag & Drop on Mobile**:
  - Reorder tiles in your rack
  - Place tiles on the board
- **Click-to-Center** - Click any square on desktop to focus mobile view

### Technical Features
- Network-independent sync using Vite dev server API
- In-memory game state management
- Vue Router for multiple views
- Custom Vite middleware plugin

## Tech Stack

- **Frontend**: Vue.js 3, Vite, Vue Router
- **QR Codes**: qrcode-vue3
- **Dictionary**: SOWPODS wordlist (public/sowpods.txt)
- **Backend**: Django 5.2.6 (scaffolded, not currently used)
- **Styling**: Scoped CSS with gradient backgrounds

## Setup

### Prerequisites
- Node.js (v16+)
- npm

### Installation

```bash
cd frontend
npm install
```

### Running the Game

```bash
cd frontend
npm run dev
```

The game will be available at:
- **Local**: `http://localhost:5174/` (or 5175 if 5174 is in use)
- **Network**: `http://YOUR_IP:5174/`

## How to Play

### Desktop (Main Game)
1. Open `http://localhost:5174/` in your browser
2. Click "Show QR Codes" button
3. Drag letters from racks onto the board
4. Click "Play" to validate and score the word
5. Click player scores to view history

### Mobile (Rack View)
1. Scan the QR code with your phone's camera
2. Tap the notification to open the mobile view
3. See your tiles, score, and turn status
4. View a 5x5 section of the board
5. **Reorder tiles**: Drag tiles within your rack to rearrange them
6. **Place tiles**: Drag tiles from your rack onto the mini-board
7. The view auto-updates every 2 seconds

### Desktop + Mobile Together
1. Click any square on the desktop board
2. Mobile view centers on that location within 2 seconds
3. Place tiles from mobile onto the focused area
4. Continue playing seamlessly across devices

## Project Structure

```
oxyphenbutazone/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board.vue           # 15x15 game board
│   │   │   ├── Rack.vue            # Player rack display
│   │   │   ├── Controls.vue        # Play/Clear buttons
│   │   │   ├── QRDisplay.vue       # QR code generator
│   │   │   ├── ScoreHistoryModal.vue # Score tracking
│   │   │   └── MobileRackView.vue  # (old, not used)
│   │   ├── views/
│   │   │   ├── GameBoard.vue       # Main game view
│   │   │   └── PlayerRackView.vue  # Mobile rack view
│   │   ├── router/
│   │   │   └── index.js            # Route configuration
│   │   └── main.js                 # App entry point
│   ├── public/
│   │   └── sowpods.txt            # Scrabble dictionary
│   ├── vite-plugin-game-api.js    # Custom API middleware
│   └── vite.config.js             # Vite configuration
└── backend/                        # Django (not currently used)
```

## API Endpoints

The game uses a custom Vite plugin to provide these endpoints:

- `GET /api/rack/1` - Get Player 1's rack, score, board, and viewport
- `GET /api/rack/2` - Get Player 2's rack, score, board, and viewport  
- `POST /api/game-state` - Update game state from main view
- `POST /api/place-tile` - Place a tile on the board from mobile

## Game State

The game maintains state in-memory through the Vite plugin:

```javascript
{
  board: Array<Array<{ letter, type, isNew, locked }>>,
  viewportCenter: { row, col },
  player1: { playerName, rack, score, isCurrentPlayer },
  player2: { playerName, rack, score, isCurrentPlayer }
}
```

## Future Enhancements

- [ ] Persistent storage (database)
- [ ] Multi-game support with unique IDs
- [ ] Undo/redo functionality
- [ ] Computer AI opponent
- [ ] Puzzle/tactics trainer mode
- [ ] Best move detection
- [ ] WebSocket for instant sync (instead of polling)
- [ ] Sound effects and animations
- [ ] Mobile: Return tiles from board to rack

## Development

### Git

Repository initialized with:
```bash
git init
git add .
git commit -m "Initial commit"
```

### Author
Sebastian Wozny <sebastian.wozny@pm.me>

## License

Private practice project
