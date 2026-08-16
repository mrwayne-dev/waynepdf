import DOMPurify from 'dompurify';

/*
 * Optional HTML sanitisation.
 *
 * Off by default, and that is a considered position rather than laziness: the
 * app is single-user, offline, and renders documents the user themselves opened,
 * so `html: true` has been the behaviour since Phase 0 and turning it off would
 * break every document that relies on raw HTML. The toggle exists for the case
 * the default cannot cover — Markdown pasted in from somewhere untrusted.
 *
 * The allow-list is wider than DOMPurify's default because four prior phases
 * put things in the output that a naive sanitiser strips: KaTeX emits MathML,
 * Mermaid emits SVG, and both carry attributes DOMPurify does not know.
 */

const CONFIG = {
  ADD_TAGS: [
    // KaTeX MathML output.
    'annotation',
    'semantics',
    'math',
    'mfrac',
    'msup',
    'msub',
    'msubsup',
    'mrow',
    'mi',
    'mn',
    'mo',
    'mtext',
    'mspace',
    'msqrt',
    'mroot',
    'munder',
    'mover',
    'munderover',
    'mtable',
    'mtr',
    'mtd',
    // Mermaid SVG output.
    'use',
    'symbol',
    'foreignObject',
    'marker',
    'clipPath',
  ],
  ADD_ATTR: [
    'data-latex',
    'aria-hidden',
    'xmlns',
    'xmlns:xlink',
    'encoding',
    'markerWidth',
    'markerHeight',
    'refX',
    'refY',
    'orient',
    'clip-path',
    'dominant-baseline',
    'text-anchor',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'form'],
  FORBID_ATTR: [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onfocus',
    'onanimationend',
  ],
};

export function sanitize(html) {
  if (typeof html !== 'string' || html === '') return '';
  return DOMPurify.sanitize(html, CONFIG);
}
