import { useDocumentsApi } from '../../Container';

/**
 * Autosave state as a colour, not a sentence.
 *
 * 6.5b spelled it out — "Saved" / "Saving…" / "Unsaved changes" — and reserved
 * a fixed 9ch so the header would not reflow as the words alternated. That is a
 * lot of top bar spent on a status that is "fine" almost always. A dot carries
 * the same three states at a glance and says the words on hover.
 *
 * "Unsaved changes" still means a save that actually failed. During normal
 * typing the work is either pending or written; calling that unsaved would
 * train users to ignore the one state that matters.
 */
const LABELS = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Unsaved changes',
};

export default function AutosaveDot() {
  const { status, ready } = useDocumentsApi();
  if (!ready) return null;

  const state = LABELS[status] ? status : 'saved';
  const label = LABELS[state];

  return (
    <span
      className={`wp-autosave-dot is-${state}`}
      data-save-status={state}
      title={label}
      /* The dot is decorative; the text is what a screen reader gets, and
         aria-live announces a failure without the user having to look. */
      role="status"
      aria-live="polite"
    >
      <span className="wp-visually-hidden">{label}</span>
    </span>
  );
}
