import { useState, useEffect, useRef, useCallback } from 'react';
import { useProvided } from 'nonaction';
import { ThemeContainer } from '../../Container';
import { RANGES } from '../../Lib/settings.js';
import { resetAll } from '../../Lib/resetAll.js';
import SettingsButton from './SettingsButton.jsx';
import ThemeSwatch from './ThemeSwatch.jsx';
import FontPicker from './FontPicker.jsx';
import LanguagePicker from './LanguagePicker.jsx';
import LayoutPicker from './LayoutPicker.jsx';
import Slider from './Slider.jsx';
import './styles.css';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'high-contrast', label: 'High Contrast' },
  { id: 'print-optimized', label: 'Print Optimized' },
  { id: 'system', label: 'System' },
];

const labelFor = (id) =>
  THEME_OPTIONS.find((t) => t.id === id)?.label ?? 'Light';

/**
 * The settings surface: gear button plus the slide-out panel it controls.
 *
 * Deliberately not a <dialog> and not a modal. The point of the panel is to
 * watch the preview change as you drag a slider, so it must not trap focus or
 * cover the document behind a backdrop.
 */
export default function Settings() {
  const [settings, updaters] = useProvided(ThemeContainer);
  const [open, setOpen] = useState(false);
  const gearRef = useRef(null);
  const closeRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  // Esc closes. Bound only while open so the app has no idle global listener.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // Focus moves into the panel on open and back to the gear on close, so
  // keyboard users are not dropped at the top of the document.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) gearRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <SettingsButton
        ref={gearRef}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      <aside
        id="wp-settings-panel"
        className={`wp-panel no-print${open ? ' is-open' : ''}`}
        aria-label="Settings"
        aria-hidden={!open}
        // Keep the whole subtree out of the tab order while closed: the panel
        // is only translated off-screen, so it would still be focusable.
        inert={open ? undefined : ''}
      >
        <header className="wp-panel-head">
          <h2 className="wp-panel-title">Settings</h2>
          <button
            ref={closeRef}
            type="button"
            className="wp-close"
            onClick={close}
            aria-label="Close settings"
          >
            &times;
          </button>
        </header>

        <div className="wp-panel-body">
          <fieldset className="wp-fieldset">
            <legend className="wp-label">Theme</legend>
            <div className="wp-swatches">
              {THEME_OPTIONS.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t.id}
                  label={t.label}
                  active={settings.theme === t.id}
                  onSelect={updaters.setTheme}
                />
              ))}
            </div>
            <p className="wp-hint wp-theme-name">{labelFor(settings.theme)}</p>
          </fieldset>

          <FontPicker
            value={settings.fontFamily}
            onChange={updaters.setFontFamily}
          />

          <LanguagePicker />

          <Slider
            label="Body size"
            value={settings.fontSize}
            {...RANGES.fontSize}
            onChange={updaters.setFontSize}
            format={(v) => `${v}px`}
          />

          <Slider
            label="Line height"
            value={settings.lineHeight}
            {...RANGES.lineHeight}
            onChange={updaters.setLineHeight}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            label="Code size"
            value={settings.codeFontSize}
            {...RANGES.codeFontSize}
            onChange={updaters.setCodeFontSize}
            format={(v) => `${v}px`}
          />

          <fieldset className="wp-fieldset">
            <legend className="wp-label">Math</legend>
            <label className="wp-check">
              <input
                type="checkbox"
                checked={settings.mathCopyEnabled !== false}
                onChange={(e) => updaters.setMathCopyEnabled(e.target.checked)}
              />
              Show copy button on math
            </label>
          </fieldset>

          <fieldset className="wp-fieldset">
            <legend className="wp-label">Security</legend>
            <label className="wp-check">
              <input
                type="checkbox"
                checked={settings.sanitizeHtml === true}
                onChange={(e) => updaters.setSanitizeHtml(e.target.checked)}
              />
              Sanitize HTML output
            </label>
            <p className="wp-hint">
              Strips &lt;script&gt; tags and event handlers from custom HTML.
              Recommended if you paste Markdown from untrusted sources.
            </p>
          </fieldset>

          <fieldset className="wp-fieldset">
            <legend className="wp-label wp-section-head">Layout</legend>
            <LayoutPicker />
          </fieldset>

          <hr className="wp-divider" />

          {/* One call. Enumerating containers here is how language settings and
              the frontmatter overrides got left out of Reset in the first place;
              resetAll asks the registry instead. */}
          <button type="button" className="wp-reset" onClick={() => resetAll()}>
            Reset everything
          </button>
        </div>
      </aside>
    </>
  );
}
