import LayoutPicker from '../controls/LayoutPicker.jsx';
import { SectionHeader } from '../Field.jsx';

export const LABELS = [];

/*
 * LayoutPicker is rendered whole, so these are section-level search terms
 * rather than Field labels — searching "margins" should keep Layout standing
 * even though no Field here carries that name.
 */
export const ALIASES = ['Page setup', 'Margins', 'Header', 'Footer', 'Cover page', 'Watermark', 'Table of contents'];

/**
 * Page geometry and the running furniture around it.
 *
 * LayoutPicker is rendered whole rather than decomposed into Fields. It is a
 * form with its own internal grouping and its own conditional rows — margins
 * that only appear for a custom preset, cover fields that only matter when a
 * cover is on — and slicing it into search-filterable fields would mean
 * reimplementing that logic here. Search finds this section by name.
 */
export default function Layout() {
  return (
    <>
      <SectionHeader
        title="Layout"
        caption="Page size, margins, and the headers, footers and furniture that surround the document when it is paginated."
      />

      <p className="wp-prefs-note">
        Frontmatter in a document can override any of these values for that
        document only.
      </p>

      <LayoutPicker />
    </>
  );
}
