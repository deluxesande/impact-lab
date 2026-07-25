/**
 * Client-side image downscaling.
 *
 * Why this exists: `POST /api/upload` is a Phase 1 mock that validates the file,
 * **discards it**, and returns an object key resolving to nothing. So a photo the
 * farmer uploads can never be fetched back — the demo's "upload tomatoes photo"
 * beat would end in a placeholder.
 *
 * For the demo we therefore also keep the image client-side as a downscaled data
 * URL and store that on the listing, so the photo the farmer just took appears on
 * the consumer grid. That is only viable because the store is in-memory on
 * localhost (§5.2); a data URL is the wrong way to persist an image anywhere real.
 *
 * We still POST to `/api/upload` so the flow exercises the teammate's real
 * endpoint and its validation. When MinIO lands in Phase 2.5, delete this file
 * and use the returned `objectKey` with a presigned URL.
 */

/** Longest edge of the stored image, in px. Enough for a card at 2× density. */
const MAX_EDGE = 640;
const QUALITY = 0.7;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches /api/upload

export type ImageError = "type" | "size" | "decode";

/**
 * Downscale a File to a JPEG data URL, preserving aspect ratio.
 *
 * Always re-encodes as JPEG regardless of input: a 4 MB PNG from a phone becomes
 * a ~40 KB JPEG, which matters because this string ends up inline in the HTML of
 * every page that renders the card.
 */
export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("type");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("size");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("decode");
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("decode");
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Free the decoded bitmap promptly — phone photos are large.
  bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}

/**
 * Send the original file to the real upload endpoint. Returns the mock
 * `objectKey`, or null if the endpoint failed — a failure here must not block
 * publishing, since the key is unusable either way in Phase 1.
 */
export async function uploadProduceImage(
  file: File,
  sessionId: string,
): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("sessionId", sessionId);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) return null;

    const data = (await res.json()) as { objectKey?: string };
    return data.objectKey ?? null;
  } catch {
    return null;
  }
}
