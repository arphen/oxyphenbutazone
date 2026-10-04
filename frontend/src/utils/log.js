/**
 * Debug logging utility
 * Enables/disables console.log via ?debug URL param or localStorage key 'debug' === '1'
 */

export function isDebug() {
  // Check URL parameter
  if (typeof location !== 'undefined') {
    const params = new URLSearchParams(location.search);
    if (params.has('debug')) {
      return true;
    }
  }

  // Check localStorage (with try/catch for safety)
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('debug') === '1';
    }
  } catch (e) {
    // localStorage might be disabled or unavailable
  }

  return false;
}

export function debug(...args) {
  if (isDebug()) {
    console.log(...args);
  }
}

export function logWarn(...args) {
  console.warn(...args);
}

export function logError(...args) {
  console.error(...args);
}
