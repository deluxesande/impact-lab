import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { CartExtractionSchema } from "@/lib/ai/schemas";
import { invokeStructured, hasModelProvider } from "@/lib/ai/models";
import { normalizeProduce } from "@/lib/ai/pricing";
import type { ListingRecord } from "@/lib/db/repo";
import type { CartItem, CartResponse } from "@/lib/ai/types";

/**
 * Cart graph: turn a natural-language order into a cart of REAL listings.
 *
 * The LLM only extracts intent (which produce, how much / for how many people).
 * Matching to actual `listings` rows and all pricing happen in code, so the
 * cart is always orderable and totals are never hallucinated. Falls back to a
 * keyword matcher when no model provider is configured.
 */

const KG_PER_PERSON = 0.5;
const MALL_MARKUP = 1.75;

export interface CartGraphResult {
  response: CartResponse;
  source: string;
  model?: string;
}

function buildResponse(items: CartItem[]): CartResponse {
  const total = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  return {
    items,
    total,
    currency: "KES",
    mallComparison: {
      ourTotal: total,
      mallTotal: Math.round(total * MALL_MARKUP * 100) / 100,
      currency: "KES",
    },
  };
}

/** Choose the cheapest active listing per produce and size the line. */
function assembleCart(
  wants: { produce: string; quantityKg: number }[],
  listings: ListingRecord[],
): CartItem[] {
  const items: CartItem[] = [];
  const seen = new Set<string>();

  for (const want of wants) {
    const key = normalizeProduce(want.produce);
    if (seen.has(key)) continue;

    const candidates = listings.filter((l) => {
      const lk = normalizeProduce(l.produceType);
      const stem = lk.endsWith("s") ? lk.slice(0, -1) : lk;
      return key === lk || key === stem || key.startsWith(stem);
    });
    if (candidates.length === 0) continue;

    const cheapest = candidates.reduce((a, b) => (b.pricePerKg < a.pricePerKg ? b : a));
    const quantityKg = Math.min(Math.max(want.quantityKg, 0), cheapest.quantityKg);
    if (quantityKg <= 0) continue;

    seen.add(key);
    items.push({
      listingId: cheapest.id,
      produceType: cheapest.produceType,
      quantityKg,
      pricePerKg: cheapest.pricePerKg,
      lineTotal: Math.round(quantityKg * cheapest.pricePerKg * 100) / 100,
    });
  }
  return items;
}

/** Fallback: whole-word keyword match with a default serving size. */
function heuristicCart(text: string, listings: ListingRecord[]): CartItem[] {
  const norm = normalizeProduce(text);
  const wants = listings.map((l) => {
    const lk = normalizeProduce(l.produceType);
    const stem = lk.endsWith("s") ? lk.slice(0, -1) : lk;
    const hit = new RegExp(`\\b${stem}s?\\b`, "i").test(norm);
    return hit ? { produce: lk, quantityKg: KG_PER_PERSON } : null;
  });
  return assembleCart(wants.filter((w): w is { produce: string; quantityKg: number } => w !== null), listings);
}

export async function runCartGraph(
  text: string,
  listings: ListingRecord[],
): Promise<CartGraphResult> {
  if (!hasModelProvider()) {
    return { response: buildResponse(heuristicCart(text, listings)), source: "heuristic" };
  }

  try {
    const available = [...new Set(listings.map((l) => l.produceType))].join(", ") || "(none)";
    const system = new SystemMessage(
      "Extract the produce a shopper wants from their message. Only use produce names; ignore " +
        "everything else. If they say 'for N people', set servings to N. If they give explicit " +
        "kilograms for an item, set quantityKg; otherwise null. Prefer names from the available list.",
    );
    const human = new HumanMessage(`Available produce: ${available}\n\nShopper said: "${text}"`);

    const { data, provider } = await invokeStructured(CartExtractionSchema, [system, human], { runName: "cart.extract", tags: ["graph:cart"] });

    const servings = data.servings && data.servings > 0 ? Math.min(data.servings, 50) : 1;
    const wants = data.items.map((i) => ({
      produce: i.produce,
      quantityKg:
        i.quantityKg && i.quantityKg > 0
          ? i.quantityKg
          : Math.round(servings * KG_PER_PERSON * 100) / 100,
    }));

    const items = assembleCart(wants, listings);
    return { response: buildResponse(items), source: "llm", model: provider };
  } catch {
    return { response: buildResponse(heuristicCart(text, listings)), source: "heuristic" };
  }
}
