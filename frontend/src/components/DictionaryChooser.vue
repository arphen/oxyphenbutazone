<template>
  <div class="dictionary-chooser">
    <button @click="toggleDropdown" class="icon-button" title="Choose Dictionary">ABC</button>

    <div v-if="showDropdown" class="dropdown-panel">
      <div class="dropdown-header">Dictionary</div>
      <label class="checkbox-item" :class="{ unavailable: notInstalled('csw21') }">
        <input
          type="checkbox"
          v-model="csw21Enabled"
          :disabled="notInstalled('csw21')"
          @change="handleChange"
        />
        <span
          >CSW21 (EN)<em v-if="notInstalled('csw21')" class="not-installed">
            (not installed)</em
          ></span
        >
      </label>
      <label class="checkbox-item" :class="{ unavailable: notInstalled('nwl2023') }">
        <input
          type="checkbox"
          v-model="nwl2023Enabled"
          :disabled="notInstalled('nwl2023')"
          @change="handleChange"
        />
        <span
          >NWL2023 (US)<em v-if="notInstalled('nwl2023')" class="not-installed">
            (not installed)</em
          ></span
        >
      </label>
      <label class="checkbox-item" :class="{ unavailable: notInstalled('enable') }">
        <input
          type="checkbox"
          v-model="enableEnabled"
          :disabled="notInstalled('enable')"
          @change="handleChange"
        />
        <span
          >ENABLE (open list)<em v-if="notInstalled('enable')" class="not-installed">
            (not installed)</em
          ></span
        >
      </label>
      <label class="checkbox-item" :class="{ unavailable: notInstalled('friendly') }">
        <input
          type="checkbox"
          v-model="friendlyEnabled"
          :disabled="notInstalled('friendly')"
          @change="handleChange"
        />
        <span
          >Friendly (casual shorts)<em v-if="notInstalled('friendly')" class="not-installed">
            (not installed)</em
          ></span
        >
      </label>
      <label class="checkbox-item" :class="{ unavailable: notInstalled('slovenian') }">
        <input
          type="checkbox"
          v-model="slovenianEnabled"
          :disabled="notInstalled('slovenian')"
          @change="handleChange"
        />
        <span
          >Slovenian (SL)<em v-if="notInstalled('slovenian')" class="not-installed">
            (not installed)</em
          ></span
        >
      </label>
      <a v-if="installed" class="manage-link" href="#/words">Word lists…</a>
      <div class="dictionary-info">
        <span v-if="activeDictionaryCount > 1"
          >Using union of {{ activeDictionaryCount }} dictionaries</span
        >
        <span v-else-if="csw21Enabled">Using CSW21</span>
        <span v-else-if="nwl2023Enabled">Using NWL2023</span>
        <span v-else-if="enableEnabled && friendlyEnabled">Using ENABLE + Friendly</span>
        <span v-else-if="enableEnabled">Using ENABLE</span>
        <span v-else-if="friendlyEnabled">Using Friendly</span>
        <span v-else-if="slovenianEnabled">Using Slovenian</span>
        <span v-else class="warning">Select at least one</span>
      </div>
      <div class="tile-info">
        <span class="tile-label">Tiles:</span>
        <span v-if="language === 'slovenian'" class="tile-language"
          >SL · Slovenian (fixed for this game)</span
        >
        <span v-else class="tile-language">EN · English (fixed for this game)</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DictionaryChooser',
  props: {
    // Tile language of the running game; chosen when the game starts
    language: {
      type: String,
      default: 'english',
    },
    selectedDictionaries: {
      type: Object,
      default: () => ({
        csw21: false,
        nwl2023: false,
        enable: true,
        friendly: true,
        slovenian: false,
      }),
    },
    // Ids of the lists this device has. When given, the others are shown disabled as "(not installed)".
    installed: {
      type: Array,
      default: null,
    },
  },
  data() {
    return {
      showDropdown: false,
      csw21Enabled: this.selectedDictionaries.csw21,
      nwl2023Enabled: this.selectedDictionaries.nwl2023,
      enableEnabled: !!this.selectedDictionaries.enable,
      friendlyEnabled: !!this.selectedDictionaries.friendly,
      slovenianEnabled: this.selectedDictionaries.slovenian,
    };
  },
  watch: {
    // Follow the server's selection (e.g. after a new game switches to Slovenian)
    selectedDictionaries(next) {
      this.csw21Enabled = next.csw21;
      this.nwl2023Enabled = next.nwl2023;
      this.enableEnabled = !!next.enable;
      this.friendlyEnabled = !!next.friendly;
      this.slovenianEnabled = next.slovenian;
    },
  },
  computed: {
    activeDictionaryCount() {
      let count = 0;
      if (this.csw21Enabled) count++;
      if (this.nwl2023Enabled) count++;
      if (this.enableEnabled) count++;
      if (this.friendlyEnabled) count++;
      if (this.slovenianEnabled) count++;
      return count;
    },
  },
  methods: {
    notInstalled(id) {
      return Boolean(this.installed) && !this.installed.includes(id);
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    handleChange() {
      this.$emit('update', {
        csw21: this.csw21Enabled,
        nwl2023: this.nwl2023Enabled,
        enable: this.enableEnabled,
        friendly: this.friendlyEnabled,
        slovenian: this.slovenianEnabled,
      });
    },
  },
  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.$el.contains(e.target)) {
        this.showDropdown = false;
      }
    });
  },
};
</script>

<style scoped>
.dictionary-chooser {
  position: relative;
}

.icon-button {
  background: var(--surface-2);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  box-shadow: inset 0 1px 0 var(--surface-glint);
  color: var(--ink);
  padding: 10px 12px;
  min-width: 44px;
  min-height: 44px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out);
}

.icon-button:hover {
  border-color: var(--accent-edge);
  transform: translateY(-1px);
}

.icon-button:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 60ms;
}

.dropdown-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 5px;
  background: var(--surface-3);
  border: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.2));
  border-radius: 12px;
  padding: 15px;
  min-width: 200px;
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.5));
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
  color: var(--ink-muted, #a1a1aa);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  cursor: pointer;
  color: var(--ink);
  font-size: 0.95rem;
}

.checkbox-item.unavailable {
  cursor: default;
  color: var(--ink-faint, #71717a);
}

.checkbox-item.unavailable input[type='checkbox'] {
  cursor: default;
}

.not-installed {
  font-size: 0.8rem;
}

.manage-link {
  display: block;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--accent);
}

.checkbox-item:hover {
  color: var(--accent);
}

.checkbox-item input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.dictionary-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  font-size: 0.85rem;
  color: var(--ink-muted, #a1a1aa);
  font-style: italic;
}

.dictionary-info .warning {
  color: var(--warn);
  font-style: normal;
  font-weight: 700;
}

.tile-info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--surface-edge, rgba(255, 255, 255, 0.1));
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tile-label {
  color: var(--ink-faint, #71717a);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 0.75rem;
}

.tile-language {
  color: var(--ink);
  font-weight: 500;
}
</style>
