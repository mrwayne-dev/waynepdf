import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/*
 * Reads real pixels and real text positions out of a PDF.
 *
 * Phase 6.5 exists because bugs shipped past a suite that only ever checked the
 * DOM. Margins and colours are properties of the printed artefact, so they get
 * asserted against the artefact: pdftoppm rasterises a page and the PPM is
 * sampled directly; pdftotext -bbox gives word positions in points.
 *
 * No image dependency. P6 is a four-token ASCII header followed by raw RGB
 * triples — but the header ends after EXACTLY one whitespace byte, and
 * consuming a byte too few rotates every channel by one. That mistake reads as
 * "the theme colours are wrong", which is precisely the bug being hunted, so
 * the parser below is deliberately literal about it.
 */
export function parsePPM(buf) {
  let pos = 0;
  const ws = (c) => c === 32 || c === 9 || c === 10 || c === 13;
  const token = () => {
    for (;;) {
      while (pos < buf.length && ws(buf[pos])) pos++;
      if (buf[pos] === 0x23) { while (pos < buf.length && buf[pos] !== 0x0a) pos++; continue; }
      break;
    }
    const s = pos;
    while (pos < buf.length && !ws(buf[pos])) pos++;
    return buf.slice(s, pos).toString();
  };
  token(); const w = +token(); const h = +token(); token();
  pos++; // exactly one whitespace byte terminates the header
  return { w, h, data: buf.subarray(pos) };
}

export function renderPage(buffer, dpi = 80, pageNo = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-'));
  const f = path.join(dir, 'p.pdf');
  fs.writeFileSync(f, buffer);
  execFileSync('pdftoppm', ['-r', String(dpi), '-f', String(pageNo), '-l', String(pageNo), f, path.join(dir, 'o')]);
  const name = fs.readdirSync(dir).find((n) => n.endsWith('.ppm'));
  const img = parsePPM(fs.readFileSync(path.join(dir, name)));
  fs.rmSync(dir, { recursive: true, force: true });
  return img;
}

export const px = (img, fx, fy) => {
  const x = Math.floor(img.w * fx), y = Math.floor(img.h * fy);
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

/** Most common colour in a region, and the one furthest from it (≈ text). */
export function analyse(img, x0, y0, x1, y1) {
  const counts = new Map();
  for (let y = Math.floor(img.h*y0); y < Math.floor(img.h*y1); y++)
    for (let x = Math.floor(img.w*x0); x < Math.floor(img.w*x1); x++) {
      const i = (y*img.w+x)*3;
      const k = (img.data[i]<<16)|(img.data[i+1]<<8)|img.data[i+2];
      counts.set(k, (counts.get(k)||0)+1);
    }
  const sorted = [...counts].sort((a,b)=>b[1]-a[1]);
  const bg = sorted[0][0];
  const unpack = (k) => [(k>>16)&255,(k>>8)&255,k&255];
  const b = unpack(bg);
  let far = bg, fd = -1;
  for (const [k, n] of sorted) {
    if (n < 12) continue;
    const c = unpack(k);
    const d = Math.abs(c[0]-b[0])+Math.abs(c[1]-b[1])+Math.abs(c[2]-b[2]);
    if (d > fd) { fd = d; far = k; }
  }
  return { bg: unpack(bg), ink: unpack(far), colours: sorted.length };
}

/** Word bounding boxes in PDF points, plus the page box. */
export function textBounds(buffer, pageNo = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-bb-'));
  const f = path.join(dir, 'p.pdf');
  fs.writeFileSync(f, buffer);
  const xml = execFileSync('pdftotext', ['-bbox', '-f', String(pageNo), '-l', String(pageNo), f, '-'], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const pm = xml.match(/<page width="([\d.]+)" height="([\d.]+)"/);
  const words = [...xml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/g)];
  if (!pm || !words.length) throw new Error('no text extracted from PDF');
  return {
    pageWidth: +pm[1],
    pageHeight: +pm[2],
    minX: Math.min(...words.map((w) => +w[1])),
    minY: Math.min(...words.map((w) => +w[2])),
    maxX: Math.max(...words.map((w) => +w[3])),
    maxY: Math.max(...words.map((w) => +w[4])),
  };
}

/** Millimetres to PDF points. */
export const mmToPt = (mm) => (mm * 72) / 25.4;

export const toHex = (rgb) =>
  '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
