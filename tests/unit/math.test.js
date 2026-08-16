import { describe, it, expect } from 'vitest';
import { md } from '@/App/Components/Previewer/Preview.jsx';

/*
 * KaTeX integration, asserted against the same markdown-it instance the app
 * renders with.
 */

/** Pulls every data-latex value out of rendered HTML, unescaped. */
const latexAttrs = (html) =>
  [...html.matchAll(/data-latex="([^"]*)"/g)].map((m) =>
    m[1]
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  );

describe('inline math', () => {
  it('renders $...$ as KaTeX', () => {
    const html = md.render('Inline $e^{i\\pi} + 1 = 0$ here.');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$e^');
  });

  it('renders several inline expressions in one paragraph', () => {
    const html = md.render('$x = 1$, $y = 2$, $z = x + y$.');
    expect(html.match(/class="katex"/g)).toHaveLength(3);
  });

  it('renders mid-sentence math without eating the sentence', () => {
    const html = md.render('and mid-sentence $a^2 + b^2 = c^2$ works.');
    expect(html).toContain('class="katex"');
    expect(html).toContain('mid-sentence');
    expect(html).toContain('works.');
  });
});

describe('display math', () => {
  it('renders $$...$$ on its own paragraph as katex-display', () => {
    const html = md.render('$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$');
    expect(html).toContain('class="katex-display"');
  });

  it('renders a single-line $$...$$ as katex-display', () => {
    const html = md.render('$$\\int_0^1 x\\,dx$$');
    expect(html).toContain('class="katex-display"');
  });

  it('renders a bare $$ block not separated by blank lines', () => {
    // enableBareBlocks. Without it this stays inline and nobody notices.
    const html = md.render('text before\n$$\nx = 1\n$$\ntext after');
    expect(html).toContain('class="katex-display"');
  });
});

describe('fenced math blocks', () => {
  it('renders a ```math fence as display math, not a code block', () => {
    // enableFencedBlocks. Defaults to OFF in the plugin.
    const html = md.render(
      '```math\n\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e\n```',
    );
    expect(html).toContain('class="katex-display"');
    expect(html).not.toContain('<pre><code');
  });

  it('leaves a non-math fence alone', () => {
    const html = md.render('```js\nconst a = 1;\n```');
    expect(html).toContain('<pre><code');
    expect(html).not.toContain('class="katex');
  });
});

/*
 * Delimiter rules.
 *
 * The plugin does NOT implement pandoc's rule (opening $ not followed by
 * whitespace, closing $ not preceded by whitespace). It implements a
 * word-boundary rule on the characters *outside* the delimiters: a $ can open
 * only when preceded by start-of-input, whitespace or punctuation, and can
 * close only when followed by the same.
 *
 * The practical effect is the same for currency — a digit immediately after $
 * blocks it from closing, which is what protects "$5.99" — but it is laxer
 * about whitespace inside the delimiters. Both behaviours are pinned here so a
 * plugin upgrade that changes either one is visible.
 */
describe('delimiter rules: currency is protected', () => {
  it.each([
    ['costs $5.99 and $10 here'],
    ['he owes $10 to me'],
    ['Price: $5.99'],
    ['from $10 to $20'],
    ['It cost $30, then $40.'],
    ['USD $100 and EUR $200 totals'],
    ['$5 or $6?'],
    ['Total: $42 (paid)'],
  ])('%s stays prose', (src) => {
    expect(md.render(src)).not.toContain('class="katex');
  });

  it('a digit right after $ is what blocks the close', () => {
    expect(md.render('a $5 b $6 c')).not.toContain('class="katex');
    // Swap the digits for letters and the same shape does become math.
    expect(md.render('a $x b$ c')).toContain('class="katex"');
  });
});

describe('delimiter rules: known laxity vs pandoc', () => {
  // Documented, not desired. Pandoc would reject all three because of the
  // whitespace immediately inside a delimiter; this plugin accepts them.
  it.each([['$ a + b$'], ['$a + b $'], ['a $ b $ c']])(
    'whitespace inside delimiters still parses as math: %s',
    (src) => {
      expect(md.render(src)).toContain('class="katex"');
    },
  );
});

describe('chemistry via mhchem', () => {
  it('renders inline \\ce{} without an error', () => {
    const html = md.render('water $\\ce{H2O}$');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-error');
    // errorColor, not katex-error, is how an unregistered \ce surfaces. Vitest
    // collapses KaTeX's ESM and CJS instances so this passes either way here;
    // tests/e2e/math.spec.js is what actually guards the registration.
    expect(html).not.toContain('var(--wp-color-danger)');
    expect(html).toContain('mord');
  });

  it('renders a reaction arrow', () => {
    const html = md.render('$\\ce{Fe + O2 -> Fe2O3}$');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-error');
  });

  it('renders \\ce{} in display math', () => {
    const html = md.render('$$\n\\ce{CO2 + H2O -> H2CO3}\n$$');
    expect(html).toContain('class="katex-display"');
    expect(html).not.toContain('katex-error');
  });
});

describe('bundled macros', () => {
  it.each(['\\RR', '\\NN', '\\ZZ', '\\QQ', '\\CC'])(
    '%s expands without error',
    (macro) => {
      const html = md.render(`$${macro}$`);
      expect(html).toContain('class="katex"');
      expect(html).not.toContain('katex-error');
    },
  );

  it('an unbundled macro renders in the error colour, not silently blank', () => {
    // Under strict:'ignore' + throwOnError:false an *unknown command* is not a
    // parse error: KaTeX emits the literal text tinted with errorColor inside a
    // normal .katex span. Only a genuine parse failure produces .katex-error.
    const html = md.render('$\\NotAMacro$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('var(--wp-color-danger)');
    expect(html).toContain('NotAMacro');
  });
});

describe('malformed math', () => {
  it('renders katex-error instead of throwing', () => {
    expect(() => md.render('$\\frac{1}{$')).not.toThrow();
    expect(md.render('$\\frac{1}{$')).toContain('katex-error');
  });

  it('keeps the raw source visible in the error output', () => {
    const html = md.render('$\\frac{1}{$');
    expect(html).toContain('frac');
  });

  it('does not abort the rest of the document', () => {
    const html = md.render('$\\frac{1}{$\n\n# Still Here\n');
    expect(html).toContain('katex-error');
    expect(html).toContain('<h1>Still Here</h1>');
  });
});

describe('math inside code stays literal', () => {
  it('a fenced code block keeps its dollar signs', () => {
    const html = md.render("```js\nconst price = '$5';\n```");
    expect(html).not.toContain('class="katex');
    expect(html).toContain('$5');
  });

  it('inline code keeps its dollar signs', () => {
    const html = md.render('literal `$a^2$` stays');
    expect(html).not.toContain('class="katex');
    expect(html).toContain('<code>$a^2$</code>');
  });
});

describe('data-latex injection', () => {
  it('adds data-latex to inline math with the source', () => {
    const html = md.render('$e^{i\\pi} + 1 = 0$');
    expect(latexAttrs(html)).toEqual(['e^{i\\pi} + 1 = 0']);
  });

  it('adds data-latex to display math', () => {
    const html = md.render('$$\n\\int_0^1 x\\,dx\n$$');
    expect(latexAttrs(html)).toEqual(['\\int_0^1 x\\,dx']);
  });

  it('adds data-latex to a fenced math block', () => {
    const html = md.render('```math\n\\sum_n n\n```');
    expect(latexAttrs(html)).toEqual(['\\sum_n n']);
  });

  it('adds one data-latex per equation, in document order', () => {
    const html = md.render('$a$ and $b$ and $c$');
    expect(latexAttrs(html)).toEqual(['a', 'b', 'c']);
  });

  it('every .katex element carries a data-latex', () => {
    const html = md.render(
      '$a^2$\n\n$$\nb^2\n$$\n\n```math\nc^2\n```\n\n$\\ce{H2O}$',
    );
    const katexOpens = html.match(/<span class="katex"/g) ?? [];
    const withAttr = html.match(/<span class="katex" data-latex=/g) ?? [];
    expect(withAttr).toHaveLength(katexOpens.length);
    expect(katexOpens.length).toBe(4);
  });

  it('escapes quotes in the attribute so the HTML stays well-formed', () => {
    const html = md.render('$\\text{a "quoted" thing}$');
    expect(html).toContain('data-latex="');
    expect(html).not.toMatch(/data-latex="[^"]*"[^">]*"/);
    expect(latexAttrs(html)[0]).toContain('"quoted"');
  });

  it('does not add data-latex to a non-math fence', () => {
    expect(latexAttrs(md.render('```js\nconst a = 1;\n```'))).toEqual([]);
  });
});

describe('the default document', () => {
  /*
   * Regression guard for a silent corruption: InitialText is a JS template
   * literal, so an un-doubled LaTeX backslash is destroyed before markdown-it
   * ever sees it. `\pi` becomes `pi`, and `\frac` becomes a literal form feed
   * because \f IS a valid escape. Nothing throws — the default document just
   * renders visibly wrong maths to every first-time user.
   */
  it('has intact LaTeX after template-literal escaping', async () => {
    const { initialText } =
      await import('@/App/Container/Hooks/InitialText.js');
    const section = initialText.slice(
      initialText.indexOf('## Math'),
      initialText.indexOf('## Tables'),
    );
    expect(section).toContain('\\pi');
    expect(section).toContain('\\int');
    expect(section).toContain('\\frac');
    expect(section).toContain('\\sqrt');
    expect(section).toContain('\\ce{H2O');
    // \f, \b, \v, \t, \n, \r are all valid JS escapes that would silently
    // replace a LaTeX command with a control character.
    expect(section).not.toMatch(/[\f\v\b]/);
  });

  it('renders its math without errors', async () => {
    const { initialText } =
      await import('@/App/Container/Hooks/InitialText.js');
    const html = md.render(initialText);
    expect(html).not.toContain('katex-error');
    expect((html.match(/class="katex"/g) ?? []).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(html).toContain('class="katex-display"');
  });
});
