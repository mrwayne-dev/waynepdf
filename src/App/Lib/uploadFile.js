/**
 * Loads text into the editor.
 *
 * Writes to EVERY connected CodeMirror instance, not to one chosen by position.
 *
 * Upstream used `querySelector('.CodeMirror')` — the first match. Under React 18
 * StrictMode, react-codemirror2 v8 mounts, tears down and remounts, leaving two
 * connected `.CodeMirror` nodes. Phase 0 changed this to the *last* node, on the
 * reasoning that the live instance is the most recently created one.
 *
 * That held only until something remounted the editor. Phase 6b.2 keys it on the
 * active document so a tab switch rebuilds it, and after that remount the
 * survivor is not reliably last — so dropping a file after switching tabs wrote
 * into a dead instance and appeared to do nothing at all.
 *
 * Picking the right one from the DOM is not possible: both nodes are connected
 * and both report a live `.CodeMirror`. Writing to all of them is, however,
 * unambiguous. react-codemirror2 guards its change handler with `if
 * (!this.mounted) return`, so an unmounted instance accepts the value and emits
 * nothing — the write is inert. Exactly one instance is mounted, so exactly one
 * dispatch reaches the store.
 *
 * The duplicate instance is still a leak; the real fix is the CodeMirror 6
 * migration deferred since Phase 0.
 */
export default (val) => {
  const editors = [...document.querySelectorAll('.CodeMirror')]
    .map((node) => node.CodeMirror)
    .filter((cm) => typeof cm?.setValue === 'function');

  if (editors.length === 0) {
    // The user's file would otherwise vanish with nothing said. Loud, but not
    // thrown: a failed load should not take the caller down with it.
    console.error('uploadFile: no CodeMirror instance is mounted');
    return;
  }

  for (const editor of editors) editor.setValue(val);
};
