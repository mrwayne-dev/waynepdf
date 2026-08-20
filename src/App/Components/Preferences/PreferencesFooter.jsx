import { resetAll } from '../../Lib/resetAll.js';

/**
 * Reset, and nothing else.
 *
 * One call rather than an enumeration of containers: enumerating them here is
 * how language settings and the frontmatter overrides got left out of Reset in
 * the first place. resetAll asks the registry instead.
 */
export default function PreferencesFooter() {
  return (
    <footer className="wp-prefs-foot">
      <button
        type="button"
        className="wp-prefs-reset"
        onClick={() => resetAll()}
      >
        Reset everything
      </button>
    </footer>
  );
}
