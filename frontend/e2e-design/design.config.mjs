// The ONLY file that knows this project's selectors. Adapted from guide §17.13.
import { api } from './seed.mjs';

export default {
  // Seeded phone board is not used here; every spec navigates explicitly.
  // The D1 matrix screenshots the seeded desktop board (words + history hues).
  page: '/?debug#/game',
  rootSelector: 'html',
  attrs: { theme: 'data-theme', luma: 'data-luma', vibrance: 'data-vibrance' },
  lumas: ['standard', 'dim'],
  vibrances: ['vivid', 'soft', 'bold'],
  // Elements that carry --rank (identity is published, and shown on 2+ surfaces):
  // board cells wear it, history words wear it.
  rankWearers: ['.board-cell', '.wword'],
  // Elements whose computed `color` IS the identity colour, and the attribute naming their pole.
  colorWearers: ['.wword'],
  poleAttr: 'data-pole',
  // Text that must stay legible (WCAG contrast ratio), measured on solid backgrounds.
  textPairs: [{ text: 'button', min: 4.5 }],
  requiredTokens: [
    '--ramp-l',
    '--ramp-c',
    '--ember-alpha',
    '--flame-alpha',
    '--halo-alpha',
    '--ease-out',
  ],
  // Must hold on the dim and veil tiers: bloom is gone.
  lowBloom: { '--ember-alpha': '0%' },
  maxGlass: 5,
  // Seed a deterministic mid-game board (5 distinct words, both poles) so the
  // rank, territory and economy probes always have something to measure.
  setup: async (page) => {
    await api.seedBoard(page);
  },
};

// Re-exported for specs that seed their own states.
export { api };
