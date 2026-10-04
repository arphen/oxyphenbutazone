<template>
  <div v-if="visible" class="conn-badge" data-testid="conn-badge" :class="tone" role="status">
    <span>{{ text }}</span>
    <router-link v-if="action" :to="action.to" class="conn-link" data-testid="conn-action">{{ action.label }}</router-link>
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
      if (net.role === 'guest')
        return net.guestStatus === 'open' ? 'ok' : net.guestStatus === 'closed' ? 'bad' : 'wait';
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
      if (net.role === 'guest' && net.guestStatus === 'closed')
        return { to: '/join', label: 'Rejoin' };
      if (net.role === 'host') return { to: '/host', label: 'Players' };
      return null;
    },
  },
};
</script>

<style scoped>
.conn-badge {
  position: fixed;
  top: max(8px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 14px;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  color: var(--ink, #fff);
  background: var(--glass, rgba(15, 23, 42, 0.92));
  border: 1px solid var(--glass-edge, rgba(255, 255, 255, 0.2));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow:
    inset 0 1px 0 var(--surface-glint, transparent),
    var(--shadow-sm, none);
}
.conn-badge.ok {
  border-color: var(--success-edge, #22c55e);
}
.conn-badge.wait {
  border-color: var(--warn-edge, #f59e0b);
}
.conn-badge.bad {
  border-color: var(--danger-edge, #ef4444);
}
.conn-link {
  color: var(--accent, #93c5fd);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
