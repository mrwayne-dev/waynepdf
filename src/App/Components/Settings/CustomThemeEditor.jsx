import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PRESET_PALETTES,
  PRESET_NAMES,
  EDITABLE_TOKENS,
  TOKEN_LABELS,
} from '../../Lib/presetPalettes.js';
import { paletteBlock } from '../../Lib/generateCustomThemeCSS.js';
import ColorPicker from './ColorPicker.jsx';
import './customThemeStyles.css';

const PRESET_LABELS = {
  light: 'Light',
  dark: 'Dark',
  sepia: 'Sepia',
  'high-contrast': 'High Contrast',
  'print-optimized': 'Print Optimized',
};

const SAMPLE = `## Sample Heading

Paragraph with **bold** and [a link](#). Some \`inline code\`.

> Blockquote

\`\`\`js
const sample = 1;
\`\`\`
`;

/*
 * The renderer is a 600 KB lazy chunk. Importing it statically would drag
 * markdown-it, KaTeX and highlight.js into the main bundle for the sake of a
 * six-line sample, so it is fetched on open — by which point the preview pane
 * has already loaded it and the import resolves from cache.
 *
 * Rendered once and kept: the sample never changes, only the palette around it.
 */
let samplePromise = null;
const renderSample = () => {
  if (!samplePromise) {
    samplePromise = import('../Previewer/Preview.jsx')
      .then((m) => m.md.render(SAMPLE))
      .catch(() => '');
  }
  return samplePromise;
};

/** Namespaced and stable, so nothing in a snapshot depends on a timestamp. */
const PREVIEW_THEME = 'wp-theme-editor-preview';

export default function CustomThemeEditor({ theme, onCancel, onSave }) {
  const editing = Boolean(theme);

  const [name, setName] = useState(theme?.name ?? '');
  const [basedOn, setBasedOn] = useState(theme?.basedOn ?? 'light');
  const [overrides, setOverrides] = useState(theme?.overrides ?? {});
  const [error, setError] = useState(null);
  const [sampleHtml, setSampleHtml] = useState('');
  const nameRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    let live = true;
    renderSample().then((html) => live && setSampleHtml(html));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // The settings panel also closes on Esc and sits behind this.
      e.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  const base = PRESET_PALETTES[basedOn] ?? PRESET_PALETTES.light;
  const merged = useMemo(() => ({ ...base, ...overrides }), [base, overrides]);

  /*
   * The live preview's palette, scoped to a data-theme nobody else uses, so the
   * draft is visible without touching the theme the app is actually running.
   */
  const previewCSS = useMemo(
    () => paletteBlock(`[data-theme="${PREVIEW_THEME}"]`, merged),
    [merged],
  );

  const changeBase = (next) => {
    if (next === basedOn) return;
    const count = Object.keys(overrides).length;
    if (
      count > 0 &&
      !window.confirm(
        `Changing the base preset clears ${count} customised colour${count === 1 ? '' : 's'}. Continue?`,
      )
    ) {
      return;
    }
    setBasedOn(next);
    setOverrides({});
  };

  const setToken = (token, value) =>
    setOverrides((prev) => ({ ...prev, [token]: value }));

  const resetToken = (token) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[token];
      return next;
    });

  const submit = (e) => {
    e.preventDefault();
    const result = onSave({ name: name.trim(), basedOn, overrides });
    if (result && result.ok === false) setError(result.error);
  };

  return createPortal(
    <div
      className="wp-modal-overlay no-print"
      onMouseDown={(e) => {
        // Only a press that starts on the backdrop dismisses; a drag that ends
        // there after starting inside the dialog must not.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        ref={dialogRef}
        className="wp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit custom theme' : 'New custom theme'}
        onSubmit={submit}
      >
        <header className="wp-modal-head">
          <h2 className="wp-modal-title">
            {editing ? 'Edit custom theme' : 'New custom theme'}
          </h2>
          <button
            type="button"
            className="wp-close"
            onClick={onCancel}
            aria-label="Close"
          >
            &times;
          </button>
        </header>

        <div className="wp-modal-body">
          <div className="wp-field">
            <label className="wp-modal-label" htmlFor="wp-theme-name">
              Name
            </label>
            <input
              id="wp-theme-name"
              ref={nameRef}
              className="wp-text"
              type="text"
              maxLength={30}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="wp-field">
            <label className="wp-modal-label" htmlFor="wp-theme-base">
              Base preset
            </label>
            <select
              id="wp-theme-base"
              className="wp-select"
              value={basedOn}
              onChange={(e) => changeBase(e.target.value)}
            >
              {PRESET_NAMES.map((preset) => (
                <option key={preset} value={preset}>
                  {PRESET_LABELS[preset]}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="wp-modal-section">
            <legend className="wp-modal-label">Colours</legend>
            {EDITABLE_TOKENS.map((token) => (
              <ColorPicker
                key={token}
                token={token}
                label={TOKEN_LABELS[token]}
                value={merged[token]}
                overridden={Object.prototype.hasOwnProperty.call(
                  overrides,
                  token,
                )}
                onChange={(value) => setToken(token, value)}
                onReset={() => resetToken(token)}
              />
            ))}
          </fieldset>

          <section className="wp-modal-section">
            <span className="wp-modal-label">Preview</span>
            <style>{previewCSS}</style>
            <div className="wp-theme-preview" data-theme={PREVIEW_THEME}>
              <div
                className="markdown-body wp-theme-preview-body"
                // Rendered by the same markdown-it instance the app uses, so the
                // preview cannot drift from the real output.
                dangerouslySetInnerHTML={{ __html: sampleHtml }}
              />
            </div>
          </section>

          {error && (
            <p className="wp-modal-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="wp-modal-foot">
          <button type="button" className="wp-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="wp-btn-primary"
            disabled={name.trim().length === 0}
          >
            Save
          </button>
        </footer>
      </form>
    </div>,
    document.getElementById('modal-root') ?? document.body,
  );
}
