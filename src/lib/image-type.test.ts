import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
    ),
  );
const pad = Array(16).fill(0);

describe("detectImageType", () => {
  it("erkennt die erlaubten Formate", () => {
    expect(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0], pad))?.ext).toBe(
      "jpg",
    );
    expect(detectImageType(bytes("\x89PNG\r\n\x1a\n", pad))?.ext).toBe("png");
    expect(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEBP", pad))?.ext).toBe(
      "webp",
    );
    expect(detectImageType(bytes([0, 0, 0, 28], "ftypavif", pad))?.ext).toBe(
      "avif",
    );
  });

  it("lehnt alles andere ab, auch als Bild getarnte Dateien", () => {
    expect(detectImageType(bytes("<svg xmlns=", pad))).toBeNull();
    expect(detectImageType(bytes("<!DOCTYPE html>", pad))).toBeNull();
    expect(detectImageType(bytes("GIF89a", pad))).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8]))).toBeNull();
  });
});
