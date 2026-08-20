/*
 * Global keyboard shortcuts.
 *
 * One listener, one place. Shortcuts bound inside the components they affect
 * only fire when that component happens to hold focus, which is exactly the
 * situation a global shortcut exists to avoid.
 */

/** Cmd on Apple platforms, Ctrl everywhere else. */
export const isAccelerator = (event) =>
  navigator.platform?.toUpperCase().includes('MAC') ? event.metaKey : event.ctrlKey;

/**
 * True when the event came from somewhere the user is composing text.
 *
 * CodeMirror is the reason this exists — it renders a real <textarea> that the
 * editor writes through, so a shortcut that does not check would steal
 * keystrokes mid-sentence. Inputs and contenteditable are checked too, since
 * the document title and the theme editor are both text fields.
 */
export function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('.CodeMirror')) return true;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Binds the global shortcuts and returns an unsubscribe.
 *
 * @param {object}   handlers
 * @param {Function} [handlers.togglePreferences]
 * @param {Function} [handlers.newDocument]
 * @param {object}   [options]
 * @param {Document} [options.target]
 */
export function bindShortcuts(handlers = {}, { target } = {}) {
  const root = target ?? document;

  const onKeyDown = (event) => {
    if (!isAccelerator(event) || event.altKey) return;

    /*
     * Shortcuts yield to text fields — with one carve-out.
     *
     * Yielding is specified rather than derived: Cmd+, is not a text-editing
     * key in any editor, so it could safely fire from inside CodeMirror. The
     * brief asks for the stricter rule, so the editor keeps its keystrokes.
     *
     * The carve-out is the preferences window itself. Opening it moves focus
     * into the search box, which is a text field — so without this the toggle
     * could open the window and then never close it, because every subsequent
     * press landed in the input it had just focused. Inside preferences the
     * accelerator still belongs to preferences.
     */
    const inPreferences = event.target?.closest?.('.wp-prefs');
    if (!inPreferences && isTypingTarget(event.target)) return;

    if (event.key === ',' && handlers.togglePreferences) {
      event.preventDefault();
      handlers.togglePreferences();
      return;
    }

    // Everything else still yields, preferences window or not: a Cmd+N while
    // naming a custom theme should type, not spawn a document.
    if (isTypingTarget(event.target)) return;

    if ((event.key === 'n' || event.key === 'N') && handlers.newDocument) {
      event.preventDefault();
      handlers.newDocument();
    }
  };

  root.addEventListener('keydown', onKeyDown);
  return () => root.removeEventListener('keydown', onKeyDown);
}
