import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'nonaction';
import {
  SECTION_COMPONENTS,
  SECTION_LABELS,
  SECTION_FIELD_LABELS,
  SECTION_ALIASES,
} from '@/App/Components/Preferences/sections/index.js';
import { SECTIONS } from '@/App/Container/Hooks/usePreferences.js';
import { matches } from '@/App/Components/Preferences/Field.jsx';
import {
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
  LayoutContainer,
  PageCountContainer,
  CustomThemesContainer,
  ExportFormatContainer,
  PreferencesContainer,
} from '@/App/Container';

const CONTAINERS = [
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  EncodingBannerContainer,
  LayoutContainer,
  PageCountContainer,
  CustomThemesContainer,
  ExportFormatContainer,
  PreferencesContainer,
];

/** Mounts one section inside the real container stack it renders against. */
function renderSection(id) {
  const Section = SECTION_COMPONENTS[id];
  return render(
    <Provider inject={CONTAINERS}>
      <Section />
    </Provider>,
  );
}

/** Every label a section's rendered fields declare, in DOM order. */
const renderedLabels = (container) =>
  [...container.querySelectorAll('[data-field-label]')].flatMap((node) =>
    node.getAttribute('data-field-label').split(' | '),
  );

describe('preferences sections', () => {
  it('every section in the rail has a component and a label list', () => {
    // A section added to the rail without either renders a blank pane.
    for (const { id } of SECTIONS) {
      expect(SECTION_COMPONENTS[id], id).toBeTypeOf('function');
      expect(Array.isArray(SECTION_FIELD_LABELS[id]), id).toBe(true);
      expect(Array.isArray(SECTION_ALIASES[id]), id).toBe(true);
    }
  });

  it.each(SECTIONS.map((s) => s.id))('%s renders without throwing', (id) => {
    const { container } = renderSection(id);
    expect(container.firstChild).not.toBeNull();
  });

  /*
   * The invariant this file exists for.
   *
   * The rail filters itself using SECTION_LABELS before the content pane has
   * mounted anything, so those lists are declared rather than derived — and
   * declared data drifts. A control added without its label would be findable
   * by eye and invisible to search, which is the kind of bug nobody reports
   * because it looks like the search box simply does not work well.
   */
  it.each(SECTIONS.map((s) => s.id))(
    '%s declares exactly the labels it renders',
    (id) => {
      const { container } = renderSection(id);
      const rendered = new Set(renderedLabels(container));
      const declared = new Set(SECTION_FIELD_LABELS[id]);

      const undeclared = [...rendered].filter((l) => !declared.has(l));
      const unrendered = [...declared].filter((l) => !rendered.has(l));

      expect(
        undeclared,
        `${id} renders fields whose labels are missing from SECTION_LABELS — search cannot find them`,
      ).toEqual([]);
      expect(
        unrendered,
        `${id} declares field labels it does not render — a section-level search term belongs in ALIASES, not LABELS`,
      ).toEqual([]);
    },
  );

  it('a search for a control name keeps only the sections that own it', () => {
    // "Line height" lives in Appearance alone; Editor and Layout must drop out.
    const owning = SECTIONS.filter(({ id, label }) =>
      [label, ...SECTION_LABELS[id]].some((name) =>
        matches('line height', name),
      ),
    ).map((s) => s.id);
    expect(owning).toEqual(['appearance']);
  });

  it('a section rendered whole answers to its aliases', () => {
    // Layout hands off to LayoutPicker and has no Fields of its own, so a
    // search for "margins" can only reach it through ALIASES.
    const owning = SECTIONS.filter(({ id, label }) =>
      [label, ...SECTION_LABELS[id]].some((name) => matches('margins', name)),
    ).map((s) => s.id);
    expect(owning).toEqual(['layout']);
  });

  it('a search matching nothing leaves no section standing', () => {
    const owning = SECTIONS.filter(({ id, label }) =>
      [label, ...SECTION_LABELS[id]].some((name) => matches('zzzz', name)),
    );
    expect(owning).toEqual([]);
  });

  it('About shows the injected version rather than a placeholder', () => {
    renderSection('about');
    expect(screen.getByTestId('wp-version').textContent).toMatch(
      /WaynePDF \d+\.\d+\.\d+/,
    );
  });
});

describe('matches', () => {
  it('is case-insensitive and substring-based', () => {
    expect(matches('FONT', 'Font family')).toBe(true);
    expect(matches('height', 'Line height')).toBe(true);
    expect(matches('nope', 'Line height')).toBe(false);
  });

  it('an empty or whitespace query matches everything', () => {
    expect(matches('', 'anything')).toBe(true);
    expect(matches('   ', 'anything')).toBe(true);
  });
});
