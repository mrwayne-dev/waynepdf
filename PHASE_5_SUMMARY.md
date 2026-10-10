# Phase 5 — Real PDF output via paged.js

**Preamble:** `045cfd074ad676bf01f5e8cd6e4283934c0939e7` (`045cfd0`) — five extra languages.
**Phase 5:** `85c95ce58ec56308217690c79379ad43ee1b4aa7` (`85c95ce`) — paged.js.

Both local on `main`, not pushed. Parent: `d9ac1d5` (Phase 4).
The five earlier summaries remain staged and uncommitted.

| | Unit | E2E |
| --- | ---: | ---: |
| Before (Phase 4) | 394 | 145 |
| After preamble | 409 | 145 |
| After Phase 5 | **538** | **188** |

---

## Preamble: four of five languages

**Terraform/HCL is not included.** highlight.js 11.9 ships no module for it, and
`highlightjs-terraform` is a 404 on npm — it would need a third-party grammar
vendored in, which is more than a "two-line diff" preamble should decide. `hcl`
and `tf` fences render as plain escaped code, and a test pins that absence so it
reads as a known fact rather than an oversight.

`makefile`, `cmake`, `vbnet`, `julia` registered; set is 44 → 48. `make`/`mk`/
`mak` and `vb` come free from the modules' own alias lists; Julia declares none,
so `jl` is explicit.

Preview chunk 569.14 → 579.17 kB raw (193.79 → 197.46 kB gzip) — +3.7 kB gzip.

---

## Bundle

| Chunk | Raw | Gzip | Loaded |
| --- | ---: | ---: | --- |
| `index` (main) | 782.63 kB | 270.26 kB | always |
| `Preview` (markdown-it, hljs, KaTeX) | 579.17 kB | 197.46 kB | on first render |
| **`pagedjs`** | **505.30 kB** | **100.93 kB** | on Paged entry or Transform |
| `Paginator` | 1.44 kB | 0.80 kB | with pagedjs |
| `PagedPreview` | 0.30 kB | 0.23 kB | with pagedjs |

`dist/` total 22.29 MB → 22.57 MB (+0.28 MB). Precache 79 → 83 entries
(3142 → 3672 KiB). Preview is unchanged from Phase 4 apart from the preamble's
+3.7 kB, and paged.js is genuinely absent from the initial load — verified as a
distinct chunk in `dist/assets/`.

paged.js came in at **101 kB gzip against the brief's ~150 kB estimate**.

## Pagination timing

Measured with `performance.now()` around the `Previewer.preview()` call, so the
800 ms debounce is excluded.

| Fixture | Size | Pages | First run | Re-run after a small edit |
| --- | ---: | ---: | ---: | ---: |
| `paged-basic` | 10.5 KB | 7 | 1627 ms | 125 ms |
| `paged-long` | 20.8 KB | 34 | 2077 ms | 569 ms |
| `paged-tables` | 4.2 KB | 5 | 1608 ms | 109 ms |
| `paged-mixed` | 2.3 KB | 8 | 1661 ms | 186 ms |

The ~1.6 s floor on every first run is module load and Polisher setup, not
fragmentation — `paged-tables` at 4 KB costs the same as `paged-basic` at 10 KB.
Re-runs are 8–13× faster because the module is warm. This is exactly why
pagination is a mode rather than a passive property of the preview, and why the
debounce is 800 ms.

---

## Six things in the brief could not work as written

Each was found by verifying, and each would have shipped broken.

### 1. `preview(content, [], target)` silently produces pages with no headers

Passing an empty stylesheet array is not neutral. paged.js's Polisher is the
only thing that parses `@page`, `@top-center`, `string-set` and
`target-counter` — browsers ignore all of them. With `[]` the layout CSS never
reaches it, and you get correctly fragmented pages with entirely empty margin
boxes. The generated CSS is now handed over as
`[{ 'wp-layout.css': css }]`.

(Note `[]` is at least *truthy* — passing `null` would have triggered
`removeStyles()`, which strips stylesheets out of the live document.)

### 2. `leader('.')` silently removes the TOC page numbers

`leader()` is in the Paged Media spec and implemented by neither paged.js nor
any browser. An unrecognised function invalidates the entire `content`
declaration, so the dots *and* the page numbers vanish together — no error, just
an empty `::after`. Replaced with a flex filler (`a::before` with a dotted
bottom border), which is why `buildToc` wraps each label in its own
`.wp-toc-label` span: the filler needs something to sit beside.

### 3. `attr(href url)` breaks the reference lookup

The spec form is `target-counter(attr(href url), page)`. paged.js's
`TargetCounters` handler collects *every* `Identifier` inside `attr()` as an
argument, so `url` becomes a bogus second argument and the lookup returns
nothing. `attr(href)` resolves.

### 4. A `display: none` print target cannot be paginated

paged.js fragments by measuring rendered element heights. Inside a
`display: none` container every height is 0, so it either throws or spins — and
Transform in Flowing mode appeared to do nothing at all. The target is
`position: absolute; left: -20000px; visibility: hidden` instead, and becomes
static and visible only under `@media print`.

### 5. Every printed document gained a trailing blank page

The one that took longest. paged.js consumes the `@page` margin itself — it
insets content inside each `.pagedjs_page` box and hands over sheets that are
already laid out. The browser then applied the same 25 mm again, so the boxes
stopped dividing evenly into browser pages and the accumulated drift emitted an
extra sheet. Fixed by two rules:

- a print-only `@page { margin: 0 }`, appended after the generated rule so it
  wins the cascade;
- `break-after: page` on `.pagedjs_page` (excluding `:last-of-type`), pinning one
  browser page to one paged.js page rather than trusting the heights to divide.

Verified: `pdfinfo` reports **7 pages for a 7-page preview**, with footers
reading `1/7` … `7/7`.

Worth knowing for the next phase: `pdftotext` still reports 8 sections for a
7-page PDF, because it emits a trailing form feed after the last page.
`tests/e2e/paged-print.spec.js` has a `pdfPages()` helper that drops the empty
tail.

### 6. The Transform handler scraped CodeMirror's DOM

It read the source via `document.querySelector('.CodeMirror').CodeMirror.getValue()`.
That is a second source of truth that can drift from what the preview renders.
It now reads `TextContainer`. My own e2e test is what exposed this: the printed
title came out "WaynePDF" instead of the fixture's heading, because the test hook
sets React state without touching CodeMirror.

## Also found and fixed

**Reset only cleared half the panel.** `Reset to defaults` called
`ThemeContainer`'s reset, leaving every layout setting in place — so page size,
margins, cover and watermark all survived a reset. One button in one panel now
resets both containers. Verification item 17 was what made me check.

## Watermark: `.pagedjs_page_content::before`

`.pagedjs_page::before` — the brief's first suggestion — does not work. paged.js
uses the page element's own pseudo-elements for its margin-box machinery, and
overwriting them breaks header and footer rendering outright. Attaching to
`.pagedjs_page_content` instead works, needs no `beforePageLayout` hook, and
keeps `z-index` layering simple (`content > *` gets `position: relative;
z-index: 1`).

The screen-suppression is `@media screen { .paginator-output ... { content: none } }`
scoped to the preview, so print always stamps it regardless.

**Testing note:** the watermark is rotated −45°, so `pdftotext` returns its
glyphs scattered across the page (`F`, `A R`, …) rather than the contiguous
word. It is genuinely in the PDF — visible in `paged-with-cover-toc-watermark.pdf`
and in `toc-pdftotext.txt` — but no substring assertion can see it. The e2e test
asserts the print-media computed style instead.

## Fragmentation edge cases

- **Tables taller than a page.** `break-inside: avoid` — the brief's rule for
  tables — makes an oversized table sit on one page and spill past its box,
  losing content. Tables are `break-inside: auto` with `thead { display:
  table-header-group }` (headers repeat) and `tr { break-inside: avoid }` (rows
  stay whole). `paged-tables.md` splits its 70-row table across pages with
  6 `<table>` elements for 3 source tables.
- **Residual overflow is ~6 px** on pages where a row does not divide evenly
  into the remaining height — 0.6 % of the box, sub-row rounding, not content
  loss. The e2e test allows < 12 px rather than 0.
- **Code, math, lists** fragment cleanly; `.katex-display` is
  `break-inside: avoid` so display equations are never cut.
- **`h1 { break-before: page }` dominates page count.** Wider margins produced
  *the same* 7 pages for `paged-basic`, because section breaks decide the count,
  not density. The e2e test asserts the content-box width shrank instead — page
  count was a poor proxy that would have passed while testing nothing.

## Files

**Added (14):** `Hooks/useLayout.js`, `Hooks/usePageCount.js`,
`Lib/generateLayoutCSS.js`, `Lib/paginatorPreprocess.js`,
`Previewer/Paginator.jsx`, `Previewer/PagedPreview.jsx`,
`Previewer/paginator.css`, `Components/LayoutStyles.jsx`,
`Settings/LayoutPicker.jsx`, 3 unit specs, 2 e2e specs, 4 fixtures.

**Changed (14):** `Header/index.jsx` (mode toggle, page count, new Transform),
`Previewer/index.jsx` (mode branch), `Settings/index.jsx` + `styles.css`,
`Container/index.js`, `App/index.jsx`, `markdown/print.css`, `InitialText.js`,
`pnpm-workspace.yaml`, `eslint.config.js`, `package.json`, plus four test files
updated for the new storage key count and the async Transform.

## Verification

All 22 checklist items pass. Highlights:

| Check | Result |
| --- | --- |
| pagedjs is its own chunk | 505.30 kB / 100.93 kB gzip |
| Preview chunk essentially unchanged | 197.46 kB gzip (was 193.79) |
| Page count badge matches `.pagedjs_page` | e2e |
| `{page}`/`{pages}`/`{title}` resolve in print | `Page 1 of 7` … as real digits |
| Cover prints first, no running header | e2e on extracted page 1 |
| TOC page numbers are digits | `Paged Basic 3`, `Introduction 4` — see `toc-pdftotext.txt` |
| Watermark prints | computed style + visible in PDF |
| PDF page count == preview page count | `pdfinfo` 7 == 7 |
| App chrome absent from every PDF | e2e over 8 chrome strings |
| Three localStorage keys | settings, language, layout |
| `rg 'window\.print' src/` | one match, in the Transform handler |
| `pnpm test` / `test:e2e` / `lint` | 538 / 188 / clean |

## Deviations from the spec

1. **Terraform/HCL omitted** — no module exists. Preamble.
2. **Stylesheets passed to `preview()`**, not `[]`.
3. **No `leader()`**; flex filler instead, and `buildToc` wraps labels.
4. **`attr(href)`**, not `attr(href url)`.
5. **Print target off-screen**, not `display: none`.
6. **`@page { margin: 0 }` + per-page `break-after`** for print, to kill the
   trailing blank page.
7. **Watermark on `.pagedjs_page_content::before`.**
8. **Transform reads `TextContainer`**, not CodeMirror.
9. **Reset clears layout too** — the brief's item 17 required it; the
   implementation as written did not do it.
10. **`usePageCount` is a separate container.** Derived runtime state, so it must
    never be normalised or persisted; Paginator produces it and Header consumes
    it, and they are siblings.
11. **Tables are `break-inside: auto`**, against the brief's `avoid`, which loses
    content on oversized tables.
12. **`pnpm-workspace.yaml`**: `core-js` and `es5-ext` builds explicitly denied.
    They arrive under pagedjs and their postinstalls only print funding banners;
    pnpm 10 blocks the install until they are decided either way.
13. **Paged e2e specs are serial with a 150 s timeout.** Seven parallel
    paginations saturate one CPU and time out even though every test passes in
    isolation.

## Assets

`PHASE_5_SUMMARY_assets/` (gitignored):

- `paged-preview-a4.png`, `paged-preview-letter-landscape.png`
- `cover-page.png`, `toc-with-page-numbers.png`, `watermark-draft.png`
- `settings-layout.png`, `header-mode-toggle.png`
- `paged-basic.pdf`, `paged-with-cover-toc-watermark.pdf`, `landscape-a5.pdf`
- `toc-pdftotext.txt` — extracted TOC showing resolved page numbers
- `timing.json` — the raw timing measurements
