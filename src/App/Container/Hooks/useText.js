import useDocuments from './useDocuments.js';

/*
 * The editor's text, now a view onto the active document rather than the place
 * it lives.
 *
 * The `[text, setText]` pair is unchanged, so every consumer keeps working
 * untouched. The third slot carries the rest of the document API for the two
 * components that need it (the autosave indicator, and the tab strip); reach it
 * through `useDocumentsApi` in Container/index.js rather than by index.
 *
 * useDocuments is composed here rather than registered as its own container
 * because nonaction runs all container hooks in one component, above the context
 * they populate — see the note at the top of useDocuments.js.
 */
const useText = () => {
  const documents = useDocuments();
  return [documents.text, documents.updateActiveBody, documents];
};

export default useText;
