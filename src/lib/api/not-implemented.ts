import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/ai/types";

/**
 * Uniform 501 response for reserved-but-unimplemented API namespaces.
 *
 * Shared by the `/api/consumer` base route and its `[...path]` catch-all so
 * every URL under the reserved namespace answers with the same envelope
 * instead of some paths falling through to a 404.
 */
export function notImplemented(): NextResponse<ApiError> {
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
