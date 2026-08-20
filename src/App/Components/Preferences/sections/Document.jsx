import { useProvided } from 'nonaction';
import { ThemeContainer } from '../../../Container';
import LanguagePicker from '../controls/LanguagePicker.jsx';
import Field, { Group, SectionHeader } from '../Field.jsx';

export const LABELS = [
  'Language',
  'Text direction',
  'Math copy button',
  'Sanitize HTML',
];

export const ALIASES = [];

/**
 * How a document is interpreted and rendered.
 *
 * Language, direction, math and sanitization were three separate sections in
 * the old panel. They are one question — what does this text mean and how much
 * of it do we trust — so they are one section here.
 *
 * LanguagePicker renders Language and Text direction together and owns the
 * relationship between them, so it is wrapped as a single field rather than
 * split; splitting it would mean two components racing to set `dir`.
 */
export default function Document() {
  const [settings, updaters] = useProvided(ThemeContainer);

  return (
    <>
      <SectionHeader
        title="Document"
        caption="How WaynePDF reads and renders your Markdown."
      />

      <Group title="Language">
        <Field label="Language" aliases={['Text direction']}>
          <LanguagePicker />
        </Field>
      </Group>

      <Group title="Math">
        <Field label="Math copy button">
          <label className="wp-check">
            <input
              type="checkbox"
              checked={settings.mathCopyEnabled !== false}
              onChange={(e) => updaters.setMathCopyEnabled(e.target.checked)}
            />
            Show copy button on math
          </label>
        </Field>
      </Group>

      <Group title="Security">
        <Field
          label="Sanitize HTML"
          hint="Strips <script> tags and event handlers from custom HTML. Recommended if you paste Markdown from untrusted sources."
        >
          <label className="wp-check">
            <input
              type="checkbox"
              checked={settings.sanitizeHtml === true}
              onChange={(e) => updaters.setSanitizeHtml(e.target.checked)}
            />
            Sanitize HTML output
          </label>
        </Field>
      </Group>
    </>
  );
}
