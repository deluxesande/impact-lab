import { presignMany } from "@/lib/storage/minio";
import type { ListingRecord } from "@/lib/db/repo";
import type { Listing } from "@/lib/ai/types";

/**
 * Turn stored listing records into API listings, swapping private MinIO object
 * keys for short-lived presigned GET URLs. Shared by the farmer and consumer
 * listing endpoints so presigning is done identically in both.
 *
 * A key that fails to presign (e.g. object removed) simply yields no imageUrl;
 * the presignMany layer rethrows genuine storage failures.
 */
export async function presentListings(records: ListingRecord[]): Promise<Listing[]> {
  const keys = records
    .map((r) => r.imageKey)
    .filter((k): k is string => Boolean(k));
  const urls = keys.length > 0 ? await presignMany(keys) : new Map<string, string>();

  return records.map(({ imageKey, ...rest }): Listing => {
    const imageUrl = imageKey ? urls.get(imageKey) : undefined;
    return imageUrl ? { ...rest, imageUrl } : rest;
  });
}
