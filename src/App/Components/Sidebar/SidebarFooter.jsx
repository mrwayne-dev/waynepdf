import { useProvided } from 'nonaction';
import { ThemeContainer, PreferencesContainer } from '../../Container';
import { cycleTheme } from '../../Lib/cycleTheme.js';

const GearIcon = () => (
  <svg
    width="16"
    height="16"
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
);

const SunIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** Half light, half dark — the same idea as the System swatch. */
const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
  </svg>
);

const ICONS = { light: SunIcon, dark: MoonIcon, system: SystemIcon };
const NEXT_LABEL = { light: 'Dark', dark: 'System', system: 'Light' };

/**
 * Gear and theme toggle.
 *
 * The gear is the discoverable way into preferences; Cmd+, is the fast one, and
 * it is deliberately dead inside the editor, so a visible control is not
 * optional.
 */
export default function SidebarFooter() {
  const [settings, { setTheme }] = useProvided(ThemeContainer);
  const [, preferences] = useProvided(PreferencesContainer);

  /*
   * The icon shows the theme in effect, not the one the cycle would pick next.
   * A custom theme has no icon of its own and falls back to the palette it
   * resolves to, which is what the user is actually looking at.
   */
  const key = ICONS[settings.theme] ? settings.theme : settings.resolvedTheme;
  const Icon = ICONS[key] ?? SunIcon;

  return (
    <footer className="wp-sidebar-foot">
      <button
        type="button"
        className="wp-sidebar-icon wp-gear"
        aria-label="Preferences"
        title="Preferences (⌘,)"
        onClick={preferences.open}
      >
        <GearIcon />
      </button>

      <button
        type="button"
        className="wp-sidebar-icon wp-theme-toggle"
        aria-label={`Toggle theme (currently ${settings.theme})`}
        title={`Toggle theme — next: ${NEXT_LABEL[key] ?? 'Light'}`}
        data-theme-toggle={settings.theme}
        onClick={() => setTheme(cycleTheme(settings.theme))}
      >
        <Icon />
      </button>
    </footer>
  );
}
