import { useEffect, useState } from 'react';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * One colour row: label, swatch, hex field, and a reset when it is overridden.
 *
 * `value` is always the *resolved* colour — the override if there is one, the
 * base preset's value otherwise — so the field never shows an empty state. What
 * changes is whether the row is marked inherited or customised, which is the
 * only way to tell from the outside whether a token is being tracked or pinned.
 */
export default function ColorPicker({
  token,
  label,
  value,
  overridden,
  onChange,
  onReset,
}) {
  // Local draft so a half-typed hex does not fight the parent on every keystroke.
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (HEX.test(draft)) onChange(draft.toLowerCase());
    // An invalid hex reverts rather than being stored — a token holding "re"
    // would emit CSS that invalidates the declaration silently.
    else setDraft(value);
  };

  return (
    <div className="wp-color-row" data-token={token}>
      <span className="wp-color-label">
        {label}
        <span
          className={`wp-color-state${overridden ? ' is-custom' : ''}`}
          data-state={overridden ? 'customized' : 'inherited'}
        >
          {overridden ? 'customized' : 'inherited'}
        </span>
      </span>

      <span className="wp-color-controls">
        <input
          type="color"
          className="wp-color-swatch"
          aria-label={`${label} colour`}
          value={HEX.test(draft) ? draft : value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
        <input
          type="text"
          className="wp-color-hex"
          aria-label={`${label} hex`}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // The row lives inside the modal's <form>, so without this Enter
              // submits the whole theme instead of committing the field.
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') setDraft(value);
          }}
        />
        <button
          type="button"
          className="wp-color-reset"
          onClick={onReset}
          aria-label={`Reset ${label} to the base theme`}
          title="Reset to base"
          // Kept in the layout rather than removed, so the rows do not reflow
          // as tokens are customised.
          disabled={!overridden}
        >
          ⟲
        </button>
      </span>
    </div>
  );
}
