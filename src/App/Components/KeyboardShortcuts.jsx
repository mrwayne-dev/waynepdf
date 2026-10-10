import { useEffect } from 'react';
import { useProvided } from 'nonaction';
import { PreferencesContainer, useDocumentsApi } from '../Container';
import { bindShortcuts } from '../Lib/keyboardShortcuts.js';

/**
 * Mounts the global shortcut listener. Renders nothing.
 *
 * A component rather than a hook call in App so the bindings sit inside the
 * Provider and can reach the containers they drive.
 */
export default function KeyboardShortcuts() {
  const [, preferences] = useProvided(PreferencesContainer);
  const { create, open } = useDocumentsApi();

  useEffect(
    () =>
      bindShortcuts({
        togglePreferences: preferences.toggle,
        newDocument: () => {
          // Same as the sidebar button: create implies "and take me there".
          const id = create();
          if (id) open(id);
        },
      }),
    [preferences, create, open],
  );

  return null;
}
