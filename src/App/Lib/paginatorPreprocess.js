/*
 * DOM preparation for pagination.
 *
 * paged.js fragments whatever DOM it is given, so anything that must appear in
 * the printed artefact but not in the flowing preview — cover page, table of
 * contents — is injected here rather than into the React tree. Keeping it out
 * of React also keeps reconciliation away from pagination artefacts.
 */

/** GitHub-ish slug: lowercase, strip punctuation, spaces to hyphens. */
export function slugify(text) {
  const base = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'section';
}

/**
 * Assigns stable ids to headings that lack them.
 *
 * markdown-it emits no heading ids and Phase 5 is not adding
 * markdown-it-anchor, so the TOC's target-counter(attr(href)) has nothing to
 * point at without this. Duplicate slugs get a numeric suffix, the same way
 * GitHub does, so two "Overview" headings stay distinguishable.
 */
export function ensureHeadingIds(root) {
  const seen = new Map();
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    if (heading.id) {
      seen.set(heading.id, (seen.get(heading.id) ?? 0) + 1);
      continue;
    }
    const base = slugify(heading.textContent);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    heading.id = count === 0 ? base : `${base}-${count}`;
  }
  return root;
}

/**
 * Builds the TOC as nested <ol>, one level of nesting per heading level.
 *
 * Levels are tracked against the *first* heading level seen rather than
 * assuming h1, because a document may legitimately start at h2.
 */
export function buildToc(doc, root, depth) {
  const selector = Array.from({ length: depth }, (_, i) => `h${i + 1}`).join(
    ',',
  );
  const headings = [...root.querySelectorAll(selector)];
  if (headings.length === 0) return null;

  const nav = doc.createElement('nav');
  nav.className = 'wp-toc';
  const title = doc.createElement('h2');
  title.textContent = 'Contents';
  // Excluded from its own listing, and from {title} string-set.
  title.setAttribute('data-wp-toc-title', '');
  nav.appendChild(title);

  const baseLevel = Number(headings[0].tagName[1]);
  let currentList = doc.createElement('ol');
  nav.appendChild(currentList);
  const stack = [{ level: baseLevel, list: currentList }];

  for (const heading of headings) {
    const level = Number(heading.tagName[1]);

    while (stack.length > 1 && level < stack[stack.length - 1].level) {
      stack.pop();
    }
    while (level > stack[stack.length - 1].level) {
      const parentList = stack[stack.length - 1].list;
      const lastItem = parentList.lastElementChild;
      const nested = doc.createElement('ol');
      // A nested list needs an <li> to hang from; synthesise one if the
      // document skipped a level (h1 straight to h3).
      if (lastItem) lastItem.appendChild(nested);
      else parentList.appendChild(doc.createElement('li')).appendChild(nested);
      stack.push({ level: stack[stack.length - 1].level + 1, list: nested });
    }

    const li = doc.createElement('li');
    const a = doc.createElement('a');
    a.setAttribute('href', `#${heading.id}`);
    // The label is wrapped so the dotted leader (a flex filler in ::before)
    // can sit between it and the page number in ::after.
    const label = doc.createElement('span');
    label.className = 'wp-toc-label';
    label.textContent = heading.textContent;
    a.appendChild(label);
    li.appendChild(a);
    stack[stack.length - 1].list.appendChild(li);
  }

  return nav;
}

/** Cover page section. Title falls back to the document's first H1. */
export function buildCover(doc, root, cover) {
  const section = doc.createElement('section');
  section.className = 'wp-cover-page';

  const firstH1 = root.querySelector('h1');
  const title = cover.title || firstH1?.textContent?.trim() || 'Document';
  const date = cover.date || new Date().toISOString().slice(0, 10);

  const add = (tag, className, text) => {
    if (!text) return;
    const el = doc.createElement(tag);
    el.className = className;
    el.textContent = text;
    section.appendChild(el);
  };

  add('h1', 'wp-cover-title', title);
  add('p', 'wp-cover-subtitle', cover.subtitle);

  const meta = doc.createElement('div');
  meta.className = 'wp-cover-meta';
  const author = doc.createElement('span');
  author.className = 'wp-cover-author';
  author.textContent = cover.author || '';
  const dateEl = doc.createElement('span');
  dateEl.className = 'wp-cover-date';
  dateEl.textContent = date;
  meta.append(author, dateEl);
  section.appendChild(meta);

  return section;
}

/** Best title for document.title / the PDF filename. */
export function deriveTitle(layout, root) {
  if (layout?.cover?.enabled && layout.cover.title) return layout.cover.title;
  const h1 = root?.querySelector?.('h1');
  const text = h1?.textContent?.trim();
  return text || 'Document';
}

/**
 * Produces the DOM paged.js will fragment.
 *
 * Returns a detached container; the caller never mutates the live preview.
 * `doc` is injectable so this is testable outside a browser.
 */
export function preprocess(sourceHtml, layout, doc = document) {
  const container = doc.createElement('div');
  container.className = 'wp-paged-source';

  const body = doc.createElement('div');
  body.className = 'markdown-body';
  body.innerHTML = sourceHtml ?? '';

  ensureHeadingIds(body);

  // Cover first, then TOC, then the document — the order they print in.
  if (layout?.cover?.enabled) {
    container.appendChild(buildCover(doc, body, layout.cover));
  }
  if (layout?.toc?.enabled) {
    const nav = buildToc(doc, body, layout.toc.depth ?? 2);
    if (nav) container.appendChild(nav);
  }

  container.appendChild(body);
  return container;
}
