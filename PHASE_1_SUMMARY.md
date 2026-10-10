# Phase 1 — Debranding and Identity

**Commit:** `9550b75f483b2b2586e12ae601f37a8864e487c1` (`9550b75`), local on `main`, not pushed.
**Parent:** `a7d88dc` (Phase 0).
**Status:** all objectives met. 29/29 unit, 19/19 e2e, lint clean, build clean.

`PHASE_0_SUMMARY.md` remains staged and uncommitted, as instructed — the Phase 1
commit was made with an explicit pathspec so the index entry survived untouched.

---

## What actually mattered

Two things carried upstream identity into user-visible output, and both are gone:

1. **`InitialText.js`** — the only branding that reached the printed PDF. Any
   user who hit Transform without loading a file printed upstream's promo copy,
   GitHub handle, and project URL. Replaced with a WaynePDF onboarding document.
   Verified by generating a PDF from the default state and grepping the extracted
   text: zero hits for `realdennis`, `md2pdf`, or `ghbtns`.
2. **The `ghbtns.com` iframe** — a live third-party request on every page load,
   directly contradicting the offline/privacy pitch. Removed, and now guarded by
   a test rather than a promise.

Everything else was polish.

---

## Files changed

| File | Change |
| --- | --- |
| `src/App/Container/Hooks/InitialText.js` | Replaced wholesale with the WaynePDF onboarding document |
| `src/App/Components/Header/index.jsx` | Removed `ghbtns.com` iframe, commented-out author block + CSS; wordmark `waynepdf` → `WaynePDF`; `🎉 Transform` → `Transform` |
| `src/App/Components/Upload.jsx` | `📁 Choose` → `Choose` |
| `index.html` | Full WaynePDF metadata: title, description, OG, Twitter card, SVG/ICO/apple-touch icon links |
| `vite.config.js` | PWA manifest name/description/`start_url`/`categories`/icons; `includeAssets` extended for the new files |
| `package.json` | `description`, `homepage`, `gen:icons` script, `sharp` devDependency, lint scope |
| `README.md` | Stub (37 lines) → real README (~105 lines) |
| `.gitignore` | Added `PHASE_*_SUMMARY_assets/` |
| `eslint.config.js` | Files glob `{js,jsx}` → `{js,jsx,mjs}` so the new script is linted |
| `pnpm-workspace.yaml` | Reworded the `nonaction` peer-dep comment |
| `src/main.jsx`, `src/App.test.jsx`, `src/App/Components/Markdown/index.test.jsx`, `src/App/Container/Hooks/useText.test.js`, `tests/setup.js` | Reworded "upstream md2pdf" port comments to "the upstream project" — same information, no product name |
| `tests/fixtures/basic.md` | Link target `github.com/realdennis/md2pdf` → `example.org/waynepdf` |
| `tests/e2e/__snapshots__/.../basic-md-chromium-linux.html` | Regenerated (one line) |

## Files added

| File | Purpose |
| --- | --- |
| `public/favicon.svg` | Master mark, 512 viewBox, ships as-is to modern browsers |
| `public/icons/icon-192.png`, `icon-512.png` | PWA |
| `public/icons/icon-maskable-512.png` | PWA maskable, mark scaled into the centre 80% safe zone |
| `public/icons/apple-touch-icon.png` | 180×180 |
| `public/og-image.png` | 1200×630 social card |
| `scripts/generate-icons.mjs` | Rasterizes all of the above from the master SVG |
| `tests/e2e/privacy.spec.js` | Third-party request guards |

## Files deleted

- `public/icons/android-icon-144x144.png`
- `public/icons/android-icon-192x192.png`

Both were upstream artifacts with mislabeled sizes (Phase 0 §2.6). The generator
`rm -rf`s `public/icons/` before writing, so a future rename can never leave a
stale icon behind.

`public/favicon.ico` was replaced in place (1086 → 4286 bytes).

---

## Snapshot diffs

Only one of the six fixture snapshots changed, and not because of `InitialText`.

| Snapshot | Result |
| --- | --- |
| `basic-md` | **Changed, 1 line.** `<a href="https://github.com/realdennis/md2pdf">the upstream project</a>` → `<a href="https://example.org/waynepdf">the project site</a>`. No DOM shifts. |
| `cjk-md` | Unchanged |
| `code-blocks-md` | Unchanged |
| `emoji-md` | Unchanged |
| `large-md` | Unchanged |
| `math-baseline-md` | Unchanged |

As the spec anticipated: `render.spec.js` pushes fixture markdown through
`window.__waynepdf_setText`, so the default document never reaches a snapshot.
The one diff comes from editing the `basic.md` fixture to clear the grep sweep,
not from the `InitialText` rewrite. Diff reviewed line-by-line before committing.

`upload.spec.js` needed **no** changes — its selectors are `#mdFile` and
`p.button.download`, never the button label text, so emoji removal didn't touch it.

---

## Icon pipeline

The mark is a geometric `W`: four angled strokes of uniform 52px horizontal
weight, drawn as one filled polygon so every join stays sharp. Skeleton vertices
at x = 128/192/256/320/384 give an outer span of 102–410, i.e. 60% of the canvas.
The glyph box spans y 142–354, centring at 248 — eight pixels above true centre,
because a `W` is bottom-heavy and reads as sunken when centred geometrically.

`pnpm gen:icons` is idempotent: verified by hashing all six outputs, re-running,
and diffing. Byte-identical.

**Two deliberate departures from the brief's suggested method:**

1. **Dropped `png-to-ico`.** It produced a 285KB seven-size ICO. Since this
   file's only job is to be the fallback for browsers that ignore
   `<link rel="icon" type="image/svg+xml">`, one 32×32 entry is enough. The
   script now writes a minimal single-image ICO directly (`icoFromBgra`),
   4286 bytes. BMP payload rather than PNG-in-ICO, because that's what the old
   browsers in question actually understand. `sharp` is the only new dependency.
2. **The OG image needed no font fallback.** `sharp` rendered
   `font-family="sans-serif"` correctly on this machine. Text baselines were
   nudged from y=300/380 to y=312/392 after inspecting the first render — the
   original values left the text block sitting visibly high in the 630px frame.

---

## Verification

| # | Check | Result |
| --- | --- | --- |
| 1 | Grep sweep | **Clean** — see below |
| 2 | Zero third-party requests on load | **Pass** — asserted in `privacy.spec.js` and re-confirmed by instrumenting a real page load against `pnpm preview` (0 non-localhost requests) |
| 3 | Header: WaynePDF wordmark, emoji-free buttons, no star button | **Pass** — `PHASE_1_SUMMARY_assets/header.png` |
| 4 | Default document is the new onboarding text | **Pass** — `app-full.png` |
| 5 | PDF first page shows WaynePDF content, no `realdennis` | **Pass** — `default-document.pdf`, `pdf-page1-1.png`; `pdftotext \| grep -iE 'realdennis\|md2pdf\|ghbtns'` returns nothing |
| 6 | Favicon serves | **Pass** — `/favicon.svg` 200 `image/svg+xml`, `/favicon.ico` 200 `image/x-icon`. See note below |
| 7 | `pnpm build` manifest correct | **Pass** — name/short_name `WaynePDF`, new description, three icons incl. maskable |
| 8 | PWA install shows WaynePDF icon and name | **Not verified** — see deviations |
| 9 | `pnpm test` | **29/29** |
| 10 | `pnpm test:e2e` | **19/19** (was 17; +2 privacy tests) |
| 11 | `pnpm lint` | **Clean** |
| 12 | `pnpm gen:icons` idempotent | **Pass** — byte-identical on re-run |

### Grep sweep

```
rg -i 'md2pdf|realdennis|ghbtns' -g '!.reference' -g '!node_modules' -g '!dist' \
   -g '!.git' -g '!UPSTREAM_LICENSE' -g '!LICENSE'
```

Run exactly as specified, this returns three groups of hits — **all three are
required by the spec itself**:

1. **`README.md`** — the Credits section, whose text §8 dictates verbatim,
   including the `realdennis/md2pdf` link. §8 and §10 of the brief are in direct
   conflict here. Resolved in favour of §8: attribution is the point, and this
   is the same category as `LICENSE`/`UPSTREAM_LICENSE`.
2. **`PHASE_0_SUMMARY.md`** — staged, uncommitted, and explicitly out of bounds.
3. **`tests/e2e/privacy.spec.js`** — the `**/ghbtns.com/**` route guard that §9
   required. The string has to be there for the test to do its job; constructing
   it at runtime to dodge a grep would be obfuscation.

Adding those three to the exclusion list, **the sweep is empty**:

```
rg -i 'md2pdf|realdennis|ghbtns' -g '!.reference' -g '!node_modules' -g '!dist' \
   -g '!.git' -g '!UPSTREAM_LICENSE' -g '!LICENSE' -g '!README.md' \
   -g '!PHASE_*_SUMMARY.md' -g '!tests/e2e/privacy.spec.js'
→ (no output)
```

Restricted to shipped app source and config — `src`, `index.html`,
`vite.config.js`, `package.json`, `public`, `scripts`, `Dockerfile`, `.github`,
all config files, `tests/fixtures`, `tests/unit`, `tests/setup.js`, and the
snapshots — the sweep is **empty with no exclusions at all**.

---

## Deviations from the spec

1. **`InitialText.js` export shape.** §1 says "`initialText` is a default-exported
   string" but then "match the existing export shape". The existing shape is a
   *named* export, consumed in four places (`useText.js`, `MirrorEditor.jsx`,
   `Hooks/index.js`, `useText.test.js`). Kept the named export. Adding a default
   export nothing imports would be dead code.

2. **Grep sweep is not literally empty.** Three hits remain, each mandated by
   another section of the same spec. Detailed above.

3. **`tests/fixtures/basic.md` was edited.** Not listed in the deliverables, but
   it contained a `realdennis/md2pdf` link and objective 8 says *anywhere* in the
   codebase. Changing it forced the one snapshot regeneration.

4. **Port-attribution comments reworded, not deleted.** Five source comments said
   "Ported from upstream md2pdf …". They now say "Ported from the upstream
   project's …" — the file path, which is the useful part, is preserved; only the
   product name is dropped. Project-level attribution lives in README Credits,
   `LICENSE`, and `UPSTREAM_LICENSE`.

5. **Two small changes outside the stated scope,** both in service of "`pnpm lint`
   clean" with a new file present: `eslint.config.js` files glob gained `mjs`
   (the config's block matched only `{js,jsx}`, so a `.mjs` file would have been
   linted with no globals defined and failed on `console`/`process`), and the
   `lint` script now covers `scripts`. Without both, `scripts/generate-icons.mjs`
   would ship unlinted.

6. **`png-to-ico` dropped** in favour of a hand-written single-image ICO. See
   the icon pipeline section. Installed, evaluated, removed — `pnpm-lock.yaml`
   reflects only `sharp`.

7. **Checklist item 8 (PWA install) not verified.** Verifying that Chrome's
   install prompt shows the right icon and name requires a headed browser with a
   real profile; this session is headless. The underlying facts are verified
   instead: the built `dist/manifest.webmanifest` carries `"name":"WaynePDF"`,
   `"short_name":"WaynePDF"`, the new description, and all three icon entries,
   and every icon URL returns 200 with `image/png` from `pnpm preview`.

8. **Checklist item 6, partial.** Headless Chromium never requests a favicon —
   there's no tab UI to paint — so no request appears in a captured page load.
   Verified by direct fetch instead (both files 200 with correct content types)
   plus a 10× nearest-neighbour render of the mark at tab size in
   `favicon-32-zoom.png`. The mark is legible as a `W` at 16px, though inevitably
   soft — strokes land at ~1.6px there.

## Open item for a later phase

`vite.config.js` sets `base: './'` for subpath deploys, but the manifest icon
`src` values the spec dictates are root-absolute (`/icons/icon-192.png`). Under
a subpath deploy (e.g. a GitHub Pages project page) those would 404; they're
correct for the `homepage` as configured, `https://waynepdf.mgbah.dev`. Vite
rewrote the `index.html` `<link href>` attributes to `./` automatically, so only
the manifest is affected. Left as specified. One-line fix if the deploy target
changes: make the three manifest `src` values relative.

`homepage` is set to the placeholder `https://waynepdf.mgbah.dev` from the brief.
The README's "Use it online" section carries `[Deployed URL to be added]`.

---

## Assets

`PHASE_1_SUMMARY_assets/` (gitignored via `PHASE_*_SUMMARY_assets/`):

- `header.png` — the debranded header
- `app-full.png` — editor + preview showing the new default document
- `default-document-preview.png` — preview pane alone
- `favicon-32-zoom.png` — the mark at tab size, 10× nearest-neighbour
- `og-image.png` — the 1200×630 social card
- `default-document.pdf` + `pdf-page1-1.png`, `pdf-page2-2.png` — the printed
  output of the default document, the evidence for checklist item 5
