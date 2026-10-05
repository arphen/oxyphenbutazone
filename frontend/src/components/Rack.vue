<template>
  <div
    class="rack"
    :class="{ disabled: disabled }"
    data-testid="rack"
    @dragover.prevent
    @drop="onRackDrop"
  >
    <div
      v-for="(letter, index) in letters"
      :key="index"
      class="rack-letter"
      :class="{ 'drag-over': dragOverIndex === index }"
      :draggable="!disabled"
      :data-index="index"
      :data-testid="`rack-tile-${index}`"
      @dragstart="onDragStart($event, letter, index)"
      @dragover.prevent="onDragOver($event, index)"
      @dragleave="onDragLeave"
      @drop.prevent="onLetterDrop($event, index)"
    >
      {{ letter }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'Rack',
  props: {
    letters: {
      type: Array,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      dragOverIndex: null,
      draggedIndex: null,
    };
  },
  methods: {
    onDragStart(event, letter, index) {
      if (!this.disabled) {
        this.draggedIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ letter, from: 'rack', index }));
        event.target.classList.add('dragging');
      }
    },
    onDragOver(event, index) {
      if (!this.disabled) {
        event.preventDefault();
        event.stopPropagation(); // Only stop within rack
        this.dragOverIndex = index;
      }
    },
    onDragLeave(event) {
      // Don't clear if we're still within the rack
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dragOverIndex = null;
      }
    },
    onLetterDrop(event, targetIndex) {
      event.preventDefault();
      event.stopPropagation();

      if (!this.disabled) {
        try {
          const dataStr = event.dataTransfer.getData('text/plain');
          if (!dataStr) return;

          const data = JSON.parse(dataStr);

          // If dragging from rack to rack (reorder)
          if (data.from === 'rack' && targetIndex !== data.index) {
            this.$emit('reorder-letters', { fromIndex: data.index, toIndex: targetIndex });
          }
        } catch (error) {
          console.error('Error handling rack letter drop:', error);
        }

        this.cleanupDrag();
      }
    },
    onRackDrop(event) {
      // Only handle if drop is on the rack container itself, not a letter
      if (event.target.classList.contains('rack')) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.disabled) {
          try {
            const dataStr = event.dataTransfer.getData('text/plain');
            if (!dataStr) return;

            const data = JSON.parse(dataStr);

            // If returning from board
            if (data.from === 'board') {
              this.$emit('return-letter', data);
            }
          } catch (error) {
            console.error('Error handling rack drop:', error);
          }

          this.cleanupDrag();
        }
      }
    },
    cleanupDrag() {
      this.dragOverIndex = null;
      this.draggedIndex = null;

      // Remove dragging class
      const draggingElement = this.$el.querySelector('.dragging');
      if (draggingElement) {
        draggingElement.classList.remove('dragging');
      }
    },
  },
};
</script>

<style scoped>
/* Single-row rack: tiles share the row and shrink to fit instead of
   wrapping or overflowing. 7 tiles × 44px + gaps ≈ 332px, so the row holds
   together down to 360px-wide phones with 44px touch targets intact. */
.rack {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: stretch;
  gap: 4px;
  width: 100%;
  max-width: 560px;
  margin: 8px auto 0;
  padding: 0 4px;
}

.rack-letter {
  flex: 1 1 0;
  min-width: 44px;
  max-width: 64px;
  min-height: 44px;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--tile-edge, #333);
  font-size: clamp(18px, 5vw, 24px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
  color: var(--tile-ink, #1c2330);
  background: linear-gradient(135deg, var(--tile-face-hi, #fff), var(--tile-face-lo, #e9e6da));
  box-shadow:
    inset 0 1px 0 var(--cell-glint, transparent),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.25));
  transition:
    transform var(--dur-quick, 160ms) var(--ease-out, ease-out),
    border-color var(--dur-quick, 160ms) var(--ease-out, ease-out),
    box-shadow var(--dur-quick, 160ms) var(--ease-out, ease-out);
  cursor: grab;
  border-radius: 6px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.rack-letter:active {
  cursor: grabbing;
}

.rack-letter:hover {
  transform: translateY(-2px);
}

.rack-letter:focus-visible {
  outline: 2px solid var(--focus-ring, #8dc7ff);
  outline-offset: 2px;
}

.rack-letter.selected {
  border-color: var(--accent-edge, rgba(122, 168, 255, 0.55));
  box-shadow:
    0 0 0 2px var(--tile-glow, rgba(122, 168, 255, 0.45)),
    var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.25));
  transform: translateY(-2px);
}

.rack-letter.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.rack-letter.drag-over {
  transform: scale(1.1);
  box-shadow: 0 0 0 3px var(--accent-edge, rgba(59, 130, 246, 0.6));
  background: linear-gradient(
    135deg,
    var(--accent-soft, rgba(59, 130, 246, 0.2)),
    var(--tile-face-lo, #e9e6da)
  );
  border-color: var(--accent-edge, rgba(59, 130, 246, 0.8));
}

.rack.disabled .rack-letter {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .rack-letter {
    animation: none;
    transition: none;
  }
}
</style>
