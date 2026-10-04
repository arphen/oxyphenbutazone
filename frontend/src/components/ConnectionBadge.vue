<template>
  <div v-if="visible" class="conn-badge" :class="tone" role="status">
    <span>{{ text }}</span>
    <router-link v-if="action" :to="action.to" class="conn-link">{{ action.label }}</router-link>
  </div>
</template>

<script>
import { net } from '../net/session';

export default {
  name: 'ConnectionBadge',
  computed: {
    visible() {
      return net.role !== 'none';
    },
    connected() {
      return Object.values(net.seats).filter((s) => s === 'open').length;
    },
    tone() {
      if (net.role === 'guest') return net.guestStatus === 'open' ? 'ok' : net.guestStatus === 'closed' ? 'bad' : 'wait';
      return this.connected > 0 ? 'ok' : 'wait';
    },
    text() {
      if (net.role === 'guest') {
        if (net.guestStatus === 'open') return `Connected · you are Player ${net.seat}`;
        if (net.guestStatus === 'closed') return 'Connection to host lost';
        return 'Connecting…';
      }
      const lost = Object.values(net.seats).filter((s) => s === 'closed').length;
      return `Hosting · ${this.connected} connected${lost ? ` · ${lost} lost` : ''}`;
    },
    action() {
      if (net.role === 'guest' && net.guestStatus === 'closed') return { to: '/join', label: 'Rejoin' };
      if (net.role === 'host') return { to: '/host', label: 'Players' };
      return null;
    },
  },
};
</script>

<style scoped>
.conn-badge {
  position: fixed; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 2000;
  display: flex; gap: 10px; align-items: center; padding: 6px 14px; border-radius: 999px; font-size: 13px; color: #fff;
  background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(6px);
}
.conn-badge.ok { border-color: #22c55e; }
.conn-badge.wait { border-color: #f59e0b; }
.conn-badge.bad { border-color: #ef4444; }
.conn-link { color: #93c5fd; font-weight: 600; text-decoration: underline; }
</style>
