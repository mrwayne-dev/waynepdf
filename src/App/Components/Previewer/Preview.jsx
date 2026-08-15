import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
// No stylesheet import here: all four hljs themes are injected in main.jsx and
// toggled by applyTheme, so the highlighting follows the app theme.

// Direct markdown-it ownership — replaces upstream's react-remarkable ->
// remarkable@1.7.1 transitive chain. Both of those are unmaintained.
const md = new MarkdownIt({
  html: true, // matches upstream behavior; sanitization comes in Phase 6
  linkify: true,
  typographer: false, // matches upstream
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre><code class="hljs language-${lang}">${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch (_) {
        /* fall through */
      }
    }
    try {
      return `<pre><code class="hljs">${hljs.highlightAuto(str).value}</code></pre>`;
    } catch (_) {
      return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    }
  },
});

// Exported so tests assert against the exact instance the app renders with,
// rather than a second config that could silently drift.
export { md };

export default function Preview({ children }) {
  const html = useMemo(() => md.render(children ?? ''), [children]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
