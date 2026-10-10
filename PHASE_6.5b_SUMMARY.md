# Phase 6.5b — UI Polish

## 1. Commit

`6670d1c` — *Phase 6.5b: spacing and type scales, nine chrome components
restyled*. Local on `main`, not pushed. Parent `74b0232`.

## 2. Design tokens added

All at `:root` in `src/styles/theme/variables.css`, beside Phase 2's colour and
font tokens.

```css
--wp-space-0:  0;        --wp-text-xs:   12px;    --wp-radius-sm: 4px;
--wp-space-1:  4px;      --wp-text-sm:   13px;    --wp-radius:    6px;
--wp-space-2:  8px;      --wp-text-base: 14px;    --wp-radius-lg: 8px;
--wp-space-3:  12px;     --wp-text-lg:   16px;
--wp-space-4:  16px;     --wp-text-xl:   18px;    --wp-h-control:    32px;
--wp-space-6:  24px;                              --wp-h-control-sm: 28px;
--wp-space-8:  32px;     --wp-leading-tight:  1.35;
--wp-space-12: 48px;     --wp-leading-normal: 1.5;
```

Two beyond the spec, both because the work needed them:

```css
--wp-shadow-panel: 0 4px 12px rgb(0 0 0 / 8%);   /* dark.css: 40% */
--wp-shadow-menu:  0 4px 16px rgb(0 0 0 / 12%);  /* dark.css: 55% */
```

The spec asked for a dark-theme shadow variant "use a CSS var if simpler" — it
is, and the tab context menu needed the same treatment, so both live as tokens
overridden in `dark.css`. 8% black over `#0d1117` is invisible; a panel with no
shadow and no border reads as nothing at all.

`--wp-ui-font-size` and `--wp-ui-radius` are kept as **aliases** onto the new
scale rather than removed. They are referenced from the generated print
stylesheet, and 6.5 just stabilised that pipeline — a rename sweep through it is
exactly what this phase was told not to do.

**Hygiene check passes.** `rg 'padding.*[0-9]px|margin.*[0-9]px|gap:.*[0-9]px'
src/App/Components/` returns nothing. That took four extra fixes the spec did not
list: `ErrorBoundary`'s inline `padding: '5px'`, `Loading`'s `margin: 5px`, and
`paginator.css`'s status padding and page-stack gap.

## 3. Per component

Screenshots in `PHASE_6.5b_SUMMARY_assets/{before,after}/` (gitignored). Both
sets were captured with the **same harness against the same fixtures** — the
before set was re-shot after a `git stash` of the CSS, so a pair differs only by
stylesheet.

| # | Component | Files | What changed |
|---|---|---|---|
| 1 | Header | `01-header.png` | 40 → 52px, canvas not canvas-subtle, wordmark 16px/600, mode toggle 28px, gear 28 → 32px, gap tokens. **Transform is now the accent-filled primary button** — see §6. |
| 2 | Settings panel | `02-settings.png` | Section headers uppercase + tracked at `fg-muted`, all controls on 28/32px heights, 24px between sections, 12px within, Reset is danger-coloured text. |
| 3 | Tab strip | `03-tabstrip.png`, `03-tabstrip-menu.png` | 32 → 34px, symmetric 12px padding, close button a real 16×16 box, new-tab 32×32, context menu on `radius-lg` + shadow token. |
| 4 | Toast | `04-toast.png` | Inverted pill → bordered canvas panel, `radius-lg`, shadow token, 120 → 200ms enter. |
| 5 | LazyLoad | `05-lazyload.png` | Spinner 18 → 24px, 700ms → 1s, label at `text-base`, size caption at `fg-subtle`. |
| 6 | Encoding banner | `06-encoding-banner.png` | Tint now `color-mix` off canvas rather than canvas-subtle, 12px → 13px, 8/16px padding. |
| 7 | Callouts | `07-callouts.png` | **Was already close.** Rail 4 → 3px, tint 10 → 8%, and the box switched from `em` padding to space tokens so the frame stops growing when the reader raises the document font size. Body typography untouched — that is document content. |
| 8 | Editor pane + drag bar | `08-editor-dragbar.png` | Wrapper unchanged (CodeMirror owns its inset). Drag bar 15px → 4px, `border` colour, accent on hover. |
| 9 | Preview pane | `09-preview-pane.png` | 10px padding → 24/32px, measure capped at 800px and centred. |

Full app, `10-full-app-light.png` and `10-full-app-dark.png`: header, tab strip,
editor, preview and an open Settings panel. Chrome typography and spacing are
identical between the two themes; only the palette moves.

## 4. Worker cap

`workers: 4 → 3`. Three consecutive full runs of `pnpm test:e2e:parallel`:

| Run | Wall clock | Result |
|---|---:|---|
| 1 | **101s** | 233 passed |
| 2 | **101s** | 233 passed |
| 3 | **100s** | 233 passed |

For comparison, three runs at 4 workers earlier in this session: 110s, 114s,
114s — with intermittent 34s stalls on the cross-theme specs. **Three workers is
both more reliable and faster**, because a timing-out worker costs more than the
parallelism it buys.

## 5. Token values adjusted from the spec

**One**, and it was a spec impossibility rather than a taste call.

- **Preview pane centring.** The spec asked for `padding: 24px 32px` *and*
  `.markdown-body { max-width: 800px; margin: auto }`. Those are the same
  element — `.preview` **is** `.markdown-body` — so the two rules fight. My first
  attempt centred with percentage padding and broke the pane completely: a
  percentage in `padding` resolves against the containing block, which for this
  flex item is the full split row, not the pane it is shrunk into. On a 1600px
  window that computed 400px of padding onto an 800px pane and rendered the
  document one character per line. Shipped instead as
  `box-sizing: border-box; max-width: calc(800px + var(--wp-space-8) * 2);
  margin-inline: auto` with the spec's padding, which yields exactly an 800px
  measure. The surplus shows the app canvas, which `app.css` paints with the same
  `--wp-color-canvas`, so there is no visible seam in any theme.

Everything else is the spec's values verbatim.

## 6. Decisions taken without asking

The brief said to pick one and note it.

- **Transform is accent-filled.** The spec described a "Transform split button …
  dropdown caret button 28px wide with 1px left divider". **There is no split
  button** — Transform is a plain `<p class="button download">` with no dropdown,
  and building one would be a new feature, which this phase forbids. I styled it
  to the stated height, radius and padding, skipped the caret, and made it the
  one accent-filled control in the header, since it is the app's primary action
  and previously looked identical to "Choose". **Revisit-worthy** if the split
  button was actually wanted.
- **Tab separators kept.** The spec says tabs are flush with no gap, and does not
  mention the 1px `border-right`. I kept it: without it, two adjacent inactive
  tabs have no boundary at all.
- **`.wp-section-head` lost its underline.** It is a `<legend>`, which
  shrink-wraps regardless of `display: block`, so `border-bottom` underlined only
  the word "Layout" rather than the section. The uppercase tracking now does that
  job.

## 7. Should be split / refactored — noted, not acted on

- **`Header/index.jsx`** is a 250-line styled-component holding the entire
  print-and-transform flow *and* all header chrome CSS. The Transform handler
  (paginate → set title → `window.print()` → cleanup) has nothing to do with
  layout and belongs in `Lib/`. This is the file most in need of splitting.
- **`Settings/styles.css`** is 430 lines covering gear, panel, fieldsets, sliders,
  selects, swatches, pills, checkboxes, collapsibles and the layout section. It
  is really six stylesheets in a trench coat.
- **`Upload.jsx`** positions its own invisible `<label>` with six inline style
  properties to make a file input clickable. It should be a class.

## 8. Bug found, and deliberately not fixed

**`Lib/uploadFile.js` writes to the wrong CodeMirror after a tab switch.**

React StrictMode leaves two connected `.CodeMirror` nodes. Phase 0 established
that "the live one is the last one created" and both `uploadFile.js` and the
test-only setText hook rely on it. That holds at first mount. **It does not hold
after a keyed remount** — which is what a tab switch now does — and the survivor
is not reliably last.

Writing to the wrong instance is *silent*: react-codemirror2's change handler
early-returns once its component has unmounted, so the text never reaches the
store at all. Measured directly:

```
[after new tab]  node[0] visible=true value=""     node[1] visible=true value=""
[after setText]  node[0] visible=true value=""     node[1] value="# Written After Switch"
```

**User-facing symptom**: switch tabs, then drop a `.md` file — nothing loads.

I fixed the **test hook** (it is compiled out of production and the suite cannot
be trusted without it) by writing to every instance; dead ones ignore it.
I did **not** fix `uploadFile.js`, because it is production behaviour and this
phase's constraint is explicit: no non-visual behaviour changes. The fix is the
same one line:

```js
for (const node of document.querySelectorAll('.CodeMirror')) {
  node.CodeMirror?.setValue(val);
}
```

**This deserves its own commit.** It is the third bug traced to the duplicate
StrictMode instance, and the real fix is the CodeMirror 6 migration deferred
since Phase 0.

## 9. Deviations

1. **Preview centring implemented differently** (§5) — the spec's two rules
   target one element.
2. **No Transform split button** (§6) — it does not exist and adding it is a
   feature.
3. **Toast exit animation not implemented.** The spec asks for "fade 200ms on
   exit". `Toast.jsx` sets `message` to `null` and unmounts; an exit transition
   needs a leaving state, which is a component behaviour change. Enter is 200ms
   as specified.
4. **Two extra tokens** (`--wp-shadow-panel`, `--wp-shadow-menu`) (§2).
5. **Two source fixes beyond styling** (`useDragReorder.js`, the setText hook) —
   both pre-existing edge cases that the new spacing made reachable, and both
   required to keep the suite green. Detailed in the commit message and §8.
6. **Four extra components tokenised** — `ErrorBoundary`, `Loading`, and two
   rules in `paginator.css` — because the brief's `rg` hygiene check covers all of
   `src/App/Components/`, not just the nine named.
7. **Visual baselines regenerated** (7 PNGs in `tests/e2e/__screenshots__/`). The
   preview pane's geometry changed, so every theme and RTL baseline was stale.
   Re-verified stable over two repeats.
8. **Screenshot harness lives outside `tests/`.** A throwaway spec under
   `tests/e2e/` gets collected by `pnpm test:e2e:parallel`; it ran as a
   standalone Playwright script against a dev server on port 5175 instead, so the
   suite it documents stayed untouched.

## 10. Residual flakiness

`tabs.spec.js` → "dragging a tab reorders it" flaked roughly **1 run in 4** after
the spacing change, from two separate causes. Both are addressed: the midpoint
comparison (§ commit) and a test that now aims a quarter into the target rather
than at the exact decision boundary.

It is **not provably zero**. Measured after the fixes: 0 failures in 12 isolated
repeats of the exact gesture, 0 in three consecutive full-suite runs, but 1 in
113 during a `--repeat-each=6` single-file run. The residue is the §8 duplicate
instance under contention. Worth knowing rather than discovering later.

## 11. Verification

| | Result |
|---|---|
| `pnpm build` | Clean, no new warnings. Precache 92 entries / 4059 KiB |
| Unit | **696 passed** (unchanged) |
| E2E parallel | **233 passed** ×3 consecutive |
| E2E paged | **58 passed** |
| `pnpm lint` | Clean |
| Hygiene `rg` | No hardcoded px padding/margin/gap in `src/App/Components/` |
| Themes | Chrome spacing and type identical across Light, Dark, Sepia |

No new tests, as specified — the screenshots are the evidence. IndexedDB and
localStorage schemas untouched. No dependencies added. The paged.js pipeline and
6.5's print CSS were not modified; `paginator.css`'s two screen-only values were
tokenised and its `@media print` block left alone.

## 12. Staged summaries

All eight prior summaries confirmed still **staged, not committed** — nine with
this one:

```
A  PHASE_0_SUMMARY.md   A  PHASE_3_SUMMARY.md    A  PHASE_6.5_SUMMARY.md
A  PHASE_1_SUMMARY.md   A  PHASE_5_SUMMARY.md    A  PHASE_6B_SUMMARY.md
A  PHASE_2_SUMMARY.md   A  PHASE_3.5_and_4_SUMMARY.md
```

The commit used an explicit 19-path pathspec.
