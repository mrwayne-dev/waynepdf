import Appearance, {
  LABELS as appearanceLabels,
  ALIASES as appearanceAliases,
} from './Appearance.jsx';
import Editor, {
  LABELS as editorLabels,
  ALIASES as editorAliases,
} from './Editor.jsx';
import Document, {
  LABELS as documentLabels,
  ALIASES as documentAliases,
} from './Document.jsx';
import Layout, {
  LABELS as layoutLabels,
  ALIASES as layoutAliases,
} from './Layout.jsx';
import Themes, {
  LABELS as themesLabels,
  ALIASES as themesAliases,
} from './Themes.jsx';
import About, {
  LABELS as aboutLabels,
  ALIASES as aboutAliases,
} from './About.jsx';

/**
 * Section id -> component, and id -> the labels search can match inside it.
 *
 * The label lists are declared rather than derived because the rail has to
 * filter itself before the content pane has rendered anything: a search for
 * "line height" must grey out Editor and Layout without first mounting them.
 *
 * Declared data drifts, so `tests/unit/preferences-sections.test.js` renders
 * every section and asserts the rendered field labels and these lists are the
 * same set. A field added without its label lands as a test failure, not as a
 * control search cannot find.
 */
export const SECTION_COMPONENTS = {
  appearance: Appearance,
  editor: Editor,
  document: Document,
  layout: Layout,
  themes: Themes,
  about: About,
};

/** Labels of the Field-wrapped controls a section renders. Pinned by a test. */
export const SECTION_FIELD_LABELS = {
  appearance: appearanceLabels,
  editor: editorLabels,
  document: documentLabels,
  layout: layoutLabels,
  themes: themesLabels,
  about: aboutLabels,
};

/*
 * Extra names a section answers to, for sections rendered whole.
 *
 * Layout, Themes and About hand off to one component each rather than to a list
 * of Fields — LayoutPicker owns its own conditional rows, and slicing it into
 * search-filterable fields would mean reimplementing that logic here. Their
 * search terms are therefore section-level, and deliberately not checked
 * against rendered fields: there are none to check against.
 */
export const SECTION_ALIASES = {
  appearance: appearanceAliases,
  editor: editorAliases,
  document: documentAliases,
  layout: layoutAliases,
  themes: themesAliases,
  about: aboutAliases,
};

/** What the rail filters on: a section's own fields plus its aliases. */
export const SECTION_LABELS = Object.fromEntries(
  Object.keys(SECTION_FIELD_LABELS).map((id) => [
    id,
    [...SECTION_FIELD_LABELS[id], ...SECTION_ALIASES[id]],
  ]),
);
