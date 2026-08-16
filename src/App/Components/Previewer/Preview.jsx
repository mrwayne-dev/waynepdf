import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';

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
import kotlin from 'highlight.js/lib/languages/kotlin';
import latex from 'highlight.js/lib/languages/latex';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
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
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

/** Exported so tests can assert the set without duplicating the list. */
export const LANGUAGES = {
  bash,
  c,
  clojure,
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
  kotlin,
  latex,
  less,
  lua,
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
 * plain text.
 */
export const EXTRA_ALIASES = { bash: ['shell', 'zsh'] };

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

// Exported so tests assert against the exact instance the app renders with,
// rather than a second config that could silently drift.
export { md, hljs };

export default function Preview({ children }) {
  const html = useMemo(() => md.render(children ?? ''), [children]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
