# Phase 6e Summary — Aborted

## Decision

Aborted after measurement. highlight.js stays.

Worth stating plainly, because it is the unusual part: **no abort criterion
triggered.** All three passed. The Preview chunk came in at 564.35 kB gzipped
against a 750 kB bar, theme integration needs no re-tokenization at all, and
not one semantic regression surfaced across 791 unit and 46 e2e tests. Read
literally, the brief said proceed.

The call went the other way because the criteria were written to test a premise
the measurements falsify. The phase opens with "the visual improvement over
highlight.js is real." In the only configuration WaynePDF can ship, it is
negative: 11 token variables against highlight.js's 40. The brief delegated the
decision to the scout precisely so a result like this could be acted on rather
than routed around.

## Commit

`44fecf9` — README section on syntax highlighting, plus a new backlog file.
Local on `main`, never pushed.

## Measurements (verbatim from design note)

## Measurements

### Bundle cost

Two engine configurations exist. Only one of them can be built at all.

| | dist total | js+css bytes | Preview raw | Preview gz | precache |
| --- | --- | --- | --- | --- | --- |
| **Baseline (highlight.js, 47 langs)** | 28 MB | 6,451,416 | 585.08 kB | **199.87 kB** | 4201.42 KiB |
| **Shiki, 47 langs, JS regex engine** | 31 MB | 9,525,104 | 3,651.61 kB | **564.35 kB** | 7203.07 KiB |
| Shiki, 12 langs, JS regex engine | — | — | 1,293.06 kB | 281.55 kB | 4893.15 KiB |
| Shiki, 47 langs, Oniguruma WASM | **cannot build** | | | | |

- **Preview chunk: 199.87 → 564.35 kB gz (+364.48 kB, +182%).** Raw: 585 kB →
  3.65 MB (+524%).
- **Precache: +3001.65 KiB (+2.93 MB, +71%)** on first visit.
- **New chunks: none.** Shiki's grammars are static imports and all land in the
  existing Preview chunk. No code-splitting happens on its own.
- The brief cites the baseline as 211 kB gz; the measured value at `f97eb86` is
  **199.87 kB**.

**The 47-language build fails on the default config.** At 3.67 MB raw the Preview
chunk exceeds `workbox.maximumFileSizeToCacheInBytes` (3 MiB, set in Phase 3.5),
and `vite-plugin-pwa` errors the build out rather than silently dropping the
chunk from the precache. The numbers above were obtained by temporarily raising
the ceiling to 8 MiB; that change was reverted. Shipping Shiki would mean either
raising that ceiling permanently or excluding the Preview chunk from the
precache — which breaks offline rendering, the app's whole posture.

Grammar weight is concentrated and unavoidable. `cpp` alone is **521 kB raw** —
larger than the entire current Preview chunk. `typescript` is 186 kB,
`javascript` 181 kB, `objective-c` 109 kB, `less` 105 kB.

#### Timings (Node 22, this machine)

| Step | Time |
| --- | --- |
| Import all 47 grammars | 168.9 ms |
| `createHighlighterCoreSync` (compile 47 grammars) | **983.0 ms** |
| First `codeToHtml` | 132.6 ms |
| **Total to first output** | **1284.5 ms** |
| Re-tokenize a 10 KB code doc | 134.2 ms first, **48.9 ms median** |

The 983 ms is the number that matters and it is not in the brief's model.
`createHighlighterCoreSync` compiles every registered grammar eagerly and
synchronously. In the browser that is a full second of blocked main thread
before the first paint of a preview — on the same code path Phase 3.5 shrank
specifically because highlighting was costing too much per keystroke.

**Verdict against criterion 1 (<750 kB Preview gzipped): PASS at 564.35 kB.**

### Theme integration

Shiki has two output modes. They fail in opposite directions.

**Dual-theme mode** (`themes: {light, dark}`) — what the brief describes:

```html
<span style="color:#D73A49;--shiki-dark:#F97583">const</span>
```

The light colour is a **hardcoded hex in `color:`**; only the dark variant is a
custom property. Switching themes means a stylesheet rule reassigning
`color: var(--shiki-dark)` under `[data-theme="dark"]`. That works, and needs no
re-tokenization — but it works for **exactly two themes**. WaynePDF has five
built-in themes and, since 6c, an unlimited number of user-defined ones. Sepia,
High-Contrast and Print-Optimized would all have to borrow Light's or Dark's
palette, and every 6c custom theme would fall through `basePresetFor()` to one
of the two. That is a regression of a feature shipped two commits ago.

**CSS-variables mode** (`createCssVariablesTheme`) — not mentioned in the brief,
and it is the mode that actually fits:

```html
<span style="color:var(--wp-shiki-token-keyword)">const</span>
```

Fully var-native. It cascades through Phase 2's `data-theme` system untouched,
supports all five themes and every custom theme, and requires **no
re-tokenization on theme change at all**. The brief lists "Shiki ships a
CSS-var-native theming mode" as a future condition for revisiting. It already
shipped.

**But it costs the thing Shiki was wanted for.** Measured across 15 languages
with deliberately rich samples (regex, template literals, lifetimes, decorators,
attributes, heredocs, type parameters), the CSS-variables theme emits:

```
--wp-shiki-background          --wp-shiki-token-keyword
--wp-shiki-foreground          --wp-shiki-token-link
--wp-shiki-token-comment       --wp-shiki-token-parameter
--wp-shiki-token-constant      --wp-shiki-token-punctuation
--wp-shiki-token-function      --wp-shiki-token-string
                               --wp-shiki-token-string-expression
```

**11 distinct variables — 9 token types plus foreground/background.**

highlight.js already emits **40 token classes**: `.hljs-keyword`, `.hljs-type`,
`.hljs-built_in`, `.hljs-regexp`, `.hljs-symbol`, `.hljs-doctag`, `.hljs-meta`,
`.hljs-section`, `.hljs-selector-pseudo`, `.hljs-template-variable`, and thirty
more.

In the only mode compatible with WaynePDF's theme architecture, Shiki produces
**less** colour granularity than what is already shipping.

**Custom theme fallout**: none in CSS-variables mode — custom themes define the
11 variables like any other token. Severe in dual-theme mode: custom themes get
no representation and collapse onto their base preset.

**Verdict against criterion 2: PASS.** No re-tokenization is required in
CSS-variables mode. The 10 KB re-tokenize measurement (48.9 ms median) is well
inside the 200 ms bar and is moot anyway.

### Regression surface

Wired in and run against the full suite (dual-theme + JS engine).

**Unit: 58 failed / 733 passed (791).** Files: `highlight.test.js` (52),
`callouts.test.js` (2), `math.test.js` (1), `parser.test.js` (1),
`sanitize.test.js` (1), plus one collection failure.

**E2E (export + math + mermaid subset): 1 failed / 45 passed.**

**Every failure traces to one cause and all are cosmetic.** The output element
shape changes from

```html
<pre><code class="hljs language-javascript">…
```

to

```html
<pre class="shiki shiki-themes …" style="…" tabindex="0"><code>…
```

There is **no `language-*` class and no `.hljs` class**. Tests asserting either
fail; nothing behaves incorrectly. The 52 `highlight.test.js` failures are that
file testing highlight.js's own registration and alias API, which would be
deleted rather than updated.

Point by point:

- **Math + inline code on one line** — `Text $x = 1$ and \`code\` together.`
  renders `class="katex"` correctly. KaTeX runs on the inline token stream
  before any highlighting; the two never interact. **No regression.**
- **Copy-latex** — `data-latex` survives; it is set by wrapped renderer rules,
  independent of the highlighter. **No regression.**
- **Sanitize / DOMPurify** — verified directly: `style="color:#…"`, the
  `--shiki-dark` custom property, and `tabindex` all survive sanitization.
  `FORBID_TAGS` lists `style` (the element), not the attribute. **No regression.**
- **DOCX export** — reads `md.parse()` tokens, never rendered HTML
  (`src/App/Lib/docx/parse.js:161`). Code blocks come from `fence` tokens with
  raw content. The highlighter is not on that path at all. All 10 DOCX e2e
  tests pass unchanged. **No regression.**
- **HTML export** — one failing assertion (`pre code.hljs` count is 0). The code
  is still highlighted and travels correctly, since Shiki's colours are inline
  styles rather than a stylesheet. Ironically this *simplifies* export: no
  highlight stylesheet needs collecting. **No regression, assertion is stale.**
- **Mermaid** — unaffected. The `language-mermaid` fence is special-cased ahead
  of the highlighter, so `MermaidRenderer`'s
  `pre > code.language-mermaid` selector still matches. All mermaid e2e pass.

**Verdict against criterion 3: PASS.**

### API corrections to the brief

- `shiki@^1.24.0` → latest is **4.4.3**.
- `createHighlighter` is async; the sync path is `createHighlighterCoreSync`
  from `shiki/core`, and it requires every grammar statically imported.
- `createJavaScriptRegexEngine` is exported from `shiki/engine/javascript`, not
  `shiki/core`.
- **Oniguruma is structurally unavailable.** `createOnigurumaEngine` is async and
  needs top-level await to reach a synchronous highlighter; the build target
  (`chrome87, edge88, es2020, firefox78, safari14`) rejects top-level await
  outright. markdown-it's `highlight` is synchronous, so the WASM engine can only
  be used behind a two-phase render. Its weight, for the record: **466,610 bytes
  raw / 148,439 gz.**
- Three of the 47 language names differ: `objectivec` → `objective-c`,
  `vbnet` → `vb`, and `plaintext` has no grammar (Shiki special-cases it).

## What changed in this commit

- `README.md` — new `### Syntax highlighting` section recording the evaluation
  and the numbers behind "marginal". The Roadmap section was also corrected: it
  still read **"Current state: Phase 2 complete"** and listed Shiki as upcoming
  work in Phase 6. Removing the stale Shiki reference was in scope; leaving the
  status four phases behind while committing the close of Phase 6 was not
  defensible, so both were fixed in the same edit.
- `POST_PHASE_6_BACKLOG.md` — new. Carries the Shiki entry with corrected
  revisit conditions, and collects the known limitations from 3.5, 3, 6b and
  6d.2 that were previously scattered across summary files.
- **No production code changed.** `git diff f97eb86..44fecf9 -- src/` is empty.

## One correction to the brief's revisit conditions

The backlog entry does not repeat the brief's third condition verbatim. The
brief says revisit if "Shiki ships ... a CSS-var-native theming mode." It
already has one — `createCssVariablesTheme`, measured at 4.4.3 — and it is
exactly the mode that fails, because it trades granularity for var support.
Waiting for a thing that already exists would have made the entry unactionable,
so the condition was rewritten to name the real blockers: token granularity
comparable to highlight.js's 40 classes, and a way to avoid eager synchronous
grammar compilation.

## A note on the reset instruction

The brief specified `git reset --hard` back to `f97eb86` after measurement.
That would have **deleted all twelve staged summary files** — they are staged
but never committed, so a hard reset drops them from the index and the working
tree alike. The measurement work was reverted with a targeted
`git checkout -- <paths>` plus `pnpm remove` instead, and the summaries were
tarred to the scratchpad first as insurance.

The restore was verified as byte-identical: the rebuilt Preview chunk came back
with the same content hash as the baseline build (`Preview-BEbRBuVT.js`,
585.08 kB / 199.87 kB gz) and the same precache total (4201.42 KiB).

## Verification

- `pnpm lint` clean.
- `pnpm build` clean — baseline restored exactly.
- Unit: **887 passed** (29 files).
- E2E parallel: **292 passed**.
- E2E paged: **58 passed**.

All three match the pre-6e counts exactly.

## What stays unchanged

Everything. highlight.js and its 47 language registrations, the alias table,
Phase 3.5's slimming, the four highlight stylesheets swapped by
`applyTheme.js`, Phase 2's CSS-custom-property theme system, and 6c's custom
themes.

## Confirmation

All twelve prior staged summaries are still staged-not-committed and unmodified.
This file makes thirteen. `PHASE_6E_DESIGN_NOTE.md` remains uncommitted in the
working tree, as specified.
