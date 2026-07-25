import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { createListing } from "@/lib/db/repo";
import { recommendPrice } from "@/lib/ai/pricing";
import { presentListings } from "@/lib/api/present-listing";
import type { CreateListingRequest, Listing, ApiError } from "@/lib/ai/types";

/**
 * POST /api/farmer/listing — publish a produce listing.
 *
 * Request: { produceType, quantityKg, pricePerKg?, imageKey? }
 * If pricePerKg is omitted, the server fills it from /api/ai/price's logic.
 * Farmer role required.
 */
export async function POST(request: Request): Promise<NextResponse<Listing | ApiError>> {
  try {
    const user = await requireUser("farmer");

    let body: Partial<CreateListingRequest>;
    try {
      body = (await request.json()) as Partial<CreateListingRequest>;
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }

    if (typeof body.produceType !== "string" || body.produceType.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "missing_produce", message: "A non-empty 'produceType' is required." } },
        { status: 400 },
      );
    }
    if (typeof body.quantityKg !== "number" || !(body.quantityKg > 0)) {
      return NextResponse.json(
        { error: { code: "invalid_quantity", message: "'quantityKg' must be a positive number." } },
        { status: 400 },
      );
    }
    if (
      body.pricePerKg !== undefined &&
      (typeof body.pricePerKg !== "number" || !(body.pricePerKg >= 0))
    ) {
      return NextResponse.json(
        { error: { code: "invalid_price", message: "'pricePerKg' must be a non-negative number." } },
        { status: 400 },
      );
    }

    // Fall back to the AI recommendation when the farmer doesn't set a price.
    const pricePerKg =
      body.pricePerKg ??
      recommendPrice({ produceType: body.produceType }).pricePerKg ??
      0;

    const record = await createListing({
      farmerId: user.id,
      produceType: body.produceType.trim(),
      quantityKg: body.quantityKg,
      pricePerKg,
      imageKey: typeof body.imageKey === "string" ? body.imageKey : undefined,
    });

    const [listing] = await presentListings([record]);
    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create listing." } },
      { status: 500 },
    );
  }
}
