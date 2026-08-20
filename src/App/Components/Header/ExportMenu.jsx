import { useEffect, useRef, useState } from 'react';
import { EXPORT_FORMATS } from '../../Lib/exportRegistry.js';

const Check = () => (
  <svg
    className="wp-export-check"
    width="14"
    height="14"
    viewBox="0 0 14 14"
    aria-hidden="true"
  >
    <path
      d="M2.5 7.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The format dropdown.
 *
 * Keyboard nav is hand-rolled over a list of buttons rather than expressed with
 * role="menu": a real menu widget owes arrow-key wrap, typeahead and focus
 * restoration, and half an implementation of it reads worse to a screen reader
 * than an honest group of buttons.
 */
export default function ExportMenu({ selected, onSelect, onDismiss }) {
  const ref = useRef(null);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      EXPORT_FORMATS.findIndex((f) => f.id === selected),
    ),
  );

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onDismiss();
    };
    // Capture, so a click on the caret that opened this does not immediately
    // reopen it after dismissal.
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [onDismiss]);

  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.focus();
  }, [active]);

  const move = (delta) => {
    const count = EXPORT_FORMATS.length;
    setActive((current) => (current + delta + count) % count);
  };

  const choose = (format) => {
    if (!format.available) return;
    onSelect(format.id);
  };

  return (
    <div
      ref={ref}
      className="wp-export-menu no-print"
      aria-label="Export format"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose(EXPORT_FORMATS[active]);
        }
      }}
    >
      {EXPORT_FORMATS.map((format, index) => (
        <button
          key={format.id}
          type="button"
          className="wp-export-item"
          data-format={format.id}
          data-active={index === active ? 'true' : undefined}
          aria-current={format.id === selected}
          /*
           * aria-disabled, not the native attribute. A format that exists but is
           * not wired yet is worth showing with its reason attached, and a
           * natively disabled button cannot take focus — so arrow-keying through
           * the menu would silently skip it and a screen reader would never
           * announce it. The click guard in `choose` is what actually enforces
           * it.
           */
          aria-disabled={!format.available || undefined}
          title={format.available ? undefined : format.unavailableReason}
          tabIndex={index === active ? 0 : -1}
          onFocus={() => setActive(index)}
          onClick={() => choose(format)}
        >
          <span className="wp-export-item-label">
            {format.label}
            {!format.available && (
              <span className="wp-export-item-note">
                ({format.unavailableReason})
              </span>
            )}
          </span>
          {format.id === selected && <Check />}
        </button>
      ))}
    </div>
  );
}
