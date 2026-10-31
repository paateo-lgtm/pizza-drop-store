import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { detectImageType } from "./image-type";

const MAX_BYTES = 3 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * Speichert ein Pizzabild. Mit BLOB_READ_WRITE_TOKEN in Vercel Blob,
 * sonst (nur lokale Entwicklung) unter public/uploads.
 */
export async function savePizzaImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new UploadError("Das Bild darf höchstens 3 MB groß sein.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Den Typ aus dem Dateiinhalt bestimmen, nicht aus der Angabe des Browsers.
  const type = detectImageType(bytes);
  if (!type) {
    throw new UploadError("Bitte JPG, PNG, WebP oder AVIF hochladen.");
  }

  const name = `pizzas/${randomUUID()}.${type.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, Buffer.from(bytes), {
      access: "public",
      contentType: type.mime,
    });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new UploadError(
      "Bild-Upload ist nicht eingerichtet (Vercel Blob fehlt).",
    );
  }

  await mkdir(path.join(process.cwd(), "public", "uploads", "pizzas"), {
    recursive: true,
  });
  await writeFile(path.join(process.cwd(), "public", "uploads", name), bytes);
  return `/uploads/${name}`;
}
