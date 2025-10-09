<template>
  <div class="dictionary-chooser">
    <button @click="toggleDropdown" class="icon-button" title="Choose Dictionary">
      📚
    </button>
    
    <div v-if="showDropdown" class="dropdown-panel">
      <div class="dropdown-header">Dictionary</div>
      <label class="checkbox-item">
        <input type="checkbox" v-model="sowpodsEnabled" @change="handleChange" />
        <span>SOWPODS</span>
      </label>
      <label class="checkbox-item">
        <input type="checkbox" v-model="twlEnabled" @change="handleChange" />
        <span>TWL</span>
      </label>
      <div class="dictionary-info">
        <span v-if="sowpodsEnabled && twlEnabled">Using union of both</span>
        <span v-else-if="sowpodsEnabled">Using SOWPODS</span>
        <span v-else-if="twlEnabled">Using TWL</span>
        <span v-else class="warning">⚠️ Select at least one</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DictionaryChooser',
  props: {
    selectedDictionaries: {
      type: Object,
      default: () => ({ sowpods: true, twl: false })
    }
  },
  data() {
    return {
      showDropdown: false,
      sowpodsEnabled: this.selectedDictionaries.sowpods,
      twlEnabled: this.selectedDictionaries.twl
    };
  },
  methods: {
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    handleChange() {
      this.$emit('update', {
        sowpods: this.sowpodsEnabled,
        twl: this.twlEnabled
      });
    }
  },
  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.$el.contains(e.target)) {
        this.showDropdown = false;
      }
    });
  }
};
</script>

<style scoped>
.dictionary-chooser {
  position: relative;
}

.icon-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e4e4e7;
  padding: 10px 15px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.icon-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.dropdown-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 5px;
  background: rgba(30, 30, 50, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-header {
  font-size: 0.9rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  cursor: pointer;
  color: #e4e4e7;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}

.checkbox-item:hover {
  color: #60a5fa;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.dictionary-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
  color: #a1a1aa;
  font-style: italic;
}

.dictionary-info .warning {
  color: #fbbf24;
}
</style>
