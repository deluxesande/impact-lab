import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { listActiveListings, logAiRun } from "@/lib/db/repo";
import { runCartGraph } from "@/lib/ai/graphs/cart";
import { withDebug } from "@/lib/api/debug";
import type { CartRequest, CartResponse, ApiError } from "@/lib/ai/types";

/**
 * POST /api/ai/cart — turn a natural-language order into a cart of real listings.
 *
 * Runs the cart graph: the LLM extracts which produce and how much the shopper
 * wants; matching to real active `listings` rows and all pricing happen in code
 * so the cart is always orderable and totals are never hallucinated. Falls back
 * to a keyword matcher when no model provider is configured.
 */
export async function POST(request: Request): Promise<NextResponse<CartResponse | ApiError>> {
  try {
    await requireUser();

    let body: Partial<CartRequest>;
    try {
      body = (await request.json()) as Partial<CartRequest>;
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }

    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "missing_text", message: "A non-empty 'text' is required." } },
        { status: 400 },
      );
    }

    const listings = await listActiveListings();

    const startedAt = Date.now();
    const { response, source, model } = await runCartGraph(body.text, listings);
    const latencyMs = Date.now() - startedAt;

    await logAiRun({
      endpoint: "cart",
      source,
      modelUsed: model,
      input: { text: body.text },
      output: { itemCount: response.items.length, total: response.total },
      latencyMs,
    });

    return NextResponse.json(withDebug(response, { source, model }), { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to build cart." } },
      { status: 500 },
    );
  }
}
