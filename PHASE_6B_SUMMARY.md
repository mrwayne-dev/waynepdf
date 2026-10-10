# Phase 6b — Persistence

All three internal commits landed. Autosave, multi-document tabs, and a reset
registry are in.

## 1. Commits

| | SHA | Title |
|---|---|---|
| 6b.0 | `975a434` | reset registry + retrofit existing containers |
| 6b.1 | `fe0be85` | IndexedDB persistence, autosave, TextContainer proxy refactor |
| 6b.2 | `77162ce` | multi-document tab strip with rename, duplicate, drag-reorder |

All on `main`, local, **not pushed**. Parent `3a46128` (Phase 6a). Every commit
used an explicit pathspec; the six `PHASE_0`–`PHASE_5` summaries remain staged
and uncommitted.

## 2. Bundle

| | main | Preview | pagedjs | mermaid.core | precache |
|---|---:|---:|---:|---:|---:|
| 6a (`3a46128`) | 284.97 KB gz | 211.08 | 100.93 | 139.37 | 4036 KiB |
| 6b.0 | 286.68 | 211.08 | 100.93 | 139.37 | 4041 |
| 6b.1 | 288.35 | 211.08 | 100.93 | 139.36 | 4046 |
| 6b.2 | **289.82** | 211.08 | 100.93 | 139.36 | **4053** |

**+4.85 KB gzip on main across the whole phase** — `idb`, `uuid`, the document
store, and the tab strip. Nothing else moved; no new lazy chunk was warranted for
a payload this size.

**Correction to the 6a report.** That summary gave main as 297.29 KB gz. Rebuilding
`3a46128` in a clean worktree gives **284.97**. The 297 figure was stale — captured
before 6a's own mermaid chunk-routing fix. Deltas above are against the real number.

## 3. Autosave

**Debounce stayed at 1000ms.** Nothing in testing argued for changing it.

Three guards, and they are not equally reliable:

| Guard | Reliability |
|---|---|
| 1000ms debounce | The real mechanism. |
| `visibilitychange` → hidden | Reliable. Covers tab/app switching, and on mobile the last event before discard. |
| `beforeunload` | **Best effort only.** |

`beforeunload` cannot await an IndexedDB write, so the guard fires the write and
returns. Chromium honours it sometimes. **I did not write a test asserting that an
edit in the final second before a reload survives** — that test would be asserting a
coin flip. The exposure is up to 1s of typing on an immediate close; it is listed
under known gaps, not papered over with a retry.

The listener does **not** call `preventDefault`. `autosave.spec.js` asserts via
`page.on('dialog')` that reloading with a pending edit raises nothing, and a unit
test asserts `defaultPrevented === false`. The upstream nag in `main.jsx` is deleted.

**Race found and fixed (6b.2):** `open()` awaited the flush *before* switching the
active id. Clicking "+" and typing immediately put those keystrokes into the
**previous document**. `flush()` takes the pending record out of its ref
synchronously, so the switch is now first and the write is unaffected. Found by a
tab test losing text non-deterministically.

## 4. IndexedDB

Database `waynepdf`, version 1:

- `documents`, keyPath `id` → `{ id, title, body, createdAt, updatedAt }`
- `meta`, out-of-line → key `'app'` → `{ activeDocumentId, documentOrder }`

Order lives in `meta` because tab order is user-arranged, not derivable from any
document field. `updatedAt` is stamped inside `saveDocument` so every write path
agrees on what "last touched" means.

Migration is one-shot and idempotent: an empty store yields one document seeded
from `InitialText`. Edge cases handled and tested:

- **StrictMode double-mount.** Two overlapping bootstraps would both find an empty
  store and both migrate, leaving two copies of the first document. A ref latch
  makes the bootstrap run once.
- **Stale `activeDocumentId`** falls back to the first document.
- **Documents present but absent from `documentOrder`** are appended, never dropped.
- **IndexedDB unavailable** (private-mode Firefox, enterprise policy) falls back to
  an in-memory document with `status: 'error'` rather than a dead editor.

## 5. TextContainer refactor

**The spec's approach could not work.** It called for:

```js
const [{ activeDocument }] = useDocuments.useContainer();  // inside useText
```

`nonaction`'s `Provider` is `inject.forEach(c => store[c._id] = c.hook())` — every
container hook runs inside one component, *above* the context it populates, so a
container hook cannot read a sibling. Phase 3 hit this with language detection and
Phase 6a with frontmatter overrides.

`useDocuments` is therefore **composed into `useText`** rather than registered as its
own container — two containers over one hook would be two independent stores.
`useText` returns `[text, setText, api]`; the pair is byte-identical to before, and
`useDocumentsApi()` in `Container/index.js` reaches the third slot.

**Consumers needing changes: exactly one, and it was a real data-loss bug.**

`MirrorEditor` is an `UnControlled` CodeMirror pinned to `value={initialText}`.
Correct while the editor was the source of truth; wrong the moment text came from
IndexedDB. After every reload it showed the **default document while the preview
showed the saved one**, and the first keystroke would have pushed that stale buffer
over the user's real work.

Feeding it live text is not the fix — `UnControlled.componentDidUpdate` sets
`hydrated = false` on any `value` change, so it would replace the whole buffer on
every keystroke. It is now seeded **per document** and keyed on the active id, which
is also exactly what a tab switch needs.

Everything else (`Header`, `Markdown`, `FrontmatterWatcher`, `Preview`) was untouched.

## 6. Reset registry

Retrofitted: `theme`, `language`, `layout`, `frontmatter-overrides` (6b.0),
`documents` (6b.1).

**`language` and `frontmatter-overrides` were both missing from the old Reset** — the
exact failure mode the registry exists to prevent. Now covered by an e2e test.

The override store registers at **module scope**, not from a mount effect: it is a
singleton with three simultaneous `useOverrides` consumers, so an
unregister-on-unmount would pull the entry out from under the other two.

**The spec's `resetAll.js` would not have built.** It dynamically imports `./db` and
swallows the failure in a `try/catch`, on the reasoning that db.js does not exist yet
in 6b.0. Module resolution is a build-time concern that a runtime `catch` cannot
cover — `pnpm build` fails outright with `Could not resolve "./db"`. Verified
empirically before changing course. `db.js` was brought forward into 6b.0 and
imported statically, which also makes 6b.0 a genuinely working state.

Clearing order is storage first, then in-memory resetters, then reload. Reversing it
races: each container re-persists on change, so clearing last would leave defaults
written back before the wipe.

## 7. Tab strip

Hand-rolled reorder, ~110 lines, no library. HTML5 native drag was the other option
and is worse here: unstyleable mid-drag, and it brings a drag image nobody asked for.

- **4px threshold** separates click from drag, so clicking a tab to switch never reorders.
- **Rects measured once** at mousedown. Re-measuring makes the drop target oscillate
  as items restyle mid-drag.
- **Listeners on `window`**, not the tab — the cursor routinely leaves the strip.
- **Escape cancels** an in-flight drag.
- **A completed drag ends in a click** on the same element, which would otherwise
  activate the tab. A suppression flag consumes it, and clears on the next mousedown
  so a drag ending outside a tab cannot swallow the next genuine click.

**Overflow:** `overflow-x: auto` with a thin themed scrollbar. No cap on document
count; tested at 12 tabs that the strip scrolls and the last tab is reachable.

**Keyboard accessibility is partial.** Every control is a real `<button>`, reachable
by Tab, with visible focus rings; the active tab carries `aria-current="page"` and
the context menu is `role="menu"`. There is **no** arrow-key navigation between tabs,
no keyboard-driven reorder, and the context menu is right-click only. Phase 7.

## 8. Deviations

1. **`db.js` moved from 6b.1 to 6b.0** — the spec's dynamic-import trick fails the
   build (§6).
2. **`useDocuments` composed into `useText`, not its own container** — structurally
   forced (§5).
3. **Reload is injectable** (`resetAll({ reload })`). jsdom refuses to redefine
   `location.reload` ("Cannot redefine property"), so the spec's "mock
   `window.location.reload`" test is unwritable as stated.
4. **`remove(id)`, not `delete(id)`** — `delete` cannot be destructured without
   renaming at every call site.
5. **Reset button relabelled** "Reset to defaults" → **"Reset everything"**. It now
   deletes documents; the old label understated it.
6. **`fake-indexeddb` added to `tests/setup.js` globally** — jsdom ships no IndexedDB,
   so without it every component test would exercise the blocked-storage fallback
   instead of the path browsers take.
7. **The test hook writes through CodeMirror.** Writing straight to the container
   left the editor's buffer holding something else, and a later remount replayed it
   over the document — tab tests lost text at random. It is also the path a real
   file drop takes.
8. **Reset e2e asserts one default document, not an empty store.** `resetAll` empties
   it and the reload immediately re-runs migration. Asserting emptiness would assert
   a state no user ever sees.
9. **Five render snapshots repaired (6b.0), and three were already failing at 6a.**
   Their settle signal ignored mermaid, so three captured a transient loading badge
   for fixtures with no diagrams; mermaid ids (`Date.now()`) and task-list checkbox
   ids (`Math.random()`) were also baked in verbatim. Snapshots now wait for diagrams
   to finish and canonicalise both id families through a mapping table, so an
   `<input id>` that stopped matching its `<label for>` still shows as a diff.
   **This means the 6a report's claim of a green parallel suite was wrong** — 3 of
   193 were failing.
10. **`paged-preview.spec.js` selectors tightened** to `exact: true`. The
    "Paged Basic" fixture's tab label collided with the "Paged" mode button.

## 9. Screenshots

`PHASE_6B_SUMMARY_assets/` (gitignored):

- `tab-strip-3-docs.png`
- `context-menu.png`
- `autosave-indicator-states.png` — Saved / Saving… / Unsaved changes, stacked
- `reset-confirm.png` — the Settings panel with the Reset button. The confirmation
  is a native `window.confirm`, which is browser chrome and cannot be captured;
  its text is in `reset-confirm-message.txt`.

## 10. Known gaps closed incidentally

- **`beforeunload` nag** removed as scheduled.
- **Language settings and frontmatter overrides** joined Reset (§6).
- **Three long-standing snapshot failures** fixed (§8.9).
- **`.CodeMirror` duplicate-node workaround** is now applied in the test helpers too,
  not just `uploadFile.js`. The underlying leak still needs the CM6 migration.

## 11. Test counts

| | 6a (`3a46128`) | 6b.0 | 6b.1 | 6b.2 |
|---|---:|---:|---:|---:|
| Unit | 609 | 651 | 696 | **696** |
| E2E parallel | 193 *(3 failing)* | 195 | 210 | **229** |
| E2E paged | 33 | 33 | 33 | **33** |

Final state: **696 / 229 / 33, all passing.** `pnpm lint` clean, `pnpm build` clean.
`tabs.spec.js` and `render.spec.js` were each run with `--repeat-each=3` to confirm
the drag and snapshot fixes are not flaky.

## 12. Carried into 6c and beyond

- **6c** custom themes, **6d** HTML+DOCX export, **6e** Shiki — not started.
- **Up to 1s of typing can be lost** on an immediate tab close (§3).
- **CodeMirror 5 → 6** still deferred; still leaks a duplicate node under StrictMode.
- **No keyboard navigation between tabs** (§7).
- **No "closed but retained" documents.** Close deletes. A separate Delete in the
  context menu would imply a distinction that does not exist.
- **Terraform/HCL** — no highlight.js grammar available.
- **Per-block `dir`/`lang`** — container-level only.
- **PDF metadata and bookmarks** — not reachable through paged.js + browser print.
- **Manifest icon paths are root-absolute** while `base: './'`; breaks a subpath
  deploy. Open since Phase 1.
