import { notImplemented } from "@/lib/api/not-implemented";

/**
 * /api/consumer/* — catch-all for consumer paths without a concrete handler.
 *
 * Implemented consumer endpoints (`/api/consumer/listings`,
 * `/api/consumer/order`) have their own route files and take precedence over
 * this catch-all. Anything else under the namespace (a not-yet-built consumer
 * feature) returns the documented 501 envelope rather than a bare 404.
 */

export const GET = notImplemented;
export const POST = notImplemented;
export const PUT = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
