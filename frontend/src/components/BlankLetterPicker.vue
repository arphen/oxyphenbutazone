<template>
  <div class="blank-picker-overlay" @click.self="$emit('cancel')">
    <div class="blank-picker">
      <div class="picker-header">
        <h3>Choose Letter for Blank</h3>
        <button @click="$emit('cancel')" class="close-btn">✕</button>
      </div>
      
      <div class="letter-grid">
        <button
          v-for="letter in letters"
          :key="letter"
          @click="selectLetter(letter)"
          class="letter-btn"
        >
          {{ letter }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BlankLetterPicker',
  emits: ['select', 'cancel'],
  data() {
    return {
      letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    };
  },
  methods: {
    selectLetter(letter) {
      this.$emit('select', letter.toLowerCase());
    }
  }
};
</script>

<style scoped>
.blank-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.blank-picker {
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.picker-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #e4e4e7;
  font-weight: 700;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.1);
}

.letter-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.letter-btn {
  aspect-ratio: 1;
  background: linear-gradient(135deg, rgba(254, 240, 138, 0.9), rgba(252, 211, 77, 0.9));
  border: 2px solid rgba(161, 98, 7, 0.6);
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  color: #1a1a2e;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.letter-btn:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 6px 16px rgba(254, 240, 138, 0.5);
  background: linear-gradient(135deg, rgba(254, 240, 138, 1), rgba(252, 211, 77, 1));
}

.letter-btn:active {
  transform: translateY(-1px) scale(1.02);
}

@media (max-width: 480px) {
  .blank-picker {
    padding: 20px;
  }
  
  .letter-grid {
    gap: 6px;
  }
  
  .letter-btn {
    font-size: 1rem;
  }
}
</style>