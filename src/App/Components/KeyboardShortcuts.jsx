import { useEffect } from 'react';
import { useProvided } from 'nonaction';
import { PreferencesContainer } from '../Container';
import { bindShortcuts } from '../Lib/keyboardShortcuts.js';

/**
 * Mounts the global shortcut listener. Renders nothing.
 *
 * A component rather than a hook call in App so the bindings sit inside the
 * Provider and can reach the containers they drive.
 */
export default function KeyboardShortcuts() {
  const [, preferences] = useProvided(PreferencesContainer);

  useEffect(
    () => bindShortcuts({ togglePreferences: preferences.toggle }),
    [preferences],
  );

  return null;
}
