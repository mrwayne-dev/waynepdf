import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import markdownItKatex from '@vscode/markdown-it-katex';
import 'katex/dist/katex.min.css';
/*
 * mhchem, imported by its CJS path on purpose — do not "tidy" this to
 * 'katex/contrib/mhchem'.
 *
 * KaTeX ships conditional exports: `import` resolves to dist/katex.mjs,
 * `require` to dist/katex.js. The bare specifier would pull mhchem.mjs, which
 * registers \ce on the ESM instance — while @vscode/markdown-it-katex is CJS
 * and renders with the require() instance. Two module objects, two macro
 * registries, and \ce silently renders as an unknown command in errorColor.
 *
 * Pointing at the CJS file puts the macros on the instance that actually does
 * the rendering. Note this cannot be caught by a unit test: Vitest's resolution
 * collapses the two instances into one, so it only reproduces in a real build.
 * tests/e2e/math.spec.js covers it.
 */
import 'katex/dist/contrib/mhchem.js';

/*
 * Curated highlight.js registration.
 *
 * `import hljs from 'highlight.js'` pulls all 190+ languages — 1005 KB raw in
 * the Preview chunk, which had earned a Vite chunk-size warning on every build
 * since Phase 0. Registering a fixed set against the core build drops the vast
 * majority of that.
 *
 * Static, not dynamic: a per-language dynamic import would make a code block
 * visibly re-highlight itself a beat after the preview paints, which is worse
 * than the bytes it saves.
 *
 * TOML has no module of its own — highlight.js handles it inside `ini`, which
 * it names "TOML, also INI" and which registers `toml` as an alias.
 */
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import clojure from 'highlight.js/lib/languages/clojure';
import cmake from 'highlight.js/lib/languages/cmake';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import erlang from 'highlight.js/lib/languages/erlang';
import fsharp from 'highlight.js/lib/languages/fsharp';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import julia from 'highlight.js/lib/languages/julia';
import kotlin from 'highlight.js/lib/languages/kotlin';
import latex from 'highlight.js/lib/languages/latex';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import matlab from 'highlight.js/lib/languages/matlab';
import nginx from 'highlight.js/lib/languages/nginx';
import nix from 'highlight.js/lib/languages/nix';
import objectivec from 'highlight.js/lib/languages/objectivec';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scala from 'highlight.js/lib/languages/scala';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import vbnet from 'highlight.js/lib/languages/vbnet';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

/** Exported so tests can assert the set without duplicating the list. */
export const LANGUAGES = {
  bash,
  c,
  clojure,
  cmake,
  cpp,
  csharp,
  css,
  dart,
  diff,
  dockerfile,
  elixir,
  erlang,
  fsharp,
  go,
  graphql,
  groovy,
  haskell,
  ini,
  java,
  javascript,
  json,
  julia,
  kotlin,
  latex,
  less,
  lua,
  makefile,
  markdown,
  matlab,
  nginx,
  nix,
  objectivec,
  perl,
  php,
  plaintext,
  powershell,
  python,
  r,
  ruby,
  rust,
  scala,
  scss,
  sql,
  swift,
  typescript,
  vbnet,
  xml,
  yaml,
};

for (const [name, definition] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, definition);
}

/*
 * registerLanguage already installs each module's own aliases, which covers
 * almost everything a user would reach for: js, ts, py, rb, sh, yml, md, tex,
 * objc, cs, c++, cxx, docker, text, toml, html. Only these two are missing —
 * highlight.js ships `shell` as a separate language (a console-session mode we
 * are not registering), so `shell` and `zsh` would otherwise fall through to
 * plain text. Julia declares no aliases of its own, so `jl` needs one too.
 *
 * Terraform/HCL is deliberately absent: highlight.js 11.9 has no module for it
 * and there is no maintained package on npm, so `hcl`/`tf` fences render plain.
 */
export const EXTRA_ALIASES = { bash: ['shell', 'zsh'], julia: ['jl'] };

for (const [languageName, aliases] of Object.entries(EXTRA_ALIASES)) {
  hljs.registerAliases(aliases, { languageName });
}

// Direct markdown-it ownership — replaces upstream's react-remarkable ->
// remarkable@1.7.1 transitive chain. Both of those are unmaintained.
const md = new MarkdownIt({
  html: true, // matches upstream behavior; sanitization comes in Phase 6
  linkify: true,
  typographer: false, // matches upstream
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        // `lang` reached here only by matching a registered name or alias, so
        // it is already a safe token; escaped anyway rather than trusting that
        // invariant to hold through future edits.
        return `<pre><code class="hljs language-${md.utils.escapeHtml(lang)}">${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch (_) {
        /* fall through to plain */
      }
    }
    /*
     * No highlightAuto. Its cost scales with the number of registered
     * languages and it ran on every unlabeled fence on every keystroke, with
     * no debounce (Phase 0 backlog §3). Unlabeled and unknown fences now
     * render as plain escaped code, which is the norm in every serious
     * Markdown environment — label the fence to get highlighting.
     */
    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

/*
 * Math.
 *
 * `enableFencedBlocks` and `enableBareBlocks` both default to OFF in the
 * plugin and are not optional for us: without the first, ```math fences render
 * as ordinary code blocks; without the second, a $$...$$ block that is not
 * separated by blank lines stays inline. Neither failure is loud.
 */
md.use(markdownItKatex.default ?? markdownItKatex, {
  throwOnError: false,
  errorColor: 'var(--wp-color-danger)',
  strict: 'ignore',
  trust: false, // no \href etc. — matches the Phase 6 sanitisation posture
  output: 'html',
  enableFencedBlocks: true,
  enableBareBlocks: true,
  macros: {
    '\\RR': '\\mathbb{R}',
    '\\NN': '\\mathbb{N}',
    '\\ZZ': '\\mathbb{Z}',
    '\\QQ': '\\mathbb{Q}',
    '\\CC': '\\mathbb{C}',
  },
});

/*
 * Expose each equation's LaTeX source as data-latex, for the copy button.
 *
 * Done by wrapping the plugin's own renderer rules, whose token.content *is*
 * the source. The alternative — scraping <annotation encoding="application/
 * x-tex"> out of the rendered HTML — cannot work here at all: that element only
 * exists in KaTeX's MathML output, and we render `output: 'html'`, so there is
 * no MathML to scrape. Reading the token is also exact rather than regex-shaped.
 *
 * `fence` is in the list because the plugin routes ```math through it; for any
 * other language the injection is a no-op, since the output has no .katex.
 */
const MATH_RENDER_RULES = [
  'math_inline',
  'math_inline_block',
  'math_inline_bare_block',
  'math_block',
  'fence',
];

const KATEX_OPEN_TAG = '<span class="katex">';

function injectLatex(html, latex) {
  if (!html.includes(KATEX_OPEN_TAG)) return html;
  const attr = md.utils.escapeHtml(latex.trim());
  // String pattern: replaces the first occurrence only, which is the one
  // .katex this token produced.
  return html.replace(
    KATEX_OPEN_TAG,
    `<span class="katex" data-latex="${attr}">`,
  );
}

for (const name of MATH_RENDER_RULES) {
  const original = md.renderer.rules[name];
  if (!original) continue;
  md.renderer.rules[name] = function withLatex(
    tokens,
    idx,
    options,
    env,
    self,
  ) {
    const html = original.call(this, tokens, idx, options, env, self);
    return injectLatex(html, tokens[idx].content ?? '');
  };
}

// Exported so tests assert against the exact instance the app renders with,
// rather than a second config that could silently drift.
export { md, hljs };

export default function Preview({ children }) {
  const html = useMemo(() => md.render(children ?? ''), [children]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
