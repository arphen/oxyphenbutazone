import { defineConfig } from 'vitest/config';

// Separate from vite.config.js so tests don't boot the game-API plugin (which loads ~22MB of dictionaries).
export default defineConfig({
  test: { include: ['src/**/*.test.js'] },
});
