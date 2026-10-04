<template>
  <div id="app">
    <ConnectionBadge />
    <router-view />
  </div>
</template>

<script>
import ConnectionBadge from './components/ConnectionBadge.vue';

export default {
  name: 'App',
  components: { ConnectionBadge }
};
</script>

<style>
#app {
  font-family: Arial, sans-serif;
}
</style>
