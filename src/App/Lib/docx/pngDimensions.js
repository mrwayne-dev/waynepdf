/*
 * PNG pixel size, straight from the header.
 *
 * A PNG opens with an 8-byte signature and then the IHDR chunk: 4 bytes length,
 * 4 bytes type, then width and height as big-endian uint32. That is all the
 * export needs to size an image, so there is no reason to decode the pixels or
 * to add an image library for it.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decodes the base64 payload of a data URI into bytes. */
export function dataUriToBytes(dataUri) {
  const comma = String(dataUri ?? '').indexOf(',');
  if (comma === -1) throw new Error('Not a data URI');
  const binary = atob(dataUri.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const readUint32 = (bytes, offset) =>
  ((bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>>
  0;

/**
 * @throws if the bytes are not a PNG. Guessing a size for a non-PNG would put a
 * corrupt part in the package, which fails later and further from the cause.
 */
export function pngDimensionsFromBytes(bytes) {
  if (bytes.length < 24) throw new Error('Truncated PNG');
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) throw new Error('Not a PNG');
  }
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (width === 0 || height === 0) throw new Error('PNG has no dimensions');
  return { width, height };
}

export function pngDimensions(dataUri) {
  return pngDimensionsFromBytes(dataUriToBytes(dataUri));
}
