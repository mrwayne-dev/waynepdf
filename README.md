# WaynePDF

Write Markdown. Get a beautiful PDF. Offline, private, and yours to configure.

[Screenshot placeholder — coming in a later phase]

## What it is

WaynePDF is a browser-based Markdown-to-PDF converter. You paste or drop
Markdown, it renders it with clean styling, and you save it to PDF using your
browser's built-in print dialog. Nothing you write ever leaves your machine —
there's no backend, no telemetry, no analytics, and no accounts.

Under the hood it's a React 18 + Vite SPA with a PWA manifest, so you can
install it and use it fully offline once it's loaded.

## Getting started

### Use it online

[Deployed URL to be added]

### Run it locally

Requires **Node 22** and **pnpm**.

```bash
git clone git@github.com:mrwayne-dev/waynepdf.git
cd waynepdf
nvm use 22
corepack enable pnpm
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

### Run it in Docker

```bash
docker build -t waynepdf .
docker run -p 8080:80 waynepdf
```

Open `http://localhost:8080`.

## Usage

Drop a `.md` file onto the window, or click **Choose** to pick one, or start
typing on the left. When you're ready, click **Transform** and pick **Save as
PDF** in the print dialog. For cleaner output, uncheck **Headers and Footers**
in that dialog — backgrounds print automatically.

### Themes and typography

The gear button opens a settings panel with five themes — Light, Dark, Sepia,
High Contrast and Print Optimized — plus a System option that follows your OS.
Body font (Inter, Source Serif 4 or JetBrains Mono), body size, line height and
code size are all adjustable, and the preview updates live. Settings persist in
`localStorage` under `waynepdf.settings.v1`.

All three fonts are bundled as WOFF2 and served from the app's own origin, so
they work offline and no request ever leaves your machine.

## Export formats

- **PDF** — full fidelity. Themes, fonts, math, diagrams, callouts and page
  layout: everything you see is what prints.
- **HTML** — a single self-contained file. All CSS and fonts are inlined as data
  URIs, so it opens in any browser with identical rendering and makes no network
  requests at all.
- **DOCX** — a reasonable transformation for Word and LibreOffice, written
  in-house rather than by bundling a converter.

  *Preserved:* headings, paragraphs with bold/italic/strikethrough/code/links,
  ordered and unordered lists (three levels of nesting), task lists, tables with
  a repeating header row, blockquotes, code blocks, images, and diagrams as
  embedded PNGs. Frontmatter `title`, `author` and `date` become document
  metadata.

  *Not preserved:* rendered math — the LaTeX source travels as literal text you
  can paste into Word's equation editor; syntax highlighting — code is monospace
  on a plain ground; custom theme colours — DOCX uses Word's own styling;
  callout colours — a callout becomes a blockquote prefixed with `[NOTE]`,
  `[WARNING]` and so on; right-to-left text direction — the whole document is
  laid out left-to-right.

  Reach for HTML or PDF when fidelity matters, and DOCX when the point is to
  hand someone content they can edit.

## Roadmap

WaynePDF is being built in phases. Current state: **Phase 2 complete**.

- **Phase 0** — Vite + React 18 foundation, markdown-it parser, test harness.
  Done.
- **Phase 1** — Debranding and identity. Done.
- **Phase 2** — Theming layer: five themes, three bundled fonts, settings panel.
  Done.
- **Phase 3** — Unicode correctness: BOM handling, encoding detection,
  `lang`/`dir` support.
- **Phase 4** — Math rendering via KaTeX.
- **Phase 5** — Real PDF output via paged.js: page control, running
  headers/footers, TOC.
- **Phase 6** — Frontmatter, autosave, Mermaid, callouts, Shiki, task lists,
  sanitization, exports.

## Development

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm preview          # preview production build
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # browser tests (Playwright), both projects
pnpm test:e2e:parallel # everything except pagination, multi-worker
pnpm test:e2e:paged   # pagination only, single worker
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm gen:icons        # regenerate favicon and PWA icons from public/favicon.svg
```

### Icons

Every icon the app ships — the SVG favicon, the ICO fallback, the PWA icons,
the Apple touch icon, and the social share image — is generated from the single
master at `public/favicon.svg` by `scripts/generate-icons.mjs`. To change the
mark, edit that SVG and run `pnpm gen:icons`; the generated files are committed,
and the script is idempotent, so a re-run with an unchanged master produces
byte-identical output.

## Credits

WaynePDF is a fork and rewrite of
[realdennis/md2pdf](https://github.com/realdennis/md2pdf), an offline-first
Markdown-to-PDF web app. The original project is MIT-licensed; upstream's
license is preserved in `UPSTREAM_LICENSE`. Every substantive component has been
rewritten, but the debt is real and acknowledged.

## License

MIT. See `LICENSE` for the current copyright and `UPSTREAM_LICENSE` for the
original.
