export default (val) => {
  // Upstream used querySelector('.CodeMirror'), i.e. the FIRST match. Under
  // React 18 StrictMode, react-codemirror2 v8 mounts, tears down and remounts,
  // leaving TWO connected .CodeMirror nodes; only the most recent one is wired
  // to onChange, so writing to the first silently did nothing and file upload /
  // drag-and-drop appeared dead.
  //
  // The live instance is always the last one created. In production builds
  // StrictMode does not double-invoke effects, so there is exactly one node and
  // last === first — correct in both modes.
  //
  // The duplicate instance is a real leak in dev; the fix belongs in the editor
  // layer (CodeMirror 6 migration), which is out of scope for Phase 0.
  const nodes = document.querySelectorAll('.CodeMirror');
  const editor = nodes[nodes.length - 1];
  editor.CodeMirror.setValue(val);
};
// Little dirty solution.
