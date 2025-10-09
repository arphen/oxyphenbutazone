<template>
  <div id="home">
    <div class="home-container">
      <h1 class="game-title">Scrabble</h1>
      <p class="game-subtitle">Choose Your Mode</p>
      
      <div class="mode-cards">
        <div class="mode-card" @click="goToGame">
          <div class="mode-icon">🎮</div>
          <h2>Regular Game</h2>
          <p>Two-player competitive mode with turns, scoring, and mobile rack support</p>
          <button class="mode-button">Start Game</button>
        </div>
        
        <div class="mode-card" @click="goToFreePlay">
          <div class="mode-icon">🎨</div>
          <h2>Free Play</h2>
          <p>Unlimited tile placement to explore words, prefixes, and suffixes</p>
          <button class="mode-button">Start Free Play</button>
        </div>
        
        <div class="mode-card" @click="goToHistory">
          <div class="mode-icon">📚</div>
          <h2>Game History</h2>
          <p>Review and analyze your past games move by move</p>
          <button class="mode-button">View History</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  methods: {
    goToGame() {
      this.$router.push('/game');
    },
    goToFreePlay() {
      this.$router.push('/freeplay');
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
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.mode-card:hover {
  transform: translateY(-10px);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.2);
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
}
</style>
