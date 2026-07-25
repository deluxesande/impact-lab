import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/require-user";
import { listActiveListings } from "@/lib/db/repo";
import { normalizeProduce } from "@/lib/ai/pricing";
import type { CartRequest, CartResponse, CartItem, ApiError } from "@/lib/ai/types";

/**
 * POST /api/ai/cart — turn a natural-language order into a cart of real listings.
 *
 * PHASE 3b STATUS: MOCK matcher. Extracts produce mentions and a serving count
 * from the text with simple heuristics, then maps each to a live listing. The
 * real LangGraph cart builder replaces the matching logic in Phase 3 behind
 * this same contract; crucially, items already bind to real `listings` rows so
 * the resulting cart is immediately orderable.
 */

/** Rough kg per person for a single produce line — enough for a believable demo. */
const KG_PER_PERSON = 0.5;
/** Assumed supermarket/mall markup over our price, for the comparison badge. */
const MALL_MARKUP = 1.75;

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does the (normalized) text mention this produce as a whole word?
 *
 * Anchored on word boundaries so short names don't match inside unrelated words
 * (the previous substring check let "pea" match "please"). A simple regular
 * plural is tolerated in both directions ("onion" ↔ "onions") by allowing an
 * optional trailing "s". Multi-word names ("sukuma wiki") match as a phrase.
 *
 * Irregular plurals (tomato/tomatoes) are NOT handled — this heuristic matcher
 * is a placeholder replaced by the LLM cart builder in Phase 3, which resolves
 * produce names semantically. The fix here is scoped to the reported issue
 * (spurious substring matches), not to full stemming.
 */
function mentionsProduce(text: string, produce: string): boolean {
  const stem = produce.endsWith("s") ? produce.slice(0, -1) : produce;
  const pattern = new RegExp(`\\b${escapeRegExp(stem)}s?\\b`, "i");
  return pattern.test(text);
}

/** Pull a "for N people" serving count out of the text; default 1. */
function parseServings(text: string): number {
  const m = text.match(/(\d+)\s*(?:people|person|pax|servings?)/i);
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 1;
}

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

    const servings = parseServings(body.text);
    const text = normalizeProduce(body.text);
    const listings = await listActiveListings();

    // Match each active listing whose produce is mentioned in the text, taking
    // the cheapest listing per produce type so the cart minimizes cost. Match on
    // whole words so "onion" doesn't match "onions" spuriously and short names
    // don't match inside unrelated words.
    const cheapestByProduce = new Map<string, (typeof listings)[number]>();
    for (const l of listings) {
      const key = normalizeProduce(l.produceType);
      if (!mentionsProduce(text, key)) continue;
      const current = cheapestByProduce.get(key);
      if (!current || l.pricePerKg < current.pricePerKg) {
        cheapestByProduce.set(key, l);
      }
    }

    const items: CartItem[] = [];
    for (const listing of cheapestByProduce.values()) {
      const wantKg = Math.round(servings * KG_PER_PERSON * 100) / 100;
      const quantityKg = Math.min(wantKg, listing.quantityKg);
      if (quantityKg <= 0) continue;
      items.push({
        listingId: listing.id,
        produceType: listing.produceType,
        quantityKg,
        pricePerKg: listing.pricePerKg,
        lineTotal: Math.round(quantityKg * listing.pricePerKg * 100) / 100,
      });
    }

    const total = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;

    const response: CartResponse = {
      items,
      total,
      currency: "KES",
      mallComparison: {
        ourTotal: total,
        mallTotal: Math.round(total * MALL_MARKUP * 100) / 100,
        currency: "KES",
      },
    };

    return NextResponse.json(response, { status: 200 });
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
