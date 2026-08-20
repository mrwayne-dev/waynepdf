/*
 * markdown-it tokens to an intermediate representation.
 *
 * The IR exists so that "did the parse understand this document" and "did the
 * OOXML come out right" are two separate questions with two separate tests.
 * Going from tokens straight to XML strings would make every parsing bug a
 * matter of unzipping a .docx to find out what happened.
 *
 * Blocks are flat except for blockquotes, which nest. Runs are the inline spans
 * inside a block.
 */

/** Callout container tokens are named after their type by markdown-it-container. */
const CONTAINER = /^container_([a-z]+)_(open|close)$/;

const emptyRun = (run) => !run.text;

/**
 * Flattens an inline token's children into formatted runs.
 *
 * markdown-it emits inline formatting as a stream of open/close tokens around
 * text rather than as a tree, so the formatting state is a set of counters and
 * every text token is stamped with whatever is currently open.
 */
export function parseInline(token) {
  const runs = [];
  const images = [];
  let checkbox;
  if (!token?.children) return { runs, images, checkbox };

  let bold = 0;
  let italic = 0;
  let strike = 0;
  let link = null;

  const push = (text, extra = {}) => {
    if (!text) return;
    runs.push({
      text,
      ...(bold > 0 ? { bold: true } : {}),
      ...(italic > 0 ? { italic: true } : {}),
      ...(strike > 0 ? { strike: true } : {}),
      ...(link ? { link } : {}),
      ...extra,
    });
  };

  for (const child of token.children) {
    switch (child.type) {
      case 'text':
        push(child.content);
        break;
      case 'code_inline':
        push(child.content, { code: true });
        break;
      case 'strong_open':
        bold += 1;
        break;
      case 'strong_close':
        bold -= 1;
        break;
      case 'em_open':
        italic += 1;
        break;
      case 'em_close':
        italic -= 1;
        break;
      case 's_open':
        strike += 1;
        break;
      case 's_close':
        strike -= 1;
        break;
      case 'link_open':
        link = child.attrGet('href') ?? '';
        break;
      case 'link_close':
        link = null;
        break;
      case 'softbreak':
        push(' ');
        break;
      case 'hardbreak':
        push('\n');
        break;
      case 'image':
        // Collected separately: OOXML cannot put a picture inside a text run's
        // sibling stream the way HTML can, so images become their own blocks.
        images.push({
          type: 'image',
          dataUri: child.attrGet('src') ?? '',
          alt: child.content ?? '',
        });
        break;
      case 'math_inline':
      case 'math_inline_bare_block':
        /*
         * The delimiters are put back deliberately. The KaTeX plugin strips them
         * into token.content, and DOCX carries math as source text — without the
         * `$` a reader cannot tell "e^{i\pi}" from prose, and cannot paste it
         * into Word's equation editor either.
         */
        push(`$${child.content}$`, { code: true });
        break;
      case 'html_inline': {
        /*
         * markdown-it-task-lists rewrites a task item's inline children into raw
         * HTML — an <input type="checkbox"> and a <label> — inside the inline
         * token, not beside it. Two consequences: the checkbox state cannot be
         * read at block level, and the item's visible text exists ONLY inside
         * the label's markup. Dropping html_inline wholesale, which is right for
         * every other raw-HTML case, silently emptied every task item.
         */
        const html = child.content ?? '';
        const state = readCheckbox(html);
        if (state !== null) {
          checkbox = state;
          break;
        }
        const label = TASK_LABEL.exec(html);
        if (label) push(decodeEntities(label[1]).replace(/^\s+/, ''));
        break;
      }
      default:
        if (child.content) push(child.content);
        break;
    }
  }

  return { runs: runs.filter((run) => !emptyRun(run)), images, checkbox };
}

const TASK_LABEL =
  /^<label[^>]*class="task-list-item-label"[^>]*>([\s\S]*)<\/label>$/;

/*
 * The label's text arrives HTML-escaped. Decoded with a textarea rather than a
 * table of entities: the browser's own parser is exhaustive and this runs in a
 * browser anyway.
 */
function decodeEntities(html) {
  if (!/&[a-z#0-9]+;/i.test(html)) return html;
  if (typeof document === 'undefined') return html;
  const element = document.createElement('textarea');
  element.innerHTML = html;
  return element.value;
}

/** `null` when the markup is not a task-list checkbox at all. */
function readCheckbox(html) {
  if (!/^<input[^>]*type="checkbox"/.test(html)) return null;
  return /\bchecked\b/.test(html);
}

/**
 * @param {string} markdown
 * @param {object} md  the app's markdown-it instance
 * @returns {Array} flat list of IR blocks
 */
export function parseMarkdown(markdown, md) {
  const tokens = md.parse(markdown ?? '', {});
  return blocksFrom(tokens);
}

function blocksFrom(tokens) {
  const blocks = [];

  // Stacks, because lists and blockquotes nest and markdown-it reports the
  // nesting only as open/close pairs.
  const listStack = [];
  let pendingCheckbox = null;

  // A blockquote (or callout) collects its own tokens and is parsed recursively
  // once its closing token arrives — the alternative is threading a second
  // output target through every branch below.
  let quoteDepth = 0;
  let quoteTokens = [];
  let quoteMeta = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (quoteDepth > 0) {
      const container = CONTAINER.exec(token.type);
      if (token.type === 'blockquote_open' || container?.[2] === 'open') {
        quoteDepth += 1;
      } else if (
        token.type === 'blockquote_close' ||
        container?.[2] === 'close'
      ) {
        quoteDepth -= 1;
        if (quoteDepth === 0) {
          blocks.push({
            type: 'blockquote',
            ...quoteMeta,
            children: blocksFrom(quoteTokens),
          });
          quoteTokens = [];
          quoteMeta = null;
          continue;
        }
      }
      quoteTokens.push(token);
      continue;
    }

    const container = CONTAINER.exec(token.type);
    if (container && container[2] === 'open') {
      quoteDepth = 1;
      quoteMeta = {
        calloutType: container[1],
        // markdown-it-container puts anything after the type on the info string.
        calloutTitle: (token.info ?? '')
          .trim()
          .slice(container[1].length)
          .trim(),
      };
      continue;
    }

    switch (token.type) {
      case 'blockquote_open':
        quoteDepth = 1;
        quoteMeta = {};
        break;

      case 'heading_open': {
        const level = Number(token.tag.slice(1)) || 1;
        const inline = tokens[i + 1];
        const { runs, images } = parseInline(inline);
        blocks.push({ type: 'heading', level, runs });
        blocks.push(...images);
        i += 2; // inline + heading_close
        break;
      }

      case 'paragraph_open': {
        const inline = tokens[i + 1];
        const { runs, images, checkbox } = parseInline(inline);
        if (checkbox !== undefined) pendingCheckbox = checkbox;

        if (listStack.length > 0) {
          const list = listStack[listStack.length - 1];
          const item = list.items[list.items.length - 1];
          if (item) {
            // A loose list item wraps its text in a paragraph; a second
            // paragraph inside one item is appended rather than starting a new
            // bullet.
            item.runs = item.runs.length
              ? [...item.runs, { text: '\n' }, ...runs]
              : runs;
            if (pendingCheckbox !== null) {
              item.checkbox = pendingCheckbox;
              pendingCheckbox = null;
            }
          }
        } else if (runs.length > 0) {
          blocks.push({ type: 'paragraph', runs });
        }
        // Images always become their own block, inside a list or not.
        blocks.push(...images);
        i += 2; // inline + paragraph_close
        break;
      }

      case 'bullet_list_open':
      case 'ordered_list_open':
        listStack.push({
          type: 'list',
          ordered: token.type === 'ordered_list_open',
          items: [],
        });
        break;

      case 'bullet_list_close':
      case 'ordered_list_close': {
        const finished = listStack.pop();
        if (!finished) break;
        if (listStack.length === 0) {
          if (finished.items.length > 0) blocks.push(finished);
        } else {
          // Nested: fold the child's items into the parent one level deeper.
          const parent = listStack[listStack.length - 1];
          for (const item of finished.items) {
            parent.items.push({ ...item, level: item.level + 1 });
          }
        }
        break;
      }

      case 'list_item_open': {
        const list = listStack[listStack.length - 1];
        if (list) list.items.push({ level: 0, runs: [] });
        break;
      }

      case 'inline': {
        // Reached only for inline tokens this walker did not consume alongside
        // their opening token — a list item's tight content, for one.
        const { runs, images, checkbox } = parseInline(token);
        if (checkbox !== undefined) pendingCheckbox = checkbox;
        const list = listStack[listStack.length - 1];
        const item = list?.items[list.items.length - 1];
        if (item) {
          item.runs = [...item.runs, ...runs];
          if (pendingCheckbox !== null) {
            item.checkbox = pendingCheckbox;
            pendingCheckbox = null;
          }
        } else if (runs.length > 0) {
          blocks.push({ type: 'paragraph', runs });
        }
        blocks.push(...images);
        break;
      }

      case 'math_block':
        /*
         * Display math as a fenced source block: monospace on a shaded ground,
         * which reads as "this is source" rather than as a mangled sentence.
         * Typesetting it would mean emitting OMML, which is out of scope.
         */
        blocks.push({
          type: 'code',
          language: 'math',
          content: `$$\n${(token.content ?? '').replace(/\n$/, '')}\n$$`,
        });
        break;

      case 'fence':
      case 'code_block':
        blocks.push({
          type: 'code',
          language: (token.info ?? '').trim().split(/\s+/)[0] ?? '',
          // markdown-it keeps the trailing newline; it would render as a blank
          // final line in the document.
          content: (token.content ?? '').replace(/\n$/, ''),
        });
        break;

      case 'table_open':
        i = parseTable(tokens, i, blocks) - 1;
        break;

      case 'hr':
        blocks.push({ type: 'hr' });
        break;

      case 'html_block':
        break;

      default:
        break;
    }
  }

  return blocks;
}

/** Consumes a table and returns the index just past `table_close`. */
function parseTable(tokens, start, blocks) {
  const table = { type: 'table', headers: [], rows: [] };
  let inHead = false;
  let row = null;

  let i = start + 1;
  for (; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === 'table_close') {
      i += 1;
      break;
    }
    switch (token.type) {
      case 'thead_open':
        inHead = true;
        break;
      case 'thead_close':
        inHead = false;
        break;
      case 'tr_open':
        row = [];
        break;
      case 'tr_close':
        if (!row) break;
        if (inHead) table.headers = row;
        else table.rows.push(row);
        row = null;
        break;
      case 'th_open':
      case 'td_open': {
        const inline = tokens[i + 1];
        const { runs } = parseInline(inline);
        row?.push(runs);
        i += 2; // inline + close
        break;
      }
      default:
        break;
    }
  }

  if (table.headers.length > 0 || table.rows.length > 0) blocks.push(table);
  return i;
}
