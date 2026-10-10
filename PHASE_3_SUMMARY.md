# Phase 3 — Unicode Correctness

**Commit:** `7bdaf3cdbe232653a5397ee1d2bab9b71c4c75da` (`7bdaf3c`), local on `main`, not pushed.
**Parent:** `1aefe6a` (Phase 2).
**Status:** all objectives met. 206/206 unit, 124/124 e2e, lint clean, build clean.

68 files changed, 3206 insertions, 64 deletions.
`PHASE_0/1/2_SUMMARY.md` remain staged and uncommitted — see deviations, I had
to correct one mistake there.

---

## Two defects found by measuring rather than assuming

Both were in the spec's own suggested implementation, and both would have
shipped silently.

### 1. The per-language font stacks never reached Noto

The brief's CSS is `font-family: var(--wp-font-family-body), "Noto Sans TC", …`.
`--wp-font-family-body` expands to the full Inter stack, which **ends in the
generic keyword `sans-serif`** — and a generic family never fails to match. It
resolves to the host's default font, so everything listed after it is dead code.

I only caught this because I instrumented actual network responses for the
runtime-fetch table: a Hebrew document fetched **zero** Noto files. The computed
stack was

```
"Inter Variable", Inter, …, sans-serif, "Apple Color Emoji", …, "Noto Sans Hebrew", David
```

Arabic and CJK *did* fetch Noto, but only because this host has no Arabic or CJK
system fonts. On a machine with them, none of the six would have loaded. That is
precisely the host-dependent output Phase 3 exists to eliminate — and it would
have passed a naive "does the computed stack contain Noto Sans Hebrew" test,
because the name is in the string, just unreachable.

Fix: a new `--wp-font-family-lead` token holding the bundled face *without*
generics. Each language stack is now `lead → script face → full body stack`, so
Noto sits ahead of every generic while the ordinary Latin fallbacks still apply
after it. Two regression tests pin it: one asserts the Noto index is below the
`sans-serif` index, the other asserts the file is actually downloaded.

### 2. Precaching the CJK fonts meant a 21.8 MB first visit

The brief predicted "this should Just Work — but confirm in the summary." It
works in the sense that the files land in the precache manifest. The result:

| | Before the fix |
| --- | --- |
| Precache entries | **953** |
| Precache size | **21.8 MB** |

Precaching is all-or-nothing at service-worker install, so every visitor would
download 21.8 MB before the app was usable offline, to support languages most
will never open. Noto TC/SC/JP/KR ship ~910 `unicode-range` subsets between them.

Fix: `globIgnores` excludes the four CJK families; a `CacheFirst`
`runtimeCaching` rule stores whichever subsets a document actually touches, on
first use, permanently (filenames are content-hashed, so it can never go stale).
Latin, Arabic and Hebrew stay precached — together only ~690 KB.

**Cost, stated plainly:** a CJK document now needs one online visit before it
works offline. Latin/Arabic/Hebrew are unaffected. I judged that better than a
21.8 MB install for everyone, but it is a real narrowing of the offline promise
and worth your review.

---

## Bundle size

| | Phase 2 | Phase 3 | Δ |
| --- | --- | --- | --- |
| `dist/` total | 2,076,168 B (1.98 MiB) | 22,202,319 B (21.2 MiB) | **+20,126,151 B (+969%)** |
| — fonts (WOFF2) | 483,800 B | 19,473,852 B | +18,990,052 B |
| — everything else | 1,592,368 B | 2,728,467 B | +1,136,099 B |
| Precache entries | 59 | 59 | 0 |
| Precache size | 3,318 KiB | 3,313 KiB | −5 KiB |

Breakdown of the non-font +1.1 MB: jschardet (~150 KB), the detector, the four
new hooks/libs, the banner and language picker, and the CJK `@font-face`
declarations themselves — 910 subset rules with long `unicode-range` lists is
~700 KB of CSS before compression.

**A third saving worth noting:** the non-variable fontsource packages list a
`.woff` fallback after every `.woff2`. Vite copies each referenced file, so the
first build came out at **46.7 MB**. Every browser that can run this app
(service workers, custom properties, `:lang()`) has supported WOFF2 for years,
so those files are never fetched. A postcss plugin strips the `format('woff')`
source and a `generateBundle` hook drops the orphaned assets: **−24.4 MB**, no
behaviour change. The postcss matcher keys on `format('woff')` rather than the
file extension because Vite rewrites every `url()` to a `__VITE_ASSET__`
placeholder before postcss runs.

## Runtime font fetch, measured per fixture

Instrumented `page.on('response')` against the dev server, after
`document.fonts.ready`.

| Fixture | lang | dir | Total fonts | Noto only | Noto files |
| --- | --- | --- | ---: | ---: | ---: |
| `basic.md` | en | ltr | 136.2 KB | 0.0 KB | 0 |
| `mixed-directional.md` | en | ltr | 136.2 KB | 0.0 KB | 0 |
| `rtl-hebrew.md` | he | rtl | 150.0 KB | 13.8 KB | 2 |
| `rtl-arabic.md` | ar | rtl | 233.0 KB | 96.7 KB | 2 |
| `cjk-ko.md` | ko | ltr | 250.1 KB | 113.9 KB | 13 |
| `cjk-ja.md` | ja | ltr | 433.7 KB | 297.5 KB | 26 |
| `cjk-sc.md` | zh-Hans | ltr | 590.0 KB | 453.8 KB | 15 |
| `cjk-tc.md` | zh-Hant | ltr | 739.1 KB | 602.9 KB | 17 |

The 136.2 KB floor is Inter + Source Serif + JetBrains Mono latin subsets, paid
on every document. So `unicode-range` is doing its job: the worst case pulls
603 KB of the 19 MB shipped, or 3.2%. Latin documents pull none of it.

## Language detector calibration

Run against every fixture; all correct.

| Fixture | Detected | Confidence | Script breakdown |
| --- | --- | ---: | --- |
| `basic.md` | `en` | 0.99 | latin 100% |
| `cjk-tc.md` | `zh-Hant` | 0.99 | han 83.7%, latin 12.0% |
| `cjk-sc.md` | `zh-Hans` | 0.99 | han 83.7%, latin 12.0% |
| `cjk-ja.md` | `ja` | 0.99 | kana 50.9%, han 37.9%, latin 7.5% |
| `cjk-ko.md` | `ko` | 0.99 | hangul 90.6%, latin 9.5% |
| `rtl-arabic.md` | `ar` | 0.99 | arabic 97.4%, latin 2.6% |
| `rtl-hebrew.md` | `he` | 0.99 | hebrew 97.2%, latin 2.8% |
| `mixed-directional.md` | `en` | 0.99 | arabic 28.2%, latin 71.8% |

**One misfire during development, and how it was tuned.** The brief's rule order
(Arabic at #4, Latin at #7) made `mixed-directional.md` come out as `ar` on 28%
Arabic against 72% Latin. Order-before-magnitude is right for kana-vs-Han —
Japanese prose is mostly Han by character count, so a little kana has to be
decisive — but wrong for Hebrew/Arabic/Cyrillic, which occupy the same
alphabetic-body-text role as Latin. An English article quoting Arabic is
English. Those three now must beat Latin *as well as* their own threshold;
hangul and kana keep unconditional precedence. Nothing else changed.

**Curated character lists.** ~113 single-script characters per side. I checked
them programmatically for overlap and found three — **魂, 值, 富** — which are
identical in both scripts (靈魂/灵魂, 價值/价值, 豐富/丰富). They carried no
signal and, being tested TC-first, would have biased every ambiguous document
toward Traditional. Removed from both lists; a test now pins the separation.

Han documents with no divergent characters default to `zh-Hans` as specified,
and report confidence capped at 0.5 so the panel says "Detected: Other" rather
than asserting a coin toss.

## Encoding edge cases

| Case | Behaviour |
| --- | --- |
| **jschardet false positive** | A 12-byte GBK sample returns `IBM855` (DOS Cyrillic) at **0.51** confidence — over the brief's 0.5 bar. Fixed by whitelisting: a guess is only acted on if it maps to an encoding we support. Anything else becomes a warned UTF-8 fallback. At document length (200 B+) jschardet returns `GB2312` at 0.99, so the whitelist only bites where the input genuinely is undecidable. |
| **Empty file** | Vacuously valid UTF-8. Short-circuited before the guesser so it loads silently with no banner, rather than warning. |
| **Single-byte file** | `#` decodes as UTF-8, no fallback. Tested. |
| **BOM prefix collision** | `FF FE` (UTF-16 LE) is a prefix of `FF FE 00 00` (UTF-32 LE). BOMs are tested longest-first; a test pins it. |
| **UTF-32** | `TextDecoder` does not support it at all. Hand-decoded via `DataView`, with out-of-range and surrogate code points mapped to U+FFFD. |
| **Second BOM after decoding** | A UTF-16 stream can carry a U+FEFF *after* the byte-level BOM is skipped. Trimmed post-decode — otherwise the heading bug survives the fix. |
| **Blocked storage / read error** | `arrayBuffer()` rejection returns `{error}` and a warning banner; nothing throws. |
| **Latin-1** | Not in the brief's list, but `windows-1252`/`ISO-8859-1` are mapped. Without them any accented Latin-1 document would fail the UTF-8 probe and land in the mojibake fallback. |

## Files

**Added (22):** `Lib/readFile.js`, `Lib/detectLanguage.js`, `Lib/loadDocument.js`,
`Hooks/useLanguage.js`, `Hooks/useEncodingBanner.js`, `EncodingBanner.jsx` +
`.css`, `Settings/LanguagePicker.jsx`, `styles/markdown/lang.css`,
`styles/markdown/rtl.css`, `scripts/generate-encoded-fixtures.mjs`, 4 unit specs
→ 3 e2e specs, 7 markdown fixtures, 9 binary fixtures, 2 RTL screenshots, 7 HTML
snapshots.

**Changed (17):** `main.jsx` (12 font imports), `vite.config.js` (woff stripping,
precache split, runtime caching), `Upload.jsx` and `useDrop.js` (both now route
through `loadDocument`), `Markdown/index.jsx`, `Previewer/index.jsx` (lang/dir),
`Editor/index.jsx` + `MirrorEditor.jsx` (banner slot), `Container/index.js`,
`Lib/applyTheme.js` (lead token), `theme/variables.css`, `theme/sepia.css`,
`markdown/index.css`, `Settings/index.jsx` + `styles.css`, `InitialText.js`,
`eslint.config.js`, `parser.test.js`, `render.spec.js`, `settings.spec.js`.

**Deleted:** none.

## Snapshot changes

| Snapshot | Change |
| --- | --- |
| 7 new fixture HTML snapshots | Added — `cjk-{tc,sc,ja,ko}`, `rtl-{arabic,hebrew}`, `mixed-directional`. The fixture loop auto-discovers `*.md`. |
| 6 existing fixture snapshots | **Unchanged.** `lang`/`dir` land on the `.markdown-body` wrapper, which is outside the `.preview` innerHTML the snapshots capture. |
| `theme-sepia.png` | Regenerated for the neutral-muted change. Note it did **not** fail first — inline code is a small fraction of `basic.md`, so the diff sat under the 2% tolerance. I verified the token independently (computed `rgba(168, 153, 104, 0.333)`) and forced the rewrite with `--update-snapshots=all`. |
| `rtl-arabic.png`, `rtl-hebrew.png` | New. |

The Phase 2 cross-theme HTML-identity invariant now runs over **8** fixtures
instead of 1, covering both Han scripts, kana, Hangul and both RTL scripts.

## Verification

| # | Check | Result |
| --- | --- | --- |
| 1 | Build; six new fonts present in `dist/assets` | **Pass** — 910 Noto WOFF2 |
| 2 | New WOFF2 in the precache manifest | **Deliberately partial** — Arabic (10) and Hebrew (6) precached; CJK runtime-cached. See above |
| 3 | Six binary fixtures upload and render with the right banner | **Pass** — 8 e2e tests |
| 4 | BOM file's first heading is an `<h1>` | **Pass** — 3 e2e + 1 unit, end-to-end |
| 5 | CJK document sets `lang` | **Pass** — 7 e2e |
| 6 | Arabic/Hebrew set `dir="rtl"`, rail and bullets mirror | **Pass** — 10 e2e on computed geometry |
| 7 | TC/SC/neutral Han disambiguation | **Pass** — 6 unit |
| 8 | Override to Japanese on a TC doc changes the font | **Pass** |
| 9 | Force LTR on Arabic flips the layout back | **Pass** — asserts border sides |
| 10 | Both settings persist across reload | **Pass** |
| 11 | CJK PDF embeds Noto, not a system font | **Pass** — `pdffonts` shows `NotoSansJP/TC/KR` CID subsets, Identity-H |
| 12 | Arabic PDF embeds Noto Sans Arabic, RTL preserved | **Pass** — `pdffonts` confirms |
| 13 | Sepia inline code no longer a solid block | **Pass** — `sepia-neutral-fix.png` |
| 14 | `pnpm test` | **206/206** (was 95) |
| 15 | `pnpm test:e2e` | **124/124** (was 53) |
| 16 | `pnpm lint` | **Clean** |
| 17 | `rg 'readAsText' src/ tests/` | **Empty** |
| 18 | Exactly two localStorage keys | **Pass** — asserted in unit and e2e |

An observation on #11: `pdffonts` reports the embedded CJK subsets as
`NotoSansJPThin-Regular` / `-Bold`. That is fontsource's internal PostScript name
in the subset files, not the rendered weight — the screenshots show correct
regular and bold weights. Cosmetic PDF metadata only.

## Deviations from the spec

1. **Rule order in the detector changed** for Hebrew/Arabic/Cyrillic, which must
   now also beat Latin. Without it `mixed-directional.md` detects as Arabic.
   Detailed above.

2. **`--wp-font-family-lead` introduced.** The brief's stack could not work.
   Detailed above.

3. **CJK fonts are runtime-cached, not precached.** The brief expected them
   precached. Detailed above — this is the deviation most worth your review,
   since it narrows the offline guarantee for CJK.

4. **`.woff` fallbacks stripped at build time.** Not requested; saves 24.4 MB
   with no behaviour change.

5. **`windows-1252` / `ISO-8859-1` added** to the supported encoding set beyond
   the brief's list, because rejecting them means mojibake on ordinary Latin-1
   documents.

6. **`Lib/loadDocument.js` added.** The brief said to update `Upload.jsx` and
   `useDrop.js` separately. They had already drifted under the old code — only
   `Upload.jsx` checked for a read error — so both now call one function.

7. **BOM baseline test split rather than simply inverted.** The brief noted this
   might be cleaner, and it is: markdown-it is unchanged and *correctly* still
   treats a BOM-prefixed line as a paragraph, since U+FEFF is a legitimate
   character. Two tests pin the parser's unchanged behaviour, and a third
   asserts the real contract end-to-end through the reader.

8. **`eslint.config.js` gained four globals** (`TextDecoder`, `TextEncoder`,
   `DataView`, `Uint8Array`) so the new code lints.

9. **Process error, corrected.** My first commit swept the three staged
   `PHASE_*_SUMMARY.md` files in, because `git commit` without a pathspec
   commits everything in the index and the exclusions I passed to `git add`
   only prevented re-staging. I reset with `--soft` and recommitted with an
   explicit pathspec exclusion. The files are back to index-only
   (`git ls-tree HEAD` shows none of them); the SHA above is the corrected
   commit. No content was altered.

## Assets

`PHASE_3_SUMMARY_assets/` (gitignored via `PHASE_*_SUMMARY_assets/`):

- `rtl-arabic.png`, `rtl-hebrew.png` — mirrored layout
- `cjk-tc.png`, `cjk-sc.png`, `cjk-ja.png`, `cjk-ko.png` — per-script rendering
- `mixed-directional.png`, `latin-baseline.png`
- `banner-detected.png` (info), `banner-fallback.png` (warning)
- `settings-language.png` — the panel with the Language section
- `sepia-neutral-fix.png` — before/after for the neutral-muted change
- `sepia-before.png` / `sepia-after.png` — the raw theme baselines
- `pdf-cjk-{ja,tc,ko}.pdf`, `pdf-rtl-arabic.pdf` — font-embedding evidence
- `font-fetch.json` — the raw runtime-fetch measurements
