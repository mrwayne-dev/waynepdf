# Phase 3.5 + Phase 4 — highlight.js slimming, then math

**Part A:** `2ff97375b71a2a373382f7ce5b65a823f122c1e9` (`2ff9737`) — Phase 3.5, highlight.js slimming.
**Part B:** `d9ac1d55e4bd6ccd31124654374a059abf11e7e8` (`d9ac1d5`) — Phase 4, KaTeX.

Both local on `main`, not pushed. Parent: `7bdaf3c` (Phase 3).
The four earlier summaries remain staged and uncommitted; both commits used an
explicit pathspec exclusion.

| | Unit | E2E |
| --- | ---: | ---: |
| Before (Phase 3) | 206 | 124 |
| After Part A | 348 | 124 |
| After Part B | **394** | **145** |

---

## Bundle sizes

Preview is the lazily-loaded chunk; it is the one that carries highlight.js and
KaTeX.

| Stage | Preview raw | Preview gzip | Precache | `dist/` total |
| --- | ---: | ---: | ---: | ---: |
| Phase 3 baseline | 1,005.51 kB | 349.45 kB | 3,312.92 KiB | 22.20 MB |
| After Part A | **266.33 kB** | **104.45 kB** | 2,562.74 KiB | 21.45 MB |
| After Part B | **569.14 kB** | **193.79 kB** | 3,142.47 KiB | 22.29 MB |
| Net A+B | −436.37 kB | −155.66 kB | −170 KiB | +0.09 MB |

Part A removed 739.18 kB raw / 245.00 kB gzip (−73.5% / −70.1%). Part B added
302.81 kB raw / 89.34 kB gzip back. **The chunk ends up 43% smaller than it
started**, with math added.

Precache tracks the Preview chunk, so it fell 750 KiB in Part A and rose 580 KiB
in Part B (the chunk plus 19 KaTeX WOFF2 fonts, 256 KB).

`dist/` barely moved because it is dominated by the 19 MB of Noto CJK subsets
from Phase 3.

---

# Part A — highlight.js

## What changed

`highlight.js` → `highlight.js/lib/core` with static registration, and
`highlightAuto` removed. Unlabeled and unknown-language fences render as plain
escaped code.

**44 modules, not 42.** The brief lists 45 language names, but TOML has no
module of its own — highlight.js handles it inside `ini`, which it literally
names "TOML, also INI" and which already registers `toml` as an alias. So: 44
modules, 45 resolvable names.

**Aliases mostly came free.** `registerLanguage` installs each module's own
alias list, covering js, jsx, mjs, ts, tsx, py, rb, sh, yml, md, tex, objc, cs,
c#, c++, cxx, cc, docker, text, txt, toml, html, svg, golang, rs, kt, hs, ex,
erl, clj, fs, gql, patch, pl, ps1. Only **`shell` and `zsh`** needed explicit
registration: highlight.js ships `shell` as a *separate* console-session
language that we deliberately do not register, so both would otherwise have
fallen through to plain text. 37 alias resolutions are pinned by tests.

## Snapshots regenerated (2)

| Snapshot | Why |
| --- | --- |
| `code-blocks-md` | The unlabeled SQL fence loses its auto-detected token spans. The fixture also gained six labeled fences (rust, sql, dockerfile, yaml, bash, tex) and a `made-up-lang` fence to cover the registered set and the unknown-language path. |
| `math-baseline-md` | Its ```` ```math ```` fence had been auto-detected as something template-ish, emitting 6 `hljs-template-variable` spans; it now renders plain. Part B replaced this fixture entirely. |

Both diffs were reviewed before regenerating: the `language-*` classes confirm
the six new fences highlight, `class="hljs"` count went 1 → 2 for the two plain
fences, and `<not-a-tag>` is escaped.

## Languages a user might reasonably expect that are absent

Worth knowing, since these now render plain rather than highlighted:

- **Vue / Svelte / Astro** single-file components — common in web repos.
- **Zig, Julia, OCaml, Elm, Solidity** — small but vocal communities.
- **Makefile, CMake, Gradle, Terraform/HCL, Protobuf** — build and infra files
  that appear in READMEs constantly. `Makefile` is probably the most likely to
  be missed of the whole set.
- **Console/shell-session** (`console`, `shell-session`) — the prompt-and-output
  format. `shell` is aliased to bash, which is close but does not dim the `$`
  prompt.
- **VB.NET, Delphi, Fortran, COBOL, Assembly.**

Each is one import plus one line. My suggestion if you want a follow-up: add
`makefile`, `cmake`, `terraform`, `vbnet` and `julia` — roughly +12 kB gzip.

## One stale test caught

`parses unlabeled fences via highlightAuto` still passed after the change — it
only asserted `<pre>` and `class="hljs"`, both still true — but its *name* had
become a lie. Renamed and tightened to assert the absence of token spans.

## Chunk-size warning

Preview is now 266 kB, under Vite's 500 kB threshold. The warning still fires,
but for the 758 kB **main** chunk (React + styled-components + CodeMirror +
jschardet), which is out of scope here. No suppression config existed and none
was added.

---

# Part B — KaTeX

## Three things in the brief could not work as written

Each was found by verifying rather than assuming, and each would have shipped
broken.

### 1. `output: 'html'` and the `data-latex` regex are mutually exclusive

The brief's regex scrapes `<annotation encoding="application/x-tex">`. KaTeX
only emits that element in its **MathML** output. With the brief's own
`output: 'html'` there is no MathML at all, so the regex matches nothing and
`data-latex` would never have existed — silently, with the copy button simply
never appearing.

**Approach used instead:** wrap the plugin's own renderer rules
(`math_inline`, `math_inline_block`, `math_inline_bare_block`, `math_block`, and
`fence`, which is how ```` ```math ```` is routed). Each rule's `tokens[idx].content`
*is* the LaTeX source, so the attribute is injected from the token rather than
recovered from rendered HTML. Exact, no regex over KaTeX output, and independent
of the `output` mode. The brief explicitly invited a cleaner alternative.

### 2. Two required plugin options default to off and were not in the brief

`enableFencedBlocks` and `enableBareBlocks` are both falsy by default in
`@vscode/markdown-it-katex`. Without the first, ```` ```math ```` renders as an
ordinary code block — objective 3 fails. Without the second, a `$$` block not
separated by blank lines stays inline. Neither failure is loud. Both are now
enabled and covered by tests.

### 3. mhchem registered on the wrong KaTeX instance

The one that actually made it into a screenshot before I caught it. KaTeX ships
conditional exports:

```
"./contrib/mhchem": { "require": "./dist/contrib/mhchem.js",
                      "import":  "./dist/contrib/mhchem.mjs" }
```

`import 'katex/contrib/mhchem'` takes the `import` branch and registers `\ce` on
the **ESM** KaTeX. `@vscode/markdown-it-katex` is CJS and renders with the
`require()` KaTeX. Two module objects, two macro registries — so `\ce{H2O}`
rendered as an unrecognised command tinted with `errorColor`, red and literal.

Importing `katex/dist/contrib/mhchem.js` puts the macros on the instance that
does the rendering. **Side benefit:** the ESM path had been pulling a second
complete copy of KaTeX into the bundle. Fixing it took **259 kB raw / 77 kB
gzip** off the Preview chunk.

This is invisible to unit tests — Vitest's resolution collapses the two
instances into one, so `\ce` worked there throughout. `tests/e2e/math.spec.js`
now carries a browser-level regression test, and the source has a comment
telling the next person not to "tidy" the import back.

## The delimiter rule is not the one the brief describes

The brief specifies pandoc's rule: opening `$` not followed by whitespace,
closing `$` not preceded by whitespace. The plugin implements something else —
a word-boundary check on the characters *outside* the delimiters. A `$` can open
only when preceded by start-of-input, whitespace or punctuation, and close only
when followed by the same.

Measured behaviour:

| Input | Result |
| --- | --- |
| `costs $5.99 and $10 here` | prose |
| `he owes $10 to me` | prose |
| `from $10 to $20` | prose |
| `It cost $30, then $40.` | prose |
| `USD $100 and EUR $200 totals` | prose |
| `$5 or $6?` | prose |
| `Total: $42 (paid)` | prose |
| `$ a + b$` | **math** (pandoc would refuse) |
| `$a + b $` | **math** (pandoc would refuse) |
| `a $ b $ c` | **math** (pandoc would refuse) |

The objective — currency does not become math — holds for every realistic case,
because a digit immediately after `$` blocks it from closing. The mechanism just
isn't the stated one, and the plugin is laxer about whitespace inside the
delimiters. Both the protected cases and the known laxity are pinned by tests so
a plugin upgrade that changes either is visible.

The brief's own fixture line, `costs $5.99, and $10, and $ has a space.`, does
render as math under this rule (the third `$` can close). I changed it rather
than ship a fixture asserting something false, and corrected the matching claim
in `InitialText`.

## A silent corruption in the default document

`InitialText.js` is a JS template literal, so a single-backslash LaTeX command is
destroyed before markdown-it ever sees it:

- `\pi` → `pi`, `\int` → `int`, `\sqrt` → `sqrt`, `\ce` → `ce` (unknown escapes
  drop the backslash)
- `\frac` → **U+000C form feed**, because `\f` *is* a valid escape

Nothing throws. The default document — the first thing every user sees — would
have rendered visibly broken maths. ESLint's `no-useless-escape` flagged it,
which is the only reason it surfaced. Backslashes are now doubled, and a
regression test asserts the section still contains `\pi`, `\int`, `\frac`,
`\sqrt`, `\ce{H2O` and no control characters.

## Other KaTeX quirks

- **`errorColor` and `.katex-error` are different paths.** A *parse* failure
  (`$\frac{1}{$`) produces `.katex-error`. An *unknown command* (`$\NotAMacro$`)
  under `strict:'ignore'` + `throwOnError:false` produces a normal `.katex` span
  with the text tinted `errorColor`. My first test asserted `.katex-error` for
  the latter and failed; corrected. This distinction is also why the mhchem bug
  slipped past the unit tests.
- `$$…$$` produces a `katex-block` wrapper *containing* `katex-display`, not
  `katex-display` directly. Assertions target `.katex-display`, which is present.
- Code is untouched: `` `$a^2$` `` and `` ```js const price = '$5' ``` `` both
  stay literal. Verified, as the constraint asked.

## Copy button and toast

- Delegated `mouseover` on the preview, one moving button rather than one per
  equation — a long document can hold hundreds.
- **Positioned above the equation's top-right corner, not on it.** Anchored
  inside the box (as the brief specifies) it covered short inline equations
  almost entirely — the first screenshot showed it sitting on top of `1 = 0`.
  Clamped so it cannot leave the viewport.
- Its portal host mounts inside `#waynepdf-app`, not `<body>`: the app's
  `.no-print` rule is scoped to its own subtree, so a host on `<body>` would
  have escaped it and could have reached the PDF. A global print guard in
  `app.css` backs that up.
- `Toast` is event-driven (`waynepdf:toast`) so callers outside React's tree can
  reach it. Reusable for later phases.
- Clipboard failure is reported ("Could not copy to clipboard") rather than
  silently appearing to work.

## Workbox

KaTeX's 19 WOFF2 fonts (256 KB) precache automatically under the Phase 3 glob —
verified, all 19 present in the manifest. No `globIgnores` needed; they are small
enough that the Phase 3 CJK treatment does not apply.

KaTeX also ships `.ttf` as a third `@font-face` fallback, which the Phase 3
plugin did not cover (it only handled `.woff`). Extended to `truetype`: another
**0.5 MB** of never-fetched files off the artifact. Total legacy fonts dropped
per build is now 952 files / 25.2 MB.

---

## Verification

| Check | Result |
| --- | --- |
| Preview chunk < 250 kB gzip after Part A | **104.45 kB** |
| Labeled fences highlight | Pass — 6 in the fixture + 44 unit-tested |
| Unlabeled / made-up fences render plain, escaped | Pass |
| KaTeX fonts in `dist` and in the precache manifest | 19/19 |
| Inline, display, bare-block, fenced math | Pass |
| Currency does not trigger math | Pass — 8 cases |
| `\ce` inline and display | Pass — incl. browser-level regression test |
| Malformed math is `.katex-error`, no crash | Pass |
| Copy button appears on hover, styled to theme | Pass |
| Clipboard receives the source; toast fades | Pass — `"e^{i\\pi} + 1 = 0"` |
| Settings toggle disables it, persists | Pass |
| Right-click stays native | Pass — no handler is registered |
| Math in the PDF as glyphs; no button, no toast | Pass — `pdffonts` shows KaTeX_Math-Italic, Main-Regular, Size2/3, AMS embedded as CID subsets |
| Math renders in all five themes | Pass — 5 tests + Light≠Dark colour check |
| `pnpm test` | **394** |
| `pnpm test:e2e` | **145** |
| `pnpm lint` | Clean |

---

## Deviations from the spec

1. **44 modules, not 42** — TOML is `ini`. Part A.
2. **`data-latex` by renderer-rule wrap, not regex** — the brief's regex cannot
   work with `output: 'html'`.
3. **`enableFencedBlocks` / `enableBareBlocks` added** — not in the brief's
   option list, and required for two of its own objectives.
4. **mhchem imported by CJS path** — dual-package hazard.
5. **KaTeX pinned to `^0.16.11` as specified.** Worth noting the bare
   `pnpm add katex` resolved to 0.18.4, which would have put a different KaTeX
   version's CSS against the plugin's 0.16 JS — mismatched metrics. The brief's
   pin exists for a reason; a single 0.16.47 now resolves everywhere, including
   from inside the plugin.
6. **Delimiter behaviour documented rather than forced to match pandoc.**
   Matching the brief's stated rule would mean reimplementing the plugin's
   inline parser, which the locked-in plugin choice argues against.
7. **Copy button above the equation, not inside its box.**
8. **Portal host inside `#waynepdf-app`**, plus a global print guard.
9. **`.ttf` added to the legacy-font stripper.** Not requested; 0.5 MB.
10. **`math-baseline.md` deleted, `math.md` added** — the brief offered either;
    replacing avoids two near-duplicate fixtures.
11. **Two tests updated beyond the brief:** the stale `highlightAuto` name in
    Part A, and a Phase 2 settings test that asserted an exact round-trip and
    now must account for `mathCopyEnabled` being filled in. The latter gained a
    companion test asserting that a pre-Phase-4 payload gets the default — which
    is why the storage key does not need a `v2` bump.
12. **`eslint.config.js` gained `CustomEvent`.**

## Assets

`PHASE_3.5_and_4_SUMMARY_assets/` (gitignored):

- `math-light.png`, `math-dark.png` — the fixture in both themes
- `math-copy-hover.png` — copy button revealed, equation unobscured
- `math-toast.png` — the toast after copying
- `math-error.png` — a malformed equation in danger colour
- `settings-math.png` — the panel's Math section
- `math-print.pdf` — printed output, evidence of KaTeX glyph embedding
