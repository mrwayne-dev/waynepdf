import { FONT_FAMILIES } from '../../Lib/settings.js';

const LABELS = { sans: 'Sans', serif: 'Serif', mono: 'Mono' };

/**
 * Three pills for the body font family. Radios rather than buttons so arrow
 * keys move between options and screen readers announce the group and the
 * selected item; the pill look is entirely CSS on the label.
 *
 * Each label renders in the face it selects, which is the fastest way for a
 * user to see what they are choosing.
 */
export default function FontPicker({ value, onChange }) {
  return (
    <fieldset className="wp-fieldset">
      <legend className="wp-label">Font family</legend>
      <div className="wp-pills">
        {FONT_FAMILIES.map((family) => (
          <label
            key={family}
            className={`wp-pill${value === family ? ' is-active' : ''}`}
            style={{ fontFamily: `var(--wp-font-family-${family})` }}
          >
            <input
              type="radio"
              name="wp-font-family"
              value={family}
              checked={value === family}
              onChange={() => onChange(family)}
            />
            {LABELS[family]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
