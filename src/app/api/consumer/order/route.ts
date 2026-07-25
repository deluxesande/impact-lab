import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { getListing, createOrder, InsufficientStockError } from "@/lib/db/repo";
import { isUuid } from "@/lib/api/uuid";
import type { CreateOrderRequest, Order, ApiError } from "@/lib/ai/types";

/**
 * POST /api/consumer/order — place an order against a listing.
 *
 * Request: { listingId, quantityKg }
 * Delivery is mocked for the MVP (status starts as 'placed'). Consumer role
 * required. Total is computed server-side from the listing price so the client
 * can't set its own total.
 */
export async function POST(request: Request): Promise<NextResponse<Order | ApiError>> {
  try {
    const user = await requireUser("consumer");

    let body: Partial<CreateOrderRequest>;
    try {
      body = (await request.json()) as Partial<CreateOrderRequest>;
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }

    if (typeof body.listingId !== "string" || body.listingId.length === 0) {
      return NextResponse.json(
        { error: { code: "missing_listing", message: "A 'listingId' is required." } },
        { status: 400 },
      );
    }
    if (!isUuid(body.listingId)) {
      return NextResponse.json(
        { error: { code: "invalid_listing", message: "'listingId' must be a valid UUID." } },
        { status: 400 },
      );
    }
    if (typeof body.quantityKg !== "number" || !(body.quantityKg > 0)) {
      return NextResponse.json(
        { error: { code: "invalid_quantity", message: "'quantityKg' must be a positive number." } },
        { status: 400 },
      );
    }

    // Fetch the listing for a friendly 404 and the unit price. Stock is NOT
    // enforced from this snapshot — createOrder consumes stock atomically, so
    // it stays correct under concurrent orders.
    const listing = await getListing(body.listingId);
    if (!listing || !listing.active) {
      return NextResponse.json(
        { error: { code: "listing_unavailable", message: "That listing is not available." } },
        { status: 404 },
      );
    }

    try {
      const order = await createOrder({
        consumerId: user.id,
        listingId: listing.id,
        quantityKg: body.quantityKg,
        pricePerKg: listing.pricePerKg,
        currency: listing.currency,
      });
      return NextResponse.json(order, { status: 201 });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: { code: "insufficient_quantity", message: "Insufficient stock for that quantity." } },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to place order." } },
      { status: 500 },
    );
  }
}
