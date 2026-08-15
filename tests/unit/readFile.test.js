import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectBOM,
  detectEncoding,
  readFileWithEncoding,
  encodingMessage,
  encodingLabel,
} from '../../src/App/Lib/readFile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENCODED_DIR = path.resolve(__dirname, '../fixtures/encoded');

const bytesOf = (name) =>
  new Uint8Array(fs.readFileSync(path.join(ENCODED_DIR, name)));

/**
 * jsdom's File does not implement arrayBuffer() the way we need, so build a
 * minimal stand-in. readFileWithEncoding only ever calls arrayBuffer().
 */
const fakeFile = (bytes) => ({
  name: 'test.md',
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

const ASCII_BODY = '# Heading after BOM\n\nParagraph.\n';

describe('detectBOM', () => {
  it.each([
    ['utf8-bom.md', 'utf-8', 3],
    ['utf16le-bom.md', 'utf-16le', 2],
    ['utf16be-bom.md', 'utf-16be', 2],
    ['utf32le-bom.md', 'utf-32le', 4],
    ['utf32be-bom.md', 'utf-32be', 4],
  ])('recognises the BOM in %s', (file, encoding, skipBytes) => {
    const bom = detectBOM(bytesOf(file));
    expect(bom).toMatchObject({ encoding, skipBytes });
  });

  it('returns null when there is no BOM', () => {
    expect(detectBOM(bytesOf('big5.md'))).toBeNull();
  });

  it('prefers the longer BOM: FF FE 00 00 is UTF-32 LE, not UTF-16 LE', () => {
    // The UTF-16 LE BOM is a prefix of the UTF-32 LE BOM, so order matters.
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x00, 0x41]);
    expect(detectBOM(bytes)).toMatchObject({ encoding: 'utf-32le' });
  });

  it('does not read past the end of a short buffer', () => {
    expect(detectBOM(new Uint8Array([0xff]))).toBeNull();
    expect(detectBOM(new Uint8Array([]))).toBeNull();
  });
});

describe('detectEncoding', () => {
  it.each([
    ['utf8-bom.md', 'utf-8', true],
    ['utf16le-bom.md', 'utf-16le', true],
    ['utf16be-bom.md', 'utf-16be', true],
    ['utf32le-bom.md', 'utf-32le', true],
    ['utf32be-bom.md', 'utf-32be', true],
  ])('%s -> %s via BOM', (file, encoding, wasBOM) => {
    expect(detectEncoding(bytesOf(file))).toMatchObject({
      encoding,
      wasBOM,
      fallback: false,
    });
  });

  it.each([
    ['big5.md', 'big5'],
    ['gbk.md', 'gb18030'],
    ['shift-jis.md', 'shift-jis'],
  ])('%s -> %s via content sniffing', (file, encoding) => {
    expect(detectEncoding(bytesOf(file))).toMatchObject({
      encoding,
      wasBOM: false,
      fallback: false,
    });
  });

  it('treats BOM-less valid UTF-8 as UTF-8 without guessing', () => {
    const bytes = new TextEncoder().encode(
      '# Título\n\nCafé, naïve, 日本語.\n',
    );
    expect(detectEncoding(bytes)).toMatchObject({
      encoding: 'utf-8',
      wasBOM: false,
      fallback: false,
    });
  });

  it('treats an empty file as UTF-8 rather than warning', () => {
    expect(detectEncoding(new Uint8Array([]))).toMatchObject({
      encoding: 'utf-8',
      fallback: false,
    });
  });

  it('flags undetectable bytes as a fallback instead of guessing', () => {
    expect(detectEncoding(bytesOf('malformed.md'))).toMatchObject({
      encoding: 'utf-8',
      fallback: true,
    });
  });

  it('refuses a guess outside the supported set', () => {
    // A 12-byte GBK sample is what makes jschardet reach for IBM855 (DOS
    // Cyrillic) at 0.51 confidence. IBM855 is not a supported target, so the
    // guess must be rejected rather than producing confident mojibake.
    const shortGbk = new Uint8Array([
      0xbc, 0xf2, 0xcc, 0xe5, 0xd6, 0xd0, 0xce, 0xc4, 0xb2, 0xe2, 0xca, 0xd4,
    ]);
    expect(detectEncoding(shortGbk).fallback).toBe(true);
  });
});

describe('readFileWithEncoding', () => {
  it.each(['utf8-bom.md', 'utf16le-bom.md', 'utf16be-bom.md'])(
    'decodes %s to the same text',
    async (file) => {
      const result = await readFileWithEncoding(fakeFile(bytesOf(file)));
      expect(result.text).toBe(ASCII_BODY);
      expect(result.wasBOM).toBe(true);
    },
  );

  it.each([
    'utf8-bom.md',
    'utf16le-bom.md',
    'utf16be-bom.md',
    'utf32le-bom.md',
    'utf32be-bom.md',
  ])('strips the BOM from %s so markdown-it sees a bare #', async (file) => {
    const { text } = await readFileWithEncoding(fakeFile(bytesOf(file)));
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text.startsWith('# ')).toBe(true);
  });

  it.each([['utf32le-bom.md'], ['utf32be-bom.md']])(
    'hand-decodes %s, which TextDecoder cannot',
    async (file) => {
      const { text } = await readFileWithEncoding(fakeFile(bytesOf(file)));
      expect(text).toBe(ASCII_BODY);
    },
  );

  it('decodes Big5 to the correct Traditional Chinese', async () => {
    const { text, encoding } = await readFileWithEncoding(
      fakeFile(bytesOf('big5.md')),
    );
    expect(encoding).toBe('big5');
    expect(text).toContain('繁體中文');
    expect(text).toContain('第一項');
    expect(text).not.toContain('�');
  });

  it('decodes GBK to the correct Simplified Chinese', async () => {
    const { text, encoding } = await readFileWithEncoding(
      fakeFile(bytesOf('gbk.md')),
    );
    expect(encoding).toBe('gb18030');
    expect(text).toContain('简体中文');
    expect(text).toContain('第一项');
    expect(text).not.toContain('�');
  });

  it('decodes Shift-JIS to the correct Japanese', async () => {
    const { text, encoding } = await readFileWithEncoding(
      fakeFile(bytesOf('shift-jis.md')),
    );
    expect(encoding).toBe('shift-jis');
    expect(text).toContain('日本語');
    expect(text).toContain('一つ目');
    expect(text).not.toContain('�');
  });

  it('passes plain UTF-8 through unchanged', async () => {
    const source = '# Basic\n\nJust ASCII here.\n';
    const bytes = new TextEncoder().encode(source);
    const result = await readFileWithEncoding(fakeFile(bytes));
    expect(result).toMatchObject({
      text: source,
      encoding: 'utf-8',
      wasBOM: false,
      fallback: false,
    });
  });

  it('falls back with a flag rather than throwing on malformed bytes', async () => {
    const result = await readFileWithEncoding(
      fakeFile(bytesOf('malformed.md')),
    );
    expect(result.fallback).toBe(true);
    expect(result.encoding).toBe('utf-8');
    // Non-fatal decode: the user sees something, flagged as suspect.
    expect(typeof result.text).toBe('string');
  });

  it('reports a read error instead of throwing', async () => {
    const broken = {
      name: 'x.md',
      arrayBuffer: async () => {
        throw new Error('NotReadableError');
      },
    };
    const result = await readFileWithEncoding(broken);
    expect(result.error).toBe('NotReadableError');
    expect(result.text).toBe('');
  });

  it('handles a single-byte file', async () => {
    const result = await readFileWithEncoding(fakeFile(new Uint8Array([0x23])));
    expect(result.text).toBe('#');
    expect(result.fallback).toBe(false);
  });

  it('handles an empty file', async () => {
    const result = await readFileWithEncoding(fakeFile(new Uint8Array([])));
    expect(result.text).toBe('');
    expect(result.fallback).toBe(false);
  });
});

describe('encodingMessage', () => {
  it('says nothing for plain UTF-8 — the expected case is not news', () => {
    expect(encodingMessage({ encoding: 'utf-8', fallback: false })).toBeNull();
  });

  it('reports a detected non-UTF-8 encoding as info', () => {
    expect(encodingMessage({ encoding: 'big5', fallback: false })).toEqual({
      variant: 'info',
      message: 'Loaded as Big5 (auto-detected).',
    });
  });

  it('warns when detection failed', () => {
    const result = encodingMessage({ encoding: 'utf-8', fallback: true });
    expect(result.variant).toBe('warning');
    expect(result.message).toContain('could not be detected');
  });

  it('warns when the file could not be read at all', () => {
    const result = encodingMessage({ encoding: 'utf-8', error: 'boom' });
    expect(result.variant).toBe('warning');
    expect(result.message).toContain('boom');
  });
});

describe('encodingLabel', () => {
  it('maps known encodings to display names', () => {
    expect(encodingLabel('shift-jis')).toBe('Shift-JIS');
    expect(encodingLabel('gb18030')).toBe('GB18030');
  });

  it('passes an unknown label through rather than showing undefined', () => {
    expect(encodingLabel('koi8-r')).toBe('koi8-r');
  });
});
