# Phase 6d.2 — DOCX Export

One commit. DOCX export is wired end to end and produces a file LibreOffice
opens, renders, and converts to PDF without a repair prompt.

**The brief's premise changed under it.** 6d.2 was specified as "DOCX via
pandoc-wasm". Phase 6d's summary already recorded that the named package does
not exist and that the real alternatives are large and copyleft-encumbered; the
brief for this phase resolved that by dropping pandoc entirely — "Do not add
pandoc-wasm. Do not add any GPL/AGPL/LGPL dependency" — and asking for a minimal
in-house OOXML writer instead. That is what shipped. **The commit message
therefore does not use the brief's stated text**, which still named pandoc-wasm.

## 1. Commit

`Phase 6d.2: in-house DOCX writer with mermaid PNG embedding`

Staged with an explicit pathspec. The eleven prior `PHASE_*_SUMMARY.md` files
remain staged and uncommitted, untouched.

## 2. What was written

1,173 lines across thirteen new files. No DOCX library — the package is built
byte by byte.

| File | Lines | Role |
| --- | --- | --- |
| `src/App/Lib/docx/parse.js` | 404 | markdown-it tokens → IR |
| `src/App/Lib/docx/buildDocument.js` | 332 | IR → `word/document.xml` |
| `src/App/Lib/exportPreprocess.js` | 144 | mermaid fence → PNG data URI |
| `src/App/Lib/docx/index.js` | 64 | `exportDOCX` entry point |
| `src/App/Lib/docx/pngDimensions.js` | 46 | IHDR reader for image sizing |
| `src/App/Lib/docx/buildPackage.js` | 38 | parts → zip |
| `src/App/Lib/docx/templates/*.js` | 122 | six static/rendered OOXML parts |
| `src/App/Lib/docx/xmlEscape.js` | 23 | escaping + illegal-codepoint stripping |

The IR in the middle is deliberate: it makes "did the parse understand this
document" and "did the OOXML come out right" two separately testable questions.
Going tokens-to-XML directly would turn every parsing bug into an unzip-and-read
investigation.

Only one dependency was added: **jszip 3.10.1**.

## 3. The license question, answered explicitly

`jszip`'s SPDX string is **`(MIT OR GPL-3.0-or-later)`** — the GPL appears in it.
The brief forbade GPL dependencies, so this needed checking rather than assuming.

It is a **dual license at the consumer's election**, not a conjunction.
`node_modules/jszip/LICENSE.markdown` opens: *"JSZip is dual licensed. At your
choice you may use it under the MIT license **or** the GPLv3 license."* WaynePDF
elects MIT, and no GPL obligation attaches. Transitive dependencies were checked
too, since a permissive top level over a copyleft transitive would be worthless:

`pako` 1.0.11 (MIT AND Zlib) · `lie` 3.3.0 (MIT) · `immediate` 3.0.6 (MIT) ·
`setimmediate` 1.0.5 (MIT) · `readable-stream` 2.3.8 (MIT)

All permissive. The constraint holds — but the SPDX string is not a bare "MIT",
and you should know that rather than discover it in an audit.

## 4. What survives the round trip

Verified by opening the generated file in LibreOffice 24.2.7.2 and rasterising
its pages (`PHASE_6D.2_SUMMARY_assets/libreoffice-page-{1,2}.png`):

Headings h1–h6 · bold, italic, strikethrough, inline code, hyperlinks ·
escaped reserved characters (`5 < 10 & 10 > 5`, `"quoted"`) · nested bullet
lists with ● ○ ▪ markers to three levels · ordered lists · task lists as ☒/☐
glyphs · blockquotes with a left border · fenced code blocks on a shaded ground ·
tables with borders and a shaded header row · callouts (`:::note`, `:::warning`)
as styled quotes · mermaid diagrams as correctly-sized embedded PNGs ·
document metadata (title, author, date) in core properties.

## 5. Documented limitations

Each was ruled out by the brief, and each is a real gap in the output rather than
a bug:

- **Math is source text, not typeset.** `$…$` and `$$…$$` render as monospace
  with their delimiters restored. Typesetting would mean emitting OMML.
  The delimiters are deliberate — without them a reader cannot tell `e^{i\pi}`
  from prose, and cannot paste it into Word's equation editor.
- **Code blocks are unhighlighted.** One monospace run per line.
- **Theme colours do not transfer.** The DOCX uses its own hand-written styles;
  6c custom themes affect the app and PDF only.
- **Adjacent code blocks merge into one shaded slab** in LibreOffice. See §7.

## 6. Bugs found by measuring, not by reading

- **Task-list items exported empty.** `markdown-it-task-lists` does not put item
  text beside the checkbox — it rewrites the inline children into raw HTML and
  buries the text *inside* `<label class="task-list-item-label">`. Dropping
  `html_inline` wholesale, correct for every other raw-HTML case, silently
  emptied every task item. Fixed by extracting from the label and decoding
  entities.
- **Math lost its delimiters.** The KaTeX plugin strips them into
  `token.content`. Re-added on the way out.
- **Image ids started at 2.** `docPrId` read the counter *after* incrementing it.
  The ordinal is now captured first and names both the part and the drawing.
- **Canvas tainting on diagram rasterisation.** Drawing an `<img>` from a blob
  URL taints the canvas in Chromium; `toDataURL` then throws. The SVG is
  generated in-page, so the taint is spurious — the origin check does not care.
  Fixed with a `data:` URL, encoded with `encodeURIComponent` rather than `btoa`
  (which throws above U+00FF, and diagram labels can contain anything).
- **Mermaid SVGs rasterised blank.** Mermaid emits `width="100%"`, which yields
  `naturalWidth 0`. The viewBox dimensions are now promoted onto the element.
- **Frontmatter rendered into the document body** — the same bug 6d.1's HTML
  export shipped. Now parsed and stripped in `exportDOCX`.

## 7. Deviations

**Adjacent code blocks still merge.** Two fences separated only by each other
render as one continuous shaded region in LibreOffice, despite
`contextualSpacing w:val="0"` and explicit `w:spacing` before/after on the first
and last line of each block. A block followed by prose now separates correctly.
The brief said "adjust once and note. Don't iterate" — this was adjusted twice
and then stopped. Content is correct; only the visual boundary is missing.
Untested in Word itself.

**`effectiveFormat` had a latent defect**, found by a test written for something
else. It returned the input id unchanged whenever `isFormatAvailable` was true —
and `formatById` falls back to PDF for unknown ids, so an id matching no format
at all reported as available and passed straight through. It now returns the
*resolved* format's id. Nothing user-facing reached this, because every id in
the UI comes from the registry.

## 8. Two tests inverted, both retrofitted observers

Both asserted that DOCX was *not* available — true through 6d.1, false now:

- `useExportFormat > stores docx but acts on pdf until the format is wired` →
  `acts on docx now that the format is wired`, plus two new tests that keep the
  degradation *mechanism* covered now that nothing is unavailable to demonstrate
  it end to end.
- `export-format-menu.spec.js > DOCX is present, disabled, and says why` →
  `all three formats are available and selectable`, plus persistence and
  real-dispatch tests per the brief.

## 9. Sabotage checks

The brief's rule — tests observe invariants, not discriminators — was verified by
breaking production code five times:

| Sabotage | Caught by |
| --- | --- |
| 1. Runs emit no text | 2 content tests |
| 2. Image relationships not declared | relationship-integrity test |
| 3. Diagram not rasterised | 2 tests |
| 4. Run text not escaped | 3 tests, **including LibreOffice refusing the file** |
| 5. Metadata dropped | metadata test |

**Sabotage 4 passed on the first attempt.** Unescaped output was still
well-formed XML because `tests/fixtures/export-full.md` contained no reserved
characters at all. The fixture gained a line with `<`, `>`, `&` and quotes, and
the sabotage then failed three tests. This is the third phase running in which an
invariant test passed against deliberately broken code — 6.5c's `uploadFile`
regression and 6d.1's font-inlining invariant were the first two.

## 10. Bundle

The DOCX writer and jszip land in a lazy chunk reached only when someone exports:

- DOCX chunk: **116.45 kB / 37.24 kB gzip**
- Main chunk: **872.73 kB / 298.28 kB gzip** — unchanged from 6d.1 (298.19),
  confirming nothing leaked into the eager path
- Precache: **94 entries / 4201.42 KiB** (was 93 / 4087.48)

**The chunk is precached deliberately**, not routed through `globIgnores` +
`CacheFirst`. That discipline exists for weight that is large and *conditional* —
the CJK fonts, and mermaid's multi-megabyte per-diagram-type chunks, which most
documents never touch. 116 kB is neither: it is one file, identical for every
user, and precaching it is exactly what makes DOCX export work offline. Adding it
to `globIgnores` would trade 114 KiB of install size for a feature that silently
fails on a plane.

`pnpm build` is clean apart from the pre-existing chunk-size advisory.

## 11. Test counts

| Suite | Count |
| --- | --- |
| Unit total | **887 passed** (29 files) |
| ├ `docx-parse.test.js` | 39 |
| ├ `docx-build.test.js` | 44 |
| └ `docx-package.test.js` | 12 |
| E2E parallel | **292 passed** |
| └ `export-docx.spec.js` | 10 |
| E2E paged | **58 passed** |

`tests/e2e/__snapshots__/…/export-full-md-parallel-linux.html` was regenerated
after the fixture gained the reserved-characters line.

The e2e suite includes a real-consumer check: LibreOffice headless opens the
generated `.docx` and converts it to PDF. A package Word would reject for
malformed XML fails there rather than in a hand inspection.

## 12. Screenshots

`PHASE_6D.2_SUMMARY_assets/` (gitignored):

- `Export Test Document.docx` — the generated file, 16.7 KB
- `Export Test Document.pdf` — LibreOffice's conversion of it, 83 KB
- `libreoffice-page-1.png`, `libreoffice-page-2.png` — both pages rasterised
- `export-menu.png` — the format menu with all three formats enabled

## 13. Staged summaries

Twelve `PHASE_*_SUMMARY.md` files are staged and uncommitted, this one included.
`PHASE_0` through `PHASE_6D_PARTIAL` were not modified.
