import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/ai/types";

/**
 * /api/consumer/* — RESERVED namespace for the consumer (grocery delivery)
 * surface described in docs/consumer-ai.md and docs/android-app-plan.md.
 *
 * The Android app is dual-role (Farmer & Consumer). This placeholder reserves
 * the route namespace so the client sees the full intended API surface, but
 * consumer logic is deliberately out of scope for the current farmer-first
 * milestone. Implemented in a later phase.
 */

function notImplemented(): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: "not_implemented",
        message: "The consumer surface is not implemented yet. See docs/consumer-ai.md.",
      },
    },
    { status: 501 },
  );
}

export const GET = notImplemented;
export const POST = notImplemented;
