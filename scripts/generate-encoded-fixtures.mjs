#!/usr/bin/env node
/**
 * Writes the binary encoding fixtures in tests/fixtures/encoded/.
 *
 * These are committed, so the encoding tests are reproducible without anyone
 * having to run this. Re-run it only when changing the fixture content:
 * `node scripts/generate-encoded-fixtures.mjs`.
 *
 * Deterministic — same content in, same bytes out.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/fixtures/encoded');

/**
 * The BOM fixtures reuse one ASCII body so the tests can assert on an exact
 * decoded string, and so the BOM is provably the only difference between them.
 */
const ASCII_BODY = '# Heading after BOM\n\nParagraph.\n';

const TC_BODY =
  '# 繁體中文\n\n這是一份用 Big5 編碼儲存的文件，用來測試編碼偵測。\n\n- 第一項\n- 第二項\n';
const SC_BODY =
  '# 简体中文\n\n这是一份用 GBK 编码保存的文件，用来测试编码检测。\n\n- 第一项\n- 第二项\n';
const JA_BODY =
  '# 日本語\n\nこれは Shift-JIS で保存された文書です。エンコーディング検出をテストします。\n\n- 一つ目\n- 二つ目\n';

const utf8 = (s) => Buffer.from(s, 'utf8');
const withBOM = (bom, body) => Buffer.concat([Buffer.from(bom), body]);

/** TextEncoder gives us UTF-8 only; UTF-16/32 are assembled by hand. */
function encodeUtf16(str, littleEndian) {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (littleEndian) buf.writeUInt16LE(code, i * 2);
    else buf.writeUInt16BE(code, i * 2);
  }
  return buf;
}

function encodeUtf32(str, littleEndian) {
  const points = [...str];
  const buf = Buffer.alloc(points.length * 4);
  points.forEach((ch, i) => {
    const cp = ch.codePointAt(0);
    if (littleEndian) buf.writeUInt32LE(cp, i * 4);
    else buf.writeUInt32BE(cp, i * 4);
  });
  return buf;
}

const FIXTURES = [
  ['utf8-bom.md', withBOM([0xef, 0xbb, 0xbf], utf8(ASCII_BODY))],
  ['utf16le-bom.md', withBOM([0xff, 0xfe], encodeUtf16(ASCII_BODY, true))],
  ['utf16be-bom.md', withBOM([0xfe, 0xff], encodeUtf16(ASCII_BODY, false))],
  [
    'utf32le-bom.md',
    withBOM([0xff, 0xfe, 0x00, 0x00], encodeUtf32(ASCII_BODY, true)),
  ],
  [
    'utf32be-bom.md',
    withBOM([0x00, 0x00, 0xfe, 0xff], encodeUtf32(ASCII_BODY, false)),
  ],
  ['big5.md', iconv.encode(TC_BODY, 'big5')],
  ['gbk.md', iconv.encode(SC_BODY, 'gbk')],
  ['shift-jis.md', iconv.encode(JA_BODY, 'shift_jis')],
  // Bytes that are valid UTF-8 nowhere and match no BOM. 0xC0/0xC1/0xF5+ are
  // never legal UTF-8 lead bytes. Leading ASCII keeps it from tripping the
  // UTF-16 BOM check. The detector must refuse to guess and the app must warn
  // rather than show mojibake silently.
  [
    'malformed.md',
    Buffer.concat([
      Buffer.from('# '),
      Buffer.from([0xc0, 0xc1, 0xf5, 0xfe, 0xff, 0x80, 0x81, 0x8f, 0x90]),
    ]),
  ],
];

await mkdir(OUT, { recursive: true });
for (const [name, buf] of FIXTURES) {
  await writeFile(path.join(OUT, name), buf);
  console.log(`  wrote tests/fixtures/encoded/${name} (${buf.length} bytes)`);
}
