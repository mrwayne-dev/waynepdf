# Phase 2 — Theming Layer

**Commit:** `1aefe6a53934d1e7e2e25b818f49da693dffaa84` (`1aefe6a`), local on `main`, not pushed.
**Parent:** `9550b75` (Phase 1).
**Status:** all objectives met. 95/95 unit, 53/53 e2e, lint clean, build clean.

54 files changed, 3110 insertions, 39 deletions.
`PHASE_0_SUMMARY.md` and `PHASE_1_SUMMARY.md` remain staged and uncommitted —
the Phase 2 commit used an explicit pathspec so both index entries survived.

---

## The two structural changes

### 1. The fork was cleaner than the brief expected

The brief described `github-markdown-css@5.5.1` as "68 hardcoded colors, zero CSS
custom properties." That is not what shipped in 5.5.1. The package is already
fully var-driven: **every colour in its 160 body rules is a `var(--color-*)`,
with zero literals.** The literals all live inside the two
`@media (prefers-color-scheme)` blocks — which is exactly the auto-switching
behaviour Phase 2 needed to delete.

So the fork was a var-remap, not a colour hunt. That made it safe to do
mechanically rather than by hand, which in turn made the verification meaningful:

| Check | Result |
| --- | --- |
| Rule blocks parsed | 184 |
| Rules kept and rehomed | 160 |
| Rules dropped | 24 (`.pl-*`, see below) |
| Selector multiset before vs after | identical |
| Declarations untouched by the remap | **316, byte-identical to upstream** |
| Leftover `var(--color-*)` references | none |

**Dropped `.pl-*` (24 rules).** These style GitHub's server-side "prettylights"
highlighter. WaynePDF renders with highlight.js, which emits `.hljs-*` and never
`.pl-*` — verified against the committed `code-blocks-md` snapshot, whose only
classes are `hljs`, `hljs-keyword`, `hljs-string` and friends. They were also the
sole consumers of 34 of the 48 upstream `--color-*` vars, and the brief's 15-token
palette provides no values to map them onto. Carrying them would have meant
inventing 34 × 5 = 170 palette entries that could never paint anything.

**Cascade safety.** Splitting one file into five reorders the cascade, which can
silently break same-specificity ties. I checked rather than assumed: of 48
candidate pairs (same specificity, sharing a declared property, order inverted by
the split), only **2** survive a co-matchability test, and both are class-only
selectors that cannot land on the same element — `.emoji` vs
`.task-list-item-checkbox`, and `.highlight` vs `.markdown-alert`. Within each
file, upstream's relative order is intact.

The split was performed by a one-off Python script. **It is deliberately not
committed**: it overwrites `src/styles/markdown/`, which is now owned source
meant to be hand-edited, so keeping a re-runnable copy in the repo would be a
foot-gun. The verification numbers above are its output.

### 2. `ThemeContainer`

A second nonaction container beside `TextContainer`, holding theme name, font
family, and the three typography scalars.

Initial state is read **synchronously in the `useState` initialiser**, not in an
effect. An effect would paint one frame of the default theme before correcting
itself, which reads as a flash of the wrong colours on every reload.

Persistence never throws. Each field validates independently, so a stored
`{theme: "dark", fontSize: 999}` keeps the dark theme and resets only the size.
Malformed JSON is overwritten at load rather than left to fail again next time.
Blocked storage (Safari private mode) and an exhausted quota both degrade to
in-memory-only.

---

## Files

### Added (29)

```
src/styles/theme/         index, variables, light, dark, sepia,
                          high-contrast, print-optimized          (7)
src/styles/markdown/      index, base, typography, code, tables,
                          media, print                            (7)
src/styles/app.css                                                (1)
src/App/Lib/settings.js          schema, validation, localStorage
src/App/Lib/applyTheme.js        the only DOM writer
src/App/Container/Hooks/useTheme.js
src/App/Components/Settings/     index, SettingsButton, ThemeSwatch,
                                 FontPicker, Slider, styles.css   (6)
tests/unit/theme.test.js         53 tests
tests/unit/useTheme.test.js      13 tests
tests/e2e/settings.spec.js       26 tests
tests/e2e/theme-visual.spec.js    5 tests
tests/e2e/__screenshots__/       5 baselines
```

### Changed (17)

| File | Change |
| --- | --- |
| `src/main.jsx` | Font imports; the three stylesheet entry points; `installHljsThemes()` injects four `<link>`s, all disabled |
| `src/App/index.jsx` | `ThemeContainer` injected; chrome font is now a token |
| `src/App/Container/index.js`, `Hooks/index.js` | Register and re-export `useTheme` |
| `Header/index.jsx` | Gear button mounted between wordmark and Transform; `color: black` / `rgb(233,233,233)` / `1px solid black` → theme tokens |
| `Editor/MirrorEditor.jsx` | CM theme from `codeMirrorTheme(resolvedTheme)`; darcula/solarized/eclipse CSS bundled; editor font tracks the code-size token |
| `Editor/index.jsx`, `DragBar.jsx` | Colour literals → tokens |
| `Previewer/index.jsx`, `Markdown/index.jsx` | Dropped `import 'github-markdown-css'` (both sites) |
| `Previewer/Preview.jsx` | Dropped the static `highlight.js/styles/github.css` import |
| `Hooks/InitialText.js` | "Background graphics" instruction removed; roadmap row updated |
| `vite.config.js` | `workbox.globPatterns` + `maximumFileSizeToCacheInBytes` |
| `playwright.config.js` | `expect.toHaveScreenshot.pathTemplate` → `__screenshots__/` |
| `eslint.config.js` | Added `getComputedStyle`, `localStorage`, `matchMedia` browser globals |
| `package.json` | +3 fontsource deps, −`github-markdown-css` |
| `README.md` | Roadmap; new "Themes and typography" section; usage no longer mentions Background graphics |
| `Markdown/index.test.jsx` | Injects `ThemeContainer` — the tree now requires it |
| `tests/e2e/render.spec.js` | +2 cross-theme tests |

### Deleted (1)

- `src/styles.css` → moved to `src/styles/app.css` and expanded.

---

## Font versions

The brief asked for `^5.1.0`; pnpm resolved all three to the same minor:

| Package | Installed | WOFF2 | `unicode-range` | Bundled subsets |
| --- | --- | --- | --- | --- |
| `@fontsource-variable/inter` | **5.3.0** | yes | yes (7 subsets) | latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese |
| `@fontsource-variable/source-serif-4` | **5.3.0** | yes | yes (6 subsets) | as above, no vietnamese |
| `@fontsource-variable/jetbrains-mono` | **5.3.0** | yes | yes (6 subsets) | as above |

All three ship variable WOFF2 with `unicode-range` subsetting, so no fallback to
the non-variable packages was needed. CSS family names are `Inter Variable`,
`Source Serif 4 Variable`, `JetBrains Mono Variable` — the stacks in
`variables.css` list those first, then the non-variable name, then system
fallbacks.

---

## Snapshot regeneration

**No Phase 0 or Phase 1 snapshot changed.** All six fixture HTML snapshots pass
byte-identical.

The brief anticipated wrapper-class churn on `.markdown-body`. That did not
happen, and the reason is worth recording: the fork is *purely* a stylesheet
swap. No component's markup changed, no class was added or removed, and themes
apply through `data-theme` on `<html>` plus custom properties on `:root` —
neither of which is inside the `.preview` subtree that `render.spec.js`
snapshots.

This is now enforced rather than assumed. A new test renders `basic.md` under all
five themes and asserts the `.preview` innerHTML is **byte-identical across all
of them**; if a theme ever starts injecting markup, it fails.

Five new image baselines were written in `tests/e2e/__screenshots__/` (first run,
nothing regenerated).

---

## Bundle size

| | Phase 1 | Phase 2 | Δ |
| --- | --- | --- | --- |
| `dist/` total | 1,563,793 B (1.53 MiB) | 2,076,168 B (1.98 MiB) | **+512,375 B (+32.8%)** |
| Precached entries | 17 (1,460 KiB) | 43 (2,009 KiB) | +26 |
| Main CSS chunk | 35,172 B | 49,780 B | +14,608 B |
| Main JS chunk | 406,087 B | 415,090 B | +9,003 B |
| `Preview` chunk (hljs) | 1,045,821 B | 1,005,510 B | −40,311 B |

Where the +512 KB went:

- **Fonts: ~446 KB across 18 WOFF2 files** — the dominant cost, and the one the
  brief predicted. Only the `latin` subset (~48 KB Inter + ~51 KB Source Serif +
  ~40 KB JetBrains ≈ 139 KB) is fetched for an English document; the Cyrillic,
  Greek and Vietnamese subsets exist but `unicode-range` keeps them unrequested
  until a document actually needs them.
- **CSS: +14.6 KB** — the fork plus five palettes plus panel styles, minus the
  now-absent package.
- **hljs themes: +4.1 KB** across four separate CSS assets. Three are `disabled`
  and therefore never fetched.
- The `Preview` chunk *shrank* 40 KB because its static `github.css` import moved
  out to a URL asset.

---

## Verification

| # | Check | Result |
| --- | --- | --- |
| 1 | `pnpm build`; no `github-markdown-css` in `dist/` | **Pass** — `rg` returns nothing |
| 2 | Fresh browser → Light theme, Inter body | **Pass** — default is System, which resolves to Light under a light OS |
| 3 | Gear opens the panel with slide-in | **Pass** — `panel-light.png`, `panel-dark.png` |
| 4 | Each of five themes changes the preview and `data-theme` | **Pass** — 5 e2e tests + `themes.png` |
| 5 | System resolves per OS preference | **Pass** — 3 e2e tests, including a live `emulateMedia` flip |
| 6 | Font family changes the preview font | **Pass** — asserted on computed `fontFamily`; `fonts.png` |
| 7 | Three sliders update live | **Pass** — 5 e2e tests on both the CSS var and the computed value |
| 8 | Reload restores settings | **Pass** |
| 9 | Reset returns to defaults | **Pass** |
| 10 | PDF per theme keeps its colours | **Pass** — five PDFs generated and rasterised, see assets |
| 11 | Panel and gear absent from the PDF | **Pass** — PDF text asserted free of "Settings", "Reset to defaults", "Line height" |
| 12 | `pnpm test` | **95/95** (was 29) |
| 13 | `pnpm test:e2e` | **53/53** (was 19) |
| 14 | `pnpm lint` | **Clean** |
| 15 | Exactly one localStorage key | **Pass** — asserted in both unit and e2e |
| 16 | `rg 'github-markdown-css' src/ index.html vite.config.js` | **One hit** — the fork attribution. See deviations |
| 17 | Phase 0/1 snapshots | **Pass unchanged** |

Checklist 10 was verified by generating a real PDF in each theme with
`printBackground: true` and rasterising page 1. Dark prints dark with its code
and blockquote fills intact; Print-Optimized prints high-contrast light. Both are
in the assets directory.

---

## Deviations from the spec

1. **The grep sweep has one hit, and it is the MIT attribution.** §10 requires
   `rg 'github-markdown-css' src/ index.html vite.config.js` to return nothing.
   The one match is the provenance banner in `src/styles/markdown/index.css`,
   which names the package, its version, and its author. MIT requires the notice
   be retained, and the honest place for it is on the forked code. I did
   consolidate it: originally all five concern files carried the full banner, now
   one file states it and the others say "see index.css". The *dependency* is
   gone from `package.json`, from both import sites, and from `dist/` — which is
   what the sweep is actually protecting.

2. **`.pl-*` rules dropped (24).** Not authorised explicitly, but the brief's
   15-token palette makes it unavoidable: those rules consume 34 upstream vars
   the palette does not define. Justified above.

3. **`normalizeSettings` resets out-of-range values rather than clamping to the
   bound.** The brief says "clamped to defaults" and gives `fontSize: 999` as an
   example. "Clamp to default" and "clamp to max" are different behaviours; I
   read the phrase literally, so 999 → 16, not 999 → 24. Tests pin this either
   way, so it is a one-line change if the other reading was intended.

4. **Two changes outside the stated scope, both required by objectives inside
   it.**
   - **`workbox.globPatterns`** now includes `woff2`. Workbox's default glob is
     `{js,css,html,ico,png,svg}`, so the bundled faces were **not being
     precached** — the app would have come up offline and silently fallen back to
     system fonts, defeating the point of bundling them. Also raised
     `maximumFileSizeToCacheInBytes` to 3 MiB for the 1 MB hljs chunk.
   - **Header, drag bar and editor colour literals → tokens.** The header was
     `color: black; background-color: rgb(233,233,233)`. Left alone it would have
     stayed light grey in Dark and Sepia, so "selecting a theme visibly changes
     the app" would have been half-true. Content is untouched; only colours moved.

5. **`playwright.config.js` gained `expect.toHaveScreenshot.pathTemplate`.** The
   brief asks for image baselines in `tests/e2e/__screenshots__/`, but the
   existing `snapshotDir` points at `__snapshots__` and applies to both matchers.
   The per-matcher `pathTemplate` (Playwright 1.62) separates them without
   touching the existing HTML snapshots.

6. **Font-family e2e tests click the pill, not the radio.** The radio is
   visually hidden behind its label, so Playwright's `.check()` is intercepted by
   the label — which is precisely how a real user checks it. The helper clicks
   the label and then asserts the radio is checked, which additionally guards the
   label↔input wiring.

7. **`eslint.config.js` gained three browser globals** (`getComputedStyle`,
   `localStorage`, `matchMedia`) so the new tests lint clean.

---

## Palette notes

I kept every value the brief specified. One is worth flagging rather than
silently changing:

**Sepia's `--wp-color-neutral-muted: #a89968` is fully opaque**, where Light
(`#818b981f`, ~12% alpha) and Dark (`#656c7633`, 20% alpha) are translucent. That
token is the inline-code and `kbd` background, so in Sepia inline code renders as
a solid olive block noticeably heavier than the same element in the other four
themes — visible in `themes.png`, second tile from the right in the "inline code"
run. It is legible (`#433422` on `#a89968` clears 4.5:1), so this is taste, not a
defect, and the brief was emphatic about these exact values. If it should match
the others, `#a8996855` is the equivalent.

Two mappings the brief's 15 tokens did not cover:

- **`--color-attention-subtle`** (the `<mark>` background) has no counterpart.
  Mapping it to `--wp-color-attention` would have put dark amber text on a dark
  amber field. It now derives its tint:
  `color-mix(in srgb, var(--wp-color-attention) 18%, var(--wp-color-canvas))`,
  which stays correct per-theme without a 16th token.
- **`--color-done-fg` / `-emphasis`** (GitHub's purple, used only by
  `.markdown-alert.markdown-alert-important`) map to `--wp-color-accent`. Both
  are informational hues and the alert rules are dormant until Phase 6 adds
  callouts.

---

## Assets

`PHASE_2_SUMMARY_assets/` (gitignored via `PHASE_*_SUMMARY_assets/`):

- `themes.png` — `basic.md` in all five themes, 5-up
- `fonts.png` — the same document under Sans / Serif / Mono
- `panel-light.png`, `panel-dark.png` — the settings panel open, full app
- `pdf-{theme}.pdf` ×5 and `pdfpng-{theme}-1.png` ×5 — checklist 10 evidence
