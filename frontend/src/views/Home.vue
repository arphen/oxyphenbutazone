<template>
  <div id="home">
    <div class="home-container">
      <h1 class="game-title">Oxyphenbutazone</h1>
      <p class="game-subtitle">Choose Your Mode</p>
      
      <div class="mode-cards">
        <div class="mode-card game-mode-card">
          <div class="mode-icon">🎮</div>
          <h2>Regular Game</h2>
          <p>Competitive mode with turns, scoring, and mobile rack support</p>
          
          <!-- Player Count Selector -->
          <div class="player-selector">
            <div class="player-selector-label">Number of Players:</div>
            <div class="player-buttons">
              <button 
                v-for="num in [2, 3, 4]" 
                :key="num"
                class="player-count-btn"
                :class="{ active: selectedPlayerCount === num }"
                @click.stop="selectedPlayerCount = num"
              >
                <span class="player-count-number">{{ num }}</span>
                <span class="player-count-icon">{{ '👤'.repeat(num) }}</span>
              </button>
            </div>
          </div>
          
          <!-- Language Selector: fixed for the whole game -->
          <div class="player-selector">
            <div class="player-selector-label">Language (tiles &amp; dictionary):</div>
            <div class="player-buttons">
              <button
                v-for="lang in languages"
                :key="lang.id"
                class="player-count-btn"
                :class="{ active: selectedLanguage === lang.id }"
                @click.stop="selectedLanguage = lang.id"
              >
                <span class="player-count-number">{{ lang.flag }}</span>
                <span class="player-count-icon">{{ lang.label }}</span>
              </button>
            </div>
          </div>

          <button @click="goToGame" class="mode-button">
            Start {{ selectedPlayerCount }}-Player Game
          </button>
        </div>
        
        <div v-if="!hasLaptopHost" class="mode-card game-mode-card">
          <div class="mode-icon">📱</div>
          <h2>Play with a friend</h2>
          <p>Two phones, no server, no internet needed once installed. One hosts, the other joins.</p>
          <button class="mode-button" @click="$router.push('/host')">Host a game</button>
          <button class="mode-button" @click="$router.push('/join')">Join a game</button>
        </div>

        <div class="mode-card" @click="goToFreePlay">
          <div class="mode-icon">🎨</div>
          <h2>Free Play</h2>
          <p>Unlimited tile placement to explore words, prefixes, and suffixes</p>
          <button class="mode-button">Start Free Play</button>
        </div>
        
        <div class="mode-card" @click="goToFlashcards">
          <div class="mode-icon">📚</div>
          <h2>Word Practice</h2>
          <p>Learn words with flashcards and practice scenarios</p>
          <button class="mode-button">Practice Words</button>
        </div>

        <div class="mode-card" @click="goToPractice">
          <div class="mode-icon">🧩</div>
          <h2>Scenarios</h2>
          <p>Solve specific board puzzles and find the best moves</p>
          <button class="mode-button">Solve Puzzles</button>
        </div>
        
        <div class="mode-card" @click="goToOddOneOut">
          <div class="mode-icon">🕵️</div>
          <h2>Odd One Out</h2>
          <p>Find the invalid word among valid ones</p>
          <button class="mode-button">Play Now</button>
        </div>

        <div class="mode-card" @click="goToHistory">
          <div class="mode-icon">�</div>
          <h2>Game History</h2>
          <p>Review and analyze your past games move by move</p>
          <button class="mode-button">View History</button>
        </div>
      </div>

      <p v-if="!hasLaptopHost" class="footer-link">
        <a href="#/words" @click.prevent="$router.push('/words')">Word lists</a>
      </p>
    </div>
  </div>
</template>

<script>
import { resolveMode } from '../net/mode';

export default {
  name: 'Home',
  data() {
    return {
      selectedPlayerCount: 4, // Default to 4 players
      hasLaptopHost: resolveMode() === 'http', // odd-one-out multiplayer needs the dev server
      selectedLanguage: 'english',
      languages: [
        { id: 'english', flag: '🇬🇧', label: 'English' },
        { id: 'slovenian', flag: '🇸🇮', label: 'Slovenščina' },
      ],
    };
  },
  methods: {
    goToGame() {
      this.$router.push({
        path: '/game',
        query: { 
          players: this.selectedPlayerCount,
          language: this.selectedLanguage,
          newGame: 'true'
        }
      });
    },
    goToFreePlay() {
      this.$router.push('/freeplay');
    },
    goToFlashcards() {
      this.$router.push('/flashcards');
    },
    goToPractice() {
      this.$router.push('/practice');
    },
    goToOddOneOut() {
      this.$router.push('/odd-one-out');
    },
    goToHistory() {
      this.$router.push('/history');
    }
  }
};
</script>

<style scoped>
#home {
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e4e4e7;
  padding: 20px;
}

.home-container {
  max-width: 1000px;
  width: 100%;
  text-align: center;
}

.game-title {
  font-size: 4rem;
  font-weight: 700;
  margin: 0 0 10px 0;
  background: linear-gradient(135deg, #f0e68c 0%, #daa520 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 20px rgba(218, 165, 32, 0.3);
}

.game-subtitle {
  font-size: 1.5rem;
  color: #a1a1aa;
  margin: 0 0 50px 0;
  text-transform: uppercase;
  letter-spacing: 3px;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-top: 40px;
}

.mode-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 40px 30px;
  transition: all 0.3s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.mode-card:not(.game-mode-card) {
  cursor: pointer;
}

.mode-card:not(.game-mode-card):hover {
  transform: translateY(-10px);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.2);
}

.game-mode-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
}

.mode-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.mode-card h2 {
  font-size: 1.8rem;
  margin: 0 0 15px 0;
  color: #e4e4e7;
}

.mode-card p {
  color: #a1a1aa;
  line-height: 1.6;
  margin: 0 0 30px 0;
  min-height: 60px;
}

.mode-button {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  color: white;
  padding: 12px 30px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.mode-button:hover {
  transform: scale(1.05);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
}

.player-selector {
  margin: 25px 0;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.player-selector-label {
  font-size: 0.95rem;
  color: #a1a1aa;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

.player-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.player-count-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: #a1a1aa;
  padding: 15px 10px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.player-count-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.5s ease;
}

.player-count-btn:hover::before {
  left: 100%;
}

.player-count-btn:hover {
  transform: translateY(-5px);
  border-color: rgba(59, 130, 246, 0.5);
  color: #e4e4e7;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.player-count-btn.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.3));
  border-color: rgba(59, 130, 246, 0.8);
  color: #fff;
  transform: translateY(-3px);
  box-shadow: 
    0 10px 25px rgba(59, 130, 246, 0.4),
    0 0 0 4px rgba(59, 130, 246, 0.1);
  animation: activeGlow 2s ease-in-out infinite;
}

@keyframes activeGlow {
  0%, 100% {
    box-shadow: 
      0 10px 25px rgba(59, 130, 246, 0.4),
      0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  50% {
    box-shadow: 
      0 15px 35px rgba(59, 130, 246, 0.5),
      0 0 0 6px rgba(59, 130, 246, 0.2);
  }
}

.player-count-number {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}

.player-count-icon {
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.7;
}

.player-count-btn.active .player-count-icon {
  opacity: 1;
  animation: bounce 0.6s ease;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.footer-link {
  margin: 30px 0 0;
  font-size: 0.95rem;
}

.footer-link a {
  color: #93c5fd;
}

@media (max-width: 768px) {
  .game-title {
    font-size: 3rem;
  }
  
  .game-subtitle {
    font-size: 1.2rem;
  }
  
  .mode-cards {
    grid-template-columns: 1fr;
  }
  
  .player-buttons {
    gap: 8px;
  }
  
  .player-count-btn {
    padding: 12px 8px;
  }
  
  .player-count-number {
    font-size: 1.5rem;
  }
  
  .player-count-icon {
    font-size: 1rem;
  }
}
</style>
