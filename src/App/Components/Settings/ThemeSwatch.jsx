/**
 * One theme swatch: three horizontal bands showing that theme's canvas, body
 * text, and accent colours.
 *
 * The bands read their colours from `var(--wp-color-*)` while the button
 * carries `data-theme` for the theme it represents. Because the palettes are
 * defined as `[data-theme="x"] { --wp-color-... }`, the vars resolve against
 * this element rather than the document — so each swatch paints itself in its
 * own palette with no duplicated colour values anywhere in the JS.
 */
export default function ThemeSwatch({ theme, label, active, onSelect }) {
  return (
    <button
      type="button"
      className={`wp-swatch${active ? ' is-active' : ''}`}
      data-theme={theme === 'system' ? undefined : theme}
      onClick={() => onSelect(theme)}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {theme === 'system' ? (
        // System has no palette of its own; show the light/dark split it
        // chooses between.
        <span className="wp-swatch-bands wp-swatch-system" aria-hidden="true">
          <span className="wp-swatch-system-half" data-theme="light" />
          <span className="wp-swatch-system-half" data-theme="dark" />
        </span>
      ) : (
        <span className="wp-swatch-bands" aria-hidden="true">
          <span className="wp-swatch-band wp-swatch-canvas" />
          <span className="wp-swatch-band wp-swatch-fg" />
          <span className="wp-swatch-band wp-swatch-accent" />
        </span>
      )}
    </button>
  );
}
