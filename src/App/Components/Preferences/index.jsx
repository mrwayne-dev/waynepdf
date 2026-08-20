import { useEffect, useRef } from 'react';
import { useProvided } from 'nonaction';
import { PreferencesContainer } from '../../Container';
import { SECTIONS } from '../../Container/Hooks/usePreferences.js';
import PreferencesHeader from './PreferencesHeader.jsx';
import PreferencesRail from './PreferencesRail.jsx';
import PreferencesFooter from './PreferencesFooter.jsx';
import { SECTION_COMPONENTS, SECTION_LABELS } from './sections/index.js';
import { matches } from './Field.jsx';
import './controls/controls.css';
import './controls/customThemeStyles.css';
import './styles.css';

/**
 * Sections a search excludes entirely.
 *
 * A section survives if its own name matches or if any control inside it does,
 * so typing "margin" leaves Layout standing even though the word "Layout" does
 * not contain it.
 */
function hiddenSections(query) {
  const hidden = new Set();
  if (!String(query ?? '').trim()) return hidden;
  for (const section of SECTIONS) {
    const names = [section.label, ...(SECTION_LABELS[section.id] ?? [])];
    if (!names.some((name) => matches(query, name))) hidden.add(section.id);
  }
  return hidden;
}

/**
 * The preferences window.
 *
 * Rendered as a sibling of the workspace rather than in place of it, and
 * returns null when closed. The workspace stays mounted underneath the whole
 * time: preferences is a thing you glance at mid-task, and unmounting the
 * editor to show it would drop the CodeMirror buffer, the scroll position and
 * any in-flight autosave.
 */
export default function PreferencesWindow() {
  const [{ open, activeSection, searchQuery }, api] =
    useProvided(PreferencesContainer);
  const searchRef = useRef(null);

  // Esc closes. Bound only while open, so the app carries no idle listener.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      /*
       * Only when nothing inside has claimed it. The custom theme editor is a
       * modal on top of this window and closes on Esc itself; without this
       * check one keypress would close both, dumping the user back to the
       * workspace from two levels deep.
       */
      if (event.defaultPrevented) return;
      event.stopPropagation();
      api.close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, api]);

  // Focus into the search box on open, back to the opener on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else if (wasOpen.current) api.restoreFocus();
    wasOpen.current = open;
  }, [open, api]);

  if (!open) return null;

  const hidden = hiddenSections(searchQuery);
  const Section = SECTION_COMPONENTS[activeSection] ?? SECTION_COMPONENTS.appearance;
  const nothingMatches = hidden.size === SECTIONS.length;

  return (
    <div
      className="wp-prefs no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wp-prefs-title"
    >
      <PreferencesHeader
        ref={searchRef}
        query={searchQuery}
        onQueryChange={api.setSearch}
        onClose={api.close}
      />

      <div className="wp-prefs-body">
        <PreferencesRail
          sections={SECTIONS}
          active={activeSection}
          onSelect={api.setSection}
          hiddenIds={hidden}
        />

        <div className="wp-prefs-content">
          <div className="wp-prefs-pane">
            {nothingMatches ? (
              <p className="wp-prefs-empty">
                No preferences match “{searchQuery}”.
              </p>
            ) : (
              <Section />
            )}
          </div>
        </div>
      </div>

      <PreferencesFooter />
    </div>
  );
}
