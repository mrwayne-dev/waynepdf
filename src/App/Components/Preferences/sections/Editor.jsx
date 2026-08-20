import { useProvided } from 'nonaction';
import { ThemeContainer } from '../../../Container';
import { RANGES } from '../../../Lib/settings.js';
import Slider from '../controls/Slider.jsx';
import Field, { Group, SectionHeader } from '../Field.jsx';

export const LABELS = ['Editor font size'];

export const ALIASES = [];

/**
 * Editor preferences.
 *
 * One control today, and deliberately only one. The section exists because
 * "how the source looks while I write" and "how the document looks when it
 * renders" are different questions that the old panel answered in one list —
 * not because there was a quota of settings to fill. Inventing three more to
 * make the page look busy would be worse than a short page.
 */
export default function Editor() {
  const [settings, updaters] = useProvided(ThemeContainer);

  return (
    <>
      <SectionHeader
        title="Editor"
        caption="How the Markdown source looks while you write it. None of this reaches the rendered document or an export."
      />

      <Group title="Typography">
        <Field
          label="Editor font size"
          hint="Independent of the document's code size, so you can enlarge the editor without inflating every code block in your PDF."
        >
          <Slider
            label="Editor font size"
            value={settings.editorFontSize}
            {...RANGES.editorFontSize}
            onChange={updaters.setEditorFontSize}
            format={(v) => `${v}px`}
          />
        </Field>
      </Group>

      <p className="wp-prefs-empty">
        More editor preferences will land here in a later phase.
      </p>
    </>
  );
}
