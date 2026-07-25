import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { listActiveListings } from "@/lib/db/repo";
import { presentListings } from "@/lib/api/present-listing";
import type { Listing, ApiError } from "@/lib/ai/types";

/**
 * GET /api/consumer/listings — all active listings for the browse grid, newest
 * first, each with a short-lived presigned photo URL. Any authenticated user.
 */
export async function GET(): Promise<NextResponse<{ listings: Listing[] } | ApiError>> {
  try {
    await requireUser();

    const records = await listActiveListings();
    const listings = await presentListings(records);

    return NextResponse.json({ listings }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load listings." } },
      { status: 500 },
    );
  }
}
