import { useRef } from 'react';

/**
 * The section list.
 *
 * A roving tabindex rather than six tab stops: the rail is one control that
 * selects among six values, so Tab should pass over it and arrow keys should
 * move within it. Six separate tab stops would make reaching the content pane
 * from the header a seven-key journey.
 */
export default function PreferencesRail({
  sections,
  active,
  onSelect,
  hiddenIds,
}) {
  const listRef = useRef(null);

  const visible = sections.filter((s) => !hiddenIds?.has(s.id));

  const onKeyDown = (event) => {
    const delta =
      event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();

    const index = visible.findIndex((s) => s.id === active);
    // Wraps, so ArrowUp from the first item reaches About rather than dead-ending.
    const from = index === -1 ? 0 : index;
    const next = visible[(from + delta + visible.length) % visible.length];
    if (!next) return;
    onSelect(next.id);
    listRef.current
      ?.querySelector(`[data-section="${next.id}"]`)
      ?.focus({ preventScroll: false });
  };

  return (
    <nav
      className="wp-prefs-rail"
      aria-label="Preferences sections"
      ref={listRef}
      onKeyDown={onKeyDown}
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        const isHidden = hiddenIds?.has(section.id);
        return (
          <button
            key={section.id}
            type="button"
            data-section={section.id}
            className={`wp-prefs-rail-item${isActive ? ' is-active' : ''}${
              isHidden ? ' wp-prefs-hidden' : ''
            }`}
            aria-current={isActive ? 'true' : undefined}
            // Roving: only the active item is reachable by Tab.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(section.id)}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
