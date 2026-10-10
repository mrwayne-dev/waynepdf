# WaynePDF — Phase 0 Summary

Status: **complete**, with one verification item blocked by the environment (Docker).

Commit: `a7d88dc` — *Phase 0: Vite + React 18 foundation, markdown-it parser, test harness* (62 files).
This summary is **staged but not committed**, as requested.

---

## 1. Actual versions installed

Toolchain: **Node v22.23.2**, **pnpm 11.22.0**, **Playwright 1.62.1**, Chromium headless-shell 151.0.7922.34.

### Dependencies

| Package | Spec | Installed | Note |
|---|---|---|---|
| codemirror | ^5.65.0 | 5.65.21 | caret |
| github-markdown-css | 5.5.1 | 5.5.1 | pinned, exact |
| highlight.js | 11.9.0 | 11.9.0 | pinned, exact |
| markdown-it | 14.1.0 | 14.1.0 | pinned, exact |
| nonaction | ^0.0.5 | 0.0.5 | |
| normalize.css | ^8.0.1 | 8.0.1 | |
| react | ^18.3.1 | 18.3.1 | |
| react-codemirror2 | ^8.0.0 | 8.0.2 | |
| react-dom | ^18.3.1 | 18.3.1 | |
| styled-components | ^6.1.13 | 6.5.2 | caret |

### devDependencies

| Package | Spec | Installed |
|---|---|---|
| @playwright/test | ^1.48.0 | 1.62.1 |
| @testing-library/jest-dom | ^6.5.0 | 6.10.0 |
| @testing-library/react | ^16.0.1 | 16.3.2 |
| @vitejs/plugin-react | ^4.3.2 | 4.7.0 |
| eslint | ^9.12.0 | 9.39.5 |
| eslint-plugin-react | ^7.37.1 | 7.37.5 |
| eslint-plugin-react-hooks | ^5.0.0 | 5.2.0 |
| jsdom | ^25.0.1 | 25.0.1 |
| prettier | ^3.3.3 | 3.9.6 |
| vite | ^5.4.8 | 5.4.21 |
| vite-plugin-pwa | ^0.20.5 | 0.20.5 |
| vitest | ^2.1.2 | 2.1.9 |
| **@eslint/js** | *added* | 9.39.5 |
| **workbox-window** | *added* | 7.4.1 |

**No version was downgraded.** Every pinned version installed exactly as specified; caret ranges resolved to their latest compatible release. All three pinned packages (`markdown-it`, `github-markdown-css`, `highlight.js`) are exact.

---

## 2. Deviations from spec

### 2.1 Two dependencies added (both forced, neither optional)

- **`workbox-window@^7.1.0`** — a declared peer of `vite-plugin-pwa`. The spec mandates routing service-worker registration through `registerSW()`, and `virtual:pwa-register` imports `workbox-window`; pnpm's strict layout will not hoist it, so the build failed with *"Rollup failed to resolve import workbox-window"* until it was declared. **This does not resurrect any of upstream's 12 workbox packages** — I verified `workbox-window` is not among them. All 12 are gone.
- **`@eslint/js@^9.12.0`** — needed for `js.configs.recommended` under flat config. Same pnpm strict-layout reason: it ships inside `eslint` but is not hoisted.

### 2.2 ESLint uses flat config, not `.eslintrc.json`

The spec's tree lists `.eslintrc.json`, but it also pins `eslint@^9`, which defaults to flat config. Using eslintrc under ESLint 9 requires the deprecated `ESLINT_USE_FLAT_CONFIG=false` escape hatch, removed in ESLint 10. Shipped **`eslint.config.js`** instead. `pnpm lint` is unchanged.

### 2.3 pnpm settings live in `pnpm-workspace.yaml`

pnpm 11 no longer reads the `pnpm` field in `package.json`. Two settings had to go somewhere:
- `allowBuilds: esbuild: true` — esbuild's postinstall fetches its platform binary; without it Vite cannot build.
- `peerDependencyRules.allowedVersions: nonaction>react: '18'` — see 2.4.

**`package.json` therefore matches the spec exactly**, plus the two dependencies in 2.1.

### 2.4 One peer dependency knowingly overridden

`nonaction@0.0.5` declares `react ^16.8.0`. It is a ~40-line hooks + context container, API-compatible with React 18, and upstream is unmaintained so the declaration will never be updated. Overridden explicitly rather than left as an unexplained warning. `pnpm peers check` now reports **no issues**.

### 2.5 A third e2e spec file: `tests/e2e/upload.spec.js`

The spec listed two e2e files. I added a third because verification items #3 and #4 (file drop, Transform → print) had no automated coverage, and writing them **caught a real bug** — see §3. Five tests: drop, non-`.md` rejection, file picker, Transform→print, and PDF filename derivation.

### 2.6 Minor, deliberate

- **`id="md2pdf-app"` → `id="waynepdf-app"`** in `src/App/index.jsx`, and the header label reads `waynepdf`. The spec already mandates "WaynePDF" for the PWA manifest and title, so this is fork identity, not the upstream-attribution branding Phase 1 removes. **The two items you named — `InitialText.js` and the `ghbtns.com` iframe — are byte-for-byte untouched** (`InitialText.js` still carries both `realdennis` references).
- **PWA icon sizes corrected.** Upstream's `manifest.json` mislabeled its icons (the 144px file declared `192x192`, the 192px file declared `512x512`). The generated manifest declares true sizes.
- **`md` exported from `Preview.jsx`** so unit tests assert against the exact parser instance the app renders with, rather than a second config that could drift.
- **`Dockerfile` copies `pnpm-workspace.yaml`** before `pnpm install`. Without it the `allowBuilds` setting is absent inside the image, esbuild's binary is never fetched, and `pnpm build` fails. Found by replaying the build stage locally (§5).

---

## 3. Bug found and fixed during the port

**Upload and drag-and-drop were completely broken** after the React 18 upgrade. Worth reading before Phase 1.

`uploadFile.js` used `document.querySelector('.CodeMirror')` — the *first* match. Under React 18 StrictMode, `react-codemirror2` v8 mounts, tears down, and remounts, but **leaves two connected `.CodeMirror` nodes in the DOM**. Only the most recent is wired to `onChange`, so every upload wrote to a dead instance and silently did nothing — no error, no console warning, preview simply never changed.

Fixed by targeting the last (live) instance. In production builds StrictMode does not double-invoke effects, so there is exactly one node and `last === first` — correct in both modes. Covered by a unit test and an e2e regression test.

**The underlying leak is not fixed** — `react-codemirror2` v8 controls that teardown internally. This is the strongest argument yet for the CodeMirror 6 migration, and it is a genuine DOM/memory leak in dev. Flagged for the backlog.

---

## 4. Parser parity with upstream

Verified by rendering all six fixtures through **both** upstream's `remarkable@1.7.1` (`{html:true, linkify:true}`) and the new `markdown-it@14.1.0`, then diffing the tag census and normalized HTML:

| Fixture | Result |
|---|---|
| basic.md | `<del>`×2 → `<s>`×2 |
| cjk.md | identical |
| code-blocks.md | identical |
| emoji.md | identical |
| large.md | identical structure; table-cell whitespace only |
| math-baseline.md | identical |

Only two differences exist across the whole corpus, and **neither is visible**: `~~strikethrough~~` emits `<s>` instead of `<del>` (both render struck through), and markdown-it puts table cells on their own lines in the HTML source (identical DOM). The `\,` in `$$\int_0^1 x^2\,dx$$` is consumed by both parsers identically.

---

## 5. Verification checklist

| # | Item | Result |
|---|---|---|
| 1 | `pnpm install`, no peer errors | **PASS** — `pnpm peers check`: no issues |
| 2 | `pnpm dev` starts, UI matches upstream | **PASS** — HTTP 200, entry module compiles |
| 3 | Drag-and-drop `.md` works | **PASS** — after the §3 fix; e2e covered |
| 4 | Transform opens print dialog | **PASS** — e2e asserts `window.print()` fires once |
| 5 | Three baseline bugs still documented | **PASS** — 7 unit + 2 e2e tests, plus snapshots |
| 6 | `pnpm build` produces `dist/` + PWA manifest | **PASS** — 12 files, `sw.js`, valid manifest |
| 7 | `pnpm preview` works identically | **PASS** — manifest/sw/favicon/assets all 200 |
| 8 | `pnpm test` (Vitest) | **PASS** — 29/29 |
| 9 | `pnpm test:e2e` (Playwright) | **PASS** — 17/17 |
| 10 | `pnpm lint` | **PASS** — clean |
| 11 | Docker build + run | **BLOCKED** — see below |

### Item 11 is blocked, not failed

**No container runtime is installed on this machine** — `docker`, `podman`, `nerdctl`, and `buildah` are all absent, and the docker service is inactive. Installing one is a sudo-level system change well outside scaffolding scope, so I did not.

What I did instead: replayed the Dockerfile's build stage locally against a clean context honoring `.dockerignore` (only the files Docker would see). Both stages of the build **succeed**:

- `pnpm install --frozen-lockfile` → exit 0
- `pnpm build` → exit 0, produces the `dist/` that nginx would serve

This is what surfaced the missing `pnpm-workspace.yaml` COPY (§2.6). Unverified remainder: the `docker build` / `docker run` invocations themselves and nginx serving on :80. **Please run `docker build -t waynepdf . && docker run -p 8080:80 waynepdf` on a machine with Docker to close this item.**

---

## 6. Baseline snapshot hashes

SHA-256 of `tests/e2e/__snapshots__/render.spec.js-snapshots/`. Stable across a Prettier reformat pass, so they reflect parser output only.

```
1169c4182581f8801c88012482797648a46f464bad896cb96833f6143f17bc8d  basic-md-chromium-linux.html
9e7cff4885465366a24f1c219745d19e51b419095c2b2d8ab00a09a57126caa0  cjk-md-chromium-linux.html
ec21935c5a55c33ea277b6f4175fe58131153c07f90574c1baf29866ee0d2f83  code-blocks-md-chromium-linux.html
5559fd1aa2a607cf4f8582dd352acb9a49f905fbd7cf679135712eb27ec613e4  emoji-md-chromium-linux.html
be493e87fc8a79de806692c9d53098cd57879fc9b1478aed672d6671eb128aab  large-md-chromium-linux.html
d7c52ad02e8b72eb87ec0fb74b62b62dcef81c20212d48c7a225f532a678f3af  math-baseline-md-chromium-linux.html
```

Snapshot suffixes are `-chromium-linux`; they will regenerate per-platform on macOS/Windows. Fine for CI (ubuntu-latest), worth knowing locally.

Element census confirming complete renders: `large.md` → 524 `<h2>`, 1571 `<li>`, 104 `<pre>`, 74 `<table>`, 47 `<blockquote>`.

**Baseline bugs pinned in `math-baseline` snapshot:** `$e^{i\pi} + 1 = 0$`, `$$\int_{0}^{1} x^2,dx = \frac{1}{3}$$`, and `(a^2 + b^2 = c^2)` all appear as literal text; zero occurrences of `katex` or `<math`.

---

## 7. Commands

```bash
# Toolchain (Node 22 is required; only Node 24 was on this machine)
nvm use 22
corepack enable pnpm

pnpm install          # install
pnpm dev              # dev server
pnpm build            # production build -> dist/
pnpm preview          # serve the built output
pnpm test             # unit tests (Vitest)          29 tests
pnpm test:e2e         # browser tests (Playwright)   17 tests
pnpm test:e2e:update  # re-baseline golden snapshots
pnpm lint             # eslint src tests
pnpm format           # prettier

# First e2e run on a new machine:
pnpm exec playwright install --with-deps chromium

# Docker (unverified — no runtime available here)
docker build -t waynepdf .
docker run -p 8080:80 waynepdf
```

---

## 8. Backlog — "easy to fix now", deliberately left alone

Noted, not acted on, per the phase constraints.

**High value**

1. **`react-codemirror2` v8 leaks a CodeMirror instance under StrictMode** (§3). A real dev-mode DOM/memory leak, and it already caused one silent feature break. Strongest case for the CM6 migration.
2. **`Preview` chunk is 1,005 kB (349 kB gzipped)** — almost entirely `highlight.js` importing every language. Importing only the needed languages, or `highlight.js/lib/core` with explicit registration, would cut this by an order of magnitude. The build prints a chunk-size warning on every run.
3. **No debounce on render.** Every keystroke re-runs `md.render()` plus `highlightAuto()` on every unlabeled fence. `large.md` renders fine, but typing in a large document will lag.
4. **`html: true` with no sanitizer.** `<script>` and `onerror=` pass straight through to `dangerouslySetInnerHTML`. Low severity while single-user and offline; hard-blocks any shared/server-side rendering. Phase 6.

**Medium**

5. **`github-markdown-css@5` auto-switches to dark** via `prefers-color-scheme`, unlike the v3 upstream used. A user with a dark OS theme now sees a dark preview. Doesn't affect snapshots (HTML only) but is a visible change from upstream — worth a decision in Phase 2.
6. **`FileReader.readAsText()` is called with no encoding**, so non-UTF-8 files silently become mojibake. Pairs naturally with the Phase 3 BOM work.
7. **No `lang` attribute on rendered content**, which is half of the Han-unification problem the `cjk.md` fixture documents. `font-family: 微軟正黑體, sans-serif` (Windows-only) is the other half.
8. **No `print-color-adjust: exact`**, so code-block and blockquote backgrounds vanish unless the user ticks "Background graphics".

**Low**

9. `onTransfrom` is misspelled (ported verbatim from upstream).
10. `deploy.yaml` intentionally not created, per spec.
11. Default git branch renamed `master` → `main` to match the CI trigger.
12. `Hooks/index.js` barrel is created but unused; components still import hooks by direct path, as upstream did.

---

## 9. One thing to confirm

The brief opened with "you are working in the root of the `waynepdf` repository," but no local clone existed and the current directory was `md2pdf-master`. Per your answers I cloned `git@github.com:mrwayne-dev/waynepdf.git` (which exists and is genuinely empty) to **`/home/mrwayne/Documents/wayne/web_dev/waynepdf/`** and scaffolded there, leaving `md2pdf-master` untouched. **Nothing has been pushed** — the commit is local on `main`.
