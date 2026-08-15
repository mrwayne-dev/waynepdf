import jschardet from 'jschardet';

/*
 * File reading with encoding detection.
 *
 * The single text-reading path in the app. FileReader's text mode assumes UTF-8
 * and gives no error when it is wrong, which turned every Big5 or Shift-JIS
 * document into silent mojibake (Phase 0 backlog §5.6). Here we read bytes,
 * decide the encoding deliberately, and tell the user what we decided.
 */

/** BOMs, longest first — FF FE 00 00 must be tested before FF FE. */
const BOMS = [
  { bytes: [0xff, 0xfe, 0x00, 0x00], encoding: 'utf-32le', skipBytes: 4 },
  { bytes: [0x00, 0x00, 0xfe, 0xff], encoding: 'utf-32be', skipBytes: 4 },
  { bytes: [0xef, 0xbb, 0xbf], encoding: 'utf-8', skipBytes: 3 },
  { bytes: [0xff, 0xfe], encoding: 'utf-16le', skipBytes: 2 },
  { bytes: [0xfe, 0xff], encoding: 'utf-16be', skipBytes: 2 },
];

/**
 * jschardet label -> TextDecoder label, and simultaneously the whitelist of
 * encodings we are willing to act on.
 *
 * The whitelist matters. jschardet is confident and accurate on
 * document-length input, but on very short samples it reaches for obscure
 * single-byte codepages: a 12-byte GBK file comes back as IBM855 (DOS
 * Cyrillic) at 0.51 confidence, over the acceptance threshold. Anything not
 * listed here is treated as "no usable guess", which degrades to a warned
 * UTF-8 fallback instead of confident mojibake.
 */
const JSCHARDET_TO_TEXTDECODER = {
  'UTF-8': 'utf-8',
  ASCII: 'utf-8',
  'UTF-16LE': 'utf-16le',
  'UTF-16BE': 'utf-16be',
  Big5: 'big5',
  GB2312: 'gb18030', // superset; decodes GB2312 and GBK correctly
  GB18030: 'gb18030',
  GBK: 'gb18030',
  SHIFT_JIS: 'shift-jis',
  'EUC-JP': 'euc-jp',
  'EUC-KR': 'euc-kr',
  'EUC-TW': 'big5',
  // Not in the brief's list, but TextDecoder handles them and the alternative
  // is mojibake on any Latin-1 document with an accented character.
  'windows-1252': 'windows-1252',
  'ISO-8859-1': 'windows-1252',
};

/** Human-facing names for the banner. */
export const ENCODING_LABELS = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'utf-32le': 'UTF-32 LE',
  'utf-32be': 'UTF-32 BE',
  big5: 'Big5',
  gb18030: 'GB18030',
  'shift-jis': 'Shift-JIS',
  'euc-jp': 'EUC-JP',
  'euc-kr': 'EUC-KR',
  'windows-1252': 'Windows-1252',
};

export const encodingLabel = (encoding) =>
  ENCODING_LABELS[encoding] ?? encoding;

/** Minimum confidence before we act on a jschardet guess. */
const MIN_CONFIDENCE = 0.5;

export function detectBOM(bytes) {
  for (const bom of BOMS) {
    if (bytes.length < bom.bytes.length) continue;
    if (bom.bytes.every((b, i) => bytes[i] === b)) return bom;
  }
  return null;
}

/**
 * TextDecoder has no UTF-32 support, so decode it by hand. Rare enough that a
 * straightforward loop beats pulling in a dependency.
 */
function decodeUtf32(bytes, littleEndian) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let i = 0; i + 3 < bytes.byteLength; i += 4) {
    const cp = view.getUint32(i, littleEndian);
    // Lone surrogates and out-of-range values are not valid scalar values.
    out.push(cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? 0xfffd : cp);
  }
  return String.fromCodePoint(...out);
}

function decodeWith(bytes, encoding, { fatal = false } = {}) {
  if (encoding === 'utf-32le') return decodeUtf32(bytes, true);
  if (encoding === 'utf-32be') return decodeUtf32(bytes, false);
  return new TextDecoder(encoding, { fatal }).decode(bytes);
}

/** jschardet has no Buffer in the browser; it accepts a binary string. */
function toBinaryString(bytes) {
  let s = '';
  const CHUNK = 0x8000; // avoid blowing the argument limit on large files
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}

/**
 * Decides how to decode `bytes`.
 *
 * Order matters: a BOM is authoritative and costs three byte comparisons, so
 * it wins outright. Absent one, a strict UTF-8 decode is the cheapest reliable
 * test — UTF-8 is self-validating, so if it parses, it is almost certainly
 * UTF-8. Only then do we guess.
 *
 * Returns { encoding, skipBytes, wasBOM, fallback }.
 */
export function detectEncoding(bytes) {
  const bom = detectBOM(bytes);
  if (bom) {
    return {
      encoding: bom.encoding,
      skipBytes: bom.skipBytes,
      wasBOM: true,
      fallback: false,
    };
  }

  // An empty file is vacuously valid UTF-8; say so rather than warning.
  if (bytes.length === 0) {
    return { encoding: 'utf-8', skipBytes: 0, wasBOM: false, fallback: false };
  }

  try {
    decodeWith(bytes, 'utf-8', { fatal: true });
    return { encoding: 'utf-8', skipBytes: 0, wasBOM: false, fallback: false };
  } catch {
    /* not valid UTF-8; fall through to guessing */
  }

  let guess = null;
  try {
    guess = jschardet.detect(toBinaryString(bytes));
  } catch {
    /* detector threw; treat as no guess */
  }

  const mapped = guess && JSCHARDET_TO_TEXTDECODER[guess.encoding];
  if (mapped && guess.confidence >= MIN_CONFIDENCE) {
    return {
      encoding: mapped,
      skipBytes: 0,
      wasBOM: false,
      fallback: false,
    };
  }

  // Nothing trustworthy. Decode non-fatally so the user sees *something*, and
  // flag it so the banner can warn rather than lie.
  return { encoding: 'utf-8', skipBytes: 0, wasBOM: false, fallback: true };
}

/**
 * Reads a File and returns decoded text plus what we decided about it.
 *
 * `text` never begins with U+FEFF: a BOM is consumed as a byte-order mark by
 * the skipBytes offset, and any further stray one (UTF-16 content that starts
 * with a second BOM, for example) is trimmed after decoding. Leaving it in is
 * what demoted a BOM-prefixed `# Heading` to a paragraph.
 */
export async function readFileWithEncoding(file) {
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    return {
      text: '',
      encoding: 'utf-8',
      wasBOM: false,
      fallback: true,
      error: error?.message ?? 'File could not be read',
    };
  }

  const bytes = new Uint8Array(buffer);
  const { encoding, skipBytes, wasBOM, fallback } = detectEncoding(bytes);

  let text;
  try {
    text = decodeWith(bytes.subarray(skipBytes), encoding);
  } catch (error) {
    return {
      text: '',
      encoding,
      wasBOM,
      fallback: true,
      error: error?.message ?? 'File could not be decoded',
    };
  }

  // A decoded UTF-16/32 stream can still carry a leading U+FEFF even after the
  // byte-level BOM was skipped, and markdown-it treats it as ordinary text.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  return { text, encoding, wasBOM, fallback };
}

/** The message the banner shows for a given read result. */
export function encodingMessage({ encoding, fallback, error }) {
  if (error) {
    return { variant: 'warning', message: `Could not read file: ${error}` };
  }
  if (fallback) {
    return {
      variant: 'warning',
      message:
        'Warning: encoding could not be detected; loaded as UTF-8. Text may be corrupted.',
    };
  }
  if (encoding === 'utf-8') return null; // the expected case needs no banner
  return {
    variant: 'info',
    message: `Loaded as ${encodingLabel(encoding)} (auto-detected).`,
  };
}
