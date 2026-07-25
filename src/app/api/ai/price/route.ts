import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { recommendPrice } from "@/lib/ai/pricing";
import type { PriceRequest, PricingData, ApiError } from "@/lib/ai/types";

/**
 * POST /api/ai/price — recommend a fair price for a produce type.
 *
 * Shared by the farmer listing flow and any advisory use. Returns PricingData.
 *
 * PHASE 3b STATUS: pricing is a mock (see src/lib/ai/pricing.ts). The real
 * LangGraph pricing graph replaces the helper internals in Phase 3 behind this
 * same contract.
 *
 * Any authenticated user may request a price (farmers pricing a listing,
 * consumers seeing context) — no role restriction.
 */
export async function POST(request: Request): Promise<NextResponse<PricingData | ApiError>> {
  try {
    await requireUser();

    let body: Partial<PriceRequest>;
    try {
      body = (await request.json()) as Partial<PriceRequest>;
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

    const data = recommendPrice({
      produceType: body.produceType,
      region: typeof body.region === "string" ? body.region : undefined,
      quantityKg: typeof body.quantityKg === "number" ? body.quantityKg : undefined,
      imageKey: typeof body.imageKey === "string" ? body.imageKey : undefined,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to compute price." } },
      { status: 500 },
    );
  }
}
