<template>
  <div class="rack" :class="{ disabled: disabled }" @dragover.prevent @drop="onDrop">
    <div v-for="(letter, index) in letters" 
         :key="index" 
         class="rack-letter" 
         :draggable="!disabled" 
         @dragstart="onDragStart($event, letter, index)">
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
  methods: {
    onDragStart(event, letter, index) {
      if (!this.disabled) {
        event.dataTransfer.setData('text/plain', JSON.stringify({ letter, from: 'rack', index }));
      }
    },
    onDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!this.disabled) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.from === 'board') {
          this.$emit('return-letter', data);
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
  transition: opacity 0.3s ease;
}

.rack.disabled .rack-letter {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
