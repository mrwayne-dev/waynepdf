import { useProvided } from 'nonaction';
import { PreferencesContainer } from '../../Container';

/*
 * The gear, kept alive for one commit.
 *
 * 7.0's spec deletes this button outright and leaves preferences reachable only
 * by Cmd+, until 7.1 lands the sidebar gear — offering a one-time toast as the
 * bridge. Both off-ramp after 7.0 and ship a state where a mouse-only user
 * cannot open settings at all, which is not a working app.
 *
 * Ten lines in a file 7.2 deletes anyway is the cheaper bridge: no new
 * localStorage key, no reset-registry entry, no toast duration parameter, and
 * nothing to remove in 7.1 beyond this file. It moves to the sidebar footer in
 * 7.1 and disappears with the header in 7.2.
 */
export default function PreferencesButton() {
  const [{ open }, api] = useProvided(PreferencesContainer);

  return (
    <button
      type="button"
      className="wp-gear"
      aria-label="Preferences"
      title="Preferences (⌘,)"
      aria-expanded={open}
      onClick={api.open}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}
