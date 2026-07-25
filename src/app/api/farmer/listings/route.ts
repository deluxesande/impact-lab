import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { listFarmerListings, listOrdersForFarmer } from "@/lib/db/repo";
import { presentListings } from "@/lib/api/present-listing";
import type { Listing, Order, ApiError } from "@/lib/ai/types";

interface FarmerDashboard {
  listings: Listing[];
  incomingOrders: Order[];
}

/**
 * GET /api/farmer/listings — the signed-in farmer's dashboard: their active
 * and inactive listings plus orders placed against them. Farmer role required.
 */
export async function GET(): Promise<NextResponse<FarmerDashboard | ApiError>> {
  try {
    const user = await requireUser("farmer");

    const [records, incomingOrders] = await Promise.all([
      listFarmerListings(user.id),
      listOrdersForFarmer(user.id),
    ]);
    const listings = await presentListings(records);

    return NextResponse.json({ listings, incomingOrders }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load dashboard." } },
      { status: 500 },
    );
  }
}
