import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { initialText } from './InitialText.js';
import { parseFrontmatter } from '../../Lib/parseFrontmatter.js';
import {
  loadAllDocuments,
  loadMeta,
  saveDocument,
  saveMeta,
  deleteDocument,
} from '../../Lib/db.js';
import { registerReset, unregisterReset } from '../../Lib/resetAll.js';

/*
 * Documents, and the autosave that keeps them.
 *
 * Before this the editor's text was React state and nothing else — a refresh
 * threw the document away, and the app apologised for it with a beforeunload
 * prompt on every single navigation. Persistence removes both.
 *
 * Called by useText rather than registered as its own container. nonaction's
 * Provider invokes every container hook inside one component, above the context
 * it populates, so a container hook cannot read a sibling container — Phase 3
 * hit this with language detection and Phase 6a with frontmatter overrides.
 * Composing the two hooks keeps one store and leaves `[text, setText]` intact
 * for the dozen components that consume it.
 */

/** Long enough to coalesce a burst of typing, short enough to be invisible. */
export const AUTOSAVE_DEBOUNCE_MS = 1000;

export const UNTITLED = 'Untitled';

/**
 * A document's display title: its first h1, or "Untitled".
 *
 * Frontmatter is stripped first, and fenced code is skipped, because a shell
 * example opening with `# install deps` is otherwise the first `#` in the file
 * and would name the tab.
 */
export function deriveDocumentTitle(body) {
  const { body: text } = parseFrontmatter(typeof body === 'string' ? body : '');
  const lines = text.split('\n');
  let fence = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (fence === null) fence = char;
      else if (fence === char) fence = null;
      continue;
    }
    if (fence !== null) continue;

    // ATX, with the optional closing run of hashes trimmed.
    const atx = line.match(/^[ \t]{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/);
    if (atx) return atx[1].trim() || UNTITLED;

    // Setext: any non-blank line underlined with `=`.
    if (line.trim() && /^[ \t]{0,3}=+[ \t]*$/.test(lines[i + 1] ?? '')) {
      return line.trim();
    }
  }
  return UNTITLED;
}

function newDocument(body = '') {
  const now = Date.now();
  return {
    id: uuid(),
    title: deriveDocumentTitle(body),
    body,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Applies the stored tab order.
 *
 * Anything in the store but missing from the order is appended rather than
 * dropped — a half-written meta record must never lose a document.
 */
function orderDocuments(all, order) {
  const byId = new Map(all.map((doc) => [doc.id, doc]));
  const ordered = [];
  for (const id of Array.isArray(order) ? order : []) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  const leftovers = [...byId.values()].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
  return [...ordered, ...leftovers];
}

const useDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('saved');

  /*
   * Mirrored during render, not in an effect. The updaters below are called from
   * DOM events and need the current array synchronously; a ref written in an
   * effect would still hold the previous render's value when two updates land in
   * the same tick.
   */
  const docsRef = useRef(documents);
  docsRef.current = documents;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  /** The record waiting on the debounce timer, if any. */
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const write = useCallback(async (doc) => {
    setStatus('saving');
    try {
      await saveDocument(doc);
      setStatus('saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      setStatus('error');
    }
  }, []);

  /** Writes any debounced edit immediately. Safe to call when nothing is due. */
  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const doc = pendingRef.current;
    if (!doc) return Promise.resolve();
    pendingRef.current = null;
    return write(doc);
  }, [write]);

  const persistMeta = useCallback((docs, active) => {
    saveMeta({
      activeDocumentId: active,
      documentOrder: docs.map((doc) => doc.id),
    }).catch((err) => console.error('Saving document order failed:', err));
  }, []);

  /*
   * One-time bootstrap. The ref guard matters: StrictMode mounts, unmounts and
   * re-mounts every effect in development, and without it two overlapping reads
   * would both find an empty store and both migrate, leaving the user with two
   * copies of their first document.
   */
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const [all, meta] = await Promise.all([loadAllDocuments(), loadMeta()]);
        let ordered = orderDocuments(all, meta.documentOrder);
        let active = meta.activeDocumentId;

        if (ordered.length === 0) {
          // First launch, or first launch after this feature shipped: the
          // document the user would have seen becomes their first saved one.
          const doc = newDocument(initialText);
          await saveDocument(doc);
          ordered = [doc];
          active = doc.id;
          await saveMeta({
            activeDocumentId: active,
            documentOrder: [active],
          });
        } else if (!ordered.some((doc) => doc.id === active)) {
          active = ordered[0].id;
          await saveMeta({
            activeDocumentId: active,
            documentOrder: ordered.map((doc) => doc.id),
          });
        }

        setDocuments(ordered);
        setActiveId(active);
      } catch (err) {
        /*
         * Private-mode Firefox and some enterprise policies block IndexedDB
         * outright. Falling back to an unsaved in-memory document keeps the
         * editor usable; the indicator shows the failure rather than lying.
         */
        console.error('Loading documents failed:', err);
        const doc = newDocument(initialText);
        setDocuments([doc]);
        setActiveId(doc.id);
        setStatus('error');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updaters = useMemo(() => {
    const commit = (docs, active = activeIdRef.current) => {
      setDocuments(docs);
      if (active !== activeIdRef.current) setActiveId(active);
      persistMeta(docs, active);
    };

    return {
      /** Debounced. The only write path a keystroke touches. */
      updateActiveBody: (body) => {
        const docs = docsRef.current;
        const index = docs.findIndex((doc) => doc.id === activeIdRef.current);
        if (index === -1) return;
        // CodeMirror re-emits its buffer on mount, so every load and every tab
        // switch would otherwise schedule a write of identical content.
        if (docs[index].body === body) return;

        const updated = {
          ...docs[index],
          body,
          title: deriveDocumentTitle(body),
        };
        const next = [...docs];
        next[index] = updated;
        setDocuments(next);

        pendingRef.current = updated;
        setStatus('saving');
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
      },

      /** Creates without activating — the tab strip decides what to focus. */
      create: (title) => {
        const doc = newDocument('');
        if (typeof title === 'string' && title.trim()) doc.title = title.trim();
        const next = [...docsRef.current, doc];
        commit(next);
        write(doc);
        return doc.id;
      },

      open: async (id) => {
        if (id === activeIdRef.current) return;
        if (!docsRef.current.some((doc) => doc.id === id)) return;
        // Flush first: switching away must not leave the outgoing document's
        // last second of typing sitting on a timer that the switch invalidates.
        await flush();
        setActiveId(id);
        persistMeta(docsRef.current, id);
      },

      rename: (id, title) => {
        const docs = docsRef.current;
        const index = docs.findIndex((doc) => doc.id === id);
        if (index === -1) return;
        const clean = typeof title === 'string' ? title.trim() : '';
        const updated = { ...docs[index], title: clean || UNTITLED };
        const next = [...docs];
        next[index] = updated;
        setDocuments(next);
        write(updated);
      },

      duplicate: (id) => {
        const docs = docsRef.current;
        const index = docs.findIndex((doc) => doc.id === id);
        if (index === -1) return null;
        const source = docs[index];
        const copy = {
          ...newDocument(source.body),
          title: `${source.title} (copy)`,
        };
        // Directly after the original, which is where a user looks for it.
        const next = [...docs];
        next.splice(index + 1, 0, copy);
        commit(next);
        write(copy);
        return copy.id;
      },

      /*
       * Deletes outright. Closing a tab and deleting a document are the same
       * action here — a "closed but retained" state would need its own UI to
       * get back to, and nothing in this phase provides one.
       */
      remove: (id) => {
        const docs = docsRef.current;
        const index = docs.findIndex((doc) => doc.id === id);
        if (index === -1) return;

        // Never leave the user with no document at all.
        const next =
          docs.length === 1
            ? [newDocument('')]
            : docs.filter((d) => d.id !== id);

        let active = activeIdRef.current;
        if (active === id) {
          // The neighbour to the right, or the new last one if there is none.
          active = (next[index] ?? next[next.length - 1]).id;
        }

        if (pendingRef.current?.id === id) {
          clearTimeout(timerRef.current);
          pendingRef.current = null;
        }

        commit(next, active);
        if (docs.length === 1) write(next[0]);
        deleteDocument(id).catch((err) =>
          console.error('Deleting document failed:', err),
        );
      },

      reorder: (order) => {
        const docs = docsRef.current;
        const next = orderDocuments(docs, order);
        if (next.length !== docs.length) return;
        commit(next);
      },

      /** In-memory only; resetAll has already emptied the stores. */
      reset: () => {
        clearTimeout(timerRef.current);
        pendingRef.current = null;
        setDocuments([]);
        setActiveId(null);
        setStatus('saved');
      },

      flush,
    };
  }, [flush, write, persistMeta]);

  useEffect(() => {
    registerReset('documents', updaters.reset);
    return () => unregisterReset('documents');
  }, [updaters]);

  /*
   * Three guards, because none of them is reliable alone. The debounce covers
   * normal typing; visibilitychange covers switching tabs or apps, which on
   * mobile is the last event before the page may be discarded; beforeunload is
   * a best-effort kick for a same-second close. It deliberately does not call
   * preventDefault — the write is fire-and-forget, not a reason to nag.
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onUnload = () => {
      flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flush]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeId) ?? null,
    [documents, activeId],
  );

  return {
    documents,
    activeId,
    activeDocument,
    text: activeDocument?.body ?? '',
    status,
    ready,
    ...updaters,
  };
};

export default useDocuments;
