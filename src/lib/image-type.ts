export type ImageType = { mime: string; ext: string };

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** Erkennt JPG, PNG, WebP und AVIF anhand der ersten Bytes (Magic Numbers). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") {
    return { mime: "image/png", ext: "png" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (ascii(bytes, 4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(bytes, 8, 12))) {
    return { mime: "image/avif", ext: "avif" };
  }
  return null;
}
