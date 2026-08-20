import { useProvided } from 'nonaction';
import { PreferencesContainer } from '../../Container';

/**
 * Case-insensitive substring match, the whole of the search contract.
 *
 * No fuzzy matching and no ranking: with six sections and a few dozen controls,
 * fuzzy matching mostly produces surprising hits, and a user typing "font" wants
 * the three font controls, not a relevance-ordered guess.
 */
export const matches = (query, label) => {
  const needle = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  return String(label ?? '')
    .toLowerCase()
    .includes(needle);
};

/**
 * One labelled control, hidden when a search excludes it.
 *
 * The label text is the searchable surface, which is why it is a prop rather
 * than markup the caller writes: search has to read the same string the user
 * sees, and a caller free to render its own heading would eventually render one
 * that search cannot find.
 */
export default function Field({ label, hint, children, id, aliases }) {
  const [{ searchQuery }] = useProvided(PreferencesContainer);
  /*
   * `aliases` exists for controls that render more than one thing under one
   * label — LanguagePicker owns both the language select and the direction
   * pills, because the two have to agree about `dir`. Splitting it into two
   * fields to make search find "direction" would mean two components racing to
   * set the same attribute, so the second name is attached to the one field
   * instead.
   */
  const names = [label, ...(aliases ?? [])];
  const hidden = !names.some((name) => matches(searchQuery, name));

  return (
    <div
      className={`wp-prefs-field${hidden ? ' wp-prefs-hidden' : ''}`}
      data-field-label={names.join(' | ')}
    >
      {children}
      {hint ? (
        <p className="wp-prefs-field-hint" id={id ? `${id}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A titled cluster of fields. Hidden by CSS when search empties it. */
export function Group({ title, children }) {
  return (
    <fieldset className="wp-prefs-group">
      {title ? <legend className="wp-prefs-group-title">{title}</legend> : null}
      {children}
    </fieldset>
  );
}

/** Heading block at the top of every section. */
export function SectionHeader({ title, caption }) {
  return (
    <>
      <h3 className="wp-prefs-section-title">{title}</h3>
      {caption ? <p className="wp-prefs-section-caption">{caption}</p> : null}
    </>
  );
}
