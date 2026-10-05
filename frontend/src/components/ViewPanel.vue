<template>
  <details class="view-cluster">
    <summary class="view-cluster-summary" title="Adjust how this reads">View</summary>
    <div class="view-cluster-panel">
      <fieldset v-for="tier in TIERS" :key="tier.key" class="view-tier" :data-tier="tier.key">
        <legend>
          <span>{{ tier.title }}</span>
          <span class="view-tier-hint">{{ tier.hint }}</span>
        </legend>
        <div v-for="row in tier.rows" :key="row.key" class="view-row">
          <span class="view-row-label">{{ row.label }}</span>
          <span class="view-choices" role="group" :aria-label="row.label">
            <button
              v-for="option in row.options"
              :key="String(option)"
              type="button"
              class="view-choice"
              :data-key="row.key"
              :data-value="String(option)"
              :aria-pressed="settings[row.key] === option"
              @click="choose(row.key, option)"
            >
              {{ typeof option === 'boolean' ? (option ? 'On' : 'Off') : option }}
            </button>
          </span>
        </div>
      </fieldset>
      <button type="button" class="view-reset" @click="reset">Reset to defaults</button>
    </div>
  </details>
</template>

<script>
// The reader's own dials (S5): mini comfort, micro reading aids, nano fine
// cues. Presentation only — choices persist locally and publish as data-*
// on <html>; CSS owns every appearance (R20). One Reset undoes all (R22).
import {
  TIERS,
  VIEW_DEFAULTS,
  applyViewSettings,
  readViewSettings,
  writeViewSettings,
} from '../composables/useViewSettings.js';

export default {
  name: 'ViewPanel',
  data() {
    return { TIERS, settings: readViewSettings() };
  },
  mounted() {
    applyViewSettings(document.documentElement, this.settings);
  },
  methods: {
    choose(key, option) {
      const current = this.settings[key];
      this.settings = {
        ...this.settings,
        [key]: typeof current === 'boolean' ? option === true || option === 'true' : option,
      };
      this.publish();
    },
    reset() {
      this.settings = { ...VIEW_DEFAULTS };
      this.publish();
    },
    publish() {
      applyViewSettings(document.documentElement, this.settings);
      writeViewSettings(this.settings);
    },
  },
};
</script>
