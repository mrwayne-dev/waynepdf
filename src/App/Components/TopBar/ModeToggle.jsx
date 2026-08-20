import { useProvided } from 'nonaction';
import { LayoutContainer } from '../../Container';

/*
 * "Flowing" and "Paged", not "Edit" and "Print".
 *
 * The app's existing vocabulary is what users have learned since Phase 5, and
 * renaming a control is a cost paid by everyone who already knows it in
 * exchange for clarity only a newcomer would notice.
 */
const MODES = [
  { id: 'flowing', label: 'Flowing' },
  { id: 'paged', label: 'Paged' },
];

export default function ModeToggle() {
  const [layout, { setPreviewMode }] = useProvided(LayoutContainer);

  return (
    <div className="wp-modes" role="group" aria-label="Preview mode">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className={`wp-mode${layout.previewMode === mode.id ? ' is-active' : ''}`}
          aria-pressed={layout.previewMode === mode.id}
          onClick={() => setPreviewMode(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
