# Phase 6.5c + 6c — Partial

**Stopped after 6c.2**, the first sanctioned off-ramp. Custom themes ship
complete and standalone. **6d (split button, HTML export, DOCX export) is not
started** — see §7.

## 1. Commits

| | SHA | Title |
|---|---|---|
| 6.5c | `a7a3d62` | fix drag-drop after tab switch (third StrictMode duplicate instance) |
| 6c.1 | `53cf31f` | custom themes hook, generator, CSS injection, swatch row |
| 6c.2 | `0e276d9` | custom themes editor modal, color picker, live preview |

All on `main`, local, **not pushed**. Parent `6670d1c` (Phase 6.5b). Every
commit used an explicit pathspec.

## 2. Bundle

| Stage | main | precache | dist |
|---|---:|---:|---:|
| 6.5b (`6670d1c`) | 290.97 KB gz | 4059.12 KiB | 27 MB |
| 6.5c | 291.03 | 4059.28 | 27 MB |
| 6c.1 | 293.02 | 4065.88 | 27 MB |
| 6c.2 | **294.90** | **4077.76** | 28 MB |

**+3.93 KB gzip for the whole phase.** The five preset palettes as JS, the CSS
generator, the hook, the modal and the colour picker. No new lazy chunk: the
editor's live preview reuses the existing Preview chunk rather than pulling the
renderer forward, so nothing new needed `globIgnores` treatment.

## 3. 6.5c — drag-drop after a tab switch

`uploadFile` wrote to one `.CodeMirror` node chosen by position. Phase 0 picked
the last, on the reasoning that the live instance is the newest — true at first
mount, false once 6b.2 keyed the editor on the active document, because a tab
switch remounts it and the survivor is not reliably last.

Writing to the wrong instance is **silent**: react-codemirror2 guards its change
handler with `if (!this.mounted) return`, so the value is accepted and nothing is
emitted. Dropping a file after switching tabs did nothing at all.

**Why writing to every instance is safe.** Exactly one instance is mounted at any
time. The unmounted ones take the value into their own buffer and dispatch
nothing, so precisely one change event reaches the store no matter how the nodes
are ordered. The isolation test confirms text does not cross tabs.

**The first version of the regression test was worthless** and I nearly shipped
it. It asserted "the drop worked", which passed against the old implementation
too — which of the two instances is live varies per run, and in this environment
the last one happened to be live. What actually discriminates is the invariant:
after a load, no instance may be left holding stale text. Verified **3/3 failing
on the old code, 12/12 passing on the fix.**

Two existing unit tests encoded the behaviour being removed — that it throws with
no editor mounted, and that the earlier instance is *not* written to — and were
replaced. A no-editor call now logs rather than throwing; silence would make a
dropped file vanish with nothing said.

Three-run stability: the parallel suite passed at 237, 246 and 259 tests across
the three commits with no flakes in these specs.

## 4. 6c — custom themes

### Model

`{ id, name, basedOn, overrides, createdAt, updatedAt }` in
`waynepdf.customThemes.v1`. A theme is **a preset plus a partial override map**
over eight editable tokens, capped at **10**.

**The generated block carries the full merged palette, not just the overrides.**
A partial block would inherit the rest from `:root`, which holds the *Light*
fallback — so a Dark-based theme would come out with Light's borders and muted
greys wherever the user had not set a colour. This is the single most important
detail in the generator and it has a test.

### Things that needed solving

**Code highlighting.** There is no highlight.js or CodeMirror theme for
`custom-*`. `basePresetFor()` maps a custom theme onto the preset it was built
on; without it a Dark-based custom theme paints a dark page and a light code
block. It lives as a module-level lookup beside the generator because
`applyTheme` runs outside React and `useTheme` cannot read a sibling container —
the same wall Phase 3 and 6a hit.

**The theme value outlives the theme.** The active choice and the theme list are
separate storage keys and either can be read first, so `isValidTheme` accepts any
`custom-{uuid}` rather than checking it against the list. Rejecting an id whose
theme had not loaded yet would silently reset the user's choice on every boot. A
selection pointing at a deleted theme resolves to its base preset at apply time,
and the caption still shows a name.

**Validation could not live in a setState updater.** The updaters return a result
to their caller — "name taken", "at the limit" — and the first version read a
variable assigned inside `setThemes(prev => ...)`. React is free to defer that
updater, so hitting the ten-theme cap reported *"Could not create the theme"*
instead of naming the limit, and only intermittently. Replaced with a synchronous
ref mirror, the same shape `useDocuments` uses. **Same class of bug as 6b.1.**

**`presetPalettes.js` duplicates the CSS.** Custom properties cannot be
enumerated from a stylesheet the browser has not matched, so the generator needs
the palettes as JS. The values were script-extracted from
`src/styles/theme/*.css`, and `tests/unit/presetPalettes.test.js` reads the CSS
back and fails on drift. **Consolidating the two into one source is Phase 7
work** — flagged as requested.

### Live preview

Renders the real `markdown-it` output under a scoped `[data-theme]` that only the
modal uses, so a draft is visible without touching the running theme.

The renderer is **fetched on open**, not imported statically: it is a 600 KB lazy
chunk the preview pane has already loaded, so the import resolves from cache
instead of dragging markdown-it, KaTeX and highlight.js into the main bundle for
a six-line sample.

Screenshot: `PHASE_6_PARTIAL_SUMMARY_assets/custom-theme-editor.png` — "Ocean
Deep" on a Dark base with three tokens customised and five inherited, live
preview showing the draft palette. `custom-theme-editor-in-context.png` shows it
over the app.

## 5. Deviations

### 6.5c

1. **No-editor call logs instead of throwing.** The old behaviour was an
   unhandled `TypeError` on `editor.CodeMirror`; the new one reports and returns.
2. **Two unit tests replaced rather than extended** — they asserted the removed
   contract directly.

### 6c.1

3. **`--wp-color-attention` and the derived tokens are not editable.** The spec's
   eight are exactly the eight shipped; noting that the other seven
   (`accent-emphasis`, `border-muted`, `neutral-muted`, `fg-subtle`, `attention`,
   two blockquote tokens) inherit from the base and cannot be reached from the
   UI. Two of them carry alpha and could not round-trip through
   `<input type="color">` anyway — there is a test pinning that every editable
   token is plain `#rrggbb` in every preset.
4. **`CustomThemesContainer` is a real container**, unlike 6b.1's `useDocuments`.
   It works here because nothing else needs to read it from *inside* another
   container hook — the one cross-container need (the highlight.js base lookup)
   is served by a module-level registry instead.
5. **A drift guard was added** (`tests/unit/presetPalettes.test.js`) that the spec
   did not ask for. Duplicated data without a guard is how two sources of truth
   quietly disagree.

### 6c.2

6. **Live preview shrinks by type size, not `transform: scale(0.6)`.** A
   transformed element still reserves its untransformed box, so the spec's
   approach needs a negative margin to reclaim the space — and a percentage
   margin resolves against **width**, which clipped the blockquote and code block
   off the bottom. Confirmed visually before changing it. Overriding
   `--wp-font-size-base` gives identical proportions, since everything inside
   `.markdown-body` is em-relative, with a box that is the size it looks.
7. **Enter in a hex field calls `preventDefault()`.** The rows sit inside the
   modal's `<form>`, so Enter was submitting and closing the whole editor instead
   of committing the colour.
8. **Backdrop dismissal is on `mousedown`, not `click`** — a drag that starts
   inside the dialog and releases on the backdrop must not close it.
9. **`#modal-root` added to `index.html`**, outside `#root`, so the modal is not
   clipped by the app shell's overflow and stacks above the panel's `z-index: 100`.

## 6. Resolved incidentally

- **The third StrictMode duplicate-instance bug is closed** (§3). All three known
  symptoms — dead file upload in Phase 0, the 6.5b test-hook failure, and this
  one — came from picking a CodeMirror instance by DOM position. Nothing does
  that any more. The duplicate instance itself remains; the real fix is still the
  CodeMirror 6 migration deferred since Phase 0.

## 7. Not done — 6d

Neither sub-phase started. Nothing in this commit range references exports.

- **6d.1** — Transform split button, format menu, `useExportFormat`,
  `exportDispatcher`, self-contained HTML export with CSS collection, base64
  font inlining and headless mermaid rendering, `tests/fixtures/export-full.md`,
  two e2e specs.
- **6d.2** — DOCX via pandoc-wasm, mermaid-to-PNG, callout pre-processing.

The Transform button is unchanged from 6.5b: a single accent-filled button that
prints. Stopping here was the brief's first named off-ramp, taken because 6d.1 is
a large body of work whose riskiest parts (font `src` extraction from
`document.styleSheets`, and loading the exported file over `file://` in a fresh
context to prove no network requests) are exactly the kind that need room to
measure rather than assume.

## 8. Test counts

| | 6.5b | after 6.5c | after 6c.1 | after 6c.2 |
|---|---:|---:|---:|---:|
| Unit | 696 | 698 | 757 | **757** |
| E2E parallel | 233 | 237 | 246 | **259** |
| E2E paged | 58 | 58 | 58 | **58** |

**+61 unit, +26 e2e parallel.** `pnpm lint` clean, `pnpm build` clean with no new
warnings. No dependencies added. IndexedDB untouched; one new localStorage key
(`waynepdf.customThemes.v1`), registered with the `resetAll` registry and covered
by an e2e that confirms Reset clears it.

## 9. Staged summaries

All nine prior summary files confirmed still **staged, not committed** — ten with
this one:

```
A  PHASE_0_SUMMARY.md    A  PHASE_5_SUMMARY.md      A  PHASE_6.5b_SUMMARY.md
A  PHASE_1_SUMMARY.md    A  PHASE_6B_SUMMARY.md     A  PHASE_6_PARTIAL_SUMMARY.md
A  PHASE_2_SUMMARY.md    A  PHASE_6.5_SUMMARY.md
A  PHASE_3_SUMMARY.md    A  PHASE_3.5_and_4_SUMMARY.md
```
