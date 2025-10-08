<template>
  <div class="rack" :class="{ disabled: disabled }" @dragover.prevent @drop="onRackDrop">
    <div v-for="(letter, index) in letters" 
         :key="index" 
         class="rack-letter" 
         :class="{ 'drag-over': dragOverIndex === index }"
         :draggable="!disabled" 
         :data-index="index"
         @dragstart="onDragStart($event, letter, index)"
         @dragover.prevent="onDragOver($event, index)"
         @dragleave="onDragLeave"
         @drop.prevent="onLetterDrop($event, index)">
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
      if (!this.disabled && this.draggedIndex !== null) {
        event.preventDefault();
        this.dragOverIndex = index;
      }
    },
    onDragLeave() {
      this.dragOverIndex = null;
    },
    onLetterDrop(event, targetIndex) {
      event.preventDefault();
      event.stopPropagation();
      
      if (!this.disabled) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        
        // If dragging from rack to rack (reorder)
        if (data.from === 'rack' && targetIndex !== data.index) {
          this.$emit('reorder-letters', { fromIndex: data.index, toIndex: targetIndex });
        }
        
        this.dragOverIndex = null;
        this.draggedIndex = null;
        
        // Remove dragging class
        const draggingElement = this.$el.querySelector('.dragging');
        if (draggingElement) {
          draggingElement.classList.remove('dragging');
        }
      }
    },
    onRackDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      
      if (!this.disabled) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        
        // If returning from board
        if (data.from === 'board') {
          this.$emit('return-letter', data);
        }
        
        this.dragOverIndex = null;
        this.draggedIndex = null;
        
        // Remove dragging class
        const draggingElement = this.$el.querySelector('.dragging');
        if (draggingElement) {
          draggingElement.classList.remove('dragging');
        }
      }
    },
  },
};
</script>

<style scoped>
.rack {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.rack-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border: 1px solid #333;
  margin: 0 5px;
  font-size: 24px;
  font-weight: bold;
  text-transform: uppercase;
  background-color: #f0e68c;
  transition: all 0.2s ease;
  cursor: grab;
}

.rack-letter:active {
  cursor: grabbing;
}

.rack-letter.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.rack-letter.drag-over {
  transform: scale(1.1);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.6);
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.8);
}

.rack.disabled .rack-letter {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
