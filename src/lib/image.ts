/**
 * Produce image upload.
 *
 * `POST /api/upload` now stores the file in a private MinIO bucket and returns a
 * real, retrievable `objectKey`. That key goes on the listing, and the read path
 * mints a short-lived presigned GET URL for it via the backend's
 * `presentListings()`.
 *
 * **Removed at integration:** this module previously also downscaled the file to a
 * JPEG data URL and stored *that* on the listing, because the Phase 1 upload
 * endpoint validated the file and then discarded it — so nothing uploaded could
 * ever be displayed. With real storage that workaround is obsolete, along with
 * the 400 KB guard in `createListingAction` that kept those data URLs from
 * bloating every page's HTML.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches /api/upload

/**
 * Upload a produce photo and return its MinIO object key, or null on failure.
 *
 * Returns null rather than throwing: a failed photo upload must never block
 * publishing a listing, since the produce and price are what actually matter.
 */
export async function uploadProduceImage(
  file: File,
  sessionId: string,
): Promise<string | null> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return null;
  if (file.size > MAX_UPLOAD_BYTES) return null;

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
