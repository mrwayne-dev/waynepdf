# Phase 6.5a — Polish Pass and PDF Pipeline Audit

**Bugs 1, 2, 3 and 5 are done. Bug 4 (UI polish) is not started** — the brief's
off-ramp, taken deliberately. See §5.

## 1. Commit

`74b0232` — *Phase 6.5a: PDF margins, PDF theme colours, font token split,
fragmentation*. Local on `main`, not pushed. Parent `77162ce`.

## 2. Bug 2 — no margins in the PDF

**Neither of the two candidates in the brief.** The layout CSS *was* reaching
the Polisher: `paginateInto` passes `[{ 'wp-layout.css': css }]`, and
`applyLayoutCSS` appends `PRINT_MARGIN_RESET` only to the document copy, never
to the Polisher's. And paged.js *was* insetting correctly — 94.4px, exactly
25mm at 96dpi.

The margin was destroyed after pagination, at print time. Measuring the box
chain under `emulateMedia({media:'print'})`:

| | `.pagedjs_sheet` | `.pagedjs_pagebox` | `.pagedjs_area` x |
|---|---|---|---|
| screen | `display: grid` | `display: grid`, cols `94.5px / 604.7px / 94.5px` | 665.1 (inset ✓) |
| print | `display: block` | `display: block` | **0** ✗ |

**paged.js expresses page margins as CSS grid columns on the page box.** The
grid survived; `display` did not. The culprit was in `src/App/index.jsx`:

```css
@media print { &, div { display: block; height: auto; } }
```

Ported from upstream md2pdf to flatten its flex layout for Firefox.
styled-components scopes it to `.hash div` — **every div in the app shell** —
which outranks paged.js's own `.pagedjs_pagebox { display: grid }` on
specificity. paged.js builds page geometry entirely from nested divs.

**Fix**: the rule is now `&` alone. The wrappers that genuinely need flattening
are listed by name in `print.css`, where a new `.wp-split` hook covers the
editor/preview splitter (its styled-components class is a hash no stylesheet can
name).

Verified with `pdftotext -bbox`:

| preset | measured `minX` | expected |
|---|---:|---:|
| small 15mm | 42.5pt | 42.5 |
| normal 25mm | 70.9pt | 70.9 |
| wide 35mm | 99.2pt | 99.2 |

Paged and Flowing agree to within a point.

> **This rule was a landmine for anything else that uses grid or flex in print.**
> It was not specific to paged.js.

## 3. Bug 3 — PDF colours don't match the theme

**Both hypotheses in the brief were wrong**, and I verified each before moving
on:

- *Suspect A — `data-theme` doesn't reach the render context.* It does.
  `.markdown-body` inside `.pagedjs_page_content` resolved the correct
  `--wp-color-canvas` and `--wp-color-fg` for all five themes.
- *Suspect B — `print-color-adjust: exact` doesn't apply to `.pagedjs_page`.* It
  does; Phase 5 already set it. Colours survive even with Chrome's "Background
  graphics" **off**, which is the default in the real dialog.

The actual cause: **the page box never carried the theme colour itself.**

In Paged mode it inherited one by accident. The pages live inside
`.preview-paged`, which is *also* a `.markdown-body`, and that element paints
`--wp-color-canvas` behind them. The Transform path builds its pages in
`#wp-print-target`, which has no such ancestor — so nothing painted the sheet.
The result was a correctly-themed band of body text sitting on an unpainted
white sheet, with the entire margin area and the running header the wrong
colour.

**Fix**: `.pagedjs_page { background-color: var(--wp-color-canvas) !important }`
in `print.css`, and `paginator.css` no longer clears it. Both paths are now
identical and depend on nothing behind the pages.

Verified by rasterising the PDF (`pdftoppm`) and sampling three corners —
top-left, top-right, bottom-right — for **5 themes × 2 paths, with
`printBackground: false`**. All 10 match their `--wp-color-canvas` exactly. Body
ink matches `--wp-color-fg`.

> **A methodology note worth recording.** My first sampler read the PPM header
> one byte short, which rotates every RGB channel by one. Dark's `#0d1117` came
> back as `#17_0d_11` and looked exactly like "the theme colours are wrong."
> I nearly reported a bug that did not exist. The parser in
> `tests/e2e/paged/_pdfPixels.mjs` is deliberately literal about the
> single-whitespace-byte rule, with a comment saying why.

## 4. Bug 1 — app chrome font architecture

**Did not reproduce.** I probed every chrome element under all three body-font
settings before changing anything:

| body font | header / tabs / settings / buttons | `.markdown-body` |
|---|---|---|
| Sans | Inter Variable | Inter Variable |
| Serif | **Inter Variable** | Source Serif 4 Variable |
| Mono | **Inter Variable** | JetBrains Mono Variable |

Chrome never followed the document font. It reads `--wp-font-family-sans`, which
`applyTheme` does not touch.

Two real problems remained, so the work was still worth doing:

1. **No token expressed the intent.** `--wp-font-family-sans` means "the sans
   stack" — a raw ingredient the user can *select as their document face*.
   Chrome needs "what the furniture is set in", which is a fixed decision. They
   are the same value today and that is a coincidence.
2. **`html` and `body` computed to Times New Roman.** normalize.css sets no
   `font-family`. Every chrome component happens to set its own, which is the
   only reason this never showed. The next one to forget would render in Times
   with nothing to explain why.

**Fix**: added `--wp-font-family-ui`, applied it to all chrome (Header, Settings,
Tabs, Toast, LazyLoad, EncodingBanner, paginator status, app shell), and set it
on `body` to close the Times hole.

**Left on `--wp-font-family-sans` deliberately** — printed document furniture,
not app chrome: the cover page, the TOC, the running header/footer margin boxes,
and the watermark. Callout titles and math annotations likewise. All four are
part of the artefact, and whether they should follow the user's body face is a
design question, not a bug. **Revisit-worthy.**

**One incidental consequence**: the mermaid snapshot changed. Mermaid measures
text in a node that inherits from `<body>` — previously Times, now Inter — so
diagram geometry shifted (viewBox height 259 → 271). The snapshot is
regenerated and stable over three repeats. This means **every mermaid diagram
rendered before this commit was laid out using Times metrics.**

## 5. Bug 4 — UI polish: NOT DONE

Not started. The brief's constraint is explicit: *"Do NOT ship partial UI polish
— either audit all listed components or none."* Nine components, a new spacing
and type scale, and eighteen screenshots is not something I could complete at
quality alongside four pipeline bugs in one session, and half of it is worse
than none.

Nothing in this commit touches spacing, sizing or padding. `--wp-space-*` and
`--wp-text-*` do not exist yet. **6.5b should start from a clean slate here.**

## 6. Bug 5 — fragmentation audit

Audited `paged-basic`, `paged-long`, `paged-tables`, `paged-mixed`, plus
synthetic oversized cases, measuring every element against its page content box.

| Check | Verdict |
|---|---|
| H1 forces a page break | **Correct.** 34 chapters → 34 pages, one H1 each. |
| First H1 does not force one | **Correct.** Shares page 1; no leading blank. |
| H2/H3 avoid break-after | **Correct.** No heading stranded at a page foot. |
| Table splits, `thead` repeats | **Correct.** 92-row table over 4 pages, header on each. |
| Code block, fits on a page | **Correct.** Kept whole. |
| Code block, taller than a page | **Misfired — fixed.** See below. |
| Blockquote, taller than a page | **Misfired — fixed** by the same change. |
| Images near a page edge | **Correct.** Moves to the next page, no overflow. |
| Long list splits | **Correct.** 120 items over 4 pages, no orphans. |
| Widows/orphans | **Correct.** No single-item page in any fixture. |
| Cover page interaction | **Correct.** Cover p1, first H1 p2. No blank sheet. |

### The misfire

Phase 5 gave `pre` and `blockquote` `break-inside: avoid`. That is right for a
short listing and **unsatisfiable** for one taller than the page: paged.js
honours it as far as it can and the surplus renders past the bottom of the page
box. A 90-line listing in `paged-mixed.md` **overflowed by 588px** — over the
footer and off the paper.

CSS cannot express "avoid unless you can't", so the decision moved to
`paginatorPreprocess.js`, where the layout is known. It counts each block's
lines, derives how many fit from the page size and margins, and sets
`break-inside: auto` inline on the ones that cannot. Line counting rather than
measurement, because the container is detached and every height would read 0 —
the same trap that makes paged.js hang inside `display: none`.

Also: paged.js tags split halves `data-split-from` / `data-split-to`, and each
half kept the whole element's padding, so a broken code block read as two
separate boxes. Their inner edges are now zeroed.

### Ambiguous — for Michael

**A residual 7–10px overflow at a split.** After the fix, a split `<table>`
overflows its content box by 7px and a split `<pre>` by 9–10px. It is *not*
padding — I removed that and it barely moved. It is a text line box rounding
past the break inside an element paged.js is fragmenting.

10px is 2.6mm into a 25mm bottom margin, so it does not reach the footer or the
paper edge, and I could not see it in rendered output. Options: accept it;
clip with `overflow: hidden` on the content box (risks silently hiding real
content); or shrink the content box by a line. **I left it, with the regression
guard set at 14px** so the 588px class of bug still fails loudly. Worth a
decision rather than a silent choice.

## 7. Deviations

1. **Bug 4 not attempted** (§5) — the brief's sanctioned off-ramp, though the
   brief pairs 6.5b as "UI polish + fragmentation audit" and I did the audit
   here. It was cheap once the PDF measurement tooling existed, and it is a
   pipeline concern, not a design one.
2. **Bug 1's regression test is e2e, not unit.** The brief asked for a unit test
   asserting `getComputedStyle(header).fontFamily`. jsdom applies no external
   stylesheets and resolves no custom properties, so a unit test would assert
   nothing. `tests/e2e/font-architecture.spec.js` checks eleven chrome elements
   against both Serif and Mono, plus a sweep for anything falling through to
   Times.
3. **`.wp-split` class added** to the Markdown splitter so `print.css` can name
   it. A styled-components hash cannot be targeted from a stylesheet.
4. **Bug 3's fix is not either remedy in the brief.** No per-theme stylesheet is
   passed to the Polisher and no `!important` blanket was added to `print.css`;
   both would have been treating symptoms of a cause that turned out to be
   neither.
5. **`resolvePageSize`/`resolveMargins` imported into `paginatorPreprocess.js`**
   from `useLayout.js`. They are pure functions already exported there;
   duplicating the page-dimension table would be worse.

## 8. Found incidentally

- **Every mermaid diagram ever rendered used Times metrics** for text
  measurement (§4). Fixed as a side effect.
- **`paginator.css` cleared the page background in print**, with a comment
  saying the on-screen sheet treatment must not reach paper. Correct for the
  box-shadow, wrong for the background — that clause was half of Bug 3.
- **The parallel e2e suite is near its timing budget.** One run of three showed
  four "byte-identical across five themes" tests timing out at 34s that pass in
  3.8s in isolation. Assertion failures never appeared, only timeouts, and two
  subsequent full runs were clean. Adding four font tests moved it closer to the
  edge. Worker counts are 6.0 territory and out of scope here, but **this will
  bite again** and the fix is probably splitting `render.spec.js`.

## 9. Staged summary files

Confirmed still **staged, not committed** — now eight, with this one:

```
A  PHASE_0_SUMMARY.md      A  PHASE_3_SUMMARY.md
A  PHASE_1_SUMMARY.md      A  PHASE_5_SUMMARY.md
A  PHASE_2_SUMMARY.md      A  PHASE_6B_SUMMARY.md
A  PHASE_3.5_and_4_SUMMARY.md
```

The commit used an explicit 18-path pathspec.

## 10. Test counts

| | before | after | delta |
|---|---:|---:|---:|
| Unit | 696 | 696 | 0 |
| E2E parallel | 229 | **233** | +4 |
| E2E paged | 33 | **58** | +25 |

**+29, against a brief that estimated +3.** The overage is deliberate: these
bugs all reached production through a suite that only ever inspected the DOM, so
the new tests read the artefact instead — `pdftotext -bbox` for position,
rasterised pixels for colour. Colour alone is 5 themes × 2 render paths.

New files:

- `tests/e2e/font-architecture.spec.js` — 4
- `tests/e2e/paged/pdf-fidelity.spec.js` — 15 (margins + colour)
- `tests/e2e/paged/fragmentation.spec.js` — 10
- `tests/e2e/paged/_pdfPixels.mjs` — helper: PPM parsing, pixel sampling, bbox

`pnpm lint` clean. `pnpm build` clean, no new warnings; main chunk 290.30 KB
gzip (+0.48), precache 4054.61 KiB. No dependencies added. IndexedDB and
localStorage schemas untouched.

## 11. For 6.5b

- **Bug 4 in full**: the 9 components, `--wp-space-*` / `--wp-text-*`, 18
  screenshots.
- The 7–10px split overflow decision (§6).
- Whether printed furniture — cover, TOC, running header/footer, watermark —
  should follow the user's body font (§4).
- `render.spec.js` is the likely cause of parallel-suite timing pressure (§8).
