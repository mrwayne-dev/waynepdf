import { useCallback, useState } from 'react';
import { useProvided } from 'nonaction';
import {
  LayoutContainer,
  TextContainer,
  ThemeContainer,
  LanguageContainer,
  CustomThemesContainer,
  ExportFormatContainer,
} from '../../Container';
import { formatById } from '../../Lib/exportRegistry.js';
import { runExport } from '../../Lib/exportDispatcher.js';
import { isCustomTheme } from '../../Lib/generateCustomThemeCSS.js';
import { parseFrontmatter } from '../../Lib/parseFrontmatter.js';
import ExportMenu from './ExportMenu.jsx';
import './exportButton.css';

const Caret = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M3 4.5L6 8l3-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The split button: act on the current format, or open the menu to change it.
 *
 * Everything the exporters need is gathered here rather than inside them, so a
 * format implementation stays a pure function of a document and never reaches
 * back into React.
 */
export default function ExportButton() {
  const [layout] = useProvided(LayoutContainer);
  const [text] = useProvided(TextContainer);
  const [themeSettings] = useProvided(ThemeContainer);
  const [{ resolvedLang, resolvedDirection }] = useProvided(LanguageContainer);
  const [{ byId: customById }] = useProvided(CustomThemesContainer);
  const [{ format }, { setFormat }] = useProvided(ExportFormatContainer);

  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const active = formatById(format);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runExport({
        format,
        body: text ?? '',
        layout,
        theme: themeSettings.theme,
        resolvedTheme: themeSettings.resolvedTheme,
        fontFamily: themeSettings.fontFamily,
        sanitizeHtml: themeSettings.sanitizeHtml === true,
        // DOCX writes title/author/date into the package metadata. Parsed here
        // rather than in the exporter so every format is handed the same shape.
        frontmatter: parseFrontmatter(text ?? '').frontmatter,
        // Resolved here so the exporter is handed the record, not an id it
        // would have to look up in a container it cannot read.
        activeCustomTheme: isCustomTheme(themeSettings.theme)
          ? customById.get(themeSettings.theme.slice('custom-'.length))
          : undefined,
        lang: resolvedLang,
        dir: resolvedDirection,
      });
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    format,
    text,
    layout,
    themeSettings,
    customById,
    resolvedLang,
    resolvedDirection,
  ]);

  return (
    <div className="wp-export">
      <button
        type="button"
        className="wp-export-main"
        onClick={run}
        disabled={busy}
      >
        {busy ? 'Preparing…' : active.actionLabel}
      </button>
      <button
        type="button"
        className="wp-export-caret"
        aria-label="Choose export format"
        aria-expanded={menuOpen}
        aria-haspopup="true"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Caret />
      </button>

      {menuOpen && (
        <ExportMenu
          selected={format}
          onDismiss={() => setMenuOpen(false)}
          onSelect={(next) => {
            setFormat(next);
            setMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}
