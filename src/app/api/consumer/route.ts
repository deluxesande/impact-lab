import { notImplemented } from "@/lib/api/not-implemented";

/**
 * /api/consumer — RESERVED namespace for the consumer (grocery delivery)
 * surface described in docs/consumer-ai.md and docs/android-app-plan.md.
 *
 * The Android app is dual-role (Farmer & Consumer). This placeholder reserves
 * the route namespace so the client sees the full intended API surface, but
 * consumer logic is deliberately out of scope for the current farmer-first
 * milestone. Implemented in a later phase.
 *
 * Nested paths (e.g. /api/consumer/orders) are handled by the sibling
 * `[...path]` catch-all so the whole namespace answers 501, not 404.
 */

export const GET = notImplemented;
export const POST = notImplemented;
export const PUT = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
