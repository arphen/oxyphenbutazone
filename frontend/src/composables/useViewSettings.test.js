import { describe, expect, it } from 'vitest';
import {
  VIEW_DEFAULTS,
  createRamp,
  normalizeViewSettings,
  readViewSettings,
  viewAttributes,
  writeViewSettings,
} from './useViewSettings';

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

describe('normalizeViewSettings', () => {
  it('keeps known values and falls back for unknown ones', () => {
    const out = normalizeViewSettings({ luma: 'neon', scale: 'full', ramp: 'yes' });
    expect(out.luma).toBe(VIEW_DEFAULTS.luma);
    expect(out.scale).toBe('full');
    // Booleans stay booleans: the string 'yes' is not an option.
    expect(out.ramp).toBe(VIEW_DEFAULTS.ramp);
  });

  it('ignores non-objects', () => {
    expect(normalizeViewSettings(null)).toEqual(VIEW_DEFAULTS);
    expect(normalizeViewSettings('dim')).toEqual(VIEW_DEFAULTS);
  });
});

describe('readViewSettings', () => {
  it('a stored choice beats a media hint', () => {
    const storage = memoryStorage({
      'oxy.view.v1': JSON.stringify({ ...VIEW_DEFAULTS, luma: 'veil' }),
    });
    const media = () => ({ matches: true }); // every low-bloom hint matches
    expect(readViewSettings({ storage, media }).luma).toBe('veil');
  });

  it('a first visit follows the media hint', () => {
    const yes = () => ({ matches: true });
    const no = () => ({ matches: false });
    expect(readViewSettings({ storage: memoryStorage(), media: yes }).luma).toBe('dim');
    expect(readViewSettings({ storage: memoryStorage(), media: no }).luma).toBe('standard');
  });

  it('corrupt JSON and missing storage fall back', () => {
    expect(readViewSettings({ storage: memoryStorage({ 'oxy.view.v1': '{oops' }) })).toEqual(
      expect.objectContaining(VIEW_DEFAULTS)
    );
    expect(readViewSettings({ storage: null })).toEqual(expect.objectContaining(VIEW_DEFAULTS));
    expect(readViewSettings({ storage: undefined })).toEqual(
      expect.objectContaining(VIEW_DEFAULTS)
    );
  });

  it('round-trips through write', () => {
    const storage = memoryStorage();
    writeViewSettings({ ...VIEW_DEFAULTS, vibrance: 'bold' }, { storage });
    expect(readViewSettings({ storage }).vibrance).toBe('bold');
  });
});

describe('viewAttributes', () => {
  it("booleans become 'on' | 'off' for CSS attribute selectors", () => {
    expect(viewAttributes({ ...VIEW_DEFAULTS, ramp: true, cues: false })).toMatchObject({
      'data-ramp': 'on',
      'data-cues': 'off',
      'data-luma': 'standard',
    });
  });
});

describe('createRamp', () => {
  it('shares one rank between shared ids and spans 0..1', () => {
    const ramp = createRamp([7, 3, 7, 11]);
    expect(ramp.get(7)).toBe(ramp.get(7));
    expect(ramp.get(3)).toBe(0);
    expect(ramp.get(11)).toBe(1);
    expect(ramp.get(7)).toBe(0.5);
  });

  it('a single item takes rank 0', () => {
    expect(createRamp([42]).get(42)).toBe(0);
  });
});
