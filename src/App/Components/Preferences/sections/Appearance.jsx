import { useProvided } from 'nonaction';
import { ThemeContainer, CustomThemesContainer } from '../../../Container';
import { RANGES } from '../../../Lib/settings.js';
import {
  customThemeId,
  isCustomTheme,
} from '../../../Lib/generateCustomThemeCSS.js';
import ThemeSwatch from '../controls/ThemeSwatch.jsx';
import FontPicker from '../controls/FontPicker.jsx';
import Slider from '../controls/Slider.jsx';
import Field, { Group, SectionHeader } from '../Field.jsx';

export const THEME_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'high-contrast', label: 'High Contrast' },
  { id: 'print-optimized', label: 'Print Optimized' },
  { id: 'system', label: 'System' },
];

/** Every searchable label this section renders. Pinned by a unit invariant. */
export const LABELS = [
  'Theme',
  'Font family',
  'Body size',
  'Line height',
  'Code size',
];

export const ALIASES = [];

const presetLabelFor = (id) =>
  THEME_OPTIONS.find((t) => t.id === id)?.label ?? 'Light';

/**
 * The caption under the swatch row.
 *
 * A `custom-*` value whose theme has been deleted still shows a name rather than
 * blank — the two live in separate storage keys and the theme choice outlives
 * the theme, so it falls back to the base preset's label the same way the
 * palette itself does.
 */
function activeThemeLabel(theme, customById) {
  if (!isCustomTheme(theme)) return presetLabelFor(theme);
  const custom = customById.get(theme.slice('custom-'.length));
  return custom ? custom.name : presetLabelFor('light');
}

export default function Appearance() {
  const [settings, updaters] = useProvided(ThemeContainer);
  const [{ themes: customThemes, byId: customById }] = useProvided(
    CustomThemesContainer,
  );

  return (
    <>
      <SectionHeader
        title="Appearance"
        caption="How the rendered document looks. These apply everywhere the document is shown, including exports."
      />

      <Group title="Theme">
        <Field label="Theme">
          <div className="wp-swatches" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((t) => (
              <ThemeSwatch
                key={t.id}
                theme={t.id}
                label={t.label}
                active={settings.theme === t.id}
                onSelect={updaters.setTheme}
              />
            ))}

            {/* The user's own palettes sit on the same row, after a rule, so the
                six presets stay recognisable as a fixed set. */}
            {customThemes.length > 0 && (
              <span className="wp-swatch-divider" aria-hidden="true" />
            )}
            {customThemes.map((theme) => (
              <ThemeSwatch
                key={theme.id}
                custom
                theme={customThemeId(theme.id)}
                label={theme.name}
                active={settings.theme === customThemeId(theme.id)}
                onSelect={updaters.setTheme}
              />
            ))}
          </div>
          <p className="wp-hint wp-theme-name">
            {activeThemeLabel(settings.theme, customById)}
          </p>
        </Field>
      </Group>

      <Group title="Typography">
        <Field label="Font family">
          <FontPicker
            value={settings.fontFamily}
            onChange={updaters.setFontFamily}
          />
        </Field>

        <Field label="Body size">
          <Slider
            label="Body size"
            value={settings.fontSize}
            {...RANGES.fontSize}
            onChange={updaters.setFontSize}
            format={(v) => `${v}px`}
          />
        </Field>

        <Field label="Line height">
          <Slider
            label="Line height"
            value={settings.lineHeight}
            {...RANGES.lineHeight}
            onChange={updaters.setLineHeight}
            format={(v) => v.toFixed(2)}
          />
        </Field>

        <Field
          label="Code size"
          hint="Applies to fenced code in the rendered document. The editor has its own size under Editor."
        >
          <Slider
            label="Code size"
            value={settings.codeFontSize}
            {...RANGES.codeFontSize}
            onChange={updaters.setCodeFontSize}
            format={(v) => `${v}px`}
          />
        </Field>
      </Group>
    </>
  );
}
