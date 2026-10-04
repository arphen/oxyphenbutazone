// Keep the screen on while a peer-to-peer game is running. A phone that locks its screen suspends the page and drops
// the connection, which for the hosting phone ends the game for everyone. Browsers release the lock whenever the page
// is hidden, so it is requested again when the page comes back.

let sentinel = null;
let wanted = false;

async function acquire() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator) || sentinel) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    /* denied (e.g. low battery); play still works, the screen may just dim */
  }
}

export function keepAwake(on) {
  wanted = on;
  if (on) {
    acquire();
  } else if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') acquire();
  });
}
