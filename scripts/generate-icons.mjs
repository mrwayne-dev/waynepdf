#!/usr/bin/env node
/**
 * Rasterizes the master mark (public/favicon.svg) into every icon size the app
 * ships, plus the social share image.
 *
 * Idempotent by construction: every output is derived from committed sources
 * with fixed sharp options, so re-running reproduces the committed bytes.
 * To change the mark, edit public/favicon.svg and run `pnpm gen:icons`.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ICONS = path.join(PUBLIC, 'icons');
const MASTER = path.join(PUBLIC, 'favicon.svg');

const BLACK = '#000000';

// sharp's PNG encoder is deterministic for a given option set; pinning the
// options here is what makes the committed PNGs reproducible.
const PNG = { compressionLevel: 9, effort: 10, palette: false };

/** Rasterize an SVG buffer to a square PNG at `size`. */
const render = (svg, size) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: BLACK })
    .png(PNG)
    .toBuffer();

/**
 * The maskable variant must survive an aggressive circular crop, so the mark is
 * scaled into the center 80% safe zone and the remainder is flat black bleed.
 */
async function renderMaskable(svg, size) {
  const safe = Math.round(size * 0.8);
  const inner = await render(svg, safe);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BLACK,
    },
  })
    .composite([{ input: inner, gravity: 'centre' }])
    .png(PNG)
    .toBuffer();
}

/**
 * 1200x630 share card. Text is left to the renderer's generic sans-serif —
 * Phase 2 replaces this with the bundled Inter, at which point the family here
 * should be pinned to it.
 */
function ogSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BLACK}"/>
  <text x="600" y="312" fill="#ffffff" font-family="sans-serif" font-size="120" font-weight="700" text-anchor="middle">WaynePDF</text>
  <text x="600" y="392" fill="#b4b4b4" font-family="sans-serif" font-size="40" font-weight="400" text-anchor="middle">Write Markdown. Get a beautiful PDF.</text>
</svg>
`);
}

/**
 * Wraps raw 32-bit BGRA pixels in a single-image ICO.
 *
 * png-to-ico would emit a seven-size 285KB file; the only job this icon has is
 * to be the fallback for browsers that ignore `<link rel="icon" type="svg+xml">`,
 * so one 32x32 entry is enough. BMP payload rather than PNG-in-ICO because
 * that is what the old browsers in question actually understand.
 */
function icoFromBgra(bgra, size) {
  const xor = size * size * 4;
  // 1bpp AND mask, rows padded to 4 bytes. Left all-zero: the alpha channel in
  // the XOR data carries transparency, and the mark is opaque regardless.
  const andMask = size * 4;
  const dib = 40 + xor + andMask;

  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // palette size (0 = truecolor)
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(dib, 14); // payload size
  header.writeUInt32LE(22, 18); // payload offset

  const info = Buffer.alloc(40);
  info.writeUInt32LE(40, 0); // biSize
  info.writeInt32LE(size, 4); // biWidth
  info.writeInt32LE(size * 2, 8); // biHeight: XOR + AND stacked
  info.writeUInt16LE(1, 12); // biPlanes
  info.writeUInt16LE(32, 14); // biBitCount
  info.writeUInt32LE(0, 16); // BI_RGB

  // ICO scanlines run bottom-up.
  const rows = Buffer.alloc(xor);
  const stride = size * 4;
  for (let y = 0; y < size; y++) {
    bgra.copy(rows, y * stride, (size - 1 - y) * stride, (size - y) * stride);
  }

  return Buffer.concat([header, info, rows, Buffer.alloc(andMask)]);
}

async function main() {
  const master = await readFile(MASTER);

  // Old upstream icons had mislabeled sizes; drop the whole directory so a
  // rename in the list below can never leave a stale file behind.
  await rm(ICONS, { recursive: true, force: true });
  await mkdir(ICONS, { recursive: true });

  const targets = [
    ['icons/icon-192.png', () => render(master, 192)],
    ['icons/icon-512.png', () => render(master, 512)],
    ['icons/icon-maskable-512.png', () => renderMaskable(master, 512)],
    ['icons/apple-touch-icon.png', () => render(master, 180)],
    ['og-image.png', () => sharp(ogSvg()).png(PNG).toBuffer()],
  ];

  for (const [rel, make] of targets) {
    await writeFile(path.join(PUBLIC, rel), await make());
    console.log(`  wrote public/${rel}`);
  }

  // 32x32 fallback ICO for browsers that ignore the SVG favicon.
  const bgra = await sharp(master, { density: 384 })
    .resize(32, 32, { fit: 'contain', background: BLACK })
    .ensureAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer()
    // sharp emits RGBA; ICO's BMP payload wants BGRA.
    .then((rgba) => {
      for (let i = 0; i < rgba.length; i += 4) {
        const r = rgba[i];
        rgba[i] = rgba[i + 2];
        rgba[i + 2] = r;
      }
      return rgba;
    });
  await writeFile(path.join(PUBLIC, 'favicon.ico'), icoFromBgra(bgra, 32));
  console.log('  wrote public/favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
