import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { boot, setText } from './_helpers.js';

/*
 * DOCX export.
 *
 * Written in-house rather than via pandoc-wasm, which is 56 MB and
 * GPL-2.0-or-later against this project's MIT. A .docx is a zip of OOXML parts;
 * these assertions read the parts back rather than trusting that the download
 * happened.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/export-full.md'),
  'utf8',
);

/** Exports the fixture as DOCX and returns the saved file plus its unzipped parts. */
async function exportFixture(page) {
  await boot(page);
  await setText(page, FIXTURE);
  // The diagram must have rendered once in the preview, so the export's own
  // mermaid call resolves from the module-level promise rather than fetching.
  await expect(page.locator('.mermaid-diagram')).toHaveCount(1, {
    timeout: 30_000,
  });

  await page.locator('.wp-export-caret').click();
  await page.locator('.wp-export-item[data-format="docx"]').click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('.wp-export-main').click(),
  ]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-docx-'));
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);

  const buffer = fs.readFileSync(file);
  const zip = await JSZip.loadAsync(buffer);
  return { file, dir, buffer, zip };
}

const readText = (zip, entry) => zip.file(entry).async('string');

test.describe('the produced file is a valid package', () => {
  test('it is a zip with every part a reader requires', async ({ page }) => {
    const { dir, buffer, zip } = await exportFixture(page);
    try {
      // PK\x03\x04 — the local file header every zip opens with.
      expect([...buffer.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(buffer.length).toBeGreaterThan(5 * 1024);

      for (const entry of [
        '[Content_Types].xml',
        '_rels/.rels',
        'word/_rels/document.xml.rels',
        'word/document.xml',
        'word/styles.xml',
        'word/numbering.xml',
        'docProps/core.xml',
      ]) {
        expect(zip.file(entry), `${entry} missing`).toBeTruthy();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('every part is well-formed XML', async ({ page }) => {
    const { dir, zip } = await exportFixture(page);
    try {
      const xmlEntries = Object.keys(zip.files).filter(
        (n) => n.endsWith('.xml') || n.endsWith('.rels'),
      );
      expect(xmlEntries.length).toBeGreaterThan(0);

      const parts = [];
      for (const entry of xmlEntries) {
        parts.push([entry, await readText(zip, entry)]);
      }

      // Parsed in the page: the test runner is Node, which has no DOMParser,
      // and shipping an XML parser to check our own output would be circular.
      const errors = await page.evaluate(
        (input) =>
          input
            .map(([name, text]) => {
              const doc = new DOMParser().parseFromString(
                text,
                'application/xml',
              );
              const failure = doc.querySelector('parsererror');
              return failure ? `${name}: ${failure.textContent}` : null;
            })
            .filter(Boolean),
        parts,
      );
      expect(errors).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe('content survives the conversion', () => {
  test('headings, prose, tables and task items are all present', async ({
    page,
  }) => {
    const { dir, zip } = await exportFixture(page);
    try {
      const xml = await readText(zip, 'word/document.xml');
      const text = xml.replace(/<[^>]+>/g, '');

      expect(text).toContain('Export Test Document');
      expect(text).toContain('Text formatting');
      expect(text).toContain('Simplicity is prerequisite for reliability.');
      // Table cells.
      expect(text).toContain('Themes');
      expect(text).toContain('Ready');
      // Task items, with the glyphs that stand in for real checkboxes.
      expect(text).toContain('Task done');
      expect(text).toContain('Task pending');
      expect(text).toContain('☒');
      expect(text).toContain('☐');
      // Callouts as labelled quotes.
      expect(text).toContain('[NOTE]');
      expect(text).toContain('[WARNING]');
      // Code survives as text.
      expect(text).toContain('function greet(name)');
      /*
       * Reserved characters, round-tripped. Without this the well-formedness
       * invariant had nothing to bite on: removing xmlEscape from run text was
       * the one sabotage the suite did not catch, because the fixture happened
       * to contain no angle brackets or ampersands outside code.
       */
      expect(text).toContain('5 &lt; 10 &amp; 10 &gt; 5');
      expect(text).toContain('&quot;quoted&quot;');

      // The frontmatter block is metadata, not a paragraph. 6d.1's HTML export
      // shipped this bug; the DOCX writer inherited the same mistake.
      expect(text).not.toContain('author: WaynePDF');
      expect(text).not.toContain('date: 2026-08-20');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('math arrives as literal source, exactly as documented', async ({
    page,
  }) => {
    // A documented limitation, pinned so it degrades the way the README says
    // rather than silently vanishing.
    const { dir, zip } = await exportFixture(page);
    try {
      const text = (await readText(zip, 'word/document.xml')).replace(
        /<[^>]+>/g,
        '',
      );
      expect(text).toContain('\\ce{H2O');
      expect(text).toContain('\\int_0^1');
      expect(text).toContain('$');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('structural elements are emitted, not flattened to prose', async ({
    page,
  }) => {
    const { dir, zip } = await exportFixture(page);
    try {
      const xml = await readText(zip, 'word/document.xml');
      expect(xml).toContain('<w:tbl>');
      expect(xml).toContain('<w:numPr>');
      expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
      expect(xml).toContain('<w:pStyle w:val="Quote"/>');
      expect(xml).toContain('<w:pStyle w:val="Code"/>');
      expect(xml).toContain('<w:drawing>');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test('the diagram is embedded as a real PNG', async ({ page }) => {
  const { dir, zip } = await exportFixture(page);
  try {
    // Directory entries are keys too; only the files count.
    const media = Object.keys(zip.files).filter(
      (n) => n.startsWith('word/media/') && !zip.files[n].dir,
    );
    expect(media.length).toBeGreaterThan(0);

    const bytes = await zip.file(media[0]).async('uint8array');
    expect([...bytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // Not a 1x1 placeholder — a rendered diagram.
    expect(bytes.length).toBeGreaterThan(1000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('metadata carries the frontmatter', async ({ page }) => {
  const { dir, zip } = await exportFixture(page);
  try {
    const core = await readText(zip, 'docProps/core.xml');
    expect(core).toContain('<dc:title>Export Test Document</dc:title>');
    expect(core).toContain('<dc:creator>WaynePDF</dc:creator>');
    expect(core).toContain('2026-08-20T00:00:00Z');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every relationship the document uses is declared', async ({ page }) => {
  /*
   * The quietest possible failure: a document referencing an undeclared id still
   * opens, and the picture or link is simply not there.
   */
  const { dir, zip } = await exportFixture(page);
  try {
    const documentXml = await readText(zip, 'word/document.xml');
    const relsXml = await readText(zip, 'word/_rels/document.xml.rels');

    const used = new Set(
      [...documentXml.matchAll(/r:(?:id|embed)="([^"]+)"/g)].map((m) => m[1]),
    );
    const declared = new Set(
      [...relsXml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      expect(declared.has(id), `${id} used but never declared`).toBe(true);
    }

    for (const [, target] of relsXml.matchAll(/Target="(media\/[^"]+)"/g)) {
      expect(zip.file(`word/${target}`), `${target} missing`).toBeTruthy();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the package references nothing outside itself', async ({ page }) => {
  const { dir, zip } = await exportFixture(page);
  try {
    for (const entry of Object.keys(zip.files)) {
      if (!entry.endsWith('.xml')) continue;
      const text = await readText(zip, entry);
      // Namespace declarations are URLs but not fetches; a src/Target is.
      const fetched = [
        ...text.matchAll(/(?:src|Target)="(https?:[^"]+)"/g),
      ].map((m) => m[1]);
      expect(fetched, `${entry} points outside the package`).toEqual([]);
    }
    // Hyperlink targets are the deliberate exception and live in the rels part
    // as TargetMode="External" — the document's own content embeds everything.
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('LibreOffice opens it and converts it to PDF', async ({ page }) => {
  /*
   * The end-to-end proof. Every assertion above reads bytes this code also
   * wrote; only a real consumer can say whether the package is actually valid.
   * LibreOffice fails loudly on a malformed one.
   */
  let available = true;
  try {
    execFileSync('soffice', ['--version'], {
      stdio: 'ignore',
      timeout: 60_000,
    });
  } catch {
    available = false;
  }
  test.skip(!available, 'LibreOffice is not installed');

  const { file, dir } = await exportFixture(page);
  try {
    execFileSync(
      'soffice',
      ['--headless', '--convert-to', 'pdf', '--outdir', dir, file],
      { stdio: 'pipe', timeout: 180_000 },
    );
    const pdf = file.replace(/\.docx$/, '.pdf');
    expect(fs.existsSync(pdf), 'LibreOffice produced no PDF').toBe(true);
    const bytes = fs.readFileSync(pdf);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10 * 1024);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
