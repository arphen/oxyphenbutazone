import { ref, onMounted, onUnmounted } from 'vue';

const ws = ref(null);
const connected = ref(false);
const gameState = ref(null);

export function useGameSync() {
  const connect = () => {
    // Use WebSocket for real-time sync
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws.value = new WebSocket(wsUrl);
    
    ws.value.onopen = () => {
      console.log('WebSocket connected');
      connected.value = true;
    };
    
    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'game-state') {
          gameState.value = data.payload;
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
      connected.value = false;
    };
    
    ws.value.onclose = () => {
      console.log('WebSocket closed');
      connected.value = false;
      // Attempt to reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  };
  
  const sendGameState = (state) => {
    if (ws.value && connected.value) {
      ws.value.send(JSON.stringify({
        type: 'game-state',
        payload: state
      }));
    }
  };
  
  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
    }
  };
  
  return {
    connect,
    disconnect,
    sendGameState,
    connected,
    gameState
  };
}
