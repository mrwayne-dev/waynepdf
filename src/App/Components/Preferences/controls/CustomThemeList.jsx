import { useState } from 'react';
import { useProvided } from 'nonaction';
import { CustomThemesContainer, ThemeContainer } from '../../../Container';
import { customThemeId } from '../../../Lib/generateCustomThemeCSS.js';
import CustomThemeEditor from './CustomThemeEditor.jsx';
import './customThemeStyles.css';

/**
 * The custom-theme manager: the list with edit and delete, plus the button that
 * opens the editor.
 *
 * `inline` drops the disclosure header and renders the body open. Inside the
 * old 320px panel this had to collapse — it was one of ten things competing for
 * that column — but the preferences Themes section contains nothing else, and a
 * disclosure triangle guarding an otherwise empty page is a click that buys the
 * user nothing.
 */
export default function CustomThemeList({ inline = false }) {
  const [{ themes, count, atLimit, limit }, { create, update, remove }] =
    useProvided(CustomThemesContainer);
  const [, { setTheme }] = useProvided(ThemeContainer);
  const [open, setOpen] = useState(inline);
  // null = closed, 'new' = creating, otherwise the id being edited.
  const [editing, setEditing] = useState(null);

  const editingTheme =
    editing && editing !== 'new'
      ? themes.find((t) => t.id === editing)
      : undefined;

  const save = (draft) => {
    const result = editing === 'new' ? create(draft) : update(editing, draft);
    if (!result.ok) return result;
    // Activating on save is what makes the editor feel like it did something;
    // otherwise the user saves and the app looks unchanged.
    setTheme(customThemeId(result.id));
    setEditing(null);
    return result;
  };

  const confirmDelete = (theme) => {
    if (
      !window.confirm(
        `Delete the custom theme "${theme.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    remove(theme.id);
  };

  return (
    <div className={`wp-custom-themes${inline ? ' is-inline' : ''}`}>
      {inline ? (
        <p className="wp-custom-themes-count wp-hint">
          {count} of {limit} used
        </p>
      ) : (
        <button
          type="button"
          className="wp-collapsible-head wp-custom-themes-head"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="wp-collapsible-caret" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          Custom themes
          <span className="wp-custom-themes-count">
            ({count}/{limit})
          </span>
        </button>
      )}

      {open && (
        <div className="wp-custom-themes-body">
          {themes.length === 0 && (
            <p className="wp-hint">
              No custom themes yet. Start from a preset and change what you
              need.
            </p>
          )}

          {themes.map((theme) => (
            <div className="wp-custom-theme-row" key={theme.id}>
              <span
                className="wp-custom-theme-chip"
                data-theme={customThemeId(theme.id)}
                aria-hidden="true"
              >
                <span className="wp-swatch-band wp-swatch-canvas" />
                <span className="wp-swatch-band wp-swatch-fg" />
                <span className="wp-swatch-band wp-swatch-accent" />
              </span>
              <span className="wp-custom-theme-name" title={theme.name}>
                {theme.name}
              </span>
              <button
                type="button"
                className="wp-btn-ghost wp-btn-tiny"
                onClick={() => setEditing(theme.id)}
              >
                Edit
              </button>
              <button
                type="button"
                className="wp-btn-ghost wp-btn-tiny is-danger"
                onClick={() => confirmDelete(theme)}
              >
                Delete
              </button>
            </div>
          ))}

          <button
            type="button"
            className="wp-new-theme"
            disabled={atLimit}
            title={
              atLimit
                ? 'Custom theme limit reached. Delete one to create another.'
                : undefined
            }
            onClick={() => setEditing('new')}
          >
            + New custom theme
          </button>
        </div>
      )}

      {editing && (
        <CustomThemeEditor
          theme={editingTheme}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
