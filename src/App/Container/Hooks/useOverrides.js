import { useState, useEffect } from 'react';
import {
  getOverrides,
  subscribeOverrides,
} from '../../Lib/frontmatterOverrides.js';

/**
 * Subscribes to the frontmatter override store.
 *
 * Used by useTheme, useLanguage and useLayout so each merges overrides in
 * exactly one place. Deliberately not a container — see the note in
 * Lib/frontmatterOverrides.js for why a container cannot work here.
 */
export default function useOverrides() {
  const [overrides, setLocal] = useState(getOverrides);

  useEffect(() => {
    // Re-read on mount as well as subscribing: the watcher may have published
    // before this hook first ran.
    setLocal(getOverrides());
    return subscribeOverrides(setLocal);
  }, []);

  return overrides;
}
