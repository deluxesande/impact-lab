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
  __impactLabPublicMinio?: Client;
  __impactLabBucketReady?: Promise<void>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new StorageNotConfiguredError(name);
  return value;
}

/**
 * Read an optional env var, treating an empty string as unset.
 *
 * `.env` files routinely carry blank placeholders, and `??` alone would accept
 * `""` as a real value — yielding, for example, an empty MinIO host.
 */
function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function getBucket(): string {
  // Blank MINIO_BUCKET falls back to the default rather than an empty name.
  return optionalEnv("MINIO_BUCKET") ?? "produce";
}

/**
 * Connection details for talking to MinIO from the server.
 *
 * On a deployed stack this is typically an internal address (a Docker service
 * name such as `minio`, or localhost), which is NOT reachable by an Android
 * client on someone's phone.
 */
function internalConfig() {
  // Blank MINIO_PORT falls back to the default instead of Number("") === 0.
  const port = optionalEnv("MINIO_PORT");
  return {
    endPoint: requireEnv("MINIO_ENDPOINT"),
    port: port ? Number(port) : 9000,
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: requireEnv("MINIO_ROOT_USER"),
    secretKey: requireEnv("MINIO_ROOT_PASSWORD"),
  };
}

/**
 * Connection details used ONLY to sign URLs handed to clients.
 *
 * A presigned URL embeds the host of the client that signed it, and the
 * signature covers that host — so it cannot be rewritten after the fact. If we
 * signed with the internal address, the Android app would receive something
 * like `http://minio:9000/...` (or `localhost`, meaning the phone itself) and
 * every image would fail to load.
 *
 * MINIO_PUBLIC_* therefore describes how the outside world reaches MinIO.
 * It falls back to the internal config so local development still works, where
 * the two genuinely are the same host.
 */
function publicConfig() {
  const internal = internalConfig();
  const port = optionalEnv("MINIO_PUBLIC_PORT");
  const useSSL = optionalEnv("MINIO_PUBLIC_USE_SSL");
  return {
    ...internal,
    endPoint: optionalEnv("MINIO_PUBLIC_ENDPOINT") ?? internal.endPoint,
    port: port ? Number(port) : internal.port,
    useSSL: useSSL ? useSSL === "true" : internal.useSSL,
    // Pin a region so presignedGetObject signs offline. Without it the client
    // makes a live getBucketLocation call to resolve the region first — which
    // fails (ECONNREFUSED) when the public host isn't reachable from the
    // server, exactly the split-host case this client exists for. Signing is
    // then a pure local operation and never touches the public host.
    region: optionalEnv("MINIO_REGION") ?? "us-east-1",
  };
}

/**
 * Client for server-side operations (upload, stat, bucket bootstrap).
 * Lazily built so `next build` doesn't require MinIO env vars.
 */
export function getStorage(): Client {
  if (!globalForStorage.__impactLabMinio) {
    globalForStorage.__impactLabMinio = new Client(internalConfig());
  }
  return globalForStorage.__impactLabMinio;
}

/** Client used solely to mint presigned URLs against the public host. */
export function getPublicStorage(): Client {
  if (!globalForStorage.__impactLabPublicMinio) {
    globalForStorage.__impactLabPublicMinio = new Client(publicConfig());
  }
  return globalForStorage.__impactLabPublicMinio;
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

/**
 * Mint a short-lived presigned GET URL for a stored object.
 *
 * Signed against the PUBLIC host so the returned URL is reachable by the
 * client. Note this is a local signing operation — it does not contact MinIO
 * and therefore cannot tell whether the object actually exists.
 */
export async function presignGet(
  objectKey: string,
  ttlSeconds: number = PRESIGNED_GET_TTL_SECONDS,
): Promise<string> {
  return getPublicStorage().presignedGetObject(getBucket(), objectKey, ttlSeconds);
}

/** S3/MinIO error codes meaning "this object simply isn't there". */
const NOT_FOUND_CODES = new Set(["NotFound", "NoSuchKey"]);

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === "string" && NOT_FOUND_CODES.has(code);
}

/**
 * Presign a batch of keys, skipping only objects that are genuinely gone.
 *
 * Existence is checked with statObject because presigning is a local signing
 * operation that would happily produce a URL for a key that doesn't exist.
 *
 * Only a NotFound is tolerated (an object deleted out from under us shouldn't
 * break the whole conversation). Every other failure — bad credentials,
 * misconfiguration, MinIO being unreachable — is rethrown, so a broken storage
 * layer surfaces as an error instead of silently rendering every conversation
 * without its images.
 */
export async function presignMany(
  keys: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    keys.map(async (key) => {
      try {
        await getStorage().statObject(getBucket(), key);
      } catch (err) {
        if (isNotFound(err)) return; // leave unset; caller omits imageUrl
        throw err;
      }
      out.set(key, await presignGet(key));
    }),
  );
  return out;
}
