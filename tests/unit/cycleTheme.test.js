import { describe, it, expect } from 'vitest';
import { cycleTheme, THEME_CYCLE } from '@/App/Lib/cycleTheme.js';
import { THEMES } from '@/App/Lib/settings.js';

describe('cycleTheme', () => {
  it('runs light -> dark -> system -> light', () => {
    expect(cycleTheme('light')).toBe('dark');
    expect(cycleTheme('dark')).toBe('system');
    expect(cycleTheme('system')).toBe('light');
  });

  it('returns to the start after a full lap', () => {
    let theme = THEME_CYCLE[0];
    for (let i = 0; i < THEME_CYCLE.length; i += 1) theme = cycleTheme(theme);
    expect(theme).toBe(THEME_CYCLE[0]);
  });

  it.each(['sepia', 'high-contrast', 'print-optimized'])(
    'enters the cycle from %s rather than dead-ending',
    (theme) => {
      // These are reachable from preferences but are not cycle stops; the first
      // click from one has to go somewhere sensible.
      expect(cycleTheme(theme)).toBe(THEME_CYCLE[0]);
    },
  );

  it('enters the cycle from a custom theme', () => {
    expect(cycleTheme('custom-11111111-2222-3333-4444-555555555555')).toBe(
      THEME_CYCLE[0],
    );
  });

  it.each([[null], [undefined], [''], [42]])(
    'enters the cycle from %s',
    (value) => {
      expect(cycleTheme(value)).toBe(THEME_CYCLE[0]);
    },
  );

  it('every cycle stop is a theme the settings schema accepts', () => {
    // A typo here would persist a value normalizeSettings then discards, which
    // reads as the toggle silently doing nothing.
    for (const theme of THEME_CYCLE) expect(THEMES).toContain(theme);
  });
});
