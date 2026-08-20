/*
 * The sidebar's one-click theme cycle.
 *
 * Three stops, not five. Sepia, High Contrast and Print Optimized are
 * deliberate choices a user makes once for a reason; putting them in a cycle
 * means clicking past them every time, and clicking into them by accident.
 * Light / Dark / System is the toggle people actually want, and preferences
 * still holds the full set.
 *
 * A custom theme is not in the cycle either — but it must not be swallowed. The
 * first click from a custom theme moves to the head of the cycle rather than
 * being treated as an unknown value.
 */

export const THEME_CYCLE = ['light', 'dark', 'system'];

export function cycleTheme(current) {
  const index = THEME_CYCLE.indexOf(current);
  if (index === -1) return THEME_CYCLE[0];
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}
