import { Client } from "minio";
import { randomBytes } from "node:crypto";

/**
 * Private object storage for farmer produce photos (MinIO, S3-compatible).
 *
 * The bucket is PRIVATE: nothing is ever served by a permanent public URL.
 * Uploads return an opaque object key; reads are served through short-lived
 * presigned GET URLs minted per request. That keeps farmer photos from being
 * publicly enumerable while still letting the Android client render them.
 *
 * MinIO runs as a container alongside Postgres (see docker-compose.yml).
 */

export class StorageNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`MinIO is not configured: ${missing} is missing.`);
    this.name = "StorageNotConfiguredError";
  }
}

/** How long a presigned GET URL stays valid. Short by design. */
export const PRESIGNED_GET_TTL_SECONDS = 300; // 5 minutes

const globalForStorage = globalThis as unknown as {
  __impactLabMinio?: Client;
  __impactLabBucketReady?: Promise<void>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new StorageNotConfiguredError(name);
  return value;
}

export function getBucket(): string {
  return process.env.MINIO_BUCKET ?? "produce";
}

/** Lazily build the client so `next build` doesn't require MinIO env vars. */
export function getStorage(): Client {
  if (!globalForStorage.__impactLabMinio) {
    globalForStorage.__impactLabMinio = new Client({
      endPoint: requireEnv("MINIO_ENDPOINT"),
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: requireEnv("MINIO_ROOT_USER"),
      secretKey: requireEnv("MINIO_ROOT_PASSWORD"),
    });
  }
  return globalForStorage.__impactLabMinio;
}

/**
 * Ensure the bucket exists, once per process.
 *
 * Deliberately does NOT set a public-read policy — the bucket stays private
 * and access is only ever granted through presigned URLs.
 */
export function ensureBucket(): Promise<void> {
  if (!globalForStorage.__impactLabBucketReady) {
    globalForStorage.__impactLabBucketReady = (async () => {
      const client = getStorage();
      const bucket = getBucket();
      const exists = await client.bucketExists(bucket);
      if (!exists) await client.makeBucket(bucket);
    })().catch((err) => {
      // Don't cache a failed bootstrap — let the next request retry.
      globalForStorage.__impactLabBucketReady = undefined;
      throw err;
    });
  }
  return globalForStorage.__impactLabBucketReady;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Build an unguessable object key, namespaced per session.
 *
 * The random suffix matters: keys are the only handle on an object, so a
 * predictable key (session + timestamp alone) would let one farmer guess
 * another's. Randomness makes enumeration impractical even if a key leaks.
 *
 * No "produce/" prefix — the bucket is already named for it, and prefixing
 * would render as .../produce/produce/... in presigned URLs.
 */
export function buildObjectKey(sessionId: string, contentType: string): string {
  const ext = EXTENSION_BY_MIME[contentType] ?? "bin";
  const safeSession = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  return `${safeSession}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
}

/** Store an image and return its object key. */
export async function putImage(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  await getStorage().putObject(getBucket(), objectKey, body, body.length, {
    "Content-Type": contentType,
  });
  return objectKey;
}

/** Mint a short-lived presigned GET URL for a stored object. */
export async function presignGet(
  objectKey: string,
  ttlSeconds: number = PRESIGNED_GET_TTL_SECONDS,
): Promise<string> {
  return getStorage().presignedGetObject(getBucket(), objectKey, ttlSeconds);
}

/**
 * Presign a batch of keys, tolerating individual failures.
 *
 * Conversation history should still render if one object is missing (e.g.
 * manually deleted), so a failed presign yields undefined rather than
 * failing the whole request.
 */
export async function presignMany(
  keys: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    keys.map(async (key) => {
      try {
        out.set(key, await presignGet(key));
      } catch {
        // leave unset; caller omits imageUrl for this message
      }
    }),
  );
  return out;
}
