export const initialText = `# WaynePDF

Write Markdown. Get a beautiful PDF. Nothing leaves your browser.

## Getting started

Drop a \`.md\` file onto this window, or start typing on the left. When you're ready, click **Transform** in the top-right and choose **Save as PDF** in your browser's print dialog.

One setting in that dialog makes the output cleaner:

- Uncheck **Headers and Footers** so the browser doesn't stamp URLs and page numbers over your document.

Backgrounds for code blocks and blockquotes print automatically — no need to hunt for the "Background graphics" checkbox.

## The basics

**Bold**, *italic*, ~~strikethrough~~, \`inline code\`, and [links](https://example.com) all work. Unicode too — CJK, Arabic, Hebrew, and emoji render correctly. Encoding is detected automatically for common non-UTF-8 files.

## Lists

- Bulleted items
- Nested if you need them
  - Two levels
  - Three, four, however many

1. Ordered lists
2. Also work
3. Exactly as you'd expect

## Quotes

> Simplicity is the ultimate sophistication.

## Code

Fenced blocks with syntax highlighting for most languages:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}\`;
}
\`\`\`

\`\`\`python
def greet(name):
    return f"Hello, {name}"
\`\`\`

## Math

Inline math with single dollars: $e^{i\\pi} + 1 = 0$.

Display math with double dollars:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

Fenced math blocks:

\`\`\`math
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}
\`\`\`

Chemistry via mhchem: $\\ce{H2O + Fe -> Fe2O3}$.

Currency works as expected — "$5.99" and "he owes $10" don't trigger math, because a digit straight after a \`$\` stops it closing a math span.

## Tables

| Feature                    | Status       |
| -------------------------- | ------------ |
| Headings, lists, quotes    | Ready        |
| Tables and fenced code     | Ready        |
| Unicode and emoji          | Ready        |
| Themes and fonts           | Ready        |
| Unicode and encodings      | Ready        |
| LaTeX math                 | Ready        |
| Mermaid diagrams           | Coming soon  |
| Page layout                | Ready        |

## Page layout

Switch to **Paged** mode in the top toolbar to see real page breaks, running headers and footers, and page numbers exactly as they'll print. Configure page size, margins, cover page, table of contents, and watermarks in Settings under **Layout**.

## Raw HTML

Standard HTML passes through if you need it. GitHub-flavored Markdown extensions — tables, strikethrough, fenced code — all render.

---

Delete this document and write your own.
`;
