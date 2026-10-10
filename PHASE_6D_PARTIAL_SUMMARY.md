# Phase 6d — Partial

**Stopped after 6d.1.** HTML export ships complete. **6d.2 (DOCX) is not
started, and I am not starting it without a decision from you** — the library
the spec names does not exist, and the one that does is GPL. See §6.

## 1. Commits

| | SHA | Title |
|---|---|---|
| 6d.1 | `77321aa` | split button, format menu, self-contained HTML export |

On `main`, local, **not pushed**. Parent `0e276d9` (Phase 6c.2). Explicit
23-path pathspec.

## 2. Bundle

| Stage | main | precache | dist |
|---|---:|---:|---:|
| 6c.2 (`0e276d9`) | 294.90 KB gz | 4077.76 KiB (92 entries) | 28 MB |
| 6d.1 | **298.19** | **4087.48 KiB (93 entries)** | 28 MB |

**+3.29 KB gzip.** The split button, the menu, the registry, the format hook,
the dispatcher and the whole HTML exporter. No new lazy chunk — the exporter
reuses the Preview and mermaid chunks the app already loads, so nothing needed
`globIgnores` treatment.

## 3. HTML export

**696 KB** for `tests/fixtures/export-full.md` (frontmatter, six heading levels,
nested lists, task list, blockquote, two highlighted code blocks, a table,
inline + display math, mhchem chemistry, two callouts, a mermaid flowchart).

### Font inlining

**557 KB of that is fonts** — 20 `@font-face` rules across five families:
`Inter Variable`, `JetBrains Mono Variable`, `KaTeX_Main`, `KaTeX_Math`,
`KaTeX_Size2`.

The spec offered by-unicode-range matching with "include every family that
appears loaded" as a safe fallback. **I used the fallback plus one refinement**,
because the fallback alone was measurably wrong:

> The Settings panel renders each font pill *in the face it names*. Opening the
> panel loads all three document faces whether or not the document uses any of
> them — so `document.fonts` reported Source Serif as loaded and it rode along in
> every export at roughly 200 KB.

Faces the exported file can never select are now dropped. What it can select is
the chosen body face, Inter (callout titles read `--wp-font-family-ui`),
JetBrains Mono (every code span), the KaTeX faces, and whichever language faces
the page loaded for this document's script. That took the export from **934 KB
to 696 KB, a 25% cut**, with no visual change.

Full by-unicode-range filtering would cut further — Inter alone still ships
several subsets the fixture never uses — and is the obvious next improvement.

### Cross-origin stylesheet skips

**None.** Every stylesheet is same-origin, so `collectAndInlineCSS` logged
nothing. The `try/catch` around `.cssRules` stays, since a future CDN font or
analytics sheet would otherwise throw mid-export.

### Screenshots

`PHASE_6D_SUMMARY_assets/standalone-{light,dark,custom}.png` — the exported file
opened from `file://` in a browser that has never seen WaynePDF. The custom one
is "Ocean", a Dark-based custom theme with two overridden tokens.

## 4. Two bugs the screenshots caught and the tests did not

Both shipped green through eleven passing e2e tests before I looked at the
output.

**The frontmatter was printed as body text.** The exporter called `md.render`
directly; the preview uses `renderDocument`, which strips the YAML block and
honours the sanitize setting. Every exported file opened with
`title: … author: … date: …` across the top. Now fixed, with a regression test
asserting the block is absent from the body and present in `<title>`.

**The document had no measure.** `.markdown-body` carries no padding or width of
its own — on screen the `.preview` wrapper supplies both (6.5b). A standalone
file has no wrapper, so it rendered flush to both window edges at whatever width
the window happened to be. The export now appends its own page frame in the same
tokens, with a test asserting the measure holds at a 1600px viewport.

Neither was visible to any assertion I had written. Both were obvious in a
screenshot.

## 5. The invariant test was wrong on its first writing — again

The 6c.2 lesson repeated almost exactly, and I want it on the record.

I wrote: *assert no request whose URL is not `file://`.* It passed. Then I
sabotaged the font inliner to emit the original `@font-face` rules and **it still
passed** — because the app's font URLs are relative, so from
`file:///tmp/doc.html` they resolve to `file:///assets/inter-latin.woff2`. Still
`file://`. Just pointing at nothing.

The invariant that actually holds for a self-contained file is that **it requests
nothing but itself, and nothing it requests fails**. That version fails on the
sabotage and passes on the fix. Both directions verified.

Two other tests in the same file *did* catch the sabotage, so the suite was not
blind — but the one named for the property was the one that lied.

## 6. 6d.2 — NOT STARTED, and blocked on a decision

I stopped before writing any DOCX code, because probing the dependency turned up
two things that are yours to decide, not mine.

### The library in the spec does not exist

```
$ pnpm view @wcj/pandoc-wasm version
ERR_PNPM_FETCH_404  ...  Not Found - 404
```

Not renamed, not deprecated — absent from the registry. `@wcj/pandoc` is also
404.

### What does exist is bigger and differently licensed

| | spec assumed | actual |
|---|---|---|
| Package | `@wcj/pandoc-wasm@^0.1.11` | `pandoc-wasm@1.1.0` |
| Publisher | "maintained fork" | **the official pandoc org** (`github.com/pandoc/pandoc-wasm`) |
| Size | ~5 MB | **55.9 MB unpacked** |
| Licence | not stated | **GPL-2.0-or-later** |

Last published 2026-06-11, so it is alive and maintained — the spec had the
provenance backwards. `wasm-pandoc@1.0.1` is the same binary under another name,
also 55.7 MB and also GPL.

**Two blockers:**

1. **Licence.** WaynePDF is MIT (`LICENSE`, plus `UPSTREAM_LICENSE` for
   realdennis's MIT). GPL-2.0-or-later is copyleft, and the ordinary reading is
   that distributing a combined work puts the whole distribution under GPL terms.
   That is not a call I should make quietly inside a feature commit, and it is
   not one a later refactor undoes once shipped.

2. **Size.** 55.9 MB, not 5. The spec's own check — "precache size shouldn't jump
   by 5 MB" — was written against a figure that is an order of magnitude out.
   `globIgnores` + `CacheFirst` keeps it out of the precache, but the first DOCX
   export in any session still pulls tens of megabytes. For an app whose pitch is
   "nothing leaves your machine" and whose entire current payload is 4 MB, that
   is a product decision.

### Options, for you

- **Ship DOCX on `pandoc-wasm` and relicense** WaynePDF as GPL.
- **Ship DOCX behind a clear boundary** — a separate opt-in that is not part of
  the MIT distribution. Needs legal care; I would not guess at it.
- **Drop pandoc and write a minimal DOCX writer.** A `.docx` is a zip of
  OOXML. Headings, paragraphs, lists, tables, images and task lists are a few
  hundred lines against `jszip`; math and precise styling are not. Stays MIT, is
  a fraction of a megabyte, and covers the "reasonable transformation" bar the
  spec set. **This is what I would suggest.**
- **Drop DOCX.** HTML already covers the portable-exchange case, and it is
  lossless where DOCX cannot be.

Everything except the last is a real session's work, so I would rather have your
answer than pick one.

## 7. Deviations, 6d.1

1. **`aria-disabled`, not the native attribute, on the DOCX menu item.** A
   natively disabled button cannot take focus, so arrow-keying through the menu
   skipped it silently and a screen reader would never announce that the format
   exists. The click guard enforces it.
2. **`deriveExportTitle` reuses `deriveDocumentTitle`** from 6b.1 rather than
   duplicating the Phase 5 logic. It already strips frontmatter and skips fenced
   code, so a shell example opening with `# install deps` cannot name the file.
   Only the fallback differs: a tab reads better as "Untitled", a download as
   "Document".
3. **The exporter appends a page frame** (§4). The spec's template assumed
   `.markdown-body` was self-sufficient; it is not.
4. **`safeFilename` keeps spaces and hyphens.** The first version stripped both,
   which turned "Q3 Report" into "Q3Report".
5. **The mermaid loader moved to `Lib/mermaidLoader.js`.** Exports need diagrams
   without mounting the component, and both paths must share the one
   module-level promise or the chunk is fetched twice.
6. **Diagram ids are positional** (`wp-export-diagram-0`), not random, so two
   exports of one document are byte-identical.
7. **Four browser globals added to `eslint.config.js`** (`fetch`, `btoa`,
   `atob`, `Image`).

## 8. Resolved incidentally

- **The Transform button is a real `<button>`.** It was a `<p class="button
  download">` inherited from upstream — unfocusable, unreachable by keyboard, and
  invisible to assistive technology as a control. Five test observers pointed at
  `p.button.download` and were updated.
- **PDF export left the Header.** The print flow was 60 lines inline in a layout
  component; it is now `Lib/exportPDF.js`. Behaviour is byte-identical — 6.5
  stabilised that pipeline and this phase does not re-enter it. This closes the
  first of the three "should be split" observations from the 6.5b summary.

## 9. Test counts

| | 6c.2 | after 6d.1 |
|---|---:|---:|
| Unit | 757 | **790** |
| E2E parallel | 259 | **280** |
| E2E paged | 58 | **58** |

**+33 unit, +21 e2e.** `pnpm lint` clean, `pnpm build` clean with no new
warnings. One new dependency-free fixture; **no new packages installed**.
`render.spec.js` picked up `export-full.md` automatically and its snapshot was
generated and verified stable over three repeats.

The known ~1-in-100 tab-drag flake from 6.5b appeared once during a full run and
passed 57/57 on a three-repeat re-run. Unchanged, still tracked.

## 10. Staged summaries

All ten prior summary files confirmed still **staged, not committed** — eleven
with this one.
