import { notImplemented } from "@/lib/api/not-implemented";

/**
 * /api/consumer/* — catch-all for the RESERVED consumer namespace.
 *
 * Ensures nested consumer URLs (e.g. /api/consumer/orders,
 * /api/consumer/cart/items) return the documented 501 envelope rather than a
 * 404, matching the `/api/consumer/*` contract in docs/api-contract.md.
 */

export const GET = notImplemented;
export const POST = notImplemented;
export const PUT = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
