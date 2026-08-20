# Post-Phase-6 Backlog

Work that was considered, scoped, or deliberately deferred during the phase
plan. Each entry records why it is not in the shipped product and what would
have to change for that to be worth revisiting.

## Shiki (evaluated and declined in 6e)

Deferred with clean rationale. Revisit if:

- Real users request VS Code-quality highlighting for specific languages.
- Bundle budgets grow significantly (currently the constraint is a small tool
  posture).
- Shiki ships a var-native theming mode with token granularity comparable to
  highlight.js's 40 token classes, **and** a way to avoid eager synchronous
  grammar compilation.

That third condition is narrower than it looks, and it replaces the obvious
version of itself. A CSS-var-native theming mode is usually the thing to wait
for; Shiki already has one (`createCssVariablesTheme`, measured at 4.4.3), and
it is not sufficient. It emits 11 token variables against highlight.js's 40, so
adopting it would cost granularity rather than gain it. The blocker is
granularity and startup cost, not var support.

Measurements from 6e.0 are in `PHASE_6E_DESIGN_NOTE.md` (uncommitted).

## Known limitations carried forward

- **DOCX export** (6d.2): math exports as source text rather than OMML, code
  blocks are unhighlighted, theme colours do not transfer, and adjacent code
  blocks merge into one shaded region in LibreOffice.
- **Terraform/HCL** (3.5): highlight.js 11.9 ships no module and there is no
  maintained npm package, so `hcl`/`tf` fences render as plain text.
- **CJK offline** (3): the Noto TC/SC/JP/KR subsets are runtime-cached rather
  than precached, so a CJK document needs one online visit before it works
  offline.
- **Autosave on abrupt close** (6b): `beforeunload` cannot await an IndexedDB
  write, so up to one second of typing can be lost if the tab is closed
  immediately after a keystroke. The debounce and the `visibilitychange` flush
  are the real guarantees.
